#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# Deploys the AeroSense Cognito auth Lambda and wires it onto the existing
# HTTP API as nine PUBLIC /auth/* routes (no JWT authorizer — these routes are
# how a caller *obtains* a JWT in the first place).
#
# Idempotent: re-running updates the function code and configuration in place.
#
# Prerequisites
#   * aws CLI v2, authenticated with permission to manage Lambda, IAM,
#     API Gateway v2 and Secrets Manager in ap-south-1
#   * node + npm (to install the function's dependencies)
#   * The Cognito app client secret, supplied as COGNITO_CLIENT_SECRET
#     on the first run only (it is stored in Secrets Manager thereafter)
# -----------------------------------------------------------------------------
set -euo pipefail

REGION="${AWS_REGION:-ap-south-1}"
API_ID="${API_ID:-w13tvv9i82}"
USER_POOL_ID="${USER_POOL_ID:-ap-south-1_FKhf1Lwlb}"
CLIENT_ID="${CLIENT_ID:-3k6ksdrbrlqppsd2kc5tqoaa1m}"
FUNCTION_NAME="${FUNCTION_NAME:-aerosense-auth-service}"
ROLE_NAME="${ROLE_NAME:-aerosense-auth-service-role}"
SECRET_NAME="${SECRET_NAME:-aerosense/cognito-client-secret}"
ALLOWED_ORIGINS="${ALLOWED_ORIGINS:-https://main.d2a5305jofq8oe.amplifyapp.com,http://localhost:3000}"
ALLOW_SELF_SIGNUP="${ALLOW_SELF_SIGNUP:-false}"
RUNTIME="nodejs20.x"

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$HERE"

ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
echo "==> Account ${ACCOUNT_ID}, region ${REGION}, API ${API_ID}"

# --- 1. Store the client secret ----------------------------------------------
if aws secretsmanager describe-secret --secret-id "$SECRET_NAME" --region "$REGION" >/dev/null 2>&1; then
  echo "==> Secret ${SECRET_NAME} already exists (leaving its value untouched)"
else
  if [[ -z "${COGNITO_CLIENT_SECRET:-}" ]]; then
    echo "ERROR: first run needs the app client secret. Retrieve it with:" >&2
    echo "  aws cognito-idp describe-user-pool-client --user-pool-id ${USER_POOL_ID} \\" >&2
    echo "      --client-id ${CLIENT_ID} --region ${REGION} \\" >&2
    echo "      --query 'UserPoolClient.ClientSecret' --output text" >&2
    echo "then re-run:  COGNITO_CLIENT_SECRET=<value> ./deploy.sh" >&2
    exit 1
  fi
  echo "==> Creating secret ${SECRET_NAME}"
  aws secretsmanager create-secret \
    --name "$SECRET_NAME" \
    --description "Cognito app client secret for the AeroSense auth Lambda" \
    --secret-string "{\"clientSecret\":\"${COGNITO_CLIENT_SECRET}\"}" \
    --region "$REGION" >/dev/null
fi
SECRET_ARN="$(aws secretsmanager describe-secret --secret-id "$SECRET_NAME" --region "$REGION" --query ARN --output text)"

# --- 2. Execution role --------------------------------------------------------
if ! aws iam get-role --role-name "$ROLE_NAME" >/dev/null 2>&1; then
  echo "==> Creating role ${ROLE_NAME}"
  aws iam create-role --role-name "$ROLE_NAME" --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": { "Service": "lambda.amazonaws.com" },
      "Action": "sts:AssumeRole"
    }]
  }' >/dev/null
  aws iam attach-role-policy --role-name "$ROLE_NAME" \
    --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole >/dev/null
  echo "==> Waiting for IAM role propagation"
  sleep 12
fi

# Least privilege: the only AWS-authenticated call the function makes is
# reading the secret. Cognito's InitiateAuth/ForgotPassword/etc. are
# unauthenticated APIs and need no IAM grant.
aws iam put-role-policy --role-name "$ROLE_NAME" \
  --policy-name aerosense-auth-secret-read \
  --policy-document "{
    \"Version\": \"2012-10-17\",
    \"Statement\": [{
      \"Effect\": \"Allow\",
      \"Action\": \"secretsmanager:GetSecretValue\",
      \"Resource\": \"${SECRET_ARN}\"
    }]
  }" >/dev/null
ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/${ROLE_NAME}"

# --- 3. Package ---------------------------------------------------------------
echo "==> Installing production dependencies"
rm -rf build && mkdir -p build
cp index.mjs package.json build/
( cd build && npm install --omit=dev --no-audit --no-fund --loglevel=error )
( cd build && zip -qr ../function.zip . )
echo "==> Package: $(du -h function.zip | cut -f1)"

# Built as JSON, not the Variables={k=v,...} shorthand: ALLOWED_ORIGINS is a
# comma-separated list, and the shorthand parser treats every comma as a
# key separator.
python3 - "$USER_POOL_ID" "$CLIENT_ID" "$SECRET_NAME" "$ALLOWED_ORIGINS" "$ALLOW_SELF_SIGNUP" > env.json <<'PYEOF'
import json, sys
pool, client, secret, origins, signup = sys.argv[1:6]
json.dump({"Variables": {
    "COGNITO_USER_POOL_ID": pool,
    "COGNITO_CLIENT_ID": client,
    "COGNITO_CLIENT_SECRET_ID": secret,
    "ALLOWED_ORIGINS": origins,
    "ALLOW_SELF_SIGNUP": signup,
}}, sys.stdout)
PYEOF
ENV_VARS="file://env.json"

