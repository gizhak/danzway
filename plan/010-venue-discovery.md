# Plan 010: Venue Discovery

**Branch:** `f-110-venue-discovery`  
**Status:** Awaiting Approval

---

## Overview

Build an admin-only Venue Discovery Dashboard that queries Google Places for every dance venue in Israel, lets the admin bulk-import them with rich metadata (photo gallery, reviews with author photos, categories), and stores each venue as a reusable Firestore template. When a specific event is scheduled at a venue, the admin picks a template and adds a date/time on top — no re-typing venue details every time.

---

## New Firestore Collection: `venues`

Separate from `events`. A venue document is a **permanent template** — it holds the place data and grows richer over time. Events reference it but stay independent.

```
venues/{placeId}
  ├── placeId:        string          // Google Place ID (also the doc ID)
  ├── name:           string          // display name (e.g. "Club Havana")
  ├── address:        string          // formatted address from Google
  ├── city:           string          // extracted city (e.g. "Tel Aviv")
  ├── categories:     string[]        // mapped English labels (e.g. ["Nightclub","Bar"])
  ├── categoriesHe:   string[]        // Hebrew labels (e.g. ["מועדון לילה","בר"])
  ├── googleTypes:    string[]        // raw Google types array (kept for re-mapping later)
  ├── rating:         number          // Google Maps rating (e.g. 4.2)
  ├── reviewCount:    number          // total number of Google reviews
  ├── photos:         string[]        // up to 5 direct photo media URLs
  ├── reviews:        Review[]        // up to 5 reviews (see shape below)
  ├── phone:          string | null
  ├── website:        string | null
  ├── coordinates:    { lat, lng }    // from Google location object
  ├── importedAt:     Timestamp
  └── lastRefreshed:  Timestamp

// Review sub-shape:
{
  author:       string    // authorAttribution.displayName
  authorPhoto:  string    // authorAttribution.photoUri
  rating:       number
  text:         string    // text.text
  relativeTime: string    // "2 months ago"
}
```

---

## Google Types → Category Mapping

Stored in `src/services/googlePlaces.js` as a constant.

| Google Type | English | Hebrew |
|---|---|---|
| `night_club` | Nightclub | מועדון לילה |
| `dance_school` | Dance Studio | אולפן ריקודים |
| `bar` | Bar | בר |
| `restaurant` | Restaurant & Bar | מסעדה ובר |
| `gym` | Studio | סטודיו |
| `sports_activity_location` | Dance Studio | אולפן ריקודים |
| `entertainment_venue` | Event Venue | אולם אירועים |
| `event_venue` | Event Venue | אולם אירועים |
| `performing_arts_theater` | Theater | תיאטרון |
| `cultural_center` | Cultural Center | מרכז תרבות |
| `community_center` | Community Center | מרכז קהילתי |

If none of the known types match, fall back to `"Venue"` / `"מקום"`.

---

## Preset Search Queries

Stored as a constant in `VenueDiscoveryPage.jsx`. Each query is a button the admin can click to trigger a search — no typing required.

```js
const PRESET_QUERIES = [
  { label: 'Salsa — TLV',       query: 'salsa club Tel Aviv'           },
  { label: 'Salsa — Jerusalem',  query: 'salsa club Jerusalem'          },
  { label: 'Salsa — Haifa',      query: 'salsa club Haifa'              },
  { label: 'Bachata — TLV',      query: 'bachata Tel Aviv'              },
  { label: 'Kizomba — TLV',      query: 'kizomba Tel Aviv'              },
  { label: 'Zouk — Israel',      query: 'zouk dance Israel'             },
  { label: 'Tango — Israel',     query: 'tango club Israel'             },
  { label: 'WCS — Israel',       query: 'west coast swing Israel'       },
  { label: 'Dance Clubs — TLV',  query: 'dance club Tel Aviv'           },
  { label: 'Latin Bars — TLV',   query: 'latin dance bar Tel Aviv'      },
  { label: 'Dance Studios — TLV',query: 'dance school Tel Aviv'         },
  { label: 'Studios — Jerusalem',query: 'dance school Jerusalem'        },
  { label: 'Latin (HE) — TLV',   query: 'מועדון לטיני תל אביב'         },
  { label: 'Dance (HE) — TLV',   query: 'מועדון ריקודים תל אביב'       },
]
```

---

## Task 1 — Extend `src/services/googlePlaces.js`

### 1a. Add the category mapping constant

