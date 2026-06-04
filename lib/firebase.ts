import { initializeApp, getApps } from 'firebase/app'
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, getFirestore, disableNetwork } from 'firebase/firestore'

const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'mock-api-key-for-cardiokonnect-demo',
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'cardio-konnect-demo.firebaseapp.com',
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'cardio-konnect-demo',
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'cardio-konnect-demo.appspot.com',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '1234567890',
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '1:1234567890:web:abcdef123456',
}

// Prevent re-initialisation on hot reloads
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig)

export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
  experimentalAutoDetectLongPolling: false,
  localCache: typeof window !== 'undefined'
    ? persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      })
    : undefined
})

// Force local offline mode when running with mock or missing credentials so seeding and other writes resolve instantly in IndexedDB
const apiKey = firebaseConfig.apiKey
if (typeof window !== 'undefined' && (!apiKey || apiKey.startsWith('mock') || apiKey === 'undefined')) {
  disableNetwork(db).catch(err => {
    console.warn('Firestore disableNetwork failed:', err)
  })
}

