# Social share prompt (LinkedIn / X)

**Implementation plan & checklist (status + 7-way review rollup):** [social-share-implementation-plan.md](./social-share-implementation-plan.md)

This document describes the end-to-end “share your session” feature: UX rules, client storage, APIs, database table, fingerprinting/privacy notes, and deployment steps.

## User experience

1. While connected to a ServiceNow instance from `/app`, the client evaluates a satisfaction gate on a 60s timer (see `useSharePrompt`).
2. If eligible, the UI calls `POST /api/share-tracking` with `action: "shown"`. If the server returns `canShow: true`, a banner appears above the chat.
3. **Share** opens a modal with drafted text, an AI-generated hashtag, and a generated share card PNG.
4. **Dismiss** (banner X, or closing the modal after opening it from the banner) records `action: "dismissed"` and permanently suppresses the banner for that browser fingerprint (see “Fingerprinting”).
5. After dismiss or share, a **Share your session** button appears in the right sidebar for the remainder of the browser session (`sessionStorage`), even if the banner is suppressed.

## Client implementation

Key files:

- `webapp/src/hooks/useSharePrompt.ts` — gating + `/api/share-tracking` calls + session/local persistence keys.
- `webapp/src/components/ShareBanner.tsx` — banner UI.
- `webapp/src/components/SharePromptModal.tsx` — modal UI + clipboard/download + platform links.
- `webapp/src/lib/share-content.ts` — message/card URL builders + hashtag sanitization.
- `webapp/src/app/app/page.tsx` — wires banner/modal/sidebar entry points; ensures `/api/session-start` runs per `clientSessionId` while connected.

### Browser persistence keys (`sessionStorage`)

- `ai-share-connected-at` — epoch ms for “connected timer” stats.
- `ai-share-panel-link` — `"true"` when the sidebar entry point should be shown for this tab session.
- `ai-share-fingerprint` — optional cache of the server-returned fingerprint string (helps local prompt counting).

### Browser persistence keys (`localStorage`)

- `share-prompt:<fingerprint>` — integer `0..2` prompt counter synced with server `shown_count`.

## Server APIs

### `POST /api/share-tracking`

Validates the caller can act for the provided `sessionId` by loading `session_logs`, then upserts `share_prompt_tracking` by fingerprint.

- Body: `{ sessionId, action: "shown" | "dismissed" | "shared", platform?: "linkedin" | "x" }`
- `platform` is required when `action` is `shared`.
- Rate limited via `checkShareTracking` (`webapp/src/lib/auth-rate-limiter.ts`).
- Validation: `parseShareTrackingBody` (`webapp/src/lib/request-validation.ts`).

### `POST /api/generate-share-tag`

Generates a single hashtag using Anthropic Messages (numeric stats only). Falls back to a default tag if `CLAUDE_API_KEY` is missing or the call fails.

- Body: `{ sessionId, durationMin, phaseCount, toolCount, assistantCount }`
- Session bound via `resolveShareSessionContext`.
- Rate limited via `checkShareTagGeneration`.

### `GET /api/share-card`

Returns a PNG generated via `next/og` (`ImageResponse`) using `webapp/src/lib/share-card-template.tsx`.

- Query params include `sessionId`, numeric stats, and `tag`.
- Logo: prefers `webapp/public/logo-share-card.png` (PNG, best for Satori); else `logo-r-v10.svg`; if neither loads, the card uses a built-in **lettermark** (no image).
- Session bound via `resolveShareSessionContext`.
- Rate limited via `checkShareCard`.

## Session binding + fingerprinting

`webapp/src/lib/share-server.ts` loads the `session_logs` row for `sessionId` and enforces:

- If the session record has **`user_id`**: the caller must present a **valid app session cookie** whose user id matches `user_id` (same cookie used for `/api/session-start`). Client `x-user-id` headers are **not** trusted for share APIs.
- If the session record has **no `user_id`** (anonymous `/app`): the caller IP must **match** `ip_address`, and both IPs must be known (not `"unknown"`). Otherwise the request is rejected.

Instance URL in the fingerprint uses a **canonical origin** (scheme + host + port via `URL.origin`) to reduce duplicate fingerprints from trailing slashes or default paths.

Fingerprint:

- `HMAC_SHA256(secret, normalize(instance_url) + "|" + effective_ip + "|" + normalize(username))`
- `effective_ip` prefers the current request IP, otherwise falls back to the recorded session IP.

Secret selection (`getShareSecret()`):

- **Production:** `SHARE_HMAC_SECRET` only. If unset, **fingerprints are disabled** (share tracking returns `canShow: false` / `fingerprint: null`; tag and card APIs still work).
- **Non-production:** `SHARE_HMAC_SECRET`, else optional `SHARE_HMAC_DEV_SECRET`, else a fixed dev-only fallback string (never service keys or cookie names).

## Database

Migrations:

- `webapp/supabase/migrations/019_share_prompt_tracking.sql` — table + `updated_at` trigger.
- `webapp/supabase/migrations/020_share_prompt_tracking_rls.sql` — **enable RLS** with no policies (server `service_role` only via app code).

Table `public.share_prompt_tracking`:

- `fingerprint` (unique)
- `shown_count` (`0..10` check in migration; product logic caps at `2`)
- `last_shown_at`, `shared_at`, `platform`
- `created_at`, `updated_at` (+ trigger to bump `updated_at`)

Apply to your Supabase project using your normal migration process (SQL editor, `supabase db push`, or CI migration runner). This repo does not automatically apply migrations to a remote database.

## Auth gate / public paths

Anonymous `/app` users must be able to call the share endpoints. `webapp/src/proxy.ts` includes:

- `/api/share-tracking`
- `/api/generate-share-tag`
- `/api/share-card`

## Environment variables

- `SHARE_HMAC_SECRET` — **required in production** for share fingerprinting / tracking caps. Rotate independently from Supabase keys.
- `SHARE_HMAC_DEV_SECRET` — optional local/staging override instead of the built-in dev fallback.
- `CLAUDE_API_KEY` — required for AI hashtag generation (otherwise the modal uses the fallback tag).

## Operations notes

- Share analytics are intentionally **non-PII at rest** in `share_prompt_tracking` (fingerprint only).
- `session_logs` still contains session metadata used for authorization; protect Supabase credentials accordingly.
- `POST /api/session-start` returns **503** if the `session_logs` upsert fails (so clients are not told the session was persisted when it was not).
- Social crawlers fetching `GET /api/share-card` without your app cookie will still get **403** for user-bound sessions; in-app `fetch` with cookies works.
