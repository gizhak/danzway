# Plan 013: Admin Mode & UX Cleanup

**Branch:** `f-111-intractive-map`  
**Status:** Completed

---

## Overview

Pivot to a **Curated Feed** model. The app becomes a read-only discovery tool for regular users. Post and Profile features are hidden until launch. The Venues admin dashboard remains fully accessible — but only on admin builds. Three clean public tabs survive for Beta.

---

## Key Requirements

### Public navigation (3 tabs)
Regular users see only: **Clubs · Parties · Map**

Post and Profile tabs are removed from the nav. Their routes redirect to `/` so direct-link visitors don't hit a blank page.

### Admin navigation (4 tabs)
When `VITE_IS_ADMIN=true` in `.env.local`, a fourth **Venues** tab appears. The `/admin/venues` route is also only registered in the router when this flag is set — two layers of protection:
1. The tab never appears in the nav for non-admin builds.
2. The route itself does not exist, so direct URL access returns a 404.

### Code hygiene
- `PostPage` and `ProfilePage` imports are commented out in `App.jsx` — Vite excludes them from the production bundle while the source is preserved for future activation.
- `ProfilePage` and `PostPage` routes replaced with `<Navigate to="/" replace />` — no dead ends.
- `selectSavedCount` selector import removed from `BottomNav` (was only used for the Profile badge).

### Language toggle
Already implemented in Plan 012 — `langBtn` pill in the top `<header>` at `inset-inline-end: 1.25rem`, replacing the dancer emoji. No further changes needed.

---

## Files Changed

| File | Change |
|------|--------|
| `src/components/layout/BottomNav.jsx` | Removed post/profile items; split into `PUBLIC_NAV` + `ADMIN_NAV` arrays; removed `selectSavedCount` import |
| `src/App.jsx` | Commented out Post/Profile imports; replaced their routes with `<Navigate to="/" replace />`; `VenueDiscoveryPage` route still guarded by `IS_ADMIN` |

---

## Admin Access

Set `VITE_IS_ADMIN=true` in `.env.local` on your device. This:
- Adds the Venues tab to the bottom nav.
- Registers the `/admin/venues` route.
- Shows the Refresh button on VenueDetailPage.
- Shows the Refresh Metadata button on EventDetailPage.

No other build or user can reach any of these surfaces.

---

## Re-enabling Post / Profile

1. Uncomment the two imports in `App.jsx`.
2. Replace the `<Navigate>` routes with the real `<ProfilePage />` and `<PostPage />` elements.
3. Add the items back to `PUBLIC_NAV` in `BottomNav.jsx`.
