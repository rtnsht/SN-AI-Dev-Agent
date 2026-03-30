---
name: Custom Auth and Palantir UI
overview: Replace Supabase's built-in auth with a custom session-based authentication system (users + sessions tables, bcrypt, HTTP-only cookies), and redesign the entire UI to match Palantir's Blueprint design language using Tailwind CSS with a custom design token system.
todos:
  - id: migration-custom-auth
    content: "Create migration 003_custom_auth.sql: users table, sessions table, alter FKs from auth.users to public.users"
    status: completed
  - id: install-bcryptjs
    content: Install bcryptjs + @types/bcryptjs
    status: completed
  - id: auth-lib
    content: Create lib/auth/ with password.ts, session.ts, middleware.ts, context.ts
    status: completed
  - id: auth-types
    content: Add User, Session, and AuthUser types to lib/types/index.ts
    status: completed
  - id: auth-api-routes
    content: "Create new API routes: POST /api/auth/signup, POST /api/auth/login, POST /api/auth/logout, GET /api/auth/me; remove callback route"
    status: completed
  - id: update-middleware
    content: Rewrite root middleware.ts and lib/supabase/middleware.ts to use custom session-based auth
    status: completed
  - id: update-api-routes
    content: Update all existing API routes (feeds, subscriptions, notifications, dashboard, poll) to use getCurrentUser() instead of supabase.auth.getUser()
    status: completed
  - id: update-dashboard-layout
    content: Update app/dashboard/layout.tsx to use custom auth user check
    status: completed
  - id: tailwind-design-tokens
    content: Extend tailwind.config.ts with Blueprint color palette, typography, and spacing tokens
    status: completed
  - id: globals-css
    content: Update globals.css with CSS variables and Blueprint-like base styles
    status: completed
  - id: ui-components
    content: Create reusable UI components in components/ui/ (Button, Input, Card, Badge, Table, Toolbar, Sidebar, EmptyState)
    status: completed
  - id: redesign-sidebar
    content: Redesign DashboardNav as a collapsible Palantir-style sidebar
    status: completed
  - id: redesign-dashboard-pages
    content: Restyle all dashboard pages (overview, feeds, subscriptions, notifications) with Palantir design patterns
    status: completed
  - id: redesign-auth-pages
    content: Restyle login and signup pages with Palantir-inspired minimal design
    status: completed
  - id: cleanup
    content: Remove unused Supabase auth imports/code, verify all pages work end-to-end
    status: completed
isProject: false
---

# Custom Auth System + Palantir-Inspired UI Redesign

## Part 1: Custom Authentication & Authorization

### Current State

All auth flows use `supabase.auth.*` methods from `@supabase/ssr`. Every table references `auth.users(id)`, and RLS policies use `auth.uid()`. Files affected:

- [lib/supabase/middleware.ts](lib/supabase/middleware.ts) - route protection via `supabase.auth.getUser()`
- [lib/supabase/server.ts](lib/supabase/server.ts) - server/service clients
- [lib/supabase/client.ts](lib/supabase/client.ts) - browser client
- [app/auth/login/page.tsx](app/auth/login/page.tsx) - `signInWithPassword()`
- [app/auth/signup/page.tsx](app/auth/signup/page.tsx) - `signUp()`
- [app/api/auth/callback/route.ts](app/api/auth/callback/route.ts) - OAuth callback
- [app/dashboard/layout.tsx](app/dashboard/layout.tsx) - user check
- [components/dashboard/DashboardNav.tsx](components/dashboard/DashboardNav.tsx) - `signOut()`, `User` type
- All API route handlers that call `supabase.auth.getUser()`

### New Database Schema

New migration `003_custom_auth.sql`:

```sql
-- Custom users table
create table public.users (
  id            uuid primary key default gen_random_uuid(),
  email         text not null unique,
  password_hash text not null,
  display_name  text,
  role          text not null default 'user' check (role in ('user', 'admin')),
  email_verified boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Sessions table (stateful session management)
create table public.sessions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  token       text not null unique,
  expires_at  timestamptz not null,
  ip_address  text,
  user_agent  text,
  created_at  timestamptz not null default now()
);

create index sessions_token_idx on public.sessions(token);
create index sessions_user_id_idx on public.sessions(user_id);
create index sessions_expires_at_idx on public.sessions(expires_at);
```

Also migrate all existing FK constraints from `auth.users(id)` to `public.users(id)` in `feed_sources`, `subscriptions`, `notification_channels`, and `notification_log`.

### New Auth Library (`lib/auth/`)

- `**lib/auth/password.ts**` - `hashPassword()` and `verifyPassword()` using `bcryptjs`
- `**lib/auth/session.ts**` - `createSession()`, `validateSession()`, `deleteSession()`, `deleteAllUserSessions()` using `crypto.randomBytes()` for token generation. Sessions stored in DB with configurable TTL (default 30 days).
- `**lib/auth/middleware.ts**` - Reads `session_token` from HTTP-only cookie, validates against DB, attaches user to request context. Replaces current `updateSession()`.
- `**lib/auth/context.ts**` - `getCurrentUser()` helper for server components and API routes that reads the cookie and returns the user or null.

### Auth API Routes

Replace the current Supabase-dependent auth routes:

- `**POST /api/auth/signup**` - Validate with Zod, check email uniqueness, hash password, insert user, create session, set HTTP-only cookie
- `**POST /api/auth/login**` - Validate credentials, verify password, create session, set cookie
- `**POST /api/auth/logout**` - Delete session from DB, clear cookie
- `**GET /api/auth/me**` - Return current user from session
- Remove `app/api/auth/callback/route.ts` (no longer needed)

