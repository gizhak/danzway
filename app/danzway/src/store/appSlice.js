import { createSlice } from '@reduxjs/toolkit'

const appSlice = createSlice({
  name: 'app',
  initialState: {
    // Record<eventId, true> — fully serializable, O(1) lookup.
    // Stored as a plain object so Redux's serializableCheck stays silent.
    savedIds: {},
    styleFilter: 'all',
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
})

export const { toggleSave, setStyleFilter } = appSlice.actions
export default appSlice.reducer

// ─── Selectors ────────────────────────────────────────────
export const selectSavedIds      = (state) => state.app.savedIds
export const selectSavedCount    = (state) => Object.keys(state.app.savedIds).length
export const selectStyleFilter   = (state) => state.app.styleFilter
// Curried selector — call as useSelector(selectIsSaved(event.id))
export const selectIsSaved       = (id) => (state) => !!state.app.savedIds[id]
