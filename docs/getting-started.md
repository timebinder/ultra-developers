# Getting started

Your first Ultra API call in 60 seconds.

## 1. Get an API key

Ask `office@ultranetwork.co` for a key. Self-serve key minting is shipping shortly; for now we issue keys manually.

A key looks like `ulk_AbCdEf123…`. Treat it like a password — server-side only, never in browser code or client bundles.

## 2. Make a call

```sh
export ULTRA_API_KEY=ulk_yourkey

curl -H "Authorization: Bearer $ULTRA_API_KEY" \
  "https://ultranetwork.co/api/v1/trips?limit=3"
```

If your key is bound to a single organization, the response is your trips. If you have a cross-org master key (rare), add `organization_id`:

```sh
curl -H "Authorization: Bearer $ULTRA_API_KEY" \
  "https://ultranetwork.co/api/v1/trips?limit=3&organization_id=YOUR_ORG_UUID"
```

A successful response looks like:

```json
{
  "data": [
    {
      "id": "dfa6fac3-…",
      "organization_id": "d39a9d36-…",
      "title": "Ali, Costa Rica, 14 Jun",
      "stage": "draft_plan",
      "destination": "Costa Rica",
      "start_date": "2026-06-15",
      "end_date": "2026-06-20",
      "party_size": 2,
      "client": { "id": "e448e81e-…", "name": "Ali Marco" }
    }
  ],
  "page": { "next_cursor": "eyJ…", "has_more": true, "limit": 3 }
}
```

## 3. Pick a surface

Now you have a working key, choose the surface that fits your use case:

- **Use HTTP directly** — see the [API reference](./api-reference.md). The OpenAPI document at `/api/v1/openapi.json` is the source of truth for every endpoint.
- **Build an agent** — install the [MCP server](./mcp.md) in Claude Code / Cursor / Windsurf. Every endpoint becomes a tool the LLM can call.
- **Scripts & CI** — install the [CLI](./cli.md). Every endpoint becomes a subcommand: `ultra list_trips --limit=5`.

## What you can do today

The v1 surface covers:

| Resource | Operations |
|---|---|
| **Trips** | list, create, get, list-items, append-item, update-item, delete-item |
| **Suppliers** | list, get |
| **Bookings** | list, create (manual + adapter dispatch through 10 supplier integrations), get, update (incl. cancel-via-adapter) |

Coming soon: webhooks, key-minting API, more supplier-adapter coverage. See the [changelog](./changelog.md).

## Conventions

- **All times** are ISO 8601 (`2026-05-16T21:09:09.785Z`).
- **All IDs** are UUIDs (except trip-item IDs, which are `item_<32-hex>`).
- **Money** values are integer cents (`{ amount_cents: 12345, currency: "USD" }`).
- **Pagination** is keyset-based — see the [pagination guide](./pagination.md).
- **Errors** follow a stable envelope — see the [errors guide](./errors.md).

## Next

- [Authentication](./authentication.md) — scopes, org binding, rate limits
- [API reference](./api-reference.md) — every endpoint, every parameter
- [MCP](./mcp.md) | [CLI](./cli.md) — pick your surface
