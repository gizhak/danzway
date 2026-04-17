# Plan 010: Admin Control Center — Venue Discovery

**Branch:** `f-110-venue-discovery`  
**Status:** In Progress (v2 — refined requirements)

---

## Overview

A professional admin-only control center for managing every dance venue in Israel. The dashboard lets the admin discover venues via Google Places, toggle each one on/off (controlling home feed visibility), assign dance styles for filtering, set a venue logo, and add social media handles. The home feed shows logos. The EventDetailPage shows the full Google Places photo gallery and a social media embed.

---

## Updated Firestore `venues` Document Shape

```
venues/{placeId}
  ├── placeId:        string           // Google Place ID (doc ID)
  ├── name:           string
  ├── address:        string
  ├── city:           string
  ├── active:         boolean          // V Logic — true = visible on home feed
  ├── logo:           string | null    // Custom logo URL (shown on cards / home feed)
  ├── styles:         string[]         // Dance styles assigned by admin e.g. ["Salsa","Bachata"]
  ├── categories:     string[]         // Mapped from Google types e.g. ["Nightclub","Bar"]
  ├── categoriesHe:   string[]         // Hebrew versions
  ├── googleTypes:    string[]         // Raw Google types (kept for re-mapping)
  ├── rating:         number
  ├── reviewCount:    number
  ├── photos:         string[]         // Google Places gallery (up to 5) — EventDetailPage only
  ├── reviews:        Review[]         // Up to 5 Google reviews with author photos
  ├── phone:          string | null
  ├── website:        string | null
  ├── instagram:      string | null    // Handle or full URL e.g. "@club_havana"
  ├── facebook:       string | null    // Page name or full URL
  ├── instagramPostUrl: string | null  // URL of a specific pinned post for oEmbed
  ├── coordinates:    { lat, lng }
  ├── importedAt:     number           // Timestamp as millis (serializable for Redux)
  └── lastRefreshed:  number
```

---

## Rule 1 — Logo vs. Gallery: Where Each Appears

| Surface | Image source | Priority order |
|---|---|---|
| **EventCard** (home feed) | Logo only | `venue.logo → event.placePhoto → event.image → placeholder` |
| **EventDetailPage** hero | Full photo | `event.placePhoto → event.image → placeholder` |
| **EventDetailPage** gallery | Google gallery | `venue.photos[]` (shown in a dedicated gallery section) |

**Why:** A venue logo is the brand identity — it's what users recognise on a quick-scroll feed. The rich Google photos live on the detail page where there's space to tell the full story.

Implementation: the `EventCard` component needs to know the venue's logo. Since events currently don't store a `venueId`, the logo will be looked up by matching `event.venue` (name) against the `venues` collection in Redux. When a match is found, `venue.logo` is used. No match = fall back to `event.placePhoto`.

---

## Rule 2 — The V Logic (Active / Inactive Toggle)

Every venue in the system (whether found in search or already imported) has a single toggle:

- **Active (✓ green):** Venue is visible on the home page.  
- **Inactive (grey):** Venue is hidden from the feed immediately.

### Where the toggle appears:
1. **Search results grid** — on already-imported venues, show the toggle directly on the card (replaces the "Imported ✓" static badge with a live toggle).
2. **Imported venues list** — a prominent toggle switch on every row.

### How it works:
```
Toggle ON  → updateDoc(venues/{placeId}, { active: true  })
Toggle OFF → updateDoc(venues/{placeId}, { active: false })
```

The home feed (HomePage) filters venue-linked events by `active: true`. This is the single source of truth — no cache invalidation needed since Redux re-fetches `venues` after every toggle.

---

## Rule 3 — Smart Tagging: Dance Styles

In the dashboard, each imported venue row shows a **style tag row** below its main info:

```
[Salsa ✓] [Bachata ✓] [Kizomba] [Zouk] [Tango] [WCS]
```

Clicking a style chip **toggles** it — amber = assigned, grey = not assigned. Changes are written to Firestore immediately:
```
updateDoc(venues/{placeId}, { styles: [...updatedStylesArray] })
```

These `styles` tags flow through to the home feed filter — when a user selects "Salsa" in the style filter, only events/venues with `"Salsa"` in their styles array are shown.

**The full style list:**
`['Salsa', 'Bachata', 'Kizomba', 'Zouk', 'Tango', 'West Coast Swing', 'Social']`

---

## Rule 4 — Social Media (Instagram / Facebook)

### The honest Instagram API situation

| Approach | Auth needed | Complexity | Status |
|---|---|---|---|
| Instagram Basic Display API | OAuth + App Review | High | **Deprecated Mar 2024** |
| Instagram Graph API | Business account OAuth + App Review | Very high | Not viable for us |
| **Instagram oEmbed** | **None (for public posts)** | **Low** | **✓ Use this** |
| Unofficial iframe embed | None | Low | Fragile — Instagram blocks periodically |
| Manual link only | None | Zero | Safe fallback |

