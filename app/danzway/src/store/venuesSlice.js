import { createSlice, createAsyncThunk, createSelector } from '@reduxjs/toolkit'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../services/firebase'

// ─── Async Thunk ───────────────────────────────────────────────────────────

export const fetchVenues = createAsyncThunk('venues/fetchVenues', async () => {
  const snapshot = await getDocs(collection(db, 'venues'))
  return snapshot.docs.map((doc) => {
    const data = doc.data()
    // Convert Firestore Timestamps to plain numbers so Redux doesn't complain
    return {
      ...data,
      importedAt:    data.importedAt?.toMillis?.()    ?? null,
      lastRefreshed: data.lastRefreshed?.toMillis?.() ?? null,
    }
  })
})

// ─── Slice ─────────────────────────────────────────────────────────────────

const venuesSlice = createSlice({
  name: 'venues',
  initialState: {
    venues: [],
    status: 'idle',   // 'idle' | 'loading' | 'succeeded' | 'failed'
    error:  null,
  },
  reducers: {
    /**
     * Optimistic local update for a single field on a venue.
     * Payload: { placeId: string, field: string, value: any }
     */
    updateVenueField(state, action) {
      const { placeId, field, value } = action.payload
      const venue = state.venues.find((v) => v.placeId === placeId)
      if (venue) venue[field] = value
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchVenues.pending, (state) => {
        state.status = 'loading'
        state.error  = null
      })
      .addCase(fetchVenues.fulfilled, (state, action) => {
        state.status = 'succeeded'
        state.venues = action.payload
      })
      .addCase(fetchVenues.rejected, (state, action) => {
        state.status = 'failed'
        state.error  = action.error.message ?? 'Failed to load venues'
      })
  },
})

export const { updateVenueField } = venuesSlice.actions

export default venuesSlice.reducer

// ─── Selectors ─────────────────────────────────────────────────────────────

export const selectAllVenues    = (state) => state.venues.venues
export const selectVenuesStatus = (state) => state.venues.status
export const selectVenuesError  = (state) => state.venues.error

/**
 * Memoized selector — returns a Set of all placeIds already in Firestore.
 */
export const selectImportedPlaceIds = createSelector(
  (state) => state.venues.venues,
  (venues) => new Set(venues.map((v) => v.placeId))
)

/**
 * Memoized selector — venues shown on the home feed.
 * Shows every venue UNLESS the admin has explicitly set active: false.
 * This means: newly imported venues appear immediately; admin toggles hide them.
 */
export const selectActiveVenues = createSelector(
  (state) => state.venues.venues,
  (venues) => venues.filter((v) => v.active !== false)
)

/**
 * Memoized selector — returns a { [venueName]: venue } map for EventCard logo lookup.
 */
export const selectVenuesByName = createSelector(
  (state) => state.venues.venues,
  (venues) => {
    const map = {}
    venues.forEach((v) => { map[v.name] = v })
    return map
  }
)
