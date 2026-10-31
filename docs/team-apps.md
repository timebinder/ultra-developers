# Your own app

For a concierge team that already has its own app (for example, a bank's concierge service). Your customers keep using your app; their requests arrive in your team's queue in Ultra, and your team's replies come back into your app.

```
your app ──POST /team/requests──▶ your team's queue in Ultra
                                        │  a team member replies
your app ◀──signed webhook──────────────┘
your app ──GET  /team/requests/{id}/replies──▶ (catch up on anything missed)
```

## Before you start

- **A key bound to your firm**, with the `requests:write` and `requests:read` scopes. Create it in the Ultra web app under **Settings → API keys**. A key that is not bound to a firm is refused on every endpoint below (`403`).
- **The agent-onboarding agreement signed** by the key's owner — see [authentication](./authentication.md#agent-onboarding-agreement).
- Keep the key on your server. Your app talks to your server; your server talks to Ultra.

## 1. Send a customer's request

```sh
curl -X POST "https://ultranetwork.co/api/v1/team/requests" \
  -H "Authorization: Bearer $ULTRA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "external_request_id": "req-8812",
    "customer": { "name": "Ana Silva", "email": "ana@example.com" },
    "message": "Two nights in Lisbon for our anniversary, somewhere quiet with a view.",
    "destination": "Lisbon",
    "start_date": "2026-12-04",
    "end_date": "2026-12-06",
    "party_size": 2,
    "app_name": "Your App Name"
  }'
```

```json
{ "data": { "request_id": "6f1c…", "external_request_id": "req-8812", "status": "received", "created_at": "…", "updated_at": "…" } }
```

- The request appears in your team's queue as a new, unassigned enquiry, marked **Came from: Your App Name**.
- `external_request_id` is your own id. **Sending the same one again returns the request already created**, so retrying after a timeout is safe.
- The customer needs an `email` or a `phone`, so your team can reach them.
- Keep `request_id`: every call below uses it.

## 2. Receive your team's replies

Tell Ultra where to send them. The address must be public `https`.

```sh
curl -X PUT "https://ultranetwork.co/api/v1/team/webhook" \
  -H "Authorization: Bearer $ULTRA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "url": "https://api.your-app.example/ultra/replies" }'
```

The response carries a `secret` (`whsec_…`). **It is shown once — store it.** Setting the address again issues a new secret.

Each time a team member replies, Ultra POSTs:

```json
{
  "event": "request.reply",
  "request_id": "6f1c…",
  "external_request_id": "req-8812",
  "reply": {
    "reply_id": "9a2e…",
    "request_id": "6f1c…",
    "message": "Happy anniversary! I have two quiet hotels with a river view to suggest.",
    "sent_at": "2026-10-31T15:02:11.000Z",
    "delivered": true
  }
}
```

with these headers:

| Header | Meaning |
|---|---|
| `X-Ultra-Event` | `request.reply` |
| `X-Ultra-Delivery` | A unique id for this delivery |
| `X-Ultra-Timestamp` | Unix seconds when it was sent |
| `X-Ultra-Signature` | `sha256=` + hex HMAC-SHA256 of `<X-Ultra-Timestamp>.<raw body>`, keyed with your secret |

### Verify every delivery

Compute the signature over the **raw** body, before parsing it, and refuse anything older than a few minutes so a captured delivery cannot be replayed.

```js
import { createHmac, timingSafeEqual } from 'node:crypto';

function isFromUltra(rawBody, headers, secret) {
  const ts = headers['x-ultra-timestamp'];
  const sig = headers['x-ultra-signature'] ?? '';
  if (!ts || Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false;
  const expected = 'sha256=' + createHmac('sha256', secret).update(`${ts}.${rawBody}`).digest('hex');
  return sig.length === expected.length && timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}
```

Answer with any `2xx` within 5 seconds, then do your own work. Use `reply_id` to ignore a reply you have already shown.

### If a delivery is missed

Ultra makes **one** attempt per reply. A reply your webhook did not accept is never lost: read it back (step 3). After 10 failed deliveries in a row Ultra stops sending; set the address again to switch it back on.

```sh
curl -H "Authorization: Bearer $ULTRA_API_KEY" "https://ultranetwork.co/api/v1/team/webhook"      # address + status, never the secret
curl -X DELETE -H "Authorization: Bearer $ULTRA_API_KEY" "https://ultranetwork.co/api/v1/team/webhook"   # stop sending
```

## 3. Read replies and status

```sh
# Every reply on a request, oldest first — "delivered" says whether your webhook took it
curl -H "Authorization: Bearer $ULTRA_API_KEY" "https://ultranetwork.co/api/v1/team/requests/$REQUEST_ID/replies"

# Where the request has got to
curl -H "Authorization: Bearer $ULTRA_API_KEY" "https://ultranetwork.co/api/v1/team/requests/$REQUEST_ID"
```

| `status` | Meaning |
|---|---|
| `received` | In your team's queue, not yet taken |
| `assigned` | A team member has taken it |
| `in_progress` | Being planned or booked |
| `closed` | Completed or cancelled |

Without a webhook, poll the replies endpoint instead — the replies are all there.

## 4. Send the customer's answer

When the customer writes back in your app:

```sh
curl -X POST "https://ultranetwork.co/api/v1/team/requests/$REQUEST_ID/messages" \
  -H "Authorization: Bearer $ULTRA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "message": "The second one sounds perfect." }'
```

It appears on your team's conversation with the customer.

## With the TypeScript SDK

From `@ultra-network/sdk-ts` **0.2.0**:

```ts
import { UltraClient, verifyUltraWebhook } from '@ultra-network/sdk-ts';

const ultra = new UltraClient({ apiKey: process.env.ULTRA_API_KEY! });

const { data: request } = await ultra.teamRequests.create({
  external_request_id: 'req-8812',
  customer: { name: 'Ana Silva', email: 'ana@example.com' },
  message: 'Two nights in Lisbon for our anniversary.',
  app_name: 'Your App Name',
});

const { data: hook } = await ultra.teamWebhook.set('https://api.your-app.example/ultra/replies');
// store hook.secret

const { data: replies } = await ultra.teamRequests.replies(request.request_id);
await ultra.teamRequests.sendMessage(request.request_id, 'The second one sounds perfect.');

// In your webhook handler (Node 18+, edge runtimes):
const ok = await verifyUltraWebhook({
  secret: process.env.ULTRA_WEBHOOK_SECRET!,
  rawBody,
  timestamp: req.headers.get('x-ultra-timestamp'),
  signature: req.headers.get('x-ultra-signature'),
});
```

The [MCP server](./mcp.md) and [CLI](./cli.md) expose the same operations, generated from the [API reference](./api-reference.md).

## Errors

| Status | When |
|---|---|
| `400 validation_failed` | A field is missing or invalid — no `email` or `phone`, a non-https webhook address |
| `403 forbidden` | The key is not bound to your firm, lacks the scope, or its owner has not signed the agreement |
| `404 not_found` | No request with this id was sent by your firm's apps. Another firm's requests are never visible. |

See [errors](./errors.md) for the envelope and retries.
