const { onCall, HttpsError } = require('firebase-functions/v2/https')

/**
 * Server-side geocoding via Google Places Text Search.
 * Called from the admin dashboard when parsing or reviewing a flyer.
 * Running server-side avoids HTTP referrer restrictions on the Maps API key.
 *
 * Input:  { venue, address, location, apiKey }
 * Output: { placeId, coordinates: { latitude, longitude }, formattedAddress, name } | null
 */
exports.geocodeVenue = onCall({ timeoutSeconds: 15 }, async (request) => {
  const { venue, address, location, apiKey } = request.data
  if (!apiKey) throw new HttpsError('invalid-argument', 'apiKey required')

  // 1. Street address → Geocoding API (large separate quota, precise for addresses)
  if (address) {
    const q   = [address, location, 'Israel'].filter(Boolean).join(', ')
    const res  = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(q)}&key=${apiKey}`
    )
    const data = await res.json()
    if (data.status === 'OK' && data.results[0]) {
      const r = data.results[0]
      return {
        placeId:          r.place_id,
        coordinates:      { latitude: r.geometry.location.lat, longitude: r.geometry.location.lng },
        formattedAddress: r.formatted_address,
        name:             null,
      }
    }
  }

  // 2. Venue name only → Places API (New) Text Search
  if (venue) {
    const q   = [venue, location, 'Israel'].filter(Boolean).join(', ')
    const res  = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method:  'POST',
      headers: {
        'Content-Type':     'application/json',
        'X-Goog-Api-Key':   apiKey,
        'X-Goog-FieldMask': 'places.id,places.location,places.formattedAddress,places.displayName',
      },
      body: JSON.stringify({ textQuery: q }),
    })
    const data = await res.json()
    if (data.error) {
      throw new HttpsError('internal', `Places API: ${data.error.status} — ${data.error.message}`)
    }
    if (data.places?.[0]) {
      const p = data.places[0]
      return {
        placeId:          p.id,
        coordinates:      { latitude: p.location.latitude, longitude: p.location.longitude },
        formattedAddress: p.formattedAddress,
        name:             p.displayName?.text ?? null,
      }
    }
  }

  return null
})
