# Plan 014: Search Optimization & Manual Media Management

**Branch:** `f-111-intractive-map`  
**Status:** Completed

---

## Overview

Three focused improvements before Beta: Hebrew-aware search across all venue fields, price display removed from user-facing UI, and a Cloudinary image upload tool in the admin dashboard with automatic propagation through all venue surfaces.

---

## 1. Multi-Language Search (Hebrew / English)

### CLUBS tab — `src/pages/HomePage.jsx`
`filterVenues` now checks five fields:
- `name` — venue name (English or Hebrew)
- `city` / `address` — location
- `categories` — English category strings (e.g. "Nightclub")
- `categoriesHe` — Hebrew category strings (e.g. "מועדון לילה") stored in Firestore
- `tags` — optional free-text tag array for future admin use

Hebrew `categoriesHe` comparison skips `.toLowerCase()` since Hebrew has no case.

### Admin Discovery — `src/pages/admin/VenueDiscoveryPage.jsx`
`handleManualSearch` detects Hebrew characters (`/[\u0590-\u05FF]/`) and appends `" ישראל"` to the query when:
- The query contains Hebrew AND
- Does not already include `"ישראל"` or `"israel"`

This improves Google Places relevance for Hebrew venue names.

---

## 2. Price Removal

Price is stripped from all user-facing surfaces. It is **not** removed from Firestore or admin forms — just not displayed.

| Location | Change |
|----------|--------|
| `EventCard` — WhatsApp RSVP button | Removed `· {price} {currency}` suffix |
| `EventDetailPage` — inline + fixed WhatsApp buttons | Removed `· {price} {currency}` suffix |
| `EventDetailPage` — price row | Entire `<div className={priceRow}>` removed |

Admin `AddPartyForm` and `EditEventModal` retain their price fields for data integrity.

---

## 3. Cloudinary Integration

### Setup
Add two env vars to `.env.local`:
```
VITE_CLOUDINARY_CLOUD_NAME=your_cloud_name
VITE_CLOUDINARY_UPLOAD_PRESET=your_unsigned_preset
```

Create an **unsigned** upload preset in Cloudinary dashboard → Settings → Upload → Upload presets.

### Upload flow (admin only)
1. Admin clicks **☁ Upload** on a venue row in the Venues dashboard.
2. Native file picker opens (filters to `image/*`).
3. File is POSTed to `https://api.cloudinary.com/v1_1/{cloud}/image/upload` with the unsigned preset.
4. Returned `secure_url` is written to `venues/{placeId}.customImageUrl` in Firestore.
5. Redux store is updated via `updateVenueField` — UI refreshes immediately.
6. Toast confirms success or shows the error message.

The thumbnail in the admin row automatically switches to show the Cloudinary image (blue ☁ badge appears).

### Image priority (all public surfaces)
```
customImageUrl (Cloudinary)  →  photos[0] (Google Places)  →  GENERIC_IMAGE
```

| File | Where |
|------|-------|
| `VenueCard.jsx` | `heroImage` computation |
| `VenueDetailPage.jsx` | `heroImage` computation |
| `EventCard.jsx` | `resolvedPhoto` chain (via `venueData.customImageUrl`) |
| `VenueDiscoveryPage.jsx` | `thumb` in `ImportedVenueRow` |

`logo` (the small avatar) is unaffected — it remains separate from the hero image.

---

## Files Changed

| File | Change |
|------|--------|
| `src/pages/HomePage.jsx` | Search includes `categoriesHe` + `tags` |
| `src/components/events/EventCard.jsx` | Remove price; add `customImageUrl` to photo priority |
| `src/pages/EventDetailPage.jsx` | Remove priceRow and price from WhatsApp buttons |
| `src/components/venues/VenueCard.jsx` | `customImageUrl` → `photos[0]` → GENERIC |
| `src/pages/VenueDetailPage.jsx` | Same hero image priority |
| `src/pages/admin/VenueDiscoveryPage.jsx` | Cloudinary upload logic + Hebrew search + customImageUrl priority + ☁ badge |
| `src/pages/admin/VenueDiscoveryPage.module.css` | `.uploadImageBtn` + `.customImgBadge` styles |
