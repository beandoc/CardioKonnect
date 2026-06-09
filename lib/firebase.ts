import { initializeApp, getApps } from 'firebase/app'
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  getFirestore,
} from 'firebase/firestore'

const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'mock-api-key-for-cardiokonnect-demo',
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'cardio-konnect-demo.firebaseapp.com',
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'cardio-konnect-demo',
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'cardio-konnect-demo.appspot.com',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '1234567890',
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '1:1234567890:web:abcdef123456',
}

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig)

// initializeFirestore throws if called again on an already-initialised app (hot reloads).
// Fall back to getFirestore in that case.
function getOrInitDb() {
  try {
    return initializeFirestore(app, {
      experimentalForceLongPolling: true,
      experimentalAutoDetectLongPolling: false,
      localCache: typeof window !== 'undefined'
        ? persistentLocalCache({ tabManager: persistentMultipleTabManager() })
        : undefined,
    })
  } catch {
    return getFirestore(app)
  }
}

export const db = getOrInitDb()
