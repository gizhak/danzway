import { db } from './firebase'
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore'

const MAPS_KEY   = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
const PLACES_KEY = import.meta.env.VITE_GOOGLE_PLACES_API_KEY

// ─── Category mapping ──────────────────────────────────────────────────────

export const GOOGLE_TYPE_MAP = {
  night_club:               { en: 'Nightclub',        he: 'מועדון לילה'    },
  dance_school:             { en: 'Dance Studio',     he: 'אולפן ריקודים'  },
  bar:                      { en: 'Bar',              he: 'בר'             },
  restaurant:               { en: 'Restaurant & Bar', he: 'מסעדה ובר'      },
  gym:                      { en: 'Studio',           he: 'סטודיו'         },
  sports_activity_location: { en: 'Dance Studio',     he: 'אולפן ריקודים'  },
  entertainment_venue:      { en: 'Event Venue',      he: 'אולם אירועים'   },
  event_venue:              { en: 'Event Venue',      he: 'אולם אירועים'   },
  performing_arts_theater:  { en: 'Theater',          he: 'תיאטרון'        },
  cultural_center:          { en: 'Cultural Center',  he: 'מרכז תרבות'     },
  community_center:         { en: 'Community Center', he: 'מרכז קהילתי'    },
}

const FALLBACK_CATEGORY = { en: 'Venue', he: 'מקום' }

/**
 * Maps raw Google types to our { en, he } category objects.
 * Deduplicates by English label. Falls back to [FALLBACK_CATEGORY] if no match.
 */
export function mapGoogleTypes(types = []) {
  const seen = new Set()
  const matched = types
    .map((t) => GOOGLE_TYPE_MAP[t])
    .filter(Boolean)
    .filter(({ en }) => !seen.has(en) && seen.add(en))
  return matched.length > 0 ? matched : [FALLBACK_CATEGORY]
}

// ─── Photo URL helper ──────────────────────────────────────────────────────

function buildPhotoUrl(photoName, maxWidth = 800) {
  return (
    `https://places.googleapis.com/v1/${photoName}/media` +
    `?maxWidthPx=${maxWidth}&key=${PLACES_KEY}`
  )
}

// ─── Plan 009: Single-venue helpers (unchanged) ────────────────────────────

/**
 * Searches for a venue by name + city using Places API (New) Text Search.
 * Returns the Google Place ID string, or null if not found / on error.
 */
export async function searchPlaceId(venueName, city) {
  if (!PLACES_KEY) return null
  try {
    const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': PLACES_KEY,
        'X-Goog-FieldMask': 'places.id,places.displayName',
      },
      body: JSON.stringify({ textQuery: `${venueName}, ${city}` }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      console.error('[Places] searchPlaceId HTTP error:', res.status, err)
      return null
    }
    const data = await res.json()
    return data.places?.[0]?.id ?? null
  } catch (err) {
    console.error('[Places] searchPlaceId fetch error:', err)
    return null
  }
}

/**
 * Fetches the first photo URL for a given Place ID via Places API (New).
 * Returns a direct media URL string (800px wide), or null if no photo / on error.
 */
export async function getPlacePhotoUrl(placeId) {
  if (!PLACES_KEY || !placeId) return null
  try {
    const res = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
      headers: {
        'X-Goog-Api-Key': PLACES_KEY,
        'X-Goog-FieldMask': 'photos',
      },
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      console.error('[Places] getPlacePhotoUrl HTTP error:', res.status, err)
      return null
    }
    const data = await res.json()
    const photoName = data.photos?.[0]?.name
    if (!photoName) {
      console.warn('[Places] getPlacePhotoUrl: no photos for placeId', placeId)
      return null
    }
    return buildPhotoUrl(photoName, 800)
  } catch (err) {
    console.error('[Places] getPlacePhotoUrl fetch error:', err)
    return null
  }
}

/**
 * Orchestrates a full venue metadata refresh for an event (Plan 009 admin button).
 * Returns { placeId, placePhoto } — either field may be null on failure.
 */
