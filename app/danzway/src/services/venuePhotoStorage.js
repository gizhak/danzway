/**
 * Resolves Google Places photo URLs to their final CDN redirect URLs
 * (lh3.googleusercontent.com), which are served for free with no API key.
 * Called once during admin Sync Google — users then load from CDN directly.
 *
 * If Google returns 4xx (quota exceeded, auth error, etc.) the URL is SKIPPED —
 * we never store a broken Google API URL that would burn quota on every page view.
 */
export async function uploadVenuePhotos(placeId, googlePhotoUrls = []) {
  const results = []
  for (const url of googlePhotoUrls) {
    // Already a CDN URL — keep as-is, no API call needed
    if (url.includes('lh3.googleusercontent.com') || url.includes('lh5.googleusercontent.com')) {
      results.push(url)
      continue
    }
    try {
      const response = await fetch(url)
      if (!response.ok) {
        // 429 quota exceeded, 403 auth error, etc. — skip, don't store broken URL
        console.warn(`[Photos] HTTP ${response.status} for ${placeId} — skipping (quota?)`)
        continue
      }
      const finalUrl = response.url
      // Only keep it if we actually got a CDN redirect
      if (finalUrl && finalUrl !== url && finalUrl.includes('googleusercontent.com')) {
        results.push(finalUrl)
      } else {
        console.warn(`[Photos] No CDN redirect for ${placeId} — skipping`)
      }
    } catch (err) {
      console.warn(`[Photos] Failed to resolve photo for ${placeId}:`, err)
    }
  }
  return results
}

/** Returns true if a URL is a raw Google Places API URL (burns quota on load) */
export function isGoogleApiPhotoUrl(url) {
  return typeof url === 'string' && url.includes('places.googleapis.com')
}
