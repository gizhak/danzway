# Plan 002: Project Structure & Mock Data
Status: Complete

---

## 1. Folder Structure

The following files will be created inside `app/danzway/src/`:

```
src/
├── components/
│   ├── layout/
│   │   ├── Navbar.jsx          # Top navigation bar
│   │   ├── Footer.jsx          # Bottom footer
│   │   └── Layout.jsx          # Wraps all pages (Navbar + children + Footer)
│   ├── events/
│   │   ├── EventCard.jsx       # Single event card (image, title, date, style tags)
│   │   └── EventList.jsx       # Grid/list of EventCard components
│   └── ui/
│       ├── Badge.jsx           # Dance style tag (e.g. "Salsa", "Bachata")
│       └── Button.jsx          # Reusable button primitive
│
├── pages/
│   ├── HomePage.jsx            # Landing page — hero + event list
│   └── EventDetailPage.jsx     # Single event detail view (stub for now)
│
├── data/
│   └── mockEvents.js           # Static mock event data (see Section 2)
│
├── hooks/                      # (empty for now — custom hooks added later)
├── services/                   # (empty for now — API calls added later)
└── store/                      # (empty for now — Zustand store added later)
```

> `pages/` is a new top-level folder under `src/`. All other folders already exist.

---

## 2. mockEvents.js Structure

Each event object will have the following shape:

```js
{
  id: "evt-001",
  title: "Salsa Night Tel Aviv",
  date: "2026-05-10",
  time: "21:00",
  location: "Tel Aviv",
  venue: "Club Havana",
  styles: ["Salsa", "Bachata"],      // array — drives Badge components
  image: "/images/salsa-night.jpg",  // placeholder path for now
  price: 60,                         // ILS
  currency: "ILS",
  description: "Short event description text.",
  url: "https://example.com/event"   // external ticket / info link
}
```

The file will export an array of **5–8 mock events** covering different dance styles
(Salsa, Bachata, Kizomba, Zouk, West Coast Swing) and cities (Tel Aviv, Jerusalem, Haifa).

---

## 3. CSS Architecture Decision

Choose **one** option. I will implement only the chosen approach.

**Option A — Standard Tailwind (utility-only)**
- [ ] All styling written as Tailwind utility classes directly in JSX.
- No separate `.css` files per component.
- Shared patterns (e.g. card surface, amber button) defined as `@layer components`
  in `index.css`.
- Best for: fast iteration, keeping everything in one place.

**Option B — Modular CSS (Sass-style, per-component)**
- [x] Each component gets its own `ComponentName.module.css` file.
- Tailwind used only for layout/spacing utilities; visual styles in the module file.
- Mirrors Sass/BEM conventions — familiar if you prefer that workflow.
- Best for: clean separation of concerns, easier to port styles later.

---

**Check one box above, then tell me to proceed.**
