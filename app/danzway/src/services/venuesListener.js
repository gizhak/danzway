import { collection, onSnapshot } from 'firebase/firestore'
import { db } from './firebase'

/**
 * Subscribes to the 'venues' collection in real-time.
 * Calls onChange with a normalized venues array on every Firestore update.
 * Returns the unsubscribe function — call it on cleanup.
 *
 * Mirrors the Timestamp normalization in venuesSlice.fetchVenues so the
 * shape is identical whether venues arrive via the one-time fetch or here.
 */
export function subscribeToVenues(onChange) {
  return onSnapshot(collection(db, 'venues'), (snapshot) => {
    const venues = snapshot.docs.map((doc) => {
      const data = doc.data()
      return {
        ...data,
        importedAt:        data.importedAt?.toMillis?.()        ?? null,
        lastRefreshed:     data.lastRefreshed?.toMillis?.()     ?? null,
        lastScanTimestamp: data.lastScanTimestamp?.toMillis?.() ?? null,
      }
    })
    onChange(venues)
  })
}
