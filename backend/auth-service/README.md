# AeroSense auth service

A single Lambda that lets the AeroSense SPA authenticate against a Cognito app
client that has a **client secret**, without that secret ever reaching a
browser.

## Why this exists

The app client `3k6ksdrbrlqppsd2kc5tqoaa1m` is a *confidential* client. Cognito
therefore rejects `InitiateAuth` (and `ForgotPassword`, `SignUp`, …) unless the
caller supplies:

```
SECRET_HASH = Base64( HMAC-SHA256( key = <client secret>,
                                   msg = <username> + <client id> ) )
```

The previous build called `cognito-idp` straight from the browser with no
`SECRET_HASH`, which produced:

```
400 NotAuthorizedException
Client 3k6ksdrbrlqppsd2kc5tqoaa1m is configured with secret but SECRET_HASH was not received
```

Computing that hash in the browser would require shipping the client secret in
the bundle, where anyone could read it. So this Lambda does it instead: it reads
the secret from Secrets Manager and returns only the resulting tokens.

## Routes

All are `POST`, all **public** (they are how a caller obtains a JWT), all
mounted on the existing HTTP API `w13tvv9i82`:

| Route | Body | Notes |
|---|---|---|
| `/auth/signin` | `{username, password}` | Returns `{session}` or `{challenge}` |
| `/auth/respond-challenge` | `{challengeName, session, username, newPassword\|code}` | `NEW_PASSWORD_REQUIRED`, `SMS_MFA`, `SOFTWARE_TOKEN_MFA` |
| `/auth/refresh` | `{username, refreshToken}` | `username` is required: it is part of `SECRET_HASH` |
| `/auth/signout` | `{refreshToken, accessToken}` | Revokes the token and globally signs out |
| `/auth/forgot-password` | `{username}` | Always reports success, to avoid account enumeration |
| `/auth/confirm-forgot-password` | `{username, code, newPassword}` | |
| `/auth/confirm-signup` | `{username, code}` | |
| `/auth/resend-confirmation` | `{username}` | |
| `/auth/signup` | `{username, password, email}` | 403 unless `ALLOW_SELF_SIGNUP=true` |

Responses are `{ok: true, ...}` or `{ok: false, code, message}`. Credential
failures all collapse to `INVALID_CREDENTIALS` so responses cannot be used to
discover which accounts exist.

## Deploying

```bash
# One-off: fetch the existing client secret (do not commit or echo it anywhere)
aws cognito-idp describe-user-pool-client \
  --user-pool-id ap-south-1_FKhf1Lwlb \
  --client-id 3k6ksdrbrlqppsd2kc5tqoaa1m \
  --region ap-south-1 \
  --query 'UserPoolClient.ClientSecret' --output text

COGNITO_CLIENT_SECRET='<that value>' ./deploy.sh
```

`deploy.sh` is idempotent: later runs update the code and configuration and do
not touch the stored secret. It creates the secret, the execution role, the
function, the Lambda proxy integration, the nine routes and the invoke
permission, then smoke-tests `/auth/signin`.

This creates **no new Cognito resources**. The user pool and app client are used
exactly as they are.

## Environment

| Variable | Purpose |
|---|---|
| `COGNITO_USER_POOL_ID` | `ap-south-1_FKhf1Lwlb` |
| `COGNITO_CLIENT_ID` | `3k6ksdrbrlqppsd2kc5tqoaa1m` |
| `COGNITO_CLIENT_SECRET_ID` | Secrets Manager id holding the client secret |
| `ALLOWED_ORIGINS` | Comma-separated exact origins, no trailing slash |
| `ALLOW_SELF_SIGNUP` | `true` to expose `/auth/signup` |
| `COGNITO_CLIENT_SECRET` | Literal secret — **local `sam local` testing only** |

## IAM

The only AWS-authenticated call the function makes is reading the secret, so the
execution role needs just `secretsmanager:GetSecretValue` on that one secret,
plus `AWSLambdaBasicExecutionRole` for logs. Cognito's `InitiateAuth`,
`ForgotPassword`, `RevokeToken` and friends are *unauthenticated* APIs and need
no IAM grant. `iam-policy.json` additionally lists those Cognito actions for
deployments that prefer to make the intent explicit; `deploy.sh` attaches only
the minimal secret-read policy.

## CORS

HTTP APIs with an API-level `CorsConfiguration` override any CORS headers the
integration returns, so the API's own configuration governs these routes. It
already allows `https://main.d2a5305jofq8oe.amplifyapp.com` with `POST`,
`OPTIONS` and the `authorization`/`content-type` headers. The Lambda still emits
its own headers so it behaves correctly behind a function URL or in local
testing.

## Notes and limitations

* **Rate limiting is per-container and best effort.** It is a speed bump. The
  real controls are Cognito's own throttling and, if you want a hard limit, an
  API Gateway usage plan or a WAF rule on `/auth/*`.
* `REFRESH_TOKEN_AUTH` does not return a new refresh token, so the handler
  echoes the caller's back to keep the chain alive.
* Provider errors are logged server-side with their real Cognito exception name
  and returned to the client only in collapsed, safe form.
