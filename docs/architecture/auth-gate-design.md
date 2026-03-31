# AUTH-GATE: Technical Design Document

## Document Control

| Field | Value |
|-------|-------|
| **Requirement ID** | AUTH-GATE |
| **Spec Version** | 1.0 |
| **Author** | AI Agent |
| **Created** | 2026-03-12 |
| **Last Updated** | 2026-03-13 |
| **Version** | 2.0 |
| **Status** | Approved |

---

## 1. Discovery Summary

> This feature is a **webapp-only** concern (Next.js + Supabase + ZeptoMail). No ServiceNow artifacts are involved. The auth gate wraps the existing app — zero changes to the core chat/MCP/ServiceNow functionality.

### 1.1 Existing Codebase Analysis

| Area | Current State | Impact |
|------|--------------|--------|
| Authentication | None — app is open access | New system required |
| Rate limiting | IP-based via `rate-limiter.ts` | Pattern reusable for brute force protection |
| Session management | `sessionStorage` client-side only | Server-side sessions needed |
| Middleware | None | New `proxy.ts` required |
| Database | None (stateless app) | Supabase added for user/session persistence |

### 1.2 Implementation Decision

> **Build New** — No existing auth infrastructure. Building custom auth with opaque session tokens, bcrypt password hashing, and Supabase as the backing store.

---

## 2. Solution Overview

### 2.1 Summary

An invite-only access gate that requires users to either (a) request access and be approved by an admin, or (b) use an admin-generated invite code. After first login via magic link, users set a password for subsequent logins. All configuration lives in `.env`. Admin dashboard is built into the app at `/admin`.

### 2.2 Goals

- Gate access: only approved/invited users can use the app
- Admin approval workflow with email notifications
- Invite code system for direct sharing
- Password-based login after initial magic link setup
- Zero changes to existing chat/MCP/ServiceNow functionality
- All configuration via `.env`

### 2.3 Non-Goals

- OAuth / social login (Google, GitHub, etc.)
- Multi-tenant / organization support
- Self-service password change UI (future scope)
- User-facing usage analytics

---

## 3. Architecture

### 3.1 System Context

```
┌─────────────┐     HTTPS      ┌──────────────────────────────────┐
│   Browser    │◄──────────────►│   Next.js App (webapp/)          │
│             │                │                                  │
│  - Login    │                │  proxy.ts (auth gate)        │
│  - Chat     │                │  /api/auth/* (auth endpoints)    │
│  - Admin    │                │  /api/admin/* (admin endpoints)  │
└─────────────┘                │  /api/chat* (existing, gated)    │
                               └──────┬──────────┬────────────────┘
                                      │          │
                              ┌───────▼──┐  ┌────▼──────────┐
                              │ Supabase │  │   ZeptoMail   │
                              │ (Postgres)│  │ (Email API)   │
                              │          │  │               │
                              │ - users  │  │ - Magic links │
                              │ - sessions│ │ - Approvals   │
                              │ - tokens │  │ - Verify email│
                              │ - requests│ │ - Admin notify│
                              │ - invites│  └───────────────┘
                              └──────────┘
```

### 3.2 Auth Flow — Request Access Path

