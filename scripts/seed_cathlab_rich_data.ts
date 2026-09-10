/**
 * scripts/seed_cathlab_rich_data.ts
 *
 * Populates complete, realistic dummy variables for all 5 Cath Lab / PCI patients
 * under Dr. Rajeev Chauhan at Kanpur Cardiac Apex Hospital.
 *
 * Enriches:
 *   - Patient profile attributes (Vitals, Echo, Labs, Demographics, Phenotype, Medications)
 *   - Visits subcollection (Encounter visits with longitudinal clinical metrics)
 *   - Outcome events (MACE-free tracking, 30-day review)
 *
 * Run:
 *   npx tsx scripts/seed_cathlab_rich_data.ts
 */

import * as fs from 'fs'
import * as path from 'path'
import { initializeApp, getApps } from 'firebase/app'
import {
  getFirestore, collection, getDocs, doc, setDoc, updateDoc, writeBatch, Timestamp, query, where
} from 'firebase/firestore'

// 1. Load .env.local
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
}

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'AIzaSyBl9MjJgsGqjdYqNVTQLzTgeysOSlsIF0U',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'cardio-konnect-sachin-1.firebaseapp.com',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'cardio-konnect-sachin-1',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'cardio-konnect-sachin-1.firebasestorage.app',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '855879428060',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '1:855879428060:web:4754ebe71646eb75b69119',
}

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]
const db = getFirestore(app)

interface PatientEnrichmentData {
  mrn: string
  firstName: string
  lastName: string
  age: number
  dob: string
  sex: 'Male' | 'Female'
  contact: string
  address: string
  district: string
  state: string
  pin: string
  cohortType: 'CathLab_Acute' | 'CathLab_Elective'
  primaryDoctor: string
  attendingDoctor: string
  hospitalName: string
  siteId: string
  registryId: string
  registryIds: string[]
  
  // Baseline Vitals
  bpSystolic: number
  bpDiastolic: number
  heartRate: number
  weight: number
  height: number
  bmi: number
  o2Sat: number
  
  // Clinical Phenotype
  presentation: 'STEMI' | 'NSTEMI' | 'Unstable Angina' | 'Chronic Coronary Syndrome'
  nyha: 'I' | 'II' | 'III' | 'IV'
  hfType: 'CAD_Post_PCI' | 'HFrEF' | 'HFpEF'
  indexEtiology: string[]
  killipClass: 'I' | 'II' | 'III' | 'IV'
  
  // Echo
  lvef: number
  priorLvef: number
  lvefMethod: string
  lvefModality: string
  echoDate: string
  lvdd: number
  lvsd: number
  eEPrime: number
  wallMotionAbnormality: boolean
  echNotes: string
  
  // Labs
  creatinine: number
  egfr: number
  potassium: number
  sodium: number
  hb: number
  hba1c: number
  ldl: number
  hdl: number
  triglycerides: number
  totalCholesterol: number
  platelets: number
  troponinI: number
  
  // Medications
  meds: {
    aspirin: boolean
    aspirinDose: string
    p2y12: boolean
    p2y12Drug: string
    p2y12Dose: string
    statin: boolean
    statinDrug: string
    statinDose: string
    betaBlocker: boolean
    betaBlockerDrug: string
    betaBlockerDose: string
    raasi: boolean
    raasiDrug: string
    raasiDose: string
    sglt2i: boolean
    sglt2iDrug: string
    sglt2iDose: string
    ppi: boolean
    ppiDrug: string
  }

  // Follow-up stats
  followupDate: string
  followupLvef: number
  followupBp: string
  followupNyha: 'I' | 'II'
}

