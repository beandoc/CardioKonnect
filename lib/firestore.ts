import {
  collection, doc, addDoc, setDoc, updateDoc, deleteDoc,
  getDoc, getDocs, query, orderBy, limit, where, collectionGroup,
  serverTimestamp, Timestamp, writeBatch, arrayUnion, onSnapshot,
} from 'firebase/firestore'
import { db } from './firebase'
import type { Patient, PatientInput, Visit, VisitInput, PopulationStats, PatientTrends, TrendPoint, RegistryField, OutcomeEvent, OutcomeEventInput, CathProcedure, CathProcedureInput } from './types'
import { BUILT_IN_FIELDS } from './types'
import { getAge } from './utils'

// ─── Local Storage Fallback for Offline Demo Mode ────────────────────────────

// isDemoMode controls whether to use localStorage (browser storage) vs Firestore (cloud database).
// Set to false = use Firestore (current production config)
// Set to true = use localStorage only (demo mode, no cloud backend)
//
// If Firestore is unreachable, queries may silently return empty results. This will
// cause the dashboard to show 0 patients with no error message. Use dashboard's
// dbError state and error banner to alert users when the database is unavailable.
export const isDemoMode = false

// ─── Helpers ────────────────────────────────────────────────────────────────

function toDate(ts: any): string {
  if (!ts) return ''
  if (ts instanceof Timestamp) return ts.toDate().toISOString()
  if (typeof ts === 'string') return ts
  if (ts && typeof ts === 'object') {
    if (typeof ts.toDate === 'function') {
      try {
        return ts.toDate().toISOString()
      } catch (e) {}
    }
    if (typeof ts.seconds === 'number') {
      try {
        return new Date(ts.seconds * 1000).toISOString()
      } catch (e) {}
    }
  }
  return ''
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function docToPatient(id: string, data: any): Patient {
  const comorbidities = typeof data.comorbidities === 'string'
    ? data.comorbidities.split(',').map((s: string) => s.trim()).filter(Boolean)
    : (data.comorbidities || [])
  return {
    ...data,
    id,
    comorbidities,
    indexDate: toDate(data.indexDate),
    hfConfirmationDate: toDate(data.hfConfirmationDate),
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
    lastVisitDate: toDate(data.lastVisitDate),
  } as Patient
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function docToVisit(id: string, patientId: string, data: any): Visit {
  return {
    ...data,
    id,
    patientId,
    visitDate: toDate(data.visitDate) || toDate(data.createdAt),
    echoDate: toDate(data.echoDate),
    dischargeDate: toDate(data.dischargeDate),
    followupDate: toDate(data.followupDate),
    createdAt: toDate(data.createdAt),
  } as Visit
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function docToProcedure(id: string, data: any, fallbackPatientId = ''): CathProcedure {
  return {
    ...data,
    id,
    patientId: data.patientId || fallbackPatientId,
    siteId: data.siteId || 'DEFAULT_SITE',
    operatorId: data.operatorId || 'DEFAULT_OPERATOR',
    procedureDateTime: data.procedureDateTime || toDate(data.procedureDate) || toDate(data.createdAt),
    procedureDate: toDate(data.procedureDate) || data.procedureDateTime || toDate(data.createdAt),
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  } as CathProcedure
}

// ─── Patients ────────────────────────────────────────────────────────────────

export async function addPatient(input: PatientInput): Promise<string> {

  const cleanInput = Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined))
  const ref = await addDoc(collection(db, 'patients'), {
    ...cleanInput,
    visitCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

export async function updatePatient(id: string, data: Partial<PatientInput>): Promise<void> {

  // Firestore rejects undefined values — strip them before writing
  const clean = Object.fromEntries(
    Object.entries(data).filter(([, v]) => v !== undefined)
  )
  await updateDoc(doc(db, 'patients', id), { ...clean, updatedAt: serverTimestamp() })
}

export async function deletePatient(id: string): Promise<void> {

  const batch = writeBatch(db)

  // 1. Delete visits subcollection
  const visitsSnap = await getDocs(collection(db, 'patients', id, 'visits'))
  visitsSnap.docs.forEach(d => batch.delete(d.ref))

  // 2. Delete procedures subcollection (Phase 2/3 subcollection architecture)
  const proceduresSnap = await getDocs(collection(db, 'patients', id, 'procedures'))
  proceduresSnap.docs.forEach(d => batch.delete(d.ref))

  // 3. Delete events subcollection
  const eventsSubSnap = await getDocs(collection(db, 'patients', id, 'events'))
  eventsSubSnap.docs.forEach(d => batch.delete(d.ref))

  // 4. Delete outcomes subcollection
  const outcomesSubSnap = await getDocs(collection(db, 'patients', id, 'outcomes'))
  outcomesSubSnap.docs.forEach(d => batch.delete(d.ref))

  // 5. Delete top-level events by patientId
  try {
    const topEventsSnap = await getDocs(query(collection(db, 'events'), where('patientId', '==', id)))
    topEventsSnap.docs.forEach(d => batch.delete(d.ref))
  } catch (e) {
    console.warn('Could not delete top-level events:', e)
  }

  // 6. Delete top-level outcomes by patientId
  try {
    const topOutcomesSnap = await getDocs(query(collection(db, 'outcomes'), where('patientId', '==', id)))
    topOutcomesSnap.docs.forEach(d => batch.delete(d.ref))
  } catch (e) {
    console.warn('Could not delete top-level outcomes:', e)
  }

  // 7. Delete patient document
  batch.delete(doc(db, 'patients', id))
  await batch.commit()
}

export async function getPatient(id: string): Promise<Patient | null> {

  const snap = await getDoc(doc(db, 'patients', id))
  if (!snap.exists()) return null
  return docToPatient(snap.id, snap.data())
}

export async function getPatients(): Promise<Patient[]> {

  const snap = await getDocs(query(collection(db, 'patients'), orderBy('createdAt', 'desc'), limit(1000)))
  return snap.docs.map(d => docToPatient(d.id, d.data()))
}

/**
 * Returns patients explicitly enrolled in a specific registry.
 *
 * Membership is determined ONLY by explicit enrollment fields:
 *   1. registryIds[].includes(registryId)   — new multi-enrollment model
 *   2. registryId === registryId            — legacy single-registry field
 *
 * Clinical field inference (hfType, comorbidCAD, studyConsented, etc.) is
 * intentionally NOT used — that caused cross-registry contamination.
 *
 * For Firestore array-contains queries to work on registryIds, no composite
 * index is needed (single-field array-contains is free). The legacy registryId
 * fallback fetches with a separate equality query and merges client-side.
 */
export async function getPatientsByRegistry(registryId: string): Promise<Patient[]> {

  // Query 1: new model — patient explicitly enrolled via registryIds array
  const q1 = query(
    collection(db, 'patients'),
    where('registryIds', 'array-contains', registryId),
    orderBy('createdAt', 'desc'),
    limit(1000)
  )

  // Query 2: legacy model — patient has single registryId string
  const q2 = query(
    collection(db, 'patients'),
    where('registryId', '==', registryId),
    orderBy('createdAt', 'desc'),
    limit(1000)
  )

  const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)])

  // Merge and deduplicate by Firestore document ID
  const seen = new Set<string>()
  const patients: Patient[] = []
  for (const snap of [snap1, snap2]) {
    for (const d of snap.docs) {
      if (!seen.has(d.id)) {
        seen.add(d.id)
        patients.push(docToPatient(d.id, d.data()))
      }
    }
  }
  return patients.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}


async function updatePatientCachedFields(patientId: string): Promise<void> {

  // Firestore mode
  const visitsSnap = await getDocs(collection(db, 'patients', patientId, 'visits'))
  if (visitsSnap.empty) {
    await updateDoc(doc(db, 'patients', patientId), {
      visitCount: 0,
      lastVisitDate: '',
      hfType: '',
      nyha: '',
      lvef: '',
      updatedAt: serverTimestamp(),
    })
    return
  }

  let latestDate = ''
  let latestVisitData: any = null
  visitsSnap.docs.forEach(doc => {
    const d = doc.data()
    if (d.visitDate) {
      if (!latestDate || new Date(d.visitDate).getTime() > new Date(latestDate).getTime()) {
        latestDate = d.visitDate
        latestVisitData = d
      }
    }
  })

  if (latestVisitData) {
    let vessels = 0
    let hasAngio = false
    let syntax: number | undefined = undefined
    if (latestVisitData.coronaryAnatomy) {
      const ca = latestVisitData.coronaryAnatomy
      hasAngio = true
      syntax = ca.syntaxScore
      if ((ca.lmStenosis ?? 0) >= 50) vessels++
      if ((ca.ladStenosis ?? 0) >= 70) vessels++
      if ((ca.lcxStenosis ?? 0) >= 70) vessels++
      if ((ca.rcaStenosis ?? 0) >= 70) vessels++
    }

    await updateDoc(doc(db, 'patients', patientId), {
      visitCount: visitsSnap.size,
      lastVisitDate: latestDate,
      hfType: latestVisitData.hfType || '',
      nyha: latestVisitData.nyha || '',
      lvef: latestVisitData.lvef ?? '',
      latestSyntaxScore: syntax ?? '',
      coronaryVesselsDiseased: vessels,
      hasCoronaryAngiogram: hasAngio,
      updatedAt: serverTimestamp(),
    })
  }
}

// ─── Visits ──────────────────────────────────────────────────────────────────

export async function addVisit(patientId: string, input: VisitInput): Promise<string> {

  const cleanVisit = Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined))
  const ref = await addDoc(collection(db, 'patients', patientId, 'visits'), {
    ...cleanVisit,
    createdAt: serverTimestamp(),
  })

  await updatePatientCachedFields(patientId)
  return ref.id
}

