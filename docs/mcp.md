# MCP server

The Ultra MCP server turns every `/api/v1/*` operation into a tool any LLM can call. A travel-agent AI inside Claude Code can read an itinerary, check supplier availability, append a flight, and record a confirmed booking — all without writing a line of HTTP code. That's the point: the operator describes the trip in natural language, the agent does the work against Ultra, the human approves.

Drop the server into any MCP-compatible client — Claude Code, Cursor, Windsurf, Zed, custom clients — and every endpoint becomes a tool the model can reach for.

## Why MCP

The MCP server is **spec-driven** — it loads the live OpenAPI document at boot and registers one tool per operation. When we ship a new endpoint, the next time you restart the MCP server it appears as a new tool. No MCP code changes, no client updates. Your agent grows as the platform grows.

This is the structural bet: agents and humans need to share the same operations on the same data, and the spec is the contract that keeps both honest. The CLI ships from the same spec for the same reason — humans at terminals and agents in chat windows hit the same surface, with the same auth and the same guarantees.

## Install

```sh
npm install -g @ultra-network/mcp
```

Or invoke without installing via the config below.

## Configure Claude Code

Pick one of three config locations, depending on scope:

- **User-global**: `~/.claude.json` — server available in every project
- **Project-local**: `.mcp.json` in the project root — server available only when Claude Code runs from that project (good for keeping a project-scoped `ULTRA_API_KEY`)
- **Claude Desktop**: `claude_desktop_config.json` (location varies by OS — see [Anthropic's docs](https://docs.claude.com))

The shape is the same everywhere:

```json
{
  "mcpServers": {
    "ultra": {
      "command": "npx",
      "args": ["-y", "@ultra-network/mcp"],
      "env": {
        "ULTRA_API_KEY": "ulk_yourkey"
      }
    }
  }
}
```

Restart Claude Code. Type `/mcp` to confirm the server connected. Once it has, the LLM can call tools like `list_trips`, `create_booking`, `append_trip_item` — every v1 operation, exposed as a tool with a name and JSON-schema input.

## Configure Cursor / Windsurf / Zed

Each editor has its own MCP config UI. The shape of the entry is the same — a command + args + env block. Point `command` at your local `tsx` and `args` at the MCP server entry file.

## Environment

| Variable | Default | Purpose |
|---|---|---|
| `ULTRA_API_KEY` | (required) | Bearer key — see [authentication](./authentication.md) |
| `ULTRA_API_SPEC` | `https://ultranetwork.co/api/v1/openapi.json` | OpenAPI source — point at a local file for offline dev |
| `ULTRA_API_BASE_URL` | (from spec) | Override server base URL — useful for staging |
| `ULTRA_API_TAGS` | (all) | CSV tag filter — only expose tools for operations matching these tags (`Trips,Bookings`) |

## What the LLM sees

Tool names are derived from `operationId`, snake-cased:

| operationId | MCP tool name | What it does |
|---|---|---|
| `listTrips` | `list_trips` | List trips |
| `createTrip` | `create_trip` | Create a trip |
| `getTrip` | `get_trip` | Get a trip by ID |
| `appendTripItem` | `append_trip_item` | Add an item to a trip |
| `updateTripItem` | `update_trip_item` | Update an item |
| `deleteTripItem` | `delete_trip_item` | Remove an item |
| `listSuppliers` | `list_suppliers` | List suppliers |
| `getSupplier` | `get_supplier` | Get a supplier |
| `listBookings` | `list_bookings` | List bookings |
| `createBooking` | `create_booking` | Create a booking (manual or adapter dispatch) |
| `getBooking` | `get_booking` | Get a booking |
| `updateBooking` | `update_booking` | Update status / payment / cancel via adapter |

Each tool's `inputSchema` is derived from the OpenAPI schema — path params, query params, and request body all surface at the top level so the LLM knows what to send.

## Restricting tool surface

To expose only a subset of operations (e.g. read-only):

```json
{
  "mcpServers": {
    "ultra-readonly": {
      "command": "npx",
      "args": ["-y", "@ultra-network/mcp"],
      "env": {
        "ULTRA_API_KEY": "ulk_yourkey",
        "ULTRA_API_TAGS": "Trips,Suppliers"
      }
    }
  }
}
```

For finer-grained control (no `createBooking`, no `updateTripItem`), use a key with restricted scopes — see [authentication § scopes](./authentication.md#scopes).

## Troubleshooting

**`tools/list` returns 0 tools** — `ULTRA_API_SPEC` may be wrong. Check the URL returns a valid OpenAPI document with non-empty `paths`.

**Every tool call returns 401** — `ULTRA_API_KEY` is missing or invalid. Boot the server with the var set; the server warns to stderr if it's missing.

**Tool calls return 400 "Write operations require an org-bound API key"** — you're using a cross-org master key. Use an org-bound key for write operations.

**MCP server can't be found by Claude Code** — `/mcp` shows the server status. If it's stuck on "connecting", check `~/Library/Logs/Claude/mcp.log` (macOS) for the actual error.

## Package

[`@ultra-network/mcp`](https://www.npmjs.com/package/@ultra-network/mcp) on npm. MIT-licensed.

## Next

- [API reference](./api-reference.md) — what each tool actually does on the server
- [CLI](./cli.md) — same operations, shell-friendly
