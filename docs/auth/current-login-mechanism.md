# Current Login Mechanism

> **Status:** Current implementation reference  
> **Scope:** `webapp` custom auth, session, verification, and recovery flows  
> **Last reviewed:** 2026-03-30

## Summary

The application uses a **custom server-side auth system** backed by `public.users`, `public.sessions`, and `public.auth_tokens` in Supabase. It does **not** use Supabase Auth for end-user login.

The current system supports:

- email + password login
- direct signup
- request-access + OTP approval flow
- password reset and magic-link verification
- Google OAuth
- admin emergency recovery login

The auth gate is enforced in `webapp/src/proxy.ts`, sessions are created and validated in `webapp/src/lib/auth.ts`, and all server-side DB access goes through the service-role Supabase client in `webapp/src/lib/supabase.ts`.

## Core Components

### Middleware / Request Gate

`webapp/src/proxy.ts`

- Intercepts nearly all requests except static assets and `_next/*`
- Maintains a public-route allowlist for:
  - `/`
  - `/login`
  - `/signup`
  - `/request-access`
  - `/auth/verify`
  - `/auth/verify-email`
  - `/auth/emergency-login`
  - `/auth/set-password`
  - `/api/auth/*`
  - selected public APIs such as `/api/config`, `/api/chat`, `/api/chat-stream`
- Redirects authenticated users from `/` to `/app`
- Redirects unauthenticated page requests to `/login?redirect=<pathname>`
- Returns `401` for unauthenticated protected API calls
- Restricts `/admin` and `/api/admin/*` to users with `role === "admin"`
- Sanitizes any incoming `x-user-*` headers and injects trusted user headers after session validation
- Forces temporary sessions to `/auth/set-password` and `/api/auth/set-password` only

### Session + Token Helpers

`webapp/src/lib/auth.ts`

- Password hashing: `bcryptjs` with cost `12`
- Session tokens: 96-char random hex token
- Invite codes: 24-char random hex token
- OTPs: 6-digit numeric code
- Full session TTL: `SESSION_MAX_AGE_DAYS` (default `1`)
- Temporary session TTL: fixed `15` minutes
- Magic/password-reset token TTL: `MAGIC_LINK_EXPIRY_HOURS` (default `72`)
- Email verification link TTL: `EMAIL_VERIFY_EXPIRY_HOURS` (default `24`)
- OTP TTL: `OTP_EXPIRY_MINUTES` (default `10`)

### Server-Side DB Access

`webapp/src/lib/supabase.ts`

- Uses `SUPABASE_URL` + `SUPABASE_SERVICE_KEY`
- Caches a single server-side client
- Disables client-side auth persistence and token refresh
- This is service-role access, so authorization is primarily enforced in API routes and middleware

### Email Delivery

`webapp/src/lib/email.ts`

- Uses ZeptoMail for transactional mail
- Sends:
  - OTP verification emails
  - password reset emails
  - approval emails
  - admin notifications for access requests
- Driven by `APP_URL`, `ZEPTOMAIL_API_KEY`, `ZEPTOMAIL_API_URL`, `ZEPTOMAIL_FROM_EMAIL`, `ZEPTOMAIL_FROM_NAME`

### Auth Hint Cookie

`webapp/src/lib/auth-hint.ts`

- `POST /api/auth/check-email` never reveals whether an email exists directly
- Instead it writes an HMAC-signed `auth_hint` HttpOnly cookie
- `GET /api/auth/check-email/step` reads that cookie and returns the next step:
  - `password`
  - `request`

## Session Model

### Session Storage

Sessions live in the `sessions` table and include:

- `user_id`
- `token`
- `is_temporary`
- `expires_at`
- optional `ip_address`
- optional `user_agent`

### Validation Behavior

`validateSession(token)`:

1. Looks up a non-expired session row.
2. Loads the corresponding user from `users`.
3. If the user is suspended, deletes the current session and all user sessions.
4. Returns:
   - `session_id`
   - `user`
   - `is_temporary`

### Cookie Behavior

Session cookies are:

- `HttpOnly`
- `SameSite=Lax`
- `Path=/`
- `Secure` only in production
- named by `SESSION_COOKIE_NAME` (default `sn-ai-session`)

Helpers:

- `buildSetCookieHeader()`
- `buildClearCookieHeader()`
- `upgradeSession()`

