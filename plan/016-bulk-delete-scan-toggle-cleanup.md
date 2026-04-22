# 016 — Bulk Delete, Scan Toggle & Global State Cleanup

## Overview

Three targeted infrastructure upgrades to the admin dashboard:
1. **Bulk Delete** — "Clear All Events" per venue (real + recurring), one click
2. **Scan Toggle** — "Clear existing events before scan" checkbox per venue
3. **State Cleanup** — Remove the redundant `dispatch(fetchEvents())` call that fights the live `onSnapshot` listener

All three share the same new Firestore helper. No new files are needed — changes are scoped to `eventsService.js` and `VenueDiscoveryPage.jsx`.

---

## Background: How Deletion Currently Works

| Event type | Firestore state | How selector handles it |
|---|---|---|
| Real event | Document exists (`isCancelled` absent) | Displayed normally |
| Cancelled stub | Document exists (`isCancelled: true`) | Added to `realIds` set → suppresses virtual recurring slot, never rendered |
| Recurring virtual | No Firestore document — generated on the fly | Rendered unless a matching stub exists |

**Consequence for Bulk Delete:** Deleting real event documents is straightforward (`deleteDoc`). Suppressing recurring virtual events requires creating `isCancelled` stubs with the same deterministic IDs the selector uses (`{placeId}-rec-{dayOfWeek}-{dateStr}`).

---

## Issue 1 — Bulk Delete ("Clear All Events" per venue)

### New Firestore helper: `deleteVenueEvents`

**File:** `src/services/eventsService.js`

Add one exported function using Firestore `writeBatch` (max 500 ops — safe for any realistic venue):

```js
export async function deleteVenueEvents(placeId, recurringSchedule) {
  const batch = writeBatch(db)

  // ── Step 1: delete ALL real Firestore documents for this venue ────────────
  const q = query(collection(db, 'events'), where('placeId', '==', placeId))
  const snap = await getDocs(q)
  snap.docs.forEach((d) => batch.delete(d.ref))

  // ── Step 2: create isCancelled stubs for all upcoming recurring slots ──────
  // Mirrors the selector's generateRecurringEvents logic (8 weeks, same IDs)
  if (recurringSchedule?.days?.length) {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const limit = 8 * 7   // days

    recurringSchedule.days.forEach((dayOfWeek) => {
      const daysToFirst = (dayOfWeek - today.getDay() + 7) % 7
      const cur = new Date(today)
      cur.setDate(today.getDate() + daysToFirst)

      while (Math.round((cur - today) / 86400000) <= limit) {
        const yyyy = cur.getFullYear()
        const mm   = String(cur.getMonth() + 1).padStart(2, '0')
        const dd   = String(cur.getDate()).padStart(2, '0')
        const dateStr = `${yyyy}-${mm}-${dd}`
        const stubId  = `${placeId}-rec-${dayOfWeek}-${dateStr}`

        batch.set(doc(db, 'events', stubId), {
          id:          stubId,
          placeId,
          date:        dateStr,
          isCancelled: true,
          createdAt:   serverTimestamp(),
        })
        cur.setDate(cur.getDate() + 7)
      }
    })
  }

  await batch.commit()
}
```

**Imports needed in eventsService.js:** `writeBatch`, `query`, `where` (add to existing firebase/firestore import).

### New handler in VenueDiscoveryPage

**File:** `src/pages/admin/VenueDiscoveryPage.jsx`

Add `handleClearVenueEvents(venue)` alongside `handleCancelInstance`:

```js
async function handleClearVenueEvents(venue) {
  const count = (eventsByVenue[venue.placeId] ?? []).length
  if (!window.confirm(
    `Delete all ${count} upcoming events for "${venue.name}"?\n\nThis cannot be undone.`
  )) return

  try {
    await deleteVenueEvents(venue.placeId, venue.recurringSchedule)
    showToast(`✓ All events cleared for ${venue.name}`)
  } catch (err) {
    console.error('[ClearVenueEvents]', err)
    showToast('⚠️ Could not clear events')
  }
  // No dispatch(fetchEvents()) needed — onSnapshot fires automatically
}
```

### UI: "Clear All" button in ManageEventsPanel

**File:** `src/pages/admin/VenueDiscoveryPage.jsx` — `ManageEventsPanel` component (lines 461–517)

