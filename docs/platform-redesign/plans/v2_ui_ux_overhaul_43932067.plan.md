---
name: V2 UI/UX Overhaul
overview: Overhaul the UI/UX with a v2 "Modern" interface while preserving the current "Classic" interface, adding a user-selectable interface preference system managed by the admin -- all without changing any features.
todos:
  - id: foundation
    content: DB migration (005_user_preferences.sql), API routes for interface-themes and user preferences, TypeScript types
    status: completed
  - id: design-tokens
    content: CSS variable layers for .interface-modern and .interface-classic in globals.css, update tailwind.config.ts with Inter font, responsive screens, modern spacing/radius tokens
    status: completed
  - id: core-components
    content: Create Toast, Skeleton, ConfirmDialog, Breadcrumbs components in components/ui/
    status: completed
  - id: interface-provider
    content: Create InterfaceProvider context, wire into app/layout.tsx, apply interface class to html element
    status: completed
  - id: responsive-layout
    content: Mobile sidebar drawer, responsive grids, hamburger in header, responsive DashboardShell offset
    status: completed
  - id: page-polish-dashboard
    content: "Dashboard overview: skeleton loaders, responsive stat grid, modern card variants, breadcrumbs"
    status: completed
  - id: page-polish-feeds
    content: "Feeds + Feed detail: replace confirm() with ConfirmDialog, toast for poll/delete, skeletons, breadcrumbs, responsive table"
    status: completed
  - id: page-polish-subs-notif
    content: "Subscriptions + Notifications + History: replace confirm(), toasts, skeletons, breadcrumbs, responsive grids/tables"
    status: completed
  - id: page-polish-auth
    content: "Login, Signup, Verify pages: modern variant styling with softer cards and animations"
    status: completed
  - id: settings-appearance
    content: Add Appearance section to Settings page with interface theme picker (card selector showing available themes)
    status: completed
  - id: component-variants
    content: Update Button, Badge, Dialog, EmptyState, Pagination with modern interface variants
    status: completed
  - id: accessibility
    content: focus-visible rings, ARIA labels on icon buttons, skip-to-content link, contrast audit, prefers-reduced-motion
    status: completed
isProject: false
---

# V2 UI/UX Overhaul with Interface Preference System

## Current State Analysis

The current UI is a **Palantir Blueprint-inspired** dense interface:

- 13px base font, sizes down to 10px in many places
- 2px border radius (very sharp)
- Tight spacing, border-heavy design
- No responsive layout (fixed sidebar, no breakpoints)
- No mobile support whatsoever
- Native `confirm()` dialogs for destructive actions
- No toast/notification feedback -- poll results vanish after 5s
- No skeleton loaders (bare `Spinner` only)
- No entrance/exit animations
- No keyboard accessibility (no focus-visible, no ARIA on icon buttons)
- No breadcrumbs (except feed detail page)
- Settings page has no interface/appearance section

---

## What Changes (from different angles)

### Angle 1: Visual Design -- "Modern" Interface Variant

A new default interface that feels contemporary while the existing one stays as "Classic":


| Aspect        | Classic (current)          | Modern (v2)                             |
| ------------- | -------------------------- | --------------------------------------- |
| Base font     | 13px system stack          | 14px Inter                              |
| Border radius | 2px                        | 8px                                     |
| Spacing       | Tight (4-20px scale)       | Relaxed (4-32px scale)                  |
| Depth         | Flat + borders             | Subtle shadows + softer borders         |
| Stat cards    | Plain bordered boxes       | Gradient accent bar + soft shadow       |
| Sidebar       | Sharp, dense               | Rounded nav pills, larger touch targets |
| Colors        | Blueprint blue #2D72D2     | Slightly warmer blue, softer palette    |
| Buttons       | Flat rectangles            | Rounded, subtle hover lift              |
| Inputs        | 2px radius, border-focused | 8px radius, shadow-on-focus             |
| Cards         | Border-only                | Shadow + border-radius, hover elevation |


