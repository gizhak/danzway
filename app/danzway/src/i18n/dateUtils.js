/**
 * Locale-aware date helpers.
 * All functions accept the active i18n language string ('en' | 'he').
 */

const LOCALE = { en: 'en-US', he: 'he-IL' }

/**
 * Parse a YYYY-MM-DD string as local midnight.
 * new Date("YYYY-MM-DD") is treated as UTC by the spec — this avoids the
 * off-by-one-day shift that occurs in UTC+ timezones like Israel (UTC+3).
 */
function parseLocalDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** "Tonight" / "Tomorrow" / weekday / short date, translated via t(). */
export function relativeDate(dateStr, t, lang) {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const ev    = parseLocalDate(dateStr)
  const diff  = Math.round((ev - today) / 86400000)
  if (diff === 0) return t('common.tonight')
  if (diff === 1) return t('common.tomorrow')
  const locale = LOCALE[lang] ?? 'en-US'
  if (diff > 1 && diff < 7) return ev.toLocaleDateString(locale, { weekday: 'long' })
  return ev.toLocaleDateString(locale, { month: 'short', day: 'numeric' })
}

/** Short month label (e.g. "JAN" / "ינו") + numeric day. */
export function shortMonthDay(dateStr, lang) {
  const d      = parseLocalDate(dateStr)
  const locale = LOCALE[lang] ?? 'en-US'
  return {
    month: d.toLocaleDateString(locale, { month: 'short' }).toUpperCase(),
    day:   d.getDate(),
  }
}

/**
 * Given a Hebrew day name (e.g. "חמישי"), returns the YYYY-MM-DD string for
 * the next upcoming occurrence of that weekday, always in the future.
 * Uses local midnight to avoid UTC+3 off-by-one shift.
 */
export function getNextWeekdayDate(hebrewDay) {
  const dayMap = { 'ראשון': 0, 'שני': 1, 'שלישי': 2, 'רביעי': 3, 'חמישי': 4, 'שישי': 5, 'שבת': 6 }
  const target = dayMap[hebrewDay]
  if (target === undefined) return null
  const today    = new Date()
  const todayDay = today.getDay()
  const daysAhead = (target - todayDay + 7) % 7 || 7
  const result = new Date(today.getFullYear(), today.getMonth(), today.getDate() + daysAhead)
  const y = result.getFullYear()
  const m = String(result.getMonth() + 1).padStart(2, '0')
  const d = String(result.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Parse Hebrew relative date expressions from free-form post text.
 * Handles: "הלילה", "מחר", "יום שלישי הקרוב", "שישי הבא", numeric "30.4", "30 באפריל".
 * Returns YYYY-MM-DD or null if no date expression found.
 */
export function parseHebrewRelativeDate(text) {
  if (!text) return null

  const HEBREW_MONTHS_MAP = {
    'ינואר': 1, 'פברואר': 2, 'מרץ': 3, 'אפריל': 4,
    'מאי': 5, 'יוני': 6, 'יולי': 7, 'אוגוסט': 8,
    'ספטמבר': 9, 'אוקטובר': 10, 'נובמבר': 11, 'דצמבר': 12,
  }
  const HEBREW_DAYS_MAP = {
    'ראשון': 0, 'שני': 1, 'שלישי': 2, 'רביעי': 3, 'חמישי': 4, 'שישי': 5, 'שבת': 6,
  }
  const NEXT_MARKERS = ['הקרוב', 'הבא', 'הזה']

  const toISO = (d) => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${dd}`
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const addDays = (n) => {
    const d = new Date(today)
    d.setDate(d.getDate() + n)
    return toISO(d)
  }

  // Immediate relatives
  if (text.includes('הלילה') || text.includes('היום')) return addDays(0)
  if (text.includes('מחרתיים')) return addDays(2)
  if (text.includes('מחר'))    return addDays(1)

  // Hebrew month: "30 באפריל"
  const heMonthRe = new RegExp(`(\\d{1,2})\\s+[בל](${Object.keys(HEBREW_MONTHS_MAP).join('|')})`)
  const heMonthM = heMonthRe.exec(text)
  if (heMonthM) {
    const d = parseInt(heMonthM[1], 10)
    const mo = HEBREW_MONTHS_MAP[heMonthM[2]]
    if (mo) {
      let candidate = new Date(today.getFullYear(), mo - 1, d)
      if (candidate < today) candidate = new Date(today.getFullYear() + 1, mo - 1, d)
      return toISO(candidate)
    }
  }

  // Numeric: "30.4" / "30/4" / "30.04.2026"
  const numDateRe = /\b(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?\b/
  const numM = numDateRe.exec(text)
  if (numM) {
    const d = parseInt(numM[1], 10)
    const mo = parseInt(numM[2], 10)
    if (d >= 1 && d <= 31 && mo >= 1 && mo <= 12) {
      let yr = today.getFullYear()
      if (numM[3]) { const r = parseInt(numM[3], 10); yr = r > 100 ? r : 2000 + r }
      let candidate = new Date(yr, mo - 1, d)
      if (candidate < today) candidate = new Date(yr + 1, mo - 1, d)
      return toISO(candidate)
    }
  }

  // "יום שלישי הקרוב" / "שישי הבא"
  for (const [dayName, dayIdx] of Object.entries(HEBREW_DAYS_MAP)) {
    if (!text.includes(dayName)) continue
    const hasNext   = NEXT_MARKERS.some((mk) => text.includes(mk))
    const hasPrefix = text.includes('יום ' + dayName) || text.includes('כל ' + dayName)
    if (hasNext || hasPrefix) {
      return getNextWeekdayDate(dayName)
    }
  }

  return null
}

/** Profile-style short date: "Sun, 5 Jan" / equivalent in he-IL. */
export function profileDate(dateStr, lang) {
  const locale = LOCALE[lang] ?? 'en-US'
  return parseLocalDate(dateStr).toLocaleDateString(locale, {
    weekday: 'short',
    day:     'numeric',
    month:   'short',
  })
}
