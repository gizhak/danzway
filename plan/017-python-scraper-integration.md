# Plan 017 — Python Scraper Integration

## Goal
Bridge the Python/Playwright scraper (`scrapers/scraper_test.py`) with the React dashboard so that clicking "Scan" on a venue runs the real headless browser scraper and writes discovered events to Firestore.

---

## Architecture Decision — Technical Bridge

Choose **one** option before coding begins:

- [ *] **Option A — Local Flask API (Recommended for Phase 1)**
  Run a tiny Python HTTP server locally alongside the React dev server. The dashboard POSTs a scan request; Flask runs Playwright and returns events as JSON. No cloud infrastructure needed during development.
  - **Pros:** Zero cloud cost, fastest to implement, full Playwright capability.
  - **Cons:** Requires local Python server to be running; not production-ready by itself.

- [ ] **Option B — Google Cloud Run (Recommended for Production)**
  Package the Python scraper in a Docker container and deploy to Cloud Run. The React app (or a Firebase Cloud Function trigger) calls the Cloud Run URL.
  - **Pros:** Scalable, no local dependency, runs Playwright headless in cloud.
  - **Cons:** Requires Docker + GCP setup, minor cold-start latency (~2–3s).

- [ ] **Option C — Firebase Cloud Function (Node.js Playwright)**
  Replace Python scraper with Node.js using Playwright/Puppeteer inside a Firebase Function. Stays in existing Firebase ecosystem.
  - **Pros:** Single-ecosystem (no Python), Firestore writes stay server-side.
  - **Cons:** Playwright in Firebase Functions requires custom build config; Python scraper is discarded.

**Recommendation:** Start with **Option A** (local Flask) to validate the full pipeline end-to-end, then promote to **Option B** (Cloud Run) for production.

---

## Phase 1 — Local Flask Bridge (Option A)

### Step 1 — Upgrade Python Scraper to Return Structured JSON ✅

- [x] Refactor `scrapers/scraper_test.py` into a proper module: `scrapers/scraper.py`
- [x] Accept `url` and `keywords` as function arguments (no hardcoded values)
- [x] Return structured list instead of printing:
  ```python
  [
    { "day": "חמישי", "type": "Bachata", "time": "21:00", "title": "...", "rawText": "..." },
    ...
  ]
  ```
- [x] Add day-of-week detection (scan `days` list for Hebrew day names near each keyword match)
- [x] Add time extraction via regex: `\d{1,2}:\d{2}`

### Step 2 — Create Flask API Server ✅

