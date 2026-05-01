import { createSlice, createAsyncThunk, createSelector } from '@reduxjs/toolkit'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../services/firebase'

// ─── Async Thunk ───────────────────────────────────────────
export const fetchEvents = createAsyncThunk('app/fetchEvents', async () => {
  const snapshot = await getDocs(collection(db, 'events'))
  return snapshot.docs.map((doc) => {
    const data = doc.data()
    return {
      ...data,
      id:         doc.id,
      createdAt:  data.createdAt?.toMillis?.()  ?? null,
      approvedAt: data.approvedAt?.toMillis?.() ?? null,
    }
  })
})

// ─── Slice ─────────────────────────────────────────────────
const appSlice = createSlice({
  name: 'app',
  initialState: {
    savedIds:      {},   // Record<eventId, true>  — events saved by user
    savedVenueIds: {},   // Record<placeId, true>  — venues saved by user
    styleFilters: [],
    events: [],
    status: 'idle',
    error: null,
  },
  reducers: {
    setEvents(state, action) {
      state.events = action.payload
      state.status = 'succeeded'
    },
    toggleSave(state, action) {
      const id = action.payload
      if (state.savedIds[id]) {
        delete state.savedIds[id]
      } else {
        state.savedIds[id] = true
      }
    },
    toggleSaveVenue(state, action) {
      const id = action.payload
      if (state.savedVenueIds[id]) {
        delete state.savedVenueIds[id]
      } else {
        state.savedVenueIds[id] = true
      }
    },
    toggleStyleFilter(state, action) {
      if (!Array.isArray(state.styleFilters)) state.styleFilters = []
      const style = action.payload
      if (style === 'all') {
        state.styleFilters = []                          // clear all → show everything
      } else {
        const idx = state.styleFilters.indexOf(style)
        if (idx >= 0) {
          state.styleFilters.splice(idx, 1)             // deselect
        } else {
          state.styleFilters.push(style)                // add to selection
        }
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchEvents.pending, (state) => {
        state.status = 'loading'
        state.error = null
      })
      .addCase(fetchEvents.fulfilled, (state, action) => {
        state.status = 'succeeded'
        state.events = action.payload
      })
      .addCase(fetchEvents.rejected, (state, action) => {
        state.status = 'failed'
        state.error = action.error.message ?? 'Failed to load events'
      })
  },
})

export const { setEvents, toggleSave, toggleSaveVenue, toggleStyleFilter } = appSlice.actions
export default appSlice.reducer

// ─── Selectors ────────────────────────────────────────────
export const selectSavedIds       = (state) => state.app.savedIds
export const selectSavedVenueIds  = (state) => state.app.savedVenueIds
export const selectSavedCount     = (state) =>
  Object.keys(state.app.savedIds).length + Object.keys(state.app.savedVenueIds).length

// Normalise venue name for loose matching (lowercase, collapse spaces)
function normKey(str) {
  return (str ?? '').toLowerCase().replace(/\s+/g, ' ').trim()
}

/**
 * Returns a lookup map for the soonest upcoming event per venue.
 * Keys stored: exact event.venue  +  normalised event.venue  +  event.placeId (if present).
 * VenueCard should try all three to handle slight name differences or
 * venues whose name was imported in a different language.
 */
export const selectNextEventByVenueName = createSelector(
  (state) => state.app.events,
  (events) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const map = {}

    function put(key, event) {
      if (!key) return
      const d = new Date(event.date)
      const existing = map[key]
      if (!existing || d < new Date(existing.date)) map[key] = event
    }

    events.forEach((e) => {
      if (!e.venue || !e.date) return
      const d = new Date(e.date)
      if (d < today) return                        // past — skip

      put(e.venue,          e)                     // exact
      put(normKey(e.venue), e)                     // normalised (case / spaces)
      if (e.placeId) put(e.placeId, e)            // placeId if event was refreshed
    })
    return map
  }
)
// createSelector memoises the fallback [] so useSelector never sees a new reference
export const selectStyleFilters  = createSelector(
  (state) => state.app.styleFilters,
  (filters) => (Array.isArray(filters) ? filters : [])
)
// Curried selector — call as useSelector(selectIsSaved(event.id))
export const selectIsSaved        = (id) => (state) => !!state.app.savedIds[id]
export const selectIsVenueSaved   = (id) => (state) => !!state.app.savedVenueIds[id]
export const selectAllEvents     = (state) => state.app.events
export const selectEventsStatus  = (state) => state.app.status
export const selectEventsError   = (state) => state.app.error
