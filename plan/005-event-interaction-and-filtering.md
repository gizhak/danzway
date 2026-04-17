# Plan 005: Event Interaction & Filtering
Status: Complete

---

## Current State (end of Plan 004)

- `StyleFilterRow` renders correctly but clicking a bubble does nothing visible — `HomePage` already wires `active`/`onSelect` props but the filter logic was scaffolded, not verified end-to-end.
- `EventDetailPage` exists at `/events/:id` but is plain/unstyled — just a title, meta text, badge row, description, price, and a generic "Get Tickets" button. No image, no map, no WhatsApp CTA.
- `EventCard` has no link to `/events/:id` — tapping a card doesn't navigate anywhere.
- No global state manager. State lives only in `HomePage` (query + styleFilter). "Saved Events" doesn't exist yet.
- No animation library installed.

---

## Goals

1. **Filtering Logic** — make StyleFilterRow visually and functionally correct end-to-end.
2. **Event Details Page** — full premium redesign of `EventDetailPage`.
3. **State Management** — decide on Zustand vs. local state for this plan.
4. **Animations** — decide on Framer Motion scope for this plan.

---

## Architectural Decisions

---

### Decision 1 — State Management: Zustand now or later?

**Option A: Zustand now**
- Install `zustand`. Create a `useAppStore` with `filteredStyle` and `savedEvents` (Set of event IDs).
- `StyleFilterRow` reads/writes store directly — no prop drilling.
- "INTERESTED" button on each `EventCard` toggles saved state; persisted via `localStorage` middleware.
- Unblocks "Saved" tab on BottomNav in a future plan.

**Option B: Stay with local state (lift later)**
- Keep `styleFilter` in `HomePage` via `useState` — it's already there and works.
- Pass `savedIds` down from `HomePage` as well (still just prop drilling one level).
- Defer Zustand to Plan 006 when the "Saved" tab actually needs cross-page state.
- Less setup now; small refactor later when the store is truly needed.

> **Recommendation: Option B** — The filter already lives in `HomePage` and works. Zustand is only justified when state genuinely crosses page boundaries (Saved Events tab). Introducing it now for a single-page filter is over-engineering. We add it in Plan 006 when the PROFILE/SAVED view is built.

**→ Pick one:**
- [ ] A — Zustand now
- [ *] B — Local state, Zustand in Plan 006 ← recommended

---

### Decision 2 — Framer Motion: full or targeted?

**Option A: Full page transitions**
- Wrap `<Routes>` with `<AnimatePresence>`. Every page enter/exit gets a fade+slide.
- `EventList` items animate in with a stagger effect on mount/filter change.
- Requires restructuring `App.jsx` routing slightly for `AnimatePresence` key prop.

**Option B: Targeted — Detail page hero only**
- Animate only the Detail page hero image + content block (shared-element-style entrance).
- `EventList` uses a simple CSS fade when filter changes (no JS animation library needed for that).
- Simpler install; less risk of layout jank on low-end devices.

**Option C: Skip Framer Motion this plan**
- Focus budget on the Detail page content and filtering correctness.
- Add animations as a dedicated "polish" plan (e.g., Plan 007).

> **Recommendation: Option B** — Targeted motion on the Detail page gives a premium feel where it matters most (the money shot) without the complexity of full route transitions. The filter update already feels snappy with CSS.

**→ Pick one:**
- [ ] A — Full page transitions + list stagger
- [* ] B — Detail page hero animation only ← recommended
- [ ] C — No animations this plan

---

## Atomic Steps

### Step 1 — Wire EventCard → Detail Page navigation
- Wrap the card image (and/or title) in a `<Link to={/events/${event.id}}>` from `react-router-dom`.
- The rest of the card (WhatsApp button, action buttons) must remain non-navigating — use `e.stopPropagation()` on those.
- **Files:** `EventCard.jsx`, `EventCard.module.css`

