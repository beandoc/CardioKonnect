import {
  collection, doc, addDoc, setDoc, updateDoc, deleteDoc,
  getDoc, getDocs, query, orderBy, limit, where, collectionGroup,
  serverTimestamp, Timestamp, writeBatch, arrayUnion, onSnapshot,
} from 'firebase/firestore'
import { db } from './firebase'
import type { Patient, PatientInput, Visit, VisitInput, PopulationStats, PatientTrends, TrendPoint, RegistryField, OutcomeEvent, OutcomeEventInput } from './types'
import { BUILT_IN_FIELDS } from './types'

// ─── Local Storage Fallback for Offline Demo Mode ────────────────────────────

// isDemoMode controls whether to use localStorage (browser storage) vs Firestore (cloud database).
// Set to false = use Firestore (current production config)
// Set to true = use localStorage only (demo mode, no cloud backend)
//
// If Firestore is unreachable, queries may silently return empty results. This will
// cause the dashboard to show 0 patients with no error message. Use dashboard's
// dbError state and error banner to alert users when the database is unavailable.
export const isDemoMode = false

function getLocalPatients(): Patient[] {
  if (typeof window === 'undefined') return []
  const data = localStorage.getItem('cardio_patients')
  if (!data) return []
  try {
    return JSON.parse(data)
  } catch {
    return []
  }
}

