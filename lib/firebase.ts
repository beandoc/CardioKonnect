import { initializeApp, getApps } from 'firebase/app'
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, getFirestore, disableNetwork } from 'firebase/firestore'

const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
}

// Prevent re-initialisation on hot reloads
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig)

export const db = typeof window !== 'undefined'
  ? initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    })
  : getFirestore(app)

// Force local offline mode when running with mock or missing credentials so seeding and other writes resolve instantly in IndexedDB
const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY
if (typeof window !== 'undefined' && (!apiKey || apiKey.startsWith('mock') || apiKey === 'undefined')) {
  disableNetwork(db).catch(err => {
    console.warn('Firestore disableNetwork failed:', err)
  })
}