## Authentication Flows

### 1. Email + Password Login

`POST /api/auth/login`

Flow:

1. Parse `email` + `password`
2. Rate limit by normalized email via `checkLogin()`
3. Load user from `users`
4. Reject uniformly if:
   - user missing
   - `password_hash` missing
   - user suspended
   - password mismatch
5. Update `last_login`
6. Create a full session
7. Set the session cookie
8. Return `mustSetPassword`

Notes:

- Error message is intentionally uniform: `Invalid email or password`
- This route creates a **full** session even if `must_set_password` is true

### 2. Direct Signup

`POST /api/auth/signup`

Flow:

1. Parse `name`, `email`, `password`
2. Rate limit by IP via `checkSignup()`
3. Validate password strength
4. Reject if the email already exists
5. Special-case existing Google-auth users with a more specific error
6. Create a new active `users` row with:
   - `auth_provider = "email"`
   - `role = "user"`
   - `status = "active"`
   - `must_set_password = false`
7. Create a full session
8. Set the cookie and return user info

### 3. Request Access + OTP Verification

Primary routes:

- `POST /api/auth/request-access`
- `POST /api/auth/verify-otp`

#### Request Access

Flow:

1. Parse `name`, `email`, `company`, `use_case`
2. Rate limit by IP via `checkRequestAccess()`
3. If user already exists, still issue an OTP without revealing account state
4. Otherwise create or update an `access_requests` row
5. Generate an OTP via `createOTPToken()`
6. Send OTP email via `sendOTPEmail()`

#### Verify OTP

Flow:

1. Parse `email` + `otp`
2. Rate limit by normalized email via `checkOTPVerify()`
3. Consume the OTP
4. Mark matching access requests as `approved` and `email_verified = true`
5. Find or create the corresponding user
6. New users are created with:
   - `role = "user"`
   - `status = "active"`
   - `must_set_password = true`
7. Create a **temporary** session
8. Redirect client to `/auth/set-password`

Notes:

- OTP is the current self-service approval path
- `verify-email` link-based verification still exists for compatibility / alternate flows

### 4. Magic Link + Password Reset Verification

`POST /api/auth/verify-magic-link`

Accepted token types:

- `magic_link`
- `password_reset`

Flow:

1. Parse `token`
2. Consume a valid non-expired token
3. Load the user by email
4. Reject suspended or missing users
5. If `must_set_password` is true or the token type is `password_reset`:
   - create a **temporary** session
   - redirect to `/auth/set-password`
6. Otherwise:
   - create a full session
   - update `last_login`
   - redirect to `/app`

### 5. Forgot Password

`POST /api/auth/forgot-password`

Flow:

1. Parse `email`
2. Rate limit by normalized email via `checkForgotPassword()`
3. Always return the same success message
4. If an active user exists:
   - create a `password_reset` auth token
   - send a password reset email

This route is intentionally non-enumerating.

### 6. Set Password

`POST /api/auth/set-password`

Requirements:

- must have a valid session cookie
- works for both temporary and full sessions

Flow:

1. Parse `password`
2. Validate password strength
3. Validate the current session
4. Hash and store the password in `users.password_hash`
5. Set `must_set_password = false`
6. Update `last_login`
7. If the session is temporary:
   - upgrade it to a full session
   - return redirect `/app`
8. Otherwise return success with redirect `/`

### 7. Google OAuth

Routes:

- `GET /api/auth/google`
- `GET /api/auth/google/callback`

Initiation flow:

1. Validate `GOOGLE_CLIENT_ID`
2. Capture optional post-login redirect
3. Create a CSRF-protected `state`
4. Persist state in `oauth_states` or `auth_tokens` fallback
5. Redirect to Google consent

Callback flow:

1. Validate `code` + `state`
2. Verify Google credentials are configured
3. Consume a valid stored state
4. Exchange `code` for Google tokens
5. Fetch Google user info
6. Find or create a local user
7. Link existing email users to Google when appropriate
8. Reject suspended users
9. Create a full session and redirect to the stored path

User rows created through Google OAuth use:

- `auth_provider = "google"`
- `google_id`
- `password_hash = null`
- `must_set_password = false`

### 8. Admin Emergency Recovery Login

Routes:

- `GET /api/auth/emergency-login`
- `POST /api/auth/emergency-login`
- UI page: `/auth/emergency-login`

