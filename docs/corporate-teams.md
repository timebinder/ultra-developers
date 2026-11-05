# Corporate teams

For engineers at a company whose concierge team works in Ultra: a company's own staff concierge, or a team serving the customers of a partner such as a bank. Keep your HR or customer system in step with Ultra, so your team always books for the right people under the right company, without anyone retyping records.

## How Ultra's records map to yours

```
your system                         Ultra
───────────                         ─────
a company or partner      ──▶  client account   (relationship: staff | customers)
  its staff or customers  ──▶    client          (client_account_id → the account)
    their travel          ──▶      trip           (client_id → the client)
```

- **Client account.** A company whose own staff your team serves (`relationship: "staff"`), or a partner whose customers it serves (`relationship: "customers"`). Names are unique within your firm, ignoring case. `billing_reference` is free text, up to 120 characters: keep your own reference for the company there.
- **Client.** A person your team serves. A client belongs to at most one client account; one with no account is a direct client. Clients never log in to Ultra: your team serves them.
- **Trip.** Everything your team plans and books for a client. Trips are created by your team in Ultra, or through the API for an existing client.

**Matching people.** Ultra matches clients by email, exactly and ignoring case. Keep Ultra's `id` against each person in your system once you have it, and use the email to find people you have not matched yet.

## Before you start

- **A key bound to your firm.** Someone on your team creates it in the Ultra web app under **Settings → API keys**, and ticks:
  - **Read client companies** / **Write client companies** (`client_accounts:read`, `client_accounts:write`)
  - **Read clients** / **Write clients** (`clients:read`, `clients:write`)
  - **Read trips** (`trips:read`), and **Write trips** (`trips:write`) if you will create trips
