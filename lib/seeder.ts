import { db } from './firebase'
import {
  collection, doc, getDocs, writeBatch, serverTimestamp, Timestamp
} from 'firebase/firestore'
import type { Patient, Visit } from './types'

// Helper to format date relative to today or as ISO strings
function relativeDateStr(daysAgo: number): string {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  return d.toISOString().split('T')[0]
}

const emptyMed = { prescribed: '' as const }

export async function clearAllPatients(): Promise<void> {
  const batch = writeBatch(db)
  
  // Get all patients
  const patientsSnap = await getDocs(collection(db, 'patients'))
  
  for (const patientDoc of patientsSnap.docs) {
    const pid = patientDoc.id
    
    // Delete visits subcollection
    const visitsSnap = await getDocs(collection(db, 'patients', pid, 'visits'))
    visitsSnap.docs.forEach(d => batch.delete(d.ref))
    
    // Delete patient itself
    batch.delete(patientDoc.ref)
  }
  
  await batch.commit()
}

// 1. Define Patient demographics
export const MOCK_PATIENTS_COHORT: Record<string, Omit<Patient, 'id' | 'createdAt' | 'updatedAt'>> = {
    '1': {
      firstName: 'Arjun',
      lastName: 'Talpade',
      dob: '1978-05-19',
      sex: 'Male',
      mrn: 'HID-784019',
      contact: '+91 9823019283',
      address: 'Kothrud, Pune, Maharashtra',
      comorbidities: ['HTN', 'DM2'],
      allergies: 'Penicillin',
      status: 'Active',
      email: 'arjun.talpade@gmail.com',
      visitCount: 3,
      lastVisitDate: relativeDateStr(0),
      indexDate: relativeDateStr(90)
    },
    '2': {
      firstName: 'Sunita',
      lastName: 'Deshmukh',
      dob: '1982-11-20',
      sex: 'Female',
      mrn: 'HID-201948',
      contact: '+91 9123049182',
      address: 'Shivajinagar, Pune, Maharashtra',
      comorbidities: ['Dyslipidemia'],
      allergies: 'None',
      status: 'Active',
      email: 'sunita.d@yahoo.com',
      visitCount: 2,
      lastVisitDate: relativeDateStr(1),
      indexDate: relativeDateStr(60)
    },
    '3': {
      firstName: 'Ramesh',
      lastName: 'Kulkarni',
      dob: '1965-03-22',
      sex: 'Male',
      mrn: 'HID-849102',
      contact: '+91 9422019283',
      address: 'Deccan Gymkhana, Pune, Maharashtra',
      comorbidities: ['CAD'],
      allergies: 'Aspirin (Mild GI)',
      status: 'Active',
      email: 'ramesh.k@outlook.com',
      visitCount: 2,
      lastVisitDate: relativeDateStr(2),
      indexDate: relativeDateStr(120)
    },
    '4': {
      firstName: 'Priya',
      lastName: 'Sharma',
      dob: '1990-07-23',
      sex: 'Female',
      mrn: 'HID-102948',
      contact: '+91 9011029481',
      address: 'Aundh, Pune, Maharashtra',
      comorbidities: [],
      allergies: 'Sulfa drugs',
      status: 'Inactive',
      email: 'priya.sharma@gmail.com',
      visitCount: 2,
      lastVisitDate: relativeDateStr(8),
      indexDate: relativeDateStr(180)
    },
    '5': {
      firstName: 'Vijay',
      lastName: 'Mallya',
      dob: '1955-12-18',
      sex: 'Male',
      mrn: 'HID-998822',
      contact: '+91 9890123456',
      address: 'Cuffe Parade, Mumbai, Maharashtra',
      comorbidities: ['HTN'],
      allergies: 'None',
      status: 'Active',
      email: 'vijay.m@gmail.com',
      visitCount: 2,
      lastVisitDate: relativeDateStr(3),
      indexDate: relativeDateStr(45)
    },
    '6': {
      firstName: 'Ananya',
      lastName: 'Rao',
      dob: '1995-04-26',
      sex: 'Female',
      mrn: 'HID-334455',
      contact: '+91 9881122334',
      address: 'Viman Nagar, Pune, Maharashtra',
      comorbidities: [],
      allergies: 'None',
      status: 'Active',
      email: 'ananya.rao@gmail.com',
      visitCount: 2,
      lastVisitDate: relativeDateStr(5),
      indexDate: relativeDateStr(30)
    },
    '7': {
      firstName: 'Amitabh',
      lastName: 'Bachchan',
      dob: '1942-10-11',
      sex: 'Male',
      mrn: 'HID-000777',
      contact: '+91 9820098200',
      address: 'Juhu, Mumbai, Maharashtra',
      comorbidities: ['COPD'],
      allergies: 'None',
      status: 'Active',
      email: 'amitabh.b@gmail.com',
      visitCount: 2,
      lastVisitDate: relativeDateStr(5),
      indexDate: relativeDateStr(150)
    },
    '8': {
      firstName: 'Sanjay',
      lastName: 'More',
      dob: '1980-08-15',
      sex: 'Male',
      mrn: 'HID-554432',
      contact: '+91 9869234857',
      address: 'Dadar, Mumbai, Maharashtra',
      comorbidities: ['CAD'],
      allergies: 'None',
      status: 'Active',
      email: 'sanjay.more@gmail.com',
      visitCount: 2,
      lastVisitDate: relativeDateStr(1),
      indexDate: relativeDateStr(15)
    },
    '9': {
      firstName: 'Lata',
      lastName: 'Patwardhan',
      dob: '1972-02-14',
      sex: 'Female',
      mrn: 'HID-887766',
      contact: '+91 9371029485',
      address: 'Dhantoli, Nagpur, Maharashtra',
      comorbidities: ['CKD'],
      allergies: 'Contrast (Mild)',
      status: 'Active',
      email: 'lata.p@gmail.com',
      visitCount: 2,
      lastVisitDate: relativeDateStr(0),
      indexDate: relativeDateStr(10)
    }
  }