export async function refreshVenueMetadata(event) {
  const placeId = await searchPlaceId(event.venue, event.location)
  const placePhoto = placeId ? await getPlacePhotoUrl(placeId) : null
  return { placeId, placePhoto }
}

// ─── Plan 010: Venue Discovery ─────────────────────────────────────────────

/**
 * Searches for dance venues using Places API (New) Text Search.
 * Returns lightweight result objects suitable for the discovery grid.
 *
 * @param {string} query         - e.g. "salsa club Tel Aviv"
 * @param {Set}    seenPlaceIds  - placeIds already shown; results in this Set are filtered out
 */
export async function searchDanceVenues(query, seenPlaceIds = new Set()) {
  if (!PLACES_KEY) return []
  try {
    const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': PLACES_KEY,
        'X-Goog-FieldMask': [
          'places.id',
          'places.displayName',
          'places.types',
          'places.formattedAddress',
          'places.rating',
          'places.userRatingCount',
          'places.photos',
        ].join(','),
      },
      body: JSON.stringify({ textQuery: query, languageCode: 'en' }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      console.error('[Places] searchDanceVenues HTTP error:', res.status, err)
      return []
    }
    const data = await res.json()
    const places = data.places ?? []

    return places
      .filter((p) => p.id && !seenPlaceIds.has(p.id))
      .map((p) => ({
        placeId:     p.id,
        name:        p.displayName?.text ?? 'Unknown Venue',
        address:     p.formattedAddress ?? '',
        types:       p.types ?? [],
        categories:  mapGoogleTypes(p.types),
        rating:      p.rating ?? null,
        reviewCount: p.userRatingCount ?? 0,
        thumbnail:   p.photos?.[0]?.name
          ? buildPhotoUrl(p.photos[0].name, 400)
          : null,
      }))
  } catch (err) {
    console.error('[Places] searchDanceVenues fetch error:', err)
    return []
  }
}

/**
 * Fetches full venue details for import: photo gallery (up to 5), reviews (up to 5),
 * coordinates, phone, website. Called only when admin confirms import.
 *
 * @param {string} placeId
 * @returns {object|null} fully-shaped venue object, or null on failure
 */
export async function getFullVenueDetails(placeId) {
  if (!PLACES_KEY || !placeId) return null
  try {
    const res = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
      headers: {
        'X-Goog-Api-Key': PLACES_KEY,
        'X-Goog-FieldMask': [
          'id',
          'displayName',
          'types',
          'formattedAddress',
          'location',
          'nationalPhoneNumber',
          'websiteUri',
          'rating',
          'userRatingCount',
          'photos',
          'reviews',
        ].join(','),
      },
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      console.error('[Places] getFullVenueDetails HTTP error:', res.status, err)
      return null
    }
    const p = await res.json()

    const categories  = mapGoogleTypes(p.types ?? [])

    const photos = (p.photos ?? [])
      .slice(0, 5)
      .map((ph) => buildPhotoUrl(ph.name, 800))

    const reviews = (p.reviews ?? []).slice(0, 5).map((r) => ({
      author:       r.authorAttribution?.displayName ?? 'Anonymous',
      authorPhoto:  r.authorAttribution?.photoUri    ?? null,
      rating:       r.rating ?? null,
      text:         r.text?.text ?? '',
      relativeTime: r.relativePublishTimeDescription ?? '',
    }))

    // Extract city: skip postal codes (all-digit segments) and the last segment (country)
    function extractCity(formattedAddress) {
      const parts = (formattedAddress ?? '').split(',').map((s) => s.trim())
      for (let i = parts.length - 2; i >= 0; i--) {
        if (!/^\d+$/.test(parts[i])) return parts[i]
      }
      return parts[0] ?? ''
    }

    const city   = extractCity(p.formattedAddress)

    // Fetch Hebrew address for cityHe
    let cityHe = city
    try {
      const resHe = await fetch(`https://places.googleapis.com/v1/places/${placeId}?languageCode=he`, {
        headers: {
          'X-Goog-Api-Key': PLACES_KEY,
          'X-Goog-FieldMask': 'formattedAddress',
        },
      })
      if (resHe.ok) {
        const pHe = await resHe.json()
        cityHe = extractCity(pHe.formattedAddress)
      }
    } catch { /* use English fallback */ }

    // Auto-detect social media from websiteUri
    const websiteUri = p.websiteUri ?? null
    let instagram = null
    let facebook  = null
    if (websiteUri) {
      if (websiteUri.includes('instagram.com')) instagram = websiteUri
      else if (websiteUri.includes('facebook.com')) facebook = websiteUri
    }

    return {
      placeId:          p.id,
      name:             p.displayName?.text ?? 'Unknown Venue',
      address:          p.formattedAddress ?? '',
      city,
      cityHe,
      active:           true,    // visible by default — admin can hide via toggle
      logo:             null,
      styles:           [],
      categories:       categories.map((c) => c.en),
      categoriesHe:     categories.map((c) => c.he),
      googleTypes:      p.types ?? [],
      rating:           p.rating           ?? null,
      reviewCount:      p.userRatingCount  ?? 0,
      photos,
      reviews,
      phone:            p.nationalPhoneNumber ?? null,
      website:          websiteUri,
      instagram,
      facebook,
      instagramPostUrl: null,
      coordinates:      p.location
        ? { lat: p.location.latitude, lng: p.location.longitude }
        : null,
    }
  } catch (err) {
    console.error('[Places] getFullVenueDetails fetch error:', err)
    return null
  }
}