### Angle 2: Responsive Design (both interfaces)

- **Mobile sidebar**: Drawer/overlay on screens below `md` (768px), hamburger toggle in header
- **Responsive grids**: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` for stat cards
- **Stacked layouts on mobile**: Feed rows, subscription rows become full-width cards
- **Tables**: Horizontal scroll wrapper + priority column hiding on small screens
- **Touch-friendly**: Larger tap targets (min 44px) on mobile

### Angle 3: Micro-interactions & Feedback

- **Toast system**: Replace `setTimeout` poll result and all transient feedback with a stacking toast
- **Skeleton loaders**: Pulse-animated placeholders instead of centered `Spinner` on initial page load
- **Confirmation dialog**: Replace every `confirm()` call with the existing `Dialog` component styled as a confirmation
- **Transition animations**: Fade-in on page content mount, slide-in on sidebar items
- **Button states**: Loading spinner inside button, subtle scale on press

### Angle 4: Accessibility & Readability

- Minimum 12px text anywhere (eliminate 10px/11px for body content; keep only for non-essential meta)
- `focus-visible` ring on all interactive elements
- `aria-label` on all icon-only buttons (delete, sign-out, toggle sidebar)
- Skip-to-content link
- Sufficient color contrast ratios (WCAG AA)
- Reduced-motion media query for animations

### Angle 5: Navigation & Wayfinding

- **Breadcrumbs on every dashboard page** (not just feed detail)
- **Active header**: Show current page title + subtitle in the top bar
- **Keyboard shortcuts panel**: `?` to open, listing available shortcuts
- **Sidebar section grouping**: "Main" (Overview, Feeds, Subscriptions) and "Notifications" (Channels, History) groups with subtle dividers

### Angle 6: Component Polish

- **Empty states**: Illustration-style SVGs, guided primary CTA button
- **Badge redesign**: Pill-shaped in Modern, configurable per interface
- **Dialog**: Smooth scale-in animation, better backdrop blur
- **Pagination**: Show total count, "Showing X-Y of Z" text

---

## Interface Preference System

### Database

New migration `005_user_preferences.sql`:

```sql
-- Admin-configured interface options
CREATE TABLE interface_themes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,        -- 'classic', 'modern'
  label TEXT NOT NULL,               -- 'Classic (Dense)', 'Modern'
  description TEXT,
  css_variables JSONB NOT NULL DEFAULT '{}',
  is_default BOOLEAN NOT NULL DEFAULT false,
  enabled BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User preference (one row per user)