```
Visitor → /request-access
    │
    ├─ POST /api/auth/request-access
    │   ├─ Validate input (name, email, use_case)
    │   ├─ Check duplicate email in access_requests
    │   ├─ Rate limit: 10 requests/hour per IP
    │   ├─ Insert access_requests (status: pending_verification)
    │   ├─ Generate email verification token (auth_tokens, type: email_verify)
    │   └─ ZeptoMail → user: "Verify your email"
    │
    ├─ User clicks verify link → /auth/verify-email?token=xxx
    │   ├─ POST /api/auth/verify-email
    │   ├─ Token valid + not expired + not used?
    │   │   ├─ Mark token used_at
    │   │   ├─ Update access_requests.status → pending
    │   │   ├─ ZeptoMail → ADMIN_EMAIL: "New access request from <name>"
    │   │   └─ Show: "Email verified! We'll review your request."
    │   └─ Token invalid? → "Invalid or expired link"
    │
    ├─ Admin logs in → /admin → reviews requests
    │   ├─ PATCH /api/admin/requests/:id (action: approve)
    │   │   ├─ Update access_requests.status → approved
    │   │   ├─ Create user (status: active, must_set_password: true)
    │   │   ├─ Generate magic link token (auth_tokens, type: magic_link, 72h expiry)
    │   │   └─ ZeptoMail → user: "You're in! Click to set up your account"
    │   └─ PATCH /api/admin/requests/:id (action: reject)
    │       └─ Update access_requests.status → rejected
    │
    ├─ User clicks magic link → /auth/verify?token=xxx
    │   ├─ POST /api/auth/verify-magic-link
    │   ├─ Token valid?
    │   │   ├─ Mark token used_at
    │   │   ├─ user.must_set_password === true?
    │   │   │   ├─ Generate temporary session (short-lived, 15 min)
    │   │   │   └─ Redirect → /auth/set-password
    │   │   └─ user.must_set_password === false?
    │   │       ├─ Create full session (SESSION_MAX_AGE_DAYS)
    │   │       └─ Redirect → /app
    │   └─ Token invalid? → "Invalid or expired link"
    │
    └─ User sets password → /auth/set-password
        ├─ POST /api/auth/set-password
        ├─ Validate: min 8 chars, has letter + number
        ├─ bcrypt hash (cost 12), store in users.password_hash
        ├─ Set must_set_password → false
        ├─ Upgrade temp session → full session (SESSION_MAX_AGE_DAYS)
        └─ Redirect → /app
```

### 3.3 Auth Flow — Invite Code Path

```
Visitor → /invite/:code
    │
    ├─ GET /invite/:code (page load)
    │   ├─ Validate code: exists, is_active, not expired, times_used < max_uses
    │   ├─ Valid? → Show registration form (name, email, password)
    │   └─ Invalid? → "This invite link is no longer valid"
    │
    └─ POST /api/auth/register-invite
        ├─ Re-validate invite code
        ├─ Validate input (name, email, password)
        ├─ Check email not already in users table
        ├─ Create user (status: active, must_set_password: false, password_hash: bcrypt)
        ├─ Increment invite_codes.times_used
        ├─ Create session (SESSION_MAX_AGE_DAYS)
        └─ Redirect → /app
```

### 3.4 Auth Flow — Smart Email-First Login (Landing Page)

> **Updated 2026-03-13:** The landing page (`/`) now uses a smart email-first login modal instead of redirecting to `/login`. The `/login` page still exists as a fallback for direct URL access and middleware redirects.

```
Visitor → / (landing page)
    │
    ├─ Clicks "Connect Now" → opens ConnectModal
    │
    ├─ Step 1: Email Input
    │   ├─ POST /api/auth/check-email
    │   │   ├─ Rate limit: 20 per IP per 15 min
    │   │   ├─ Lookup email in users table
    │   │   ├─ Result: "known" (active user) or "unknown"
    │   │   ├─ HMAC-sign: HMAC-SHA256(email|result, AUTH_HINT_SECRET)
    │   │   ├─ Set HttpOnly cookie: auth_hint=<hmac>.<result>; Max-Age=300
    │   │   └─ Response: { continue: true } (always identical — anti-enumeration)
    │   │
    │   └─ GET /api/auth/check-email/step
    │       ├─ Read auth_hint cookie
    │       ├─ Verify HMAC, extract result
    │       ├─ Clear cookie
    │       └─ Response: { step: "password" } or { step: "request" }
    │
    ├─ Step 2a: Known User → Password Input
    │   ├─ POST /api/auth/login (existing endpoint)
    │   ├─ Success → redirect to /app
    │   ├─ Failure → inline error, retry
    │   └─ "Forgot password?" → POST /api/auth/forgot-password (existing)
    │
    └─ Step 2b: Unknown User → Request Access Form
        ├─ Pre-filled email from Step 1
        ├─ Additional fields: name, company (optional), use_case (optional)
        ├─ POST /api/auth/request-access (existing endpoint)
        └─ Success → "Check your email" confirmation
```

