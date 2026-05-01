import { collection, onSnapshot } from 'firebase/firestore'
import { db } from './firebase'

/**
 * Subscribes to the 'events' collection in real-time.
 * Calls onChange with a normalized events array on every Firestore update.
 * Returns the unsubscribe function — call it on cleanup.
 */
export function subscribeToEvents(onChange) {
  return onSnapshot(collection(db, 'events'), (snapshot) => {
    const events = snapshot.docs.map((doc) => {
      const data = doc.data()
      return {
        ...data,
        id:         doc.id,
        createdAt:  data.createdAt?.toMillis?.()  ?? null,
        approvedAt: data.approvedAt?.toMillis?.() ?? null,
      }
    })
    onChange(events)
  })
}
