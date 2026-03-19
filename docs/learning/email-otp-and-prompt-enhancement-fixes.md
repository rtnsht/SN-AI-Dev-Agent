# Learning: Email OTP & Prompt Enhancement Issues

This document captures the issues, root causes, and fixes for the production problems around **email OTP not being received** and **the new prompt-enhancement feature returning 405/401**. Use it for future debugging and onboarding.

---

## 1. Prompt enhancement endpoint (405 / 401)

### Symptom
- `POST /api/enhance-prompt` returned **405 Method Not Allowed** or **401 Unauthorized** in production (e.g. on Render at `snaiagent.rapps.ai`).
- The route handler correctly implemented `POST`; the failure was at the gateway layer.

### Root cause
- The Next.js **middleware** (`webapp/src/middleware.ts`) gates all non-public routes by session. Anonymous requests to `/api/enhance-prompt` were treated as unauthenticated and rejected with **401** (or surfaced as **405** depending on CDN/proxy behavior).
- `/api/enhance-prompt` was **not** listed in `PUBLIC_PATHS`, so the middleware blocked it before the route handler ran.

### Fix
- Add `/api/enhance-prompt` to the `PUBLIC_PATHS` array in `webapp/src/middleware.ts` so the endpoint is reachable without a session.

### Takeaway
- When adding a new **public** API route (e.g. used from the landing/app page without login), always add it to `PUBLIC_PATHS` in the auth middleware.

---

## 2. Email OTP not being received (502 / ZeptoMail 500 then 401)

Two separate problems caused OTP emails to fail: one in the **auth header**, one in the **payload**.

### 2a. ZeptoMail auth header (initial 500)

#### Symptom
- Request-access flow returned **502**; server logs showed **ZeptoMail 500** with little or no response body.

#### Root cause
- The app was building the Authorization header as:
  `Authorization: Zoho-enczapikey ${ZEPTOMAIL_API_KEY}`.
- In production (and in some envs), `ZEPTOMAIL_API_KEY` **already contained** the full value including the `Zoho-enczapikey ` prefix (e.g. from ZeptoMail dashboard).
- That produced a **duplicate prefix** in the header (e.g. `Zoho-enczapikey Zoho-enczapikey wSsVR61x+...`), which ZeptoMail rejected with **500**.

#### Fix
- Use the env value **as-is** for the header: `Authorization: ZEPTOMAIL_API_KEY`.
- Ensure `ZEPTOMAIL_API_KEY` in the environment is set to the **full** value from ZeptoMail (including the `Zoho-enczapikey ` prefix). Do not add the prefix again in code.

#### Takeaway
- When an API expects a single “Bearer” or “Zoho-enczapikey” style header, document whether the env var is “raw key” or “full header value” and use it consistently to avoid double-prefixing.

---

### 2b. ZeptoMail bounce_address (401 TM_4001 / SM_113)

#### Symptom
- After fixing the auth header, request-access still returned **502**; logs showed **ZeptoMail 401** with a structured error:
  - `TM_4001`, `SM_113`, `Invalid email address`, `target: "bounce_address"`, `target_value: "no-reply@bounce-zem.snaidevagent.rapps.ai"`.

#### Root cause
- The app always sent an optional `bounce_address` field in the ZeptoMail API payload when `ZEPTOMAIL_BOUNCE_ADDRESS` was set.
- ZeptoMail **validates** the bounce address (e.g. domain/configuration). The configured value was **invalid or not allowed** for the account, so the API returned **401 Access Denied** and rejected the entire request.

#### Fix
- **Stop sending** `bounce_address` in the ZeptoMail request payload (removed from `webapp/src/lib/email.ts`).
- The `ZEPTOMAIL_BOUNCE_ADDRESS` env var is no longer read or used. If bounce handling is needed later, the address must be validated/configured in ZeptoMail first and then re-added behind a check (e.g. only include if ZeptoMail docs or support confirm it’s valid for the account).

#### Takeaway
- Optional provider fields (e.g. bounce address) can still cause hard failures if the provider rejects their value. Prefer omitting them until they are explicitly validated and required.

---

## 3. OTP flow: schema and token creation (context only)

- Production Supabase had been missing the `otp_code` column on `auth_tokens` at one point, which caused OTP **token creation** to fail (separate from email delivery).
- A migration (`008_otp_support.sql`) added `otp_code` and an index; the auth layer was also made resilient (e.g. fallback when `otp_code` is absent).
- The issues in **§2** were about **sending** the email (ZeptoMail), not about creating or storing the OTP token.

---

## 4. Files changed (reference)

| Area | File | Change |
|------|------|--------|
| Middleware | `webapp/src/middleware.ts` | Added `/api/enhance-prompt` to `PUBLIC_PATHS`. |
| Email | `webapp/src/lib/email.ts` | Use `ZEPTOMAIL_API_KEY` directly for `Authorization`; removed `bounce_address` from payload and `BOUNCE_ADDRESS` constant; single read of response body for error logging. |
| Auth (optional resilience) | `webapp/src/lib/auth.ts` | Legacy OTP token format fallback when `otp_code` column is missing (if applied). |
| Request-access | `webapp/src/app/api/auth/request-access/route.ts` | e.g. `use_case` default, error handling (if applied). |

---

## 5. Verification

- **Enhance-prompt:** `POST /api/enhance-prompt` with `{ "text": "...", "mode": "grammar" }` returns **200** and corrected text when called from same-origin (e.g. browser on the app domain) or from a client that is not blocked by middleware/auth.
- **OTP:** Submit the request-access form (name + email); the flow should return **200** with `requiresOTP: true` and the OTP email should be sent. Check ZeptoMail logs/dashboard if delivery is still unclear.
- **Local:** Run the webapp (e.g. `npm run dev` in `webapp/`), hit `http://localhost:PORT/request-access`, and submit the form; no 502 and, with valid ZeptoMail config, email sends.

---

*Last updated: March 2025 (post-debug session and commit a41c7e7).*