```js
export const GOOGLE_TYPE_MAP = {
  night_club:                { en: 'Nightclub',       he: 'מועדון לילה'      },
  dance_school:              { en: 'Dance Studio',    he: 'אולפן ריקודים'    },
  bar:                       { en: 'Bar',             he: 'בר'               },
  restaurant:                { en: 'Restaurant & Bar',he: 'מסעדה ובר'        },
  gym:                       { en: 'Studio',          he: 'סטודיו'           },
  sports_activity_location:  { en: 'Dance Studio',    he: 'אולפן ריקודים'    },
  entertainment_venue:       { en: 'Event Venue',     he: 'אולם אירועים'     },
  event_venue:               { en: 'Event Venue',     he: 'אולם אירועים'     },
  performing_arts_theater:   { en: 'Theater',         he: 'תיאטרון'          },
  cultural_center:           { en: 'Cultural Center', he: 'מרכז תרבות'       },
  community_center:          { en: 'Community Center',he: 'מרכז קהילתי'      },
}

export function mapGoogleTypes(types = []) {
  const matched = types
    .map((t) => GOOGLE_TYPE_MAP[t])
    .filter(Boolean)
  // Deduplicate by English label
  const seen = new Set()
  return matched.filter(({ en }) => !seen.has(en) && seen.add(en))
  // Returns [{ en, he }, ...] or [{ en: 'Venue', he: 'מקום' }] as fallback
}
```

### 1b. `searchDanceVenues(query)`

Calls Places Text Search (New). Returns an array of lightweight result objects for the discovery grid — **not** full details yet (details are fetched on import to save quota).

```
POST https://places.googleapis.com/v1/places:searchText
Body: { textQuery: query, languageCode: 'en' }
FieldMask: places.id,places.displayName,places.types,
           places.formattedAddress,places.rating,
           places.userRatingCount,places.photos
```

Returns array of:
```js
{
  placeId:      string
  name:         string
  address:      string
  types:        string[]
  categories:   { en, he }[]   // already mapped via mapGoogleTypes()
  rating:       number
  reviewCount:  number
  thumbnail:    string | null  // first photo URL at 400px, or null
}
```

**Deduplication:** accepts a `Set` of already-seen placeIds and filters them out, so running multiple queries doesn't produce duplicate cards.

### 1c. `getFullVenueDetails(placeId)`

Called only when the admin confirms import. Fetches everything needed for the Firestore document in one round trip.

```
GET https://places.googleapis.com/v1/places/{placeId}
FieldMask: id,displayName,types,formattedAddress,location,
           nationalPhoneNumber,websiteUri,rating,
           userRatingCount,photos,reviews
```

Returns a fully shaped venue object ready for `setDoc`:
- `photos`: up to 5 photo media URLs (iterate `data.photos.slice(0, 5)`)
- `reviews`: map each review to `{ author, authorPhoto, rating, text, relativeTime }`
- `coordinates`: `{ lat: data.location.latitude, lng: data.location.longitude }`
- `categories` / `categoriesHe`: via `mapGoogleTypes(data.types)`

### 1d. `importVenuesToFirestore(placeIds)`

Orchestrator used by the "Import Selected" button:
1. For each `placeId` in the array, call `getFullVenueDetails(placeId)`
2. Call `setDoc(doc(db, 'venues', placeId), venueData, { merge: true })`
3. Returns `{ imported: number, failed: number }`

---

## Task 2 — New Redux Slice: `src/store/venuesSlice.js`

Keeps venue discovery state **separate** from the events slice.

```js
{
  venues: [],           // imported venues from Firestore (for future "Create Event" flow)
  status: 'idle',
  error: null
}
```

**Thunk:** `fetchVenues()` — reads `getDocs(collection(db, 'venues'))`.

**Selectors:** `selectAllVenues`, `selectVenuesStatus`.

Wire into `src/store/index.js` as `venues` key.

---

## Task 3 — New Page: `src/pages/admin/VenueDiscoveryPage.jsx`

Route: `/admin/venues`  
Only rendered when `IS_ADMIN === true` (checked in `App.jsx`).

### Layout — three vertical sections:

#### Section A: Search Panel

- **Preset query buttons** — 14 pill buttons from `PRESET_QUERIES` array. Clicking one fires `searchDanceVenues(query)` and appends results to the grid (deduplicating by placeId).
- **Manual search input** — text field + "Search" button for custom queries (e.g. a specific venue name someone messaged you about). Same function call.
- **"Clear Results"** button — resets the grid.
- Active query shown as a status line: _"Showing 12 results for 'salsa club Tel Aviv'"_