- [x] Create `scrapers/server.py` with a single POST endpoint `/scan`
- [x] Accept JSON body: `{ "url": "...", "keywords": ["Salsa", "Bachata", ...] }`
- [x] Call refactored `scraper.run_scan(url, keywords)` and return JSON response
- [x] Add CORS header so React dev server can call it: `Access-Control-Allow-Origin: *`
- [x] Run on port `5001` (avoids conflict with React's 5173)

```bash
# Install deps (run once)
pip install playwright flask flask-cors
playwright install chromium

# Start scraper server
python scrapers/server.py
```

### Step 3 — Dashboard "Scan" Button Integration ✅

File: `app/danzway/src/pages/admin/VenueDiscoveryPage.jsx`

- [x] Add a `scanVenueWithPython(venue)` function that:
  1. POSTs to `http://localhost:5001/scan` with venue's `ticketUrl || website` and keywords
  2. Receives the structured event list
  3. Maps each event to our Firestore schema (see Step 4)
  4. Writes to `pending_events` via existing `upsertPendingEvents()`
- [x] Wire this into the existing per-venue Scan button (replaces `crawlVenueWebsite` in `handleScanVenue`)
- [x] Show the same result badge as the JS crawler: `✓ N events`, `No events`, `Error`

### Step 4 — Data Mapping to Firestore Schema ✅

Map Python scraper output → `pending_events` document:

| Python field | Firestore field | Logic |
|---|---|---|
| `day` (Hebrew day name) | `date` | Use `getNextWeekdayDate(day)` to compute upcoming date (YYYY-MM-DD, local midnight) |
| `type` (dance style) | `styles` | Array: `[type]` |
| `time` | `time` | Stored as-is (HH:MM) |
| `title` | `title` | Raw text or constructed `"${type} @ ${venue.name}"` |
| venue.placeId | `placeId` | Pass from venue object |
| venue.name | `venue` | Venue display name |
| scrape URL | `sourceUrl` | The URL that was scanned |
| `status: "pending"` | `status` | All newly discovered → pending |
| `crawledAt` | `crawledAt` | `new Date().toISOString()` |

**Date Logic (reuse existing `dateUtils.js` pattern):**
```javascript
function getNextWeekdayDate(hebrewDay) {
  const dayMap = { 'ראשון': 0, 'שני': 1, 'שלישי': 2, 'רביעי': 3, 'חמישי': 4, 'שישי': 5, 'שבת': 6 }
  const target = dayMap[hebrewDay]
  const today = new Date()
  const todayDay = today.getDay()
  const daysAhead = (target - todayDay + 7) % 7 || 7  // always future
  const result = new Date(today.getFullYear(), today.getMonth(), today.getDate() + daysAhead)
  return result.toISOString().split('T')[0]  // YYYY-MM-DD local midnight
}
```

### Step 5 — "Clear Before Scan" Support

- [ ] The existing `clearBeforeScan` checkbox already calls `deleteVenueEvents(placeId)` before scan
- [ ] No change needed — Python scan path hooks into the same pre-scan check
- [ ] Verify: `if (clearBeforeScan) await deleteVenueEvents(venue.placeId)` runs before `scanWithPython()`

### Step 6 — Dashboard Auto-Refresh After Scan

- [ ] The existing `onSnapshot` listener on `pending_events` in `VenueDiscoveryPage.jsx` already refreshes the UI
- [ ] After `upsertPendingEvents()` completes, the listener fires and the "Manage Events" panel updates automatically
- [ ] No additional polling needed — verify by confirming `subscribeToEvents()` is mounted on this page

---

## Phase 2 — Production Cloud Run Deployment (Option B)

> Complete Phase 1 and validate the full pipeline first.

- [ ] Create `scrapers/Dockerfile` with Python 3.11 + Playwright + Chromium
- [ ] Create `scrapers/cloudbuild.yaml` for CI/CD deployment
- [ ] Deploy to Cloud Run in `us-central1` (same region as Firestore)
- [ ] Update `scanWithPython()` to use Cloud Run URL instead of `localhost:5001`
- [ ] Add Cloud Run URL to `.env` as `VITE_SCRAPER_URL`
- [ ] Optionally: add Firebase Auth token verification in Flask server for security

---

## File Changes Summary

| File | Change |
|---|---|
| `scrapers/scraper_test.py` | Keep as reference POC |
| `scrapers/scraper.py` | NEW — refactored scraper module returning JSON |
| `scrapers/server.py` | NEW — Flask API server wrapping scraper |
| `scrapers/requirements.txt` | NEW — `playwright`, `flask`, `flask-cors` |
| `app/danzway/src/pages/admin/VenueDiscoveryPage.jsx` | Add `scanWithPython()` + wire to Scan button |
| `app/danzway/src/i18n/dateUtils.js` | Add `getNextWeekdayDate(hebrewDay)` helper |

---

## Testing Checklist

- [ ] `python scrapers/server.py` starts without error
- [ ] POST to `localhost:5001/scan` with vdance.co.il URL returns events JSON
- [ ] Clicking Scan on a venue in dashboard shows spinner → result badge
- [ ] Events appear in `pending_events` collection in Firestore console
- [ ] Admin approves event → appears on map via `onSnapshot`
- [ ] "Clear before scan" wipes old events before new ones are written
- [ ] Date for "חמישי" resolves to next upcoming Thursday (not past)
- [ ] Hebrew + English keywords both detected

---

## Status: AWAITING ARCHITECTURE DECISION
Select Option A, B, or C above before implementation begins.
