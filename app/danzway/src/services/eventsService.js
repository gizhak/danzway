import { doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from './firebase'

/**
 * Saves a manually-created event to the 'events' Firestore collection.
 * Generates a unique ID and writes the `id` field into the document so
 * appSlice.fetchEvents (which calls doc.data()) can read it back.
 *
 * Returns the generated event ID on success.
 */
export async function saveEventToFirestore(eventData) {
  const id = `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  await setDoc(doc(db, 'events', id), {
    id,
    ...eventData,
    createdAt: serverTimestamp(),
  })
  return id
}

/**
 * Overrides a single recurring event instance by saving a real document
 * to Firestore using the SAME deterministic id as the recurring event
 * (e.g. "{placeId}-rec-{dayOfWeek}-{dateStr}").
 * The selector will then treat this as a real event and suppress the virtual one.
 */
export async function saveEventOverride(recurringEventId, eventData) {
  await setDoc(doc(db, 'events', recurringEventId), {
    ...eventData,
    id:         recurringEventId,
    isOverride: true,
    createdAt:  serverTimestamp(),
  })
  return recurringEventId
}

/**
 * Cancels a specific instance of a recurring event without touching the schedule.
 * Saves a minimal stub with isCancelled:true; the selector adds its id to realIds
 * so the virtual recurring slot is suppressed, but nothing is shown in the feed.
 */
export async function cancelEventInstance(recurringEventId, { placeId, date, venue }) {
  await setDoc(doc(db, 'events', recurringEventId), {
    id:          recurringEventId,
    placeId,
    date,
    venue,
    isCancelled: true,
    createdAt:   serverTimestamp(),
  })
}

/**
 * Updates fields on an already-real Firestore event document.
 */
export async function updateEventInFirestore(eventId, updates) {
  await updateDoc(doc(db, 'events', eventId), updates)
}