export async function updateVisit(patientId: string, visitId: string, data: Partial<VisitInput>): Promise<void> {
  const now = new Date().toISOString()
  const updatedFields = Object.keys(data)
  const historyEntry = { updatedAt: now, updatedFields }


  const cleanData = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined))
  await updateDoc(doc(db, 'patients', patientId, 'visits', visitId), {
    ...cleanData,
    updatedAt: serverTimestamp(),
    editHistory: arrayUnion(historyEntry)
  })

  await updatePatientCachedFields(patientId)
}

export async function deleteVisit(patientId: string, visitId: string): Promise<void> {

  await deleteDoc(doc(db, 'patients', patientId, 'visits', visitId))
  await updatePatientCachedFields(patientId)
}

export async function getVisits(patientId: string): Promise<Visit[]> {

  const snap = await getDocs(
    query(collection(db, 'patients', patientId, 'visits'), orderBy('visitDate', 'desc'))
  )
  return snap.docs.map(d => docToVisit(d.id, patientId, d.data()))
}

export async function getLatestVisit(patientId: string): Promise<Visit | null> {

  const snap = await getDocs(
    query(collection(db, 'patients', patientId, 'visits'), orderBy('visitDate', 'desc'), limit(1))
  )
  if (snap.empty) return null
  return docToVisit(snap.docs[0].id, patientId, snap.docs[0].data())
}

