import {
  collection, doc, addDoc, setDoc, updateDoc, deleteDoc,
  getDoc, getDocs, query, orderBy, limit, where, collectionGroup,
  serverTimestamp, Timestamp, writeBatch, arrayUnion,
} from 'firebase/firestore'
import { db } from './firebase'
import type { Patient, PatientInput, Visit, VisitInput, PopulationStats, PatientTrends, TrendPoint, RegistryField, OutcomeEvent, OutcomeEventInput } from './types'
import { BUILT_IN_FIELDS } from './types'
import { MOCK_PATIENTS_COHORT, MOCK_VISITS_COHORT } from './seeder'

// ─── Local Storage Fallback for Offline Demo Mode ────────────────────────────

const isDemoMode = !process.env.NEXT_PUBLIC_FIREBASE_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY.startsWith('mock') || process.env.NEXT_PUBLIC_FIREBASE_API_KEY === 'undefined'

function getLocalPatients(): Patient[] {
  if (typeof window === 'undefined') return []
  const data = localStorage.getItem('cardio_patients')
  if (!data) {
    const initialPatients = Object.entries(MOCK_PATIENTS_COHORT).map(([id, p]) => {
      const comorbidities: string[] = Array.isArray(p.comorbidities) ? p.comorbidities : []
      return {
        ...p,
        id,
        comorbidities,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastVisitDate: p.lastVisitDate ? new Date(p.lastVisitDate).toISOString() : '',
      }
    }) as Patient[]
    localStorage.setItem('cardio_patients', JSON.stringify(initialPatients))
    return initialPatients
  }
  return JSON.parse(data)
}

