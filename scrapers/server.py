"""
DanzWay Python Scraper API — Local Flask bridge for the React dashboard.
Run: python scrapers/server.py
POST http://localhost:5001/scan  { "url": "...", "keywords": [...] }
"""
from flask import Flask, request, jsonify
from flask_cors import CORS
from scraper import run_scan

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


if __name__ == '__main__':
    print('DanzWay scraper API running on http://localhost:5001')
    app.run(host='0.0.0.0', port=5001, debug=False)
