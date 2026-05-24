/**
 * Firestore CRUD for the `pending_events` collection.
 *
 * Workflow:
 *   crawler finds candidates
 *     → upsertPendingEvents() deduplicates & writes with status:'pending'
 *   admin reviews the dashboard
 *     → approveEvent() promotes to `events` collection
 *     → rejectEvent() marks status:'rejected' (stays in pending_events for history)
 */
import { notifyAdminNewSubmission } from './notificationService'
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { db, functions } from './firebase'
import { saveEventToFirestore } from './eventsService'

function deleteFlyerFromStorage(path) {
  if (!path) return
  httpsCallable(functions, 'deleteFlyer')({ path }).catch(() => {})
}

async function geocodeAddress(address, city) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
  if (!apiKey || !address) return null
  const q = [address, city, 'Israel'].filter(Boolean).join(', ')
  try {
    const res  = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(q)}&key=${apiKey}`)
    const data = await res.json()
    if (data.status === 'OK' && data.results[0]) {
      const { lat, lng } = data.results[0].geometry.location
      return {
        coordinates: { latitude: lat, longitude: lng },
        placeId:     data.results[0].place_id ?? null,
      }
    }
  } catch {}
  return null
}

async function geocodeByVenueSearch(venue, location) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
  if (!apiKey || !venue) return null
  const q = [venue, location, 'Israel'].filter(Boolean).join(', ')
  try {
    const res  = await fetch(`https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(q)}&key=${apiKey}`)
    const data = await res.json()
    if (data.status === 'OK' && data.results[0]) {
      const { lat, lng } = data.results[0].geometry.location
      return {
        coordinates: { latitude: lat, longitude: lng },
        placeId:     data.results[0].place_id ?? null,
      }
    }
  } catch {}
  return null
}

/** Tries address geocoding first, falls back to Places text-search by venue name.
 *  Returns { coordinates, placeId } — either field may be null if not found.
 */
export async function findEventCoordinates(venue, address, location) {
  const byAddress = await geocodeAddress(address, location)
  if (byAddress) return byAddress
  return (await geocodeByVenueSearch(venue, location)) ?? { coordinates: null, placeId: null }
}

// ─── User Submission ───────────────────────────────────────────────────────────

/**
 * Saves a raw user-submitted event text into pending_events for admin review + AI parsing.
 * All schema fields start null/empty — the AI parser fills them in.
 */
export async function submitUserEvent(rawText, uid, flyerImageUrl = null, flyerStoragePath = null, imageFingerprint = null, hintPlaceId = null) {
  // Duplicate detection: reject if same image fingerprint already exists
  if (imageFingerprint) {
    const dupSnap = await getDocs(
      query(collection(db, COLL), where('imageFingerprint', '==', imageFingerprint))
    )
    if (!dupSnap.empty) throw new Error('פלייר זה כבר הוגש למערכת')
  }

  const id = `user-${uid ?? 'anon'}-${Date.now()}`
  await setDoc(doc(db, COLL, id), {
    id,
    rawText,
    flyerImageUrl,
    flyerStoragePath,
    imageFingerprint,
    status:      'raw',
    source:      'user_submission',
    submittedBy: uid ?? 'anonymous',
    submittedAt: serverTimestamp(),
    isSpecial:   true,
    title:       null,
    startDate:   null,
    endDate:     null,
    date:        null,
    time:        null,
    venue:       null,
    location:    null,
    placeId:     hintPlaceId ?? null,
    styles:      [],
    description: null,
    price:       null,
    currency:    'ILS',
    ticketLink:  null,
    coordinates: null,
  })

  // Fire-and-forget: notify admin — never blocks or throws
  notifyAdminNewSubmission({
    flyerImageUrl,
    rawText,
    submittedAt: new Date().toLocaleString('he-IL'),
  })

  return id
}

// ─── Load user submissions for admin review ────────────────────────────────────

/** Returns user-submitted events that have not yet been parsed/approved (status:'raw'). */
export async function loadUserSubmissions() {
  const snap = await getDocs(
    query(
      collection(db, COLL),
      where('status', '==', 'raw'),
      where('source', '==', 'user_submission')
    )
  )
  return snap.docs.map(d => {
    const data = d.data()
    return {
      ...data,
      submittedAt: data.submittedAt?.toMillis?.() ?? data.submittedAt ?? null,
    }
  }).sort((a, b) => (b.submittedAt ?? 0) - (a.submittedAt ?? 0))
}

const COLL = 'pending_events'

// ─── Load ──────────────────────────────────────────────────────────────────────

/** Returns all documents whose status is 'pending', sorted by date asc. */
export async function loadPendingEvents() {
  const snap = await getDocs(
    query(collection(db, COLL), where('status', '==', 'pending'))
  )
  const docs = snap.docs.map(d => {
    const data = d.data()
    return {
      ...data,
      crawledAt:  data.crawledAt?.toMillis?.()  ?? data.crawledAt  ?? null,
      approvedAt: data.approvedAt?.toMillis?.() ?? data.approvedAt ?? null,
      rejectedAt: data.rejectedAt?.toMillis?.() ?? data.rejectedAt ?? null,
    }
  })
  docs.sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))
  return docs
}

// ─── Save (deduplicated) ───────────────────────────────────────────────────────

/**
 * Saves crawler candidates that are genuinely new.
 * Skips any candidate that matches an existing pending or live event
 * by (placeId + date) key — prevents duplicate cards showing in the dashboard.
 *
 * @param {object[]} candidates   — from crawlVenueWebsite()
 * @param {object[]} existingPend — current pending_events (from loadPendingEvents)
 * @param {object[]} liveEvents   — current live events (from Redux selectAllEvents)
 * @returns {Promise<object[]>}   — the newly saved pending events (with id filled in)
 */
export async function upsertPendingEvents(candidates, existingPend = [], liveEvents = []) {
  // Build duplicate-key sets from both existing pending and live events
  const existingKeys = new Set()
  existingPend.forEach(e => existingKeys.add(`${e.placeId}|${e.date}`))
  liveEvents.forEach(e => { if (e.placeId) existingKeys.add(`${e.placeId}|${e.date}`) })

  const toSave = candidates.filter(c => !existingKeys.has(`${c.placeId}|${c.date}`))
  if (toSave.length === 0) return []

  const saved = []
  for (const candidate of toSave) {
    const id  = `pend-${candidate.placeId}-${candidate.date}-${Date.now()}`
    const doc_ = {
      id,
      ...candidate,
      status:    'pending',
      crawledAt: serverTimestamp(),
    }
    await setDoc(doc(db, COLL, id), doc_)
    saved.push({ ...doc_, crawledAt: new Date().toISOString() })
  }
  return saved
}

// ─── Approve ──────────────────────────────────────────────────────────────────

/** Promotes one pending event to the live `events` collection. */
export async function approveEvent(pending) {
  let coordinates = pending.coordinates ?? null
  let placeId     = pending.placeId     ?? null

  if (!coordinates || !placeId) {
    const found = await findEventCoordinates(pending.venue, pending.address, pending.location)
    if (!coordinates) coordinates = found.coordinates
    if (!placeId)     placeId     = found.placeId
  }

  await saveEventToFirestore({
    title:        pending.title,
    date:         pending.startDate   ?? pending.date,
    startDate:    pending.startDate   ?? null,
    endDate:      pending.endDate     ?? null,
    time:         pending.time,
    venue:        pending.venue,
    location:     pending.location,
    address:      pending.address     ?? null,
    placeId,
    styles:       pending.styles      ?? [],
    description:  pending.description ?? '',
    price:        pending.price       ?? '0',
    currency:     pending.currency    ?? 'ILS',
    whatsapp:     pending.whatsapp    ?? null,
    ticketLink:   pending.ticketLink  ?? null,
    image:            pending.flyerImageUrl    ?? null,
    flyerStoragePath: pending.flyerStoragePath ?? null,
    coordinates,
    isDiscovered: pending.source !== 'user_submission',
    isSpecial:    pending.isSpecial   ?? false,
    source:       pending.source      ?? null,
    sourceUrl:    pending.sourceUrl   ?? pending.url ?? null,
  })
  await updateDoc(doc(db, COLL, pending.id), {
    status:     'approved',
    approvedAt: serverTimestamp(),
  })
}

/** Deletes an already-approved special event from the live `events` collection and its flyer.
 *  Also removes the originating pending_events document so the same image can be re-submitted. */
export async function deleteApprovedEvent(eventId, flyerStoragePath) {
  await deleteDoc(doc(db, 'events', eventId))
  if (flyerStoragePath) {
    const snap = await getDocs(
      query(collection(db, COLL), where('flyerStoragePath', '==', flyerStoragePath))
    )
    await Promise.all(snap.docs.map(d => deleteDoc(d.ref)))
  }
  deleteFlyerFromStorage(flyerStoragePath)
}

/** Deletes a rejected pending event from Firestore and cleans up its flyer. */
export async function rejectEvent(pendingId, flyerStoragePath) {
  await deleteDoc(doc(db, COLL, pendingId))
  deleteFlyerFromStorage(flyerStoragePath)
}

/** Deletes a single pending event document. */
export async function deletePendingEvent(pendingId, flyerStoragePath) {
  await deleteDoc(doc(db, COLL, pendingId))
  deleteFlyerFromStorage(flyerStoragePath)
}

/** Deletes all pending_events documents that are already approved or rejected (no longer active). */
export async function purgeCompletedPendingEvents() {
  const snap = await getDocs(
    query(collection(db, COLL), where('status', 'in', ['approved', 'rejected']))
  )
  await Promise.all(snap.docs.map(d => deleteDoc(d.ref)))
  return snap.size
}

/** Deletes all pending_events whose startDate is before today. */
export async function deleteExpiredPendingEvents() {
  const today = new Date().toISOString().split('T')[0]
  const snap  = await getDocs(
    query(collection(db, COLL), where('source', '==', 'user_submission'))
  )
  const expired = snap.docs.filter(d => {
    const date = d.data().startDate
    return date && date < today
  })
  await Promise.all(expired.map(d => {
    const data = d.data()
    deleteFlyerFromStorage(data.flyerStoragePath)
    return deleteDoc(d.ref)
  }))
  return expired.length
}

/** Approves every event in the list in parallel (best-effort). */
export async function approveAllPending(pendingList) {
  const results = await Promise.allSettled(pendingList.map(p => approveEvent(p)))
  const failed  = results.filter(r => r.status === 'rejected').length
  return { approved: results.length - failed, failed }
}