### 3.5 Auth Flow — Login via /login (Fallback)

```
User → /login (direct URL or middleware redirect)
    │
    ├─ POST /api/auth/login
    │   ├─ Rate limit: 5 attempts per email per 15 min
    │   ├─ Lookup user by email
    │   ├─ User not found OR bcrypt.compare fails?
    │   │   └─ 401: "Invalid email or password" (no enumeration)
    │   ├─ User found, password matches, user.status === 'active'?
    │   │   ├─ Create session (SESSION_MAX_AGE_DAYS)
    │   │   ├─ Update users.last_login
    │   │   └─ Set cookie → redirect to /app
    │   └─ User found but status === 'suspended'?
    │       └─ 401: "Invalid email or password" (no enumeration)
    │
    └─ "Forgot password?" link
        ├─ POST /api/auth/forgot-password
        ├─ Rate limit: 3 per email per hour
        ├─ User exists + active? → Generate magic link, send via ZeptoMail
        ├─ User not found? → Still show "If registered, you'll receive a link"
        └─ User clicks magic link → /auth/verify → set-password flow
```

### 3.6 Session Validation (Every Request)

```
proxy.ts runs on every request
    │
    ├─ Extract cookie: sn-ai-session
    ├─ No cookie? → public route? Allow : redirect /login
    ├─ Cookie present?
    │   ├─ Query sessions table: token match + expires_at > now()
    │   ├─ Session not found or expired?
    │   │   ├─ Clear cookie
    │   │   └─ Redirect /login
    │   ├─ Session valid → query users table: status check
    │   │   ├─ user.status === 'suspended'?
    │   │   │   ├─ Delete session from DB
    │   │   │   ├─ Clear cookie
    │   │   │   └─ Redirect /login
    │   │   ├─ user.status === 'active'?
    │   │   │   ├─ Admin route + user.role !== 'admin'? → 403
    │   │   │   └─ Allow through ✓
    │   │   └─ Attach user context to request headers
    │   └─ (Session lookup uses Supabase service key, server-side only)
    │
    └─ Public routes (bypass auth):
        /, /login, /request-access, /invite/:code,
        /auth/verify, /auth/verify-email, /auth/set-password,
        /api/auth/* (includes /api/auth/check-email),
        /api/config, /api/instance-prompts, /api/openrouter-models,
        /_next/*, /favicon.ico, static assets

    Protected API routes (require session):
        /api/chat-stream, /api/chat, /api/test-connection,
        /api/session-start, /api/admin/*
```


---

## 4. Page & Route Structure

### 4.1 Pages

> **Updated 2026-03-13:** Added `/` (landing page) and `/app` (protected app UI). The root path now renders a public landing page with a smart login modal, while the full app UI lives at `/app` behind auth.

| Route | Component | Auth Required | Purpose |
|-------|-----------|---------------|---------|
| `/` | `LandingPage` | No | Public landing page with hero, features, CTA, smart login modal |
| `/app` | `Home` | **Yes** | Full app UI — chat, settings, phase tracker (moved from `/`) |
| `/login` | `LoginPage` | No | Email + password form, "Forgot password?" link (fallback) |
| `/request-access` | `RequestAccessPage` | No | Name, email, company, use_case form (standalone fallback) |
| `/auth/verify` | `VerifyPage` | No | Magic link landing — validates token |
| `/auth/verify-email` | `VerifyEmailPage` | No | Email verification landing |
| `/auth/set-password` | `SetPasswordPage` | Temp session | Set password form (min 8 chars) |
| `/invite/[code]` | `InvitePage` | No | Invite code registration form |
| `/admin` | `AdminDashboard` | Admin only | Approve/reject requests, manage users, invite codes |

### 4.2 API Routes

