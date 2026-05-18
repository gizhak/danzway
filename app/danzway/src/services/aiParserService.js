/**
 * AI parser — calls the parseEventFlyer Firebase Cloud Function (server-side Gemini).
 *
 * The Cloud Function runs in us-central1 and bypasses Israel's geographic
 * restriction on direct browser calls to the Gemini API.
 * The Google AI API key lives in the Cloud Function as a Firebase Secret —
 * no VITE_ key is needed in the frontend.
 */
import { httpsCallable } from 'firebase/functions'
import { functions } from './firebase'

export async function parseEventWithAI(rawText) {
  const parseFn = httpsCallable(functions, 'parseEventFlyer', { timeout: 65000 })
  const result  = await parseFn({ rawText })
  return result.data
}
