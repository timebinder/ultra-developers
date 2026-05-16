# CLI

The `ultra` CLI exposes every `/api/v1/*` operation as a subcommand. Use it for one-off lookups, shell scripts, CI pipelines, or anywhere a command line is more natural than HTTP.

## Why a CLI

Like the MCP server, the CLI is **spec-driven** — it loads the live OpenAPI document at boot and renders one subcommand per operation. New endpoints become new subcommands at the next invocation. Zero CLI code changes.

## Install

The CLI is currently distributed from source. npm publication as `@ultra-network/cli` is on the roadmap; until then, run via `tsx` from the source tree.

```sh
# Once source is available locally:
ULTRA_API_KEY=ulk_yourkey npx tsx /path/to/ultra-cli/src/cli.ts --help
```

Add a shell alias to make it feel native:

```sh
# ~/.zshrc or ~/.bashrc
alias ultra='ULTRA_API_KEY="$(cat ~/.config/ultra/key)" npx tsx /path/to/ultra-cli/src/cli.ts'
```

Then:

```sh
ultra --help
ultra list_trips --limit=5
ultra get_trip --id=trip_…
```

> **Note**: source release is pending — until it lands, request early access via [ultranetwork.co/contact](https://ultranetwork.co/contact).

## Usage

```
ultra                                 → top-level help (commands grouped by resource)
ultra --help                          → ditto
ultra --version                       → CLI + spec version
ultra <command> --help                → per-command help (path / query / body)
ultra <command> --flag=value …        → execute
```

### Examples

```sh
# List trips
ultra list_trips --limit=10

# Get a specific trip
ultra get_trip --id=dfa6fac3-98aa-414c-acd8-0bca6fa4eb44

# Create a trip from inline JSON
ultra create_trip --body='{"title":"Demo trip","client_id":"client_…"}'

# Create a trip from a file
ultra create_trip --body=@payload.json

# Create a trip from stdin
cat payload.json | ultra create_trip --body=-

# List bookings on one trip
ultra list_bookings --trip_id=dfa6fac3-… --limit=20

# Cancel a booking (dispatches through the supplier adapter)
ultra update_booking --id=bkg_… --body='{"status":"cancelled","cancellation_reason":"Client request"}'
```

### Repeated flags become arrays

```sh
ultra list_suppliers --country=ES --country=PT --country=IT --limit=50
```

### Body sources

The `--body` flag accepts three sources:

| Form | Source |
|---|---|
| `--body='{…}'` | Inline JSON string |
| `--body=@path/to/file.json` | Read from a file |
| `--body=-` | Read from stdin |

All three feed the same JSON payload to the request.

## Global flags

| Flag | Purpose |
|---|---|
| `--spec=<url\|path>` | Override the OpenAPI source for one invocation |
| `--base-url=<url>` | Override the server base URL (useful for staging) |
| `--status` | Print `HTTP <code>` + `request_id` to stderr |
| `--raw` | Print response body unchanged (no JSON pretty-print) |
| `--quiet` | Suppress progress lines on stderr |
| `--help, -h` | Top-level help, or per-command help when a command is named |
| `--version, -V` | Print CLI + spec version |

## Environment

| Variable | Default | Purpose |
|---|---|---|
| `ULTRA_API_KEY` | (required) | Bearer key — see [authentication](./authentication.md) |
| `ULTRA_API_SPEC` | `https://ultranetwork.co/api/v1/openapi.json` | OpenAPI source |
| `ULTRA_API_BASE_URL` | (from spec) | Override server base URL |
| `ULTRA_API_TAGS` | (all) | CSV tag filter — only expose subcommands for matching tags |

## Exit codes

| Code | Meaning |
|---|---|
| 0 | 2xx response |
| 1 | 4xx response (client error) |
| 2 | 5xx response or network failure |
| 3 | Usage / parse error (bad flag, unknown command, missing required body) |
| 4 | Spec load failure |

Useful in shell scripts:

```sh
if ultra get_trip --id="$TRIP" > "$TRIP.json"; then
  echo "Fetched $TRIP"
else
  echo "Failed with exit $?" >&2
fi
```

## Cookbook

See [`examples/cli-cookbook.md`](../examples/cli-cookbook.md) for longer recipes (nightly trip export, booking-status sync, etc.).

## Source

[`packages/ultra-cli`](https://github.com/timebinder/ultra-network/tree/main/packages/ultra-cli) — currently in the private monorepo. Source release pending.

## Next

- [MCP server](./mcp.md) — same operations, exposed to LLMs
- [API reference](./api-reference.md) — what each subcommand actually does
- [Pagination](./pagination.md) — handling `next_cursor` from list operations
