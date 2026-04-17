# Plan 009: Google Places Integration

**Branch:** `f-109-google-places`  
**Status:** Awaiting Approval

---

## Overview

Enrich venue data by wiring up the Google Places API (New). This plan adds a real embedded Google Map on the EventDetailPage, a new `googlePlaces.js` service that can look up a venue by name and pull a live photo, and an admin-only "Refresh Metadata" button that writes the fetched photo URL back to the Firestore document — keeping data fresh without manual uploads.

---

## API Keys Required (Google Cloud Console)

You need **one restricted API key** (or two separate ones for tighter scoping):

| API | Purpose | Billing |
|---|---|---|
| **Maps JavaScript API** | Renders interactive embedded map in EventDetailPage | Free up to 28,000 loads/month |
| **Places API (New)** | `Text Search` to find a venue by name+city; `Place Photos` to fetch the cover photo | Free up to $200/month credit |

### Steps to get the key:
1. Go to [console.cloud.google.com](https://console.cloud.google.com) → select or create project `danzway`
2. **APIs & Services → Library** → enable both:
   - `Maps JavaScript API`
   - `Places API (New)`
3. **APIs & Services → Credentials → Create API Key**
4. **Restrict the key:**
   - Application restriction: `HTTP referrers` → add `localhost:*` + your production domain
   - API restriction: limit to the two APIs above
5. Copy the key — it goes into `.env.local` as two vars (can be the same value):

```env
VITE_GOOGLE_MAPS_API_KEY=AIza...
VITE_GOOGLE_PLACES_API_KEY=AIza...
VITE_IS_ADMIN=true          # Only set this in YOUR .env.local — never commit it
```

> The `VITE_IS_ADMIN` flag is how we gate the "Refresh Metadata" button without building auth.
> Never set it to `true` in `.env.example` or any committed file.

---

## Firestore Document — New Fields

The existing event shape gets two optional fields:

```
events/{id}
  ├── ... (all existing fields unchanged)
  ├── placeId:    string | null   // Google Place ID (e.g. "ChIJ...")
  └── placePhoto: string | null   // Direct photo URL fetched from Places API
```

These start as `null` (or absent) on existing documents. The admin "Refresh Metadata" button populates them on demand.

---

## Task 1 — New Service: `src/services/googlePlaces.js`

**New file:** `src/services/googlePlaces.js`

Three exported async functions:

### `searchPlaceId(venueName, city)`
Calls the Places API **Text Search (New)** endpoint:
```
POST https://places.googleapis.com/v1/places:searchText
  Body: { textQuery: "<venueName>, <city>" }
  Header: X-Goog-FieldMask: places.id,places.displayName
```
Returns the first result's `id` (the Place ID string), or `null` if not found.

### `getPlacePhotoUrl(placeId)`
Calls the Places API **Place Details** endpoint to get a photo reference:
```
GET https://places.googleapis.com/v1/places/<placeId>
  Header: X-Goog-FieldMask: photos
```
Takes the first photo's `name` field and constructs the media URL:
```
https://places.googleapis.com/v1/<photoName>/media
  ?maxWidthPx=800&key=<VITE_GOOGLE_PLACES_API_KEY>
```
Returns the full URL string, or `null` if no photo found.

### `refreshVenueMetadata(event)` — (admin helper, used by the button)
Orchestrates the two calls above:
1. `searchPlaceId(event.venue, event.location)`
2. `getPlacePhotoUrl(placeId)`
3. Returns `{ placeId, placePhoto }` — the caller writes to Firestore

**Error handling:** All three functions should `try/catch` and return `null` on failure (network errors, quota exceeded, not found). Never throw to the UI.

---

## Task 2 — EventDetailPage: Real Embedded Map

**File:** `src/pages/EventDetailPage.jsx`

Replace the current static map card (pin icon + "View on Google Maps →" link) with a live Google Maps `<iframe>` embed.

### Implementation

Use the **Maps Embed API** in Place mode — no JavaScript SDK needed, just an `<iframe>`:

```jsx
const mapsEmbedUrl =
  `https://www.google.com/maps/embed/v1/place` +
  `?key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}` +
  `&q=${encodeURIComponent(`${event.venue}, ${event.location}`)}` +
  `&zoom=15`;
```

```jsx
<div className={styles.mapCard}>
  <iframe
    title="venue-map"
    src={mapsEmbedUrl}
    width="100%"
    height="220"
    style={{ border: 0, borderRadius: '12px' }}
    allowFullScreen
    loading="lazy"
    referrerPolicy="no-referrer-when-downgrade"
  />
  <a
    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${event.venue}, ${event.location}`)}`}
    target="_blank"
    rel="noopener noreferrer"
    className={styles.mapLink}
  >
    Open in Google Maps →
  </a>