CREATE TABLE user_preferences (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  interface_theme_slug TEXT REFERENCES interface_themes(slug),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed the two interfaces
INSERT INTO interface_themes (slug, label, description, is_default, enabled, sort_order, css_variables)
VALUES
  ('classic', 'Classic', 'Dense, Blueprint-style interface optimized for information density', false, true, 1, '{}'),
  ('modern', 'Modern', 'Contemporary interface with relaxed spacing and softer visuals', true, true, 0, '{}');
```

### API Routes

- `GET /api/interface-themes` -- list enabled themes (public to authenticated users)
- `GET /api/user/preferences` -- get current user preference
- `PATCH /api/user/preferences` -- update preference (body: `{ interface_theme_slug }`)
- Admin routes (future, behind role check): `POST/PATCH/DELETE /api/admin/interface-themes`

### Frontend Architecture

```
components/
  InterfaceProvider.tsx        -- Context: loads user pref, provides current theme slug
  ThemeProvider.tsx             -- (existing) enhanced to also apply interface CSS vars
  
app/globals.css                -- Add .interface-modern { ... } variable overrides
app/globals-modern.css         -- (optional) modern-specific component styles

components/ui/
  Button.tsx                   -- Add variant classes per interface
  Badge.tsx                    -- Pill vs sharp based on interface
  Dialog.tsx                   -- Add animation variants
  Toast.tsx                    -- NEW: toast notification component
  Skeleton.tsx                 -- NEW: skeleton loader component
  ConfirmDialog.tsx            -- NEW: replaces native confirm()
  Breadcrumbs.tsx              -- NEW: reusable breadcrumb component
```

**How interface switching works:**

1. `InterfaceProvider` fetches user preference on mount, applies `interface-classic` or `interface-modern` class to `<html>`
2. CSS variables are swapped via these classes in `globals.css`
3. Components read the interface context for layout variants (e.g., sidebar pill shape, card shadow)
4. User picks interface in Settings > Appearance section -- change takes effect immediately

### Settings Page -- New "Appearance" Section

Add a section to `[app/dashboard/settings/page.tsx](app/dashboard/settings/page.tsx)` above Profile:

- **Interface** dropdown/card selector showing available themes with preview thumbnails
- **Theme** (dark/light/system) -- moved from sidebar to here as well (keep sidebar toggle as shortcut)

---

## Files to Create / Modify

### New files

- `supabase/migrations/005_user_preferences.sql`
- `app/api/interface-themes/route.ts`
- `app/api/user/preferences/route.ts`
- `components/InterfaceProvider.tsx`
- `components/ui/Toast.tsx`
- `components/ui/Skeleton.tsx`
- `components/ui/ConfirmDialog.tsx`
- `components/ui/Breadcrumbs.tsx`
- `app/globals-modern.css` (modern interface variable overrides and component styles)

### Modified files

- `app/globals.css` -- add interface CSS variable layers, focus-visible, animations, responsive utilities
- `tailwind.config.ts` -- add screens, new spacing/radius tokens, Inter font
- `app/layout.tsx` -- wrap with InterfaceProvider, import Inter font
- `app/dashboard/layout.tsx` -- responsive sidebar logic, breadcrumbs in header, mobile hamburger
- `components/dashboard/DashboardNav.tsx` -- responsive drawer, section grouping, modern variant styling
- `components/dashboard/DashboardShell.tsx` -- responsive offset
- `components/ui/Button.tsx` -- modern variant classes
- `components/ui/Badge.tsx` -- pill variant
- `components/ui/Dialog.tsx` -- animation, backdrop blur
- `components/ui/EmptyState.tsx` -- better illustrations
- `components/ui/Pagination.tsx` -- "Showing X of Y" text
- `app/dashboard/page.tsx` -- skeleton loader, responsive grid, modern stat cards
- `app/dashboard/feeds/page.tsx` -- replace confirm(), add toast, skeleton, breadcrumbs
- `app/dashboard/feeds/[id]/page.tsx` -- skeleton, responsive table
- `app/dashboard/subscriptions/page.tsx` -- replace confirm(), skeleton, breadcrumbs
- `app/dashboard/notifications/page.tsx` -- responsive grid, skeleton, breadcrumbs
- `app/dashboard/notifications/log/page.tsx` -- responsive table, breadcrumbs
- `app/dashboard/settings/page.tsx` -- add Appearance section with interface picker
- `app/auth/login/page.tsx` -- modern variant styling
- `app/auth/signup/page.tsx` -- modern variant styling
- `app/auth/verify/page.tsx` -- modern variant styling
- `lib/types.ts` -- add InterfaceTheme, UserPreferences types

---

## Implementation Order

Work proceeds in layers to keep the app working at every step:

1. **Foundation** -- DB migration, API routes, types, InterfaceProvider
2. **Design tokens** -- CSS variable layers for modern interface, Tailwind config
3. **Core components** -- Toast, Skeleton, ConfirmDialog, Breadcrumbs
4. **Responsive layout** -- Sidebar drawer, responsive grids, header changes
5. **Page-by-page polish** -- Apply skeletons, toasts, breadcrumbs, modern styling to each page
6. **Settings UI** -- Appearance section with interface picker
7. **Accessibility pass** -- focus-visible, ARIA, contrast, reduced motion