Flow:

1. Require both `ADMIN_EMERGENCY_TOKEN` and `ADMIN_EMAIL`
2. Rate limit by IP via `checkEmergencyLogin()`
3. Compare the provided token using a timing-safe SHA-256 comparison
4. Find the admin user by email
5. Self-heal the admin user if missing by creating an active admin row
6. Re-promote the admin if role/status drifted
7. Create a **temporary** admin session
8. Redirect to `/auth/set-password`

This is the break-glass recovery path and should remain intentionally undiscoverable unless configured.

### 9. Logout + Session Introspection

Routes:

- `POST /api/auth/logout`
- `GET /api/auth/me`

`logout`:

- deletes the session row if present
- always clears the cookie

`me`:

- returns the current full-session user
- rejects temporary sessions

## Verification / Access-Request Compatibility Routes

### `POST /api/auth/verify-email`

This route still supports token-based `email_verify` flows:

1. Consume `email_verify` token
2. Move matching `access_requests` from `pending_verification` to `pending`
3. Mark `email_verified = true`
4. Send admin notification

This is distinct from the OTP approval path and appears to be a compatibility / alternate verification path.

## Auth Tokens

`auth_tokens` currently support these primary token types in `auth.ts`:

- `magic_link`
- `email_verify`
- `password_reset`

Additional OAuth-state fallback writes may also be stored there by the Google OAuth initiation route when `oauth_states` is unavailable.

OTP verification uses:

- `otp_code` when the column exists
- a legacy token-prefix fallback when it does not

## Rate Limiting

Auth-specific limits live in `webapp/src/lib/auth-rate-limiter.ts`.

Current built-in defaults:

- login: 5 attempts / 15 minutes per email
- forgot password: 3 / hour per email
- emergency login: 5 / hour per IP
- request access: 10 / hour per IP
- email lookup: 20 / 15 minutes per IP
- OTP verify: 5 / 10 minutes per email
- signup: 10 / hour per IP

Behavior:

- prefers DB-backed counters via Supabase RPC `check_auth_rate_limit`
- falls back to in-memory counters when DB-backed limiting is unavailable or disabled

## Environment Variables

### Required Core Auth / Session

- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`
- `SESSION_COOKIE_NAME`
- `SESSION_MAX_AGE_DAYS`

### Token / Link Expiry

- `MAGIC_LINK_EXPIRY_HOURS`
- `EMAIL_VERIFY_EXPIRY_HOURS`
- `OTP_EXPIRY_MINUTES`

### Access Control / Recovery

- `ADMIN_EMAIL`
- `ADMIN_EMERGENCY_TOKEN`
- `AUTH_HINT_SECRET`
- `BYPASS_AUTH`
- `SKIP_LANDING_PAGE`

### Google OAuth

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- optional `GOOGLE_REDIRECT_URI`

### Email

- `APP_URL`
- `ZEPTOMAIL_API_KEY`
- `ZEPTOMAIL_API_URL`
- `ZEPTOMAIL_FROM_EMAIL`
- `ZEPTOMAIL_FROM_NAME`

### Auth Rate Limits

- `LOGIN_MAX_ATTEMPTS`
- `LOGIN_WINDOW_MINUTES`
- `AUTH_RATE_LIMIT_USE_DB`

## Security Properties

- Session cookies are HttpOnly and SameSite=Lax
- The middleware strips any client-supplied user context headers before setting trusted values
- The `check-email` flow uses an HMAC-signed hint cookie instead of exposing whether an account exists
- Login and forgot-password endpoints avoid direct user enumeration
- Suspended users are invalidated during session validation
- Emergency-login uses timing-safe token comparison and temporary sessions only
- Service-role Supabase access is server-only and must never be exposed to the browser

## Known Behavioral Notes

- `login` creates a full session even when `must_set_password` is true; the frontend must honor the returned `mustSetPassword` flag.
- `set-password` accepts both temporary and full sessions.
- `verify-email` and `verify-otp` reflect two different access-verification paths that both still exist in the codebase.
- Google OAuth stores and consumes state via `oauth_states`, but can fall back to `auth_tokens` if that table is missing.

## Related Documents

- [Browser Session Authentication — Implementation Record](browser-session-auth-implementation.md)
- [Auth Gate Design](../design/auth-gate-design.md)
