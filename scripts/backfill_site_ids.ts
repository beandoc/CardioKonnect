/**
 * scripts/backfill_site_ids.ts
 *
 * Ensures every patient has a siteId and every child record (visits,
 * procedures, outcomes, events) carries its parent patient's siteId. The data
 * layer and security rules scope all reads by siteId, so records without one
 * become invisible once the locked-down rules deploy.
 *
 * Patients without a siteId are assigned using the same signals the old
 * client-side tenant filter used (cathlab enrolment, Apex hospital name,
 * 7AFH MRN prefix → KANPUR_APEX; otherwise AICTS_PUNE). Review the dry-run
 * output before applying.
 *
 * Run:
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/sa.json npx tsx scripts/backfill_site_ids.ts          # dry run
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/sa.json npx tsx scripts/backfill_site_ids.ts --apply  # write
 */

import { initializeApp, applicationDefault } from 'firebase-admin/app'
import { getFirestore, type DocumentData } from 'firebase-admin/firestore'

initializeApp({ credential: applicationDefault() })
const db = getFirestore()
const apply = process.argv.includes('--apply')

const SUBCOLLECTIONS = ['visits', 'procedures', 'outcomes', 'events']

function inferSiteId(p: DocumentData): string {
  const isKanpur =
    p.registryId === 'cathlab' ||
    (Array.isArray(p.registryIds) && p.registryIds.includes('cathlab')) ||
    String(p.hospitalName ?? '').toLowerCase().includes('apex') ||
    String(p.mrn ?? '').startsWith('7AFH')
  return isKanpur ? 'KANPUR_APEX' : 'AICTS_PUNE'
}

async function main() {
  const patients = await db.collection('patients').get()
  let patientFixes = 0
  let childFixes = 0
  const writer = db.bulkWriter()

  for (const p of patients.docs) {
    const data = p.data()
    let siteId: string = data.siteId
    if (!siteId) {
      siteId = inferSiteId(data)
      patientFixes++
      console.log(`patient ${p.id} (MRN ${data.mrn ?? '—'}): siteId ← ${siteId}`)
      if (apply) writer.update(p.ref, { siteId })
    }

    for (const sub of SUBCOLLECTIONS) {
      const children = await p.ref.collection(sub).get()
      for (const c of children.docs) {
        if (c.data().siteId !== siteId) {
          childFixes++
          if (apply) writer.update(c.ref, { siteId, patientId: p.id })
        }
      }
    }
  }

  if (apply) await writer.close()
  console.log(`\n${apply ? 'Applied' : 'Dry run'}: ${patientFixes} patient(s), ${childFixes} child record(s) ${apply ? 'updated' : 'need siteId'}.`)
  if (!apply) console.log('Re-run with --apply to write these changes.')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
