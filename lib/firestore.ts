import {
  collection, doc, addDoc, setDoc, updateDoc,
  getDoc, getDocs, query, orderBy, limit, where, collectionGroup, startAfter,
  serverTimestamp, Timestamp, writeBatch, arrayUnion, onSnapshot,
  type Query, type QuerySnapshot, type QueryDocumentSnapshot, type DocumentData, type WriteBatch,
} from 'firebase/firestore'
import { db } from './firebase'
import type { Patient, PatientInput, Visit, VisitInput, PopulationStats, PatientTrends, TrendPoint, RegistryField, OutcomeEvent, OutcomeEventInput, CathProcedure, CathProcedureInput } from './types'
import { BUILT_IN_FIELDS } from './types'
import { getAge } from './utils'

export const isDemoMode = false

// ─── Tenant Scope ────────────────────────────────────────────────────────────
//
// Every read is constrained to the signed-in user's site. Firestore security
// rules enforce the same constraint server-side; rules are not filters, so a
// query that is not explicitly site-scoped would be rejected outright.

export interface DataScope {
  siteId: string
  /** SuperAdmin: may read across sites. */
  global: boolean
  uid: string
  userId: string
}

let activeScope: DataScope | null = null

export function setDataScope(scope: DataScope | null): void {
  activeScope = scope
}

function requireScope(): DataScope {
  if (!activeScope) throw new Error('Not signed in — registry data requires an authenticated session.')
  return activeScope
}

function scoped<T>(base: Query<T>): Query<T> {
  const scope = requireScope()
  return scope.global ? base : query(base, where('siteId', '==', scope.siteId))
}

const PAGE_SIZE = 1000

/**
 * Reads every document matching `q`, paging by document name so registries
 * larger than one page are never silently truncated.
 */
async function getAllDocs(q: Query<DocumentData>): Promise<QueryDocumentSnapshot<DocumentData>[]> {
  const all: QueryDocumentSnapshot<DocumentData>[] = []
  let cursor: QueryDocumentSnapshot<DocumentData> | null = null
  for (;;) {
    const page: QuerySnapshot<DocumentData> = await getDocs(cursor ? query(q, startAfter(cursor), limit(PAGE_SIZE)) : query(q, limit(PAGE_SIZE)))
    all.push(...page.docs)
    if (page.docs.length < PAGE_SIZE) return all
    cursor = page.docs[page.docs.length - 1]
  }
}

/** Site of an existing patient — denormalized onto child records for scoped collection-group reads. */
async function getPatientSiteId(patientId: string): Promise<string> {
  const snap = await getDoc(doc(db, 'patients', patientId))
  if (!snap.exists()) throw new Error(`Patient ${patientId} not found`)
  const siteId = snap.data().siteId
  if (!siteId) throw new Error(`Patient ${patientId} has no siteId — run scripts/backfill_site_ids.ts`)
  return siteId
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function cleanForFirestore<T>(val: T): T {
  if (val === null || val === undefined) return val
  return JSON.parse(JSON.stringify(val))
}

function parseNumeric(val: any): number | undefined {
  if (val === null || val === undefined || val === '') return undefined
  const num = Number(val)
  return isNaN(num) ? undefined : num
}

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
  const regIds = Array.isArray(data.registryIds) && data.registryIds.length > 0
    ? data.registryIds
    : (data.registryId ? [data.registryId] : [])
  return {
    ...data,
    id,
    comorbidities,
    registryIds: regIds,
    lvef: parseNumeric(data.lvef),
    latestSyntaxScore: parseNumeric(data.latestSyntaxScore),
    coronaryVesselsDiseased: parseNumeric(data.coronaryVesselsDiseased) ?? 0,
    visitCount: parseNumeric(data.visitCount) ?? 0,
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
    lvef: parseNumeric(data.lvef),
    ntProBNP: parseNumeric(data.ntProBNP),
    egfr: parseNumeric(data.egfr),
    creatinine: parseNumeric(data.creatinine),
    sodium: parseNumeric(data.sodium),
    potassium: parseNumeric(data.potassium),
    hb: parseNumeric(data.hb),
    weight: parseNumeric(data.weight),
    height: parseNumeric(data.height),
    bmi: parseNumeric(data.bmi),
    bpSystolic: parseNumeric(data.bpSystolic),
    bpDiastolic: parseNumeric(data.bpDiastolic),
    heartRate: parseNumeric(data.heartRate),
    respiratoryRate: parseNumeric(data.respiratoryRate),
    o2Sat: parseNumeric(data.o2Sat),
    ferritin: parseNumeric(data.ferritin),
    transferrinSat: parseNumeric(data.transferrinSat),
    qrsDuration: parseNumeric(data.qrsDuration),
    qtcInterval: parseNumeric(data.qtcInterval),
    sixMWT: parseNumeric(data.sixMWT),
    visitDate: toDate(data.visitDate) || toDate(data.createdAt),
    echoDate: toDate(data.echoDate),
    dischargeDate: toDate(data.dischargeDate),
    followupDate: toDate(data.followupDate),
    createdAt: toDate(data.createdAt),
  } as Visit
}

