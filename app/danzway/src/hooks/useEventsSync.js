import { useEffect } from 'react'
import { useDispatch } from 'react-redux'
import { subscribeToEvents } from '../services/eventsListener'
import { setEvents } from '../store/appSlice'

/**
 * Mounts a Firestore onSnapshot listener for the 'events' collection.
 * Dispatches setEvents on every update — keeps the entire app reactive
 * without manual refetching. Mount once at the app root.
 */
export function useEventsSync() {
  const dispatch = useDispatch()
  useEffect(() => {
    const unsubscribe = subscribeToEvents((events) => {
      dispatch(setEvents(events))
    })
    return unsubscribe
  }, [dispatch])
}