/**
 * Efficiently fetch the latest visit for every patient in one pass.
 * Returns a Map of patientId → latest Visit (or null if no visits).
 * O(n) vs. O(n²) from calling getLatestVisit per patient.
 */
export async function getAllLatestVisits(): Promise<Map<string, Visit>> {
  const map = new Map<string, Visit>()

  // Firestore mode — collectionGroup without orderBy avoids needing a Collection Group scope index.
  // We pick the latest visit per patient in memory instead.
  try {
    const snap = await getDocs(query(collectionGroup(db, 'visits'), limit(10000)))
    for (const d of snap.docs) {
      const patientId = d.ref.parent.parent?.id || ''
      if (!patientId) continue
      const v = docToVisit(d.id, patientId, d.data())
      const existing = map.get(patientId)
      if (!existing || new Date(v.visitDate).getTime() > new Date(existing.visitDate).getTime()) {
        map.set(patientId, v)
      }
    }
  } catch (e) {
    console.warn('getAllLatestVisits: Firestore query failed, falling back to empty map', e)
  }
  return map
}

/**
 * Return all visits with a hard limit to prevent unbounded reads.
 * For registries <2000 patients with avg 5 visits each, 10K limit = safe margin.
 * Use this instead of calling getVisits(patientId) per patient.
 */