- **Your firm's agreement with Ultra, signed** by the key's owner. Without it every request answers `403`. See [authentication](./authentication.md#agent-onboarding-agreement).
- **A key sees what its owner sees in Ultra.** A key owned by the head of your team, a supervisor, or an agent with no assigned companies reaches the whole firm. A key owned by an agent assigned to particular companies reaches only those companies' clients and trips. For a sync, use a key owned by someone who sees the whole firm.
- Keep the key on your server. Writes need a key bound to your firm; a key owned by someone who has left your firm is refused.

## 1. Create your companies and partners

```sh
curl -X POST "https://ultranetwork.co/api/v1/client-accounts" \
  -H "Authorization: Bearer $ULTRA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name":"Northwind Bank","relationship":"customers","billing_reference":"NW-2026"}'
```

```json
{
  "data": {
    "id": "6f1c…",
    "organization_id": "…",
    "name": "Northwind Bank",
    "relationship": "customers",
    "billing_reference": "NW-2026",
    "notes": null,
    "created_at": "2026-11-05T09:12:44.120Z",
    "updated_at": "2026-11-05T09:12:44.120Z"
  }
}
```

A name already used in your firm answers `409 conflict`. List what exists first:

```sh
curl "https://ultranetwork.co/api/v1/client-accounts?limit=100" \
  -H "Authorization: Bearer $ULTRA_API_KEY"
```

Rename one, or change its reference, with `PATCH`. Send only what changes; `null` clears an optional field. Removing a company stays with the head of your team, in the Ultra web app.

```sh
curl -X PATCH "https://ultranetwork.co/api/v1/client-accounts/$ACCOUNT_ID" \
  -H "Authorization: Bearer $ULTRA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"billing_reference":"NW-2027"}'
```

## 2. Add or match the people

Create a client under a company. If a client with that email already exists in your firm, Ultra returns that client with `200` and changes nothing; a new client answers `201`. Running the same sync twice never makes a duplicate.

```sh
curl -X POST "https://ultranetwork.co/api/v1/clients" \
  -H "Authorization: Bearer $ULTRA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name":"Ana Silva","email":"ana.silva@example.com","home_city":"Lisbon","client_account_id":"'"$ACCOUNT_ID"'"}'
```

```json
{
  "data": {
    "id": "b0a2…",
    "organization_id": "…",
    "name": "Ana Silva",
    "email": "ana.silva@example.com",
    "phone": null,
    "home_city": "Lisbon",
    "status": "active",
    "client_account": { "id": "6f1c…", "name": "Northwind Bank", "relationship": "customers" },
    "assigned_concierge_id": "…",
    "created_at": "2026-11-05T09:14:02.881Z",
    "updated_at": "2026-11-05T09:14:02.881Z"
  }
}
```

Find a client by email, or list everyone under one company:

```sh
curl "https://ultranetwork.co/api/v1/clients?email=ana.silva@example.com" \
  -H "Authorization: Bearer $ULTRA_API_KEY"
```

```sh
curl "https://ultranetwork.co/api/v1/clients?client_account_id=$ACCOUNT_ID&limit=100" \
  -H "Authorization: Bearer $ULTRA_API_KEY"
```

When someone moves to another company, or their details change, `PATCH` them. `"client_account_id": null` makes them a direct client. A client's status (active, VIP, archived) is changed by your team in Ultra, not through the API.

```sh
curl -X PATCH "https://ultranetwork.co/api/v1/clients/$CLIENT_ID" \
  -H "Authorization: Bearer $ULTRA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"phone":"+351 21 000 0000","client_account_id":null}'
```

## 3. See a company's trips

```sh
curl "https://ultranetwork.co/api/v1/trips?client_account_id=$ACCOUNT_ID&limit=50" \
  -H "Authorization: Bearer $ULTRA_API_KEY"
```

Each trip names its client (`client.id`, `client.name`). Create a trip for an existing client with `POST /trips` — see the [API reference](./api-reference.md).

## 4. Stay in step

Every list is sorted newest change first and paged with a cursor ([pagination](./pagination.md)). For a nightly or hourly sync, ask only for what changed since your last run, and follow `page.next_cursor` until `page.has_more` is `false`:

```sh
curl "https://ultranetwork.co/api/v1/clients?updated_since=2026-11-04T00:00:00Z&limit=100" \
  -H "Authorization: Bearer $ULTRA_API_KEY"
```

```sh
curl "https://ultranetwork.co/api/v1/clients?updated_since=2026-11-04T00:00:00Z&limit=100&cursor=$NEXT_CURSOR" \
  -H "Authorization: Bearer $ULTRA_API_KEY"
```

The same `updated_since` works on `/client-accounts` and `/trips`.

## With the TypeScript SDK

From `@ultra-network/sdk-ts` **0.3.0**:

```ts
import { UltraClient } from '@ultra-network/sdk-ts';

const ultra = new UltraClient({ apiKey: process.env.ULTRA_API_KEY! });

const { data: northwind } = await ultra.clientAccounts.create({
  name: 'Northwind Bank',
  relationship: 'customers',
  billing_reference: 'NW-2026',
});

const { data: ana } = await ultra.clients.create({
  name: 'Ana Silva',
  email: 'ana.silva@example.com',
  client_account_id: northwind.id,
});

const page = await ultra.clients.list({ client_account_id: northwind.id, limit: 100 });
await ultra.clients.update(ana.id, { home_city: 'Porto' });
const trips = await ultra.trips.list({ client_account_id: northwind.id });
```

## With the CLI

```sh
npx @ultra-network/cli list_client_accounts --limit=100
npx @ultra-network/cli create_client --body='{"name":"Ana Silva","email":"ana.silva@example.com"}'
npx @ultra-network/cli list_clients --client_account_id=<account id>
```

See the [CLI docs](./cli.md) for setting the key.

## With an AI assistant (MCP)

Add the [MCP server](./mcp.md) and your assistant can call `list_client_accounts`, `create_client_account`, `update_client_account`, `list_clients`, `create_client`, `update_client` and `list_trips` — for example, "add everyone in this spreadsheet to Northwind Bank in Ultra".

## Errors

| Status | When |
|---|---|
| `400 validation_failed` | A field is missing or too long, a write used a key not bound to a firm, or `client_account_id` names a company that is not yours (or not within the key owner's reach). |
| `403 forbidden` | The key lacks the scope, the firm's agreement is not signed, or the key's owner no longer has an account or has left your firm. |
| `404 not_found` | The record is in another firm, outside the key owner's reach, or does not exist — Ultra does not tell these apart. |
| `409 conflict` | A company name already used in your firm; an email already used by another client; or `POST /clients` with an email that belongs to a client the key's owner cannot see. |
| `429 rate_limited` | See [rate limits](./authentication.md#rate-limits). |

Every error uses the same envelope: see [errors](./errors.md).