// 2. Define longitudinal visits
export const MOCK_VISITS_COHORT: { patientId: string; visitId: string; data: Omit<Visit, 'id' | 'createdAt'> }[] = [
    // --- Arjun Talpade (HFrEF) ---
    {
      patientId: '1',
      visitId: 'v-1-1',
      data: {
        patientId: '1',
        visitDate: relativeDateStr(80),
        visitType: 'OPD',
        weight: 75,
        height: 170,
        bpSystolic: 138,
        bpDiastolic: 88,
        heartRate: 82,
        nyha: 'III',
        rhythm: 'Sinus',
        sixMWT: 320,
        lvef: 30,
        ntProBNP: 2500,
        egfr: 55,
        potassium: 4.5,
        diuretic: { prescribed: 'Yes', type: 'Furosemide', dose: '40mg OD' },
        raasi: { prescribed: 'Yes', type: 'Ramipril', dose: '5mg OD' },
        betaBlocker: { prescribed: 'Yes', type: 'Metoprolol Succinate', dose: '25mg OD' },
        mra: emptyMed,
        sglt2i: emptyMed,
        ivabradine: emptyMed,
        digoxin: emptyMed,
        ivIron: emptyMed,
        aspirin: { prescribed: 'Yes', dose: '75mg OD' },
        statin: { prescribed: 'Yes', type: 'Atorvastatin', dose: '40mg OD' },
        fibrate: emptyMed, pcsk9: emptyMed, noac: emptyMed, vki: emptyMed,
        clinicalNotes: 'Initial clinic encounter. Severe dyspnea on minimal exertion (NYHA Class III). Plan to initiate MRA and SGLT2i next visit and optimize GDMT.',
        followupDate: relativeDateStr(45)
      }
    },
    {
      patientId: '1',
      visitId: 'v-1-2',
      data: {
        patientId: '1',
        visitDate: relativeDateStr(45),
        visitType: 'OPD',
        weight: 73.5,
        height: 170,
        bpSystolic: 128,
        bpDiastolic: 82,
        heartRate: 76,
        nyha: 'II',
        rhythm: 'Sinus',
        sixMWT: 360,
        lvef: 32,
        ntProBNP: 2100,
        egfr: 56,
        potassium: 4.4,
        diuretic: { prescribed: 'Yes', type: 'Furosemide', dose: '20mg OD' },
        raasi: { prescribed: 'Yes', type: 'Ramipril', dose: '5mg OD' },
        betaBlocker: { prescribed: 'Yes', type: 'Metoprolol Succinate', dose: '50mg OD' },
        mra: { prescribed: 'Yes', type: 'Spironolactone', dose: '25mg OD' },
        sglt2i: { prescribed: 'Yes', type: 'Dapagliflozin', dose: '10mg OD' },
        ivabradine: emptyMed,
        digoxin: emptyMed,
        ivIron: emptyMed,
        aspirin: { prescribed: 'Yes', dose: '75mg OD' },
        statin: { prescribed: 'Yes', type: 'Atorvastatin', dose: '40mg OD' },
        fibrate: emptyMed, pcsk9: emptyMed, noac: emptyMed, vki: emptyMed,
        clinicalNotes: 'Doing better. Initiated Spironolactone and Dapagliflozin. Upregulated Metoprolol. Dyspnea improved to NYHA II.',
        followupDate: relativeDateStr(0)
      }
    },
    {
      patientId: '1',
      visitId: 'v-1-3',
      data: {
        patientId: '1',
        visitDate: relativeDateStr(0),
        visitType: 'OPD',
        weight: 72,
        height: 170,
        bpSystolic: 120,
        bpDiastolic: 80,
        heartRate: 72,
        nyha: 'II',
        rhythm: 'Sinus',
        sixMWT: 400,
        lvef: 35,
        ntProBNP: 1600,
        egfr: 58,
        potassium: 4.2,
        diuretic: { prescribed: 'Yes', type: 'Furosemide', dose: '20mg OD' },
        raasi: { prescribed: 'Yes', type: 'Sacubitril/Valsartan', dose: '50mg BD' },
        betaBlocker: { prescribed: 'Yes', type: 'Carvedilol', dose: '6.25mg BD' },
        mra: { prescribed: 'Yes', type: 'Spironolactone', dose: '25mg OD' },
        sglt2i: { prescribed: 'Yes', type: 'Dapagliflozin', dose: '10mg OD' },
        ivabradine: emptyMed,
        digoxin: emptyMed,
        ivIron: emptyMed,
        aspirin: { prescribed: 'Yes', dose: '75mg OD' },
        statin: { prescribed: 'Yes', type: 'Atorvastatin', dose: '40mg OD' },
        fibrate: emptyMed, pcsk9: emptyMed, noac: emptyMed, vki: emptyMed,
        clinicalNotes: 'GDMT optimized. Transitioned Ramipril to ARNI (Sacubitril/Valsartan 50mg BD). Carvedilol adjusted. LVEF improved to 35%. Patients feeling energetic.',
        followupDate: relativeDateStr(-90)
      }
    },

    // --- Sunita Deshmukh (HFpEF) ---
    {
      patientId: '2',
      visitId: 'v-2-1',
      data: {
        patientId: '2',
        visitDate: relativeDateStr(60),
        visitType: 'OPD',
        weight: 68,
        height: 158,
        bpSystolic: 142,
        bpDiastolic: 90,
        heartRate: 78,
        nyha: 'II',
        rhythm: 'Sinus',
        sixMWT: 340,
        lvef: 55,
        ntProBNP: 600,
        egfr: 65,
        potassium: 4.1,
        diuretic: { prescribed: 'Yes', type: 'Torsemide', dose: '10mg OD' },
        raasi: { prescribed: 'Yes', type: 'Telmisartan', dose: '40mg OD' },
        betaBlocker: emptyMed, mra: emptyMed, sglt2i: emptyMed, ivabradine: emptyMed, digoxin: emptyMed, ivIron: emptyMed,
        aspirin: emptyMed,
        statin: { prescribed: 'Yes', type: 'Rosuvastatin', dose: '10mg OD' },
        fibrate: emptyMed, pcsk9: emptyMed, noac: emptyMed, vki: emptyMed,
        clinicalNotes: 'Evaluated for breathlessness on exertion. Echo shows preserved ejection fraction (55%) but significant diastolic dysfunction. Plan to add SGLT2i.',
        followupDate: relativeDateStr(1)
      }
    },
    {
      patientId: '2',
      visitId: 'v-2-2',
      data: {
        patientId: '2',
        visitDate: relativeDateStr(1),
        visitType: 'OPD',
        weight: 65,
        height: 158,
        bpSystolic: 128,
        bpDiastolic: 80,
        heartRate: 70,
        nyha: 'I',
        rhythm: 'Sinus',
        sixMWT: 390,
        lvef: 58,
        ntProBNP: 450,
        egfr: 68,
        potassium: 4.3,
        diuretic: { prescribed: 'Yes', type: 'Torsemide', dose: '5mg OD' },
        raasi: { prescribed: 'Yes', type: 'Telmisartan', dose: '40mg OD' },
        betaBlocker: emptyMed, mra: emptyMed,
        sglt2i: { prescribed: 'Yes', type: 'Empagliflozin', dose: '10mg OD' },
        ivabradine: emptyMed, digoxin: emptyMed, ivIron: emptyMed,
        aspirin: emptyMed,
        statin: { prescribed: 'Yes', type: 'Rosuvastatin', dose: '10mg OD' },
        fibrate: emptyMed, pcsk9: emptyMed, noac: emptyMed, vki: emptyMed,
        clinicalNotes: 'Symptoms resolved (NYHA Class I). BP controlled. Added Empagliflozin which was well tolerated. Weight reduced by 3kg (edema cleared).',
        followupDate: relativeDateStr(-90)
      }
    },

    // --- Ramesh Kulkarni (HFrEF) ---
    {
      patientId: '3',
      visitId: 'v-3-1',
      data: {
        patientId: '3',
        visitDate: relativeDateStr(72),
        visitType: 'OPD',
        weight: 82,
        height: 172,
        bpSystolic: 115,
        bpDiastolic: 70,
        heartRate: 90,
        nyha: 'IV',
        rhythm: 'Sinus',
        sixMWT: 210,
        lvef: 25,
        ntProBNP: 3500,
        egfr: 42,
        potassium: 4.6,
        diuretic: { prescribed: 'Yes', type: 'Furosemide', dose: '80mg OD' },
        raasi: { prescribed: 'Yes', type: 'Enalapril', dose: '2.5mg BD' },
        betaBlocker: { prescribed: 'Yes', type: 'Carvedilol', dose: '3.125mg BD' },
        mra: emptyMed, sglt2i: emptyMed, ivabradine: emptyMed, digoxin: emptyMed, ivIron: emptyMed,
        aspirin: { prescribed: 'Yes', dose: '75mg OD' },
        statin: { prescribed: 'Yes', type: 'Atorvastatin', dose: '40mg OD' },
        fibrate: emptyMed, pcsk9: emptyMed, noac: emptyMed, vki: emptyMed,
        clinicalNotes: 'Post-CABG ischemic cardiomyopathy. NYHA Class IV symptoms with lower limb swelling. Initiated high dose loop diuretics. Will titrate GDMT as BP tolerates.',
        followupDate: relativeDateStr(2)
      }
    },
    {
      patientId: '3',
      visitId: 'v-3-2',
      data: {
        patientId: '3',
        visitDate: relativeDateStr(2),
        visitType: 'OPD',
        weight: 78,
        height: 172,
        bpSystolic: 118,
        bpDiastolic: 72,
        heartRate: 80,
        nyha: 'III',
        rhythm: 'Sinus',
        sixMWT: 280,
        lvef: 28,
        ntProBNP: 2800,
        egfr: 45,
        potassium: 4.5,
        diuretic: { prescribed: 'Yes', type: 'Furosemide', dose: '40mg OD' },
        raasi: { prescribed: 'Yes', type: 'Sacubitril/Valsartan', dose: '50mg BD' },
        betaBlocker: { prescribed: 'Yes', type: 'Carvedilol', dose: '6.25mg BD' },
        mra: { prescribed: 'Yes', type: 'Eplerenone', dose: '25mg OD' },
        sglt2i: { prescribed: 'Yes', type: 'Dapagliflozin', dose: '10mg OD' },
        ivabradine: emptyMed, digoxin: emptyMed, ivIron: emptyMed,
        aspirin: { prescribed: 'Yes', dose: '75mg OD' },
        statin: { prescribed: 'Yes', type: 'Atorvastatin', dose: '40mg OD' },
        fibrate: emptyMed, pcsk9: emptyMed, noac: emptyMed, vki: emptyMed,
        clinicalNotes: 'Clinical status stabilized to NYHA III. Lower limb edema significantly improved. Successfully switched Enalapril to low-dose ARNI and added Eplerenone + Dapagliflozin.',
        followupDate: relativeDateStr(-60)
      }
    },

    // --- Priya Sharma (HFmrEF) ---
    {
      patientId: '4',
      visitId: 'v-4-1',
      data: {
        patientId: '4',
        visitDate: relativeDateStr(53),
        visitType: 'OPD',
        weight: 58,
        height: 162,
        bpSystolic: 130,
        bpDiastolic: 82,
        heartRate: 75,
        nyha: 'II',
        rhythm: 'Sinus',
        sixMWT: 380,
        lvef: 42,
        ntProBNP: 950,
        egfr: 75,
        potassium: 4.2,
        diuretic: { prescribed: 'Yes', type: 'Furosemide', dose: '20mg OD' },
        raasi: { prescribed: 'Yes', type: 'Lisinopril', dose: '5mg OD' },
        betaBlocker: { prescribed: 'Yes', type: 'Bisoprolol', dose: '2.5mg OD' },
        mra: emptyMed, sglt2i: emptyMed, ivabradine: emptyMed, digoxin: emptyMed, ivIron: emptyMed,
        aspirin: emptyMed, statin: emptyMed, fibrate: emptyMed, pcsk9: emptyMed, noac: emptyMed, vki: emptyMed,
        clinicalNotes: 'Mild HFmrEF post-viral myocarditis. Good baseline function. On low-dose Lisinopril and Bisoprolol.',
        followupDate: relativeDateStr(8)
      }
    },
    {
      patientId: '4',
      visitId: 'v-4-2',
      data: {
        patientId: '4',
        visitDate: relativeDateStr(8),
        visitType: 'OPD',
        weight: 57,
        height: 162,
        bpSystolic: 122,
        bpDiastolic: 76,
        heartRate: 72,
        nyha: 'II',
        rhythm: 'Sinus',
        sixMWT: 410,
        lvef: 46,
        ntProBNP: 700,
        egfr: 78,
        potassium: 4.4,
        diuretic: { prescribed: 'Yes', type: 'Furosemide', dose: '20mg OD' },
        raasi: { prescribed: 'Yes', type: 'Lisinopril', dose: '5mg OD' },
        betaBlocker: { prescribed: 'Yes', type: 'Bisoprolol', dose: '5mg OD' },
        mra: emptyMed,
        sglt2i: { prescribed: 'Yes', type: 'Empagliflozin', dose: '10mg OD' },
        ivabradine: emptyMed, digoxin: emptyMed, ivIron: emptyMed,
        aspirin: emptyMed, statin: emptyMed, fibrate: emptyMed, pcsk9: emptyMed, noac: emptyMed, vki: emptyMed,
        clinicalNotes: 'Stable. Upregulated Bisoprolol to 5mg. Initiated SGLT2i (Empagliflozin 10mg) for HFmrEF benefit. Patient inactive due to relocation (marked inactive in registry).',
        followupDate: relativeDateStr(-90)
      }
    },

    // --- Vijay Mallya (HFrEF) ---
    {
      patientId: '5',
      visitId: 'v-5-1',
      data: {
        patientId: '5',
        visitDate: relativeDateStr(40),
        visitType: 'OPD',
        weight: 88,
        height: 178,
        bpSystolic: 135,
        bpDiastolic: 85,
        heartRate: 72,
        nyha: 'II',
        rhythm: 'Sinus',
        sixMWT: 350,
        lvef: 35,
        ntProBNP: 1800,
        egfr: 60,
        potassium: 4.3,
        diuretic: { prescribed: 'Yes', type: 'Furosemide', dose: '40mg OD' },
        raasi: { prescribed: 'Yes', type: 'Ramipril', dose: '5mg OD' },
        betaBlocker: { prescribed: 'Yes', type: 'Carvedilol', dose: '6.25mg BD' },
        mra: { prescribed: 'Yes', type: 'Spironolactone', dose: '25mg OD' },
        sglt2i: emptyMed, ivabradine: emptyMed, digoxin: emptyMed, ivIron: emptyMed,
        aspirin: emptyMed,
        statin: { prescribed: 'Yes', type: 'Atorvastatin', dose: '20mg OD' },
        fibrate: emptyMed, pcsk9: emptyMed, noac: emptyMed, vki: emptyMed,
        clinicalNotes: 'Established HFrEF. Adherent to baseline triple therapy. Plan to optimize beta-blocker dose and add SGLT2i next.',
        followupDate: relativeDateStr(3)
      }
    },
    {
      patientId: '5',
      visitId: 'v-5-2',
      data: {
        patientId: '5',
        visitDate: relativeDateStr(3),
        visitType: 'OPD',
        weight: 86,
        height: 178,
        bpSystolic: 125,
        bpDiastolic: 80,
        heartRate: 68,
        nyha: 'II',
        rhythm: 'Sinus',
        sixMWT: 390,
        lvef: 38,
        ntProBNP: 1400,
        egfr: 62,
        potassium: 4.4,
        diuretic: { prescribed: 'Yes', type: 'Furosemide', dose: '40mg OD' },
        raasi: { prescribed: 'Yes', type: 'Ramipril', dose: '10mg OD' },
        betaBlocker: { prescribed: 'Yes', type: 'Carvedilol', dose: '12.5mg BD' },
        mra: { prescribed: 'Yes', type: 'Spironolactone', dose: '25mg OD' },
        sglt2i: { prescribed: 'Yes', type: 'Dapagliflozin', dose: '10mg OD' },
        ivabradine: emptyMed, digoxin: emptyMed, ivIron: emptyMed,
        aspirin: emptyMed,
        statin: { prescribed: 'Yes', type: 'Atorvastatin', dose: '20mg OD' },
        fibrate: emptyMed, pcsk9: emptyMed, noac: emptyMed, vki: emptyMed,
        clinicalNotes: 'BP well-controlled. Ramipril increased to 10mg. Carvedilol doubled to 12.5mg BD. Dapagliflozin added. Weight reduced. Good progress.',
        followupDate: relativeDateStr(-60)
      }
    },

    // --- Ananya Rao (HFpEF) ---
    {
      patientId: '6',
      visitId: 'v-6-1',
      data: {
        patientId: '6',
        visitDate: relativeDateStr(35),
        visitType: 'OPD',
        weight: 54,
        height: 160,
        bpSystolic: 128,
        bpDiastolic: 82,
        heartRate: 76,
        nyha: 'II',
        rhythm: 'Sinus',
        sixMWT: 380,
        lvef: 60,
        ntProBNP: 500,
        egfr: 85,
        potassium: 4.0,
        diuretic: { prescribed: 'Yes', type: 'Hydrochlorothiazide', dose: '12.5mg OD' },
        raasi: { prescribed: 'Yes', type: 'Losartan', dose: '50mg OD' },
        betaBlocker: emptyMed, mra: emptyMed, sglt2i: emptyMed, ivabradine: emptyMed, digoxin: emptyMed, ivIron: emptyMed,
        aspirin: emptyMed, statin: emptyMed, fibrate: emptyMed, pcsk9: emptyMed, noac: emptyMed, vki: emptyMed,
        clinicalNotes: 'HFpEF with mild dyspnea and hypertension. Echo shows LVEF 60% with Grade I diastolic dysfunction.',
        followupDate: relativeDateStr(5)
      }
    },
    {
      patientId: '6',
      visitId: 'v-6-2',
      data: {
        patientId: '6',
        visitDate: relativeDateStr(5),
        visitType: 'OPD',
        weight: 52,
        height: 160,
        bpSystolic: 118,
        bpDiastolic: 74,
        heartRate: 70,
        nyha: 'I',
        rhythm: 'Sinus',
        sixMWT: 420,
        lvef: 62,
        ntProBNP: 350,
        egfr: 88,
        potassium: 4.2,
        diuretic: { prescribed: 'Yes', type: 'Hydrochlorothiazide', dose: '12.5mg OD' },
        raasi: { prescribed: 'Yes', type: 'Losartan', dose: '50mg OD' },
        betaBlocker: emptyMed, mra: emptyMed, sglt2i: emptyMed, ivabradine: emptyMed, digoxin: emptyMed, ivIron: emptyMed,
        aspirin: emptyMed, statin: emptyMed, fibrate: emptyMed, pcsk9: emptyMed, noac: emptyMed, vki: emptyMed,
        clinicalNotes: 'Perfect compliance. Blood pressure target reached. Breathlessness fully resolved.',
        followupDate: relativeDateStr(-90)
      }
    },

    // --- Amitabh Bachchan (HFrEF) ---
    {
      patientId: '7',
      visitId: 'v-7-1',
      data: {
        patientId: '7',
        visitDate: relativeDateStr(85),
        visitType: 'OPD',
        weight: 78,
        height: 182,
        bpSystolic: 120,
        bpDiastolic: 78,
        heartRate: 85,
        nyha: 'III',
        rhythm: 'Sinus',
        sixMWT: 300,
        lvef: 32,
        ntProBNP: 2200,
        egfr: 50,
        potassium: 4.4,
        diuretic: { prescribed: 'Yes', type: 'Furosemide', dose: '40mg OD' },
        raasi: { prescribed: 'Yes', type: 'Sacubitril/Valsartan', dose: '50mg BD' },
        betaBlocker: { prescribed: 'Yes', type: 'Carvedilol', dose: '6.25mg BD' },
        mra: emptyMed, sglt2i: emptyMed, ivabradine: emptyMed, digoxin: emptyMed, ivIron: emptyMed,
        aspirin: { prescribed: 'Yes', dose: '75mg OD' },
        statin: { prescribed: 'Yes', type: 'Rosuvastatin', dose: '20mg OD' },
        fibrate: emptyMed, pcsk9: emptyMed, noac: emptyMed, vki: emptyMed,
        clinicalNotes: 'Ischemic cardiomyopathy. Breathlessness on slight activity. Started on ARNI (Sacubitril/Valsartan) and beta blocker. Will check labs before adding MRA.',
        followupDate: relativeDateStr(5)
      }
    },
    {
      patientId: '7',
      visitId: 'v-7-2',
      data: {
        patientId: '7',
        visitDate: relativeDateStr(5),
        visitType: 'OPD',
        weight: 76,
        height: 182,
        bpSystolic: 118,
        bpDiastolic: 74,
        heartRate: 72,
        nyha: 'II',
        rhythm: 'Sinus',
        sixMWT: 350,
        lvef: 35,
        ntProBNP: 1700,
        egfr: 53,
        potassium: 4.5,
        diuretic: { prescribed: 'Yes', type: 'Furosemide', dose: '20mg OD' },
        raasi: { prescribed: 'Yes', type: 'Sacubitril/Valsartan', dose: '50mg BD' },
        betaBlocker: { prescribed: 'Yes', type: 'Carvedilol', dose: '12.5mg BD' },
        mra: { prescribed: 'Yes', type: 'Spironolactone', dose: '25mg OD' },
        sglt2i: { prescribed: 'Yes', type: 'Dapagliflozin', dose: '10mg OD' },
        ivabradine: emptyMed, digoxin: emptyMed, ivIron: emptyMed,
        aspirin: { prescribed: 'Yes', dose: '75mg OD' },
        statin: { prescribed: 'Yes', type: 'Rosuvastatin', dose: '20mg OD' },
        fibrate: emptyMed, pcsk9: emptyMed, noac: emptyMed, vki: emptyMed,
        clinicalNotes: 'Improved to NYHA II. Added Spironolactone and Dapagliflozin to finalize all 4 pillars of GDMT. Carvedilol optimized. Stable.',
        followupDate: relativeDateStr(-90)
      }
    },

    // --- Sanjay More (HFrEF) ---
    {
      patientId: '8',
      visitId: 'v-8-1',
      data: {
        patientId: '8',
        visitDate: relativeDateStr(51),
        visitType: 'OPD',
        weight: 70,
        height: 168,
        bpSystolic: 110,
        bpDiastolic: 70,
        heartRate: 82,
        nyha: 'III',
        rhythm: 'Sinus',
        sixMWT: 310,
        lvef: 28,
        ntProBNP: 2800,
        egfr: 68,
        potassium: 4.1,
        diuretic: { prescribed: 'Yes', type: 'Furosemide', dose: '40mg OD' },
        raasi: { prescribed: 'Yes', type: 'Lisinopril', dose: '5mg OD' },
        betaBlocker: { prescribed: 'Yes', type: 'Metoprolol Succinate', dose: '25mg OD' },
        mra: emptyMed, sglt2i: emptyMed, ivabradine: emptyMed, digoxin: emptyMed, ivIron: emptyMed,
        aspirin: { prescribed: 'Yes', dose: '75mg OD' },
        statin: { prescribed: 'Yes', type: 'Atorvastatin', dose: '40mg OD' },
        fibrate: emptyMed, pcsk9: emptyMed, noac: emptyMed, vki: emptyMed,
        clinicalNotes: 'Non-ischemic dilated cardiomyopathy. NYHA Class III. Plan to titrate Metoprolol and introduce MRA + SGLT2i on follow-up.',
        followupDate: relativeDateStr(1)
      }
    },
    {
      patientId: '8',
      visitId: 'v-8-2',
      data: {
        patientId: '8',
        visitDate: relativeDateStr(1),
        visitType: 'OPD',
        weight: 68,
        height: 168,
        bpSystolic: 112,
        bpDiastolic: 72,
        heartRate: 74,
        nyha: 'II',
        rhythm: 'Sinus',
        sixMWT: 370,
        lvef: 32,
        ntProBNP: 2100,
        egfr: 70,
        potassium: 4.3,
        diuretic: { prescribed: 'Yes', type: 'Furosemide', dose: '20mg OD' },
        raasi: { prescribed: 'Yes', type: 'Lisinopril', dose: '10mg OD' },
        betaBlocker: { prescribed: 'Yes', type: 'Metoprolol Succinate', dose: '50mg OD' },
        mra: { prescribed: 'Yes', type: 'Spironolactone', dose: '25mg OD' },
        sglt2i: { prescribed: 'Yes', type: 'Empagliflozin', dose: '10mg OD' },
        ivabradine: emptyMed, digoxin: emptyMed, ivIron: emptyMed,
        aspirin: { prescribed: 'Yes', dose: '75mg OD' },
        statin: { prescribed: 'Yes', type: 'Atorvastatin', dose: '40mg OD' },
        fibrate: emptyMed, pcsk9: emptyMed, noac: emptyMed, vki: emptyMed,
        clinicalNotes: 'Improved to NYHA II. Added Spironolactone and Empagliflozin. Lisinopril and Metoprolol upregulated. Excellent response with weight stability.',
        followupDate: relativeDateStr(-60)
      }
    },

    // --- Lata Patwardhan (HFrEF) ---
    {
      patientId: '9',
      visitId: 'v-9-1',
      data: {
        patientId: '9',
        visitDate: relativeDateStr(48),
        visitType: 'OPD',
        weight: 62,
        height: 155,
        bpSystolic: 122,
        bpDiastolic: 76,
        heartRate: 80,
        nyha: 'III',
        rhythm: 'Sinus',
        sixMWT: 290,
        lvef: 30,
        ntProBNP: 2400,
        egfr: 46,
        potassium: 4.5,
        diuretic: { prescribed: 'Yes', type: 'Furosemide', dose: '40mg OD' },
        raasi: { prescribed: 'Yes', type: 'Ramipril', dose: '2.5mg OD' },
        betaBlocker: { prescribed: 'Yes', type: 'Carvedilol', dose: '3.125mg BD' },
        mra: emptyMed, sglt2i: emptyMed, ivabradine: emptyMed, digoxin: emptyMed, ivIron: emptyMed,
        aspirin: emptyMed,
        statin: { prescribed: 'Yes', type: 'Atorvastatin', dose: '20mg OD' },
        fibrate: emptyMed, pcsk9: emptyMed, noac: emptyMed, vki: emptyMed,
        clinicalNotes: 'Female patient with diabetic cardiomyopathy and HFrEF. Shortness of breath on mild activity. Plan to increase Carvedilol and add Spironolactone + SGLT2i.',
        followupDate: relativeDateStr(0)
      }
    },
    {
      patientId: '9',
      visitId: 'v-9-2',
      data: {
        patientId: '9',
        visitDate: relativeDateStr(0),
        visitType: 'OPD',
        weight: 60,
        height: 155,
        bpSystolic: 118,
        bpDiastolic: 72,
        heartRate: 72,
        nyha: 'II',
        rhythm: 'Sinus',
        sixMWT: 340,
        lvef: 33,
        ntProBNP: 1900,
        egfr: 48,
        potassium: 4.6,
        diuretic: { prescribed: 'Yes', type: 'Furosemide', dose: '20mg OD' },
        raasi: { prescribed: 'Yes', type: 'Ramipril', dose: '5mg OD' },
        betaBlocker: { prescribed: 'Yes', type: 'Carvedilol', dose: '6.25mg BD' },
        mra: { prescribed: 'Yes', type: 'Spironolactone', dose: '25mg OD' },
        sglt2i: { prescribed: 'Yes', type: 'Dapagliflozin', dose: '10mg OD' },
        ivabradine: emptyMed, digoxin: emptyMed, ivIron: emptyMed,
        aspirin: emptyMed,
        statin: { prescribed: 'Yes', type: 'Atorvastatin', dose: '20mg OD' },
        fibrate: emptyMed, pcsk9: emptyMed, noac: emptyMed, vki: emptyMed,
        clinicalNotes: 'NYHA symptoms reduced to Class II. Diuretic dose reduced. Ramipril and Carvedilol titrated up. Spironolactone and Dapagliflozin initiated safely.',
        followupDate: relativeDateStr(-90)
      }
    }
  ]

