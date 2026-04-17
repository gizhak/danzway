import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
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
    styleFilter: 'all',
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
    setStyleFilter(state, action) {
      state.styleFilter = action.payload
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

export const { toggleSave, setStyleFilter } = appSlice.actions
export default appSlice.reducer

// ─── Selectors ────────────────────────────────────────────
export const selectSavedIds      = (state) => state.app.savedIds
export const selectSavedCount    = (state) => Object.keys(state.app.savedIds).length
export const selectStyleFilter   = (state) => state.app.styleFilter
// Curried selector — call as useSelector(selectIsSaved(event.id))
export const selectIsSaved       = (id) => (state) => !!state.app.savedIds[id]
export const selectAllEvents     = (state) => state.app.events
export const selectEventsStatus  = (state) => state.app.status
export const selectEventsError   = (state) => state.app.error