const mGyToGy = (v: number | undefined) => (v == null ? undefined : v / 1000)
const gyToMGy = (v: number | undefined) => (v == null ? undefined : v * 1000)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function docToProcedure(id: string, data: any, fallbackPatientId = ''): CathProcedure {
  const isPci = (data.lesions && data.lesions.some((l: any) => l.treated)) || (data.devices && data.devices.length > 0)
  const defaultProcType = isPci ? 'Percutaneous Coronary Intervention (PCI)' : 'Coronary Angiography (Diagnostic)'
  const procDate = toDate(data.procedureDate) || (typeof data.procedureDateTime === 'string' ? data.procedureDateTime.slice(0, 10) : '') || toDate(data.createdAt).slice(0, 10)

  return {
    ...data,
    id,
    patientId: data.patientId || fallbackPatientId,
    siteId: data.siteId || '',
    operatorId: data.operatorId || '',
    procedureType: data.procedureType || defaultProcType,
    clinicalIndication: data.clinicalIndication || data.presentation || undefined,
    // The CRF writes fluoroscopyTimeMin; older records and several readers use fluoroscopyTimeMinutes.
    // Missing measurements stay undefined — never 0, which would read as a recorded value.
    fluoroscopyTimeMin: parseNumeric(data.fluoroscopyTimeMin) ?? parseNumeric(data.fluoroscopyTimeMinutes),
    fluoroscopyTimeMinutes: parseNumeric(data.fluoroscopyTimeMinutes) ?? parseNumeric(data.fluoroscopyTimeMin),
    contrastVolumeMl: parseNumeric(data.contrastVolumeMl),
    contrastType: data.contrastType || (typeof data.contrastAgent === 'string'
      ? (data.contrastAgent.includes('Iso-osmolar') ? 'Iso-osmolar' : 'Low-osmolar')
      : undefined),
    // Air kerma is stored in Gy by legacy records and mGy by the CRF — convert, don't copy.
    radiationAirKermaGy: parseNumeric(data.radiationAirKermaGy) ?? mGyToGy(parseNumeric(data.airKermaMGy)),
    airKermaMGy: parseNumeric(data.airKermaMGy) ?? gyToMGy(parseNumeric(data.radiationAirKermaGy)),
    doseAreaProductGyCm2: parseNumeric(data.doseAreaProductGyCm2) ?? parseNumeric(data.dapGyCm2),
    dapGyCm2: parseNumeric(data.dapGyCm2) ?? parseNumeric(data.doseAreaProductGyCm2),
    lesions: Array.isArray(data.lesions) ? data.lesions : [],
    devices: Array.isArray(data.devices) ? data.devices : [],
    // Absent means the complication audit was never done; [] means audited with none.
    complications: data.complications,
    procedureDateTime: data.procedureDateTime || toDate(data.procedureDate) || toDate(data.createdAt),
    procedureDate: procDate,
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  } as CathProcedure
}

// ─── Patients ────────────────────────────────────────────────────────────────

