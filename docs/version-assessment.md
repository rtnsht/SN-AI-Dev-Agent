# Version Assessment

> Last updated: 2026-03-21

## Current Version Inventory

| Component | Local Dev | Docker/Prod | Config |
|-----------|-----------|-------------|--------|
| Node.js runtime | v25.8.0 (Current, unstable) | 24-alpine (LTS) | .nvmrc: 24 |
| engines.node | n/a | n/a | >=24.0.0 (all 3 package.json) |
| @types/node | n/a | n/a | ^24 (webapp) |
| Next.js | 16.1.6 | 16.1.6 | Latest stable |
| React | 19.2.3 | 19.2.3 | Latest stable |
| TypeScript | 5.9.3 | 5.9.3 | Latest stable |

## Upgrade Rationale

- Node 20 LTS reached End of Life April 2026. Upgraded to Node 22, then Node 24 LTS.
- Node 25 (local dev) is odd-numbered Current release with shorter support window.
- .nvmrc pins local dev to Node 24 LTS.
- engines.node set to >=24.0.0 across all packages.
- webapp/package.json includes engines aligned with the repo.
- @types/node at ^24 in webapp to match the Node 24 target.

## Node.js LTS Schedule

| Version | Status | Active LTS Until | Maintenance Until |
|---------|--------|------------------|-------------------|
| Node 20 | EOL (April 2026) | Oct 2024 | Apr 2026 |
| Node 22 | Active LTS | Oct 2027 | Apr 2028 |
| Node 24 | Active LTS | Oct 2029 | Apr 2030 |

## Next.js 16 proxy.ts Migration

Next.js 16 deprecated `middleware.ts` in favor of `proxy.ts`. The migration was completed as part of this plan:
- `webapp/src/middleware.ts` renamed to `webapp/src/proxy.ts`
- Export `middleware()` renamed to `proxy()`
- proxy.ts defaults to Node.js runtime, resolving the crypto build warning
- 6 documentation files updated to reference proxy.ts

## Future Actions

- Monitor Next.js release notes for any proxy.ts API changes