</div>
```

The existing "View on Google Maps →" link can remain below the iframe as a tap-to-navigate affordance on mobile.

### Fallback
If `VITE_GOOGLE_MAPS_API_KEY` is not set (empty string), render the existing plain text card instead of the iframe — so the app doesn't break in CI or for contributors without a key.

---

## Task 3 — Admin: "Refresh Metadata" Button

**File:** `src/pages/EventDetailPage.jsx`  
**New Firestore write:** `updateDoc(doc(db, 'events', event.id), { placeId, placePhoto })`

### Visibility gate
```jsx
const isAdmin = import.meta.env.VITE_IS_ADMIN === 'true';
```
Only render the button when `isAdmin` is `true`.

### Button behavior
1. User clicks "Refresh Metadata"
2. Button enters loading state ("Fetching…")
3. Call `refreshVenueMetadata(event)` from `googlePlaces.js`
4. On success: call `updateDoc` on Firestore with `{ placeId, placePhoto }`
5. Dispatch `fetchEvents()` to reload Redux state so the new photo appears immediately
6. Show a brief toast: "Venue photo updated!"
7. On failure: show toast: "Could not fetch venue data"

### Button placement
Below the map card, above the WhatsApp CTA — only visible to admin:

```jsx
{isAdmin && (
  <button
    onClick={handleRefreshMetadata}
    disabled={refreshing}
    className={styles.adminRefreshBtn}
  >
    {refreshing ? 'Fetching…' : '↻ Refresh Metadata'}
  </button>
)}
```

### CSS
Add `.adminRefreshBtn` to `EventDetailPage.module.css`:
- Small, muted style (gray/outline) — clearly a dev tool, not a user-facing CTA
- `opacity: 0.7` on disabled state

---

## Task 4 — Show Google Photo as Fallback Image

**File:** `src/pages/EventDetailPage.jsx`

The event hero image currently falls back to a musical note (♪) if `event.image` is absent.

Update the fallback chain:
1. `event.image` (Unsplash URL — current behavior)
2. `event.placePhoto` (Google Places photo — new)
3. Musical note placeholder (existing)

```jsx
const heroImage = event.image || event.placePhoto || null;
```

---

## Task Order & Dependencies

```
Task 1 (googlePlaces.js service)   — independent, no UI deps
Task 2 (embedded map)              — depends on VITE_GOOGLE_MAPS_API_KEY being set
Task 3 (Refresh Metadata button)   — depends on Task 1 (uses refreshVenueMetadata)
Task 4 (photo fallback)            — depends on Task 3 having written placePhoto to Firestore
```

---

## Files Changed Summary

| File | Action |
|---|---|
| `src/services/googlePlaces.js` | New — Places API service (searchPlaceId, getPlacePhotoUrl, refreshVenueMetadata) |
| `src/pages/EventDetailPage.jsx` | Replace map card with iframe embed; add Refresh Metadata admin button; update image fallback |
| `src/pages/EventDetailPage.module.css` | Add `.mapCard`, `.mapLink`, `.adminRefreshBtn` styles |
| `.env.local` | Add `VITE_GOOGLE_MAPS_API_KEY`, `VITE_GOOGLE_PLACES_API_KEY`, `VITE_IS_ADMIN=true` |
| `.env.example` | Add the two new key names with empty values (no `VITE_IS_ADMIN`) |

---

## Out of Scope (for this plan)

- Bulk-refreshing all events at once (admin dashboard)
- Caching Places API responses locally (rate-limit protection)
- Displaying additional place details (rating, opening hours, website)
- Firebase Authentication — admin gate stays as env-var flag for now
- Storing multiple photos per venue