export async function addPatient(input: PatientInput): Promise<string> {
  const scope = requireScope()
  const siteId = (input as any).siteId || scope.siteId
  if (!scope.global && siteId !== scope.siteId) {
    throw new Error('Cannot create a patient for another site.')
  }

  const rawInput = cleanForFirestore(input)
  if (rawInput.registryId === 'heart-failure') {
    rawInput.registryId = 'hf'
  }
  if (rawInput.registryId && (!rawInput.registryIds || rawInput.registryIds.length === 0)) {
    rawInput.registryIds = [rawInput.registryId]
  }

  const cleanInput = Object.fromEntries(Object.entries(rawInput).filter(([, v]) => v !== undefined))
  const ref = doc(collection(db, 'patients'))
  const batch = writeBatch(db)
  batch.set(ref, {
    ...cleanInput,
    siteId,
    visitCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  stageAudit(batch, 'CREATE', 'patient', ref.id, ref.id, cleanInput)
  await batch.commit()
  return ref.id
}

export async function updatePatient(id: string, data: Partial<PatientInput>): Promise<void> {
  // Firestore rejects undefined values — strip them before writing.
  // siteId is immutable after creation (security rules reject changes).
  const raw = cleanForFirestore(data)
  if (raw.registryId === 'heart-failure') {
    raw.registryId = 'hf'
  }
  if (raw.registryId && (!raw.registryIds || raw.registryIds.length === 0)) {
    // Add to existing enrollments rather than replacing them.
    ;(raw as any).registryIds = arrayUnion(raw.registryId)
  }
  const clean = Object.fromEntries(
    Object.entries(raw).filter(([k, v]) => v !== undefined && k !== 'siteId')
  )
  const batch = writeBatch(db)
  batch.update(doc(db, 'patients', id), { ...clean, updatedAt: serverTimestamp() })
  stageAudit(batch, 'UPDATE', 'patient', id, id, clean)
  await batch.commit()
}

const PATIENT_SUBCOLLECTIONS = ['visits', 'procedures', 'events', 'outcomes'] as const

export async function deletePatient(id: string): Promise<void> {
  // Firestore batches cap at 500 writes; delete children in chunks, then the
  // patient document together with its audit entry.
  const childRefs = (await Promise.all(
    PATIENT_SUBCOLLECTIONS.map(sub => getDocs(collection(db, 'patients', id, sub)))
  )).flatMap(snap => snap.docs.map(d => d.ref))

  for (let i = 0; i < childRefs.length; i += 450) {
    const batch = writeBatch(db)
    childRefs.slice(i, i + 450).forEach(ref => batch.delete(ref))
    await batch.commit()
  }

  const batch = writeBatch(db)
  batch.delete(doc(db, 'patients', id))
  stageAudit(batch, 'DELETE', 'patient', id, id, { childRecordsDeleted: childRefs.length })
  await batch.commit()
}

export async function getPatient(id: string): Promise<Patient | null> {
  requireScope()
  const snap = await getDoc(doc(db, 'patients', id))
  if (!snap.exists()) return null
  return docToPatient(snap.id, snap.data())
}

const byCreatedDesc = (a: Patient, b: Patient) => (b.createdAt || '').localeCompare(a.createdAt || '')

export async function getPatients(): Promise<Patient[]> {
  const docs = await getAllDocs(scoped(collection(db, 'patients')))
  return docs.map(d => docToPatient(d.id, d.data())).sort(byCreatedDesc)
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
 */
export async function getPatientsByRegistry(registryId: string): Promise<Patient[]> {
  const patients = await getAllDocs(scoped(collection(db, 'patients')))
  return patients
    .map(d => docToPatient(d.id, d.data()))
    .filter(p => p.registryIds?.includes(registryId) || p.registryId === registryId)
    .sort(byCreatedDesc)
}


async function updatePatientCachedFields(patientId: string): Promise<void> {
  const [visitsSnap, procsSnap] = await Promise.all([
    getDocs(collection(db, 'patients', patientId, 'visits')),
    getDocs(collection(db, 'patients', patientId, 'procedures'))
  ])

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

  // Procedure aggregations
  let hasAngio = false
  let priorPCI = false
  let syntax: number | undefined = undefined
  let vessels = 0
  let latestProcDate = ''

  procsSnap.docs.forEach(doc => {
    const d = doc.data()
    hasAngio = true
    const pDate = d.procedureDate || (typeof d.procedureDateTime === 'string' ? d.procedureDateTime.slice(0, 10) : '')
    if (pDate && (!latestProcDate || new Date(pDate).getTime() > new Date(latestProcDate).getTime())) {
      latestProcDate = pDate
    }
    if ((d.lesions && d.lesions.some((l: any) => l.treated)) || (d.devices && d.devices.length > 0)) {
      priorPCI = true
    }
    if (d.segmentStenosisMap) {
      const map = d.segmentStenosisMap
      let lmStenosis = map[5] ?? 0
      let ladMax = Math.max(map[6] ?? 0, map[7] ?? 0, map[8] ?? 0, map[9] ?? 0, map[10] ?? 0)
      let lcxMax = Math.max(map[11] ?? 0, map[12] ?? 0, map[13] ?? 0, map[14] ?? 0, map[15] ?? 0)
      let rcaMax = Math.max(map[1] ?? 0, map[2] ?? 0, map[3] ?? 0, map[4] ?? 0, map[16] ?? 0)
      if (Array.isArray(d.lesions)) {
        for (const l of d.lesions) {
          if (l.vessel === 'LM') lmStenosis = Math.max(lmStenosis, l.preStenosisPct || 0)
          if (l.vessel === 'LAD') ladMax = Math.max(ladMax, l.preStenosisPct || 0)
          if (l.vessel === 'LCx') lcxMax = Math.max(lcxMax, l.preStenosisPct || 0)
          if (l.vessel === 'RCA') rcaMax = Math.max(rcaMax, l.preStenosisPct || 0)
        }
      }
      let vCount = 0
      if (ladMax >= 70) vCount++
      if (lcxMax >= 70) vCount++
      if (rcaMax >= 70) vCount++
      if (lmStenosis >= 50) vCount++
      vessels = Math.max(vessels, vCount)
    }
  })

  if (latestVisitData?.coronaryAnatomy) {
    const ca = latestVisitData.coronaryAnatomy
    hasAngio = true
    syntax = ca.syntaxScore
    let caVessels = 0
    if ((ca.lmStenosis ?? 0) >= 50) caVessels++
    if ((ca.ladStenosis ?? 0) >= 70) caVessels++
    if ((ca.lcxStenosis ?? 0) >= 70) caVessels++
    if ((ca.rcaStenosis ?? 0) >= 70) caVessels++
    vessels = Math.max(vessels, caVessels)
  }

  const updates: Record<string, any> = {
    visitCount: visitsSnap.size,
    lastVisitDate: latestDate || latestProcDate || '',
    hasCoronaryAngiogram: hasAngio,
    coronaryVesselsDiseased: vessels,
    updatedAt: serverTimestamp(),
  }

  if (priorPCI) {
    updates.comorbidPriorPCI = true
  }

  if (latestVisitData) {
    updates.hfType = latestVisitData.hfType || ''
    updates.nyha = latestVisitData.nyha || ''
    updates.lvef = parseNumeric(latestVisitData.lvef) ?? null
    if (syntax !== undefined) {
      updates.latestSyntaxScore = parseNumeric(syntax) ?? null
    }
  } else if (visitsSnap.empty) {
    updates.hfType = ''
    updates.nyha = ''
    updates.lvef = null
  }

  await updateDoc(doc(db, 'patients', patientId), cleanForFirestore(updates))
}

// ─── Visits ──────────────────────────────────────────────────────────────────

export async function addVisit(patientId: string, input: VisitInput): Promise<string> {
  const siteId = await getPatientSiteId(patientId)
  const cleanVisit = cleanForFirestore(input)
  const ref = doc(collection(db, 'patients', patientId, 'visits'))
  const batch = writeBatch(db)
  batch.set(ref, {
    ...cleanVisit,
    patientId,
    siteId,
    createdAt: serverTimestamp(),
  })
  stageAudit(batch, 'CREATE', 'visit', ref.id, patientId, cleanVisit)
  await batch.commit()

  await updatePatientCachedFields(patientId)
  return ref.id
}

export async function updateVisit(patientId: string, visitId: string, data: Partial<VisitInput>): Promise<void> {
  const now = new Date().toISOString()
  const updatedFields = Object.keys(data)
  const historyEntry = { updatedAt: now, updatedFields }

  const cleanData = cleanForFirestore(data)
  delete (cleanData as any).siteId
  const batch = writeBatch(db)
  batch.update(doc(db, 'patients', patientId, 'visits', visitId), {
    ...cleanData,
    updatedAt: serverTimestamp(),
    editHistory: arrayUnion(historyEntry)
  })
  stageAudit(batch, 'UPDATE', 'visit', visitId, patientId, cleanData)
  await batch.commit()

  await updatePatientCachedFields(patientId)
}

export async function deleteVisit(patientId: string, visitId: string): Promise<void> {
  const batch = writeBatch(db)
  batch.delete(doc(db, 'patients', patientId, 'visits', visitId))
  stageAudit(batch, 'DELETE', 'visit', visitId, patientId)
  await batch.commit()
  await updatePatientCachedFields(patientId)
}

export async function getVisits(patientId: string): Promise<Visit[]> {
  requireScope()
  const snap = await getDocs(
    query(collection(db, 'patients', patientId, 'visits'), orderBy('visitDate', 'desc'))
  )
  return snap.docs.map(d => docToVisit(d.id, patientId, d.data()))
}

export async function getLatestVisit(patientId: string): Promise<Visit | null> {
  requireScope()
  const snap = await getDocs(
    query(collection(db, 'patients', patientId, 'visits'), orderBy('visitDate', 'desc'), limit(1))
  )
  if (snap.empty) return null
  return docToVisit(snap.docs[0].id, patientId, snap.docs[0].data())
}

/**
 * Efficiently fetch the latest visit for every patient in one pass.
 * Returns a Map of patientId → latest Visit (or null if no visits).
 * Throws on failure so callers can show an error instead of an empty registry.
 */
export async function getAllLatestVisits(): Promise<Map<string, Visit>> {
  const map = new Map<string, Visit>()
  for (const v of await getAllVisits()) {
    const existing = map.get(v.patientId)
    if (!existing || visitTime(v) > visitTime(existing)) {
      map.set(v.patientId, v)
    }
  }
  return map
}

function visitTime(v: Visit): number {
  const t = new Date(v.visitDate).getTime()
  return isNaN(t) ? -Infinity : t
}

/**
 * Return every visit in the user's site scope (paged, never truncated).
 * Throws on failure so callers can show an error instead of a false zero.
 */
export async function getAllVisits(): Promise<Visit[]> {
  return getChildRecordsForScopedPatients('visits', (id, pid, data) => docToVisit(id, pid, data))
}

// ─── Site-scoped child records ───────────────────────────────────────────────
//
// Visits and procedures are read per patient (patients are already site-scoped)
// rather than with a collection-group query. A filtered collection-group query
// needs a COLLECTION_GROUP index and a denormalized siteId on every child
// record; per-patient reads need neither, and still never touch other sites.

type ChildCollection = 'visits' | 'procedures'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ChildMapper<T> = (id: string, patientId: string, data: any) => T

const CHILD_READ_CONCURRENCY = 25

async function mapWithLimit<T, R>(items: T[], limitN: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let next = 0
  const worker = async () => {
    while (next < items.length) {
      const i = next++
      results[i] = await fn(items[i])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limitN, items.length) }, worker))
  return results
}

async function getChildRecordsForScopedPatients<T>(sub: ChildCollection, map: ChildMapper<T>): Promise<T[]> {
  const patientIds = (await getAllDocs(scoped(collection(db, 'patients')))).map(d => d.id)
  const snaps = await mapWithLimit(patientIds, CHILD_READ_CONCURRENCY, pid => getDocs(collection(db, 'patients', pid, sub)))
  return snaps.flatMap((snap, i) => snap.docs.map(d => map(d.id, patientIds[i], d.data())))
}

/**
 * Live child records for every patient in scope: one listener on the scoped
 * patients query, plus one listener per patient's subcollection.
 */
function subscribeChildRecordsForScopedPatients<T>(
  sub: ChildCollection,
  map: ChildMapper<T>,
  onUpdate: (records: T[]) => void,
  onError?: (err: Error) => void,
): () => void {
  const childUnsubs = new Map<string, () => void>()
  const byPatient = new Map<string, T[]>()
  const emit = () => onUpdate(Array.from(byPatient.values()).flat())
  const fail = (err: Error) => {
    console.error(`subscribe ${sub} error:`, err)
    onError?.(err)
  }

  const unsubPatients = onSnapshot(scoped(collection(db, 'patients')), (snap) => {
    const ids = new Set(snap.docs.map(d => d.id))
    childUnsubs.forEach((unsub, pid) => {
      if (!ids.has(pid)) {
        unsub()
        childUnsubs.delete(pid)
        byPatient.delete(pid)
      }
    })
    ids.forEach(pid => {
      if (childUnsubs.has(pid)) return
      childUnsubs.set(pid, onSnapshot(collection(db, 'patients', pid, sub), (cs) => {
        byPatient.set(pid, cs.docs.map(d => map(d.id, pid, d.data())))
        emit()
      }, fail))
    })
    if (ids.size === 0) emit()
  }, fail)

  return () => {
    unsubPatients()
    childUnsubs.forEach(unsub => unsub())
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
export async function getPopulationStats(accessiblePatients?: Patient[]): Promise<PopulationStats> {
  const patients = accessiblePatients || (await getPatients())

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

  const mean = (arr: number[]) => arr.length ? Math.round((arr.reduce((a, b) => a + Number(b), 0) / arr.length) * 10) / 10 : null

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
  const siteId = await getPatientSiteId(patientId)
  const ref = doc(collection(db, 'patients', patientId, 'outcomes'))
  const batch = writeBatch(db)
  batch.set(ref, {
    ...input,
    patientId,
    siteId,
    createdAt: serverTimestamp(),
  })
  stageAudit(batch, 'CREATE', 'outcome', ref.id, patientId, input)
  await batch.commit()
  return ref.id
}

export async function getOutcomeEvents(patientId: string): Promise<OutcomeEvent[]> {
  requireScope()
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
  const batch = writeBatch(db)
  batch.delete(doc(db, 'patients', patientId, 'outcomes', eventId))
  stageAudit(batch, 'DELETE', 'outcome', eventId, patientId)
  await batch.commit()
}

export function subscribePatients(
  onUpdate: (patients: Patient[]) => void,
  onError?: (err: Error) => void,
): () => void {
  return onSnapshot(scoped(collection(db, 'patients')), (snap) => {
    onUpdate(snap.docs.map(d => docToPatient(d.id, d.data())).sort(byCreatedDesc))
  }, (err) => {
    console.error('subscribePatients error:', err)
    onError?.(err)
  })
}

export function subscribeVisits(
  onUpdate: (visits: Visit[]) => void,
  onError?: (err: Error) => void,
): () => void {
  return subscribeChildRecordsForScopedPatients('visits', (id, pid, data) => docToVisit(id, pid, data), onUpdate, onError)
}

// ─── Governance & Audit Trail ────────────────────────────────────────────────
//
// Append-only auditLog collection (security rules forbid update/delete and
// require the entry's uid to match the caller). Mutations stage their audit
// entry in the same batch, so a change is never committed without its record.
// Only field names are logged, never clinical values or identifiers.

export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'EXPORT' | 'IMPORT' | 'VIEW' | 'LOGIN' | 'LOGOUT'
export type AuditEntity = 'procedure' | 'patient' | 'visit' | 'outcome' | 'session' | 'report' | 'registry' | 'alert' | 'appointment'

function auditEntry(
  action: AuditAction,
  entityType: AuditEntity,
  entityId: string,
  patientId: string,
  payload?: unknown,
) {
  const scope = requireScope()
  return {
    action,
    entityType,
    entityId,
    patientId,
    uid: scope.uid,
    userId: scope.userId,
    siteId: scope.siteId,
    fields: payload && typeof payload === 'object' ? Object.keys(payload as object) : [],
    at: serverTimestamp(),
  }
}

function stageAudit(
  batch: WriteBatch,
  action: AuditAction,
  entityType: AuditEntity,
  entityId: string,
  patientId: string,
  payload?: unknown,
): void {
  batch.set(doc(collection(db, 'auditLog')), auditEntry(action, entityType, entityId, patientId, payload))
}

/** Standalone audit entry for events that are not data mutations (login, export, chart view). */
export async function writeAudit(
  action: AuditAction,
  entityType: AuditEntity,
  entityId: string,
  patientId: string,
  payload?: unknown,
): Promise<void> {
  await addDoc(collection(db, 'auditLog'), auditEntry(action, entityType, entityId, patientId, payload))
}

// ─── Clinical alert acknowledgements ─────────────────────────────────────────
//
// alertAcks/{alertId} — shared across every clinician at the site, so an alert
// resolved on one workstation is resolved for everyone.

/** IDs of alerts already resolved at the user's site. */
export async function getResolvedAlertIds(): Promise<Set<string>> {
  const docs = await getAllDocs(scoped(collection(db, 'alertAcks')))
  return new Set(
    docs
      .filter(d => {
        const data = d.data()
        return data.status !== 'Open' && data.unresolved !== true
      })
      .map(d => d.id)
  )
}

export async function resolveAlert(alertId: string, patientId: string): Promise<void> {
  const scope = requireScope()
  const batch = writeBatch(db)
  batch.set(doc(db, 'alertAcks', alertId), {
    alertId,
    patientId,
    siteId: scope.siteId,
    resolvedBy: scope.userId,
    resolvedAt: serverTimestamp(),
    status: 'Resolved',
    unresolved: false,
  })
  stageAudit(batch, 'UPDATE', 'alert', alertId, patientId)
  await batch.commit()
}

export async function unresolveAlert(alertId: string, patientId: string): Promise<void> {
  const scope = requireScope()
  const batch = writeBatch(db)
  batch.set(doc(db, 'alertAcks', alertId), {
    alertId,
    patientId,
    siteId: scope.siteId,
    resolvedBy: scope.userId,
    resolvedAt: serverTimestamp(),
    status: 'Open',
    unresolved: true,
  })
  stageAudit(batch, 'UPDATE', 'alert', alertId, patientId)
  await batch.commit()
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
  const siteId = await getPatientSiteId(patientId)
  // Deep clone to strip undefined values which Firestore rejects
  const cleanInput = JSON.parse(JSON.stringify(input))
  const ref = doc(collection(db, 'patients', patientId, 'procedures'))
  const batch = writeBatch(db)
  batch.set(ref, {
    ...cleanInput,
    patientId,
    siteId,
    operatorId: input.operatorId || '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  stageAudit(batch, 'CREATE', 'procedure', ref.id, patientId, cleanInput)
  await batch.commit()
  await updatePatientCachedFields(patientId)
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

  const { siteId: _siteId, ...clean } = JSON.parse(JSON.stringify(data))
  const batch = writeBatch(db)
  batch.update(doc(db, 'patients', patientId, 'procedures', procedureId), {
    ...clean,
    updatedAt: serverTimestamp(),
  })
  stageAudit(batch, 'UPDATE', 'procedure', procedureId, patientId, clean)
  await batch.commit()
  await updatePatientCachedFields(patientId)
}

/**
 * Deletes a procedure from the subcollection.
 */
export async function deleteProcedure(patientId: string, procedureId: string): Promise<void> {
  const batch = writeBatch(db)
  batch.delete(doc(db, 'patients', patientId, 'procedures', procedureId))
  stageAudit(batch, 'DELETE', 'procedure', procedureId, patientId)
  await batch.commit()
  await updatePatientCachedFields(patientId)
}

/**
 * Gets all procedures for a single patient.
 */
export async function getProcedures(patientId: string): Promise<CathProcedure[]> {
  requireScope()
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
 * Gets all procedures for patients in the user's site scope.
 * Throws on failure rather than returning [] so callers render an explicit error
 * state instead of a false audited zero.
 */
export async function getAllProcedures(): Promise<CathProcedure[]> {
  const procs = await getChildRecordsForScopedPatients('procedures', (id, pid, data) => docToProcedure(id, data, pid))
  return procs.sort((a, b) => safeTime(b.procedureDateTime || b.procedureDate) - safeTime(a.procedureDateTime || a.procedureDate))
}

export const getAllCathProcedures = getAllProcedures

export async function getCathProceduresByPatient(patientId: string): Promise<CathProcedure[]> {
  return getProcedures(patientId)
}

export function subscribeCathProcedures(
  onUpdate: (procedures: CathProcedure[]) => void,
  onError?: (err: Error) => void,
): () => void {
  return subscribeChildRecordsForScopedPatients('procedures', (id, pid, data) => docToProcedure(id, data, pid), (procs) => {
    onUpdate([...procs].sort((a, b) => safeTime(b.procedureDateTime || b.procedureDate) - safeTime(a.procedureDateTime || a.procedureDate)))
  }, onError)
}

// ─── Backward Compatibility Aliases ──────────────────────────────────────────

export async function addCathProcedure(input: CathProcedureInput): Promise<string> {
  return addProcedure(input.patientId, input)
}

export async function updateCathProcedure(id: string, data: Partial<CathProcedureInput>, patientId?: string): Promise<void> {
  const pId = patientId || data.patientId || ''
  return updateProcedure(pId, id, data)
}

export async function deleteCathProcedure(id: string, patientId?: string): Promise<void> {
  if (patientId) {
    return deleteProcedure(patientId, id)
  }
  try {
    const snap = await getDocs(query(collectionGroup(db, 'procedures'), limit(1000)))
    const match = snap.docs.find(d => d.id === id)
    if (match) {
      const pid = match.ref.parent.parent?.id || ''
      if (pid) return deleteProcedure(pid, id)
    }
  } catch (e) {
    console.error('deleteCathProcedure failed:', e)
  }
}

// ─── Appointments ────────────────────────────────────────────────────────────

export interface AppointmentDoc {
  id: string
  appointmentId: string
  patientId: string
  patientName: string
  mrn: string
  dateAndTime: string
  type: string
  registry: string
  facility: string
  doctor: string
  status: 'Today' | 'Upcoming' | 'Completed' | 'Pending Acknowledgement' | 'Cancelled'
  notes?: string
  siteId: string
  createdAt?: string
}

export type AppointmentInput = Omit<AppointmentDoc, 'id' | 'createdAt'>

export async function getAppointments(): Promise<AppointmentDoc[]> {
  const scope = requireScope()
  try {
    const q = scope.global
      ? query(collection(db, 'appointments'), orderBy('dateAndTime', 'desc'))
      : query(collection(db, 'appointments'), where('siteId', '==', scope.siteId), orderBy('dateAndTime', 'desc'))
    const snap = await getDocs(q)
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as AppointmentDoc))
  } catch {
    const snap = await getDocs(
      scope.global
        ? collection(db, 'appointments')
        : query(collection(db, 'appointments'), where('siteId', '==', scope.siteId))
    )
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as AppointmentDoc))
    return list.sort((a, b) => (b.dateAndTime || '').localeCompare(a.dateAndTime || ''))
  }
}

export async function addAppointment(input: AppointmentInput): Promise<string> {
  const scope = requireScope()
  const siteId = input.siteId || scope.siteId
  const clean = cleanForFirestore(input)
  const ref = doc(collection(db, 'appointments'))
  const batch = writeBatch(db)
  batch.set(ref, {
    ...clean,
    siteId,
    createdAt: serverTimestamp(),
  })
  stageAudit(batch, 'CREATE', 'appointment', ref.id, input.patientId, clean)
  await batch.commit()
  return ref.id
}

export async function updateAppointmentStatus(
  id: string,
  status: AppointmentDoc['status'],
  patientId: string
): Promise<void> {
  const ref = doc(db, 'appointments', id)
  const batch = writeBatch(db)
  batch.update(ref, {
    status,
    updatedAt: serverTimestamp(),
  })
  stageAudit(batch, 'UPDATE', 'appointment', id, patientId, { status })
  await batch.commit()
}

export async function deleteAppointment(id: string, patientId: string): Promise<void> {
  const ref = doc(db, 'appointments', id)
  const batch = writeBatch(db)
  batch.delete(ref)
  stageAudit(batch, 'DELETE', 'appointment', id, patientId)
  await batch.commit()
}
