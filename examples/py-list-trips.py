#!/usr/bin/env python3
"""Minimal Python example: list trips, paginate through all pages, write
each trip as one JSON line to all-trips.jsonl.

Run:
    ULTRA_API_KEY=ulk_yourkey python3 py-list-trips.py

Optional env:
    ULTRA_ORG_ID=…   (only needed for cross-org master keys)

Stdlib only — no dependencies.
"""

import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request

KEY = os.environ.get("ULTRA_API_KEY")
if not KEY:
    sys.exit("Set ULTRA_API_KEY in env (see ../docs/authentication.md).")

ORG = os.environ.get("ULTRA_ORG_ID")
BASE = os.environ.get("ULTRA_API_BASE_URL", "https://ultranetwork.co/api/v1")
OUT = "all-trips.jsonl"


def fetch_page(cursor: str | None) -> dict:
    params = {"limit": "50"}
    if cursor:
        params["cursor"] = cursor
    if ORG:
        params["organization_id"] = ORG
    url = f"{BASE}/trips?{urllib.parse.urlencode(params)}"

    req = urllib.request.Request(
        url,
        headers={
            "Authorization": f"Bearer {KEY}",
            "Accept": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = json.loads(e.read().decode("utf-8")) if e.fp else {}
        err = body.get("error", {})
        sys.exit(
            f"HTTP {e.code} {err.get('code', 'unknown')}: "
            f"{err.get('message', e.reason)} "
            f"(request_id={err.get('request_id', '(none)')})"
        )


def main() -> None:
    open(OUT, "w").close()  # truncate
    cursor: str | None = None
    pages = 0
    total = 0

    while True:
        page = fetch_page(cursor)
        with open(OUT, "a") as f:
            for trip in page["data"]:
                f.write(json.dumps(trip) + "\n")
        total += len(page["data"])
        pages += 1
        cursor = page["page"]["next_cursor"]
        print(
            f"page {pages}: +{len(page['data'])} trips "
            f"(cumulative {total}, has_more={page['page']['has_more']})",
            file=sys.stderr,
        )
        if not cursor:
            break

    print(f"\nDone: {total} trips written to {OUT}", file=sys.stderr)


if __name__ == "__main__":
    main()
