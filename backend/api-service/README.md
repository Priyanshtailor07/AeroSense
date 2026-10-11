# AeroSense telemetry API (`AeroSense-API-Function`)

Serves the protected telemetry routes behind `AeroSense-HTTP-API`. Reads
DynamoDB `BuildingTelemetry`; writes nothing.

## The outage this code fixes

`GET /zones` and `GET /alerts` began returning `500 Internal Server Error` in
production. CloudWatch showed `Status: timeout`, `Duration: 3000.00 ms`.

Both routes called a `scan_all()` helper that paginated the **entire** table and
accumulated every item in memory. The simulator appends one record per minute,
so that work grew without bound. At ~1,700 items it finished inside the 3 s
Lambda timeout; by ~2,700 items it did not. The function was killed mid-request,
so API Gateway returned its own generic `{"message":"Internal Server Error"}`
rather than the handler's error shape — which is how you tell a crash from a
handled failure.

`/telemetry/latest` and `/telemetry/history` were unaffected throughout, because
they use `table.query()` against the partition key.

### What changed

Both routes are now bounded, so neither reads more than a fixed amount of data
however large the table grows:

| Route | Before | After |
|---|---|---|
| `/zones` | full table scan, every attribute | `zone_id`-only projection, page cap, 300 s warm-container cache |
| `/alerts` | full table scan, filtered in Python | per-zone `query` newest-first, server-side `FilterExpression`, bounded `Limit` |
| `/telemetry/latest` (no `zone_id`) | full table scan | one bounded `query` per known zone |

Raising the timeout alone would only have deferred the failure, so the scans
were removed. Timeout `3 s → 10 s` and memory `128 → 256 MB` were applied as
headroom, not as the fix.

Measured after deploy: `/zones` **1.57 ms** execution (was timing out at 3000 ms).

## Other behaviour

* `Decimal` from DynamoDB is converted for JSON; sets are handled too.
* `limit` is validated (1–100) with a clear `400`, not a 500.
* A missing `zone_id` on `/telemetry/history` is an explicit `400`.
* A zone with no records is `404 {"error": "No telemetry found for this zone"}`.
* Errors carry a `request_id` for log correlation and never expose stack traces.

## Deploying

```bash
cd backend/api-service
zip -qj fn.zip lambda_function.py
aws lambda update-function-code \
  --function-name AeroSense-API-Function \
  --region ap-south-1 --zip-file fileb://fn.zip
```

Handler `lambda_function.handler`, runtime `python3.12`, env
`DYNAMODB_TABLE=BuildingTelemetry`.

## Tuning

| Constant | Purpose |
|---|---|
| `ZONE_SCAN_PAGE_LIMIT` / `ZONE_SCAN_PAGE_SIZE` | caps the projected zone scan |
| `ZONE_CACHE_TTL_S` | warm-container zone cache (300 s) |
| `ALERT_SCAN_PER_ZONE` | newest records inspected per zone for alerts |

If zones ever become numerous, replace the projected scan with a dedicated
zone registry item or a GSI; the cache and page cap keep it safe until then.
