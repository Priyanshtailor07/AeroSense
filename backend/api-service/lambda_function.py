"""
AeroSense telemetry API.

Routes (all GET):
  /health                                   public
  /zones                                    distinct zone ids
  /telemetry/latest?zone_id=...             newest record for a zone
  /telemetry/history?zone_id=...&limit=N    newest-first page, limit 1-100
  /alerts?zone_id=...&limit=N               recent records carrying alerts

Performance note
----------------
/zones and /alerts previously called scan_all(), which paginated the WHOLE
table on every request and accumulated every item in memory. The simulator
appends one record per minute, so that work grew without bound and eventually
exceeded the 3s Lambda timeout, which API Gateway surfaced as a bare
502/500 "Internal Server Error".

Both routes are now bounded:
  * /zones  scans with a zone_id-only projection, caps the number of pages,
            and caches the result in module scope for ZONE_CACHE_TTL_S so a
            warm container answers without touching DynamoDB at all.
  * /alerts queries each known zone newest-first with a bounded Limit and a
            server-side FilterExpression, instead of reading the whole table.

Neither route reads more than a fixed amount of data regardless of how large
BuildingTelemetry grows.
"""

import json
import os
import logging
import time
from decimal import Decimal

import boto3
from boto3.dynamodb.conditions import Key, Attr
from botocore.exceptions import ClientError

logger = logging.getLogger()
logger.setLevel(logging.INFO)

TABLE_NAME = os.environ["DYNAMODB_TABLE"]
table = boto3.resource("dynamodb").Table(TABLE_NAME)

# Bounds. These cap the work any single request can do.
ZONE_SCAN_PAGE_LIMIT = 20       # pages of the projected zone scan
ZONE_SCAN_PAGE_SIZE = 500       # items per page (zone_id only)
ZONE_CACHE_TTL_S = 300          # warm-container cache for the zone list
ALERT_SCAN_PER_ZONE = 200       # newest records inspected per zone
MAX_LIMIT = 100

# Module-scope cache, shared by invocations on a warm container.
_zone_cache = {"zones": None, "expires_at": 0.0}


def json_safe(value):
    """DynamoDB returns Decimal; make it JSON-serializable."""
    if isinstance(value, Decimal):
        return int(value) if value % 1 == 0 else float(value)
    if isinstance(value, dict):
        return {k: json_safe(v) for k, v in value.items()}
    if isinstance(value, list):
        return [json_safe(v) for v in value]
    if isinstance(value, set):
        return [json_safe(v) for v in value]
    return value


def reply(status, data, request_id=None):
    body = data
    if request_id and isinstance(data, dict) and "error" in data:
        body = {**data, "request_id": request_id}
    return {
        "statusCode": status,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps(json_safe(body))
    }


def parse_limit(params, default):
    """Validate the limit query parameter. Returns (limit, error_reply)."""
    raw = params.get("limit", str(default))
    try:
        limit = int(raw)
    except (TypeError, ValueError):
        return None, reply(400, {"error": "limit must be an integer"})
    if not 1 <= limit <= MAX_LIMIT:
        return None, reply(400, {"error": f"limit must be 1-{MAX_LIMIT}"})
    return limit, None


def list_zones():
    """
    Distinct zone ids.

    Projects only zone_id so each page is tiny, caps the number of pages, and
    caches the result. Returns (zones, truncated).
    """
    now = time.time()
    if _zone_cache["zones"] is not None and now < _zone_cache["expires_at"]:
        return _zone_cache["zones"], False

    zones = set()
    args = {
        "ProjectionExpression": "zone_id",
        "Limit": ZONE_SCAN_PAGE_SIZE,
    }
    truncated = False

    for _ in range(ZONE_SCAN_PAGE_LIMIT):
        result = table.scan(**args)
        for item in result.get("Items", []):
            zone = item.get("zone_id")
            if zone:
                zones.add(zone)

        key = result.get("LastEvaluatedKey")
        if not key:
            break
        args["ExclusiveStartKey"] = key
    else:
        # Loop finished without break: more pages remain.
        truncated = True
        logger.warning("zone scan hit the page cap; result may be partial")

    ordered = sorted(zones)
    _zone_cache["zones"] = ordered
    _zone_cache["expires_at"] = now + ZONE_CACHE_TTL_S
    return ordered, truncated


