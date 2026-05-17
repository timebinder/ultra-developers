# API reference

The Ultra Public API v1 is an OpenAPI 3.1 surface served at `https://ultranetwork.co/api/v1/`.

## Live reference

The authoritative reference is the live OpenAPI document and an interactive UI generated from it:

- **Interactive docs (Scalar)**: [`https://ultranetwork.co/api/v1/docs`](https://ultranetwork.co/api/v1/docs) — click-through every endpoint, try requests with your API key, see real responses.
- **OpenAPI document**: [`https://ultranetwork.co/api/v1/openapi.json`](https://ultranetwork.co/api/v1/openapi.json) — feed it into code generators (`openapi-generator`, `swagger-codegen`), import into Postman / Insomnia / Bruno, or drive your own MCP/CLI.

Everything below mirrors what the live spec says; the spec wins if they ever drift.

## Base URL

```
https://ultranetwork.co/api/v1
```

## Authentication

Every request needs `Authorization: Bearer ulk_yourkey`. See [Authentication](./authentication.md).

## Conventions

| Concern | How v1 does it |
|---|---|
| **Versioning** | URL-prefixed (`/api/v1`). Breaking changes ship as `/api/v2` — v1 stays stable for 12 months after a successor ships. |
| **Time** | ISO 8601 with timezone offset (`2026-05-16T21:09:09.785Z`). Always UTC unless an endpoint says otherwise. |
| **IDs** | UUIDs for everything except trip-item IDs (`item_<32-hex>`). |
| **Money** | `{ amount_cents: 12345, currency: "USD" }`. Never floats. |
| **Pagination** | Keyset cursors — see [pagination](./pagination.md). |
| **Errors** | Stable envelope: `{ error: { code, message, request_id, details? } }` — see [errors](./errors.md). |
| **Request ID** | Every response includes `X-Request-Id`. Include it when reporting issues. |
| **Idempotency** | `DELETE` is idempotent. `POST` is not — use an `Idempotency-Key` header if you need it (planned). |
| **Concurrency** | `PATCH` and child-resource `POST`s use optimistic concurrency. Conflicts return `409` — re-fetch and retry up to 3 times. |
| **Anti-enumeration** | `404` returns are identical for "doesn't exist" and "exists but not visible to your key." We don't leak the difference. |

## Operations

13 operations across 4 resources. The live spec has full schemas, every parameter, every error code, every example.

### Trips

| Method | Path | operationId | Purpose |
|---|---|---|---|
| `GET` | `/trips` | `listTrips` | List trips (paginated, org-scoped) |
| `POST` | `/trips` | `createTrip` | Create a trip for an existing client |
| `GET` | `/trips/{id}` | `getTrip` | Get one trip |
| `GET` | `/trips/{id}/items` | `listTripItems` | List planned items on the trip |
| `POST` | `/trips/{id}/items` | `appendTripItem` | Append an item (accommodation, transport, activity, …) |
| `PATCH` | `/trips/{id}/items/{itemId}` | `updateTripItem` | Partial update of one item |
| `DELETE` | `/trips/{id}/items/{itemId}` | `deleteTripItem` | Remove an item |

### Suppliers

| Method | Path | operationId | Purpose |
|---|---|---|---|
| `GET` | `/suppliers` | `listSuppliers` | List suppliers visible to your key (filter by `category`, `country`) |
| `GET` | `/suppliers/{id}` | `getSupplier` | Get one supplier (contact details gated by onboarding agreements) |

### Bookings

| Method | Path | operationId | Purpose |
|---|---|---|---|
| `GET` | `/bookings` | `listBookings` | List bookings (paginated, filter by `trip_id`) |
| `POST` | `/bookings` | `createBooking` | Record a booking — manually OR via live adapter dispatch |
| `GET` | `/bookings/{id}` | `getBooking` | Get one booking |
| `PATCH` | `/bookings/{id}` | `updateBooking` | Update status / payment / supplier ID / voucher — including cancellation through adapters |

### Common list parameters

Every list operation (`listTrips`, `listBookings`, `listSuppliers`) accepts:

- `limit` — page size (default 25, max 100)
- `cursor` — opaque keyset cursor from a prior response's `next_cursor` (see [pagination](./pagination.md))
- `updated_since` — ISO 8601 timestamp; returns only resources with `updated_at > updated_since`. Use it for incremental sync — store the latest `updated_at` you've processed, replay it as `updated_since` on the next run.

Per-resource filters (e.g. `trip_id` on `listBookings`, `category` + `country` on `listSuppliers`) are documented in the [live spec](https://ultranetwork.co/api/v1/docs).

### Booking adapter dispatch

`POST /bookings` and `PATCH /bookings/{id}` (for cancellation) can dispatch to live supplier APIs by setting `supplier_source` to one of:

`hbt`, `drivado`, `nuitee`, `ratestellar`, `saltours`, `mews`, `apaleo`, `tue`, `limohawk`, `oracle_ohip`

The full lifecycle (search → quote → book → confirm) happens inside Ultra; you supply the `plan_item_id` and Ultra handles the rest.

#### Where `plan_item_id` comes from

The `plan_item_id` is not minted by your code — it's the ID of a row in the trip-builder's plan-items table, created when a search/quote happens against a supplier adapter. Today the canonical way to produce one is:

1. **Open a trip in the Ultra trip builder** (web UI or via an agent operating the trip via MCP/CLI).
2. **Run a search** for the supplier category you want (hotel, transport, activity). The search hits the supplier adapter, returns rates, and persists each rate as a `plan_item` row associated with the trip.
3. **Read the plan item's `id`** — that's your `plan_item_id`. The plan item also carries a `bookingContext` payload (rate code, quote token, supplier-specific identifiers) that Ultra uses internally during the book step. You don't construct `bookingContext`; the search step does it for you.
4. **Pass `plan_item_id` to `POST /bookings`** with `supplier_source` matching the adapter that produced the plan item, plus the per-adapter required guest fields.

A direct `POST /bookings` API for search-and-quote (skipping the trip-builder step) is on the [roadmap](./changelog.md#planned). Until then, the trip-builder is the canonical source of `plan_item_id`s — agents that need to book end-to-end should either operate through the trip-builder via MCP tools, or hand off to a human at the search step.

#### Per-adapter required fields

Each adapter has its own minimum guest payload. The live [Scalar UI](https://ultranetwork.co/api/v1/docs) is the authoritative reference, but the most common requirements:

| Adapter | Always required on `guest` |
|---|---|
| `limohawk` | `phone` |
| `drivado` | `phone`, `email` |
| `hbt`, `nuitee`, `ratestellar` | `email`, `first_name`, `last_name` |
| `mews`, `apaleo` | `email`, `first_name`, `last_name`, `nationality` |
| `saltours`, `tue`, `oracle_ohip` | varies by product — check the spec |

If a required field is missing, the adapter returns `503 upstream_unavailable` with `details.supplier_error` describing which field. See [errors § adapter dispatch](./errors.md#adapter-dispatch-errors-503).

#### Price-tolerance guard

Quotes can drift between the search step and the book step (supplier-side rate changes). Ultra enforces a 5% price-tolerance guard (or $20 floor, whichever is larger): if the re-quoted price at book time exceeds the search-time price by more than the tolerance, the book aborts with `503 upstream_unavailable` and `details.supplier_status = "price_drift"`. To consent to the new price, re-run the trip-builder search to get a fresh `plan_item_id` and retry.

## SDK generation

The OpenAPI document is generator-friendly. Two patterns we recommend:

**TypeScript (via [openapi-typescript](https://github.com/drwpow/openapi-typescript) — just types):**

```sh
npx openapi-typescript https://ultranetwork.co/api/v1/openapi.json -o ./ultra.d.ts
```

**Full client (via [openapi-fetch](https://github.com/drwpow/openapi-fetch)):**

```sh
npm install openapi-fetch
```

```ts
import createClient from 'openapi-fetch';
import type { paths } from './ultra';

const ultra = createClient<paths>({
  baseUrl: 'https://ultranetwork.co/api/v1',
  headers: { Authorization: `Bearer ${process.env.ULTRA_API_KEY}` },
});

const { data, error } = await ultra.GET('/trips', { params: { query: { limit: 10 } } });
```

**Python (via [openapi-python-client](https://github.com/openapi-generators/openapi-python-client)):**

```sh
pip install openapi-python-client
openapi-python-client generate --url https://ultranetwork.co/api/v1/openapi.json
```

Official `@ultra-network/sdk-typescript` and `ultra-python` packages are on the roadmap — see the [changelog](./changelog.md).

## Next

- [Authentication](./authentication.md)
- [Pagination](./pagination.md)
- [Errors](./errors.md)
- [Examples](../examples/) — runnable code
