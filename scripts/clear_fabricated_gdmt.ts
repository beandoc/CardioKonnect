/**
 * scripts/clear_fabricated_gdmt.ts
 *
 * Until 2026-10-28 two entry paths saved GDMT medications nobody entered:
 *
 *   1. Quick Data Entry modal (new baseline visit, no medication fields on the
 *      form) always wrote raasi/betaBlocker/sglt2i = { prescribed: 'Yes' } and
 *      mra = { prescribed: 'No' }.
 *   2. DEO portal: patient registration, quick edit and the encounter form
 *      pre-filled every pillar as 'Yes' with a default drug (and, in the
 *      encounter form, a default dose). The encounter form had no dose input
 *      and no diuretic input, and its selector had no "not recorded" option, so
 *      a 'Yes' there cannot be told apart from a value nobody touched.
 *
 * Only visits written by those paths are touched. The full visit form and the
 * Excel importer always write aspirin and statin, so any visit with either key
 * is left alone. In an eligible visit, a pillar is reset to { prescribed: '' }
 * (not recorded) when it matches one of the fabricated shapes exactly.
 *
 * Before writing, --apply saves every original entry to .cleanup-backups/.
 *
 * Uses the app's own Firebase client config from .env.local (no service-account
 * key), which works while the live database still has the open rules that the
 * hardcoded-login setup depends on. Once the locked-down rules are deployed this
 * needs a firebase-admin service account instead.
 *
 * Run:
 *   npx tsx scripts/clear_fabricated_gdmt.ts          # dry run
 *   npx tsx scripts/clear_fabricated_gdmt.ts --apply  # write
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

type Pillar = 'raasi' | 'betaBlocker' | 'mra' | 'sglt2i' | 'diuretic'

/** Defaults the DEO portal pre-filled. */
const DEO_DEFAULTS: Record<Pillar, { type: string; dose: string }> = {
  raasi:       { type: 'Sacubitril/Valsartan', dose: '100mg' },
  betaBlocker: { type: 'Bisoprolol',           dose: '5mg' },
  mra:         { type: 'Spironolactone',       dose: '25mg' },
  sglt2i:      { type: 'Dapagliflozin',        dose: '10mg' },
  diuretic:    { type: 'Torsemide',            dose: '10mg' },
}
const PILLARS = Object.keys(DEO_DEFAULTS) as Pillar[]

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

function onlyKeys(entry: Record<string, unknown>, allowed: string[]): boolean {
  return Object.keys(entry).every(k => allowed.includes(k))
}

function isExactly(entry: unknown, prescribed: string): boolean {
  return isObj(entry) && entry.prescribed === prescribed && onlyKeys(entry, ['prescribed'])
}

function isDeoDefault(pillar: Pillar, entry: unknown): boolean {
  if (!isObj(entry) || entry.prescribed !== 'Yes') return false
  const def = DEO_DEFAULTS[pillar]
  return entry.type === def.type
    && (entry.dose === undefined || entry.dose === def.dose)
    && onlyKeys(entry, ['prescribed', 'type', 'dose'])
}

/** Pillars in this visit that hold fabricated values, with the reason. */
function fabricatedPillars(v: DocumentData): Array<{ pillar: Pillar; source: string }> {
  if ('aspirin' in v || 'statin' in v) return []

  const quickEntry =
    isExactly(v.raasi, 'Yes') && isExactly(v.betaBlocker, 'Yes') &&
    isExactly(v.sglt2i, 'Yes') && isExactly(v.mra, 'No')
  if (quickEntry) {
    return (['raasi', 'betaBlocker', 'mra', 'sglt2i'] as Pillar[]).map(pillar => ({ pillar, source: 'Quick Entry default' }))
  }

  return PILLARS.filter(p => isDeoDefault(p, v[p])).map(pillar => ({ pillar, source: 'DEO default' }))
}

async function main() {
  const snap = await getDocs(collectionGroup(db, 'visits'))
  const changes: Array<{ path: string; visitDate: unknown; pillars: Array<{ pillar: Pillar; source: string; before: unknown }> }> = []

  for (const d of snap.docs) {
    const data = d.data()
    const found = fabricatedPillars(data)
    if (found.length === 0) continue
    changes.push({
      path: d.ref.path,
      visitDate: data.visitDate,
      pillars: found.map(f => ({ ...f, before: data[f.pillar] })),
    })
  }

  console.log(`Scanned ${snap.size} visit(s).\n`)
  for (const c of changes) {
    const detail = c.pillars.map(p => `${p.pillar}=${JSON.stringify(p.before)}`).join(', ')
    console.log(`CLEAR  ${c.path} (${c.visitDate ?? 'no date'}) [${c.pillars[0].source}]: ${detail}`)
  }

  const pillarCount = changes.reduce((n, c) => n + c.pillars.length, 0)
  if (apply && changes.length > 0) {
    mkdirSync('.cleanup-backups', { recursive: true })
    const backup = `.cleanup-backups/fabricated_gdmt_${new Date().toISOString().replace(/[:.]/g, '-')}.json`
    writeFileSync(backup, JSON.stringify(changes, null, 2))
    console.log(`\nBackup of original values: ${backup}`)

    await commitUpdates(changes.map(c => {
      const data: DocumentData = { updatedAt: serverTimestamp() }
      for (const p of c.pillars) data[p.pillar] = { prescribed: '' }
      return { path: c.path, data }
    }))
  }

  console.log(`\n${apply ? 'Applied' : 'Dry run'}: ${pillarCount} medication entr${pillarCount === 1 ? 'y' : 'ies'} in ${changes.length} visit(s) ${apply ? 'reset to "not recorded"' : 'to reset'}.`)
  if (!apply && changes.length > 0) console.log('Review the list, then re-run with --apply to write these changes.')
}

// The client SDK keeps its connection open, so exit explicitly when done.
main().then(() => process.exit(0), err => {
  console.error(err)
  process.exit(1)
})