- Add `onClearAll` prop
- Add a destructive "🗑 Clear All" button in the panel header row, only shown when `venueEvents.length > 0`
- Wire `onClearAll` from `ImportedVenueRow` → `VenueDiscoveryPage` → `handleClearVenueEvents(venue)`

**Deletion flow (end-to-end):**
1. Admin clicks "🗑 Clear All" → confirm dialog
2. `deleteVenueEvents` batch-deletes all real docs + writes stubs for all recurring slots
3. Firestore triggers `onSnapshot` → `setEvents` replaces Redux state
4. `selectNextEventByVenueMap` recomputes → map markers lose glow / disappear
5. `selectEventsForActiveVenues` recomputes → events list empties for that venue
6. Dashboard `eventsByVenue` memo updates → panel shows "No upcoming events"

**Files changed:** `src/services/eventsService.js`, `src/pages/admin/VenueDiscoveryPage.jsx`

---

## Issue 2 — "Clear Existing Events Before Scan" Toggle

### State

**File:** `src/pages/admin/VenueDiscoveryPage.jsx`

Add one state map alongside the existing `venueScanning` map:

```js
const [clearBeforeScan, setClearBeforeScan] = useState({})  // Record<placeId, boolean>
```

### UI: toggle in ImportedVenueRow

Add a small labelled checkbox above (or beside) the Scan button. Pass as props:
- `clearBeforeScan={clearBeforeScan[venue.placeId] ?? false}`
- `onToggleClearBeforeScan={() => setClearBeforeScan(prev => ({ ...prev, [venue.placeId]: !prev[venue.placeId] }))}`

Rendered in `ImportedVenueRow`:
```jsx
<label className={styles.clearBeforeScanLabel}>
  <input
    type="checkbox"
    checked={clearBeforeScan}
    onChange={onToggleClearBeforeScan}
  />
  Clear before scan
</label>
```

### Modified handleScanVenue

```js
async function handleScanVenue(venue) {
  const { placeId } = venue
  setVenueScanning(prev => ({ ...prev, [placeId]: true }))
  setVenueScanResult(prev => ({ ...prev, [placeId]: null }))

  try {
    // ── NEW: clear existing events if toggle is on ──────────────────────────
    if (clearBeforeScan[placeId]) {
      await deleteVenueEvents(placeId, venue.recurringSchedule)
    }

    const result = await crawlVenueWebsite(venue)
    // ... rest unchanged
  }
}
```

**Files changed:** `src/pages/admin/VenueDiscoveryPage.jsx` only (uses `deleteVenueEvents` already imported for Issue 1)

---

## Issue 3 — Global State Cleanup (remove redundant dispatch)

### What the problem is

`handleCancelInstance` (line 1703) calls `dispatch(fetchEvents())` after every single cancellation. With the `onSnapshot` listener active, this is redundant:
- `onSnapshot` fires within milliseconds of any Firestore write
- `dispatch(fetchEvents())` triggers a second full `getDocs` read on top of that
- This causes a double-update flicker and wastes a Firestore read

### Fix

**File:** `src/pages/admin/VenueDiscoveryPage.jsx` — line 1703

Remove the single line:
```js
dispatch(fetchEvents())   // ← delete this
```

`onSnapshot` already calls `setEvents` the moment the write lands, so the UI updates automatically.

### Verification

Once removed, confirm the following in browser devtools:
- Cancel one event → Firestore write succeeds
- Without any manual dispatch, the event disappears from the panel and the map marker updates within ~1 second
- No double-render visible in React DevTools

**Files changed:** `src/pages/admin/VenueDiscoveryPage.jsx` only (one line deletion)

---

## Full File Change Summary

| File | Action | Purpose |
|---|---|---|
| `src/services/eventsService.js` | Edit | Add `deleteVenueEvents` (batch delete real events + write recurring stubs) |
| `src/pages/admin/VenueDiscoveryPage.jsx` | Edit | `handleClearVenueEvents` handler, `clearBeforeScan` state, toggle UI, `ManageEventsPanel` "Clear All" button, modified `handleScanVenue`, remove `dispatch(fetchEvents())` |

---

## Approval Checklist

- [ ] Bulk delete approach approved (batch `deleteDoc` + `isCancelled` stubs for recurring)
- [ ] "Clear before scan" as a per-venue checkbox toggle approved
- [ ] Removing `dispatch(fetchEvents())` from `handleCancelInstance` approved
- [ ] Ready to implement
