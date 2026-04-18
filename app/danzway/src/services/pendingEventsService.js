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
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from './firebase'
import { saveEventToFirestore } from './eventsService'

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
  await saveEventToFirestore({
    title:        pending.title,
    date:         pending.date,
    time:         pending.time,
    venue:        pending.venue,
    location:     pending.location,
    placeId:      pending.placeId,
    styles:       pending.styles   ?? [],
    description:  pending.description ?? '',
    price:        pending.price    ?? '0',
    currency:     pending.currency ?? 'ILS',
    whatsapp:     pending.whatsapp ?? null,
    isDiscovered: true,
    sourceUrl:    pending.sourceUrl ?? pending.url ?? null,
  })
  await updateDoc(doc(db, COLL, pending.id), {
    status:     'approved',
    approvedAt: serverTimestamp(),
  })
}

/** Marks a pending event as rejected (kept for audit trail). */
export async function rejectEvent(pendingId) {
  await updateDoc(doc(db, COLL, pendingId), {
    status:     'rejected',
    rejectedAt: serverTimestamp(),
  })
}

/** Approves every event in the list in parallel (best-effort). */
export async function approveAllPending(pendingList) {
  const results = await Promise.allSettled(pendingList.map(p => approveEvent(p)))
  const failed  = results.filter(r => r.status === 'rejected').length
  return { approved: results.length - failed, failed }
}
