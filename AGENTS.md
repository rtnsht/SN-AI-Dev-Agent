# AGENTS.md

## Cursor Cloud specific instructions

### Architecture

Yantra is a two-component system: an **MCP ServiceNow library** (`mcp-servicenow/`) compiled from TypeScript, consumed as a `file:` dependency by a **Next.js webapp** (`webapp/`). A standalone CLI (`src/cli.js`, root `package.json`) exists but is independent of the webapp.

### Building & running

1. The MCP library must be built **before** the webapp can start: `cd mcp-servicenow && npx tsc`
2. Start the webapp in dev mode: `cd webapp && npm run dev` (port 3000)
3. Set `BYPASS_AUTH=true` in `webapp/.env` to skip Supabase auth for local development.
4. After editing any MCP tool schema or source in `mcp-servicenow/src/`, rebuild with `cd mcp-servicenow && rm -rf dist && npx tsc`, then restart the webapp dev server.

### Lint / type-check / test

| Check | Command | Notes |
|-------|---------|-------|
| Webapp lint | `cd webapp && npm run lint` | Pre-existing warnings/errors in repo (15 errors, 22 warnings as of setup) |
| Webapp type-check | `cd webapp && npx tsc --noEmit` | Clean |
| MCP build | `cd mcp-servicenow && npx tsc` | Clean |
| MCP tests | `cd mcp-servicenow && npm test` | Uses vitest; test directory exists but no test files yet |

### Environment variables

- `webapp/.env` — copy from `webapp/.env.example`. Key vars: `BYPASS_AUTH`, `CLAUDE_API_KEY` or `OPENROUTER_API_KEY`, `SN_INSTANCE_URL`, `SN_USERNAME`, `SN_PASSWORD`.
- `mcp-servicenow/.env` — only needed for standalone MCP server usage, not required when running via webapp.

### Gotchas

- The webapp's `mcp-servicenow` dependency uses `file:../mcp-servicenow` — always `npm install` in the webapp after modifying `mcp-servicenow/package.json`.
- Next.js 16 emits a deprecation warning about "middleware" → "proxy" convention; this is expected and harmless.
- ESLint v9 flat config is used in the webapp (`eslint.config.mjs`).
