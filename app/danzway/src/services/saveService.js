import { doc, updateDoc, increment } from 'firebase/firestore'
import { db } from './firebase'
import { trackPartySaved, trackVenueSaved } from './analyticsService'

/**
 * Atomically increments or decrements saveCount on a Firestore event.
 * Skips silently for virtual recurring events (no Firestore document).
 * Also logs a Firebase Analytics event on save (delta === 1).
 */
export async function updateEventSaveCount(eventId, isRecurring, delta, eventName = '') {
  if (delta === 1) trackPartySaved(eventName, eventId)
  if (isRecurring) return
  try {
    await updateDoc(doc(db, 'events', eventId), { saveCount: increment(delta) })
  } catch {
    // Silently ignore — permission error or document not found
  }
}

/**
 * Atomically increments or decrements saveCount on a Firestore venue.
 * Also logs a Firebase Analytics event on save (delta === 1).
 */
export async function updateVenueSaveCount(placeId, delta, venueName = '') {
  if (delta === 1) trackVenueSaved(venueName, placeId)
  if (!placeId) return
  try {
    await updateDoc(doc(db, 'venues', placeId), { saveCount: increment(delta) })
  } catch {
    // Silently ignore — permission error or document not found
  }
}