### Authorization Strategy

Since `auth.uid()` will no longer work for RLS, we switch to **application-level authorization**:

- All DB queries go through the **service role client** (bypasses RLS)
- Every API route and server component calls `getCurrentUser()` and filters by `user_id`
- RLS policies are retained as a defense-in-depth safety net but we also add service-role-based policies

### Dependencies

- Add: `bcryptjs` + `@types/bcryptjs`
- Keep: `@supabase/ssr` (still used for DB access, just not for auth)

### Files to Update

All API routes in `app/api/` that currently do `supabase.auth.getUser()` must switch to `getCurrentUser()`. The `DashboardNav` must use custom user type instead of `@supabase/supabase-js` User. The `middleware.ts` at root must call the new auth middleware.

---

## Part 2: Palantir-Inspired UI/UX Redesign

### Approach: Tailwind CSS + Blueprint Design Tokens

Instead of installing Blueprint.js (which has its own CSS that conflicts with Tailwind), we will **recreate the Palantir aesthetic using Tailwind** with custom design tokens extracted from Blueprint's design system. This gives us full control, lighter bundle, and tight visual fidelity.

### Design System Tokens

Extend `tailwind.config.ts` with Blueprint's color palette and spacing:

**Colors (from Blueprint dark theme):**

- Backgrounds: `bp-bg-1: #1C2127`, `bp-bg-2: #252A31`, `bp-bg-3: #2F343C`, `bp-bg-4: #383E47`
- Text: `bp-text: #F6F7F9`, `bp-text-muted: #ABB3BF`, `bp-text-disabled: #738091`
- Borders: `bp-border: rgba(255,255,255,0.15)`
- Intent colors:
  - Primary (blue): `#2D72D2` / `#215DB0` / `#4C90F0`
  - Success (green): `#238551` / `#1C6E42` / `#32A467`
  - Warning (orange): `#C87619` / `#935610` / `#EC9A3C`
  - Danger (red): `#CD4246` / `#AC2F33` / `#E76A6E`

**Typography:**

- System font stack: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif` (matches Blueprint)
- Compact sizes: 11px (small), 13px (default body), 16px (heading), 20px (page title)

**Spacing and Borders:**

- Border radius: `2px` everywhere (Blueprint's signature tight radius)
- Dense padding: `4px`, `6px`, `8px`, `10px`
- Borders: 1px white/10-15% opacity on all containers

### Key UI/UX Design Patterns (from Palantir Foundry)

- **Collapsible sidebar**: 48px icon-only mode (collapsed) / 240px expanded, with keyboard shortcut toggle
- **Top toolbar bar**: Breadcrumbs + page actions in a horizontal toolbar strip
- **Data-dense tables**: Compact row heights, monospace numbers, sortable columns
- **Intent-based actions**: Blue primary buttons, gray secondary, red destructive
- **Functional empty states**: Muted icons + concise text, no decorative illustrations
- **Card containers**: Subtle white borders, `#252A31` background, minimal shadows
- **Status indicators**: Small colored dots + text using intent colors
- **Compact forms**: Tight label-input spacing, inline validation

### Layout Architecture

```
+-------------------------------------------------------+
| [Sidebar]  | [Toolbar: Breadcrumbs | Actions]         |
| [Nav]      |-------------------------------------------|
| [Links]    | [Main Content Area]                       |
|            |   - Cards, Tables, Forms                  |
|            |   - Dense, data-focused                   |
| [User]     |                                           |
+-------------------------------------------------------+
```

### Reusable UI Components (`components/ui/`)

Create a small set of shared primitives styled to Blueprint's language:

- `Button.tsx` - with intent variants (primary, success, warning, danger, none)
- `Input.tsx` - compact input with Blueprint styling
- `Card.tsx` - container with white border
- `Badge.tsx` - status badges
- `Table.tsx` - data-dense table primitives
- `Toolbar.tsx` - horizontal action bar
- `Sidebar.tsx` - collapsible navigation shell
- `EmptyState.tsx` - non-ideal state component

### Files to Restyle

- [tailwind.config.ts](tailwind.config.ts) - add Blueprint design tokens
- [app/globals.css](app/globals.css) - CSS variables, base resets, Blueprint-like defaults
- [app/layout.tsx](app/layout.tsx) - font swap to system stack
- [components/dashboard/DashboardNav.tsx](components/dashboard/DashboardNav.tsx) - complete redesign as collapsible Palantir sidebar
- [app/dashboard/layout.tsx](app/dashboard/layout.tsx) - toolbar + sidebar layout
- [app/dashboard/page.tsx](app/dashboard/page.tsx) - overview page with dense cards/tables
- [app/dashboard/feeds/page.tsx](app/dashboard/feeds/page.tsx) - data table layout
- [app/dashboard/subscriptions/page.tsx](app/dashboard/subscriptions/page.tsx) - data table layout
- [app/dashboard/notifications/page.tsx](app/dashboard/notifications/page.tsx) - log table layout
- [app/auth/login/page.tsx](app/auth/login/page.tsx) - minimal Palantir-style login
- [app/auth/signup/page.tsx](app/auth/signup/page.tsx) - minimal Palantir-style signup

---

## Implementation Order

The auth system must come first since the UI pages depend on auth types and flows. The UI redesign follows, using the new auth types and layout patterns.