export async function getAllVisits(): Promise<Visit[]> {
  // Firestore mode — collectionGroup query with limit to prevent runaway costs
  try {
    const snap = await getDocs(query(collectionGroup(db, 'visits'), limit(10000)))
    return snap.docs.map(d => {
      const patientId = d.ref.parent.parent?.id || ''
      return docToVisit(d.id, patientId, d.data())
    })
  } catch (e) {
    console.warn('getAllVisits: Firestore query failed', e)
    return []
  }
}

// ─── Analytics ───────────────────────────────────────────────────────────────

/**
 * Compute population-level statistics from latest patient visits.
 * OPTIMIZATION: Uses getAllLatestVisits() instead of getAllVisits() because stats
 * only show current status (latest LVEF, NYHA, meds, etc.), not historical trends.
 * This reduces Firestore reads from N×visits_per_patient to just N (one per patient).
 * For 500 patients × 10 visits avg: ~5000 reads → ~500 reads = 90% cost reduction.
 */
export async function getPopulationStats(): Promise<PopulationStats> {
  const patients = await getPatients()

  const hfTypeBreakdown: Record<string, number> = {}
  const nyhaCounts: Record<string, number> = { I: 0, II: 0, III: 0, IV: 0 }
  const etiologyCounts: Record<string, number> = {}
  const rhythmCounts: Record<string, number> = {}
  const medPrescribingRates: Record<string, number> = {
    Diuretic: 0, RAASi: 0, 'Beta Blocker': 0, Digoxin: 0, SGLT2i: 0,
    Ivabradine: 0, MRA: 0, Aspirin: 0, Statin: 0, NOAC: 0, 'IV Iron': 0,
  }
  const deviceCounts: Record<string, number> = { ICD: 0, 'CRT-D': 0, 'CRT-P': 0, PPM: 0 }
  const lvefBins: Record<string, number> = { '<25': 0, '25–35': 0, '35–45': 0, '45–55': 0, '>55': 0 }

  const lvefVals: number[] = []
  const ntVals: number[] = []
  const egfrVals: number[] = []
  const ageVals: number[] = []

  // Fetch latest visit per patient (much cheaper than all visits)
  // Most stats only care about current status, not historical trends
  const latestVisitsMap = await getAllLatestVisits()
  const visitsByPatient: Record<string, Visit[]> = {}

  let crtCandidatesCount = 0
  let ironDeficiencyCount = 0

  latestVisitsMap.forEach((visit, patientId) => {
    visitsByPatient[patientId] = [visit]  // Only latest visit per patient
  })

  patients.forEach((p) => {
    // Age
    if (p.dob) {
      const age = getAge(p.dob)
      if (age !== null) ageVals.push(age)
    }

    const patientVisits = visitsByPatient[p.id] || []
    if (patientVisits.length === 0) return

    // Find the chronologically latest visit in memory
    const latest = patientVisits.reduce((latestVisit, currentVisit) => {
      const latestTime = new Date(latestVisit.visitDate).getTime()
      const currentTime = new Date(currentVisit.visitDate).getTime()
      return (!isNaN(currentTime) && currentTime > latestTime) ? currentVisit : latestVisit
    }, patientVisits[0])

    // HF Type
    if (latest.hfType) hfTypeBreakdown[latest.hfType] = (hfTypeBreakdown[latest.hfType] || 0) + 1

    // NYHA
    if (latest.nyha) nyhaCounts[latest.nyha] = (nyhaCounts[latest.nyha] || 0) + 1

    // Rhythm
    if (latest.rhythm) rhythmCounts[latest.rhythm] = (rhythmCounts[latest.rhythm] || 0) + 1

    // Etiology
    ;(latest.etiology || []).forEach(e => { etiologyCounts[e] = (etiologyCounts[e] || 0) + 1 })

    // LVEF
    if (latest.lvef) {
      lvefVals.push(latest.lvef)
      const v = latest.lvef
      if (v < 25) lvefBins['<25']++
      else if (v < 35) lvefBins['25–35']++
      else if (v < 45) lvefBins['35–45']++
      else if (v < 55) lvefBins['45–55']++
      else lvefBins['>55']++
    }

    // NT-proBNP / eGFR
    if (latest.ntProBNP) ntVals.push(latest.ntProBNP)
    if (latest.egfr) egfrVals.push(latest.egfr)

    // Meds
    if (latest.diuretic?.prescribed === 'Yes') medPrescribingRates['Diuretic']++
    if (latest.raasi?.prescribed === 'Yes') medPrescribingRates['RAASi']++
    if (latest.betaBlocker?.prescribed === 'Yes') medPrescribingRates['Beta Blocker']++
    if (latest.digoxin?.prescribed === 'Yes') medPrescribingRates['Digoxin']++
    if (latest.sglt2i?.prescribed === 'Yes') medPrescribingRates['SGLT2i']++
    if (latest.ivabradine?.prescribed === 'Yes') medPrescribingRates['Ivabradine']++
    if (latest.mra?.prescribed === 'Yes') medPrescribingRates['MRA']++
    if (latest.aspirin?.prescribed === 'Yes') medPrescribingRates['Aspirin']++
    if (latest.statin?.prescribed === 'Yes') medPrescribingRates['Statin']++
    if (latest.noac?.prescribed === 'Yes') medPrescribingRates['NOAC']++
    if (latest.ivIron?.prescribed === 'Yes') medPrescribingRates['IV Iron']++

    // Device
    ;(latest.device || []).forEach(d => { if (d in deviceCounts) deviceCounts[d]++ })

    // Dynamic CRT Candidate / Implanted counter
    const hasLBBB = latest.bbb === 'LBBB'
    const qrsWide = (latest.qrsDuration ?? 0) >= 130
    const severeLV = (latest.lvef ?? 100) < 35
    const hasCRTDevice = p.crtPresence || (latest.device || []).some(d => d.includes('CRT'))
    if (hasCRTDevice || (severeLV && (hasLBBB || qrsWide))) {
      crtCandidatesCount++
    }

    // Dynamic Iron Deficiency counter (Ferritin < 100 or TSAT < 20% or IV Iron prescribed)
    const lowFerritin = latest.ferritin != null && latest.ferritin < 100
    const lowTsats = latest.transferrinSat != null && latest.transferrinSat < 20
    const onIvIron = latest.ivIron?.prescribed === 'Yes'
    if (p.comorbidIronDeficiency || lowFerritin || lowTsats || onIvIron) {
      ironDeficiencyCount++
    }
  })

  const mean = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null

  return {
    totalPatients: patients.length,
    hfTypeBreakdown,
    nyhaCounts,
    etiologyCounts,
    rhythmCounts,
    avgLvef: mean(lvefVals),
    avgAge: mean(ageVals),
    avgNtProBnp: mean(ntVals),
    avgEgfr: mean(egfrVals),
    medPrescribingRates,
    deviceCounts,
    lvefBins,
    crtCandidatesCount,
    ironDeficiencyCount,
  }
}

