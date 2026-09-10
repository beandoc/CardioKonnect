/**
 * migrate_registry_enrollment.ts
 *
 * One-time migration: backfill registryIds[] and registryEnrollments{}
 * for all existing Firestore patients that have a registryId string but
 * lack the new multi-registry enrollment fields.
 *
 * Safe to run multiple times — only writes if fields are missing.
 *
 * Usage:
 *   npx tsx scratch/migrate_registry_enrollment.ts
 */

import * as fs from 'fs'
import * as path from 'path'

// ─── Load .env.local before any Firebase imports ─────────────────────────────
const envPath = path.resolve(process.cwd(), '.env.local')
if (fs.existsSync(envPath)) {
  const envFile = fs.readFileSync(envPath, 'utf8')
  envFile.split('\n').forEach(line => {
    const trimmed = line.trim()
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=')
      if (idx !== -1) {
        process.env[trimmed.substring(0, idx).trim()] = trimmed.substring(idx + 1).trim()
      }
    }
  })
  console.log('✓  .env.local loaded — Project:', process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID)
} else {
  console.error('✗  .env.local not found')
  process.exit(1)
}

async function migrate() {
  const { collection, getDocs, updateDoc, doc, query, orderBy } =
    await import('firebase/firestore')
  const { initializeApp, getApps } = await import('firebase/app')
  const { getFirestore } = await import('firebase/firestore')

  // Initialize Firebase directly using env vars (lib/firebase.ts may have
  // already been initialized with empty config before env was loaded)
  const firebaseConfig = {
    apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  }
  const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig)
  const db = getFirestore(app)

  const snap = await getDocs(
    query(collection(db, 'patients'), orderBy('createdAt', 'desc'))
  )

  let checked = 0, migrated = 0, skipped = 0, noRegistry = 0

  console.log(`\nFound ${snap.docs.length} patients to inspect...\n`)

  for (const d of snap.docs) {
    checked++
    const data = d.data()
    const registryId: string | undefined = data.registryId
    const registryIds: string[] | undefined = data.registryIds

    // Nothing to do if patient has no registry assignment
    if (!registryId) {
      noRegistry++
      continue
    }

    // Already migrated — skip
    if (Array.isArray(registryIds) && registryIds.includes(registryId)) {
      skipped++
      continue
    }

    // Backfill registryIds[] and registryEnrollments{}
    const enrolledAt = data.createdAt
      ? (typeof data.createdAt === 'string'
          ? data.createdAt
          : new Date(data.createdAt.seconds * 1000).toISOString())
      : new Date().toISOString()

    const updatePayload: Record<string, unknown> = {
      registryIds: [registryId],
      [`registryEnrollments.${registryId}`]: {
        enrolledAt,
        enrolledBy: 'migration_script',
        siteId: data.siteId || 'AICTS_PUNE',
        status: 'Active',
      },
    }

    await updateDoc(doc(db, 'patients', d.id), updatePayload)
    migrated++

    const name = `${data.firstName || ''} ${data.lastName || ''}`.trim() || d.id
    console.log(`  ✓  ${name} (${d.id}) → enrolled in [${registryId}]`)
  }

  console.log('\n' + '═'.repeat(56))
  console.log(`  Migration complete`)
  console.log(`  Total patients checked : ${checked}`)
  console.log(`  Migrated (backfilled)  : ${migrated}`)
  console.log(`  Already up-to-date     : ${skipped}`)
  console.log(`  No registry assigned   : ${noRegistry}`)
  console.log('═'.repeat(56))
}

migrate().catch(err => {
  console.error('\n✗  Migration failed:', err)
  process.exit(1)
})
