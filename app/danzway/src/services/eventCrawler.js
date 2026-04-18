/**
 * Autonomous event crawler — stable edition.
 *
 * Key design decisions:
 *  - Two CORS proxies tried in sequence: allorigins.win → corsproxy.io
 *  - Each proxy gets 2 attempts with 1.5 s back-off before falling through
 *  - 'blocked' errors skip retries and move to the next proxy immediately
 *  - Classified result: { events, status, error }
 *    status ∈ 'found' | 'no_events' | 'blocked' | 'timeout' | 'error'
 *  - Caller is responsible for throttling (scan one venue at a time)
 *
 * Parsing pipeline (stops at first successful layer):
 *  1. Meety specialist  — __NEXT_DATA__ deep-search (meety.co.il)
 *  2. JSON-LD           — schema.org/Event standard
 *  3. Next.js generic   — __NEXT_DATA__ for any Next.js app
 *  4. Regex fallback    — date/time extraction from visible text
 */

// ─── Proxies ─────────────────────────────────────────────────────────────────

const TIMEOUT = 20_000   // 20 s per attempt

// Each proxy entry: { wrap(url) → fetch URL, unwrap(res) → Promise<html> }
const PROXIES = [
  {
    name:   'allorigins',
    wrap:   (url) => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
    unwrap: async (res) => {
      const json = await res.json()
      if (json.status?.http_code && json.status.http_code >= 400) {
        throw Object.assign(new Error(`Site returned ${json.status.http_code}`), { kind: 'blocked' })
      }
      if (!json.contents) {
        throw Object.assign(new Error('Empty proxy response'), { kind: 'blocked' })
      }
      return json.contents
    },
  },
  {
    name:   'corsproxy',
    wrap:   (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
    unwrap: async (res) => {
      const text = await res.text()
      if (!text || text.length < 200) {
        throw Object.assign(new Error('Empty corsproxy response'), { kind: 'blocked' })
      }
      return text
    },
  },
]

// ─── Fetch with retry ────────────────────────────────────────────────────────

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

/**
 * Tries each CORS proxy in sequence.
 * Per proxy: up to 2 attempts with 1.5 s back-off.
 * 'blocked' errors skip retries and move to the next proxy immediately.
 * Throws a classified Error { kind: 'timeout'|'blocked'|'error' } if all fail.
 */
async function fetchWithRetry(url) {
  let lastErr

  for (const proxy of PROXIES) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      const ctrl  = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), TIMEOUT)
      try {
        const res = await fetch(proxy.wrap(url), { signal: ctrl.signal })
        clearTimeout(timer)
        if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { kind: 'blocked' })
        return await proxy.unwrap(res)   // ← success
      } catch (err) {
        clearTimeout(timer)
        lastErr = err.name === 'AbortError'
          ? Object.assign(new Error('Request timed out'), { kind: 'timeout' })
          : err
        if (lastErr.kind === 'blocked') break   // site rejected this proxy — skip retries, try next proxy
        if (attempt < 2) await sleep(1500)
      }
    }
    // fall through to next proxy on any failure (blocked, timeout, or error)
  }

  throw lastErr
}

// ─── Date / Time helpers ──────────────────────────────────────────────────────

export function parseDate(raw) {
  if (!raw) return null
  const s = String(raw).trim()

  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)

  const dmy = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/)
  if (dmy) {
    const [, d, m, y] = dmy
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }

  if (/^\d{10,13}$/.test(s)) {
    const ms = s.length === 10 ? Number(s) * 1000 : Number(s)
    return new Date(ms).toISOString().slice(0, 10)
  }

  const d = new Date(s)
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10)
  return null
}

function parseTime(raw) {
  if (!raw) return null
  const m = String(raw).match(/\b(\d{1,2}:\d{2})\b/)
  return m ? m[1] : null
}

function isFuture(dateStr) {
  if (!dateStr) return false
  const d = new Date(dateStr)
  d.setHours(0, 0, 0, 0)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return d >= today
}

// ─── JSON-LD ──────────────────────────────────────────────────────────────────

