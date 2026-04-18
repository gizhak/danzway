# Plan 011: The Verified Party Map

**Branch:** `f-111-intractive-map`  
**Status:** Completed

---

## Overview

A fully interactive Map View that acts as a visual discovery tool for the dance scene. The map is strictly synced with the curated Firestore `venues` collection — only admin-approved venues appear. It respects the same Style Filters used across the CLUBS and PARTIES tabs, highlights venues with a party happening Tonight or Tomorrow, and clusters dense areas (e.g. Tel Aviv) for a clean UI.

---

## Key Requirements

### Source of Truth — Verified Venues Only
- The map renders markers **only** for venues where `active !== false` in Firestore.
- Uses the existing `selectActiveVenues` selector (same source as the CLUBS tab).
- Venues without `coordinates: { lat, lng }` are excluded silently (no marker rendered).
- "Discovered" venues that have not been approved by the Admin are never shown.

### Dynamic Filtering — Sync with CLUBS Tab
- Reads `selectStyleFilters` from Redux — the same slice used by CLUBS and PARTIES.
- Applies the same **AND logic**: all selected styles must be present on the venue.
- Dispatches `toggleStyleFilter` via the shared `StyleFilterRow` component.
- Selecting "Salsa" immediately re-renders the map with only Salsa venues.

### Marker Intelligence
- Each marker represents a **venue** enriched with its next event (via `selectNextEventByVenueName`).
- If the venue's next event is **Tonight** (`diff === 0`) or **Tomorrow** (`diff === 1`):
  - Marker uses the `pinLive` style: amber border + glow ring.
  - An animated amber pulse ring appears around the marker.
  - `zIndex` is elevated so live venues always appear on top.
- If the venue has a `logo`, it is shown inside the circular marker pin.
- Fallback: 🎵 icon for venues without a logo.

### Clustering
- Uses `@googlemaps/markerclusterer` (v2.6.x) with the `MarkerClusterer` class.
- Each `AdvancedMarker` registers its native element via `useAdvancedMarkerRef()`.
- The `ClusteredMarkers` component collects refs via `setMarkerRef` → feeds them to the clusterer whenever the filtered venue list changes.

### User Experience

**Current Location:**
- `navigator.geolocation.getCurrentPosition` is called on mount.
- On success: places a custom blue dot marker + re-centers the map to the user's location.
- On denial: map stays at the default center (Tel Aviv).

**Interactive Bottom-Sheet Popup:**
- Clicking a marker opens a custom dark card that slides up from the bottom of the screen.
- Card shows: venue logo/avatar, name, city, Google rating, dance style badges, tonight's party (title + time), and two action buttons.
- **Directions** → opens Google Maps with venue coordinates.
- **View Venue →** → navigates to `/venues/:placeId`.
- Clicking the map background (or the ✕ button) closes the card.
- The card animates in with a `slideUp` keyframe (0.22s cubic-bezier).

**Visual Style:**
- 17-rule custom `styles` array creates a dark navy/charcoal map matching the brand's `#1a1a24` background.
- Water is rendered in deep navy `#0a1628`; roads in `#2a2a38`; highways in `#3d3d52`.
- POI labels and transit lines are hidden to reduce visual noise.
- Filter bar floats at the top with a gradient fade + blur (glass effect).
- All colours use the brand amber (`#f59e0b` / `#fbbf24`) for accents.

---

## Technical Implementation

### Library
- `@vis.gl/react-google-maps` (v1.8.x) — official Google Maps React wrapper.
- `@googlemaps/markerclusterer` (v2.6.x) — native clustering.

### New Files

| File | Purpose |
|---|---|
| `src/pages/MapPage.jsx` | Full map page — replaces the "Coming Soon" placeholder |
| `src/pages/MapPage.module.css` | Dark-theme CSS module for map, markers, popup, and filter bar |

### No Selector Changes Required
The existing selectors are sufficient:
- `selectActiveVenues` — filtered venue list
- `selectStyleFilters` — active dance style filters
- `selectNextEventByVenueName` — lookup map for next event per venue
- `selectEventsStatus` / `selectVenuesStatus` — loading states

### Layout Strategy
`MapPage` breaks out of `<main>`'s padding using negative margins:
```css
margin-top:    -1.5rem;           /* cancel main's top padding    */
margin-left:   -1.25rem;          /* cancel main's left padding   */
margin-right:  -1.25rem;          /* cancel main's right padding  */
margin-bottom: calc(-62px - 1.1rem - 1.5rem);  /* cancel main's bottom padding */
height: calc(100svh - 60px);      /* full viewport minus navbar   */
```
This gives a full-bleed, non-scrolling map within the existing Layout — no Layout modifications needed.

### Map ID
`AdvancedMarker` (required for custom HTML pins and clustering) requires a Google Maps `mapId`.
- Reads `VITE_GOOGLE_MAP_ID` from env.
- Falls back to `'DEMO_MAP_ID'` (works on localhost; not for production).
- Production deployments must set a real Map ID in Google Cloud Console → Map Management.

### Component Tree
```
MapPage
  └─ APIProvider (apiKey)
       └─ div.page
            ├─ Map (mapId, styles, defaultCenter, defaultZoom)
            │    ├─ UserLocationMarker         (blue dot)
            │    └─ ClusteredMarkers
            │         └─ VenueMarker × N      (AdvancedMarker + custom pin)
            ├─ div.filterBar                   (StyleFilterRow + venue count)
            └─ div.sheet (conditional)         (VenuePopup bottom card)
```

### Environment Variables
```env
VITE_GOOGLE_MAPS_API_KEY=   # existing — used for APIProvider
VITE_GOOGLE_MAP_ID=         # new — required for AdvancedMarker in production
```

---

## What Does NOT Change

- No changes to the Redux store, slices, or selectors.
- No changes to the Layout, Navbar, BottomNav, or routing.
- The CLUBS and PARTIES tabs are unaffected — they share the same filter state.
- The Admin venue approval flow is unchanged — the map automatically reflects any `active` toggle.

---

## Out of Scope (Plan 012+)

- Street-view or satellite toggle on the map.
- Distance-based sorting of venues.
- Real-time location tracking (continuous `watchPosition`).
- Filtering by date or price range on the map.
- Deep-linking to a specific venue from the map URL (e.g. `/map?venue=placeId`).
