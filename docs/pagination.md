# Pagination

All `list_*` operations return at most `limit` items per page (default 25, max 100). For more data, paginate using the `next_cursor` field.

## Shape

```json
{
  "data": [/* up to `limit` items */],
  "page": {
    "next_cursor": "eyJ0IjoiMjAyNi0wNS0xNVQwMjoyNzoyOC41NzY4ODErMDA6MDAi…",
    "has_more": true,
    "limit": 25
  }
}
```

- `data` — the items in this page
- `page.next_cursor` — opaque token; pass to the next call as `cursor=…`. `null` when there are no more pages.
- `page.has_more` — convenience boolean. Equivalent to `next_cursor !== null`.
- `page.limit` — the limit that was actually applied (may be capped if you requested above 100).

## Walk a full list

```sh
NEXT=""
while :; do
  if [ -n "$NEXT" ]; then
    RESP=$(curl -s -H "Authorization: Bearer $ULTRA_API_KEY" \
      "https://ultranetwork.co/api/v1/trips?limit=50&cursor=$NEXT")
  else
    RESP=$(curl -s -H "Authorization: Bearer $ULTRA_API_KEY" \
      "https://ultranetwork.co/api/v1/trips?limit=50")
  fi
  echo "$RESP" | jq '.data[]' >> all-trips.jsonl
  NEXT=$(echo "$RESP" | jq -r '.page.next_cursor // empty')
  [ -z "$NEXT" ] && break
done
```

## Why keyset (not offset)

Offset pagination (`?page=5`) drifts when new rows land between requests — you can see duplicates or skip rows. Keyset pagination encodes the position into the cursor itself (typically `updated_at + id`), so:

- Adding a row at the top doesn't shift later pages
- Resuming after an interruption is stable
- Pages are sorted by `updated_at desc` so the most recently changed rows always come first

## Incremental sync

For "give me everything that changed since I last synced":

```sh
# Save the time before the sync starts
SINCE=$(date -u +%Y-%m-%dT%H:%M:%SZ)

curl -H "Authorization: Bearer $ULTRA_API_KEY" \
  "https://ultranetwork.co/api/v1/trips?updated_since=$SINCE&limit=100"
# … paginate through next_cursor as above …
```

Store `SINCE` in your sync state. Next run, `updated_since=$SINCE` returns only what changed. Pages are still capped at `limit`, so a busy org may take several pages.

The `updated_since` parameter is supported on `list_trips`, `list_bookings`, and `list_suppliers`. For trip items, `list_trip_items` returns the full item list per trip — it's small enough not to need incremental sync.

## Cursor opacity

Treat `next_cursor` as an opaque string. Don't decode it, mutate it, or persist it across API version upgrades — the encoding scheme may change. Always pass it back unmodified to the next request.

## Limits

| Operation | Default `limit` | Max `limit` |
|---|---|---|
| `list_trips` | 25 | 100 |
| `list_suppliers` | 25 | 100 |
| `list_bookings` | 25 | 100 |
| `list_trip_items` | (returns all items on the trip, no pagination) | — |

If you pass `limit` above the max, the server caps it silently and the actual cap is reflected in `page.limit`.

## Next

- [API reference](./api-reference.md) — full schemas for each list operation
- [Errors](./errors.md)