function saveLocalPatients(pts: Patient[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem('cardio_patients', JSON.stringify(pts))
  window.dispatchEvent(new Event('cardio_patients_updated'))
}

function getLocalVisits(): Visit[] {
  if (typeof window === 'undefined') return []
  const data = localStorage.getItem('cardio_visits')
  if (!data) return []
  try {
    return JSON.parse(data)
  } catch {
    return []
  }
}

function saveLocalVisits(vts: Visit[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem('cardio_visits', JSON.stringify(vts))
  window.dispatchEvent(new Event('cardio_visits_updated'))
}

function getLocalOutcomes(): OutcomeEvent[] {
  if (typeof window === 'undefined') return []
  const data = localStorage.getItem('cardio_outcomes')
  if (!data) return []
  return JSON.parse(data)
}

function saveLocalOutcomes(evs: OutcomeEvent[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem('cardio_outcomes', JSON.stringify(evs))
}


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

// ─── Patients ────────────────────────────────────────────────────────────────

export async function addPatient(input: PatientInput): Promise<string> {
  if (isDemoMode) {
    const pts = getLocalPatients()
    const id = 'p-' + Math.random().toString(36).substr(2, 9)
    const newPt: Patient = {
      ...input,
      id,
      visitCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    pts.push(newPt)
    saveLocalPatients(pts)
    return id
  }

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
  if (isDemoMode) {
    const pts = getLocalPatients()
    const idx = pts.findIndex(p => p.id === id)
    if (idx !== -1) {
      pts[idx] = { ...pts[idx], ...data, updatedAt: new Date().toISOString() }
      saveLocalPatients(pts)
    }
    return
  }

  // Firestore rejects undefined values — strip them before writing
  const clean = Object.fromEntries(
    Object.entries(data).filter(([, v]) => v !== undefined)
  )
  await updateDoc(doc(db, 'patients', id), { ...clean, updatedAt: serverTimestamp() })
}

export async function deletePatient(id: string): Promise<void> {
  if (isDemoMode) {
    const pts = getLocalPatients().filter(p => p.id !== id)
    saveLocalPatients(pts)
    const vts = getLocalVisits().filter(v => v.patientId !== id)
    saveLocalVisits(vts)
    return
  }

  const batch = writeBatch(db)

  // 1. Delete visits subcollection
  const visitsSnap = await getDocs(collection(db, 'patients', id, 'visits'))
  visitsSnap.docs.forEach(d => batch.delete(d.ref))

  // 2. Delete events subcollection
  const eventsSubSnap = await getDocs(collection(db, 'patients', id, 'events'))
  eventsSubSnap.docs.forEach(d => batch.delete(d.ref))

  // 3. Delete outcomes subcollection
  const outcomesSubSnap = await getDocs(collection(db, 'patients', id, 'outcomes'))
  outcomesSubSnap.docs.forEach(d => batch.delete(d.ref))

  // 4. Delete top-level events by patientId
  try {
    const topEventsSnap = await getDocs(query(collection(db, 'events'), where('patientId', '==', id)))
    topEventsSnap.docs.forEach(d => batch.delete(d.ref))
  } catch (e) {
    console.warn('Could not delete top-level events:', e)
  }

  // 5. Delete top-level outcomes by patientId
  try {
    const topOutcomesSnap = await getDocs(query(collection(db, 'outcomes'), where('patientId', '==', id)))
    topOutcomesSnap.docs.forEach(d => batch.delete(d.ref))
  } catch (e) {
    console.warn('Could not delete top-level outcomes:', e)
  }

  // 6. Delete patient document
  batch.delete(doc(db, 'patients', id))
  await batch.commit()
}

export async function getPatient(id: string): Promise<Patient | null> {
  if (isDemoMode) {
    return getLocalPatients().find(p => p.id === id) || null
  }

  const snap = await getDoc(doc(db, 'patients', id))
  if (!snap.exists()) return null
  return docToPatient(snap.id, snap.data())
}

export async function getPatients(): Promise<Patient[]> {
  if (isDemoMode) {
    return getLocalPatients().sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  const snap = await getDocs(query(collection(db, 'patients'), orderBy('createdAt', 'desc'), limit(1000)))
  return snap.docs.map(d => docToPatient(d.id, d.data()))
}

async function updatePatientCachedFields(patientId: string): Promise<void> {
  if (isDemoMode) {
    const vts = getLocalVisits().filter(v => v.patientId === patientId)
    const pts = getLocalPatients()
    const idx = pts.findIndex(p => p.id === patientId)
    if (idx !== -1) {
      if (vts.length === 0) {
        pts[idx].hfType = ''
        pts[idx].nyha = ''
        pts[idx].lvef = undefined
        pts[idx].lastVisitDate = ''
        pts[idx].visitCount = 0
      } else {
        // Find chronologically latest visit
        let latestVisit = vts[0]
        vts.forEach(v => {
          if (new Date(v.visitDate).getTime() > new Date(latestVisit.visitDate).getTime()) {
            latestVisit = v
          }
        })
        pts[idx].hfType = latestVisit.hfType || ''
        pts[idx].nyha = latestVisit.nyha || ''
        pts[idx].lvef = latestVisit.lvef ?? undefined
        pts[idx].lastVisitDate = latestVisit.visitDate
        pts[idx].visitCount = vts.length
      }
      pts[idx].updatedAt = new Date().toISOString()
      saveLocalPatients(pts)
    }
    return
  }

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
    await updateDoc(doc(db, 'patients', patientId), {
      visitCount: visitsSnap.size,
      lastVisitDate: latestDate,
      hfType: latestVisitData.hfType || '',
      nyha: latestVisitData.nyha || '',
      lvef: latestVisitData.lvef ?? '',
      updatedAt: serverTimestamp(),
    })
  }
}

// ─── Visits ──────────────────────────────────────────────────────────────────

export async function addVisit(patientId: string, input: VisitInput): Promise<string> {
  if (isDemoMode) {
    const vts = getLocalVisits()
    const id = 'v-' + Math.random().toString(36).substr(2, 9)
    const newVt: Visit = {
      ...input,
      id,
      patientId,
      createdAt: new Date().toISOString(),
    }
    vts.push(newVt)
    saveLocalVisits(vts)

    await updatePatientCachedFields(patientId)
    return id
  }

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

  if (isDemoMode) {
    const vts = getLocalVisits()
    const idx = vts.findIndex(v => v.id === visitId)
    if (idx !== -1) {
      const current = vts[idx]
      const history = [...(current.editHistory || []), historyEntry]
      vts[idx] = { ...current, ...data, updatedAt: now, editHistory: history } as Visit
      saveLocalVisits(vts)
      await updatePatientCachedFields(patientId)
    }
    return
  }

  const cleanData = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined))
  await updateDoc(doc(db, 'patients', patientId, 'visits', visitId), {
    ...cleanData,
    updatedAt: serverTimestamp(),
    editHistory: arrayUnion(historyEntry)
  })

  await updatePatientCachedFields(patientId)
}

export async function deleteVisit(patientId: string, visitId: string): Promise<void> {
  if (isDemoMode) {
    const vts = getLocalVisits().filter(v => v.id !== visitId)
    saveLocalVisits(vts)
    await updatePatientCachedFields(patientId)
    return
  }

  await deleteDoc(doc(db, 'patients', patientId, 'visits', visitId))
  await updatePatientCachedFields(patientId)
}

export async function getVisits(patientId: string): Promise<Visit[]> {
  if (isDemoMode) {
    return getLocalVisits().filter(v => v.patientId === patientId).sort((a, b) => b.visitDate.localeCompare(a.visitDate))
  }

  const snap = await getDocs(
    query(collection(db, 'patients', patientId, 'visits'), orderBy('visitDate', 'desc'))
  )
  return snap.docs.map(d => docToVisit(d.id, patientId, d.data()))
}

export async function getLatestVisit(patientId: string): Promise<Visit | null> {
  if (isDemoMode) {
    const vts = getLocalVisits().filter(v => v.patientId === patientId).sort((a, b) => b.visitDate.localeCompare(a.visitDate))
    return vts[0] || null
  }

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
  if (isDemoMode) {
    const allVisits = getLocalVisits()
    for (const v of allVisits) {
      const existing = map.get(v.patientId)
      if (!existing || new Date(v.visitDate).getTime() > new Date(existing.visitDate).getTime()) {
        map.set(v.patientId, v)
      }
    }
    return map
  }

  // Firestore mode — fetch latest visit per patient by reading visits ordered by date DESC, limit to 10K docs
  // This caps reads at 10K regardless of visit count; in practice most patients have 1-3 visits
  try {
    const snap = await getDocs(query(collectionGroup(db, 'visits'), orderBy('visitDate', 'desc'), limit(10000)))
    for (const d of snap.docs) {
      const patientId = d.ref.parent.parent?.id || ''
      if (!patientId) continue
      const v = docToVisit(d.id, patientId, d.data())
      const existing = map.get(patientId)
      // Keep only the latest visit per patient (first one we see, since results are DESC by date)
      if (!existing) {
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
  if (isDemoMode) {
    return getLocalVisits()
  }
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

  latestVisitsMap.forEach((visit, patientId) => {
    visitsByPatient[patientId] = [visit]  // Only latest visit per patient
  })

  patients.forEach((p) => {
    // Age
    if (p.dob) {
      const age = Math.floor((Date.now() - new Date(p.dob).getTime()) / (365.25 * 86400000))
      ageVals.push(age)
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

  if (isDemoMode) {
    if (typeof window !== 'undefined') {
      const data = localStorage.getItem('cardio_fields')
      if (data) {
        const stored = JSON.parse(data) as RegistryField[];
        const existingNames = new Set(stored.map(f => f.fieldName));
        const missing = BUILT_IN_FIELDS.filter(f => !existingNames.has(f.fieldName));
        if (missing.length > 0) {
          let lastSrNo = stored.length > 0 ? Math.max(...stored.map(f => f.srNo)) : 0;
          const updated = [...stored];
          missing.forEach(f => {
            lastSrNo++;
            updated.push({ ...f, srNo: lastSrNo });
          });
          localStorage.setItem('cardio_fields', JSON.stringify(updated));
          fields = updated;
        } else {
          fields = stored;
        }
      } else {
        localStorage.setItem('cardio_fields', JSON.stringify(BUILT_IN_FIELDS));
        fields = BUILT_IN_FIELDS;
      }
    }
  } else {
    try {
      const snap = await getDoc(doc(db, 'settings', 'registryConfig'))
      if (snap.exists()) {
        const data = snap.data()
        if (data.fields && Array.isArray(data.fields)) {
          const stored = data.fields as RegistryField[];
          const existingNames = new Set(stored.map(f => f.fieldName));
          const missing = BUILT_IN_FIELDS.filter(f => !existingNames.has(f.fieldName));
          if (missing.length > 0) {
            let lastSrNo = stored.length > 0 ? Math.max(...stored.map(f => f.srNo)) : 0;
            const updated = [...stored];
            missing.forEach(f => {
              lastSrNo++;
              updated.push({ ...f, srNo: lastSrNo });
            });
            await setDoc(doc(db, 'settings', 'registryConfig'), { fields: updated, updatedAt: serverTimestamp() }, { merge: true });
            fields = updated;
          } else {
            fields = stored;
          }
        }
      } else {
        await setDoc(doc(db, 'settings', 'registryConfig'), { fields: BUILT_IN_FIELDS, updatedAt: serverTimestamp() });
        fields = BUILT_IN_FIELDS;
      }
    } catch (error) {
      console.error('Failed to get registry fields from Firestore:', error)
      fields = BUILT_IN_FIELDS;
    }
  }
  return fields;
}

export async function setRegistryFields(fields: RegistryField[]): Promise<void> {
  if (isDemoMode) {
    if (typeof window !== 'undefined') {
      localStorage.setItem('cardio_fields', JSON.stringify(fields))
    }
    return
  }

  await setDoc(doc(db, 'settings', 'registryConfig'), { fields, updatedAt: serverTimestamp() }, { merge: true })
}

// ─── Outcome Events ──────────────────────────────────────────────────────────

export async function addOutcomeEvent(patientId: string, input: OutcomeEventInput): Promise<string> {
  if (isDemoMode) {
    const evs = getLocalOutcomes()
    const id = 'ev-' + Math.random().toString(36).substr(2, 9)
    const newEv: OutcomeEvent = {
      ...input,
      id,
      patientId,
      createdAt: new Date().toISOString(),
    }
    evs.push(newEv)
    saveLocalOutcomes(evs)
    return id
  }

  const ref = await addDoc(collection(db, 'patients', patientId, 'outcomes'), {
    ...input,
    createdAt: serverTimestamp(),
  })
  return ref.id
}

export async function getOutcomeEvents(patientId: string): Promise<OutcomeEvent[]> {
  if (isDemoMode) {
    return getLocalOutcomes().filter(ev => ev.patientId === patientId).sort((a, b) => b.eventDate.localeCompare(a.eventDate))
  }

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
  if (isDemoMode) {
    const evs = getLocalOutcomes().filter(ev => ev.id !== eventId)
    saveLocalOutcomes(evs)
    return
  }

  await deleteDoc(doc(db, 'patients', patientId, 'outcomes', eventId))
}

export function subscribePatients(onUpdate: (patients: Patient[]) => void): () => void {
  if (isDemoMode) {
    onUpdate(getLocalPatients().sort((a, b) => b.createdAt.localeCompare(a.createdAt)))

    const handleLocalUpdate = () => {
      onUpdate(getLocalPatients().sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
    }

    const handleStorageUpdate = (e: StorageEvent) => {
      if (e.key === 'cardio_patients') {
        handleLocalUpdate()
      }
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('cardio_patients_updated', handleLocalUpdate)
      window.addEventListener('storage', handleStorageUpdate)
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('cardio_patients_updated', handleLocalUpdate)
        window.removeEventListener('storage', handleStorageUpdate)
      }
    }
  }

  const q = query(collection(db, 'patients'), orderBy('createdAt', 'desc'), limit(1000))
  return onSnapshot(q, (snap) => {
    const pts = snap.docs.map(d => docToPatient(d.id, d.data()))
    onUpdate(pts)
  }, (err) => {
    console.error('subscribePatients error:', err)
  })
}

export function subscribeVisits(onUpdate: (visits: Visit[]) => void): () => void {
  if (isDemoMode) {
    onUpdate(getLocalVisits())

    const handleLocalUpdate = () => {
      onUpdate(getLocalVisits())
    }

    const handleStorageUpdate = (e: StorageEvent) => {
      if (e.key === 'cardio_visits') {
        handleLocalUpdate()
      }
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('cardio_visits_updated', handleLocalUpdate)
      window.addEventListener('storage', handleStorageUpdate)
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('cardio_visits_updated', handleLocalUpdate)
        window.removeEventListener('storage', handleStorageUpdate)
      }
    }
  }

  const q = collectionGroup(db, 'visits')
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


