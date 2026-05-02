const CACHE_KEY = 'danzway_venues_v1'
const TTL_MS    = 24 * 60 * 60 * 1000   // 24 hours

export function getCachedVenues() {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const { venues, ts } = JSON.parse(raw)
    if (Date.now() - ts > TTL_MS) return null
    return venues
  } catch {
    return null
  }
}

export function setCachedVenues(venues) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ venues, ts: Date.now() }))
  } catch { /* localStorage full or unavailable */ }
}

export function clearVenueCache() {
  try { localStorage.removeItem(CACHE_KEY) } catch { /* ignore */ }
}
