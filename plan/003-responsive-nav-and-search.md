# Plan 003: Responsive Mobile Navigation & Search
Status: Complete

---

## Atomic Steps

- [ ] 1. Decide mobile nav style (Option A below)
- [ ] 2. Decide search placement & behavior (Option B below)
- [ ] 3. Decide search state management (Option C below)
- [ ] 4. Build mobile nav (hamburger toggle + menu)
- [ ] 5. Build search input component
- [ ] 6. Wire search to filter `mockEvents` on HomePage
- [ ] 7. Ensure layout is responsive at all breakpoints (mobile / tablet / desktop)

---

## Architectural Decisions

### Option A — Mobile Navigation Style

**A1: Hamburger → Slide-in Drawer (side panel)**
- [ *] A hamburger icon in the Navbar opens a full-height side panel from the left.
- Nav links live inside the drawer; drawer closes on link click or outside tap.
- Standard pattern for content-heavy apps.

**A2: Hamburger → Dropdown Menu (below Navbar)**
- [ ] A hamburger icon toggles a dropdown panel that appears below the Navbar.
- Simpler to implement; works well when there are only a few nav links.

**A3: Bottom Navigation Bar (mobile only)**
- [* ] On small screens, a fixed bottom bar replaces the top Navbar links.
- Common in mobile-first apps (Instagram, Google Maps style).
- Desktop keeps the existing top Navbar unchanged.

---

### Option B — Search Placement & Behavior

**B1: Search bar inside the Navbar (always visible)**
- [ ] A search input sits in the center/right of the Navbar on desktop;
  collapses to an icon on mobile that expands on tap.
- Pro: always accessible. Con: Navbar gets busier.

**B2: Search bar on the HomePage, above the event grid**
- [ *] A prominent search/filter bar lives at the top of the HomePage,
  between the hero text and the event list.
- Pro: clean Navbar, natural position. Con: not accessible from other pages.

**B3: Both — compact icon in Navbar + full bar on HomePage**
- [ ] Navbar has a search icon that scrolls/navigates to the HomePage search bar.
- More complex wiring; skip for now unless explicitly needed.

---

### Option C — Search State Management

**C1: Local `useState` inside HomePage**
- [ *] Search query lives in `HomePage`. Simple, no extra infrastructure.
- Sufficient as long as search is only on HomePage.

**C2: Lifted to App-level context (or Zustand store)**
- [ ] Search state is global — any page can read/set the query.
- Needed only if search is shared across pages (e.g. Navbar search → filters HomePage).
- Overkill for now unless Option B1 or B3 is chosen.

---

## Notes

- Filtering will be **client-side only** (against `mockEvents.js`) — no API calls in this plan.
- Filter logic: match query against `title`, `location`, `venue`, and `styles[]`.
- Responsive breakpoints follow the existing Tailwind v4 defaults (`sm: 640px`, `md: 768px`, `lg: 1024px`).
- All new components get their own `.module.css` per the agreed CSS architecture.

---

**Check one box per Option (A, B, C), then tell me to proceed.**
