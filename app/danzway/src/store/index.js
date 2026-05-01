import { configureStore } from '@reduxjs/toolkit'
import appReducer    from './appSlice'
import venuesReducer from './venuesSlice'

const STORAGE_KEY = 'danzway-app-v2'

/**
 * Load persisted state from localStorage.
 *
 * Handles two formats:
 *  1. New Redux format  — { savedIds: {...}, styleFilter: '...' }
 *  2. Old Zustand format — { state: { savedIds: [...], styleFilter: '...' }, version: 0 }
 *     Written by Plan 006. We migrate it once on first load and clear the old key.
 *
 * Returns undefined (not null) when nothing is found so Redux uses initialState.
 */
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return undefined

    const parsed = JSON.parse(raw)

    // ── Detect old Zustand envelope ──────────────────────
    if (parsed && parsed.state && typeof parsed.state === 'object') {
      const { savedIds, styleFilter } = parsed.state
      // savedIds was stored as an Array by the Zustand adapter
      const migratedSavedIds = Array.isArray(savedIds)
        ? Object.fromEntries(savedIds.map((id) => [id, true]))
        : {}
      // Overwrite with the clean Redux format so next load is fast
      const migrated = {
        savedIds:     migratedSavedIds,
        styleFilters: [],
        events:       [],
        status:       'idle',
        error:        null,
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated))
      return { app: migrated }
    }

    // ── Current Redux format ──────────────────────────────
    if (parsed && typeof parsed.savedIds === 'object' && !Array.isArray(parsed.savedIds)) {
      return {
        app: {
          savedIds:      parsed.savedIds      ?? {},
          savedVenueIds: parsed.savedVenueIds ?? {},
          styleFilters:  [],
          events:        [],
          status:        'idle',
          error:         null,
        },
      }
    }

    // Unrecognised format — start fresh
    localStorage.removeItem(STORAGE_KEY)
    return undefined
  } catch {
    // Corrupted data — start fresh
    localStorage.removeItem(STORAGE_KEY)
    return undefined
  }
}

/**
 * Persist only the app slice fields we care about.
 * Called on every store change via subscribe().
 */
function saveState(state) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        savedIds:      state.app.savedIds,
        savedVenueIds: state.app.savedVenueIds,
      })
    )
  } catch {
    // localStorage unavailable (private mode, quota exceeded) — silently skip
  }
}

const store = configureStore({
  reducer: {
    app:    appReducer,
    venues: venuesReducer,
  },
  preloadedState: loadState(),
})

// Write to localStorage on every state change.
// Throttling is unnecessary here — the writes are tiny and infrequent.
store.subscribe(() => saveState(store.getState()))

export default store
