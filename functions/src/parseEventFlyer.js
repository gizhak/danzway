const { onCall, HttpsError } = require('firebase-functions/v2/https')
const { defineSecret }       = require('firebase-functions/params')

const CF_TOKEN_SECRET   = defineSecret('CF_AI_TOKEN')
const CF_ACCOUNT_SECRET = defineSecret('CF_ACCOUNT_ID')

const CF_MODEL = '@cf/meta/llama-3.2-11b-vision-instruct'

function buildPrompt(today) {
  return `You are a precise data extractor for a Latin dance events platform in Israel (DanzWay).
Analyze the flyer image and output ONLY a raw JSON object.
CRITICAL FORMAT RULE: Your ENTIRE response must begin with { and end with }.
Do NOT use markdown. Do NOT use ** or * characters. Do NOT write any text before or after the JSON.

Return exactly these keys:
{
  "title": string,
  "venue": string | null,
  "location": string | null,
  "startDate": "YYYY-MM-DD" | null,
  "endDate": "YYYY-MM-DD" | null,
  "time": "HH:MM" | null,
  "description": string | null,
  "styles": string[],
  "price": number | null,
  "currency": "ILS",
  "ticketLink": string | null,
  "address": string | null,
  "coordinates": null
}

Today is ${today}. Use this for relative date calculations.

Rules:
- title: main event name only (e.g. "Bachata Nation", "Salsa Night"). If a DD.MM number like "6.5" or "8.5" appears alongside the title, it is the date — exclude it from the title.
- venue: the physical venue/club/cafe name. Search the ENTIRE flyer — it may appear ANYWHERE: in the title, body, or address line. Look for cafe/club/hall names, e.g. "קפה קיוסקי פלורנטין", "מועדון גסולינה", "The Garage". If a sentence says "[Name] מזמין אתכם" ([Name] invites you), that [Name] is the venue. null if no venue name is found.
- location: city in English. Search the ENTIRE flyer. The city may appear in a phrase like "בלב תל אביב" (in the heart of Tel Aviv) or in an address line.
  Hebrew→English city map: ראשון לציון→Rishon LeZion, תל אביב→Tel Aviv, חיפה→Haifa,
  פתח תקווה→Petah Tikva, נתניה→Netanya, אשדוד→Ashdod, ירושלים→Jerusalem,
  הרצליה→Herzliya, רמת גן→Ramat Gan, באר שבע→Beer Sheva, רחובות→Rehovot, בת ים→Bat Yam.
  Extract the city even if it appears inside a sentence — do not restrict to address lines only.
- startDate/endDate: Output format MUST be "YYYY-MM-DD".
  Israeli flyer date format is ALWAYS DD.MM.YY or DD.MM.YYYY:
    • FIRST number = day (1–31)
    • SECOND number = month (1–12)
    • THIRD number = year (2-digit = 20XX, e.g. 26 → 2026)
  Examples: "23.05.26" → day=23, month=May, year=2026 → "2026-05-23"
            "6.5" → day=6, month=May, nearest future year → "2026-05-06" (if today is ${today})
            "15.06.2026" → "2026-06-15"
  NEVER treat the first number as the year. Single-day events: endDate = startDate.
  Day-of-week only (no explicit date): if the flyer shows only a day name with no numeric date,
  calculate the nearest upcoming occurrence from today (${today}):
    שבת=Saturday, שישי=Friday, חמישי=Thursday, ראשון=Sunday.
  Example: today is ${today} (${new Date(today).toLocaleDateString('en-US',{weekday:'long'})}), flyer says "שבת" → next Saturday = compute and output YYYY-MM-DD.
- time: the EARLIEST time shown. HH:MM 24h format. null if not shown.
  If a time range is shown (e.g. "13:00-15:00" or "13:00–17:00"), extract ONLY the start time ("13:00").
  If multiple separate time slots appear, take the earliest one.
- styles: List ONLY dance styles from ["Salsa","Bachata","Kizomba","Zouk"] that are EXPLICITLY written or shown on the flyer.
  Do NOT guess or infer. Only include a style if it is clearly mentioned by name (Hebrew or English) or shown as a logo.
  Hebrew: זוק=Zouk, בצ'אטה / בצאטה=Bachata, סלסה=Salsa, קיזומבה=Kizomba.
  Phrase patterns → style: "זוק בחיל-אי"→Zouk, "ברחבת הזוק"→Zouk, "מעגל הזוק"→Zouk,
  "ברחבת הבצ'אטה"→Bachata, "מעגל הבצ'אטה"→Bachata, "סדנאות בצ'אטה"→Bachata.
  Logos: "ZOUK NATION" circular logo → Zouk. "BACHATA NATION" logo → Bachata.
  If a style word is part of a person's name (e.g. "אזוק" as a name) and NOT a dance style label, do NOT include it.
- price: number in ILS (0 = free), null if unknown.
- ticketLink: full URL if present, else null.
- address: ONLY the street name and number (e.g. "לישנסקי 6", "הס 31", "הרצל 32"). Read from the address line at the bottom of the flyer.
  CRITICAL: Do NOT include the city name in address — city belongs in location only.
  Example: if flyer shows "הס 31, הרצליה" → address="הס 31", location="Herzliya".
- description: 1-2 sentences in Hebrew if flyer is Hebrew, English otherwise.
- coordinates: always null.`
}

