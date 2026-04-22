# 015 — Date-Day Sync, Real-time Map & Data Flow Fixes

## Overview

Three interconnected issues affecting correctness and live reactivity of the app:
1. Date strings are shifted by -1 day in Israel (UTC+3) due to UTC/local timezone mismatch.
2. Map and event list do not update when Firestore data changes — requires manual page reload.
3. Map and Events list must share a single reactive source of truth.

---

## Issue 1 — Date-Day Synchronization Bug

### Root Cause

In `src/store/selectors.js` (line 35), recurring event dates are generated using:

```js
const dateStr = current.toISOString().slice(0, 10)
```

`toISOString()` always outputs UTC. Since Israel is **UTC+3**, a local date like July 27 00:00 IST becomes July 26 21:00 UTC — yielding `"2025-07-26"` instead of `"2025-07-27"`. The event title says "Sunday Night" while the dateStr is Saturday.

Secondary: `src/i18n/dateUtils.js` parses ISO date-only strings with `new Date(dateStr)`, which JavaScript treats as **UTC midnight**. Then `setHours(0, 0, 0, 0)` snaps to local midnight. Safe for IST (UTC+3) but fragile.

### Steps

1. **`src/store/selectors.js` (line 35):** Replace `current.toISOString().slice(0, 10)` with a local-timezone formatter:
   ```js
   const yyyy = current.getFullYear()
   const mm   = String(current.getMonth() + 1).padStart(2, '0')
   const dd   = String(current.getDate()).padStart(2, '0')
   const dateStr = `${yyyy}-${mm}-${dd}`
   ```

2. **`src/i18n/dateUtils.js`:** Add a private `parseLocalDate(dateStr)` helper:
   ```js
   function parseLocalDate(dateStr) {
     const [y, m, d] = dateStr.split('-').map(Number)
     return new Date(y, m - 1, d) // local constructor — no UTC shift
   }
   ```
   Update `relativeDate`, `shortMonthDay`, and `profileDate` to use it. Removes the fragile `setHours` reset.

### Files changed
- `src/store/selectors.js`
- `src/i18n/dateUtils.js`

---

## Issue 2 — Real-time Map Synchronization

### Root Cause

`src/store/appSlice.js` (lines 6–16) uses `getDocs()` — a one-time fetch. `MapPage.jsx` (lines 268–270) dispatches `fetchEvents()` only when `status === 'idle'`, so it never re-fetches after the initial load. Admin changes are invisible until a manual page reload.

### Steps

1. **`src/store/appSlice.js`:** Add a `setEvents` reducer so the store can be updated externally without the async thunk lifecycle:
   ```js
   setEvents(state, action) {
     state.events = action.payload
     state.status = 'succeeded'
   }
   ```

2. **New file `src/services/eventsListener.js`:** Encapsulates the Firestore real-time subscription:
   ```js
   import { collection, onSnapshot } from 'firebase/firestore'
   import { db } from './firebase'

   export function subscribeToEvents(onChange) {
     return onSnapshot(collection(db, 'events'), (snapshot) => {
       const events = snapshot.docs.map((doc) => {
         const data = doc.data()
         return {
           ...data,
           createdAt:  data.createdAt?.toMillis?.()  ?? null,
           approvedAt: data.approvedAt?.toMillis?.() ?? null,
         }
       })
       onChange(events)
     })
   }
   ```
   Returns the unsubscribe function. Mirrors the Timestamp normalization of the existing `fetchEvents` thunk.

3. **New file `src/hooks/useEventsSync.js`:** React hook that starts the listener once and dispatches `setEvents` on every Firestore update:
   ```js
   import { useEffect } from 'react'
   import { useDispatch } from 'react-redux'
   import { subscribeToEvents } from '../services/eventsListener'
   import { setEvents } from '../store/appSlice'

   export function useEventsSync() {
     const dispatch = useDispatch()
     useEffect(() => {
       const unsubscribe = subscribeToEvents((events) => {
         dispatch(setEvents(events))
       })
       return unsubscribe
     }, [dispatch])
   }
   ```

4. **`src/App.jsx`:** Mount `useEventsSync()` at the root level — one call, app-wide. The existing `fetchEvents()` dispatch in MapPage can be removed since `onSnapshot` fires immediately on attach (covering the initial load).

### Files changed
- `src/store/appSlice.js`
- `src/App.jsx`

### Files created
- `src/services/eventsListener.js`
- `src/hooks/useEventsSync.js`

---

## Issue 3 — Data Flow Integrity

### Root Cause

No additional code bug — this is a consequence of Issue 2 not being solved. Both the Map and the Events list already read from the **same Redux slice** (`state.app.events`):

| Component | Selector | Source |
|---|---|---|
| `MapPage` | `selectNextEventByVenueName` | `state.app.events` |
| `PartiesPage` | `selectEventsForActiveVenues` | `state.app.events` |

Once the `onSnapshot` listener (Issue 2) keeps `state.app.events` live, **all downstream selectors are automatically reactive** — no additional changes required.

### Verification

After wiring up the listener, confirm via browser devtools that:
- A Firestore write (add/edit/delete) triggers a Redux state update
- Both MapPage markers and PartiesPage event cards reflect the change within ~1 second
- No manual page refresh is needed

---

## Full File Change Summary

| File | Action | Purpose |
|---|---|---|
| `src/store/selectors.js` | Edit | Fix `toISOString()` → local date format |
| `src/i18n/dateUtils.js` | Edit | Add `parseLocalDate`, harden all date parsing |
| `src/store/appSlice.js` | Edit | Add `setEvents` reducer |
| `src/services/eventsListener.js` | Create | Firestore `onSnapshot` subscription |
| `src/hooks/useEventsSync.js` | Create | Hook to run listener and dispatch updates |
| `src/App.jsx` | Edit | Mount `useEventsSync()` at root |

---

## Approval Checklist

- [ ] Date-Day fix approach approved (local date formatter + `parseLocalDate`)
- [ ] Real-time listener approach approved (`onSnapshot` → Redux `setEvents`)
- [ ] Root-level `useEventsSync` hook placement approved (`App.jsx`)
- [ ] Ready to implement
