/**
 * scripts/fix_air_kerma_units.ts
 *
 * Until 2026-10-28 the procedure CRF saved the air kerma entered in mGy into
 * radiationAirKermaGy unchanged, so a 1200 mGy dose was stored as 1200 Gy. The
 * data layer prefers radiationAirKermaGy, so every dashboard read the 1000×
 * value.
 *
 * Bug signature: radiationAirKermaGy === airKermaMGy (> 0). Those records get
 * radiationAirKermaGy = airKermaMGy / 1000. Other implausible records are
 * listed for manual review and never changed:
 *   - radiationAirKermaGy > 20 Gy with no airKermaMGy to cross-check
 *   - both fields present but disagreeing by more than rounding
 *
 * Before writing, --apply saves every original value to .cleanup-backups/.
 *
 * Uses the app's own Firebase client config from .env.local (no service-account
 * key), which works while the live database still has the open rules that the
 * hardcoded-login setup depends on. Once the locked-down rules are deployed this
 * needs a firebase-admin service account instead.
 *
 * Run:
 *   npx tsx scripts/fix_air_kerma_units.ts          # dry run
 *   npx tsx scripts/fix_air_kerma_units.ts --apply  # write
 */

import { mkdirSync, writeFileSync } from 'fs'
import { initializeApp } from 'firebase/app'
import { getFirestore, collectionGroup, getDocs, doc, writeBatch, serverTimestamp, type DocumentData } from 'firebase/firestore'

process.loadEnvFile('.env.local')
const db = getFirestore(initializeApp({
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}))
const apply = process.argv.includes('--apply')

/** Writes updates in batches of 400 (Firestore caps a batch at 500 operations). */
async function commitUpdates(updates: Array<{ path: string; data: DocumentData }>): Promise<void> {
  for (let i = 0; i < updates.length; i += 400) {
    const batch = writeBatch(db)
    for (const u of updates.slice(i, i + 400)) batch.update(doc(db, u.path), u.data)
    await batch.commit()
  }
}

/** Above this an air kerma in Gy is not physically plausible for a cath procedure. */
const IMPLAUSIBLE_GY = 20

function num(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = typeof v === 'number' ? v : parseFloat(String(v))
  return Number.isFinite(n) ? n : null
}

async function main() {
  const snap = await getDocs(collectionGroup(db, 'procedures'))
  const fixes: Array<{ path: string; before: number; after: number; airKermaMGy: number }> = []
  const review: Array<{ path: string; radiationAirKermaGy: number | null; airKermaMGy: number | null; reason: string }> = []

  for (const d of snap.docs) {
    const data = d.data()
    const gy = num(data.radiationAirKermaGy)
    const mgy = num(data.airKermaMGy)
    if (gy == null) continue

    if (mgy != null && gy === mgy && gy > 0) {
      fixes.push({ path: d.ref.path, before: gy, after: mgy / 1000, airKermaMGy: mgy })
    } else if (mgy == null && gy > IMPLAUSIBLE_GY) {
      review.push({ path: d.ref.path, radiationAirKermaGy: gy, airKermaMGy: null, reason: `> ${IMPLAUSIBLE_GY} Gy with no mGy value to cross-check` })
    } else if (mgy != null && Math.abs(gy * 1000 - mgy) > 1) {
      review.push({ path: d.ref.path, radiationAirKermaGy: gy, airKermaMGy: mgy, reason: 'Gy and mGy fields disagree' })
    }
  }

  console.log(`Scanned ${snap.size} procedure(s).\n`)
  for (const f of fixes) console.log(`FIX    ${f.path}: radiationAirKermaGy ${f.before} → ${f.after} (airKermaMGy ${f.airKermaMGy})`)
  for (const r of review) console.log(`REVIEW ${r.path}: Gy=${r.radiationAirKermaGy ?? '—'} mGy=${r.airKermaMGy ?? '—'} — ${r.reason}`)

  if (apply && fixes.length > 0) {
    mkdirSync('.cleanup-backups', { recursive: true })
    const backup = `.cleanup-backups/air_kerma_${new Date().toISOString().replace(/[:.]/g, '-')}.json`
    writeFileSync(backup, JSON.stringify(fixes, null, 2))
    console.log(`\nBackup of original values: ${backup}`)

    await commitUpdates(fixes.map(f => ({ path: f.path, data: { radiationAirKermaGy: f.after, updatedAt: serverTimestamp() } })))
  }

  console.log(`\n${apply ? 'Applied' : 'Dry run'}: ${fixes.length} procedure(s) ${apply ? 'corrected' : 'to correct'}, ${review.length} for manual review.`)
  if (!apply && fixes.length > 0) console.log('Re-run with --apply to write these changes.')
}

// The client SDK keeps its connection open, so exit explicitly when done.
main().then(() => process.exit(0), err => {
  console.error(err)
  process.exit(1)
})