function extractJsonLdEvents(html) {
  const found = []
  const re    = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  let m
  while ((m = re.exec(html)) !== null) {
    try {
      const data  = JSON.parse(m[1])
      const items = Array.isArray(data) ? data : [data]
      for (const item of items) {
        const TYPE = ['Event', 'MusicEvent', 'DanceEvent', 'SocialEvent']
        if (TYPE.includes(item['@type'])) found.push(item)
        if (Array.isArray(item['@graph'])) {
          item['@graph'].filter(x => TYPE.includes(x['@type'])).forEach(x => found.push(x))
        }
      }
    } catch { /* malformed */ }
  }
  return found
}

function normaliseJsonLd(item, venue) {
  const dateStr = parseDate(item.startDate)
  if (!dateStr || !isFuture(dateStr)) return null
  return {
    title:       String(item.name ?? `Event at ${venue.name}`).trim(),
    date:        dateStr,
    time:        parseTime(item.startDate) ?? parseTime(item.startTime) ?? '21:00',
    description: String(item.description ?? '').trim(),
    price:       String(item.offers?.price ?? item.offers?.[0]?.price ?? '0'),
    currency:    item.offers?.priceCurrency ?? 'ILS',
    url:         item.url ?? venue.website,
  }
}

// ─── __NEXT_DATA__ deep search ────────────────────────────────────────────────

function extractNextData(html) {
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)
  if (!m) return null
  try { return JSON.parse(m[1]) } catch { return null }
}

const DATE_KEYS  = new Set(['date','startdate','start_date','datetime','eventdate','starts_at','startsat'])
const TITLE_KEYS = new Set(['name','title','eventname','event_name','heading','subject','displayname'])

function isEventLike(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false
  const keys = Object.keys(obj).map(k => k.toLowerCase())
  return keys.some(k => DATE_KEYS.has(k)) && keys.some(k => TITLE_KEYS.has(k))
}

function findEventObjects(obj, depth = 0, acc = []) {
  if (depth > 12 || obj == null || typeof obj !== 'object') return acc
  if (Array.isArray(obj)) {
    if (obj.length > 0 && obj.length < 200 && isEventLike(obj[0])) {
      obj.forEach(item => { if (isEventLike(item)) acc.push(item) })
    } else {
      obj.forEach(item => findEventObjects(item, depth + 1, acc))
    }
  } else {
    if (isEventLike(obj)) { acc.push(obj) }
    else { Object.values(obj).forEach(v => findEventObjects(v, depth + 1, acc)) }
  }
  return acc
}

function normaliseEventObject(raw, venue) {
  const rawDate = raw.date ?? raw.startDate ?? raw.start_date ?? raw.datetime ??
                  raw.eventDate ?? raw.starts_at ?? raw.startsAt
  const rawTime = raw.time ?? raw.startTime ?? raw.start_time ?? parseTime(rawDate)
  const title   = raw.name ?? raw.title ?? raw.eventName ?? raw.event_name ??
                  raw.heading ?? raw.displayName ?? `Event at ${venue.name}`
  const dateStr = parseDate(rawDate)
  if (!dateStr || !isFuture(dateStr)) return null
  return {
    title:       String(title).trim() || `Event at ${venue.name}`,
    date:        dateStr,
    time:        rawTime ? String(rawTime).slice(0, 5) : '21:00',
    description: String(raw.description ?? raw.details ?? raw.content ?? '').trim().slice(0, 300),
    price:       String(raw.price ?? raw.ticket_price ?? raw.amount ?? '0'),
    currency:    raw.currency ?? 'ILS',
    url:         raw.url ?? raw.link ?? raw.ticketUrl ?? venue.website,
  }
}

// ─── Regex text fallback ──────────────────────────────────────────────────────

