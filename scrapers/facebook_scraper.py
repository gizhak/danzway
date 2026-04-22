"""
DanzWay Facebook Group Scraper

Auth setup (one-time):
  cd scrapers
  python -m playwright codegen --save-storage=fb_auth.json https://www.facebook.com/groups/bachataisrael/
  Log in to Facebook in the opened browser, then close it.
  The session is saved to scrapers/fb_auth.json and reused automatically.
"""
from playwright.sync_api import sync_playwright
import re
import os
from datetime import date, timedelta

AUTH_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'fb_auth.json')

SPECIAL_KEYWORDS = [
    'יומולדת', 'חג', 'special', 'Special', 'סדנה', 'מיוחד',
    'גאלה', 'gala', 'birthday', 'workshop', 'וורקשופ',
]

DANCE_KEYWORDS = [
    'סלסה', 'Salsa', 'salsa',
    "באצ'טה", 'Bachata', 'bachata', "בצ'אטה", 'בצאטה',
    'זוק', 'Zouk', 'zouk',
    'קיזומבה', 'Kizomba', 'kizomba',
    'לטיני', 'latin', 'Latin',
    'ריקוד', 'dance', 'Dance',
    'מסיבה', 'party', 'Party',
    'West Coast Swing', 'WCS', 'Tango', 'תנגו',
]

HEBREW_DAYS = {
    'ראשון': 0, 'שני': 1, 'שלישי': 2,
    'רביעי': 3, 'חמישי': 4, 'שישי': 5, 'שבת': 6,
}

HEBREW_MONTHS = {
    'ינואר': 1, 'פברואר': 2, 'מרץ': 3, 'אפריל': 4,
    'מאי': 5, 'יוני': 6, 'יולי': 7, 'אוגוסט': 8,
    'ספטמבר': 9, 'אוקטובר': 10, 'נובמבר': 11, 'דצמבר': 12,
}

TIME_RE = re.compile(r'\b(\d{1,2}:\d{2})\b')
DATE_NUM_RE = re.compile(r'\b(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?\b')
DATE_HE_RE = re.compile(r'(\d{1,2})\s+[בל](' + '|'.join(HEBREW_MONTHS) + r')')
NEXT_MARKERS = ['הקרוב', 'הבא', 'הזה']


def _today() -> date:
    return date.today()


def _parse_date_from_text(text: str) -> str | None:
    """Extract YYYY-MM-DD from post text — tries Hebrew month, numeric, then relative."""
    # "30 באפריל" / "30 לאפריל"
    for m in DATE_HE_RE.finditer(text):
        d_val = int(m.group(1))
        mo = HEBREW_MONTHS.get(m.group(2))
        if not mo:
            continue
        try:
            candidate = date(_today().year, mo, d_val)
            if candidate < _today():
                candidate = date(_today().year + 1, mo, d_val)
            return candidate.isoformat()
        except ValueError:
            continue

    # "30.4" / "30/4" / "30.04.2026"
    for m in DATE_NUM_RE.finditer(text):
        d_val, mo = int(m.group(1)), int(m.group(2))
        if not (1 <= d_val <= 31 and 1 <= mo <= 12):
            continue
        yr_raw = m.group(3)
        yr = _today().year
        if yr_raw:
            yr_raw = int(yr_raw)
            yr = yr_raw if yr_raw > 100 else 2000 + yr_raw
        try:
            candidate = date(yr, mo, d_val)
            if candidate < _today():
                candidate = date(yr + 1, mo, d_val)
            return candidate.isoformat()
        except ValueError:
            continue

    # Relative — "הלילה", "מחר"
    if 'הלילה' in text or 'היום' in text:
        return _today().isoformat()
    if 'מחרתיים' in text:
        return (_today() + timedelta(days=2)).isoformat()
    if 'מחר' in text:
        return (_today() + timedelta(days=1)).isoformat()

    # "יום שלישי הקרוב" / "שלישי הבא"
    for day_name, day_idx in HEBREW_DAYS.items():
        if day_name not in text:
            continue
        has_next = any(mk in text for mk in NEXT_MARKERS)
        has_prefix = ('יום ' + day_name) in text or ('כל ' + day_name) in text
        if has_next or has_prefix:
            today = _today()
            # Python weekday: Mon=0…Sun=6; JS: Sun=0…Sat=6
            py_idx = (day_idx + 6) % 7
            days_fwd = (py_idx - today.weekday() + 7) % 7 or 7
            return (today + timedelta(days=days_fwd)).isoformat()

    return None


def _extract_time(text: str) -> str | None:
    m = TIME_RE.search(text)
    return m.group(1) if m else None


def _is_dance_post(text: str) -> bool:
    lower = text.lower()
    return any(kw.lower() in lower for kw in DANCE_KEYWORDS)


def _is_special(text: str) -> bool:
    lower = text.lower()
    return any(kw.lower() in lower for kw in SPECIAL_KEYWORDS)