> **Updated 2026-03-13:** Added `check-email` endpoints for the smart login flow. Moved `/api/chat-stream`, `/api/chat`, `/api/test-connection`, `/api/session-start` behind auth.

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/auth/check-email` | POST | No | Check email existence, set HMAC hint cookie (anti-enumeration) |
| `/api/auth/check-email/step` | GET | No | Read hint cookie, return next step (password or request) |
| `/api/auth/request-access` | POST | No | Submit access request |
| `/api/auth/verify-email` | POST | No | Verify email token |
| `/api/auth/verify-magic-link` | POST | No | Validate magic link, create session |
| `/api/auth/login` | POST | No | Email + password login |
| `/api/auth/set-password` | POST | Temp session | Set/reset password |
| `/api/auth/forgot-password` | POST | No | Request password reset magic link |
| `/api/auth/logout` | POST | Yes | Clear session |
| `/api/auth/register-invite` | POST | No | Register via invite code |
| `/api/chat-stream` | POST | **Yes** | AI chat (streaming) — moved behind auth |
| `/api/chat` | POST | **Yes** | AI chat (non-streaming) — moved behind auth |
| `/api/test-connection` | POST | **Yes** | Test SN connection — moved behind auth |
| `/api/session-start` | POST | **Yes** | Log session telemetry — moved behind auth |
| `/api/config` | GET | No | Server config (feature flags, SN creds check) |
| `/api/instance-prompts` | POST | No | Instance-specific example prompts |
| `/api/openrouter-models` | GET | No | Available OpenRouter models |
| `/api/admin/requests` | GET | Admin | List access requests |
| `/api/admin/requests/[id]` | PATCH | Admin | Approve/reject a request |
| `/api/admin/users` | GET | Admin | List users |
| `/api/admin/users/[id]` | PATCH | Admin | Suspend/activate user |
| `/api/admin/invite-codes` | GET, POST | Admin | List/create invite codes |
| `/api/admin/invite-codes/[id]` | PATCH | Admin | Revoke invite code |

### 4.3 Modified Existing Routes

> **Updated 2026-03-13:** Reflects landing page + smart login flow changes.

| Route / File | Change |
|-------|--------|
| `proxy.ts` | Removed `/api/chat-stream`, `/api/chat`, `/api/test-connection`, `/api/session-start` from `PUBLIC_PATHS` |
| `page.tsx` | Replaced `Home` component with `LandingPage` import |
| `app/app/page.tsx` | **New** — renders `Home` component (moved from `page.tsx`) |
| `login/page.tsx` | Default redirect changed from `"/"` to `"/app"` |
| `auth/set-password/page.tsx` | Fallback redirect changed to `"/app"` |
| `api/auth/set-password/route.ts` | Response redirect changed to `"/app"` |
| `api/auth/verify-magic-link/route.ts` | Response redirect changed to `"/app"` |
| `auth/verify/page.tsx` | Fallback redirect changed to `"/app"` |
| `invite/[code]/page.tsx` | `router.push("/")` changed to `router.push("/app")` |

---

## 5. Data Model (Supabase)

### 5.1 Tables

#### `users`

| Column | Type | Nullable | Default | Constraints | Description |
|--------|------|----------|---------|-------------|-------------|
| id | uuid | No | gen_random_uuid() | PK | |
| email | text | No | | UNIQUE | Lowercase, trimmed |
| name | text | No | | | Display name |
| password_hash | text | Yes | null | | bcrypt hash, null until password set |
| role | text | No | 'user' | CHECK (user, admin) | |
| status | text | No | 'active' | CHECK (active, suspended) | |
| must_set_password | boolean | No | true | | Cleared after first password set |
| created_at | timestamptz | No | now() | | |
| last_login | timestamptz | Yes | null | | Updated on each login |

**Indexes:** `users_email_idx` UNIQUE on `lower(email)`

#### `access_requests`

| Column | Type | Nullable | Default | Constraints | Description |
|--------|------|----------|---------|-------------|-------------|
| id | uuid | No | gen_random_uuid() | PK | |
| email | text | No | | UNIQUE | |
| name | text | No | | | |
| company | text | Yes | null | | |
| use_case | text | No | | | Why they want access |
| status | text | No | 'pending_verification' | CHECK (pending_verification, pending, approved, rejected) | |
| email_verified | boolean | No | false | | |
| created_at | timestamptz | No | now() | | |
| reviewed_at | timestamptz | Yes | null | | |
| reviewed_by | text | Yes | null | | Admin email |

**Indexes:** `access_requests_email_idx` UNIQUE on `lower(email)`, `access_requests_status_idx` on `status`

#### `sessions`

| Column | Type | Nullable | Default | Constraints | Description |
|--------|------|----------|---------|-------------|-------------|
| id | uuid | No | gen_random_uuid() | PK | |
| user_id | uuid | No | | FK→users ON DELETE CASCADE | |
| token | text | No | | UNIQUE | 96-char hex (48 random bytes) |
| is_temporary | boolean | No | false | | True for set-password flow (15 min TTL) |
| expires_at | timestamptz | No | | | |
| created_at | timestamptz | No | now() | | |
| ip_address | text | Yes | null | | For audit |
| user_agent | text | Yes | null | | For audit |

**Indexes:** `sessions_token_idx` UNIQUE on `token`, `sessions_user_id_idx` on `user_id`, `sessions_expires_at_idx` on `expires_at`

#### `auth_tokens`

| Column | Type | Nullable | Default | Constraints | Description |
|--------|------|----------|---------|-------------|-------------|
| id | uuid | No | gen_random_uuid() | PK | |
| user_id | uuid | Yes | null | FK→users ON DELETE CASCADE | Null for email verify (user doesn't exist yet) |
| email | text | No | | | For email verify tokens where user_id is null |
| token | text | No | | UNIQUE | 96-char hex (48 random bytes) |
| type | text | No | | CHECK (magic_link, email_verify, password_reset) | |
| expires_at | timestamptz | No | | | magic_link/reset: 72h, email_verify: 24h |
| used_at | timestamptz | Yes | null | | Set on first use, prevents reuse |
| created_at | timestamptz | No | now() | | |

**Indexes:** `auth_tokens_token_idx` UNIQUE on `token`, `auth_tokens_email_type_idx` on `(email, type)`

#### `invite_codes`

| Column | Type | Nullable | Default | Constraints | Description |
|--------|------|----------|---------|-------------|-------------|
| id | uuid | No | gen_random_uuid() | PK | |
| code | text | No | | UNIQUE | 24-char crypto random |
| created_by | uuid | No | | FK→users | Admin who created |
| label | text | Yes | null | | Admin note ("for conference", etc.) |
| max_uses | int | Yes | null | | Null = unlimited |
| times_used | int | No | 0 | | |
| expires_at | timestamptz | Yes | null | | Null = never expires |
| is_active | boolean | No | true | | Admin can revoke |
| created_at | timestamptz | No | now() | | |

**Indexes:** `invite_codes_code_idx` UNIQUE on `code`

### 5.2 Supabase RLS

Row Level Security is **disabled** on all tables. All queries go through the `SUPABASE_SERVICE_KEY` (service_role) on the server side. The Supabase client is **never exposed to the browser** — no `NEXT_PUBLIC_SUPABASE_*` keys exist.

---

## 6. Security Hardening

### 6.1 Session Cookie

| Flag | Value | Reason |
|------|-------|--------|
| `HttpOnly` | `true` | JS can't read — prevents XSS token theft |
| `Secure` | `true` in prod, `false` in dev | HTTPS only in production |
| `SameSite` | `Lax` | Blocks cross-origin POST (CSRF prevention) |
| `Path` | `/` | Available across the app |
| `Max-Age` | `SESSION_MAX_AGE_DAYS × 86400` | 1 day = 86400 seconds |

### 6.2 Password Security

- **bcrypt** with cost factor 12 (~250ms per hash)
- Minimum 8 characters, must contain at least 1 letter and 1 number (server-side enforced)
- No plaintext passwords ever stored or logged
- `ADMIN_PASSWORD_HASH` in `.env` is pre-generated bcrypt hash

### 6.3 Token Security

- All tokens: 48 bytes of `crypto.randomBytes()`, hex-encoded → 96 characters
- Invite codes: 12 bytes → 24 characters (shorter for shareability)
- One-time use: `used_at` timestamp set on consumption, checked before acceptance
- Expiry checked server-side against `expires_at`

### 6.4 Brute Force Protection

> **Updated 2026-03-13:** Added email lookup rate limiter for the smart login flow.

| Target | Limit | Window | Key |
|--------|-------|--------|-----|
| Login (`/api/auth/login`) | 5 attempts | 15 min | email |
| Magic link request (`/api/auth/forgot-password`) | 3 requests | 1 hour | email |
| Request access (`/api/auth/request-access`) | 10 requests | 1 hour | IP |
| Invite code registration (`/api/auth/register-invite`) | 10 attempts | 1 hour | IP |
| **Email lookup (`/api/auth/check-email`)** | **20 requests** | **15 min** | **IP** |

Implementation: In-memory map with sliding window (same pattern as existing `rate-limiter.ts`). Keyed by email or IP depending on endpoint.

### 6.5 User Enumeration Prevention

> **Updated 2026-03-13:** Added HMAC-signed cookie approach for the smart email-first login flow.

| Endpoint | Response (regardless of email existence) |
|----------|------------------------------------------|
| **Email check (`/api/auth/check-email`)** | **Always `{ continue: true }`. Account existence encoded in HMAC-signed HttpOnly cookie (see Section 3.4).** |
| Login | "Invalid email or password" |
| Forgot password | "If this email is registered, you'll receive a link" |
| Request access | "We've received your request" (silently deduplicates) |

### 6.6 Suspend = Instant Lockout

When admin sets `user.status = 'suspended'`:
- Next request from that user → middleware checks `user.status`
- Session deleted from DB, cookie cleared
- All existing sessions for that user purged: `DELETE FROM sessions WHERE user_id = :id`

### 6.7 Attack Surface Checklist

| Attack | Mitigation |
|--------|------------|
| XSS → steal session | `HttpOnly` cookie — JS can't access |
| CSRF | `SameSite=Lax` — blocks cross-origin POST |
| Brute force login | Rate limiting per email (5/15min) |
| Magic link replay | One-time use (`used_at` check) |
| Token guessing | 48 bytes entropy = 2^384 possibilities |
| Session hijacking | Cookie `Secure` flag (HTTPS only) |
| SQL injection | Supabase JS client uses parameterized queries |
| User enumeration | Uniform error messages |
| Admin impersonation | `role` stored server-side, never from client input |
| Invite code brute force | 12 bytes entropy + rate limit |

---

## 7. Email Templates (ZeptoMail)

All emails are **plain text** (HTML can be added later).

### 7.1 Email Verification (on access request)

| Field | Value |
|-------|-------|
| **Trigger** | User submits request-access form |
| **To** | Requester email |
| **Subject** | Verify your email — SN AI Agent |

**Body:**
```
Hi {name},

