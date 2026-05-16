# Ultra Developers

Developer resources for the [Ultra Network](https://ultranetwork.co) platform — REST API, MCP server, CLI, SDKs, and code examples.

Ultra is a meeting ground for luxury-travel advisors, suppliers, and DMCs. Everything you can do in the web app you can also do through these developer surfaces — build agents, automate workflows, integrate with your stack.

## Start here

- [**Getting started**](./docs/getting-started.md) — your first API call in 60 seconds
- [**Authentication**](./docs/authentication.md) — `ulk_…` keys, scopes, org binding
- [**API reference**](./docs/api-reference.md) — live OpenAPI 3.1, interactive Scalar UI
- [**MCP server**](./docs/mcp.md) — drop Ultra into Claude Code, Cursor, Windsurf
- [**CLI**](./docs/cli.md) — `ultra <command>` for every operation
- [**Errors**](./docs/errors.md) — the stable error envelope you can rely on
- [**Pagination**](./docs/pagination.md) — keyset pagination + incremental sync
- [**Changelog**](./docs/changelog.md) — what shipped when

## Surfaces

| Surface | Best for | Status |
|---|---|---|
| **REST API** (`/api/v1/*`) | Web apps, server integrations, anything HTTP | GA |
| **MCP server** | LLM agents (Claude Code, Cursor, Windsurf, custom MCP clients) | Public beta — [`@ultra-network/mcp`](https://www.npmjs.com/package/@ultra-network/mcp) |
| **CLI** | Operators, scripts, CI pipelines, one-off automation | Public beta — [`@ultra-network/cli`](https://www.npmjs.com/package/@ultra-network/cli) |
| **TypeScript SDK** | Type-safe Node / browser integrations | Planned |
| **Python SDK** | Data work, ML pipelines | Planned |

All four are **spec-driven** — they all read the same OpenAPI 3.1 document at [ultranetwork.co/api/v1/openapi.json](https://ultranetwork.co/api/v1/openapi.json). New endpoints land in every surface automatically.

## Examples

- [`examples/`](./examples/) — runnable snippets in TypeScript, Python, and shell

## Live links

- **Production base URL**: `https://ultranetwork.co/api/v1`
- **OpenAPI document**: `https://ultranetwork.co/api/v1/openapi.json`
- **Interactive reference** (Scalar): `https://ultranetwork.co/api/v1/docs`
- **Status / changelog**: this repo's [changelog](./docs/changelog.md)

## Getting help

- **Bug or feature request**: [open an issue](https://github.com/timebinder/ultra-developers/issues)
- **Account, billing, or business enquiry**: [ultranetwork.co/contact](https://ultranetwork.co/contact)
- **About Ultra**: [ultranetwork.co](https://ultranetwork.co)

## Licence

The code in this repo (examples, scripts, docs) is MIT-licensed. Use it however you like.
