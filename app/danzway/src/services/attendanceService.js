import { doc, onSnapshot, runTransaction, getDocs, collection, query, where, documentId, writeBatch } from 'firebase/firestore'
import { db } from './firebase'

export function subscribeToAttendance(eventId, callback) {
  const ref = doc(db, 'eventAttendance', eventId)
  return onSnapshot(
    ref,
    (snap) => callback(snap.exists() ? snap.data() : { count: 0, attendees: {} }),
    ()      => callback({ count: 0, attendees: {} }),
  )
}

export async function toggleAttendance(eventId, uid) {
  const ref = doc(db, 'eventAttendance', eventId)
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref)
    const data = snap.exists() ? snap.data() : { count: 0, attendees: {} }
    const isGoing = data.attendees?.[uid] === true
    const newAttendees = { ...(data.attendees ?? {}) }
    if (isGoing) {
      delete newAttendees[uid]
    } else {
      newAttendees[uid] = true
    }
    tx.set(ref, {
      count:     isGoing ? Math.max(0, (data.count ?? 0) - 1) : (data.count ?? 0) + 1,
      attendees: newAttendees,
    })
  })
}

// ─── Cleanup helpers ───────────────────────────────────────────────────────────

// Virtual recurring event IDs end with -rec-{dayOfWeek}-{YYYY-MM-DD}
const VIRTUAL_DATE_RE = /-(\d{4}-\d{2}-\d{2})$/

async function getPastAttendanceRefs() {
  const today       = new Date().toISOString().split('T')[0]
  const attendSnap  = await getDocs(collection(db, 'eventAttendance'))
  if (attendSnap.empty) return []

  const pastRefs     = []
  const regularIds   = []
  const regularRefMap = {}

  attendSnap.docs.forEach((d) => {
    const match = d.id.match(VIRTUAL_DATE_RE)
    if (match) {
      if (match[1] < today) pastRefs.push(d.ref)
    } else {
      regularIds.push(d.id)
      regularRefMap[d.id] = d.ref
    }
  })

  // Look up dates for regular events in batches of 30 (Firestore 'in' limit)
  for (let i = 0; i < regularIds.length; i += 30) {
    const batch    = regularIds.slice(i, i + 30)
    const evSnap   = await getDocs(query(collection(db, 'events'), where(documentId(), 'in', batch)))
    evSnap.docs.forEach((d) => {
      if (d.data().date && d.data().date < today) pastRefs.push(regularRefMap[d.id])
    })
  }

  return pastRefs
}

export async function countPastAttendance() {
  const refs = await getPastAttendanceRefs()
  return refs.length
}

export async function cleanupPastAttendance() {
  const refs = await getPastAttendanceRefs()
  if (refs.length === 0) return 0
  for (let i = 0; i < refs.length; i += 500) {
    const batch = writeBatch(db)
    refs.slice(i, i + 500).forEach((ref) => batch.delete(ref))
    await batch.commit()
  }
  return refs.length
}