Please verify your email to complete your access request:

{APP_URL}/auth/verify-email?token={token}

This link expires in 24 hours.

If you didn't request this, ignore this email.

— SN AI Agent
```

### 7.2 Admin Notification (new verified request)

| Field | Value |
|-------|-------|
| **Trigger** | User verifies their email |
| **To** | `ADMIN_EMAIL` |
| **Subject** | New access request: {name} ({email}) |

**Body:**
```
New access request:

Name: {name}
Email: {email}
Company: {company}
Use case: {use_case}
Submitted: {created_at}

Review at: {APP_URL}/admin

— SN AI Agent
```

### 7.3 Access Approved (magic link)

| Field | Value |
|-------|-------|
| **Trigger** | Admin approves request |
| **To** | Approved user email |
| **Subject** | You're in — SN AI Agent |

**Body:**
```
Hi {name},

Your access request has been approved!

Click below to set up your account:

{APP_URL}/auth/verify?token={token}

This link expires in 72 hours.

— SN AI Agent
```

### 7.4 Password Reset

| Field | Value |
|-------|-------|
| **Trigger** | User clicks "Forgot Password" |
| **To** | User email |
| **Subject** | Reset your password — SN AI Agent |

**Body:**
```
Hi {name},

Click below to reset your password:

{APP_URL}/auth/verify?token={token}