def _match_venue(post_text: str, venues: list) -> dict | None:
    """Return first venue whose name appears in the post text (case-insensitive)."""
    lower = post_text.lower()
    for v in venues:
        name = (v.get('name') or '').strip()
        if name and len(name) > 2 and name.lower() in lower:
            return v
        city = (v.get('city') or '').strip()
        if city and len(city) > 3 and city.lower() in lower:
            return v
    return None


def run_facebook_scan(url: str, venues: list | None = None, keywords: list | None = None) -> dict:
    """
    Scrape a Facebook group for dance event posts.

    Args:
        url:      Facebook group URL (e.g. https://www.facebook.com/groups/bachataisrael/)
        venues:   List of { placeId, name, city } dicts to match against post text.
        keywords: Additional dance keywords to include in detection (merged with defaults).

    Returns:
        {
            "status": "found" | "no_events" | "blocked" | "timeout" | "error",
            "posts": [...],
            "error": "..." (only on error/timeout)
        }
    """
    if venues is None:
        venues = []
    if keywords is None:
        keywords = []

    all_keywords = list(set(DANCE_KEYWORDS + keywords))

    has_auth = os.path.exists(AUTH_FILE)
    if not has_auth:
        print(f'[FbScraper] Warning: no auth file found at {AUTH_FILE}')
        print('[FbScraper] Run: python -m playwright codegen --save-storage=fb_auth.json https://www.facebook.com/groups/bachataisrael/')

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent=(
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
                'AppleWebKit/537.36 (KHTML, like Gecko) '
                'Chrome/124.0.0.0 Safari/537.36'
            ),
            storage_state=AUTH_FILE if has_auth else None,
        )
        page = context.new_page()

        try:
            response = page.goto(url, wait_until='domcontentloaded', timeout=45000)

            # Detect login wall
            current_url = page.url
            if 'login' in current_url or 'checkpoint' in current_url:
                context.close(); browser.close()
                return {
                    'status': 'blocked',
                    'posts': [],
                    'error': 'Facebook requires login to view this group',
                }

            if response and response.status in (403, 401, 429):
                context.close(); browser.close()
                return {'status': 'blocked', 'posts': []}

            # Scroll to load ~5 days of posts (8 scrolls × 1.5 s)
            for _ in range(8):
                page.evaluate('window.scrollTo(0, document.body.scrollHeight)')
                page.wait_for_timeout(1500)

            content = page.inner_text('body')

            # Detect login wall by body text (Facebook may overlay login without URL change)
            LOGIN_SIGNALS = ['Log in to Facebook', 'התחבר לפייסבוק', 'You must log in', 'Join Facebook']
            if any(sig in content for sig in LOGIN_SIGNALS) and len(content) < 8000:
                context.close(); browser.close()
                return {
                    'status': 'blocked',
                    'posts': [],
                    'error': 'Facebook login wall detected in page body',
                }

            context.close(); browser.close()

            # Build line-level chunks: group consecutive non-empty lines into blocks
            lines = [l.strip() for l in content.split('\n') if l.strip()]
            raw_blocks: list[str] = []
            current: list[str] = []
            for line in lines:
                if line:
                    current.append(line)
                else:
                    if current:
                        raw_blocks.append(' '.join(current))
                        current = []
            if current:
                raw_blocks.append(' '.join(current))

            # Also try paragraph-level (double-newline) split to catch longer posts
            para_blocks = [b.strip() for b in content.split('\n\n') if b.strip() and len(b.strip()) > 30]
            all_blocks = para_blocks + raw_blocks

            posts = []
            seen: set = set()

            for block in all_blocks:
                if not _is_dance_post(block):
                    continue

                dedup_key = block[:100]
                if dedup_key in seen:
                    continue
                seen.add(dedup_key)

                event_date = _parse_date_from_text(block)
                event_time = _extract_time(block)
                special    = _is_special(block)

                matched = _match_venue(block, venues)

                posts.append({
                    'text':         block[:500],
                    'date':         event_date,
                    'time':         event_time,
                    'isSpecial':    special,
                    'source':       'facebook',
                    'sourceUrl':    url,
                    'placeId':      matched.get('placeId') if matched else None,
                    'venue':        matched.get('name')    if matched else None,
                    'location':     matched.get('city')    if matched else None,
                    'matchedVenue': matched,
                })

            if not posts:
                return {'status': 'no_events', 'posts': []}

            return {'status': 'found', 'posts': posts}

        except Exception as e:
            try:
                context.close(); browser.close()
            except Exception:
                pass
            err = str(e).lower()
            if 'timeout' in err:
                return {'status': 'timeout', 'posts': [], 'error': str(e)}
            return {'status': 'error', 'posts': [], 'error': str(e)}


if __name__ == '__main__':
    import json
    result = run_facebook_scan(
        'https://www.facebook.com/groups/bachataisrael/',
        venues=[{'placeId': 'test-001', 'name': 'Be Bachata', 'city': 'Tel Aviv'}],
    )
    print(json.dumps(result, ensure_ascii=False, indent=2))
