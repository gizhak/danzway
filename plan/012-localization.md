# Plan 012: Full Multi-Language Support (Hebrew & English)

**Branch:** `f-111-intractive-map`  
**Status:** Completed

---

## Overview

Full internationalisation of the DanzWay app using `react-i18next`. Hebrew is the default language; English is toggled via a button in the Navbar. Switching languages flips the document direction (`rtl` ↔ `ltr`), reformats all dates to the correct locale, and persists the choice in `localStorage`.

---

## Key Requirements

### Framework
- `react-i18next` + `i18next` (already installed in the project).
- Two resource bundles: `src/i18n/locales/en.json` and `src/i18n/locales/he.json`.
- Initialised in `src/i18n/index.js`, imported once from `src/main.jsx` before the React tree mounts.

### Default Language & Persistence
- Default: `'he'` (Hebrew).
- Saved to `localStorage` under key `'danzway-lang'`.
- On init, `document.documentElement.dir` and `document.documentElement.lang` are set synchronously — no layout flash.

### Language Toggle
- Navbar replaces the dancer `🕺` icon with a pill button showing `"EN"` (when Hebrew is active) or `"עב"` (when English is active).
- Toggling calls `i18n.changeLanguage()`, updates `localStorage`, and sets `document.documentElement.dir`.

### RTL Support
- `document.dir = 'rtl'` handles text direction, flex order, and most layout automatically.
- Absolutely-positioned elements that use `left`/`right` are converted to CSS logical properties (`inset-inline-start`, `inset-inline-end`) so they flip automatically.
- Converted files: `Navbar.module.css`, `SearchBar.module.css`, `EventCard.module.css`, `VenueCard.module.css`, `EventDetailPage.module.css`.

### Date Formatting
- Centralised in `src/i18n/dateUtils.js` with three helpers:
  - `relativeDate(dateStr, t, lang)` — returns "Tonight" / "Tomorrow" / locale-formatted date.
  - `shortMonthDay(dateStr, lang)` — returns `{ month, day }` for badge display.
  - `profileDate(dateStr, lang)` — short date string for the profile saved-events list.
- All components pass `i18n.language` to these helpers to get `'he-IL'` or `'en-US'` locale strings.

### Dance Style IDs
- Internal filter IDs remain English strings (`"Salsa"`, `"Bachata"`, etc.) — the Redux AND-logic is unchanged.
- Display labels are translated via `t('styles.Salsa')` etc. in `StyleFilterRow` and popup badges.

### Directional Arrows
- A `backArrow` translation key holds `"←"` in `en.json` and `"→"` in `he.json` — no CSS transform needed.

---

## Files Changed

### New Files
| File | Purpose |
|------|---------|
| `src/i18n/index.js` | i18next init + synchronous dir/lang bootstrap |
| `src/i18n/locales/en.json` | Complete English translation bundle |
| `src/i18n/locales/he.json` | Complete Hebrew translation bundle |
| `src/i18n/dateUtils.js` | Locale-aware date helpers |

### Updated Files
| File | Changes |
|------|---------|
| `src/main.jsx` | Added `import './i18n/index.js'` |
| `src/components/layout/Navbar.jsx` | Language toggle button replacing dancer emoji |
| `src/components/layout/Navbar.module.css` | `.langBtn` replacing `.icon`; `inset-inline-end` for RTL |
| `src/components/layout/BottomNav.jsx` | Nav labels via `t('nav.*')` |
| `src/components/layout/Footer.jsx` | Copyright via `t('footer.copy')` |
| `src/components/ui/SearchBar.jsx` | Placeholder + aria via `t('search.*')` |
| `src/components/ui/SearchBar.module.css` | Logical properties for icon + clear button |
| `src/components/events/StyleFilterRow.jsx` | Labels via `t('styles.*')` |
| `src/components/events/EventCard.jsx` | All strings + locale dates |
| `src/components/events/EventCard.module.css` | `inset-inline-end` for date badge |
| `src/components/events/EventList.jsx` | Empty state via `t('event.empty')` |
| `src/components/venues/VenueCard.jsx` | All strings + locale dates |
| `src/components/venues/VenueCard.module.css` | `inset-inline-end` for rating + date badges |
| `src/pages/HomePage.jsx` | All strings |
| `src/pages/PartiesPage.jsx` | All strings |
| `src/pages/ProfilePage.jsx` | All strings + `profileDate()` |
| `src/pages/PostPage.jsx` | All strings |
| `src/pages/MapPage.jsx` | All strings + `VenuePopup` locale date labels |
| `src/pages/VenueDetailPage.jsx` | All strings including social buttons + admin refresh |
| `src/pages/EventDetailPage.jsx` | All strings including admin refresh + WhatsApp CTA |
| `src/pages/EventDetailPage.module.css` | `inset-inline-end` for date badge |

---

## Translation Key Structure

```
nav.*             — bottom nav tab labels
home.*            — home page hero + count + empty states
parties.*         — parties page hero + count + empty states
event.*           — EventCard actions + WA message template
eventDetail.*     — EventDetailPage strings (loading, back, maps, refresh, toasts)
venue.*           — VenueCard actions
venue.detail.*    — VenueDetailPage strings (loading, back, social, maps, refresh, toasts)
profile.*         — ProfilePage strings
post.*            — PostPage strings
map.*             — MapPage strings (notConfigured, loading, count, popup labels)
search.*          — SearchBar placeholder + aria
common.*          — tonight / tomorrow / loading / next (shared across cards)
styles.*          — dance style display labels (IDs stay English internally)
footer.*          — footer copyright line
```

---

## Out of Scope

- `src/pages/admin/VenueDiscoveryPage.jsx` — admin-only tool; not user-facing.
