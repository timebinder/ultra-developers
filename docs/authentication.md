# Authentication

Every request to `/api/v1/*` (except `GET /openapi.json` and `GET /docs`) requires a Bearer API key.

## Format

```
Authorization: Bearer ulk_AbCdEf123…
```

Keys start with `ulk_` followed by URL-safe base64. Store them like passwords — environment variables, secret managers, never source control or client-side code.

## Getting a key

Email `office@ultranetwork.co` with:
- Your name + email (must match an existing Ultra user)
- The organization the key should be bound to (or "cross-org" if you're an Ultra admin)
- A short description of what you're building

Self-serve key minting via `POST /api/v1/keys` is on the roadmap. Until then we issue keys manually within one business day.

## Key binding

| Type | Owner | Organization | Scopes | What it can do |
|---|---|---|---|---|
| **Org-bound** | A user | One org | `*` (default) | Read + write that org's data, no `organization_id` parameter needed |
| **Cross-org master** | An Ultra admin | `null` | `*` | Read across orgs (with `organization_id` filter), no write operations |

99% of integrations use **org-bound** keys. Cross-org master keys are reserved for Ultra-internal tooling and partner reporting.

### Org-bound keys

The simpler case. Your `organization_id` is inferred from the key, so you never pass it as a parameter:

```sh
# List trips for the bound org
curl -H "Authorization: Bearer $ULTRA_API_KEY" \
  "https://ultranetwork.co/api/v1/trips?limit=10"

# Create a trip in the bound org
curl -X POST -H "Authorization: Bearer $ULTRA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"title":"Demo trip","client_id":"client_…"}' \
  "https://ultranetwork.co/api/v1/trips"
```

### Cross-org master keys

For read-only operations across multiple orgs (Ultra-internal analytics, partner reporting). Cross-org keys MUST include `organization_id` as a query parameter on every list/read call:

```sh
curl -H "Authorization: Bearer $ULTRA_MASTER_KEY" \
  "https://ultranetwork.co/api/v1/trips?organization_id=d39a9d36-…&limit=10"
```

Write operations (`POST`, `PATCH`, `DELETE`) return `400 validation_failed` for cross-org keys — the server has no way to know which org should own the new row. Mint an org-bound key for writes.

## Scopes

Every key carries a `scopes` array. Current scopes:

- `*` — everything (default)
- `trips:read`, `trips:write`
- `suppliers:read`
- `bookings:read`, `bookings:write`

Fine-grained scopes are honored by the server but not yet selectable at key-mint time. Until then every issued key has `["*"]`.

## Agent-onboarding agreement

Before a key can read supplier data, the key's owner must have signed the **Ultra Agent Onboarding** agreement. Without it, `/api/v1/suppliers/*` returns 403 with `error.code = "agent_onboarding_required"`.

The agreement is a one-page click-through inside the Ultra web app (Settings → Agreements). It governs how third-party agents (your integration) may surface supplier data to end users. Ultra-issued keys for direct human use bypass this gate.

## Rate limits

| Tier | Burst | Sustained |
|---|---|---|
| All org-bound keys | 60 / minute | 1000 / hour |
| Cross-org master keys | 120 / minute | 5000 / hour |

429 responses include `Retry-After` (seconds) and the standard error envelope. The CLI and SDKs do not automatically retry — backoff is your application's responsibility.

## Security

- **Never put a key in a browser**. Even with CORS restrictions, client-side keys end up in DevTools, cache snapshots, and screenshots.
- **Never commit a key to git**. Add `.env*` to `.gitignore`. If you leak one, email `office@ultranetwork.co` and we'll revoke immediately.
- **Rotate periodically**. Manual rotation today — submit a request for a new key, swap it in, and we'll revoke the old one.
- **Use environment-bound keys** in CI — most CI providers (GitHub Actions, Vercel, CircleCI) have first-class secret storage.

## Revocation

Email `office@ultranetwork.co` with the key's prefix (`ulk_AbCdEf12` — the first 12 chars are safe to share). We revoke within one business hour during US/EU business days.

A revoked key returns `401 unauthenticated` immediately — server-side check, no caching.

## Next

- [Errors](./errors.md) — the stable error envelope, including auth failures
- [Rate limits](./errors.md#rate-limits) — handling 429 responses
- [API reference](./api-reference.md) — every endpoint
