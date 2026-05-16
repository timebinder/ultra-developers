# CLI cookbook

Practical recipes using the [`ultra` CLI](../docs/cli.md). Assumes `ULTRA_API_KEY` is set.

## Daily trip-stage report

Pull all trips that changed today, group by stage, write a markdown summary.

```sh
#!/usr/bin/env bash
set -euo pipefail

TODAY=$(date -u +%Y-%m-%dT00:00:00Z)
ultra list_trips --updated_since="$TODAY" --limit=100 --raw \
  | jq -r '.data[] | "\(.stage)\t\(.title)\t\(.updated_at)"' \
  | sort \
  | awk -F'\t' '
    BEGIN { print "# Trips updated today\n" }
    {
      if ($1 != stage) { print "\n## " $1 "\n"; stage = $1 }
      print "- " $2 " — " $3
    }
  ' > today.md

open today.md
```

## Booking-status sync

Fetch all bookings for a given trip, write JSON Lines for downstream ETL.

```sh
#!/usr/bin/env bash
TRIP_ID="$1"
OUT="bookings-$TRIP_ID.jsonl"

> "$OUT"
CURSOR=""
while :; do
  if [ -n "$CURSOR" ]; then
    PAGE=$(ultra list_bookings --trip_id="$TRIP_ID" --limit=100 --cursor="$CURSOR" --raw)
  else
    PAGE=$(ultra list_bookings --trip_id="$TRIP_ID" --limit=100 --raw)
  fi
  echo "$PAGE" | jq -c '.data[]' >> "$OUT"
  CURSOR=$(echo "$PAGE" | jq -r '.page.next_cursor // empty')
  [ -z "$CURSOR" ] && break
done

echo "Wrote $(wc -l < "$OUT") bookings to $OUT"
```

## Cancel a booking (with reason)

```sh
ultra update_booking --id="$BOOKING_ID" \
  --body='{
    "status": "cancelled",
    "cancellation_reason": "Client postponed to next quarter"
  }' --status
```

The `--status` flag prints the HTTP code and `request_id` to stderr — useful when the supplier adapter responds with a 503 you need to investigate.

## Bulk-update trip items from a CSV

```sh
#!/usr/bin/env bash
TRIP_ID="$1"
CSV="$2"   # itemId,checkInDate
tail -n +2 "$CSV" | while IFS=, read -r ITEM_ID NEW_DATE; do
  ultra update_trip_item \
    --id="$TRIP_ID" \
    --itemId="$ITEM_ID" \
    --body="{\"check_in_date\": \"$NEW_DATE\"}" \
    --quiet
done
```

`--quiet` suppresses the API-key warning line for cleaner script output.

## Find suppliers by country + category

```sh
ultra list_suppliers --country=PT --category=accommodation --limit=50 --raw \
  | jq -r '.data[] | [.name, .city, .stars] | @tsv' \
  | column -t -s $'\t'
```

## Watch a trip for changes (poll)

```sh
#!/usr/bin/env bash
TRIP_ID="$1"
LAST=""
while :; do
  CUR=$(ultra get_trip --id="$TRIP_ID" --raw | jq -r '.data.updated_at')
  if [ "$CUR" != "$LAST" ]; then
    echo "[$(date -u +%H:%M:%S)] trip updated: $CUR"
    LAST="$CUR"
  fi
  sleep 30
done
```

For production use, wait for webhooks (planned — see [changelog](../docs/changelog.md)).

## Pipe into another tool

```sh
# Pipe to fzf for interactive trip selection
ultra list_trips --limit=100 --raw \
  | jq -r '.data[] | "\(.id)\t\(.title)"' \
  | fzf --delimiter=$'\t' --with-nth=2 \
  | cut -f1 \
  | xargs -I{} ultra get_trip --id={}
```

## CI: post-deploy smoke

In `.github/workflows/post-deploy-smoke.yml`:

```yaml
- name: Ultra API smoke check
  env:
    ULTRA_API_KEY: ${{ secrets.ULTRA_API_KEY }}
  run: |
    ultra list_trips --limit=1 --status > /dev/null
    ultra list_suppliers --limit=1 --status > /dev/null
    ultra list_bookings --limit=1 --status > /dev/null
    echo "All three list endpoints responded 2xx ✓"
```

Exit codes do the heavy lifting — any 4xx or 5xx fails the step.
