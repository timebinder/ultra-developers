# Errors

Every error response from `/api/v1/*` follows the same envelope. You can rely on its shape.

## Envelope

```json
{
  "error": {
    "code": "validation_failed",
    "message": "organization_id is required when the API key is not bound to a single organization.",
    "request_id": "req_D7ATW4G1PCX3NSRBP1MT",
    "details": {
      "field": "organization_id",
      "expected": "uuid"
    }
  }
}
```

- `code` — a stable, machine-readable identifier. Branch on this, not on `message`.
- `message` — human-readable, may evolve. Show to developers; not safe for end-user UI.
- `request_id` — echoes `X-Request-Id`. Include it when reporting issues.
- `details` — optional, code-specific extra context.

## HTTP status mapping

| Status | When it fires | Notable codes |
|---|---|---|
| `400` | Input failed validation, semantic precondition violated | `validation_failed`, `invalid_state_transition` |
| `401` | Missing, invalid, or revoked API key | `unauthenticated` |
| `403` | Valid key, but lacks scope or hasn't signed required agreement | `forbidden`, `agent_onboarding_required` |
| `404` | Resource doesn't exist OR isn't visible to this key (we don't tell you which) | `not_found` |
| `409` | Concurrent write conflict, optimistic concurrency exhausted (3 retries) | `concurrent_modification` |
| `422` | Body parsed but semantically wrong (rare — most validation is 400) | `unprocessable` |
| `429` | Rate limit exceeded | `rate_limited` |
| `500` | Server bug. File an issue with the `request_id`. | `internal_error` |
| `503` | Adapter dispatch failed — supplier API rejected the call | `upstream_unavailable` |

## Anti-enumeration

We deliberately return `404` for both:
- The resource doesn't exist
- The resource exists but isn't visible to your key

This prevents enumeration attacks (probing for IDs you shouldn't know about). If you're sure a resource exists and you're still getting 404, double-check:
- Your key is bound to the right organization
- The resource is in that organization
- For suppliers: your key's owner has signed the agent-onboarding agreement
- For bookings: the booking's trip is visible to your key

## Adapter dispatch errors (503)

When you create or cancel a booking via supplier-adapter dispatch, the supplier API may reject the call. The 503 response carries verbatim details from the upstream:

```json
{
  "error": {
    "code": "upstream_unavailable",
    "message": "Booking rejected by supplier",
    "request_id": "req_…",
    "details": {
      "supplier_source": "hbt",
      "supplier_status": "no_availability",
      "supplier_error": "Selected rate is no longer available"
    }
  }
}
```

Common causes:
- **Quote expired** — refresh the trip item via the builder's search flow to get a fresh `bookingContext`, then retry
- **No availability** — the room/seat/service sold out between quote and book
- **Price drift** — supplier raised price beyond the 5% tolerance; refresh and consent to the new price before retrying
- **Cancellation window closed** — too late to cancel via supplier API; cancel manually with the supplier

## Optimistic concurrency (409)

Mutating endpoints (`PATCH`, child-resource `POST` like `appendTripItem`) use optimistic concurrency. The server checks `updated_at` matches what it read at the start of the operation; if another writer landed first, it retries up to 3 times then returns 409.

If you see a 409:
1. Re-fetch the resource (`GET /trips/{id}`)
2. Apply your change against the new state
3. Retry the mutation
4. If it 409s repeatedly, an aggressive concurrent writer is dominating — backoff with jitter (50ms, 200ms, 1s) before each retry

## Rate limits (429)

When you exceed your burst or sustained limit:

```
HTTP/1.1 429 Too Many Requests
Retry-After: 60
Content-Type: application/json

{
  "error": {
    "code": "rate_limited",
    "message": "Rate limit exceeded. Retry after the window resets.",
    "request_id": "req_…",
    "details": { "retry_after_seconds": 60 }
  }
}
```

- `Retry-After` is the window length of the bucket you tripped — sleep at least that many seconds before retrying
- Both the per-minute and per-hour buckets are independent: a 429 with `retry_after_seconds: 3600` means you hit the hour ceiling
- The CLI and SDKs do not auto-retry — backoff is your application's responsibility
- For sync jobs: build in exponential backoff with jitter from the start

See [authentication § rate limits](./authentication.md#rate-limits) for the actual ceilings.

## Validation errors (400)

`details` always includes enough to fix the call:

```json
{
  "error": {
    "code": "validation_failed",
    "message": "body.start_date must be on or after body.end_date",
    "request_id": "req_…",
    "details": {
      "field": "body.start_date",
      "value": "2026-09-01",
      "constraint": "must be <= body.end_date (2026-08-29)"
    }
  }
}
```

When `details.field` is present it points at the exact JSON path of the failing input.

## Authentication errors (401, 403)

| Code | Meaning | Fix |
|---|---|---|
| `unauthenticated` | Missing, malformed, or revoked key | Check `ULTRA_API_KEY`; if revoked, request a new one |
| `forbidden` | Key lacks required scope for this operation | Mint a new key with the right scopes |
| `agent_onboarding_required` | Key owner hasn't signed the Ultra Agent Onboarding agreement | Sign in to ultranetwork.co → Settings → Agreements |

## Reporting issues

When something goes wrong:

1. Capture the full response — status, headers, body
2. Note the `X-Request-Id` (also in the body's `error.request_id`)
3. Note when it happened (ISO 8601 timestamp)
4. [File an issue](https://github.com/timebinder/ultra-developers/issues) or report via [ultranetwork.co/contact](https://ultranetwork.co/contact)

The `request_id` lets us find the exact request in our logs.

## Next

- [Authentication](./authentication.md)
- [Pagination](./pagination.md)
- [API reference](./api-reference.md)
