/**
 * Resolves Google Places photo URLs to their final CDN redirect URLs
 * (lh3.googleusercontent.com), which are served for free with no API key.
 * Called once during admin Sync Google — users then load from CDN directly.
 */
export async function uploadVenuePhotos(placeId, googlePhotoUrls = []) {
  const results = []
  for (const url of googlePhotoUrls) {
    try {
      const response = await fetch(url)
      // response.url is the final URL after all redirects
      const finalUrl = response.url
      results.push(finalUrl && finalUrl !== url ? finalUrl : url)
    } catch (err) {
      console.warn(`[Photos] Failed to resolve photo for ${placeId}:`, err)
      results.push(url)
    }
  }
  return results
}
