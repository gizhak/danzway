/**
 * Calls Cloudflare Workers AI (llama-3.2-11b-vision-instruct) directly from the client.
 * Admin-only. Free tier: 10,000 neurons/day.
 */

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
- title: main event name only. If a DD.MM number appears alongside the title it is the date — exclude it.
- venue: the physical venue/club name. Search the ENTIRE flyer. null if not found.
- location: city in English. Hebrew→English: ראשון לציון→Rishon LeZion, תל אביב→Tel Aviv, חיפה→Haifa, פתח תקווה→Petah Tikva, נתניה→Netanya, אשדוד→Ashdod, ירושלים→Jerusalem, הרצליה→Herzliya, רמת גן→Ramat Gan, באר שבע→Beer Sheva, רחובות→Rehovot, בת ים→Bat Yam.
- startDate/endDate: YYYY-MM-DD. Israeli format DD.MM.YY or DD.MM.YYYY (first=day, second=month). Single-day: endDate=startDate. Day-of-week only: calculate nearest upcoming occurrence from today (${today}).
- time: earliest time shown in HH:MM 24h. If a range shown take only start. null if not shown.
- styles: only from ["Salsa","Bachata","Kizomba","Zouk"] explicitly shown. Do NOT guess.
- price: number in ILS (0=free), null if unknown.
- ticketLink: full URL or null.
- address: street + number only, no city. null if not found.
- description: 1-2 sentences in Hebrew if flyer is Hebrew, English otherwise.
- coordinates: always null.`
}

function toISO(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null
  const s = dateStr.trim()
  const sixMonthsAgo = new Date(); sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [, m, d] = s.split('-')
    const asIs = new Date(s)
    if (asIs < sixMonthsAgo) {
      const thisYear = new Date().getFullYear()
      const withThisYear = `${thisYear}-${m}-${d}`
      if (new Date(withThisYear) >= sixMonthsAgo) return withThisYear
      return `${thisYear + 1}-${m}-${d}`
    }
    return s
  }
  const full = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/)
  if (full) return `${full[3]}-${full[2].padStart(2,'0')}-${full[1].padStart(2,'0')}`
  const short = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{2})$/)
  if (short) return `20${short[3]}-${short[2].padStart(2,'0')}-${short[1].padStart(2,'0')}`
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

export async function parseEventWithAI(flyerImageUrl, rawText, ocrText) {
  const today  = new Date().toISOString().split('T')[0]
  const prompt = buildPrompt(today)

  const textParts = [prompt]
  if (rawText?.trim()) textParts.push(`User-provided context:\n${rawText.trim()}`)
  if (ocrText?.trim()) textParts.push(`OCR text from flyer (use as ground truth for dates, times, addresses and venue names):\n${ocrText.trim()}`)
  const promptText = textParts.join('\n\n')

  let imageDataUrl = null
  if (flyerImageUrl) {
    try {
      const imgRes = await fetch(flyerImageUrl)
      const blob = await imgRes.blob()
      imageDataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result)
        reader.onerror = reject
        reader.readAsDataURL(blob)
      })
    } catch (e) {
      console.warn('Could not fetch image for base64 conversion:', e)
    }
  }

  const messages = [
    {
      role: 'system',
      content: 'You are a JSON-only data extractor. Your response must be a single valid JSON object. Never use markdown or any text outside the JSON.',
    },
    {
      role: 'user',
      content: imageDataUrl
        ? [
            { type: 'image_url', image_url: { url: imageDataUrl } },
            { type: 'text', text: promptText },
          ]
        : promptText,
    },
  ]

  const res = await fetch(
    'https://danzway-flyer-parser.guy-izhak-tech.workers.dev',
    {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, max_tokens: 600, temperature: 0.1 }),
    }
  )

  if (!res.ok) {
    const err = await res.text().catch(() => '')
    throw new Error(`Cloudflare AI ${res.status}: ${err.slice(0, 300)}`)
  }

  const data = await res.json()
  const raw  = data?.result?.response ?? data?.choices?.[0]?.message?.content ?? ''

  // CF sometimes returns a parsed object directly
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) return normalizeResult(raw)

  const rawStr = Array.isArray(raw)
    ? (raw.find(c => c.type === 'text')?.text ?? raw.map(c => c.text ?? '').join(''))
    : typeof raw === 'string' ? raw : JSON.stringify(raw)

  const jsonMatch = rawStr.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    try { return normalizeResult(JSON.parse(jsonMatch[0])) } catch {}
  }

  throw new Error(`No valid JSON in Cloudflare response: ${rawStr.slice(0, 200)}`)
}