This link expires in 72 hours.

If you didn't request this, ignore this email.

— SN AI Agent
```

---

## 8. `.env` Configuration (Complete)

```env
# ── Auth & Access Control ──────────────────────────────────────

# Supabase (server-side only — no NEXT_PUBLIC_ prefix)
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...

# Admin seed (auto-created on first boot if not exists)
ADMIN_EMAIL=you@example.com
ADMIN_NAME=Ratnesh Tiwari
ADMIN_PASSWORD_HASH=$2a$12$...

# Session
SESSION_COOKIE_NAME=sn-ai-session
SESSION_MAX_AGE_DAYS=1

# Magic links & tokens
MAGIC_LINK_EXPIRY_HOURS=72
EMAIL_VERIFY_EXPIRY_HOURS=24
APP_URL=https://yourapp.com

# ZeptoMail (transactional email)
ZEPTOMAIL_API_URL=https://api.zeptomail.com/v1.1/email
ZEPTOMAIL_API_KEY=Zoho-enczapikey_xxxxxxxxxxxxx
ZEPTOMAIL_FROM_EMAIL=noreply@yourdomain.com
ZEPTOMAIL_FROM_NAME=SN AI Agent
ZEPTOMAIL_BOUNCE_ADDRESS=bounce@bounce.yourdomain.com