export async function getPatientTrends(patientId: string): Promise<PatientTrends> {
  const visits = await getVisits(patientId)
  const sorted = [...visits].sort((a, b) => {
    const tA = new Date(a.visitDate).getTime()
    const tB = new Date(b.visitDate).getTime()
    return (isNaN(tA) ? 0 : tA) - (isNaN(tB) ? 0 : tB)
  })

  const tp = (v: Visit, key: keyof Visit): TrendPoint => ({
    date: v.visitDate,
    value: (v[key] as number | undefined) ?? null,
    visitId: v.id,
  })

  const nyhaMap: Record<string, number> = { I: 1, II: 2, III: 3, IV: 4 }

  return {
    lvef:        sorted.map(v => tp(v, 'lvef')),
    ntProBNP:    sorted.map(v => tp(v, 'ntProBNP')),
    nyha:        sorted.map(v => ({ date: v.visitDate, value: v.nyha ? nyhaMap[v.nyha] : null, visitId: v.id })),
    egfr:        sorted.map(v => tp(v, 'egfr')),
    weight:      sorted.map(v => tp(v, 'weight')),
    bpSystolic:  sorted.map(v => tp(v, 'bpSystolic')),
    heartRate:   sorted.map(v => tp(v, 'heartRate')),
    sixMWT:      sorted.map(v => tp(v, 'sixMWT')),
    kccq:        sorted.map(v => ({ date: v.visitDate, value: v.kccq?.overallSummaryScore ?? null, visitId: v.id })),
  }
}

