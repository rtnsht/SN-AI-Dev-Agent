# Hero logo: centering + orbital animation

**Status:** Implemented  
**Date:** 2026-03-21  

## Goals

1. **Center** the logo in the main chat empty state on all breakpoints (not only `sm+`).
2. **Animate** orbital ellipses and a subtle inner-ring pulse using an inline SVG derived from `webapp/public/logo-r-v10.svg`.
3. Keep **QHD / high-DPI** quality: vector fidelity, `shape-rendering: geometricPrecision`, **transform-only** motion on orbit groups (no animated filters on rotating layers).

## Scope

| In scope | Out of scope (v1) |
|----------|---------------------|
| Chat empty state + landing hero | SMIL `animateMotion` for dots on paths |
| Static `<Image>` everywhere else | Animating 32px header logo |
| | Project-wide PNG/JPEG replacement |

## Behavior

- **`AppLogo`** (`webapp/src/components/AppLogo.tsx`): inline SVG; `idPrefix` prop namespaces `<defs>` (`linearGradient`, `filter`, etc.).
- **Motion** (`webapp/src/app/globals.css`):
  - `.app-logo-orbit-a` — **90s** `ease-in-out` (gentle float, not mechanical)
  - `.app-logo-orbit-b` — **120s** `ease-in-out` reverse
  - `.app-logo-inner-ring` — opacity pulse **5s** (range 0.50–0.68, subtle breathe)
  - `@media (prefers-reduced-motion: reduce)` disables all three.
- **Accent dots** live inside their nearest orbital `<g>` group, so they drift with the rings naturally:
  - **orbit-a:** `(364,172)` pair, `(98,198)` pair, `(328,100)`, `(178,130)`
  - **orbit-b:** `(418,318)`, `(148,378)`, `(390,390)`
- **Trigger:** Animation runs continuously while the hero is visible (CSS-only, GPU-composited `transform`). The `<AppLogo>` unmounts when chat replaces the empty state, so no idle cost.
- **Layout** (`webapp/src/components/ChatWindow.tsx`): empty-state column uses `justify-center` + `py-6` / `min-h-0` so the hero block is vertically centered when it fits; still scrolls on short viewports.

## Files

| File | Role |
|------|------|
| `webapp/src/components/AppLogo.tsx` | Inline hero logo |
| `webapp/src/components/ChatWindow.tsx` | Empty state: `AppLogo`, centered layout |
| `webapp/src/components/LandingPage.tsx` | Landing hero: `AppLogo` |
| `webapp/src/app/globals.css` | Keyframes + reduced-motion |
| `webapp/public/logo-r-v10.svg` | Canonical static asset (keep in sync with `AppLogo` markup) |

## Maintenance

When updating brand artwork, edit **`logo-r-v10.svg`** and mirror the same structure in **`AppLogo.tsx`** (comment in component file).
