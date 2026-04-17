/**
 * One-time seed script — pushes mockEvents into the Firestore 'events' collection.
 *
 * Prerequisites:
 *   1. Create a .env.local file with your VITE_FIREBASE_* variables (already done).
 *   2. In Firebase Console → Firestore → Rules, temporarily allow writes:
 *        rules_version = '2';
 *        service cloud.firestore {
 *          match /databases/{database}/documents {
 *            match /{document=**} { allow read, write: if true; }
 *          }
 *        }
 *      Remember to tighten rules after seeding!
 *
 * Run:
 *   node --env-file=.env.local src/scripts/seedFirestore.js
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import { mockEvents } from '../data/mockEvents.js';

const firebaseConfig = {
  apiKey:            process.env.VITE_FIREBASE_API_KEY,
  authDomain:        process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function seed() {
  console.log(`Seeding ${mockEvents.length} events to Firestore collection 'events'...`);

  for (const event of mockEvents) {
    await setDoc(doc(db, 'events', event.id), event);
    console.log(`  ✓ ${event.id} — ${event.title}`);
  }

  console.log('\nSeeding complete!');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