### Our approach: Two-field strategy

**Field 1: `instagram`** — the venue's profile handle (e.g. `"@club_havana"`)  
**Field 2: `instagramPostUrl`** — URL of a specific public post (e.g. a party flyer post)

The admin fills both fields manually in the dashboard (typically copy-pasted from the venue's Google Maps listing "website" link, or from a quick search). No scraping, no API approval.

### Can Google Places return Instagram links?

Partially. The Places API returns `websiteUri` — some venues link directly to their Instagram. We will:
1. Auto-detect if `websiteUri` contains `instagram.com` → auto-populate `instagram` field on import
2. Auto-detect `facebook.com` → auto-populate `facebook` field
3. Otherwise leave them blank for manual entry

### Rendering on EventDetailPage

**Instagram profile link (always shown if `instagram` is set):**
```jsx
<a href={`https://instagram.com/${handle}`} target="_blank">
  Follow on Instagram @{handle}
</a>
```

**Instagram post embed (shown if `instagramPostUrl` is set):**
Uses the free, no-auth **Instagram oEmbed endpoint**:
```
GET https://api.instagram.com/oembed/?url={instagramPostUrl}&omitscript=true
```
Returns embed HTML including the post image, caption, and like count. We inject the returned `html` via `dangerouslySetInnerHTML` (safe here — it's Instagram's own embed code). No API key, no app review, no rate limit beyond reasonable use (~unlimited for public posts).

**Fallback:** if oEmbed fails or no post URL is set, show only the profile link button.

**Facebook:** link only — `https://facebook.com/{handle}`. No embed.

---

## Dashboard Tasks (Updated)

### Task A — VenueResultCard updates (search results)

For venues **not yet imported:** unchanged — show checkbox + Import button.

For venues **already imported** (identified by `placeId` in the `venues` collection):
- Show the **V toggle** (green = active, grey = inactive) instead of the static "Imported ✓" badge
- The toggle fires `updateDoc` immediately + re-fetches `venues`
- Show a small "Manage ↓" link that jumps/scrolls to that venue's row in Section C

### Task B — ImportedVenueRow updates

Replace the current minimal row with a full management card:

```
[logo or thumb] [name, city, categories]   [V toggle]
                [Style tags row]
                [Instagram / Facebook inputs]
                [Edit Photo button]          [Create Event →]
```

**Style tags row:** all 7 style chips, amber = assigned. Tap to toggle, saves immediately.

**Social fields:** two compact text inputs: `@instagram` and `@facebook`. Show inline, save on blur or Enter. Auto-filled from website detection on import.

**V toggle:** large, prominent, can't miss it. Green pill = active ("● Live"), grey = "○ Hidden".

### Task C — Duplicate detection in search results

When search results load, `importedPlaceIds` Set is checked per result. For imported venues:
- The card uses `importedVenueData` from the Redux `venues` state (matched by `placeId`)
- Shows current `active` status as the toggle state, not just a static badge
- Admin can activate/deactivate directly from the search result without scrolling to Section C

This makes it **impossible to miss** a venue you already have — it's live-managed, not just labelled.

---

## Files to Change

| File | Change |
|---|---|
| `src/services/googlePlaces.js` | Auto-detect `instagram`/`facebook` from `websiteUri` on import; add `fetchInstagramOEmbed(postUrl)` |
| `src/store/venuesSlice.js` | Add `updateVenueField` action for optimistic local updates on toggles; add `selectVenueByName(name)` selector for EventCard logo lookup |
| `src/pages/admin/VenueDiscoveryPage.jsx` | V toggle on cards + rows; style tag chips; social media inputs; scroll-to-row from search results |
| `src/pages/admin/VenueDiscoveryPage.module.css` | Toggle styles, style chip row, social inputs, management card layout |
| `src/components/events/EventCard.jsx` | Look up `venue.logo` from Redux `venues` and use as primary image |
| `src/pages/EventDetailPage.jsx` | Show Google photo gallery section; show Instagram embed (oEmbed) + social links |
| `src/pages/EventDetailPage.module.css` | Gallery section, social links row, Instagram embed container |

---

## What Does NOT Change

- The `events` collection shape is unchanged — events still have their own `image` / `placePhoto` fields
- No `venueId` foreign key on events yet — logo lookup uses fuzzy name match for now (Plan 011 will add proper linking)
- Firestore security rules: already `allow write: if true` for both collections

---

## Out of Scope (Plan 011)

- Linking `events` to `venues` via `venueId` foreign key
- Creating a new event from a venue template
- Instagram post auto-refresh (today: admin pastes post URL manually)
- Full venue page (`/venues/:placeId`) with map, gallery, reviews
- Bulk style tag assignment