def recent_alerts(zone_id, limit):
    """
    Records carrying a non-empty `alerts` list, newest first.

    Queries each zone's most recent records with a server-side filter rather
    than scanning the table. Bounded by ALERT_SCAN_PER_ZONE per zone.
    """
    zones = [zone_id] if zone_id else list_zones()[0]
    collected = []

    for zone in zones:
        try:
            result = table.query(
                KeyConditionExpression=Key("zone_id").eq(zone),
                FilterExpression=Attr("alerts").exists() & Attr("alerts").size().gt(0),
                ScanIndexForward=False,
                Limit=ALERT_SCAN_PER_ZONE,
            )
        except ClientError:
            logger.exception("alert query failed for zone %s", zone)
            raise
        collected.extend(result.get("Items", []))

    collected.sort(key=lambda item: str(item.get("timestamp", "")), reverse=True)
    return collected[:limit]


def handler(event, context):
    request_id = getattr(context, "aws_request_id", None)

    try:
        http = event.get("requestContext", {}).get("http", {})
        method = http.get("method", "GET")
        path = event.get("rawPath", "/health")
        params = event.get("queryStringParameters") or {}

        if method == "GET" and path == "/health":
            return reply(200, {"status": "ok", "service": "AeroSense API"})

        if method != "GET":
            return reply(405, {"error": "Method not allowed"}, request_id)

        if path == "/zones":
            zones, truncated = list_zones()
            body = {"count": len(zones), "zones": zones}
            if truncated:
                body["partial"] = True
            return reply(200, body)

        if path == "/telemetry/latest":
            zone_id = params.get("zone_id")

            if zone_id:
                result = table.query(
                    KeyConditionExpression=Key("zone_id").eq(zone_id),
                    ScanIndexForward=False,
                    Limit=1
                )
                items = result.get("Items", [])
                if not items:
                    return reply(404, {"error": "No telemetry found for this zone"}, request_id)
                return reply(200, {"item": items[0]})

            # No zone_id: one bounded query per known zone, never a full scan.
            zones, _ = list_zones()
            latest = []
            for zone in zones:
                result = table.query(
                    KeyConditionExpression=Key("zone_id").eq(zone),
                    ScanIndexForward=False,
                    Limit=1
                )
                items = result.get("Items", [])
                if items:
                    latest.append(items[0])
            return reply(200, {"items": latest})

        if path == "/telemetry/history":
            zone_id = params.get("zone_id")
            if not zone_id:
                return reply(400, {"error": "zone_id is required"}, request_id)

            limit, err = parse_limit(params, 50)
            if err:
                return err

            result = table.query(
                KeyConditionExpression=Key("zone_id").eq(zone_id),
                ScanIndexForward=False,
                Limit=limit
            )
            return reply(200, {"zone_id": zone_id, "items": result.get("Items", [])})

        if path == "/alerts":
            limit, err = parse_limit(params, 20)
            if err:
                return err

            items = recent_alerts(params.get("zone_id"), limit)
            return reply(200, {"count": len(items), "items": items})

        return reply(404, {"error": "Route not found"}, request_id)

    except ClientError:
        # Logged server-side with the real detail; the client gets a stable
        # shape and a request id, never a stack trace.
        logger.exception("DynamoDB request failed")
        return reply(500, {"error": "Database request failed"}, request_id)
    except Exception:
        logger.exception("Unexpected API error")
        return reply(500, {"error": "Internal server error"}, request_id)