const PATIENTS_DATA: PatientEnrichmentData[] = [
  // 1. Rajesh Patil
  {
    mrn: '7AFH-2026-0001',
    firstName: 'Rajesh',
    lastName: 'Patil',
    age: 58,
    dob: '1968-03-14',
    sex: 'Male',
    contact: '9839012451',
    address: '12/48 Swaroop Nagar, Near Motijheel',
    district: 'Kanpur Nagar',
    state: 'Uttar Pradesh',
    pin: '208002',
    cohortType: 'CathLab_Acute',
    primaryDoctor: 'Dr. Rajeev Chauhan',
    attendingDoctor: 'Dr. Rajeev Chauhan',
    hospitalName: 'Kanpur Cardiac Apex Hospital',
    siteId: 'KANPUR_APEX',
    registryId: 'cathlab',
    registryIds: ['cathlab'],
    
    bpSystolic: 132,
    bpDiastolic: 84,
    heartRate: 78,
    weight: 72,
    height: 170,
    bmi: 24.9,
    o2Sat: 98,
    
    presentation: 'STEMI',
    nyha: 'II',
    hfType: 'CAD_Post_PCI',
    indexEtiology: ['Ischaemic CAD'],
    killipClass: 'II',
    
    lvef: 42,
    priorLvef: 40,
    lvefMethod: 'Biplane Simpson (2D)',
    lvefModality: 'TTE',
    echoDate: '2026-08-16',
    lvdd: 52,
    lvsd: 38,
    eEPrime: 9.2,
    wallMotionAbnormality: true,
    echNotes: 'Hypokinesia of anterior and apical segments consistent with acute LAD occlusion. Post-PCI LVEF stabilized at 42%.',
    
    creatinine: 1.02,
    egfr: 84,
    potassium: 4.3,
    sodium: 138,
    hb: 14.1,
    hba1c: 6.8,
    ldl: 128,
    hdl: 38,
    triglycerides: 180,
    totalCholesterol: 202,
    platelets: 240,
    troponinI: 14.2,
    
    meds: {
      aspirin: true, aspirinDose: '75mg OD',
      p2y12: true, p2y12Drug: 'Ticagrelor', p2y12Dose: '90mg BD',
      statin: true, statinDrug: 'Atorvastatin', statinDose: '80mg HS',
      betaBlocker: true, betaBlockerDrug: 'Metoprolol Succinate', betaBlockerDose: '50mg OD',
      raasi: true, raasiDrug: 'Ramipril', raasiDose: '5mg OD',
      sglt2i: true, sglt2iDrug: 'Dapagliflozin', sglt2iDose: '10mg OD',
      ppi: true, ppiDrug: 'Pantoprazole 40mg OD'
    },
    followupDate: '2026-09-15',
    followupLvef: 48,
    followupBp: '124/78',
    followupNyha: 'I'
  },

  // 2. Sunita Sharma
  {
    mrn: '7AFH-2026-0002',
    firstName: 'Sunita',
    lastName: 'Sharma',
    age: 52,
    dob: '1974-07-22',
    sex: 'Female',
    contact: '9415128943',
    address: 'Plot 45, Sector 3, Govind Nagar',
    district: 'Kanpur Nagar',
    state: 'Uttar Pradesh',
    pin: '208006',
    cohortType: 'CathLab_Acute',
    primaryDoctor: 'Dr. Rajeev Chauhan',
    attendingDoctor: 'Dr. Rajeev Chauhan',
    hospitalName: 'Kanpur Cardiac Apex Hospital',
    siteId: 'KANPUR_APEX',
    registryId: 'cathlab',
    registryIds: ['cathlab'],
    
    bpSystolic: 124,
    bpDiastolic: 78,
    heartRate: 72,
    weight: 58,
    height: 156,
    bmi: 23.8,
    o2Sat: 99,
    
    presentation: 'NSTEMI',
    nyha: 'II',
    hfType: 'CAD_Post_PCI',
    indexEtiology: ['Ischaemic CAD'],
    killipClass: 'I',
    
    lvef: 50,
    priorLvef: 48,
    lvefMethod: 'Biplane Simpson (2D)',
    lvefModality: 'TTE',
    echoDate: '2026-08-19',
    lvdd: 48,
    lvsd: 32,
    eEPrime: 8.5,
    wallMotionAbnormality: true,
    echNotes: 'Mild anterolateral wall hypokinesia. Preserved overall systolic performance post-two-vessel stenting.',
    
    creatinine: 0.88,
    egfr: 92,
    potassium: 4.2,
    sodium: 140,
    hb: 12.4,
    hba1c: 6.1,
    ldl: 112,
    hdl: 44,
    triglycerides: 152,
    totalCholesterol: 186,
    platelets: 265,
    troponinI: 4.8,
    
    meds: {
      aspirin: true, aspirinDose: '75mg OD',
      p2y12: true, p2y12Drug: 'Prasugrel', p2y12Dose: '10mg OD',
      statin: true, statinDrug: 'Rosuvastatin', statinDose: '40mg HS',
      betaBlocker: true, betaBlockerDrug: 'Bisoprolol', betaBlockerDose: '5mg OD',
      raasi: true, raasiDrug: 'Telmisartan', raasiDose: '40mg OD',
      sglt2i: true, sglt2iDrug: 'Empagliflozin', sglt2iDose: '10mg OD',
      ppi: true, ppiDrug: 'Pantoprazole 40mg OD'
    },
    followupDate: '2026-09-18',
    followupLvef: 55,
    followupBp: '118/74',
    followupNyha: 'I'
  },

  // 3. Mohan Iyer
  {
    mrn: '7AFH-2026-0003',
    firstName: 'Mohan',
    lastName: 'Iyer',
    age: 67,
    dob: '1959-05-18',
    sex: 'Male',
    contact: '9838045129',
    address: 'B-14 Civil Lines, Near Green Park Stadium',
    district: 'Kanpur Nagar',
    state: 'Uttar Pradesh',
    pin: '208001',
    cohortType: 'CathLab_Elective',
    primaryDoctor: 'Dr. Rajeev Chauhan',
    attendingDoctor: 'Dr. Rajeev Chauhan',
    hospitalName: 'Kanpur Cardiac Apex Hospital',
    siteId: 'KANPUR_APEX',
    registryId: 'cathlab',
    registryIds: ['cathlab'],
    
    bpSystolic: 136,
    bpDiastolic: 82,
    heartRate: 68,
    weight: 74,
    height: 168,
    bmi: 26.2,
    o2Sat: 98,
    
    presentation: 'Chronic Coronary Syndrome',
    nyha: 'I',
    hfType: 'CAD_Post_PCI',
    indexEtiology: ['Ischaemic CAD'],
    killipClass: 'I',
    
    lvef: 55,
    priorLvef: 55,
    lvefMethod: 'Biplane Simpson (2D)',
    lvefModality: 'TTE',
    echoDate: '2026-08-21',
    lvdd: 50,
    lvsd: 33,
    eEPrime: 8.8,
    wallMotionAbnormality: false,
    echNotes: 'Concentric LV hypertrophy with preserved LV ejection fraction. Normal diastolic profile.',
    
    creatinine: 1.18,
    egfr: 68,
    potassium: 4.6,
    sodium: 139,
    hb: 13.6,
    hba1c: 7.2,
    ldl: 135,
    hdl: 36,
    triglycerides: 210,
    totalCholesterol: 213,
    platelets: 215,
    troponinI: 0.02,
    
    meds: {
      aspirin: true, aspirinDose: '75mg OD',
      p2y12: true, p2y12Drug: 'Clopidogrel', p2y12Dose: '75mg OD',
      statin: true, statinDrug: 'Atorvastatin', statinDose: '80mg HS',
      betaBlocker: true, betaBlockerDrug: 'Metoprolol Succinate', betaBlockerDose: '100mg OD',
      raasi: true, raasiDrug: 'Telmisartan', raasiDose: '80mg OD',
      sglt2i: true, sglt2iDrug: 'Empagliflozin', sglt2iDose: '10mg OD',
      ppi: true, ppiDrug: 'Rabeprazole 20mg OD'
    },
    followupDate: '2026-09-20',
    followupLvef: 55,
    followupBp: '126/80',
    followupNyha: 'I'
  },

  // 4. Priya Nair
  {
    mrn: '7AFH-2026-0004',
    firstName: 'Priya',
    lastName: 'Nair',
    age: 45,
    dob: '1981-11-09',
    sex: 'Female',
    contact: '9792019483',
    address: '88 Kakadeo, Near Coaching Hub',
    district: 'Kanpur Nagar',
    state: 'Uttar Pradesh',
    pin: '208025',
    cohortType: 'CathLab_Acute',
    primaryDoctor: 'Dr. Rajeev Chauhan',
    attendingDoctor: 'Dr. Rajeev Chauhan',
    hospitalName: 'Kanpur Cardiac Apex Hospital',
    siteId: 'KANPUR_APEX',
    registryId: 'cathlab',
    registryIds: ['cathlab'],
    
    bpSystolic: 118,
    bpDiastolic: 74,
    heartRate: 82,
    weight: 62,
    height: 160,
    bmi: 24.2,
    o2Sat: 97,
    
    presentation: 'STEMI',
    nyha: 'II',
    hfType: 'CAD_Post_PCI',
    indexEtiology: ['Ischaemic CAD'],
    killipClass: 'III',
    
    lvef: 45,
    priorLvef: 40,
    lvefMethod: 'Biplane Simpson (2D)',
    lvefModality: 'TTE',
    echoDate: '2026-08-25',
    lvdd: 51,
    lvsd: 36,
    eEPrime: 9.8,
    wallMotionAbnormality: true,
    echNotes: 'Inferior and posterior wall hypokinesia post-RCA CTO recanalization. TAPSE 19 mm with mild RV strain resolving.',
    
    creatinine: 1.10,
    egfr: 76,
    potassium: 4.1,
    sodium: 137,
    hb: 11.8,
    hba1c: 5.9,
    ldl: 142,
    hdl: 41,
    triglycerides: 164,
    totalCholesterol: 215,
    platelets: 285,
    troponinI: 8.6,
    
    meds: {
      aspirin: true, aspirinDose: '75mg OD',
      p2y12: true, p2y12Drug: 'Ticagrelor', p2y12Dose: '90mg BD',
      statin: true, statinDrug: 'Rosuvastatin', statinDose: '40mg HS',
      betaBlocker: true, betaBlockerDrug: 'Carvedilol', betaBlockerDose: '12.5mg BD',
      raasi: true, raasiDrug: 'Ramipril', raasiDose: '2.5mg OD',
      sglt2i: true, sglt2iDrug: 'Dapagliflozin', sglt2iDose: '10mg OD',
      ppi: true, ppiDrug: 'Pantoprazole 40mg OD'
    },
    followupDate: '2026-09-22',
    followupLvef: 50,
    followupBp: '116/72',
    followupNyha: 'I'
  },

  // 5. Vikram Desai
  {
    mrn: '7AFH-2026-0005',
    firstName: 'Vikram',
    lastName: 'Desai',
    age: 72,
    dob: '1954-01-30',
    sex: 'Male',
    contact: '9450039281',
    address: 'K-Block 102, Kidwai Nagar',
    district: 'Kanpur Nagar',
    state: 'Uttar Pradesh',
    pin: '208011',
    cohortType: 'CathLab_Acute',
    primaryDoctor: 'Dr. Rajeev Chauhan',
    attendingDoctor: 'Dr. Rajeev Chauhan',
    hospitalName: 'Kanpur Cardiac Apex Hospital',
    siteId: 'KANPUR_APEX',
    registryId: 'cathlab',
    registryIds: ['cathlab'],
    
    bpSystolic: 130,
    bpDiastolic: 76,
    heartRate: 70,
    weight: 65,
    height: 165,
    bmi: 23.9,
    o2Sat: 98,
    
    presentation: 'NSTEMI',
    nyha: 'II',
    hfType: 'CAD_Post_PCI',
    indexEtiology: ['Ischaemic CAD'],
    killipClass: 'II',
    
    lvef: 40,
    priorLvef: 38,
    lvefMethod: 'Biplane Simpson (2D)',
    lvefModality: 'TTE',
    echoDate: '2026-08-28',
    lvdd: 54,
    lvsd: 40,
    eEPrime: 10.4,
    wallMotionAbnormality: true,
    echNotes: 'Prior CABG status. Inferolateral akinesia with sclerotic aortic valve. SVG-RCA successfully revascularized.',
    
    creatinine: 1.35,
    egfr: 54,
    potassium: 4.7,
    sodium: 141,
    hb: 12.1,
    hba1c: 6.6,
    ldl: 98,
    hdl: 39,
    triglycerides: 142,
    totalCholesterol: 165,
    platelets: 195,
    troponinI: 3.4,
    
    meds: {
      aspirin: true, aspirinDose: '75mg OD',
      p2y12: true, p2y12Drug: 'Clopidogrel', p2y12Dose: '75mg OD',
      statin: true, statinDrug: 'Atorvastatin', statinDose: '40mg HS',
      betaBlocker: true, betaBlockerDrug: 'Metoprolol Succinate', betaBlockerDose: '25mg BD',
      raasi: true, raasiDrug: 'Ramipril', raasiDose: '2.5mg OD',
      sglt2i: true, sglt2iDrug: 'Dapagliflozin', sglt2iDose: '10mg OD',
      ppi: true, ppiDrug: 'Pantoprazole 40mg OD'
    },
    followupDate: '2026-09-25',
    followupLvef: 44,
    followupBp: '122/74',
    followupNyha: 'I'
  }
]

