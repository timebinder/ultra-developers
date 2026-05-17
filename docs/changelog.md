# Changelog

A running log of what changed in the Ultra Public API, MCP server, CLI, and SDKs.

The OpenAPI document's `info.version` is the canonical version of the API surface. This changelog adds context: what shipped, what's new, what to migrate.

Dates are UTC.

---

## 2026-05-16

**API**
- **Rate limiting is now enforced** on every `/api/v1/*` endpoint. Org-bound keys: 60/min + 1000/hour. Cross-org master keys: 120/min + 5000/hour. Per-org safety cap of 10,000/hour across all keys an org issues. Exceeded buckets return `429 rate_limited` with `Retry-After`. See [authentication § rate limits](./authentication.md#rate-limits).
- Clean `operationId` on every operation: `listTrips`, `createTrip`, `getTrip`, `listTripItems`, `appendTripItem`, `updateTripItem`, `deleteTripItem`, `listSuppliers`, `getSupplier`, `listBookings`, `createBooking`, `getBooking`, `updateBooking`. These propagate through to MCP tool names and CLI subcommand names automatically.
- `/api/v1/openapi.json` is now served dynamically — `servers[0].url` correctly reflects the request origin (was leaking `http://localhost:3000` from build-time rendering).

**CLI**
- First release of `ultra` — spec-driven CLI exposing every v1 operation as a subcommand. See the [CLI docs](./cli.md).
- Validates `ulk_…` key format before passing to `fetch` (prevents leaks via runtime error messages).

**MCP**
- MCP server refactored to share a common client package with the CLI — no behavior change, but new endpoints now propagate to both surfaces automatically.
- **Published to npm**: [`@ultra-network/mcp@0.1.0`](https://www.npmjs.com/package/@ultra-network/mcp). `npm install -g @ultra-network/mcp` and configure via `~/.claude.json`.

**CLI**
- **Published to npm**: [`@ultra-network/cli@0.1.0`](https://www.npmjs.com/package/@ultra-network/cli). `npm install -g @ultra-network/cli` and run `ultra --help`.

**Developer materials**
- This repo (`timebinder/ultra-developers`) opened with first-cut docs covering getting started, authentication, API reference, MCP, CLI, errors, pagination.

---

## 2026-05-15

**API**
- `POST /api/v1/bookings` now dispatches live bookings through 10 supplier adapters: `hbt`, `drivado`, `nuitee`, `ratestellar`, `saltours`, `mews`, `apaleo`, `tue`, `limohawk`, `oracle_ohip`. Set `supplier_source` and supply a `plan_item_id` — the server handles search → quote → book.
- `PATCH /api/v1/bookings/{id}` with `status: "cancelled"` now dispatches cancellations through the same adapters.
- Conservative status transition matrix enforced server-side — see [bookings reference](./api-reference.md#bookings).
- Price-tolerance guard: adapter dispatch aborts with 503 when the re-quoted price exceeds 5% of the expected price (or $20 floor, whichever is larger). Refresh the plan item and retry to consent to the new price.

---

## 2026-05-13

**API**
- `parseVenueId` now uses greedy longest-prefix matching — fixes `oracle_ohip_*` venue IDs that were mis-parsed as `oracle/*`. No client-facing change; closes a class of 400s on `createBooking`.

---

## 2026-05-12

**API**
- First end-to-end write operations: `createTrip`, `appendTripItem`, `updateTripItem`, `deleteTripItem`. Optimistic concurrency with 3 retries before 409.

---

## Planned

- **`POST /api/v1/keys`** — self-serve key minting (currently manual via email). Will return `{ id, prefix, plaintext }` once; only the SHA-256 hash is persisted server-side.
- **`GET /api/v1/keys`** + **`DELETE /api/v1/keys/{id}`** — list and revoke your own keys.
- **Webhooks** — push notifications for trip/booking state changes (instead of polling).
- **Official TypeScript SDK** (`@ultra-network/sdk`) — type-safe wrapper over the OpenAPI surface.
- **Official Python SDK** (`ultra-network`) — for data work, ML pipelines, scripting.
- **Additional supplier adapters** — `momorooms`, `shiji` (channel managers).

Subscribe to this repo's releases for shipping notifications.

---

## Versioning

The API surface is versioned via URL prefix (`/api/v1`). Breaking changes ship as `/api/v2`; `/api/v1` stays stable for **12 months** after a successor ships.

Non-breaking additions (new operations, new optional fields) ship continuously without bumping the version.

This changelog logs everything — both additive changes and (rare) breaking changes within a major version.
