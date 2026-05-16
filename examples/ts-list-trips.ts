/**
 * Minimal TypeScript example: list trips, paginate through all pages,
 * write each trip as one JSON line to all-trips.jsonl.
 *
 * Run:
 *   ULTRA_API_KEY=ulk_yourkey npx tsx ts-list-trips.ts
 *
 * Optional env:
 *   ULTRA_ORG_ID=…  (only needed for cross-org master keys)
 */

import { appendFileSync, writeFileSync } from 'node:fs';

const KEY = process.env.ULTRA_API_KEY;
if (!KEY) {
  console.error('Set ULTRA_API_KEY in env (see ../docs/authentication.md).');
  process.exit(1);
}

const ORG = process.env.ULTRA_ORG_ID;
const BASE = process.env.ULTRA_API_BASE_URL || 'https://ultranetwork.co/api/v1';
const OUT = 'all-trips.jsonl';

interface Trip {
  id: string;
  organization_id: string;
  title: string | null;
  stage: string;
  destination: string | null;
  start_date: string | null;
  end_date: string | null;
  party_size: number;
  client: { id: string; name: string };
  created_at: string;
  updated_at: string;
}

interface TripsPage {
  data: Trip[];
  page: { next_cursor: string | null; has_more: boolean; limit: number };
  error?: { code: string; message: string; request_id?: string };
}

async function fetchPage(cursor: string | null): Promise<TripsPage> {
  const url = new URL(`${BASE}/trips`);
  url.searchParams.set('limit', '50');
  if (cursor) url.searchParams.set('cursor', cursor);
  if (ORG) url.searchParams.set('organization_id', ORG);

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${KEY}`,
      Accept: 'application/json',
    },
  });

  const body = (await res.json()) as TripsPage;

  if (!res.ok) {
    const code = body.error?.code ?? 'unknown';
    const msg = body.error?.message ?? res.statusText;
    const reqId = body.error?.request_id ?? res.headers.get('x-request-id') ?? '(none)';
    throw new Error(`HTTP ${res.status} ${code}: ${msg} (request_id=${reqId})`);
  }
  return body;
}

async function main() {
  writeFileSync(OUT, ''); // truncate
  let cursor: string | null = null;
  let pages = 0;
  let total = 0;

  do {
    const page = await fetchPage(cursor);
    for (const trip of page.data) {
      appendFileSync(OUT, JSON.stringify(trip) + '\n');
    }
    total += page.data.length;
    pages += 1;
    cursor = page.page.next_cursor;
    console.error(
      `page ${pages}: +${page.data.length} trips (cumulative ${total}, has_more=${page.page.has_more})`,
    );
  } while (cursor);

  console.error(`\nDone: ${total} trips written to ${OUT}`);
}

main().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});