// 3. Enrich mock cohorts with the new Heart Failure Registry variables
Object.keys(MOCK_PATIENTS_COHORT).forEach(id => {
  const p = MOCK_PATIENTS_COHORT[id]
  MOCK_PATIENTS_COHORT[id] = {
    ...p,
    registryId: 'hf',
    indianCitizen: true,
    studyConsented: p.status === 'Active',
    hfConfirmationDate: relativeDateStr(120),
    educationYears: id === '7' ? 15 : id === '3' ? 8 : 12,
    aadhaarNo: `9876-5432-100${id}`,
    addressHouse: `House No. ${10 + Number(id)}`,
    addressStreet: 'Main Road',
    addressPost: 'GPO',
    addressDistrict: 'Pune',
    addressState: 'Maharashtra',
    addressPin: '411001',
    secondaryContact: '+91 9800000000',
    caregiverContact: '+91 9900000000',
    caregiverSecondaryContact: '+91 9911111111'
  }
})

MOCK_VISITS_COHORT.forEach(v => {
  const isSevere = v.data.nyha === 'III' || v.data.nyha === 'IV'
  v.data = {
    ...v.data,
    symptomDyspnea: true,
    symptomFatigue: true,
    symptomEdema: isSevere,
    symptomPalpitation: Math.random() > 0.5,
    symptomAngina: Math.random() > 0.6,
    symptomAscites: v.data.nyha === 'IV',
    signLungRales: isSevere,
    signPleuralEffusion: v.data.nyha === 'IV',
    signElevatedJVP: isSevere,
    signS3: v.data.nyha === 'IV',
    signDependentEdema: isSevere,
    signHepatomegaly: v.data.nyha === 'IV',
    signCardiomegaly: isSevere,
    jvpStatus: isSevere ? 'Elevated' : 'Not elevated',
    ventricularArrhythmia: v.data.nyha === 'IV' && Math.random() > 0.5,
    peakTropT: Math.random() > 0.5 ? 18 : 10,
    tropTPositive: Math.random() > 0.7,
    peakTropI: Math.random() > 0.5 ? 0.05 : 0.01,
    tropIPositive: Math.random() > 0.7,
    serumUrea: Math.floor(30 + Math.random() * 40),
    bun: Math.floor(10 + Math.random() * 20),
    bnpDischarge: v.data.bnp ? Math.floor(v.data.bnp * 0.7) : undefined,
    ntProBnpDischarge: v.data.ntProBNP ? Math.floor(v.data.ntProBNP * 0.7) : undefined,
    ventilationSupport: v.data.nyha === 'IV' ? 'NIV' : 'No',
    mcsSupport: 'No',
    weightDischarge: v.data.weight ? v.data.weight - 2 : undefined,
    dischargeOutcome: 'Discharge',
    causeOfDeath: '',
    lastHospDate: v.data.hospHistory === 'Yes' ? relativeDateStr(180) : ''
  } as any
})

export async function seedDemoData(): Promise<void> {
  const isDemoMode = !process.env.NEXT_PUBLIC_FIREBASE_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY.startsWith('mock') || process.env.NEXT_PUBLIC_FIREBASE_API_KEY === 'undefined'
  if (isDemoMode) {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('cardio_patients')
      localStorage.removeItem('cardio_visits')
    }
    return
  }

  // Real Firestore seeding
  await clearAllPatients()

  const batch = writeBatch(db)

  // Set patient documents
  Object.entries(MOCK_PATIENTS_COHORT).forEach(([id, data]) => {
    const ref = doc(db, 'patients', id)
    batch.set(ref, {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    })
  })

  // Add visits in subcollection for each patient
  MOCK_VISITS_COHORT.forEach(({ patientId, visitId, data }) => {
    const ref = doc(db, 'patients', patientId, 'visits', visitId)
    batch.set(ref, {
      ...data,
      createdAt: serverTimestamp()
    })
  })

  // Commit writes
  await batch.commit()
}