### Step 2 — Verify & smoke-test StyleFilterRow filtering
- The `filterEvents` function in `HomePage.jsx` is already written. Confirm it works with the current `mockEvents` data (styles array uses title-case e.g. `"Salsa"`, filter IDs are `"Salsa"` — should match).
- Confirm the active bubble gets the amber ring visually.
- Fix any mismatch if found.
- **Files:** `HomePage.jsx`, `StyleFilterRow.jsx`, `StyleFilterRow.module.css`

### Step 3 — Add `whatsapp` field to mockEvents
- Each event needs a dedicated WhatsApp number or group link for the Detail page CTA.
- Add `whatsapp: "972501234567"` (dummy Israeli number) to each event in `mockEvents.js`.
- **Files:** `mockEvents.js`

### Step 4 — Redesign EventDetailPage layout
Full premium redesign. New structure (top to bottom):

```
[ Back arrow ]
[ Hero Image — full-width, 16:9, with gradient overlay ]
  [ Date badge pinned top-right of image ]
[ Title — large, white ]
[ Meta row: 📅 date · time  |  📍 venue, city ]
[ Dance style badges ]
[ Description — readable body text ]
[ Price chip — amber, right-aligned ]
[ ── divider ── ]
[ Map Placeholder — rounded card, "📍 View on Google Maps" label ]
[ WhatsApp CTA button — full width, green-ish or amber, opens wa.me link ]
```

- Map placeholder: a styled `<div>` with a map pin icon and venue text. No real map API this plan — just a placeholder that links to `https://maps.google.com/?q=<venue>+<location>`.
- WhatsApp button: `https://wa.me/<whatsapp>?text=<encoded message>` — similar to EventCard but with more detail in the message.
- **Files:** `EventDetailPage.jsx`, `EventDetailPage.module.css`

### Step 5 — Framer Motion (if Option B chosen)
- `npm install framer-motion` in `app/danzway`.
- Wrap EventDetailPage hero image and content block in `<motion.div>` with `initial={{ opacity: 0, y: 24 }}` → `animate={{ opacity: 1, y: 0 }}` and a staggered delay between image and content.
- **Files:** `EventDetailPage.jsx`
- **Skip this step if Option C chosen.**

### Step 6 — "INTERESTED" toggle on EventCard (local state only)
- Add a `savedIds` state (Set) in `HomePage`, passed as prop to `EventList` → `EventCard`.
- "INTERESTED" button fills amber when saved, outline when not. Clicking toggles.
- No persistence yet (localStorage deferred to Plan 006 with Zustand).
- **Files:** `HomePage.jsx`, `EventList.jsx`, `EventCard.jsx`, `EventCard.module.css`

### Step 7 — Visual QA & build check
- Run `npm run build` in `app/danzway` — zero errors.
- Manually check: filter row, card → detail navigation, WhatsApp link, map placeholder, back button.

---

## Files Touched

| File | Change |
|------|--------|
| `src/data/mockEvents.js` | Add `whatsapp` field to each event |
| `src/components/events/EventCard.jsx` | Add detail-page link, INTERESTED toggle |
| `src/components/events/EventCard.module.css` | Active INTERESTED state style |
| `src/components/events/EventList.jsx` | Pass `savedIds` / `onToggleSave` props down |
| `src/pages/HomePage.jsx` | Add `savedIds` state, pass to EventList |
| `src/pages/EventDetailPage.jsx` | Full redesign + Framer Motion (if B) |
| `src/pages/EventDetailPage.module.css` | Full redesign styles |
| `package.json` / `package-lock.json` | `framer-motion` dep (if B) |

---

## Out of Scope (deferred)

- Real map embed (Google Maps / Leaflet) — Plan 006
- Zustand store + localStorage persistence — Plan 006
- Full route transition animations — Plan 007 (polish)
- Image upload / real photos — future

---

**Check one box for Decision 1 and one for Decision 2, then tell me to proceed.**
