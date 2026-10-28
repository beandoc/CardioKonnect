/**
 * Append-only bulk import of parsed Excel data into Firestore.
 *
 * Never deletes or overwrites existing records. Each patient is written in the
 * same batch as its visits, so a failure part-way through leaves only whole
 * patients behind and a re-run skips them via duplicate detection.
 */
import { collection, doc, writeBatch, serverTimestamp } from 'firebase/firestore'
import { db } from './firebase'
import { SITES } from './appConfig'
import { getPatients, writeAudit } from './firestore'
import type { Patient, Visit } from './types'

// Firestore caps a batch at 500 writes.
const MAX_BATCH_OPS = 450

export interface ImportValidation {
  errors: string[]
  duplicates: Patient[]
  toImport: Patient[]
}

function dedupKey(p: Pick<Patient, 'mrn' | 'firstName' | 'lastName' | 'dob'>): string {
  const mrn = (p.mrn || '').trim()
  if (mrn && mrn !== '—') return `mrn:${mrn.toLowerCase()}`
  return `name:${`${p.firstName} ${p.lastName}`.trim().toLowerCase()}|${p.dob || ''}`
}

/**
 * Checks every parsed row before anything is written: required fields,
 * visits that reference unknown patients, and patients already in the registry.
 */
export async function validateImport(patients: Patient[], visits: Visit[]): Promise<ImportValidation> {
  const errors: string[] = []
  const ids = new Set(patients.map(p => p.id))

  patients.forEach((p, i) => {
    if (!p.firstName && !p.lastName) errors.push(`Patient row ${i + 1}: missing name`)
    if (!p.sex) errors.push(`Patient row ${i + 1} (${p.firstName} ${p.lastName}): missing sex`)
  })
  const orphanVisits = visits.filter(v => !ids.has(v.patientId)).length
  if (orphanVisits > 0) errors.push(`${orphanVisits} visit(s) reference a patient not present in the file`)

  const existingKeys = new Set((await getPatients()).map(dedupKey))
  const duplicates = patients.filter(p => existingKeys.has(dedupKey(p)))
  const toImport = patients.filter(p => !existingKeys.has(dedupKey(p)))

  return { errors, duplicates, toImport }
}

/**
 * Writes new patients (with their visits) for the given site and registry.
 * The Excel parser assigns temporary IDs; they are replaced with Firestore IDs.
 */
export async function importPatients(
  patients: Patient[],
  visits: Visit[],
  target: { siteId: string; registryId: string },
  onProgress?: (msg: string) => void
): Promise<{ patientsWritten: number; visitsWritten: number }> {
  const visitsByPatient = new Map<string, Visit[]>()
  for (const v of visits) {
    const list = visitsByPatient.get(v.patientId) || []
    list.push(v)
    visitsByPatient.set(v.patientId, list)
  }

  let batch = writeBatch(db)
  let ops = 0
  let patientsWritten = 0
  let visitsWritten = 0

  for (const patient of patients) {
    const patientVisits = visitsByPatient.get(patient.id) || []
    const groupSize = 1 + patientVisits.length
    if (ops > 0 && ops + groupSize > MAX_BATCH_OPS) {
      await batch.commit()
      onProgress?.(`Committed ${patientsWritten} patients so far…`)
      batch = writeBatch(db)
      ops = 0
    }

    const ref = doc(collection(db, 'patients'))
    const { id: _id, ...fields } = patient
    const registryIds = Array.from(new Set([...(patient.registryIds || []), target.registryId]))
    batch.set(ref, {
      ...stripUndefined(fields),
      siteId: target.siteId,
      hospitalName: SITES[target.siteId]?.name ?? fields.hospitalName,
      registryId: target.registryId,
      registryIds,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    ops++

    for (const visit of patientVisits) {
      const { id: _vid, patientId: _pid, ...visitFields } = visit
      batch.set(doc(collection(db, 'patients', ref.id, 'visits')), {
        ...stripUndefined(visitFields),
        patientId: ref.id,
        siteId: target.siteId,
        createdAt: serverTimestamp(),
      })
      ops++
    }

    patientsWritten++
    visitsWritten += patientVisits.length
  }

  if (ops > 0) await batch.commit()

  await writeAudit('IMPORT', 'registry', target.registryId, '', { patientsWritten, visitsWritten })
  onProgress?.(`Done — ${patientsWritten} patients and ${visitsWritten} visits added.`)
  return { patientsWritten, visitsWritten }
}

/** Firestore rejects undefined at any depth; a JSON round-trip drops them. */
function stripUndefined<T extends object>(obj: T): Partial<T> {
  return JSON.parse(JSON.stringify(obj))
}
