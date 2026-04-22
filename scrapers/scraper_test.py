from playwright.sync_api import sync_playwright
import re

def run_poc(url):
    with sync_playwright() as p:
        # פתיחת דפדפן במצב נסתר
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        
        print(f"\n--- מתחיל סריקה על: {url} ---")
        
        try:
            # גלישה לאתר עם זמן המתנה לטעינת נתונים
            page.goto(url, wait_until="networkidle", timeout=60000)
            
            # חילוץ כל הטקסט הנראה בדף
            content = page.inner_text("body")
            lines = content.split('\n')
            
            # הגדרת "המסננת" שלנו
            keywords = ["סלסה", "Salsa", "באצ'טה", "Bachata", "זוק", "Zouk", "קיזומבה", "Kizomba", "מסיבה", "מסיבות", "ערב ריקוד", "נרקוד"]            
            days = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"]
            matches = []
            
            for i, line in enumerate(lines):
                # בדיקה אם השורה מכילה את אחד מסגנונות הריקוד
                if any(key.lower() in line.lower() for key in keywords):
                    # לוקחים 2 שורות לפני ו-2 שורות אחרי בשביל ההקשר
                    start = max(0, i - 2)
                    end = min(len(lines), i + 3)
                    event_chunk = lines[start:end]
                    matches.append(event_chunk)
            
            if not matches:
                print("No events found.")
            else:
                print(f"Found {len(matches)} potential events:\n")
                for idx, chunk in enumerate(matches):
                    print(f"Match #{idx + 1}:")
                    # הפיכת הטקסט להצגה נכונה בטרמינל (רק להדפסה!)
                    full_text = " | ".join([line.strip() for line in chunk if line.strip()])
                    print(full_text[::-1]) # זה הופך את סדר האותיות להצגה
                    print("-" * 30)

        except Exception as e:
            print(f"שגיאה בסריקה: {e}")
        
        browser.close()

# כאן תדביק את ה-URL שאתה רוצה לבדוק (למשל הלינק המפולטר מ-DanceFinder)
test_url = "https://www.bebachata.co.il//קורסים/המסיבות-שלנו/"
run_poc(test_url)