# Social share prompt — implementation plan & status

**Last updated:** 2026-03-24  
**Spec / operator doc:** [social-share-prompt.md](./social-share-prompt.md)

This plan tracks the original delivery checklist, current completion status, and hardening work.

---

## Task checklist (original scope)

| # | Task | Status | Notes |
|---|------|--------|--------|
| 1 | Supabase migration `share_prompt_tracking` | **Done** | [`019_share_prompt_tracking.sql`](../webapp/supabase/migrations/019_share_prompt_tracking.sql) |
| 2 | RLS hardening migration | **Done** | [`020_share_prompt_tracking_rls.sql`](../webapp/supabase/migrations/020_share_prompt_tracking_rls.sql) — enable RLS, no policies |
| 3 | `POST /api/share-tracking` | **Done** | JSON parse → 400; insert race → reload + update; cookie/IP binding via `share-server` |
| 4 | `POST /api/generate-share-tag` | **Done** | JSON parse → 400 |
| 5 | `GET /api/share-card` | **Done** | PNG → SVG → lettermark; `parseMetric` fallbacks |
| 6 | Session binding | **Done** | Cookie matches `user_id`; anonymous strict IP match |
| 7 | HMAC / fingerprint | **Done** | Production: `SHARE_HMAC_SECRET` only; dev fallbacks documented |
| 8 | `POST /api/session-start` | **Done** | JSON parse → 400; DB failure → **503** (no false success) |
| 9 | Frontend polish | **Done** | `markDisconnected` on SN reconnect; modal reset on open |
| 10 | Documentation | **Done** | This file + [social-share-prompt.md](./social-share-prompt.md) |

---

## Security / ops hardening (completed)

| Item | Implementation |
|------|----------------|
| P0 Anonymous binding | Reject share APIs when `user_id` is null unless **both** recorded and current IP are known and **equal**. |
| P0 Logged-in binding | Require **app session cookie** user id **===** `session_logs.user_id` (no `x-user-id` trust). |
| P1 HMAC | Production: only `SHARE_HMAC_SECRET`; missing → fingerprint `null` (tracking soft-disabled). Dev: optional `SHARE_HMAC_DEV_SECRET` or fixed dev string. |
| P1 Insert race | On unique violation, reload row and apply update path. |
| P2 JSON body | `share-tracking`, `generate-share-tag`, `session-start` return **400** on invalid JSON. |
| P2 OG logo | Optional `public/logo-share-card.png`; else SVG; else CSS lettermark in template. |
| Ops | `session-start` **503** if `session_logs` upsert fails; client logs non-OK responses. |
| DB | RLS enabled on `share_prompt_tracking` without policies (service role only). |

---

## Optional residual risks (document only)

- **Trusted proxy:** `X-Forwarded-For` / `X-Real-IP` must reflect the real client at your edge; misconfiguration weakens anonymous IP binding.
- **Social unfurl:** Crawlers without your cookie cannot load user-bound `share-card` URLs (by design).
- **Satori + SVG:** Prefer `logo-share-card.png` in production for consistent renders.

---

## Sub-agent references (internal)

Earlier parallel reviews informed the hardening list above; this file is the canonical rollup.