# --- 4. Create or update the function -----------------------------------------
if aws lambda get-function --function-name "$FUNCTION_NAME" --region "$REGION" >/dev/null 2>&1; then
  echo "==> Updating ${FUNCTION_NAME} code"
  aws lambda update-function-code --function-name "$FUNCTION_NAME" \
    --zip-file fileb://function.zip --region "$REGION" >/dev/null
  aws lambda wait function-updated --function-name "$FUNCTION_NAME" --region "$REGION"
  echo "==> Updating ${FUNCTION_NAME} configuration"
  aws lambda update-function-configuration --function-name "$FUNCTION_NAME" \
    --handler index.handler --runtime "$RUNTIME" --timeout 15 --memory-size 512 \
    --environment "$ENV_VARS" --region "$REGION" >/dev/null
  aws lambda wait function-updated --function-name "$FUNCTION_NAME" --region "$REGION"
else
  echo "==> Creating ${FUNCTION_NAME}"
  aws lambda create-function --function-name "$FUNCTION_NAME" \
    --runtime "$RUNTIME" --role "$ROLE_ARN" --handler index.handler \
    --zip-file fileb://function.zip --timeout 15 --memory-size 512 \
    --environment "$ENV_VARS" --region "$REGION" >/dev/null
  aws lambda wait function-active-v2 --function-name "$FUNCTION_NAME" --region "$REGION"
fi
FUNCTION_ARN="$(aws lambda get-function --function-name "$FUNCTION_NAME" --region "$REGION" --query 'Configuration.FunctionArn' --output text)"

# --- 5. API Gateway integration + routes --------------------------------------
INTEGRATION_ID="$(aws apigatewayv2 get-integrations --api-id "$API_ID" --region "$REGION" \
  --query "Items[?IntegrationUri=='${FUNCTION_ARN}'].IntegrationId | [0]" --output text)"

if [[ "$INTEGRATION_ID" == "None" || -z "$INTEGRATION_ID" ]]; then
  echo "==> Creating Lambda proxy integration"
  INTEGRATION_ID="$(aws apigatewayv2 create-integration --api-id "$API_ID" --region "$REGION" \
    --integration-type AWS_PROXY --integration-uri "$FUNCTION_ARN" \
    --payload-format-version 2.0 --timeout-in-millis 20000 \
    --query IntegrationId --output text)"
fi
echo "==> Integration ${INTEGRATION_ID}"

# These routes are intentionally left unauthorized: they issue the JWT that
# every other route requires.
for ACTION in signin respond-challenge refresh signout forgot-password \
              confirm-forgot-password confirm-signup resend-confirmation signup; do
  ROUTE_KEY="POST /auth/${ACTION}"
  EXISTING="$(aws apigatewayv2 get-routes --api-id "$API_ID" --region "$REGION" \
    --query "Items[?RouteKey=='${ROUTE_KEY}'].RouteId | [0]" --output text)"
  if [[ "$EXISTING" == "None" || -z "$EXISTING" ]]; then
    aws apigatewayv2 create-route --api-id "$API_ID" --region "$REGION" \
      --route-key "$ROUTE_KEY" --target "integrations/${INTEGRATION_ID}" \
      --authorization-type NONE >/dev/null
    echo "    + ${ROUTE_KEY}"
  else
    aws apigatewayv2 update-route --api-id "$API_ID" --region "$REGION" \
      --route-id "$EXISTING" --target "integrations/${INTEGRATION_ID}" \
      --authorization-type NONE >/dev/null
    echo "    = ${ROUTE_KEY}"
  fi
done

# --- 6. Allow API Gateway to invoke the function ------------------------------
aws lambda add-permission --function-name "$FUNCTION_NAME" --region "$REGION" \
  --statement-id apigw-auth-invoke --action lambda:InvokeFunction \
  --principal apigateway.amazonaws.com \
  --source-arn "arn:aws:execute-api:${REGION}:${ACCOUNT_ID}:${API_ID}/*/*/auth/*" \
  >/dev/null 2>&1 || echo "==> Invoke permission already present"

# --- 7. CORS ------------------------------------------------------------------
# The /auth/* routes are served by the Lambda itself, which emits its own CORS
# headers. The API-level CORS config still needs the exact Amplify origin for
# the protected routes; assert it rather than assume it.
echo "==> Current API CORS configuration:"
aws apigatewayv2 get-api --api-id "$API_ID" --region "$REGION" --query CorsConfiguration

# --- 8. Smoke test ------------------------------------------------------------
API_URL="https://${API_ID}.execute-api.${REGION}.amazonaws.com"
echo "==> Smoke test: POST ${API_URL}/auth/signin with a deliberately bad body"
curl -s -o /dev/null -w "    HTTP %{http_code} (expect 400 INVALID_INPUT)\n" \
  -X POST "${API_URL}/auth/signin" -H 'Content-Type: application/json' -d '{}'

echo
echo "Deployed. Set this in Amplify (no secrets):"
echo "  VITE_AEROSENSE_API_URL=${API_URL}"
echo "  VITE_AWS_REGION=${REGION}"
echo "  VITE_COGNITO_USER_POOL_ID=${USER_POOL_ID}"
echo "  VITE_COGNITO_CLIENT_ID=${CLIENT_ID}"
