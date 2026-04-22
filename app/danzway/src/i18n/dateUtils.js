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

/** Profile-style short date: "Sun, 5 Jan" / equivalent in he-IL. */
export function profileDate(dateStr, lang) {
  const locale = LOCALE[lang] ?? 'en-US'
  return parseLocalDate(dateStr).toLocaleDateString(locale, {
    weekday: 'short',
    day:     'numeric',
    month:   'short',
  })
}