function saveLocalPatients(pts: Patient[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem('cardio_patients', JSON.stringify(pts))
}

function getLocalVisits(): Visit[] {
  if (typeof window === 'undefined') return []
  const data = localStorage.getItem('cardio_visits')
  if (!data) {
    const initialVisits = MOCK_VISITS_COHORT.map(v => ({
      ...v.data,
      id: v.visitId,
      patientId: v.patientId,
      createdAt: new Date().toISOString(),
    })) as Visit[]
    localStorage.setItem('cardio_visits', JSON.stringify(initialVisits))
    return initialVisits
  }
  return JSON.parse(data)
}

function saveLocalVisits(vts: Visit[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem('cardio_visits', JSON.stringify(vts))
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

  const ref = await addDoc(collection(db, 'patients'), {
    ...input,
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

  await updateDoc(doc(db, 'patients', id), { ...data, updatedAt: serverTimestamp() })
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

  const patientDocRef = doc(db, 'patients', patientId)
  const patientSnap = await getDoc(patientDocRef)
  if (!patientSnap.exists()) {
    const mockDb: Record<string, any> = {
      '1': { firstName: 'Arjun', lastName: 'Talpade', dob: '1978-05-19', sex: 'Male', mrn: 'MRN-784019', contact: '+91 9823019283', address: 'Kothrud, Pune, Maharashtra', comorbidities: 'HTN, Type 2 Diabetes', allergies: 'Penicillin', createdAt: serverTimestamp(), updatedAt: serverTimestamp(), status: 'Active', email: 'arjun.talpade@gmail.com' },
      '2': { firstName: 'Sunita', lastName: 'Deshmukh', dob: '1982-11-20', sex: 'Female', mrn: 'MRN-201948', contact: '+91 9123049182', address: 'Shivajinagar, Pune, Maharashtra', comorbidities: 'Dyslipidemia', allergies: 'None', createdAt: serverTimestamp(), updatedAt: serverTimestamp(), status: 'Active', email: 'sunita.d@yahoo.com' },
      '3': { firstName: 'Ramesh', lastName: 'Kulkarni', dob: '1965-03-22', sex: 'Male', mrn: 'MRN-849102', contact: '+91 9422019283', address: 'Deccan Gymkhana, Pune, Maharashtra', comorbidities: 'CAD, Prior CABG', allergies: 'Aspirin (Mild GI)', createdAt: serverTimestamp(), updatedAt: serverTimestamp(), status: 'Active', email: 'ramesh.k@outlook.com' },
      '4': { firstName: 'Priya', lastName: 'Sharma', dob: '1990-07-23', sex: 'Female', mrn: 'MRN-102948', contact: '+91 9011029481', address: 'Aundh, Pune, Maharashtra', comorbidities: 'None', allergies: 'Sulfa drugs', createdAt: serverTimestamp(), updatedAt: serverTimestamp(), status: 'Inactive', email: 'priya.sharma@gmail.com' },
      '5': { firstName: 'Vijay', lastName: 'Mallya', dob: '1955-12-18', sex: 'Male', mrn: 'MRN-998822', contact: '+91 9890123456', address: 'Cuffe Parade, Mumbai, Maharashtra', comorbidities: 'Gout, HTN', allergies: 'None', createdAt: serverTimestamp(), updatedAt: serverTimestamp(), status: 'Active', email: 'vijay.m@gmail.com' },
      '6': { firstName: 'Ananya', lastName: 'Rao', dob: '1995-04-26', sex: 'Female', mrn: 'MRN-334455', contact: '+91 9881122334', address: 'Viman Nagar, Pune, Maharashtra', comorbidities: 'Asthma', allergies: 'None', createdAt: serverTimestamp(), updatedAt: serverTimestamp(), status: 'Active', email: 'ananya.rao@gmail.com' },
      '7': { firstName: 'Amitabh', lastName: 'Bachchan', dob: '1942-10-11', sex: 'Male', mrn: 'MRN-000777', contact: '+91 9820098200', address: 'Juhu, Mumbai, Maharashtra', comorbidities: 'COPD, Prior Angioplasty', allergies: 'None', createdAt: serverTimestamp(), updatedAt: serverTimestamp(), status: 'Active', email: 'amitabh.b@gmail.com' },
      '8': { firstName: 'Sanjay', lastName: 'More', dob: '1980-08-15', sex: 'Male', mrn: 'MRN-554432', contact: '+91 9869234857', address: 'Dadar, Mumbai, Maharashtra', comorbidities: 'CAD, STEMI post-PCI', allergies: 'None', createdAt: serverTimestamp(), updatedAt: serverTimestamp(), status: 'Active', email: 'sanjay.more@gmail.com' },
      '9': { firstName: 'Lata', lastName: 'Patwardhan', dob: '1972-02-14', sex: 'Female', mrn: 'MRN-887766', contact: '+91 9371029485', address: 'Dhantoli, Nagpur, Maharashtra', comorbidities: 'HFrEF, Chronic Kidney Disease', allergies: 'Contrast (Mild)', createdAt: serverTimestamp(), updatedAt: serverTimestamp(), status: 'Active', email: 'lata.p@gmail.com' }
    }
    if (mockDb[patientId]) {
      await setDoc(patientDocRef, mockDb[patientId])
    }
  }

  const ref = await addDoc(collection(db, 'patients', patientId, 'visits'), {
    ...input,
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

  await updateDoc(doc(db, 'patients', patientId, 'visits', visitId), {
    ...data,
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

// ─── Analytics ───────────────────────────────────────────────────────────────

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

  let visits: Visit[] = []
  if (isDemoMode) {
    visits = getLocalVisits()
  } else {
    try {
      const visitsSnap = await getDocs(collectionGroup(db, 'visits'))
      visits = visitsSnap.docs.map(doc => {
        const patientId = doc.ref.parent.parent?.id || ''
        return docToVisit(doc.id, patientId, doc.data())
      })
    } catch (e) {
      console.warn('Failed to query collectionGroup visits, using empty array:', e)
    }
  }

  const visitsByPatient: Record<string, Visit[]> = {}
  visits.forEach(v => {
    if (v.patientId) {
      if (!visitsByPatient[v.patientId]) {
        visitsByPatient[v.patientId] = []
      }
      visitsByPatient[v.patientId].push(v)
    }
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
  }
}

// ─── Settings / Configuration ────────────────────────────────────────────────

export async function getRegistryFields(): Promise<RegistryField[]> {
  if (isDemoMode) {
    if (typeof window !== 'undefined') {
      const data = localStorage.getItem('cardio_fields')
      if (data) {
        return JSON.parse(data) as RegistryField[]
      }
    }
    return BUILT_IN_FIELDS
  }

  try {
    const snap = await getDoc(doc(db, 'settings', 'registryConfig'))
    if (snap.exists()) {
      const data = snap.data()
      if (data.fields && Array.isArray(data.fields)) {
        return data.fields as RegistryField[]
      }
    }
  } catch (error) {
    console.error('Failed to get registry fields from Firestore:', error)
  }
  return BUILT_IN_FIELDS
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


