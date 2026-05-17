# Authentication

Every request to `/api/v1/*` (except `GET /openapi.json` and `GET /docs`) requires a Bearer API key.

## Format

```
Authorization: Bearer ulk_AbCdEf123…
```

Keys start with `ulk_` followed by URL-safe base64. Store them like passwords — environment variables, secret managers, never source control or client-side code.

## Getting a key

Request one at [ultranetwork.co/contact](https://ultranetwork.co/contact). Include:
- Your name + the email of your existing Ultra user account
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

The Ultra Agent Onboarding agreement is the handshake between your integration and the Ultra ecosystem — it's how human operators, suppliers, and agents (yours and others) coexist on the same network. Suppliers extend visibility to operators they trust; operators extend that trust to the agents they authorize. The agreement is what makes those chains of trust workable across thousands of organizations and an open agent surface.

Before a key can be used at all, the key's owner must have signed it. The check fires at authentication time on **every** `/api/v1/*` endpoint — not just supplier endpoints. Without the signed agreement, requests return `403 forbidden` with an `error.message` explaining the gate.

The agreement is a one-page click-through inside the Ultra web app (Settings → Agreements). It governs how third-party agents (your integration) may surface Ultra data — most importantly the supplier network — to end users. Keys with the wildcard scope (`*`) issued for Ultra-internal tooling bypass this gate.

If you're hitting `403 forbidden` on `/trips` or `/bookings` and the key looks valid, the agreement is the first thing to check.

### When `list_suppliers` returns an empty array

A common surprise: `GET /api/v1/suppliers` returns `{ "data": [], "page": { ... } }` with HTTP 200, not an error. An empty list means the visibility gate found nothing the key is authorized to see — not that no suppliers exist.

Walk this checklist in order:

1. **Agent-onboarding agreement signed?** If not, the gate would normally return 403 — but for `list_suppliers` specifically, an unsigned agreement filters everything and returns empty. Check Settings → Agreements.
2. **Does the key's organization have supplier-onboarding agreements with any suppliers?** Suppliers explicitly grant visibility to specific operator organizations. Visibility is opt-in on the supplier side, not a default. A brand-new operator org sees zero suppliers until at least one supplier extends an agreement.
3. **Are query filters too narrow?** `category` and `country` are AND-combined. `?category=hotel&country=AQ` likely returns empty because there are no hotels in Antarctica.
4. **Is the cursor stale?** If you're paginating and seeing empty pages mid-walk, the cursor may reference rows that have been hidden since you started. Re-issue the call without `cursor` to start a fresh walk.

If you've checked all four and still see empty, contact us via [ultranetwork.co/contact](https://ultranetwork.co/contact) with your key prefix (the first 12 chars, `ulk_AbCdEf12`) and we'll diagnose against the live visibility tables.

## Rate limits

Three independent buckets, each with its own ceiling. Any one tripping returns `429`.

| Bucket | Burst | Sustained |
|---|---|---|
| Per org-bound key | 60 / minute | 1000 / hour |
| Per cross-org master key | 120 / minute | 5000 / hour |
| Per organization (sum across all keys it owns) | — | 10,000 / hour |

The per-organization cap is a safety ceiling: an org running multiple parallel integrations cannot exceed 10,000 requests/hour in aggregate, even if no single key has hit its own limit. Plan parallel workers against this combined budget.

429 responses include `Retry-After` (seconds) and the standard error envelope. The `Retry-After` value is the window length of the bucket you tripped — sleep at least that long before retrying. The CLI and SDKs do not automatically retry — backoff is your application's responsibility.

## Security

- **Never put a key in a browser**. Even with CORS restrictions, client-side keys end up in DevTools, cache snapshots, and screenshots.
- **Never commit a key to git**. Add `.env*` to `.gitignore`. If you leak one, report it via [ultranetwork.co/contact](https://ultranetwork.co/contact) and we'll revoke immediately.
- **Use environment-bound keys** in CI — most CI providers (GitHub Actions, Vercel, CircleCI) have first-class secret storage.
- **Rotate periodically** — see below.

## Key rotation

Rotation is manual today (the [self-serve `POST /api/v1/keys`](./changelog.md#planned) endpoint is on the roadmap). Until it ships, the zero-downtime workflow is:

1. **Request a new key** via [ultranetwork.co/contact](https://ultranetwork.co/contact) with the prefix of the key you're replacing (`ulk_AbCdEf12`). We issue the new key bound to the same organization with the same scopes.
2. **Both keys are active simultaneously** during the overlap window — we do not revoke the old key when we issue the new one. This is intentional: you control the cutover.
3. **Deploy the new key** to your secret store, CI, and any other consumers. Verify by checking `X-Request-Id` traffic for the new key prefix.
4. **Tell us to revoke the old key** via [ultranetwork.co/contact](https://ultranetwork.co/contact) when you're confident nothing is still using it. We revoke within one business hour during US/EU business days.

There is no fixed overlap deadline — old keys stay active until you request revocation. For automated quarterly rotation, hold the overlap for at least one full deployment cycle plus your slowest cron's period (a key only used by a weekly job needs more overlap than one used by a 5-minute webhook).

## Revocation

Request revocation at [ultranetwork.co/contact](https://ultranetwork.co/contact) with the key's prefix (`ulk_AbCdEf12` — the first 12 chars are safe to share). We revoke within one business hour during US/EU business days.

A revoked key returns `401 unauthenticated` immediately — server-side check, no caching.

## Next

- [Errors](./errors.md) — the stable error envelope, including auth failures
- [Rate limits](./errors.md#rate-limits) — handling 429 responses
- [API reference](./api-reference.md) — every endpoint