/**
 * Fetches an Instagram oEmbed payload for a public post URL.
 * No API key or app approval required — works for any public post.
 * Returns the oEmbed JSON (contains `html` for the embed) or null on failure.
 *
 * @param {string} postUrl  - e.g. "https://www.instagram.com/p/ABC123/"
 */
export async function fetchInstagramOEmbed(postUrl) {
  if (!postUrl) return null
  try {
    const endpoint = `https://api.instagram.com/oembed/?url=${encodeURIComponent(postUrl)}&omitscript=true`
    const res = await fetch(endpoint)
    if (!res.ok) {
      console.warn('[Instagram] oEmbed HTTP error:', res.status)
      return null
    }
    return await res.json()
  } catch (err) {
    console.error('[Instagram] oEmbed fetch error:', err)
    return null
  }
}

/**
 * Bulk imports an array of placeIds into Firestore `venues` collection.
 * Each venue is fetched individually — if one fails, the rest continue.
 *
 * @param {string[]} placeIds
 * @returns {{ imported: number, failed: number, failedIds: string[] }}
 */
export async function importVenuesToFirestore(placeIds) {
  let imported = 0
  let failed   = 0
  const failedIds = []

  for (const placeId of placeIds) {
    try {
      const details = await getFullVenueDetails(placeId)
      if (!details) throw new Error('getFullVenueDetails returned null')

      // Separate admin-managed fields (must not be overwritten on re-import)
      // from Google-sourced data (always refreshed)
      const {
        active, logo, styles, instagramPostUrl,  // admin-only — excluded from write
        ...googleData
      } = details

      // Check if this is a first import or a re-import
      const existingSnap = await getDoc(doc(db, 'venues', placeId))
      const isNew = !existingSnap.exists()

      await setDoc(
        doc(db, 'venues', placeId),
        {
          ...googleData,           // always refreshed from Google
          lastRefreshed: serverTimestamp(),
          // Admin-managed defaults — written ONLY on first import
          ...(isNew ? {
            active:           true,    // visible by default
            logo:             null,
            styles:           [],
            instagramPostUrl: null,
            importedAt:       serverTimestamp(),
          } : {}),
        },
        { merge: true }   // preserves any admin-managed fields not in this write
      )
      imported++
    } catch (err) {
      failed++
      failedIds.push(placeId)
      console.error(`[Import] ✗ ${placeId}:`, err)
      // Continue — don't let one failure abort the whole batch
    }
  }

  return { imported, failed, failedIds }
}
