# AUTH-GATE: Technical Design Document — Invite-Only Access Gate

## Document Control

| Field | Value |
|-------|-------|
| **Requirement ID** | AUTH-GATE |
| **Spec Version** | 1.0 |
| **Author** | AI Agent |
| **Created** | 2026-03-12 |
| **Last Updated** | 2026-03-12 |
| **Version** | 1.0 |
| **Status** | Draft |

---

## 1. Solution Overview

### 1.1 Summary

Add an invite-only access gate to the SN AI Agent webapp. Visitors must either request access (reviewed and approved by an admin) or use an admin-generated invite link. Authentication uses email + password with magic-link onboarding. All user, session, and request data is stored in Supabase (Postgres). Transactional emails are sent via Zoho ZeptoMail.

### 1.2 Goals

- Gate all app access behind authentication
- Admin-controlled approval flow for new user requests
- Invite code system for direct access (bypasses approval queue)
- Magic-link onboarding with mandatory password setup on first login
- Email verification on access requests to prevent spam
- Admin dashboard inside the app at `/admin`
- All configuration via `.env` — no hardcoded secrets or settings

### 1.3 Non-Goals

- OAuth / SSO / social login (future consideration)
- Multi-tenant / org-level access control
- Self-service password change UI (future — only "forgot password" flow for now)
- Separate admin app or deploy

---

## 2. Architecture

### 2.1 System Context

```
┌─────────────┐       ┌──────────────────────────────────────────┐
│   Browser   │◄─────►│  Next.js Webapp (existing)               │
│             │       │  ┌──────────────────────────────────────┐ │
│  - Login    │       │  │  proxy.ts (auth gate)           │ │
│  - Request  │       │  │  ├── Public routes → pass through   │ │
│  - App      │       │  │  ├── Protected → check session      │ │
│  - Admin    │       │  │  └── Admin → check session + role   │ │
│             │       │  └──────────────────────────────────────┘ │
│             │       │  ┌──────────────┐  ┌──────────────────┐  │
│             │       │  │ /api/auth/*  │  │ /api/admin/*     │  │
│             │       │  └──────┬───────┘  └───────┬──────────┘  │
│             │       │         │                   │             │
└─────────────┘       └─────────┼───────────────────┼─────────────┘
                                │                   │
                     ┌──────────▼───────────────────▼──────────┐
                     │          Supabase (Postgres)            │
                     │  users · sessions · access_requests     │
                     │  auth_tokens · invite_codes             │
                     └─────────────────────────────────────────┘
                                │
                     ┌──────────▼──────────────────────────────┐
                     │        Zoho ZeptoMail API               │
                     │  Transactional emails (magic links,     │
                     │  verification, notifications)           │
                     └─────────────────────────────────────────┘
```

### 2.2 Request Flow — Middleware

```
Every HTTP request
    │
    ├── Static assets (/_next/*, favicon, images) → PASS
    │
    ├── Public routes → PASS
    │   /login, /request-access, /auth/verify, /invite/:code, /api/auth/*
    │
    ├── Admin routes (/admin/*, /api/admin/*):
    │   ├── No session cookie → redirect /login
    │   ├── Invalid/expired session → redirect /login
    │   ├── user.status != active → redirect /login
    │   ├── user.role != admin → 403
    │   └── All checks pass → ALLOW
    │
    └── All other routes (protected):
        ├── No session cookie → redirect /login
        ├── Invalid/expired session → redirect /login
        ├── user.status != active → redirect /login
        └── Valid session + active user → ALLOW
```

