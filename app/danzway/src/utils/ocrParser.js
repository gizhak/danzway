const DANCE_STYLES = ['Salsa', 'Bachata', 'Kizomba', 'Zouk']

// Hebrew day-of-week → JS getDay() index (0=Sunday)
const HE_DAYS = {
  'ראשון': 0, 'שני': 1, 'שלישי': 2, 'רביעי': 3, 'חמישי': 4, 'שישי': 5, 'שבת': 6,
}

// Hebrew city → English
const HE_CITIES = {
  'תל אביב': 'Tel Aviv', 'ירושלים': 'Jerusalem', 'חיפה': 'Haifa',
  'ראשון לציון': 'Rishon LeZion', 'פתח תקווה': 'Petah Tikva',
  'הרצליה': 'Herzliya', 'רמת גן': 'Ramat Gan', 'נתניה': 'Netanya',
  'אשדוד': 'Ashdod', 'באר שבע': 'Beer Sheva', 'רחובות': 'Rehovot', 'בת ים': 'Bat Yam',
}

const HE_MONTHS = {
  'ינואר': '01', 'פברואר': '02', 'מרץ': '03', 'מרס': '03',
  'אפריל': '04', 'מאי': '05',  'יוני': '06', 'יולי': '07',
  'אוגוסט': '08', 'ספטמבר': '09', 'אוקטובר': '10',
  'נובמבר': '11', 'דצמבר': '12',
}

const EN_MONTHS = {
  jan: '01', january: '01',  feb: '02', february: '02',
  mar: '03', march: '03',    apr: '04', april: '04',
  may: '05',                 jun: '06', june: '06',
  jul: '07', july: '07',     aug: '08', august: '08',
  sep: '09', september: '09', oct: '10', october: '10',
  nov: '11', november: '11', dec: '12', december: '12',
}

function toYMD(day, month, year) {
  const y = year
    ? (String(year).length === 2 ? '20' + year : String(year))
    : String(new Date().getFullYear())
  return `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function nextWeekday(targetDay) {
  const today = new Date()
  const diff   = ((targetDay - today.getDay()) + 7) % 7 || 7
  const result = new Date(today)
  result.setDate(today.getDate() + diff)
  return result.toISOString().split('T')[0]
}

function extractDate(text) {
  // DD/MM/YYYY  DD.MM.YYYY  DD-MM-YYYY
  let m = text.match(/\b(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})\b/)
  if (m) return toYMD(m[1], m[2], m[3])

  // Hebrew: "19 יוני", "19 ביוני", "ב-19 יוני 2026"
  for (const [name, num] of Object.entries(HE_MONTHS)) {
    let re = new RegExp(`(?:ב-?)?(\\d{1,2})\\s*(?:ב)?${name}(?:\\s+(\\d{4}))?`)
    m = text.match(re)
    if (m) return toYMD(m[1], num, m[2])
    re = new RegExp(`${name}\\s+(\\d{1,2})(?:\\s+(\\d{4}))?`)
    m = text.match(re)
    if (m) return toYMD(m[1], num, m[2])
  }

  // English: "June 19, 2026" / "19 June 2026"
  const tl = text.toLowerCase()
  for (const [name, num] of Object.entries(EN_MONTHS)) {
    let re = new RegExp(`${name}\\s+(\\d{1,2})(?:st|nd|rd|th)?[,\\s]+(\\d{4})?`)
    m = tl.match(re)
    if (m) return toYMD(m[1], num, m[2])
    re = new RegExp(`(\\d{1,2})(?:st|nd|rd|th)?\\s+${name}(?:[,\\s]+(\\d{4}))?`)
    m = tl.match(re)
    if (m) return toYMD(m[1], num, m[2])
  }

  // Day-of-week reference — require "יום" prefix for ambiguous names to avoid false positives
  // "שבת" alone is safe; "ראשון"/"שני" need "יום" prefix (they appear in other contexts)
  const dayPatterns = [
    { re: /\bשבת\b/,         day: 6 },
    { re: /יום\s+שישי/,      day: 5 },
    { re: /יום\s+חמישי/,     day: 4 },
    { re: /יום\s+רביעי/,     day: 3 },
    { re: /יום\s+שלישי/,     day: 2 },
    { re: /יום\s+שני\b/,     day: 1 },
    { re: /יום\s+ראשון\b/,   day: 0 },
  ]
  for (const { re, day } of dayPatterns) {
    if (re.test(text)) return nextWeekday(day)
  }

  return null
}

function extractAddress(text) {
  // Look for "Street Number, KnownCity" — only match when a known city name appears
  for (const [heCity, enCity] of Object.entries(HE_CITIES)) {
    const escaped = heCity.replace(/\s+/g, '\\s+')
    // Pattern: Hebrew street name + number immediately before the city name
    const re = new RegExp(`([א-ת][א-ת"\\s\\-']{0,15}?)\\s+(\\d{1,4})\\s*,?\\s*${escaped}`)
    const m  = text.match(re)
    if (m) return { street: `${m[1].trim()} ${m[2]}`, city: enCity }
  }
  return { street: null, city: null }
}

function extractTime(text) {
  const m = text.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/)
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : null
}

function extractPrice(text) {
  if (/\bfree\b|חינ[מן]/i.test(text)) return '0'
  const m = text.match(/[₪](\d+)|(\d+)\s*(?:₪|ils|nis)\b/i)
  return m ? (m[1] || m[2]) : null
}

function extractUrl(text) {
  const m = text.match(/https?:\/\/[^\s<>"{}|\\^`[\]]+/i)
  return m ? m[0].replace(/[.,;)\]>]+$/, '') : null
}

function extractTitle(text) {
  return (
    text
      .split('\n')
      .map(l => l.trim())
      .find(l => l.length > 3 && !/^https?:/.test(l) && !/^\d+$/.test(l))
    ?? null
  )
}

/** Parses raw OCR text from a dance-event flyer into structured form fields. */
export function parseOcrText(rawText) {
  const text    = rawText || ''
  const date    = extractDate(text)
  const { street, city } = extractAddress(text)
  return {
    title:       extractTitle(text),
    startDate:   date,
    endDate:     date,
    time:        extractTime(text),
    price:       extractPrice(text),
    ticketLink:  extractUrl(text),
    styles:      DANCE_STYLES.filter(s => text.toLowerCase().includes(s.toLowerCase())),
    address:     street,
    location:    city,
    venue:       null,
    description: null,
    currency:    'ILS',
    coordinates: null,
  }
}
