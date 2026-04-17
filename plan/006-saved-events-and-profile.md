# Plan 006: Saved Events, Zustand Store & Profile Page
Status: Complete

---

## Current State (end of Plan 005)

- "INTERESTED" toggle exists on each `EventCard` with a rewarding Framer Motion pop.
- `savedIds` is a local `Set` in `HomePage` — it is lost on navigation or refresh.
- `/map`, `/post`, `/profile` routes in `App.jsx` don't exist yet — tapping those BottomNav tabs leads to a blank page.
- No global state: the filter style and saved events can't be read from any other page.
- The PROFILE tab is the natural home for "My Saved Events" — it's one of the four main nav pillars.

---

## Goals

1. **Zustand Store** — lift `savedIds` (and optionally `styleFilter`) into a global store with `localStorage` persistence.
2. **Profile / Saved Page** — build the `/profile` route: shows saved events in a compact list, an empty state when nothing is saved, and a small user identity placeholder.
3. **Map & Post stubs** — wire `/map` and `/post` to clean placeholder pages so the BottomNav never dead-ends.
4. **Saved count badge** — show a small amber count chip on the PROFILE BottomNav icon when events are saved.

---

## Architectural Decisions

---

### Decision 1 — What goes in the Zustand store?

**Option A: Saved events only**
- Store: `{ savedIds: Set<string>, toggleSave, isSaved }`
- `styleFilter` stays local in `HomePage` — it's not needed cross-page.
- Simpler store, narrowest scope.

**Option B: Saved events + active style filter**
- Store: `{ savedIds, toggleSave, isSaved, styleFilter, setStyleFilter }`
- Benefit: navigating away from HomePage and back restores the selected filter.
- Small extra slice, but the filter UX improvement is noticeable.

> **Recommendation: Option B** — persisting the style filter costs one extra field and makes the app feel more stateful/native. The store stays small.

**→ Pick one:**
- [ ] A — Saved events only
- [* ] B — Saved events + style filter ← recommended

---

### Decision 2 — Profile page identity section

**Option A: Static placeholder header**
- Avatar circle with initials "DW" + "Dance Enthusiast" subtitle.
- No auth, no editing. Just a visual frame for the saved list.
- Clean, shippable in this plan.

**Option B: Editable nickname (localStorage)**
- Tapping the name opens an inline input. Name persists to `localStorage`.
- Slightly more interactive; still no real auth.
- Adds ~1 step of complexity.

> **Recommendation: Option A** — auth/profiles are a future plan. This plan's job is to surface saved events. The header just needs to exist.

**→ Pick one:**
- [*] A — Static placeholder header ← recommended
- [ ] B — Editable nickname

---

## Atomic Steps

### Step 1 — Install Zustand
- `npm install zustand` in `app/danzway`.

### Step 2 — Create the app store
- New file: `src/store/useAppStore.js`
- Slices:
  - `savedIds`: `Set<string>`, default empty
  - `toggleSave(id)`: add/remove from set
  - `isSaved(id)`: boolean helper
  - `styleFilter`: `'all'`, setter `setStyleFilter`
- Persist `savedIds` and `styleFilter` to `localStorage` via Zustand's `persist` middleware.
- `Set` is not JSON-serializable — use a custom `storage` serializer (serialize Set → Array, deserialize Array → Set).
- **Files:** `src/store/useAppStore.js` (new)

### Step 3 — Migrate HomePage to the store
- Remove `savedIds` state and `handleToggleSave` from `HomePage`.
- Remove `styleFilter` state from `HomePage`; read/write from store instead.
- `StyleFilterRow` still receives `active` + `onSelect` as props (no change to that component).
- **Files:** `src/pages/HomePage.jsx`

### Step 4 — Migrate EventCard / EventList to the store
- Remove `saved` and `onToggleSave` props from `EventCard` and `EventList`.
- Each `EventCard` reads `isSaved(id)` and calls `toggleSave(id)` directly from the store.
- Removes the prop-drilling chain entirely.
- **Files:** `src/components/events/EventCard.jsx`, `src/components/events/EventList.jsx`

### Step 5 — Build ProfilePage
- New file: `src/pages/ProfilePage.jsx` + `ProfilePage.module.css`
- Layout (top to bottom):

```
[ Avatar circle — amber gradient, initials "DW" ]
[ "Dance Enthusiast"  subtitle ]
[ ── divider ── ]
[ Section header: "❤ Saved Events"  +  count chip ]
[ Saved event list — compact EventCard variant ]
[ Empty state — when nothing saved ]
```

- Saved event list: reuse a new `SavedEventRow` sub-component (not the full `EventCard` — just a one-line row: title + date + location + amber "View" arrow link to `/events/:id`).
- Empty state: icon + "Tap ♡ on any event to save it here."
- **Files:** `src/pages/ProfilePage.jsx`, `src/pages/ProfilePage.module.css`

### Step 6 — Saved count badge on BottomNav PROFILE tab
- Read `savedIds.size` from the store in `BottomNav`.
- When `> 0`, render a small amber pill badge on top-right of the PROFILE icon.
- **Files:** `src/components/layout/BottomNav.jsx`, `src/components/layout/BottomNav.module.css`

### Step 7 — Wire all routes in App.jsx
- Add `/profile` → `ProfilePage`
- Add `/map` → `MapPage` (stub)
- Add `/post` → `PostPage` (stub)
- Stubs: centered icon + "Coming Soon" text in the brand style. No blank-page dead ends.
- **Files:** `src/App.jsx`, `src/pages/MapPage.jsx`, `src/pages/PostPage.jsx`

### Step 8 — Build check
- `npm run build` — zero errors.

---

## Files Created / Modified

| File | Change |
|------|--------|
| `src/store/useAppStore.js` | New — Zustand store with persist |
| `src/pages/HomePage.jsx` | Migrate state to store |
| `src/components/events/EventCard.jsx` | Read store directly, remove props |
| `src/components/events/EventList.jsx` | Remove savedIds/onToggleSave props |
| `src/pages/ProfilePage.jsx` | New — saved events + identity header |
| `src/pages/ProfilePage.module.css` | New |
| `src/components/layout/BottomNav.jsx` | Add saved count badge |
| `src/components/layout/BottomNav.module.css` | Badge styles |
| `src/App.jsx` | Add /profile, /map, /post routes |
| `src/pages/MapPage.jsx` | New — Coming Soon stub |
| `src/pages/PostPage.jsx` | New — Coming Soon stub |

---

## Out of Scope (deferred)

- Real map embed — Plan 007
- Real auth / user accounts — future
- Post / upload event form — future
- Full route transition animations — Plan 007 (polish)

---

**Check one box for Decision 1 and one for Decision 2, then tell me to proceed.**