async function run() {
  console.log('Fetching existing patients in Firestore...')
  const snap = await getDocs(collection(db, 'patients'))
  console.log(`Found ${snap.size} total patients in database.`)

  const kanpurDocs = snap.docs.filter(d => {
    const data = d.data()
    return data.siteId === 'KANPUR_APEX' || data.registryId === 'cathlab' || (data.mrn && data.mrn.startsWith('7AFH'))
  })

  console.log(`Found ${kanpurDocs.length} Kanpur Cath Lab patient records to enrich:`)

  for (const docSnap of kanpurDocs) {
    const pId = docSnap.id
    const existing = docSnap.data()
    const match = PATIENTS_DATA.find(d => d.mrn === existing.mrn || d.firstName.toLowerCase() === (existing.firstName || '').toLowerCase())

    if (!match) {
      console.log(`No match for ${existing.mrn} (${existing.firstName})`)
      continue
    }

    console.log(`\n▶ Enriching Patient: ${match.firstName} ${match.lastName} (${match.mrn}) [ID: ${pId}]`)

    // 1. Update top-level patient document with all variables
    await updateDoc(doc(db, 'patients', pId), {
      firstName: match.firstName,
      lastName: match.lastName,
      age: match.age,
      dob: match.dob,
      sex: match.sex,
      contact: match.contact,
      phone: match.contact,
      address: match.address,
      addressStreet: match.address,
      addressDistrict: match.district,
      addressState: match.state,
      addressPin: match.pin,
      cohortType: match.cohortType,
      primaryDoctor: match.primaryDoctor,
      attendingDoctor: match.attendingDoctor,
      hospitalName: match.hospitalName,
      siteId: match.siteId,
      registryId: match.registryId,
      registryIds: match.registryIds,
      consentStatus: 'Granted',
      studyConsented: true,
      vitalStatus: 'Alive',
      status: 'Active',
      
      // Clinical Baseline
      bpSystolic: match.bpSystolic,
      bpDiastolic: match.bpDiastolic,
      heartRate: match.heartRate,
      weight: match.weight,
      height: match.height,
      bmi: match.bmi,
      o2Sat: match.o2Sat,
      
      presentation: match.presentation,
      nyha: match.nyha,
      hfType: match.hfType,
      indexEtiology: match.indexEtiology,
      killipClass: match.killipClass,
      
      // Echo
      lvef: match.lvef,
      priorLvef: match.priorLvef,
      lvefMethod: match.lvefMethod,
      lvefModality: match.lvefModality,
      echoDate: match.echoDate,
      lvdd: match.lvdd,
      lvsd: match.lvsd,
      eEPrime: match.eEPrime,
      wallMotionAbnormality: match.wallMotionAbnormality,
      echNotes: match.echNotes,
      
      // Labs
      creatinine: match.creatinine,
      egfr: match.egfr,
      potassium: match.potassium,
      sodium: match.sodium,
      hb: match.hb,
      hba1c: match.hba1c,
      ldl: match.ldl,
      hdl: match.hdl,
      triglycerides: match.triglycerides,
      totalCholesterol: match.totalCholesterol,
      platelets: match.platelets,
      troponinI: match.troponinI,
      
      // Secondary Prevention & DAPT Meds summary
      daptActive: true,
      daptRegimen: `Aspirin ${match.meds.aspirinDose} + ${match.meds.p2y12Drug} ${match.meds.p2y12Dose}`,
      statinActive: true,
      statinRegimen: `${match.meds.statinDrug} ${match.meds.statinDose}`,
      
      updatedAt: new Date().toISOString()
    })

    // 2. Create / Update Initial Discharge Encounter Visit
    const indexVisitId = `visit_index_${pId}`
    await setDoc(doc(db, 'patients', pId, 'visits', indexVisitId), {
      id: indexVisitId,
      patientId: pId,
      visitDate: match.echoDate,
      visitType: 'Inpatient',
      encounterType: 'Acute PCI Admission & Discharge',
      bpSystolic: match.bpSystolic,
      bpDiastolic: match.bpDiastolic,
      heartRate: match.heartRate,
      weight: match.weight,
      height: match.height,
      bmi: match.bmi,
      o2Sat: match.o2Sat,
      nyha: match.nyha,
      hfType: match.hfType,
      etiology: match.indexEtiology,
      killipClass: match.killipClass,
      
      lvef: match.lvef,
      lvefMethod: match.lvefMethod,
      lvefModality: match.lvefModality,
      echoDate: match.echoDate,
      lvdd: match.lvdd,
      lvsd: match.lvsd,
      eEPrime: match.eEPrime,
      wallMotionAbnormality: match.wallMotionAbnormality,
      
      creatinine: match.creatinine,
      egfr: match.egfr,
      potassium: match.potassium,
      sodium: match.sodium,
      hb: match.hb,
      hba1c: match.hba1c,
      ldl: match.ldl,
      hdl: match.hdl,
      triglycerides: match.triglycerides,
      totalCholesterol: match.totalCholesterol,
      platelets: match.platelets,
      troponinI: match.troponinI,
      
      // Standard GDMT & Cath Lab Medication Entries
      medArni: 'No',
      medArniReason: 'Not Indicated for Phenotype',
      medAcei: match.meds.raasi ? 'Yes' : 'No',
      medAceiDrug: match.meds.raasiDrug,
      medAceiDose: match.meds.raasiDose,
      medBetaBlocker: match.meds.betaBlocker ? 'Yes' : 'No',
      medBetaBlockerDrug: match.meds.betaBlockerDrug,
      medBetaBlockerDose: match.meds.betaBlockerDose,
      medMra: 'No',
      medMraReason: 'Not Indicated for Phenotype',
      medSglt2i: match.meds.sglt2i ? 'Yes' : 'No',
      medSglt2iDrug: match.meds.sglt2iDrug,
      medSglt2iDose: match.meds.sglt2iDose,
      
      // Secondary Prevention DAPT
      aspirinPrescribed: 'Yes',
      aspirinDose: match.meds.aspirinDose,
      p2y12Prescribed: 'Yes',
      p2y12Drug: match.meds.p2y12Drug,
      p2y12Dose: match.meds.p2y12Dose,
      statinPrescribed: 'Yes',
      statinDrug: match.meds.statinDrug,
      statinDose: match.meds.statinDose,
      
      clinicalNotes: `Successfully revascularized. Hemodynamically stable, radial puncture site clean and patent. Discharged on guideline-directed DAPT and lipid lowering therapy.`,
      createdAt: new Date().toISOString()
    })

    // 3. Create 30-Day Follow-Up Visit
    const followVisitId = `visit_30d_${pId}`
    const [followSys, followDia] = match.followupBp.split('/').map(Number)
    await setDoc(doc(db, 'patients', pId, 'visits', followVisitId), {
      id: followVisitId,
      patientId: pId,
      visitDate: match.followupDate,
      visitType: 'OPD',
      encounterType: '30-Day Post-PCI Follow-up',
      bpSystolic: followSys,
      bpDiastolic: followDia,
      heartRate: match.heartRate - 4,
      weight: match.weight,
      height: match.height,
      bmi: match.bmi,
      o2Sat: 99,
      nyha: match.followupNyha,
      hfType: match.hfType,
      etiology: match.indexEtiology,
      
      lvef: match.followupLvef,
      lvefMethod: match.lvefMethod,
      echoDate: match.followupDate,
      
      creatinine: match.creatinine - 0.04,
      egfr: match.egfr + 2,
      potassium: match.potassium,
      sodium: match.sodium,
      ldl: Math.round(match.ldl * 0.7), // 30% reduction on high-intensity statin
      hdl: match.hdl,
      
      medAcei: match.meds.raasi ? 'Yes' : 'No',
      medBetaBlocker: match.meds.betaBlocker ? 'Yes' : 'No',
      medSglt2i: match.meds.sglt2i ? 'Yes' : 'No',
      aspirinPrescribed: 'Yes',
      p2y12Prescribed: 'Yes',
      statinPrescribed: 'Yes',
      
      clinicalNotes: `30-Day Post-PCI Review: Excellent recovery. Patient reports no angina or shortness of breath. DAPT compliant. Radial artery patent.`,
      createdAt: new Date().toISOString()
    })

    // 4. Create MACE-Free Outcome Event
    const eventId = `event_30d_${pId}`
    await setDoc(doc(db, 'patients', pId, 'events', eventId), {
      id: eventId,
      patientId: pId,
      eventDate: match.followupDate,
      eventType: '30-Day MACE Adjudication',
      clinicalSummary: 'Free from Death, MI, Repeat Revascularization, Stroke, or Stent Thrombosis at 30 days post-procedure.',
      adjudicated: true,
      adjudicator: 'Dr. Rajeev Chauhan',
      status: 'Adjudicated - Confirmed',
      createdAt: new Date().toISOString()
    })

    console.log(`   ✓ Patient updated, 2 visits saved, 1 outcome event logged.`)
  }

  console.log('\n🎉 Finished populating all Cath Lab dummy variables successfully!')
}

run().catch(err => {
  console.error('Seeding error:', err)
  process.exit(1)
})
