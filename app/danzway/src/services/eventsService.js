import {
  doc, setDoc, updateDoc, deleteDoc, serverTimestamp,
  writeBatch, collection, query, where, getDocs,
} from 'firebase/firestore'
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
 * Permanently deletes a single event document from Firestore.
 * Use for non-recurring one-time events. For recurring slots, use cancelEventInstance instead.
 */
export async function deleteEventFromFirestore(eventId) {
  await deleteDoc(doc(db, 'events', eventId))
}

/**
 * Deletes all isCancelled stubs for a venue so that a freshly-saved recurring
 * schedule can generate virtual events without being suppressed.
 * Call this whenever the user sets or updates a recurring schedule.
 */
export async function clearVenueStubs(placeId) {
  const snap = await getDocs(
    query(collection(db, 'events'), where('placeId', '==', placeId), where('isCancelled', '==', true))
  )
  if (snap.empty) return
  const batch = writeBatch(db)
  snap.docs.forEach((d) => batch.delete(d.ref))
  await batch.commit()
}

/**
 * Updates fields on an already-real Firestore event document.
 */
export async function updateEventInFirestore(eventId, updates) {
  await updateDoc(doc(db, 'events', eventId), updates)
}

/**
 * Clears ALL upcoming events for a venue in one batch:
 *   1. Deletes every Firestore document where placeId matches (real events,
 *      overrides, and any existing cancelled stubs).
 *   2. Writes isCancelled stubs for every upcoming recurring slot (8 weeks)
 *      so virtual recurring events are suppressed immediately in the UI.
 *
 * The onSnapshot listener propagates the change to Redux automatically —
 * no manual dispatch needed after calling this.
 */
export async function deleteVenueEvents(placeId, recurringSchedule) {
  const batch = writeBatch(db)

  // ── 1. Delete all real Firestore docs for this venue ─────────────────────
  const snap = await getDocs(
    query(collection(db, 'events'), where('placeId', '==', placeId))
  )
  snap.docs.forEach((d) => batch.delete(d.ref))

  // ── 2. Suppress upcoming recurring slots with isCancelled stubs ───────────
  if (recurringSchedule?.days?.length) {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const limit = 8 * 7  // days ahead

    recurringSchedule.days.forEach((dayOfWeek) => {
      const daysToFirst = (dayOfWeek - today.getDay() + 7) % 7
      const cur = new Date(today)
      cur.setDate(today.getDate() + daysToFirst)

      while (Math.round((cur - today) / 86400000) <= limit) {
        const yyyy    = cur.getFullYear()
        const mm      = String(cur.getMonth() + 1).padStart(2, '0')
        const dd      = String(cur.getDate()).padStart(2, '0')
        const dateStr = `${yyyy}-${mm}-${dd}`
        const stubId  = `${placeId}-rec-${dayOfWeek}-${dateStr}`

        batch.set(doc(db, 'events', stubId), {
          id:          stubId,
          placeId,
          date:        dateStr,
          isCancelled: true,
          createdAt:   serverTimestamp(),
        })
        cur.setDate(cur.getDate() + 7)
      }
    })
  }

  await batch.commit()
}