# Brute force limits
LOGIN_MAX_ATTEMPTS=5
LOGIN_WINDOW_MINUTES=15

# Smart login flow (email-check anti-enumeration)
# Generate with: openssl rand -hex 32
AUTH_HINT_SECRET=<64-char-hex-string>

# Feature flags
REQUIRE_ACCESS_APPROVAL=true
REQUIRE_EMAIL_VERIFICATION=true
```

---

## 9. File Structure (New Files)

> **Updated 2026-03-13:** Added landing page, smart login modal, `/app` route, and check-email API endpoints.

```
webapp/src/
├── proxy.ts                          # Auth gate — intercepts all requests
├── lib/
│   ├── supabase.ts                       # Supabase server client (service_role)
│   ├── auth.ts                           # Session creation, validation, password hashing
│   ├── email.ts                          # ZeptoMail send helper
│   └── auth-rate-limiter.ts              # Brute force protection (per-endpoint, incl. email lookup)
├── components/
│   ├── LandingPage.tsx                   # Public landing page (hero, features, CTA)
│   └── ConnectModal.tsx                  # Smart email-first login modal (state machine)
├── app/
│   ├── page.tsx                          # Root route — renders LandingPage (public)
│   ├── app/page.tsx                      # /app route — renders Home (protected, auth required)
│   ├── login/page.tsx                    # Login form (fallback, redirects to /app)
│   ├── request-access/page.tsx           # Request access form (standalone fallback)
│   ├── invite/[code]/page.tsx            # Invite code registration
│   ├── auth/
│   │   ├── verify/page.tsx               # Magic link landing
│   │   ├── verify-email/page.tsx         # Email verification landing
│   │   └── set-password/page.tsx         # Set password form
│   ├── admin/page.tsx                    # Admin dashboard
│   └── api/
│       ├── auth/
│       │   ├── check-email/route.ts      # POST: email lookup + HMAC hint cookie
│       │   ├── check-email/step/route.ts # GET: read hint cookie, return next step
│       │   ├── request-access/route.ts
│       │   ├── verify-email/route.ts
│       │   ├── verify-magic-link/route.ts
│       │   ├── login/route.ts
│       │   ├── set-password/route.ts
│       │   ├── forgot-password/route.ts
│       │   ├── logout/route.ts
│       │   └── register-invite/route.ts
│       └── admin/
│           ├── requests/route.ts
│           ├── requests/[id]/route.ts
│           ├── users/route.ts
│           ├── users/[id]/route.ts
│           ├── invite-codes/route.ts
│           └── invite-codes/[id]/route.ts
```

---

## 10. Admin Dashboard (`/admin`)

### 10.1 Layout

Three tabs:

**Tab 1: Access Requests**
- Table: name, email, company, use_case, status, submitted date
- Filter: pending | approved | rejected | all
- Actions: Approve (sends magic link email), Reject
- Pending count shown as badge on tab

**Tab 2: Users**
- Table: name, email, role, status, last_login, created_at
- Actions: Suspend / Activate
- No ability to delete users (data retention)

**Tab 3: Invite Codes**
- Table: code, label, uses (times_used/max_uses), expires_at, is_active, created_at
- Actions: Create new, Revoke
- Create form: label (optional), max_uses (optional), expires_in_days (optional)
- Copy link button → copies `{APP_URL}/invite/{code}` to clipboard

### 10.2 Styling

Same theme system as the main app (dark/light mode via `ThemeProvider`). Uses existing CSS variables and design patterns from `globals.css`. No new design system — consistent with the rest of the app.

---

## 11. Admin Seed (First Boot)

On app startup (in a server-side initialization path), check:

```
1. Connect to Supabase
2. Query: SELECT * FROM users WHERE email = ADMIN_EMAIL
3. Not found?
   ├─ INSERT into users: email, name, password_hash (from ADMIN_PASSWORD_HASH),
   │   role: 'admin', status: 'active', must_set_password: false
   └─ Log: "Admin user seeded: {ADMIN_EMAIL}"
