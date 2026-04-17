const API_KEY = import.meta.env.VITE_GOOGLE_PLACES_API_KEY

/**
 * Searches for a venue by name + city using Places API (New) Text Search.
 * Includes city in the query to avoid matching same-named venues in other cities.
 * Returns the Google Place ID string, or null if not found / on error.
 */
export async function searchPlaceId(venueName, city) {
  if (!API_KEY) return null
  try {
    const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': API_KEY,
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
    console.log('[Places] searchPlaceId result:', data.places?.[0])
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
  if (!API_KEY || !placeId) return null
  try {
    const res = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
      headers: {
        'X-Goog-Api-Key': API_KEY,
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
    return (
      `https://places.googleapis.com/v1/${photoName}/media` +
      `?maxWidthPx=800&key=${API_KEY}`
    )
  } catch (err) {
    console.error('[Places] getPlacePhotoUrl fetch error:', err)
    return null
  }
}

/**
 * Orchestrates a full venue metadata refresh for an event.
 * Searches by venue name + city, then fetches the first available photo.
 * Returns { placeId, placePhoto } — either field may be null on failure.
 */
export async function refreshVenueMetadata(event) {
  const placeId = await searchPlaceId(event.venue, event.location)
  const placePhoto = placeId ? await getPlacePhotoUrl(placeId) : null
  return { placeId, placePhoto }
}
