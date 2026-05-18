const { onCall, HttpsError } = require('firebase-functions/v2/https')
const { defineSecret }       = require('firebase-functions/params')
const { GoogleGenerativeAI } = require('@google/generative-ai')

const GOOGLE_AI_KEY = defineSecret('GOOGLE_AI_API_KEY')

const PROMPT = `You are a precise data extractor for a Latin dance events platform in Israel (DanzWay).

Extract structured event data from the raw post text below and return a JSON object with exactly these keys:

{
  "title": string,
  "venue": string | null,
  "location": string | null,
  "startDate": "YYYY-MM-DD",
  "endDate": "YYYY-MM-DD",
  "time": "HH:MM" | null,
  "description": string | null,
  "styles": string[],
  "price": number | null,
  "currency": string,
  "ticketLink": string | null,
  "coordinates": { "latitude": number, "longitude": number } | null
}

Rules:
- Dates must be absolute YYYY-MM-DD strings. If the year is missing, default to the nearest future date.
- endDate equals startDate for single-day events.
- time is HH:MM 24-hour format; null if not mentioned.
- styles: only include values from ["Salsa","Bachata","Kizomba","Zouk"] that clearly appear in the text. Empty array if none found.
- price: numeric (0 for free events), null if genuinely unknown.
- currency: "ILS" unless another currency is explicitly stated.
- ticketLink: full URL if present in the text, otherwise null.
- coordinates: only set if explicit GPS coordinates are given in the text, otherwise null.
- description: 1-2 sentence summary written in the same language as the input text.

Post text:
`

exports.parseEventFlyer = onCall(
  { secrets: [GOOGLE_AI_KEY], timeoutSeconds: 60 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be signed in')
    }

    const { rawText } = request.data
    if (!rawText || typeof rawText !== 'string' || !rawText.trim()) {
      throw new HttpsError('invalid-argument', 'rawText must be a non-empty string')
    }

    const genAI = new GoogleGenerativeAI(GOOGLE_AI_KEY.value())
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1,
      },
    })

    const result = await model.generateContent(PROMPT + rawText.trim())
    const text   = result.response.text()

    try {
      return JSON.parse(text)
    } catch {
      throw new HttpsError('internal', `Gemini returned non-JSON: ${text.slice(0, 300)}`)
    }
  }
)
