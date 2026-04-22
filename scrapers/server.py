"""
DanzWay Python Scraper API — Local Flask bridge for the React dashboard.
Run: python scrapers/server.py
POST http://localhost:5001/scan          { "url": "...", "keywords": [...] }
POST http://localhost:5001/scan-facebook { "url": "...", "venues": [...], "keywords": [...] }
"""
from flask import Flask, request, jsonify
from flask_cors import CORS
from scraper import run_scan
from facebook_scraper import run_facebook_scan

app = Flask(__name__)
CORS(app)  # Allow React dev server (localhost:5173) to call us


@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok'})


@app.route('/scan', methods=['POST'])
def scan():
    body = request.get_json(silent=True) or {}
    url = (body.get('url') or '').strip()
    keywords = body.get('keywords') or []

    if not url:
        return jsonify({'status': 'error', 'error': 'url is required', 'events': []}), 400

    if not isinstance(keywords, list):
        keywords = []

    result = run_scan(url, keywords)
    return jsonify(result)


@app.route('/scan-facebook-debug', methods=['POST'])
def scan_facebook_debug():
    """Returns the raw page text scraped from the URL — use to diagnose what Facebook shows."""
    from playwright.sync_api import sync_playwright
    body = request.get_json(silent=True) or {}
    url  = (body.get('url') or 'https://www.facebook.com/groups/bachataisrael/').strip()

    from facebook_scraper import AUTH_FILE
    import os as _os
    has_auth = _os.path.exists(AUTH_FILE)
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx     = browser.new_context(
            user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            storage_state=AUTH_FILE if has_auth else None,
        )
        page    = ctx.new_page()
        try:
            page.goto(url, wait_until='domcontentloaded', timeout=30000)
            page.wait_for_timeout(3000)
            text = page.inner_text('body')
            ctx.close(); browser.close()
            return jsonify({
                'url':          page.url,
                'length':       len(text),
                'preview':      text[:3000],
                'dance_hits':   [l for l in text.split('\n') if any(kw.lower() in l.lower() for kw in ['סלסה','bachata','Bachata','ריקוד','dance','party','מסיבה','zouk','kizomba'])],
            })
        except Exception as e:
            try: browser.close()
            except: pass
            return jsonify({'error': str(e)}), 500


@app.route('/scan-facebook', methods=['POST'])
def scan_facebook():
    body = request.get_json(silent=True) or {}
    url      = (body.get('url') or '').strip()
    venues   = body.get('venues')   or []
    keywords = body.get('keywords') or []

    if not url:
        return jsonify({'status': 'error', 'error': 'url is required', 'posts': []}), 400

    if not isinstance(venues, list):
        venues = []
    if not isinstance(keywords, list):
        keywords = []

    result = run_facebook_scan(url, venues, keywords)
    return jsonify(result)


if __name__ == '__main__':
    print('DanzWay scraper API running on http://localhost:5001')
    app.run(host='0.0.0.0', port=5001, debug=False)