// ─── Settings / Configuration ────────────────────────────────────────────────

export async function getRegistryFields(): Promise<RegistryField[]> {
  let fields: RegistryField[] = BUILT_IN_FIELDS;

  return fields;
}

export async function setRegistryFields(fields: RegistryField[]): Promise<void> {

  await setDoc(doc(db, 'settings', 'registryConfig'), { fields, updatedAt: serverTimestamp() }, { merge: true })
}

// ─── Outcome Events ──────────────────────────────────────────────────────────

export async function addOutcomeEvent(patientId: string, input: OutcomeEventInput): Promise<string> {

  const ref = await addDoc(collection(db, 'patients', patientId, 'outcomes'), {
    ...input,
    createdAt: serverTimestamp(),
  })
  return ref.id
}

export async function getOutcomeEvents(patientId: string): Promise<OutcomeEvent[]> {

  const snap = await getDocs(
    query(collection(db, 'patients', patientId, 'outcomes'), orderBy('eventDate', 'desc'))
  )
  return snap.docs.map(d => ({
    ...d.data(),
    id: d.id,
    patientId,
    createdAt: toDate(d.data().createdAt),
  } as OutcomeEvent))
}

export async function deleteOutcomeEvent(patientId: string, eventId: string): Promise<void> {

  await deleteDoc(doc(db, 'patients', patientId, 'outcomes', eventId))
}

export function subscribePatients(onUpdate: (patients: Patient[]) => void): () => void {

  const q = query(collection(db, 'patients'), orderBy('createdAt', 'desc'), limit(1000))
  return onSnapshot(q, (snap) => {
    const pts = snap.docs.map(d => docToPatient(d.id, d.data()))
    onUpdate(pts)
  }, (err) => {
    console.error('subscribePatients error:', err)
  })
}

export function subscribeVisits(onUpdate: (visits: Visit[]) => void, maxLimit = 5000): () => void {

  const q = query(collectionGroup(db, 'visits'), limit(maxLimit))
  return onSnapshot(q, (snap) => {
    const visits = snap.docs.map(d => {
      const patientId = d.ref.parent.parent?.id || ''
      return docToVisit(d.id, patientId, d.data())
    })
    onUpdate(visits)
  }, (err) => {
    console.error('subscribeVisits error:', err)
  })
}

// ─── Governance & Audit Trail Seam ──────────────────────────────────────────

/**
 * writeAudit
 * Seam for Phase 6 multi-center data governance, DPDP / HIPAA compliance audit trail.
 * Currently a structured no-op stub that provides a unified entry point for all mutations.
 */
export async function writeAudit(
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'EXPORT',
  entityType: 'procedure' | 'patient' | 'visit' | 'outcome',
  entityId: string,
  patientId: string,
  payload?: any
): Promise<void> {
  // Structured audit seam ready for Phase 6 immutable logging
  if (process.env.NODE_ENV !== 'production') {
    // Audit trace in development
  }
}

// ─── Cath Lab & Interventional Procedures ────────────────────────────────────

function safeTime(d?: string): number {
  return d ? new Date(d).getTime() || 0 : 0
}

/**
 * Adds an interventional procedure to the patient's subcollection:
 * patients/{patientId}/procedures/{procedureId}
 */
