import { createSelector } from '@reduxjs/toolkit'

const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const RECURRING_WEEKS = 8   // how many weeks ahead to generate

function normKey(str) {
  return (str ?? '').toLowerCase().replace(/\s+/g, ' ').trim()
}

/**
 * Generates virtual EventCard-compatible objects from a venue's recurringSchedule.
 * recurringSchedule shape: { days: number[], time: string, title: string, description: string }
 * Covers RECURRING_WEEKS weeks starting from today.
 */
function generateRecurringEvents(venues) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const virtual = []

  venues.forEach((venue) => {
    if (venue.active === false) return
    const sched = venue.recurringSchedule
    if (!sched?.days?.length) return

    const { days, time = '21:00', title = '', description = '' } = sched

    days.forEach((dayOfWeek) => {
      const todayDay     = today.getDay()
      const daysToFirst  = (dayOfWeek - todayDay + 7) % 7
      const current      = new Date(today)
      current.setDate(today.getDate() + daysToFirst)

      const limit = RECURRING_WEEKS * 7
      while (Math.round((current - today) / 86400000) <= limit) {
        const dateStr = current.toISOString().slice(0, 10)
        virtual.push({
          id:          `${venue.placeId}-rec-${dayOfWeek}-${dateStr}`,
          title:       title || `${venue.name} — ${DAY_LABELS[dayOfWeek]} Night`,
          date:        dateStr,
          time,
          venue:       venue.name,
          location:    venue.city   ?? '',
          placeId:     venue.placeId,
          styles:      venue.styles ?? [],
          description: description || `Weekly dance event at ${venue.name}`,
          isRecurring: true,
          // pre-enriched visuals
          _venueLogo:  venue.logo        ?? null,
          _venuePhoto: venue.photos?.[0] ?? null,
          rating:      venue.rating      ?? null,
          price:       null,
          currency:    null,
          whatsapp:    null,
        })
        current.setDate(current.getDate() + 7)
      }
    })
  })

  return virtual
}

/**
 * Cross-slice selector: returns future events for active venues only.
 *
 * Sources merged in priority order:
 *   1. Real Firestore events whose parent venue is active (enriched with venue data)
 *   2. Virtual recurring events generated from venue.recurringSchedule
 *      (only shown when no real event already covers that date × venue × id)
 *
 * Result is sorted chronologically (date asc, then time asc).
 * Returns [] while venues are still loading to prevent premature "no events" flash.
 */
export const selectEventsForActiveVenues = createSelector(
  (state) => state.app.events,
  (state) => state.venues.venues,
  (events, venues) => {
    if (venues.length === 0) return []

    // Build active-venue lookup: name (exact + normalised) + placeId → venue
    const activeMap = {}
    venues.forEach((v) => {
      if (v.active === false) return
      activeMap[v.name]          = v
      activeMap[normKey(v.name)] = v
      if (v.placeId) activeMap[v.placeId] = v
    })

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // ── 1. Real Firestore events ──────────────────────────────────────────
    const realIds = new Set()
    const realEvents = []

    events.forEach((e) => {
      if (!e.date) return
      const d = new Date(e.date)
      d.setHours(0, 0, 0, 0)
      if (d < today) return   // hide past

      const parent =
        activeMap[e.venue] ??
        activeMap[normKey(e.venue ?? '')] ??
        (e.placeId ? activeMap[e.placeId] : null)

      // Cancelled stubs: always add to realIds (suppresses recurring), never display
      if (e.isCancelled) {
        realIds.add(e.id)
        return
      }

      if (!parent) return     // venue inactive or unknown

      realIds.add(e.id)
      realEvents.push({
        ...e,
        _venueLogo:  parent.logo        ?? null,
        _venuePhoto: parent.photos?.[0] ?? null,
        styles:      e.styles?.length   ? e.styles : (parent.styles ?? []),
        rating:      e.rating           ?? parent.rating ?? null,
      })
    })

    // ── 2. Recurring virtual events (skip if a real event has same id) ────
    const recurringEvents = generateRecurringEvents(venues).filter(
      (e) => !realIds.has(e.id)
    )

    // ── Merge & sort ──────────────────────────────────────────────────────
    const all = [...realEvents, ...recurringEvents]
    all.sort((a, b) => {
      const byDate = new Date(a.date) - new Date(b.date)
      return byDate !== 0 ? byDate : (a.time ?? '').localeCompare(b.time ?? '')
    })
    return all
  }
)
