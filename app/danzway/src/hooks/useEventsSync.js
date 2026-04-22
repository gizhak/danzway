import { useEffect } from 'react'
import { useDispatch } from 'react-redux'
import { subscribeToEvents } from '../services/eventsListener'
import { subscribeToVenues } from '../services/venuesListener'
import { setEvents } from '../store/appSlice'
import { setVenues } from '../store/venuesSlice'

/**
 * Mounts real-time Firestore listeners for both the 'events' and 'venues'
 * collections. Dispatches setEvents / setVenues on every snapshot so the
 * entire app — including the Map's selectNextEventByVenueMap selector, which
 * depends on BOTH slices — stays reactive without manual refetching.
 *
 * Mount once at the app root (App.jsx).
 */
export function useEventsSync() {
  const dispatch = useDispatch()
  useEffect(() => {
    const unsubEvents  = subscribeToEvents((events) => dispatch(setEvents(events)))
    const unsubVenues  = subscribeToVenues((venues) => dispatch(setVenues(venues)))
    return () => {
      unsubEvents()
      unsubVenues()
    }
  }, [dispatch])
}