4. Found?
   └─ No-op (don't overwrite existing admin)
```

This runs in the middleware or a dedicated `/api/auth/init` route called on first load. Idempotent — safe to run on every cold start.

---

## 12. Performance Considerations

| Concern | Mitigation |
|---------|------------|
| Middleware DB query on every request | Session token → single indexed lookup. ~2ms from Supabase edge. |
| Supabase cold start | Using `@supabase/supabase-js` with persistent connection pooling |
| bcrypt latency (250ms) | Only on login/password-set, not on session validation |
| Rate limiter memory | In-memory maps, auto-cleanup of expired entries (same as existing) |

### 12.1 Indexing Strategy

| Table | Index | Type | Reason |
|-------|-------|------|--------|
| sessions | token | UNIQUE B-tree | Every request does a lookup by token |
| sessions | expires_at | B-tree | Periodic cleanup of expired sessions |
| users | email | UNIQUE B-tree (lowercase) | Login lookup |
| auth_tokens | token | UNIQUE B-tree | Magic link validation |
| invite_codes | code | UNIQUE B-tree | Invite code validation |
| access_requests | status | B-tree | Admin dashboard filtering |

---

## 13. Error Handling

| Error Scenario | Handling | User Message |
|----------------|----------|--------------|
| Supabase connection failure | Log error, return 500 | "Something went wrong. Please try again." |
| ZeptoMail send failure | Log error, still create DB records, return success | "Request submitted" (email retry can be manual) |
| Expired magic link | 400 | "This link has expired. Request a new one." |
| Used magic link | 400 | "This link has already been used." |
| Invalid invite code | 404 | "This invite link is no longer valid." |
| Duplicate email (request) | 200 (silent) | "We've received your request." |
| Duplicate email (invite register) | 400 | "An account with this email already exists. Try logging in." |
| Suspended user login | 401 | "Invalid email or password." |

---

## 14. Rollback Plan

1. Set `REQUIRE_ACCESS_APPROVAL=false` in `.env` → disables the gate, app is open again
2. Remove `proxy.ts` → all routes become unprotected
3. Database tables remain in Supabase (no data loss) — can be dropped manually if needed

---

## 15. Resolved Questions

| ID | Question | Resolution |
|----|----------|------------|
| Q-001 | Should rejected users be able to re-request? | No. UNIQUE on email stands. Rejected users cannot re-submit. |
| Q-002 | Email templates: plain text only or HTML? | Plain text to start. HTML can be added later. |
| Q-003 | Should admin be able to promote other users to admin? | No. Admin promotion only via direct DB update or `.env` seed. |

---

## Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Author | AI Agent | 2026-03-12 | ☑ |
| Approver | Ratnesh Tiwari | 2026-03-12 | ☑ |

### Approval Status

> **Status:** ☑ Approved