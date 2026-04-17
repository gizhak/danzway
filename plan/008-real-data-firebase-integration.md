# Plan 008: Real Data & Firebase Integration

**Branch:** `f-108-real-data`  
**Status:** Awaiting Approval

---

## Overview

Migrate DanzWay from static mock data to a live Firebase/Firestore backend. Includes fixing event images, seeding Firestore with the existing mock data, fetching events via a Redux async thunk, and adding a native Share button on the event detail page.

---

## Task 1 — Visual Fix: Update mockEvents.js with working Unsplash URLs

**File:** `src/data/mockEvents.js`

Replace all current image URLs and style-bubble placeholder images with stable, high-quality Unsplash URLs using dance-specific search terms.

**Image search terms to use per event:**
| Event Style | Unsplash Term |
|---|---|
| Salsa | `salsa-dance` |
| Bachata | `bachata-dance` |
| Kizomba | `kizomba-dance` |
| West Coast Swing | `swing-dance` |
| Tango | `tango-dance` |
| Zouk | `zouk-dance` |
| Mixed/Social | `latin-dance` |

**Style bubble images** (used in `StyleFilterRow`): Add a representative image URL to each style filter object for visual richness if needed.

**Acceptance criteria:**
- All 7 events render with a visible, high-quality hero image
- No broken image icons anywhere in the app
- URLs use the format: `https://images.unsplash.com/photo-{id}?w=800&q=80`

---

## Task 2 — Firebase Setup

### 2a. Install Firebase SDK

```bash
npm install firebase
```

### 2b. Create Firebase Project (manual step — done once in Firebase Console)

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Create project: `danzway-app`
3. Enable **Firestore Database** (production mode, region: `europe-west1`)
4. Register a Web App and copy the config object

### 2c. Create environment file

**New file:** `.env.local` (gitignored)

```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

Also create `.env.example` (committed) with placeholder values so teammates know what's needed.

### 2d. Initialize Firebase app

**New file:** `src/services/firebase.js`

```js
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
```

---

## Task 3 — Seed Firestore with Mock Data

**New file:** `src/scripts/seedFirestore.js`  
(Node/Vite script — run once manually, not part of the app bundle)

### Plan:
- Import `mockEvents` array from `src/data/mockEvents.js`
- For each event, call `setDoc(doc(db, 'events', event.id), event)`
- The Firestore collection will be named **`events`**
- Each document ID = `event.id` (e.g., `evt-001`)

**Run command:**
```bash
node src/scripts/seedFirestore.js
```

**Firestore document shape** (mirrors existing mock structure):
```
events/{id}
  ├── id: string
  ├── title: string
  ├── date: string (ISO)
  ├── time: string
  ├── location: string
  ├── venue: string
  ├── styles: string[]
  ├── image: string (URL)
  ├── price: number
  ├── currency: string
  ├── description: string
  └── whatsapp: string
```

---

## Task 4 — Redux Integration: Fetch Events from Firestore

**File:** `src/store/appSlice.js`

### 4a. Add `events` state + loading/error states

Extend the current slice state:

```js
// Before (current)
{
  savedIds: {},
  styleFilter: 'all'
}

// After
{
  savedIds: {},
  styleFilter: 'all',
  events: [],          // replaces static mockEvents import
  status: 'idle',      // 'idle' | 'loading' | 'succeeded' | 'failed'
  error: null
}
```

### 4b. Create `fetchEvents` async thunk

**New file:** `src/store/eventsThunks.js` (or inline in appSlice.js)

```js
import { createAsyncThunk } from '@reduxjs/toolkit';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';

export const fetchEvents = createAsyncThunk('app/fetchEvents', async () => {
  const snapshot = await getDocs(collection(db, 'events'));
  return snapshot.docs.map(doc => doc.data());
});
```

### 4c. Add `extraReducers` to appSlice.js

Handle the three thunk lifecycle actions:

```js
.addCase(fetchEvents.pending,   (state) => { state.status = 'loading'; state.error = null; })
.addCase(fetchEvents.fulfilled, (state, action) => { state.status = 'succeeded'; state.events = action.payload; })
.addCase(fetchEvents.rejected,  (state, action) => { state.status = 'failed'; state.error = action.error.message; })
```

### 4d. Add selectors

```js
export const selectAllEvents  = (state) => state.app.events;
export const selectEventsStatus = (state) => state.app.status;
export const selectEventsError  = (state) => state.app.error;
```

### 4e. Update consumers

- **`HomePage.jsx`** — dispatch `fetchEvents` on mount (if status is `idle`), replace `mockEvents` import with `selectAllEvents`, show loading skeleton and error message.
- **`EventDetailPage.jsx`** — read event from `selectAllEvents` by id param instead of from the static array.
- Remove `mockEvents` import from both pages (the mock file stays as a seed source only).

---

## Task 5 — Social Sharing: Real Share Button on EventDetailPage

**File:** `src/pages/EventDetailPage.jsx`

### Plan:
- Replace (or augment) the existing share icon / placeholder with a real `handleShare` function
- Use the **Web Share API** (`navigator.share`) with a graceful fallback

```js
const handleShare = async () => {
  const shareData = {
    title: event.title,
    text: `${event.title} — ${event.date} at ${event.venue}`,
    url: window.location.href,
  };

  if (navigator.share) {
    try {
      await navigator.share(shareData);
    } catch (err) {
      // User cancelled — do nothing
    }
  } else {
    // Fallback: copy URL to clipboard
    await navigator.clipboard.writeText(window.location.href);
    // Show a brief "Link copied!" toast
  }
};
```

**UI:**
- Wire the existing share icon button (if present) to `handleShare`
- Add a small "Link copied!" toast notification for the clipboard fallback (can reuse Badge/Button components or a simple state-driven div)

---

## Task Order & Dependencies

```
Task 1 (images)       — independent, do first for visual wins
Task 2 (firebase)     — independent setup, no code deps
Task 3 (seed)         — depends on Task 2
Task 4 (redux thunk)  — depends on Task 2 + Task 3 (data must exist in Firestore)
Task 5 (share button) — independent, can be done anytime
```

---

## Files Changed Summary

| File | Action |
|---|---|
| `src/data/mockEvents.js` | Update image URLs |
| `.env.local` | New — Firebase credentials (gitignored) |
| `.env.example` | New — placeholder template |
| `src/services/firebase.js` | New — Firebase init + Firestore export |
| `src/scripts/seedFirestore.js` | New — one-time seed script |
| `src/store/appSlice.js` | Add events state, loading/error, extraReducers, new selectors |
| `src/pages/HomePage.jsx` | Dispatch fetchEvents, use Redux events, add loading/error UI |
| `src/pages/EventDetailPage.jsx` | Read event from Redux store, add Share button |
| `package.json` | Add `firebase` dependency |

---

## Out of Scope (for this plan)

- Firebase Authentication
- User-generated event posting
- Firestore security rules (will use open rules during development)
- Realtime listeners (`onSnapshot`) — will use one-time `getDocs` for now
