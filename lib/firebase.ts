import { initializeApp, getApps } from 'firebase/app'
import { initializeFirestore, memoryLocalCache, getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig)

// memoryLocalCache: no IndexedDB persistence — every session reads fresh from
// Firestore. Eliminates stale-cache issues where the browser serves old patient
// data after a clear+reseed operation.
// initializeFirestore throws on hot reloads (already initialised); fall back to getFirestore.
function getOrInitDb() {
  try {
    return initializeFirestore(app, {
      experimentalForceLongPolling: true,
      localCache: memoryLocalCache(),
    })
  } catch {
    return getFirestore(app)
  }
}

export const db = getOrInitDb()