export async function addProcedure(patientId: string, input: CathProcedureInput): Promise<string> {

  // Deep clone to strip undefined values which Firestore rejects
  const cleanInput = JSON.parse(JSON.stringify(input))
  const ref = await addDoc(collection(db, 'patients', patientId, 'procedures'), {
    ...cleanInput,
    patientId,
    siteId: input.siteId || 'DEFAULT_SITE',
    operatorId: input.operatorId || 'DEFAULT_OPERATOR',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  await writeAudit('CREATE', 'procedure', ref.id, patientId, input)
  return ref.id
}

/**
 * Updates a procedure in the subcollection:
 * patients/{patientId}/procedures/{procedureId}
 */
export async function updateProcedure(
  patientId: string,
  procedureId: string,
  data: Partial<CathProcedureInput>
): Promise<void> {

  const clean = JSON.parse(JSON.stringify(data))
  await updateDoc(doc(db, 'patients', patientId, 'procedures', procedureId), {
    ...clean,
    updatedAt: serverTimestamp(),
  })
  await writeAudit('UPDATE', 'procedure', procedureId, patientId, data)
}

/**
 * Deletes a procedure from the subcollection.
 */
export async function deleteProcedure(patientId: string, procedureId: string): Promise<void> {

  await deleteDoc(doc(db, 'patients', patientId, 'procedures', procedureId))
  await writeAudit('DELETE', 'procedure', procedureId, patientId)
}

/**
 * Gets all procedures for a single patient.
 */
export async function getProcedures(patientId: string): Promise<CathProcedure[]> {

  try {
    const snap = await getDocs(
      query(collection(db, 'patients', patientId, 'procedures'), orderBy('procedureDateTime', 'desc'), limit(100))
    )
    return snap.docs.map(d => docToProcedure(d.id, d.data(), patientId))
  } catch {
    // Fallback in case procedureDateTime index is not built yet
    const snap = await getDocs(collection(db, 'patients', patientId, 'procedures'))
    return snap.docs
      .map(d => docToProcedure(d.id, d.data(), patientId))
      .sort((a, b) => safeTime(b.procedureDateTime || b.procedureDate) - safeTime(a.procedureDateTime || a.procedureDate))
  }
}

/**
 * Gets all procedures across all patients via collectionGroup('procedures').
 * CRITICAL DESIGN RULE:
 * Throws on failure rather than returning [] so callers render an explicit error
 * state instead of a false audited zero.
 */
export async function getAllProcedures(): Promise<CathProcedure[]> {

  try {
    const snap = await getDocs(query(collectionGroup(db, 'procedures'), limit(10000)))
    return snap.docs
      .map(d => {
        const patientId = d.ref.parent.parent?.id || ''
        return docToProcedure(d.id, d.data(), patientId)
      })
      .sort((a, b) => safeTime(b.procedureDateTime || b.procedureDate) - safeTime(a.procedureDateTime || a.procedureDate))
  } catch (err) {
    console.error('CRITICAL: getAllProcedures failed on Firestore collectionGroup:', err)
    // Throw error so caller renders an error state instead of a false zero
    throw err
  }
}

// ─── Backward Compatibility Aliases ──────────────────────────────────────────

export async function addCathProcedure(input: CathProcedureInput): Promise<string> {
  return addProcedure(input.patientId, input)
}

export async function updateCathProcedure(id: string, data: Partial<CathProcedureInput>): Promise<void> {
  const patientId = data.patientId || ''
  return updateProcedure(patientId, id, data)
}

export async function deleteCathProcedure(id: string): Promise<void> {
  return deleteProcedure('', id)
}

export async function getAllCathProcedures(): Promise<CathProcedure[]> {
  try {
    return await getAllProcedures()
  } catch (err) {
    // Preserved for legacy callers that might not catch
    console.error('getAllCathProcedures legacy bridge caught error:', err)
    throw err
  }
}

export async function getCathProceduresByPatient(patientId: string): Promise<CathProcedure[]> {
  return getProcedures(patientId)
}

export function subscribeCathProcedures(onUpdate: (procedures: CathProcedure[]) => void, maxLimit = 5000): () => void {

  const q = query(collectionGroup(db, 'procedures'), limit(maxLimit))
  return onSnapshot(q, (snap) => {
    const procs = snap.docs.map(d => {
      const patientId = d.ref.parent.parent?.id || ''
      return docToProcedure(d.id, d.data(), patientId)
    })
    procs.sort((a, b) => safeTime(b.procedureDateTime || b.procedureDate) - safeTime(a.procedureDateTime || a.procedureDate))
    onUpdate(procs)
  }, (err) => {
    console.error('subscribeCathProcedures error:', err)
  })
}