function extractByRegex(html, venue) {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')

  const events    = []
  const seenDates = new Set()
  const dateRe    = /\b(\d{1,2}[-/]\d{1,2}[-/]\d{4}|\d{4}-\d{2}-\d{2})\b/g
  const timeRe    = /\b(\d{1,2}:\d{2})\b/

  let m
  while ((m = dateRe.exec(text)) !== null) {
    const dateStr = parseDate(m[1])
    if (!dateStr || !isFuture(dateStr) || seenDates.has(dateStr)) continue
    seenDates.add(dateStr)

    const ctx   = text.slice(Math.max(0, m.index - 150), m.index + 150)
    const tMath = ctx.match(timeRe)
    const time  = tMath ? tMath[1] : '21:00'

    // Best-effort title: take up to 6 words before the date
    const before = text.slice(Math.max(0, m.index - 80), m.index).trim()
    const words  = before.replace(/[^\p{L}\p{N}\s-]/gu, ' ').trim().split(/\s+/).filter(Boolean).slice(-6).join(' ')
    const title  = words.length > 3 ? words : `${venue.name} — Party Night`

    events.push({ title, date: dateStr, time, description: '', price: '0', currency: 'ILS', url: venue.website })
  }
  return events
}

function deduplicate(events) {
  const seen = new Set()
  return events.filter(e => {
    const key = `${e.date}|${e.time}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

// ─── Meety parser ────────────────────────────────────────────────────────────

function parseMeety(html, venue) {
  // 1. __NEXT_DATA__
  const nd = extractNextData(html)
  if (nd) {
    const events = findEventObjects(nd?.props?.pageProps ?? nd)
      .map(o => normaliseEventObject(o, venue)).filter(Boolean)
    if (events.length) return deduplicate(events)
  }

  // 2. window globals (__INITIAL_STATE__ etc.)
  const gm = html.match(/window\.__(?:INITIAL_?)?(?:STATE|DATA|APP|STORE)__\s*=\s*({[\s\S]*?})(?:;|\n)/)
  if (gm) {
    try {
      const events = findEventObjects(JSON.parse(gm[1]))
        .map(o => normaliseEventObject(o, venue)).filter(Boolean)
      if (events.length) return deduplicate(events)
    } catch { /* ignore */ }
  }

  // 3. JSON-LD
  const jld = extractJsonLdEvents(html).map(e => normaliseJsonLd(e, venue)).filter(Boolean)
  if (jld.length) return deduplicate(jld)

  // 4. Regex
  return deduplicate(extractByRegex(html, venue))
}

// ─── Generic parser ───────────────────────────────────────────────────────────

function parseGeneric(html, venue) {
  const jld = extractJsonLdEvents(html).map(e => normaliseJsonLd(e, venue)).filter(Boolean)
  if (jld.length) return deduplicate(jld)

  const nd = extractNextData(html)
  if (nd) {
    const events = findEventObjects(nd?.props?.pageProps ?? nd)
      .map(o => normaliseEventObject(o, venue)).filter(Boolean)
    if (events.length) return deduplicate(events)
  }

  return deduplicate(extractByRegex(html, venue))
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Crawls venue.ticketUrl (preferred) or venue.website and returns a structured result.
 * ticketUrl is always tried first — it's the admin-specified event/ticket page (e.g. Meety).
 * website is the fallback for venues that have no dedicated ticket URL.
 *
 * @returns {{ events: object[], status: string, error: string|null }}
 *   status: 'found' | 'no_events' | 'blocked' | 'timeout' | 'error'
 */
export async function crawlVenueWebsite(venue) {
  // Prioritize explicit ticket/event URL; fall back to general website
  const url = venue.ticketUrl?.trim() || venue.website?.trim()
  if (!url || /instagram\.com|facebook\.com|fb\.me|linktr\.ee/i.test(url)) {
    return { events: [], status: 'blocked', error: 'Social media URL (requires OAuth)' }
  }

  let html
  try {
    html = await fetchWithRetry(url)
  } catch (err) {
    const kind = err.kind ?? 'error'
    return { events: [], status: kind, error: err.message }
  }

  // meety.co.il gets the specialist parser regardless of which field the URL came from
  const parser = url.includes('meety.co.il') ? parseMeety : parseGeneric
  const raw    = parser(html, venue)

  // Attach venue context to every candidate event
  const events = raw.map(e => ({
    ...e,
    venue:    venue.name,
    location: venue.city    ?? '',
    placeId:  venue.placeId,
    styles:   venue.styles  ?? [],
    whatsapp: venue.phone   ?? null,
  }))

  return {
    events,
    status: events.length > 0 ? 'found' : 'no_events',
    error:  null,
  }
}
