# Local development

How to run the Ultra API locally and exercise it from your code, agent, or CLI without burning production keys.

The production API at `https://ultranetwork.co/api/v1` is the easiest target — point your `ULTRA_API_KEY` at it and you're done. This guide is for the cases where you want a self-contained loop: contributing to Ultra itself, building an integration on a flaky network, working offline, or running a CI suite that shouldn't touch prod.

## Prerequisites

- Node.js 20+ (the API ships from a Next.js monorepo)
- A local Ultra workspace running (Ultra is open-source; clone instructions are out of scope for this guide — contact us if you're building against a forked or self-hosted instance)
- One of: `curl`, the Ultra CLI, the Ultra MCP server, or your own client

## The dev-bootstrap key

When you run the Ultra API locally for the first time, the production key table is empty — there's nothing to authenticate against. To unblock this, the server checks for a `ULTRA_API_DEV_KEY` environment variable at boot. If set, that string is accepted as a wildcard-scope, cross-org master key for the local instance only.

```sh
# In the Ultra server's .env.local
ULTRA_API_DEV_KEY=ulk_dev_localonly_pickyourown
```

Then on the client side:

```sh
export ULTRA_API_KEY=ulk_dev_localonly_pickyourown
export ULTRA_API_BASE_URL=http://localhost:3000/api/v1   # adjust port to your local

curl -H "Authorization: Bearer $ULTRA_API_KEY" \
  "$ULTRA_API_BASE_URL/trips?limit=3"
```

The dev-bootstrap key bypasses the [agent-onboarding agreement gate](./authentication.md#agent-onboarding-agreement) and grants `["*"]` scopes. It is the equivalent of root access on the local instance. **Never set `ULTRA_API_DEV_KEY` on a deployed (non-local) server** — it is intended only for the empty-key-table bootstrap problem on first run.

## Pointing the CLI at local

```sh
export ULTRA_API_KEY=ulk_dev_localonly_pickyourown
export ULTRA_API_SPEC=http://localhost:3000/api/v1/openapi.json

ultra list_trips --limit=5
```

`ULTRA_API_SPEC` tells the CLI to load operations from the local OpenAPI document. `ULTRA_API_BASE_URL` is inferred from the spec's `servers[0].url`, so as long as the local server emits the right `servers[0]` (it does — see `apps/web/app/api/v1/openapi.json/route.ts` in the Ultra codebase), one env var is enough.

## Pointing the MCP server at local

```json
{
  "mcpServers": {
    "ultra-local": {
      "command": "npx",
      "args": ["-y", "@ultra-network/mcp"],
      "env": {
        "ULTRA_API_KEY": "ulk_dev_localonly_pickyourown",
        "ULTRA_API_SPEC": "http://localhost:3000/api/v1/openapi.json"
      }
    }
  }
}
```

Restart Claude Code; `/mcp` should show `ultra-local` connected. Now your LLM can read and write against the local instance without touching production.

## Seeding test data

A bare Ultra instance has no trips, no suppliers, no bookings. Two paths to populate it:

1. **Use the trip builder UI** to create a trip, add a client, run a search against a sandbox adapter. This produces real `plan_item` rows you can book against.
2. **Use the API directly** to mint trips, items, and bookings. See the [examples directory](https://github.com/timebinder/ultra-developers/tree/main/examples) for runnable scripts.

The supplier adapter list (`hbt`, `drivado`, …) requires per-adapter credentials. In local dev most adapters fall back to sandbox or mocked responses if their credentials aren't configured; check `apps/web/app/api/v1/bookings/route.ts` in the Ultra codebase for the current behaviour of each.

## CI patterns

For CI that exercises the API:

- Provision the `ULTRA_API_DEV_KEY` as a CI secret pointed at a CI-only Ultra instance (never at production).
- Run the Ultra server as a Docker service alongside your tests, or spin it up with `next dev` in a background job.
- Wait for `GET /api/v1/openapi.json` to return 200 before running tests — this confirms the server is ready and the spec is generatable.
- Reset state between runs by either (a) using a fresh database container per run, or (b) hitting destructive cleanup endpoints if your fork exposes them.

## When local diverges from prod

Two known sources of drift:

- **Supplier adapters**: real adapters hit real supplier APIs. In local you'll typically run with mocked or sandbox adapters that return synthetic data. Behaviour on the adapter happy path is identical; error cases may differ.
- **Rate limits**: the local server enforces the same [rate-limit code path](./authentication.md#rate-limits) as prod, but the in-memory bucket store resets on every restart. Don't write tests that depend on rate-limit state surviving across server restarts.

For anything else, the production API and the local API run the same code from the same OpenAPI spec — that's the point of the spec-driven design.

## Next

- [Authentication](./authentication.md) — how the dev key relates to org-bound and cross-org keys
- [API reference](./api-reference.md) — every operation, identical against local or prod
- [Errors](./errors.md) — the envelope is the same; the codes are the same