// Converts any date format the model might return into YYYY-MM-DD
function toISO(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null
  const s = dateStr.trim()
  const sixMonthsAgo = new Date(); sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

  // Already YYYY-MM-DD — but sanity check: model sometimes swaps day/year
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split('-')
    const asIs = new Date(s)
    // If year looks like a 2-digit year misread as 20XX and date is stale, try DD as year
    if (asIs < sixMonthsAgo && parseInt(y) < 2100) {
      // Try swapping: year=20DD, day=YY-part
      const alt = `20${d}-${m}-${y.slice(2)}`
      if (/^\d{4}-\d{2}-\d{2}$/.test(alt) && new Date(alt) > sixMonthsAgo) return alt
    }
    return s
  }
  // DD.MM.YYYY or DD/MM/YYYY
  const full = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/)
  if (full) return `${full[3]}-${full[2].padStart(2,'0')}-${full[1].padStart(2,'0')}`
  // DD.MM.YY or DD/MM/YY
  const short = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{2})$/)
  if (short) return `20${short[3]}-${short[2].padStart(2,'0')}-${short[1].padStart(2,'0')}`
  // DD.MM (no year) — pick nearest future
  const noYear = s.match(/^(\d{1,2})[./](\d{1,2})$/)
  if (noYear) {
    const d = parseInt(noYear[1]), m = parseInt(noYear[2])
    let y = new Date().getFullYear()
    if (new Date(y, m - 1, d) < new Date()) y++
    return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`
  }
  return null
}

function normalizeResult(obj) {
  return {
    ...obj,
    startDate: toISO(obj.startDate),
    endDate:   toISO(obj.endDate) ?? toISO(obj.startDate),
  }
}

exports.parseEventFlyer = onCall(
  { secrets: [CF_TOKEN_SECRET, CF_ACCOUNT_SECRET], timeoutSeconds: 60 },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Must be signed in')

    const { flyerImageUrl, rawText, ocrText } = request.data
    if (!flyerImageUrl && (!rawText || !rawText.trim())) {
      throw new HttpsError('invalid-argument', 'flyerImageUrl or rawText is required')
    }

    const cfToken = process.env.FUNCTIONS_EMULATOR
      ? process.env.CF_AI_TOKEN
      : CF_TOKEN_SECRET.value()
    const cfAccount = process.env.FUNCTIONS_EMULATOR
      ? process.env.CF_ACCOUNT_ID
      : CF_ACCOUNT_SECRET.value()

    if (!cfToken || !cfAccount) throw new HttpsError('internal', 'Cloudflare credentials not configured')

    const CF_URL = `https://api.cloudflare.com/client/v4/accounts/${cfAccount}/ai/run/${CF_MODEL}`
    console.log('[parseEventFlyer] calling CF model, hasImage:', !!flyerImageUrl, 'urlLength:', flyerImageUrl?.length ?? 0)

    const today     = new Date().toISOString().split('T')[0]
    const PROMPT    = buildPrompt(today)

    const parts = [PROMPT]
    if (rawText?.trim())
      parts.push(`User-provided context:\n${rawText.trim()}`)
    if (ocrText?.trim())
      parts.push(`OCR-extracted text from the flyer image (use this as ground truth for exact dates, times, addresses, and venue names — it is more reliable than reading from the image directly):\n${ocrText.trim()}`)
    const promptText = parts.join('\n\n')

    const body = {
      messages: [
        {
          role: 'system',
          content: 'You are a JSON-only data extractor. Your response must be a single valid JSON object. Never use markdown, bold, or any text outside the JSON object.',
        },
        {
          role: 'user',
          content: flyerImageUrl
            ? [
                { type: 'image_url', image_url: { url: flyerImageUrl } },
                { type: 'text', text: promptText },
              ]
            : promptText,
        },
      ],
      max_tokens: 600,
      temperature: 0.1,
    }

    let res
    try {
      res = await fetch(CF_URL, {
        method:  'POST',
        headers: {
          'Authorization': `Bearer ${cfToken}`,
          'Content-Type':  'application/json',
        },
        body: JSON.stringify(body),
      })
    } catch (err) {
      throw new HttpsError('internal', `Network error: ${err.message}`)
    }

    if (!res.ok) {
      const errBody = await res.text().catch(() => '')
      console.error('[parseEventFlyer] CF error', res.status, errBody.slice(0, 400))
      throw new HttpsError('internal', `Cloudflare AI ${res.status}: ${errBody.slice(0, 400)}`)
    }
    console.log('[parseEventFlyer] CF response ok')

    const data = await res.json()
    console.log('[parseEventFlyer] CF raw:', JSON.stringify(data).slice(0, 300))

    const raw = data?.result?.response ?? data?.choices?.[0]?.message?.content ?? ''

    // If Cloudflare already parsed the response into an object, use it directly
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      return normalizeResult(raw)
    }

    // Coerce to string
    const rawText2 = Array.isArray(raw)
      ? (raw.find(c => c.type === 'text')?.text ?? raw.map(c => c.text ?? '').join(''))
      : typeof raw === 'string' ? raw : JSON.stringify(raw)

    // Try JSON object in the string
    const jsonMatch = rawText2.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      try { return normalizeResult(JSON.parse(jsonMatch[0])) } catch { /* fall through */ }
    }

    // Fallback: model returned markdown key-value format (**Key**: Value)
    const kvPairs = [...rawText2.matchAll(/\*{0,2}(\w+)\*{0,2}[:\s]+([^\n*]+)/gi)]
    if (kvPairs.length > 0) {
      const kv = {}
      for (const [, key, val] of kvPairs) kv[key.toLowerCase()] = val.trim()
      const styleStr = kv.styles ?? ''
      const styles   = ['Salsa','Bachata','Kizomba','Zouk'].filter(s =>
        styleStr.toLowerCase().includes(s.toLowerCase())
      )
      return normalizeResult({
        title:       kv.title       ?? null,
        venue:       kv.venue       ?? null,
        location:    kv.location    ?? null,
        startDate:   kv.startdate   ?? null,
        endDate:     kv.enddate     ?? null,
        time:        kv.time        ?? null,
        description: kv.description ?? null,
        styles,
        price:       kv.price ? parseFloat(kv.price) : null,
        currency:    'ILS',
        ticketLink:  kv.ticketlink && kv.ticketlink.toLowerCase() !== 'not provided' ? kv.ticketlink : null,
        coordinates: null,
      })
    }

    throw new HttpsError('internal', `No JSON found in response: ${rawText2.slice(0, 300)}`)
  }
)
