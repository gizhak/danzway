from playwright.sync_api import sync_playwright
import re
from datetime import date, timedelta

HEBREW_DAYS = {
    'ראשון': 0,
    'שני':   1,
    'שלישי': 2,
    'רביעי': 3,
    'חמישי': 4,
    'שישי':  5,
    'שבת':   6,
}

# "ראשון" and "שני" are ambiguous (mean "first"/"second" in Hebrew).
# Only trust them when preceded by יום / כל / בימי context markers.
AMBIGUOUS_DAYS = {'ראשון', 'שני'}

# Patterns that unambiguously identify a weekday:
#   יום חמישי  |  כל חמישי  |  בימי חמישי  |  ביום חמישי
_DAY_PREFIXES = ['יום ', 'כל ', 'בימי ', 'ביום ']

def _build_day_patterns() -> list[tuple[str, int]]:
    """Return (pattern_string, js_day_index) sorted longest-first."""
    patterns = []
    for day, idx in HEBREW_DAYS.items():
        if day in AMBIGUOUS_DAYS:
            # Require a context prefix
            for pfx in _DAY_PREFIXES:
                patterns.append((pfx + day, idx))
        else:
            # Accept with or without prefix
            for pfx in _DAY_PREFIXES:
                patterns.append((pfx + day, idx))
            patterns.append((day, idx))
    return sorted(patterns, key=lambda x: len(x[0]), reverse=True)

DAY_PATTERNS = _build_day_patterns()

HEBREW_MONTHS = {
    'ינואר': 1, 'פברואר': 2, 'מרץ': 3, 'אפריל': 4,
    'מאי': 5, 'יוני': 6, 'יולי': 7, 'אוגוסט': 8,
    'ספטמבר': 9, 'אוקטובר': 10, 'נובמבר': 11, 'דצמבר': 12,
}

DEFAULT_KEYWORDS = [
    'סלסה', 'Salsa', 'salsa',
    "באצ'טה", 'Bachata', 'bachata', 'בצ\'אטה', 'בצאטה',
    'זוק', 'Zouk', 'zouk',
    'קיזומבה', 'Kizomba', 'kizomba',
    'מסיבה', 'מסיבות', 'ערב ריקוד', 'נרקוד',
    'West Coast Swing', 'WCS', 'Tango', 'תנגו',
    'לטיני', 'Latin',
]

STYLE_MAP = {
    'סלסה': 'Salsa', 'salsa': 'Salsa', 'Salsa': 'Salsa',
    "באצ'טה": 'Bachata', 'bachata': 'Bachata', 'Bachata': 'Bachata',
    "בצ'אטה": 'Bachata', 'בצאטה': 'Bachata',
    'זוק': 'Zouk', 'zouk': 'Zouk', 'Zouk': 'Zouk',
    'קיזומבה': 'Kizomba', 'kizomba': 'Kizomba', 'Kizomba': 'Kizomba',
    'tango': 'Tango', 'Tango': 'Tango', 'תנגו': 'Tango',
    'west coast swing': 'West Coast Swing', 'wcs': 'West Coast Swing',
    'מסיבה': 'Party', 'מסיבות': 'Party',
    'ערב ריקוד': 'Social', 'נרקוד': 'Social',
    'לטיני': 'Latin', 'latin': 'Latin',
}

TIME_RE      = re.compile(r'\b(\d{1,2}:\d{2})\b')
# Time preceded by event-start markers: "מ21:30", "משעה 22:00", "בשעה 20:00"
EVENT_TIME_RE = re.compile(r'(?:מ|משעה|בשעה|ב-|ב–|החל מ)\s*(\d{1,2}:\d{2})')
# Matches: 30.4, 30/4, 30.04.2026, 30/04/26
DATE_NUM_RE = re.compile(r'\b(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?\b')
# Matches: "30 באפריל", "30 לאפריל"
DATE_HE_RE  = re.compile(r'(\d{1,2})\s+[בל](' + '|'.join(HEBREW_MONTHS) + r')')


def _today_yyyy() -> int:
    return date.today().year


def _parse_numeric_date(m: re.Match) -> str | None:
    """Convert a DD.MM or DD.MM.YYYY match to YYYY-MM-DD, only if in the future."""
    d, mo = int(m.group(1)), int(m.group(2))
    yr_raw = m.group(3)
    if not (1 <= d <= 31 and 1 <= mo <= 12):
        return None
    yr = _today_yyyy()
    if yr_raw:
        yr_raw = int(yr_raw)
        yr = yr_raw if yr_raw > 100 else 2000 + yr_raw
    try:
        candidate = date(yr, mo, d)
    except ValueError:
        return None
    # If the date has already passed this year, try next year
    if candidate < date.today():
        try:
            candidate = date(yr + 1, mo, d)
        except ValueError:
            return None
    return candidate.isoformat()


def _parse_hebrew_date(m: re.Match) -> str | None:
    d    = int(m.group(1))
    mo   = HEBREW_MONTHS.get(m.group(2))
    if not mo:
        return None
    yr   = _today_yyyy()
    try:
        candidate = date(yr, mo, d)
    except ValueError:
        return None
    if candidate < date.today():
        try:
            candidate = date(yr + 1, mo, d)
        except ValueError:
            return None
    return candidate.isoformat()


