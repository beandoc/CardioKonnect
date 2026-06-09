/**
 * Bulk-seed parsed Excel data into Firestore using batched writes.
 * Firestore batches are capped at 500 ops; this function chunks automatically.
 *
 * Flow:
 *  1. Delete every existing patient doc (+ visits subcollection) in batches.
 *  2. Pre-allocate Firestore doc refs for all new patients (no round-trip).
 *  3. Write patients + visits together in 400-op chunks.
 */
import {
  collection, doc, writeBatch, getDocs, serverTimestamp,
} from 'firebase/firestore'
import { db } from './firebase'
import type { Patient, Visit } from './types'

const BATCH_SIZE = 400

async function commitInChunks(ops: Array<(batch: ReturnType<typeof writeBatch>) => void>) {
  for (let i = 0; i < ops.length; i += BATCH_SIZE) {
    const batch = writeBatch(db)
    ops.slice(i, i + BATCH_SIZE).forEach(op => op(batch))
    await batch.commit()
  }
}

/** Delete all documents in a collection snapshot in batches. */
async function deleteCollection(collectionPath: string) {
  const snap = await getDocs(collection(db, collectionPath))
  if (snap.empty) return
  const ops = snap.docs.map(d => (batch: ReturnType<typeof writeBatch>) => batch.delete(d.ref))
  await commitInChunks(ops)
}

/** Clear all patients and their visits subcollections from Firestore. */
export async function clearFirestorePatients(
  onProgress?: (msg: string) => void
): Promise<void> {
  onProgress?.('Reading existing patients…')
  const patientsSnap = await getDocs(collection(db, 'patients'))

  if (patientsSnap.empty) {
    onProgress?.('Firestore is already empty.')
    return
  }

  onProgress?.(`Deleting ${patientsSnap.size} existing patient(s) and their visits…`)

  // Collect delete ops: visits subcollection first, then the patient doc itself
  const ops: Array<(batch: ReturnType<typeof writeBatch>) => void> = []

  for (const patientDoc of patientsSnap.docs) {
    const visitsSnap = await getDocs(collection(db, 'patients', patientDoc.id, 'visits'))
    visitsSnap.docs.forEach(vd => ops.push(b => b.delete(vd.ref)))
    ops.push(b => b.delete(patientDoc.ref))
  }

  await commitInChunks(ops)
  onProgress?.('Existing data cleared.')
}

/**
 * Seed patients and visits into Firestore.
 * The Excel parser assigns temporary IDs (e.g. "p-abc-1"); we replace them
 * with Firestore auto-generated IDs so the data is fully consistent.
 */
export async function seedFirestore(
  patients: Patient[],
  visits: Visit[],
  onProgress?: (msg: string) => void
): Promise<{ patientsWritten: number; visitsWritten: number }> {
  onProgress?.(`Preparing ${patients.length} patients and ${visits.length} visits…`)

  // Pre-allocate Firestore doc refs — this is synchronous, no network call.
  const idMap = new Map<string, string>() // old Excel ID → new Firestore ID
  const patientRefs = patients.map(p => {
    const ref = doc(collection(db, 'patients'))
    idMap.set(p.id, ref.id)
    return { ref, patient: p }
  })

  const now = new Date().toISOString()

  // Build write ops for patients
  const ops: Array<(batch: ReturnType<typeof writeBatch>) => void> = []

  for (const { ref, patient } of patientRefs) {
    const { id: _id, ...fields } = patient
    ops.push(b => b.set(ref, {
      ...fields,
      createdAt: patient.createdAt || now,
      updatedAt: patient.updatedAt || now,
    }))
  }

  // Build write ops for visits, remapping patientId
  let skipped = 0
  for (const visit of visits) {
    const firestorePatientId = idMap.get(visit.patientId)
    if (!firestorePatientId) { skipped++; continue }

    const visitRef = doc(collection(db, 'patients', firestorePatientId, 'visits'))
    const { id: _id, patientId: _pid, ...visitFields } = visit
    ops.push(b => b.set(visitRef, {
      ...visitFields,
      patientId: firestorePatientId,
      createdAt: visit.createdAt || now,
    }))
  }

  if (skipped > 0) {
    onProgress?.(`Warning: ${skipped} visit(s) skipped — patient ID not found in this seed batch.`)
  }

  onProgress?.(`Writing ${ops.length} documents in chunks of ${BATCH_SIZE}…`)
  await commitInChunks(ops)

  const patientsWritten = patientRefs.length
  const visitsWritten = ops.length - patientsWritten

  onProgress?.(`Done — ${patientsWritten} patients and ${visitsWritten} visits written to Firestore.`)
  return { patientsWritten, visitsWritten }
}
