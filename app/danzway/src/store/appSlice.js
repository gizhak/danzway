import { createSlice, createAsyncThunk, createSelector } from '@reduxjs/toolkit'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../services/firebase'

// ─── Async Thunk ───────────────────────────────────────────
export const fetchEvents = createAsyncThunk('app/fetchEvents', async () => {
  const snapshot = await getDocs(collection(db, 'events'))
  return snapshot.docs.map((doc) => doc.data())
})

// ─── Slice ─────────────────────────────────────────────────
const appSlice = createSlice({
  name: 'app',
  initialState: {
    // Record<eventId, true> — fully serializable, O(1) lookup.
    savedIds: {},
    styleFilters: [],  // string[] — empty = show all; multiple = AND logic
    events: [],
    status: 'idle',   // 'idle' | 'loading' | 'succeeded' | 'failed'
    error: null,
  },
  reducers: {
    toggleSave(state, action) {
      const id = action.payload
      if (state.savedIds[id]) {
        delete state.savedIds[id]
      } else {
        state.savedIds[id] = true
      }
    },
    toggleStyleFilter(state, action) {
      const style = action.payload
      if (style === 'all') {
        // "All" clears every active filter
        state.styleFilters = []
      } else {
        const idx = state.styleFilters.indexOf(style)
        if (idx >= 0) {
          state.styleFilters.splice(idx, 1)   // deselect
        } else {
          state.styleFilters.push(style)       // select
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

export const { toggleSave, toggleStyleFilter } = appSlice.actions
export default appSlice.reducer

// ─── Selectors ────────────────────────────────────────────
export const selectSavedIds      = (state) => state.app.savedIds
export const selectSavedCount    = (state) => Object.keys(state.app.savedIds).length

/**
 * Returns { [venueName]: nextUpcomingEvent } — the soonest future event per venue.
 * Used by VenueCard to show the next party date badge.
 */
export const selectNextEventByVenueName = createSelector(
  (state) => state.app.events,
  (events) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const map = {}
    events.forEach((e) => {
      if (!e.venue || !e.date) return
      const d = new Date(e.date)
      if (d < today) return                          // past event — skip
      const existing = map[e.venue]
      if (!existing || d < new Date(existing.date)) {
        map[e.venue] = e                             // keep the earliest upcoming
      }
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
export const selectIsSaved       = (id) => (state) => !!state.app.savedIds[id]
export const selectAllEvents     = (state) => state.app.events
export const selectEventsStatus  = (state) => state.app.status
export const selectEventsError   = (state) => state.app.error
