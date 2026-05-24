const { onCall, HttpsError } = require('firebase-functions/v2/https')
const { initializeApp, getApps } = require('firebase-admin/app')
const { getStorage }             = require('firebase-admin/storage')

if (!getApps().length) initializeApp()

exports.uploadFlyer = onCall(
  { timeoutSeconds: 30 },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Must be signed in')

    const { imageBase64, mimeType, uid } = request.data
    if (!imageBase64) throw new HttpsError('invalid-argument', 'imageBase64 is required')

    // Storage emulator requires Java 21 — in local dev return a data URL instead
    if (process.env.FUNCTIONS_EMULATOR) {
      return { url: `data:${mimeType || 'image/jpeg'};base64,${imageBase64}`, path: null }
    }

    const ext    = (mimeType || 'image/jpeg').split('/')[1] || 'jpg'
    const path   = `flyers/${uid ?? 'anon'}/${Date.now()}.${ext}`
    const bucket = getStorage().bucket('danzway-app.firebasestorage.app')
    const file   = bucket.file(path)

    await file.save(Buffer.from(imageBase64, 'base64'), {
      metadata: { contentType: mimeType || 'image/jpeg' },
    })
    await file.makePublic()

    const url = `https://storage.googleapis.com/${bucket.name}/${path}`
    return { url, path }
  }
)

exports.deleteFlyer = onCall(
  { timeoutSeconds: 10 },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Must be signed in')
    const { path } = request.data
    if (!path) return { ok: true }
    try {
      await getStorage().bucket('danzway-app.firebasestorage.app').file(path).delete()
    } catch { /* already deleted */ }
    return { ok: true }
  }
)
