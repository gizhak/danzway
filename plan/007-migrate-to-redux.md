# Plan 007: Migrate State Management — Zustand → Redux Toolkit
Status: Pending Approval

---

## Current State

- Zustand store at `src/store/useAppStore.js` holds `savedIds` (a `Set`) and `styleFilter` (a string).
- Custom `setAwareStorage` adapter serializes `Set ↔ Array` for `localStorage`.
- Three components read from the store: `HomePage`, `EventCard`, `BottomNav`.
- One component writes to the store: `EventCard` (toggleSave), `HomePage` (setStyleFilter), `BottomNav` (reads savedIds.size).
- `ProfilePage` reads `savedIds` to filter the saved events list.

---

## Important Design Note — `Set` is not Redux-compatible

Redux Toolkit enables a `serializableCheck` middleware by default that **throws warnings for any non-serializable value in state** — including `Set`. Using a `Set` directly in a Redux slice will produce console errors on every dispatch.

**Solution:** store `savedIds` as a plain object record `{ [eventId]: true }` instead of a `Set`.

- Checking if saved: `!!savedIds[id]` — O(1), no conversion needed.
- Counting saved: `Object.keys(savedIds).length`
- Toggling: add/remove key in the reducer with RTK's `immer`-powered draft.
- Fully serializable — no custom storage adapter needed.

This is cleaner than the Zustand approach because the state shape itself is JSON-native.

---

## localStorage Persistence — Recommended Approach

**Option A: `store.subscribe()` (recommended — no extra dependency)**
- Load initial state from `localStorage` before creating the store (preloadedState).
- Subscribe to store changes; on each change, serialize and write the relevant slices to `localStorage`.
- ~15 lines of code total. No new package, no `PersistGate`, no wrapper components.

**Option B: `redux-persist`**
- Full-featured library, handles partial state, versioning, migrations.
- Requires `PersistGate` in `main.jsx`, a `persistReducer` wrapper, a `persistStore` call.
- Overkill for two fields; adds ~10 kB.

> **Recommendation: Option A** — the state is two fields. A `subscribe()` listener is the right tool here. Clean, zero dependencies.

**→ Pick one:**
- [ ] A — `store.subscribe()` manual persistence ← recommended
- [ ] B — `redux-persist`

---

## Atomic Steps

### Step 1 — Install packages / remove Zustand
```
npm install @reduxjs/toolkit react-redux
npm uninstall zustand
```
Delete `src/store/useAppStore.js`.

### Step 2 — Create `src/store/appSlice.js`
RTK slice with two pieces of state:

```js
// State shape
{
  savedIds:    {},          // Record<eventId, true>  — serializable, O(1) lookup
  styleFilter: 'all',       // string
}

// Actions
toggleSave(state, action)  // payload: eventId string
setStyleFilter(state, action) // payload: style string

// Selectors (exported alongside slice)
selectSavedIds(state)       // → the record object
selectIsSaved(id)(state)    // → boolean
selectSavedCount(state)     // → number (Object.keys length)
selectStyleFilter(state)    // → string
```

All state is plain JSON — no custom serialization needed.

### Step 3 — Create `src/store/index.js`
- Load persisted state from `localStorage` on startup (preloadedState).
- Create the Redux store with `configureStore`.
- Subscribe to store changes: on each update, write `savedIds` and `styleFilter` to `localStorage` under key `'danzway-app'`.

```js
// Pseudocode shape
function loadState() { /* read + JSON.parse from localStorage */ }
function saveState(state) { /* JSON.stringify + localStorage.setItem */ }

const store = configureStore({
  reducer: { app: appReducer },
  preloadedState: { app: loadState() },
})

store.subscribe(() => saveState(store.getState().app))
```

### Step 4 — Wrap app with Provider in `main.jsx`
```jsx
import { Provider } from 'react-redux'
import store from './store'
// wrap <App /> in <Provider store={store}>
```

### Step 5 — Update `HomePage.jsx`
- Replace `useAppStore` with `useSelector(selectStyleFilter)` and `useDispatch` + `setStyleFilter` action.

### Step 6 — Update `EventCard.jsx`
- Replace `useAppStore` with `useSelector(selectIsSaved(id))` and `useDispatch` + `toggleSave` action.

### Step 7 — Update `BottomNav.jsx`
- Replace `useAppStore` with `useSelector(selectSavedCount)`.

### Step 8 — Update `ProfilePage.jsx`
- Replace `useAppStore` with `useSelector(selectSavedIds)` and `useDispatch` + `toggleSave`.
- Convert the `savedIds` record to a filtered list: `mockEvents.filter(e => savedIds[e.id])`.

### Step 9 — Build check
- `npm run build` — zero errors, zero serialization warnings.

---

## Files Changed

| File | Change |
|------|--------|
| `src/store/useAppStore.js` | **Deleted** |
| `src/store/appSlice.js` | **New** — RTK slice + selectors |
| `src/store/index.js` | **New** — configureStore + localStorage subscribe |
| `src/main.jsx` | Add `<Provider store={store}>` |
| `src/pages/HomePage.jsx` | `useAppStore` → `useSelector` / `useDispatch` |
| `src/components/events/EventCard.jsx` | `useAppStore` → `useSelector` / `useDispatch` |
| `src/components/layout/BottomNav.jsx` | `useAppStore` → `useSelector` |
| `src/pages/ProfilePage.jsx` | `useAppStore` → `useSelector` / `useDispatch` |
| `package.json` | Add `@reduxjs/toolkit`, `react-redux`; remove `zustand` |

---

## Out of Scope

- Any visual / UI changes — this is a pure state-layer swap.
- redux-persist — deferred by design (Option A chosen).

---

**Check the persistence option box, then tell me to proceed.**