#### Section B: Results Grid

Responsive grid of **VenueResultCard** components.

Each card shows:
- Thumbnail photo (or placeholder)
- Venue name + city
- Category badges (English labels)
- Star rating + review count
- **Checkbox** (top-right corner)
- **"Details →"** button that expands an inline panel showing the photo gallery (swipeable, up to 5 images) and the 5 reviews with author photo, name, rating, and text

**Bulk controls** (sticky bar above the grid, visible when results exist):
- "Select All" / "Deselect All" toggle
- **"Import Selected (N)"** button — disabled when nothing selected, shows spinner during import
- Already-imported venues are dimmed with an "Imported ✓" badge — checkbox hidden

#### Section C: Imported Venues

Below the search results, a separate list of all venues already in the `venues` Firestore collection.

Each row shows: thumbnail, name, city, category, rating, **"Create Event →"** button (placeholder for Plan 011 — does nothing yet, just labelled).

---

## Task 4 — Wire Route + Admin Nav

### `src/App.jsx`

```jsx
import VenueDiscoveryPage from './pages/admin/VenueDiscoveryPage'

// Inside Routes, alongside other routes:
{IS_ADMIN && (
  <Route path="/admin/venues" element={<VenueDiscoveryPage />} />
)}
```

### `src/components/layout/BottomNav.jsx`

Add admin nav item conditionally — only when `IS_ADMIN`:

```jsx
const IS_ADMIN = import.meta.env.VITE_IS_ADMIN === 'true'

// Append to NAV_ITEMS when IS_ADMIN:
{ to: '/admin/venues', label: 'VENUES', icon: '🗺', end: false }
```

---

## Task 5 — CSS: `src/pages/admin/VenueDiscoveryPage.module.css`

Key style decisions:
- Dark-premium theme matching the rest of the app
- Results grid: `grid-template-columns: repeat(auto-fill, minmax(280px, 1fr))`
- VenueResultCard: image top, content below, checkbox overlay top-right
- Photo gallery in details panel: horizontal scroll strip, `aspect-ratio: 4/3`, `border-radius: 10px`
- Review item: flex row — `authorPhoto` as 36px circle, text stack beside it
- Import button: amber gradient (matches the app's CTA style)
- "Imported ✓" badge: muted green, overlays card, reduces card opacity to 0.55
- Sticky bulk-controls bar: `position: sticky; top: 0; z-index: 10; backdrop-filter: blur(12px)`

---

## Task Order & Dependencies

```
Task 1 (googlePlaces.js additions)   — independent, no UI deps
Task 2 (venuesSlice.js)              — independent
Task 3 (VenueDiscoveryPage)          — depends on Task 1 + Task 2
Task 4 (route + nav wiring)          — depends on Task 3 existing
Task 5 (CSS)                         — alongside Task 3
```

---

## Files Changed Summary

| File | Action |
|---|---|
| `src/services/googlePlaces.js` | Add: `GOOGLE_TYPE_MAP`, `mapGoogleTypes`, `searchDanceVenues`, `getFullVenueDetails`, `importVenuesToFirestore` |
| `src/store/venuesSlice.js` | New — venues state, `fetchVenues` thunk, selectors |
| `src/store/index.js` | Wire `venuesSlice` into store |
| `src/pages/admin/VenueDiscoveryPage.jsx` | New — full discovery dashboard |
| `src/pages/admin/VenueDiscoveryPage.module.css` | New — all styles |
| `src/App.jsx` | Add `/admin/venues` route, guarded by `IS_ADMIN` |
| `src/components/layout/BottomNav.jsx` | Add admin nav item when `IS_ADMIN` |

---

## Firestore Security Rules Update Required

The `venues` collection needs `allow write: if true` alongside `events`.
Update in Firebase Console → Firestore → Rules:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /events/{eventId} {
      allow read: if true;
      allow write: if true;
    }
    match /venues/{venueId} {
      allow read: if true;
      allow write: if true;
    }
  }
}
```

---

## Out of Scope (for this plan)

- Plan 011: "Create Event from Venue" — the "Create Event →" button is stubbed but not wired
- Pagination / "Load more" for search results (API returns up to 20 per query)
- Deduplication across the full `venues` collection (only deduplicates within current session results)
- Editing or deleting imported venues
- Realtime listeners for the venues collection
