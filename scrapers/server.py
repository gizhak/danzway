"""
DanzWay Python Scraper API — Local Flask bridge for the React admin dashboard.
Run: python scrapers/server.py

All protected endpoints require the header:
  X-Scraper-Token: <value of SCRAPER_API_KEY in scrapers/.env>
"""
import os
from functools import wraps
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from scraper import run_scan
from facebook_scraper import run_facebook_scan

load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

SCRAPER_API_KEY = os.environ.get('SCRAPER_API_KEY', '')

# Only allow requests from the production app and local dev
ALLOWED_ORIGINS = [
    'https://danzway-app.web.app',
    'https://danzway-app.firebaseapp.com',
    'http://localhost:5173',
    'http://localhost:4173',
]

app = Flask(__name__)
CORS(app, origins=ALLOWED_ORIGINS, supports_credentials=False)


# ── Auth middleware ───────────────────────────────────────────────────────────

def require_token(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not SCRAPER_API_KEY:
            return jsonify({'status': 'error', 'error': 'Server misconfigured: SCRAPER_API_KEY not set'}), 500
        token = request.headers.get('X-Scraper-Token', '')
        if not token or token != SCRAPER_API_KEY:
            return jsonify({'status': 'error', 'error': 'Unauthorized'}), 401
        return f(*args, **kwargs)
    return decorated


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok'})


@app.route('/scan', methods=['POST'])
@require_token
def scan():
    body = request.get_json(silent=True) or {}
    url = (body.get('url') or '').strip()
    keywords = body.get('keywords') or []

    if not url:
        return jsonify({'status': 'error', 'error': 'url is required', 'events': []}), 400
    if not url.startswith(('http://', 'https://')):
        return jsonify({'status': 'error', 'error': 'Invalid URL scheme', 'events': []}), 400
    if not isinstance(keywords, list):
        keywords = []

    result = run_scan(url, keywords)
    return jsonify(result)


@app.route('/scan-facebook', methods=['POST'])
@require_token
def scan_facebook():
    body = request.get_json(silent=True) or {}
    url      = (body.get('url') or '').strip()
    venues   = body.get('venues')   or []
    keywords = body.get('keywords') or []

    if not url:
        return jsonify({'status': 'error', 'error': 'url is required', 'posts': []}), 400
    if not url.startswith(('http://', 'https://')):
        return jsonify({'status': 'error', 'error': 'Invalid URL scheme', 'posts': []}), 400
    if not isinstance(venues, list):
        venues = []
    if not isinstance(keywords, list):
        keywords = []

    result = run_facebook_scan(url, venues, keywords)
    return jsonify(result)


@app.route('/scan-facebook-debug', methods=['POST'])
@require_token
def scan_facebook_debug():
    """Returns raw page text — admin debug only."""
    from playwright.sync_api import sync_playwright
    body = request.get_json(silent=True) or {}
    url  = (body.get('url') or 'https://www.facebook.com/groups/bachataisrael/').strip()

    from facebook_scraper import AUTH_FILE
    has_auth = os.path.exists(AUTH_FILE)
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx     = browser.new_context(
            user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            storage_state=AUTH_FILE if has_auth else None,
        )
        page = ctx.new_page()
        try:
            page.goto(url, wait_until='domcontentloaded', timeout=30000)
            page.wait_for_timeout(3000)
            text = page.inner_text('body')
            ctx.close(); browser.close()
            dance_kw = ['סלסה', 'bachata', 'Bachata', 'ריקוד', 'dance', 'party', 'מסיבה', 'zouk', 'kizomba']
            return jsonify({
                'url':        page.url,
                'length':     len(text),
                'preview':    text[:3000],
                'dance_hits': [l for l in text.split('\n') if any(kw.lower() in l.lower() for kw in dance_kw)],
            })
        except Exception as e:
            try: browser.close()
            except: pass
            return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    if not SCRAPER_API_KEY:
        print('WARNING: SCRAPER_API_KEY is not set in scrapers/.env — all protected endpoints will return 500')
    print('DanzWay scraper API running on http://localhost:5001')
    app.run(host='127.0.0.1', port=5001, debug=False)
