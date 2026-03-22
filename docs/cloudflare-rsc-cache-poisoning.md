# Cloudflare RSC Cache Poisoning

> **Status:** Resolved (v0.1.0-beta.1-hotfix.1)
> **Date:** 2026-03-23
> **Impact:** Intermittent — users see raw RSC flight data instead of the rendered page

---

## Architecture

```
Browser → Cloudflare CDN (sgp PoP) → DigitalOcean App Platform (sgp1) → Next.js 16 standalone server
```

The app runs on DigitalOcean App Platform in Singapore. Cloudflare sits in front as CDN/WAF/DDoS shield, with Bot Fight Mode and JS Challenge enabled.

## How RSC Works in Next.js

Next.js uses React Server Components (RSC) to stream component data between server and client:

1. **Fresh page load** — Browser sends a normal GET request. Next.js returns full HTML with embedded RSC payload, plus client-side JavaScript that hydrates the page.

2. **Client-side navigation** — When the user clicks a Next.js `<Link>` or uses `router.push`, the browser sends the same GET request but with additional headers:
   - `RSC: 1`
   - `Next-Router-State-Tree: <encoded tree>`
   - `Next-Router-Prefetch: 1` (for prefetches)

   Next.js sees these headers and responds with **flight data** — a compact streaming format (`:HL[...]` hints, `0:{...}` tree data) instead of HTML. The client-side runtime parses this and updates the DOM without a full page reload.

3. **Prefetching** — Next.js automatically prefetches linked pages in the viewport. These prefetch requests also use the `RSC: 1` header.

## The Cache Poisoning Problem

### Sequence

```
1. User A navigates to /app via client-side routing
   → Browser sends: GET /app with RSC: 1 header
   → Next.js responds: RSC flight data (content-type: text/x-component)
   → Cloudflare caches this response, keyed by URL only

2. User B visits /app in a new browser tab (fresh page load)
   → Browser sends: GET /app (no RSC header)
   → Cloudflare serves cached RSC flight data
   → Browser receives flight data but has no RSC runtime loaded
   → Raw text displayed: :HL[...] 0:{...}
```

### Why Cloudflare Ignores Vary: RSC

Next.js sets `Vary: RSC, Next-Router-State-Tree, Next-Router-Prefetch` on responses. Per HTTP caching spec, CDNs should cache separate versions for different values of these request headers. However:

- Cloudflare only honors `Vary: Accept-Encoding`
- All other `Vary` values are **ignored** on free and pro plans
- Enterprise plans support limited `Vary` via Cache Rules, but not for arbitrary custom headers
- This is documented at: https://developers.cloudflare.com/cache/concepts/cache-behavior/#vary-header

### Why Intermittent

- Different Cloudflare PoPs (Points of Presence) maintain independent caches
- Cache TTL varies by response headers and Cloudflare defaults
- The bug only manifests when a fresh page load hits a PoP that has a cached RSC response
- Traffic patterns determine how often RSC responses get cached (prefetches are a common trigger)

## Solution (Two-Layer Defense)

### Layer 1: Cloudflare Cache Rules (Dashboard)

Two rules in Cloudflare Dashboard > rapps.ai > Caching > Cache Rules, using an allowlist strategy (safer than a blocklist):

| Order | Rule Name | When | Then |
|-------|-----------|------|------|
| 1 | Cache static assets | URI Path starts with `/_next/static/` | Eligible for cache, Edge TTL = 1 year |
| 2 | Bypass everything else | All incoming requests (catch-all) | Bypass cache |

**Why allowlist over blocklist:** An allowlist ("only cache this one safe path") is safer than a blocklist ("cache everything except these paths"). `/_next/static/` is the only path that is unconditionally safe to cache -- every file is content-hashed by Next.js, so stale cache is impossible. If new routes, API endpoints, or static file types are added later, the rule doesn't need updating.

### Layer 2: Response Headers (`webapp/next.config.ts`)

**Dynamic routes** (`/((?!_next/static|_next/image|favicon\\.ico).*)`) receive:

```
Cache-Control: private, no-store, no-cache, must-revalidate
CDN-Cache-Control: no-store
Cloudflare-CDN-Cache-Control: no-store
Vary: RSC, Next-Router-State-Tree, Next-Router-Prefetch
```

**Static assets** (`/_next/static/*`) receive:

```
Cache-Control: public, max-age=31536000, immutable
```

### Header Priority in Cloudflare

Cloudflare evaluates cache directives in this order (highest priority first):

1. `Cloudflare-CDN-Cache-Control` -- CF-specific, always wins
2. `CDN-Cache-Control` -- RFC 9213 standard
3. `Cache-Control: s-maxage` -- shared cache directive
4. `Cache-Control` -- general directive
5. Cloudflare dashboard Cache Rules

By setting `Cloudflare-CDN-Cache-Control: no-store`, we guarantee Cloudflare will never cache dynamic responses regardless of any dashboard configuration.

### Why Both Layers?

Either layer alone would fix the issue. Both together provide defense in depth:

| Aspect | Layer 1 (Cache Rules) | Layer 2 (Response Headers) |
|--------|----------------------|---------------------------|
| Scope | Cloudflare-specific | All CDNs and proxies |
| Portability | Tied to Cloudflare dashboard | Travels with the app code |
| Maintenance | Must be configured per-zone | Self-documenting in `next.config.ts` |
| Failure mode | If rule is deleted, headers still protect | If headers are removed, rules still protect |

## Verification

After deployment, verify the headers are present:

```bash
# Dynamic page — should have no-store headers
curl -sI https://snaiagent.rapps.ai/app | grep -iE 'cache-control|cdn-cache|vary'

# Expected:
# cache-control: private, no-store, no-cache, must-revalidate
# cdn-cache-control: no-store
# cloudflare-cdn-cache-control: no-store
# vary: RSC, Next-Router-State-Tree, Next-Router-Prefetch

# Static asset — should have immutable cache
curl -sI https://snaiagent.rapps.ai/_next/static/chunks/webpack.js | grep -i cache-control

# Expected:
# cache-control: public, max-age=31536000, immutable
```

## References

- [Cloudflare Vary header behavior](https://developers.cloudflare.com/cache/concepts/cache-behavior/#vary-header)
- [Cloudflare CDN-Cache-Control](https://developers.cloudflare.com/cache/concepts/cache-control/#cdn-cache-control)
- [RFC 9213: Targeted HTTP Cache Control](https://www.rfc-editor.org/rfc/rfc9213)
- [Next.js RSC flight format](https://nextjs.org/docs/app/building-your-application/rendering/server-components)