def _next_weekday_date(js_day_idx: int) -> str:
    """Given a JS-convention day index (Sun=0 … Sat=6), return next future YYYY-MM-DD."""
    # Python weekday: Mon=0 … Sun=6  →  JS: Sun=0 … Sat=6
    py_idx   = (js_day_idx + 6) % 7
    today    = date.today()
    days_fwd = (py_idx - today.weekday() + 7) % 7 or 7
    return (today + timedelta(days=days_fwd)).isoformat()


def _extract_date(text: str) -> str | None:
    """Try specific date first (DD.MM / Hebrew month), then unambiguous weekday pattern."""
    for m in DATE_HE_RE.finditer(text):
        d = _parse_hebrew_date(m)
        if d:
            return d
    for m in DATE_NUM_RE.finditer(text):
        d = _parse_numeric_date(m)
        if d:
            return d
    for pattern, idx in DAY_PATTERNS:
        if pattern in text:
            return _next_weekday_date(idx)
    return None


def _extract_day_name(text: str) -> str | None:
    """Return the Hebrew day name matched (for display/reference)."""
    for pattern, idx in DAY_PATTERNS:
        if pattern in text:
            # Return the bare day name (without prefix)
            bare = pattern.strip()
            for pfx in _DAY_PREFIXES:
                bare = bare.replace(pfx.strip(), '').strip()
            return bare or pattern
    return None


def _extract_time(text: str) -> str | None:
    """Prefer event-start time markers (מ/משעה/בשעה HH:MM) over bare times."""
    m = EVENT_TIME_RE.search(text)
    if m:
        return m.group(1)
    m = TIME_RE.search(text)
    return m.group(1) if m else None


def _extract_all_day_time_pairs(lines: list[str]) -> list[tuple[str, int, str | None]]:
    """
    Scan lines for (day_pattern, js_day_idx, time) pairs.
    Returns list of (pattern, idx, time) — one per unique day found.
    Used to emit multiple events from a single chunk (e.g. "Thu party + Wed jam").
    """
    found = []
    seen_days = set()
    for line in lines:
        for pattern, idx in DAY_PATTERNS:
            if pattern in line and idx not in seen_days:
                seen_days.add(idx)
                t = _extract_time(line)
                found.append((pattern, idx, t))
    return found


def _extract_style(text: str) -> str:
    lower = text.lower()
    for keyword, canonical in STYLE_MAP.items():
        if keyword.lower() in lower:
            return canonical
    return 'Dance'


def run_scan(url: str, keywords: list | None = None) -> dict:
    """
    Scrape a venue page with Playwright and return structured event data.

    Returns:
        {
            "status": "found" | "no_events" | "blocked" | "timeout" | "error",
            "events": [...],
            "error": "..." (only on error/timeout)
        }
    """
    if keywords is None:
        keywords = DEFAULT_KEYWORDS

    all_keywords = list(set(keywords + DEFAULT_KEYWORDS))

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(
            user_agent=(
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
                'AppleWebKit/537.36 (KHTML, like Gecko) '
                'Chrome/124.0.0.0 Safari/537.36'
            )
        )

        try:
            response = page.goto(url, wait_until='networkidle', timeout=60000)

            if response and response.status in (403, 401, 429):
                browser.close()
                return {'status': 'blocked', 'events': []}

            content = page.inner_text('body')
            lines = [l for l in content.split('\n') if l.strip()]

            seen_chunks: set = set()
            events: list = []

            for i, line in enumerate(lines):
                if not any(kw.lower() in line.lower() for kw in all_keywords):
                    continue

                start = max(0, i - 2)
                end   = min(len(lines), i + 3)
                chunk_lines = lines[start:end]
                chunk_text  = ' | '.join(l.strip() for l in chunk_lines if l.strip())

                if chunk_text in seen_chunks:
                    continue
                seen_chunks.add(chunk_text)

                # Wider window (±8 lines) for date + time context
                wide_start  = max(0, i - 8)
                wide_end    = min(len(lines), i + 9)
                wide_lines  = lines[wide_start:wide_end]
                wide_text   = ' '.join(wide_lines)

                style = _extract_style(chunk_text)

                # Try to find multiple (day, time) pairs within the wide window
                # so one Match #11 block can produce both "Thu 21:30" and "Wed 21:30"
                day_time_pairs = _extract_all_day_time_pairs(wide_lines)

                if day_time_pairs:
                    for pattern, idx, t in day_time_pairs:
                        event_date = _next_weekday_date(idx)
                        # Use the keyword-matched line as title, not the first nav link
                        title_line = line.strip()[:100]
                        events.append({
                            'day':     pattern,
                            'date':    event_date,
                            'type':    style,
                            'time':    t,
                            'title':   title_line,
                            'rawText': chunk_text,
                        })
                else:
                    # No day found — try specific date (DD.MM / Hebrew month)
                    extracted_date = _extract_date(wide_text)
                    time_val       = _extract_time(wide_text)
                    title_line     = line.strip()[:100]
                    events.append({
                        'day':     None,
                        'date':    extracted_date,
                        'type':    style,
                        'time':    time_val,
                        'title':   title_line,
                        'rawText': chunk_text,
                    })

            browser.close()

            if not events:
                return {'status': 'no_events', 'events': []}

            return {'status': 'found', 'events': events}

        except Exception as e:
            browser.close()
            err = str(e).lower()
            if 'timeout' in err:
                return {'status': 'timeout', 'events': [], 'error': str(e)}
            return {'status': 'error', 'events': [], 'error': str(e)}


if __name__ == '__main__':
    import json
    result = run_scan('https://www.bebachata.co.il/קורסים/המסיבות-שלנו/')
    print(json.dumps(result, ensure_ascii=False, indent=2))
