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
    },
    '10': {
      firstName: 'Rajesh',
      lastName: 'Kumar',
      dob: '1967-04-12',
      sex: 'Male',
      mrn: 'HID-674012',
      contact: '+91 9832019485',
      address: 'Kothrud, Pune, Maharashtra',
      comorbidities: ['HTN', 'DM2', 'CAD'],
      allergies: 'None',
      status: 'Active',
      email: 'rajesh.kumar@gmail.com',
      visitCount: 2,
      lastVisitDate: relativeDateStr(0),
      indexDate: relativeDateStr(120)
    },
    '11': {
      firstName: 'Meera',
      lastName: 'Nair',
      dob: '1959-09-08',
      sex: 'Female',
      mrn: 'HID-590908',
      contact: '+91 9123849102',
      address: 'Powai, Mumbai, Maharashtra',
      comorbidities: ['HTN', 'Dyslipidemia'],
      allergies: 'None',
      status: 'Active',
      email: 'meera.nair@yahoo.com',
      visitCount: 2,
      lastVisitDate: relativeDateStr(2),
      indexDate: relativeDateStr(90)
    },
    '12': {
      firstName: 'Vikram',
      lastName: 'Singh',
      dob: '1981-11-15',
      sex: 'Male',
      mrn: 'HID-811115',
      contact: '+91 9422910394',
      address: 'Aundh, Pune, Maharashtra',
      comorbidities: ['HTN'],
      allergies: 'Sulfa drugs',
      status: 'Active',
      email: 'vikram.singh@outlook.com',
      visitCount: 2,
      lastVisitDate: relativeDateStr(1),
      indexDate: relativeDateStr(60)
    },
    '13': {
      firstName: 'Kavitha',
      lastName: 'Krishnan',
      dob: '1954-06-22',
      sex: 'Female',
      mrn: 'HID-540622',
      contact: '+91 9011928374',
      address: 'Dhantoli, Nagpur, Maharashtra',
      comorbidities: ['DM2', 'CKD'],
      allergies: 'None',
      status: 'Active',
      email: 'kavitha.k@gmail.com',
      visitCount: 2,
      lastVisitDate: relativeDateStr(3),
      indexDate: relativeDateStr(150)
    },
    '14': {
      firstName: 'Devendra',
      lastName: 'Patel',
      dob: '1963-02-14',
      sex: 'Male',
      mrn: 'HID-630214',
      contact: '+91 9890982341',
      address: 'Dadar, Mumbai, Maharashtra',
      comorbidities: ['HTN', 'CAD', 'CKD'],
      allergies: 'None',
      status: 'Active',
      email: 'devendra.patel@gmail.com',
      visitCount: 2,
      lastVisitDate: relativeDateStr(0),
      indexDate: relativeDateStr(45)
    },
    '15': {
      firstName: 'Sneha',
      lastName: 'Reddy',
      dob: '1972-07-28',
      sex: 'Female',
      mrn: 'HID-720728',
      contact: '+91 9371092834',
      address: 'Viman Nagar, Pune, Maharashtra',
      comorbidities: ['HTN'],
      allergies: 'Aspirin',
      status: 'Active',
      email: 'sneha.reddy@gmail.com',
      visitCount: 2,
      lastVisitDate: relativeDateStr(5),
      indexDate: relativeDateStr(30)
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
    },
    // --- Rajesh Kumar (HFrEF) ---
    {
      patientId: '10',
      visitId: 'v-10-1',
      data: {
        patientId: '10',
        visitDate: relativeDateStr(100),
        visitType: 'OPD',
        weight: 78,
        height: 168,
        bpSystolic: 130,
        bpDiastolic: 85,
        heartRate: 85,
        nyha: 'III',
        rhythm: 'Sinus',
        sixMWT: 310,
        lvef: 28,
        ntProBNP: 2200,
        egfr: 50,
        potassium: 4.5,
        diuretic: { prescribed: 'Yes', type: 'Furosemide', dose: '40mg OD' },
        raasi: { prescribed: 'Yes', type: 'Lisinopril', dose: '5mg OD' },
        betaBlocker: { prescribed: 'Yes', type: 'Metoprolol Succinate', dose: '25mg OD' },
        mra: emptyMed, sglt2i: emptyMed, ivabradine: emptyMed, digoxin: emptyMed, ivIron: emptyMed,
        aspirin: { prescribed: 'Yes', dose: '75mg OD' },
        statin: { prescribed: 'Yes', type: 'Atorvastatin', dose: '40mg OD' },
        fibrate: emptyMed, pcsk9: emptyMed, noac: emptyMed, vki: emptyMed,
        clinicalNotes: 'First registry OPD consult. Diagnosed with ischemic HFrEF. Shortness of breath on mild exertion.',
        followupDate: relativeDateStr(0)
      }
    },
    {
      patientId: '10',
      visitId: 'v-10-2',
      data: {
        patientId: '10',
        visitDate: relativeDateStr(0),
        visitType: 'OPD',
        weight: 76,
        height: 168,
        bpSystolic: 115,
        bpDiastolic: 75,
        heartRate: 72,
        nyha: 'II',
        rhythm: 'Sinus',
        sixMWT: 360,
        lvef: 30,
        ntProBNP: 1800,
        egfr: 52,
        potassium: 4.3,
        diuretic: { prescribed: 'Yes', type: 'Furosemide', dose: '20mg OD' },
        raasi: { prescribed: 'Yes', type: 'Lisinopril', dose: '10mg OD' },
        betaBlocker: { prescribed: 'Yes', type: 'Metoprolol Succinate', dose: '50mg OD' },
        mra: { prescribed: 'Yes', type: 'Spironolactone', dose: '25mg OD' },
        sglt2i: { prescribed: 'Yes', type: 'Dapagliflozin', dose: '10mg OD' },
        ivabradine: emptyMed, digoxin: emptyMed, ivIron: emptyMed,
        aspirin: { prescribed: 'Yes', dose: '75mg OD' },
        statin: { prescribed: 'Yes', type: 'Atorvastatin', dose: '40mg OD' },
        fibrate: emptyMed, pcsk9: emptyMed, noac: emptyMed, vki: emptyMed,
        clinicalNotes: 'Good clinical progress. Added Dapagliflozin and Spironolactone to optimize GDMT.',
        followupDate: relativeDateStr(-90)
      }
    },
    // --- Meera Nair (HFpEF) ---
    {
      patientId: '11',
      visitId: 'v-11-1',
      data: {
        patientId: '11',
        visitDate: relativeDateStr(60),
        visitType: 'OPD',
        weight: 66,
        height: 156,
        bpSystolic: 145,
        bpDiastolic: 92,
        heartRate: 74,
        nyha: 'II',
        rhythm: 'Sinus',
        sixMWT: 330,
        lvef: 52,
        ntProBNP: 520,
        egfr: 65,
        potassium: 4.2,
        diuretic: { prescribed: 'Yes', type: 'Torsemide', dose: '10mg OD' },
        raasi: { prescribed: 'Yes', type: 'Telmisartan', dose: '40mg OD' },
        betaBlocker: emptyMed, mra: emptyMed, sglt2i: emptyMed, ivabradine: emptyMed, digoxin: emptyMed, ivIron: emptyMed,
        aspirin: emptyMed,
        statin: { prescribed: 'Yes', type: 'Rosuvastatin', dose: '10mg OD' },
        fibrate: emptyMed, pcsk9: emptyMed, noac: emptyMed, vki: emptyMed,
        clinicalNotes: 'Presents with exertional dyspnea. Echo shows preserved ejection fraction but signs of diastolic dysfunction.',
        followupDate: relativeDateStr(2)
      }
    },
    {
      patientId: '11',
      visitId: 'v-11-2',
      data: {
        patientId: '11',
        visitDate: relativeDateStr(2),
        visitType: 'OPD',
        weight: 64,
        height: 156,
        bpSystolic: 132,
        bpDiastolic: 80,
        heartRate: 70,
        nyha: 'II',
        rhythm: 'Sinus',
        sixMWT: 375,
        lvef: 55,
        ntProBNP: 410,
        egfr: 67,
        potassium: 4.4,
        diuretic: { prescribed: 'Yes', type: 'Torsemide', dose: '5mg OD' },
        raasi: { prescribed: 'Yes', type: 'Telmisartan', dose: '40mg OD' },
        betaBlocker: emptyMed, mra: emptyMed,
        sglt2i: { prescribed: 'Yes', type: 'Empagliflozin', dose: '10mg OD' },
        ivabradine: emptyMed, digoxin: emptyMed, ivIron: emptyMed,
        aspirin: emptyMed,
        statin: { prescribed: 'Yes', type: 'Rosuvastatin', dose: '10mg OD' },
        fibrate: emptyMed, pcsk9: emptyMed, noac: emptyMed, vki: emptyMed,
        clinicalNotes: 'Blood pressure improved. Initiated Empagliflozin for outcome benefit.',
        followupDate: relativeDateStr(-90)
      }
    },
    // --- Vikram Singh (HFrEF) ---
    {
      patientId: '12',
      visitId: 'v-12-1',
      data: {
        patientId: '12',
        visitDate: relativeDateStr(50),
        visitType: 'OPD',
        weight: 80,
        height: 175,
        bpSystolic: 122,
        bpDiastolic: 80,
        heartRate: 88,
        nyha: 'III',
        rhythm: 'Sinus',
        sixMWT: 290,
        lvef: 33,
        ntProBNP: 2100,
        egfr: 72,
        potassium: 4.1,
        diuretic: { prescribed: 'Yes', type: 'Furosemide', dose: '40mg OD' },
        raasi: { prescribed: 'Yes', type: 'Ramipril', dose: '2.5mg OD' },
        betaBlocker: { prescribed: 'Yes', type: 'Carvedilol', dose: '6.25mg BD' },
        mra: emptyMed, sglt2i: emptyMed, ivabradine: emptyMed, digoxin: emptyMed, ivIron: emptyMed,
        aspirin: emptyMed, statin: emptyMed, fibrate: emptyMed, pcsk9: emptyMed, noac: emptyMed, vki: emptyMed,
        clinicalNotes: 'Presents with fatigue and shortness of breath. Initiated ACEi and Beta-blocker.',
        followupDate: relativeDateStr(1)
      }
    },
    {
      patientId: '12',
      visitId: 'v-12-2',
      data: {
        patientId: '12',
        visitDate: relativeDateStr(1),
        visitType: 'OPD',
        weight: 78,
        height: 175,
        bpSystolic: 115,
        bpDiastolic: 72,
        heartRate: 72,
        nyha: 'II',
        rhythm: 'Sinus',
        sixMWT: 350,
        lvef: 35,
        ntProBNP: 1650,
        egfr: 75,
        potassium: 4.3,
        diuretic: { prescribed: 'Yes', type: 'Furosemide', dose: '20mg OD' },
        raasi: { prescribed: 'Yes', type: 'Ramipril', dose: '5mg OD' },
        betaBlocker: { prescribed: 'Yes', type: 'Carvedilol', dose: '12.5mg BD' },
        mra: { prescribed: 'Yes', type: 'Spironolactone', dose: '25mg OD' },
        sglt2i: { prescribed: 'Yes', type: 'Dapagliflozin', dose: '10mg OD' },
        ivabradine: emptyMed, digoxin: emptyMed, ivIron: emptyMed,
        aspirin: emptyMed, statin: emptyMed, fibrate: emptyMed, pcsk9: emptyMed, noac: emptyMed, vki: emptyMed,
        clinicalNotes: 'Stable. Uptitrated Carvedilol and added Spironolactone and Dapagliflozin.',
        followupDate: relativeDateStr(-60)
      }
    },
    // --- Kavitha Krishnan (HFmrEF) ---
    {
      patientId: '13',
      visitId: 'v-13-1',
      data: {
        patientId: '13',
        visitDate: relativeDateStr(90),
        visitType: 'OPD',
        weight: 62,
        height: 154,
        bpSystolic: 138,
        bpDiastolic: 80,
        heartRate: 80,
        nyha: 'III',
        rhythm: 'Sinus',
        sixMWT: 280,
        lvef: 44,
        ntProBNP: 1450,
        egfr: 42,
        potassium: 4.6,
        diuretic: { prescribed: 'Yes', type: 'Furosemide', dose: '40mg OD' },
        raasi: { prescribed: 'Yes', type: 'Enalapril', dose: '2.5mg BD' },
        betaBlocker: { prescribed: 'Yes', type: 'Bisoprolol', dose: '2.5mg OD' },
        mra: emptyMed, sglt2i: emptyMed, ivabradine: emptyMed, digoxin: emptyMed, ivIron: emptyMed,
        aspirin: emptyMed, statin: emptyMed, fibrate: emptyMed, pcsk9: emptyMed, noac: emptyMed, vki: emptyMed,
        clinicalNotes: 'Registry enrollment visit. Patient has CKD stage 3. Dyspnea on minimal exertion.',
        followupDate: relativeDateStr(3)
      }
    },
    {
      patientId: '13',
      visitId: 'v-13-2',
      data: {
        patientId: '13',
        visitDate: relativeDateStr(3),
        visitType: 'OPD',
        weight: 61,
        height: 154,
        bpSystolic: 125,
        bpDiastolic: 74,
        heartRate: 74,
        nyha: 'II',
        rhythm: 'Sinus',
        sixMWT: 330,
        lvef: 46,
        ntProBNP: 1100,
        egfr: 45,
        potassium: 4.5,
        diuretic: { prescribed: 'Yes', type: 'Furosemide', dose: '20mg OD' },
        raasi: { prescribed: 'Yes', type: 'Enalapril', dose: '2.5mg BD' },
        betaBlocker: { prescribed: 'Yes', type: 'Bisoprolol', dose: '2.5mg OD' },
        mra: emptyMed,
        sglt2i: { prescribed: 'Yes', type: 'Empagliflozin', dose: '10mg OD' },
        ivabradine: emptyMed, digoxin: emptyMed, ivIron: emptyMed,
        aspirin: emptyMed, statin: emptyMed, fibrate: emptyMed, pcsk9: emptyMed, noac: emptyMed, vki: emptyMed,
        clinicalNotes: 'Stable eGFR. Initiated Empagliflozin for HFmrEF pillar management.',
        followupDate: relativeDateStr(-90)
      }
    },
    // --- Devendra Patel (HFrEF) ---
    {
      patientId: '14',
      visitId: 'v-14-1',
      data: {
        patientId: '14',
        visitDate: relativeDateStr(40),
        visitType: 'OPD',
        weight: 72,
        height: 165,
        bpSystolic: 108,
        bpDiastolic: 68,
        heartRate: 95,
        nyha: 'IV',
        rhythm: 'Sinus',
        sixMWT: 180,
        lvef: 22,
        ntProBNP: 3800,
        egfr: 38,
        potassium: 4.8,
        diuretic: { prescribed: 'Yes', type: 'Furosemide', dose: '80mg OD' },
        raasi: { prescribed: 'Yes', type: 'Sacubitril/Valsartan', dose: '50mg BD' },
        betaBlocker: { prescribed: 'Yes', type: 'Carvedilol', dose: '3.125mg BD' },
        mra: emptyMed, sglt2i: emptyMed, ivabradine: emptyMed, digoxin: emptyMed, ivIron: emptyMed,
        aspirin: { prescribed: 'Yes', dose: '75mg OD' },
        statin: { prescribed: 'Yes', type: 'Atorvastatin', dose: '40mg OD' },
        fibrate: emptyMed, pcsk9: emptyMed, noac: emptyMed, vki: emptyMed,
        clinicalNotes: 'Severe HFrEF. Shortness of breath at rest, lower limb edema. High dose loops and low-dose ARNI started.',
        followupDate: relativeDateStr(0)
      }
    },
    {
      patientId: '14',
      visitId: 'v-14-2',
      data: {
        patientId: '14',
        visitDate: relativeDateStr(0),
        visitType: 'OPD',
        weight: 69,
        height: 165,
        bpSystolic: 102,
        bpDiastolic: 65,
        heartRate: 82,
        nyha: 'III',
        rhythm: 'Sinus',
        sixMWT: 240,
        lvef: 24,
        ntProBNP: 2900,
        egfr: 40,
        potassium: 4.7,
        diuretic: { prescribed: 'Yes', type: 'Furosemide', dose: '40mg OD' },
        raasi: { prescribed: 'Yes', type: 'Sacubitril/Valsartan', dose: '50mg BD' },
        betaBlocker: { prescribed: 'Yes', type: 'Carvedilol', dose: '6.25mg BD' },
        mra: { prescribed: 'Yes', type: 'Eplerenone', dose: '25mg OD' },
        sglt2i: emptyMed, ivabradine: emptyMed, digoxin: emptyMed, ivIron: emptyMed,
        aspirin: { prescribed: 'Yes', dose: '75mg OD' },
        statin: { prescribed: 'Yes', type: 'Atorvastatin', dose: '40mg OD' },
        fibrate: emptyMed, pcsk9: emptyMed, noac: emptyMed, vki: emptyMed,
        clinicalNotes: 'Edema cleared. Improved to NYHA Class III. Added Eplerenone and optimized Beta-blocker.',
        followupDate: relativeDateStr(-90)
      }
    },
    // --- Sneha Reddy (HFpEF) ---
    {
      patientId: '15',
      visitId: 'v-15-1',
      data: {
        patientId: '15',
        visitDate: relativeDateStr(30),
        visitType: 'OPD',
        weight: 58,
        height: 158,
        bpSystolic: 135,
        bpDiastolic: 82,
        heartRate: 72,
        nyha: 'II',
        rhythm: 'Sinus',
        sixMWT: 360,
        lvef: 60,
        ntProBNP: 450,
        egfr: 82,
        potassium: 4.0,
        diuretic: { prescribed: 'Yes', type: 'Hydrochlorothiazide', dose: '12.5mg OD' },
        raasi: { prescribed: 'Yes', type: 'Losartan', dose: '50mg OD' },
        betaBlocker: emptyMed, mra: emptyMed, sglt2i: emptyMed, ivabradine: emptyMed, digoxin: emptyMed, ivIron: emptyMed,
        aspirin: emptyMed, statin: emptyMed, fibrate: emptyMed, pcsk9: emptyMed, noac: emptyMed, vki: emptyMed,
        clinicalNotes: 'Exertional fatigue and breathlessness. Hypertension managed with ARB + Thiazide.',
        followupDate: relativeDateStr(5)
      }
    },
    {
      patientId: '15',
      visitId: 'v-15-2',
      data: {
        patientId: '15',
        visitDate: relativeDateStr(5),
        visitType: 'OPD',
        weight: 56,
        height: 158,
        bpSystolic: 120,
        bpDiastolic: 72,
        heartRate: 68,
        nyha: 'I',
        rhythm: 'Sinus',
        sixMWT: 410,
        lvef: 62,
        ntProBNP: 310,
        egfr: 85,
        potassium: 4.1,
        diuretic: { prescribed: 'Yes', type: 'Hydrochlorothiazide', dose: '12.5mg OD' },
        raasi: { prescribed: 'Yes', type: 'Losartan', dose: '50mg OD' },
        betaBlocker: emptyMed, mra: emptyMed,
        sglt2i: { prescribed: 'Yes', type: 'Empagliflozin', dose: '10mg OD' },
        ivabradine: emptyMed, digoxin: emptyMed, ivIron: emptyMed,
        aspirin: emptyMed, statin: emptyMed, fibrate: emptyMed, pcsk9: emptyMed, noac: emptyMed, vki: emptyMed,
        clinicalNotes: 'Blood pressure target achieved. Added Empagliflozin with resolution of symptoms (NYHA Class I).',
        followupDate: relativeDateStr(-90)
      }
    }
  ]

// --- DYNAMIC GENERATOR FOR 135 ADDITIONAL MOCK PATIENTS (TO REACH 150 TOTAL) ---
const indianMaleNames = [
  'Aarav', 'Karan', 'Sunil', 'Deepak', 'Manoj', 'Anil', 'Suresh', 'Abhishek', 'Pranav', 'Rohan',
  'Vivek', 'Sandeep', 'Ajay', 'Harish', 'Girish', 'Dinesh', 'Vinod', 'Prakash', 'Mahesh', 'Ashok',
  'Kunal', 'Rajesh', 'Sanjay', 'Rahul', 'Aditya', 'Amit', 'Vikram', 'Devendra', 'Vijay', 'Arjun',
  'Ramesh', 'Satish', 'Nitin', 'Sachin', 'Pankaj', 'Dilip', 'Santosh', 'Rajendra', 'Shashank',
  'Milind', 'Aniket', 'Suyash', 'Rohit', 'Yash', 'Parth', 'Nikhil', 'Gaurav', 'Saurabh', 'Mayur'
];
const indianFemaleNames = [
  'Sunita', 'Priya', 'Ananya', 'Lata', 'Meera', 'Kavitha', 'Sneha', 'Asha', 'Neha', 'Pooja',
  'Ritu', 'Swati', 'Geeta', 'Kiran', 'Deepa', 'Rekha', 'Radhika', 'Shalini', 'Jyoti', 'Anjali',
  'Komal', 'Preeti', 'Divya', 'Nisha', 'Rashmi', 'Kriti', 'Vidya', 'Archana', 'Nandini', 'Shruti',
  'Priyanka', 'Deepali', 'Sweta', 'Sangeeta', 'Mangal', 'Alka', 'Manisha', 'Rupali', 'Sheetal',
  'Tejaswini', 'Pallavi', 'Prachi', 'Sayali', 'Tanvi', 'Vaidehi', 'Snehal', 'Ujjwala', 'Manasi'
];
const indianLastNames = [
  'Talpade', 'Deshmukh', 'Kulkarni', 'Sharma', 'Rao', 'More', 'Patwardhan', 'Kumar', 'Nair', 'Singh',
  'Krishnan', 'Patel', 'Reddy', 'Joshi', 'Patil', 'Pawar', 'Shinde', 'Apte', 'Ranade', 'Bhide',
  'Gokhale', 'Phadke', 'Sane', 'Bapat', 'Gadgil', 'Mehta', 'Shah', 'Nayar', 'Pillai', 'Menon',
  'Iyer', 'Iyengar', 'Subramanian', 'Murthy', 'Bhat', 'Hegde', 'Prabhu', 'Borkar', 'Chavan',
  'Dabholkar', 'Gaikwad', 'Jadhav', 'Kadam', 'Mane', 'Mohite', 'Nimbalkar', 'Salunkhe', 'Sawant',
  'Tambe', 'Thorat', 'Bhosale', 'Naik', 'Wagle'
];

const locationsList = [
  { district: 'Pune', area: 'Kothrud, Pune', state: 'Maharashtra', pin: '411038' },
  { district: 'Pune', area: 'Shivajinagar, Pune', state: 'Maharashtra', pin: '411005' },
  { district: 'Pune', area: 'Deccan Gymkhana, Pune', state: 'Maharashtra', pin: '411004' },
  { district: 'Pune', area: 'Aundh, Pune', state: 'Maharashtra', pin: '411007' },
  { district: 'Pune', area: 'Viman Nagar, Pune', state: 'Maharashtra', pin: '411014' },
  { district: 'Pune', area: 'Koregaon Park, Pune', state: 'Maharashtra', pin: '411001' },
  { district: 'Pune', area: 'Hadapsar, Pune', state: 'Maharashtra', pin: '411028' },
  { district: 'Pune', area: 'Baner, Pune', state: 'Maharashtra', pin: '411045' },
  { district: 'Pune', area: 'Pimple Saudagar, Pune', state: 'Maharashtra', pin: '411027' },
  { district: 'Pune', area: 'Karve Nagar, Pune', state: 'Maharashtra', pin: '411052' },
  { district: 'Mumbai', area: 'Cuffe Parade, Mumbai', state: 'Maharashtra', pin: '400005' },
  { district: 'Mumbai', area: 'Juhu, Mumbai', state: 'Maharashtra', pin: '400049' },
  { district: 'Mumbai', area: 'Dadar, Mumbai', state: 'Maharashtra', pin: '400014' },
  { district: 'Mumbai', area: 'Powai, Mumbai', state: 'Maharashtra', pin: '400076' },
  { district: 'Mumbai', area: 'Bandra, Mumbai', state: 'Maharashtra', pin: '400050' },
  { district: 'Mumbai', area: 'Andheri, Mumbai', state: 'Maharashtra', pin: '400053' },
  { district: 'Nagpur', area: 'Dhantoli, Nagpur', state: 'Maharashtra', pin: '440012' },
  { district: 'Nagpur', area: 'Dharampeth, Nagpur', state: 'Maharashtra', pin: '440010' },
  { district: 'Nagpur', area: 'Ramdaspeth, Nagpur', state: 'Maharashtra', pin: '440010' },
];

const occupationsList = ['Farmer', 'School Teacher', 'Retired Clerk', 'Business Consultant', 'Home Maker', 'Shopkeeper', 'Engineer', 'Bank Manager', 'Driver', 'Government Servant'];
const comorbiditiesListOptions = ['HTN', 'DM2', 'CKD', 'CAD', 'Dyslipidemia', 'COPD', 'Asthma', 'Hypothyroidism'];
const allergiesListOptions = ['None', 'None', 'None', 'Penicillin', 'Sulfa drugs', 'Aspirin', 'Contrast (Mild)'];
const phenotypesList = ['HFrEF', 'HFmrEF', 'HFpEF'];

for (let i = 16; i <= 150; i++) {
  const isMale = (i % 2 === 0);
  const firstName = isMale 
    ? indianMaleNames[i % indianMaleNames.length] 
    : indianFemaleNames[i % indianFemaleNames.length];
  const lastName = indianLastNames[i % indianLastNames.length];
  const dobYear = 1940 + (i % 45);
  const dobMonth = 1 + (i % 12);
  const dobDay = 1 + (i % 28);
  const dob = `${dobYear}-${String(dobMonth).padStart(2, '0')}-${String(dobDay).padStart(2, '0')}`;
  const sex = isMale ? 'Male' : 'Female';
  const mrn = `HID-${784000 + i}`;
  const contact = `+91 98${String(20000000 + i)}`;
  const loc = locationsList[i % locationsList.length];
  const address = `${loc.area}, ${loc.state}`;
  
  const comorbiditiesCount = i % 4;
  const comorbidities: string[] = [];
  for (let c = 0; c < comorbiditiesCount; c++) {
    const com = comorbiditiesListOptions[(i + c) % comorbiditiesListOptions.length];
    if (!comorbidities.includes(com)) {
      comorbidities.push(com);
    }
  }
  const allergies = allergiesListOptions[i % allergiesListOptions.length];
  const status = i % 15 === 0 ? 'Inactive' : 'Active';
  const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@cardioplus.com`;
  
  const visit1DaysAgo = 90 + (i % 90);
  const visit2DaysAgo = i % 10;
  const phenotype = phenotypesList[i % phenotypesList.length];
  
  MOCK_PATIENTS_COHORT[String(i)] = {
    firstName,
    lastName,
    dob,
    sex,
    mrn,
    contact,
    address,
    comorbidities,
    allergies,
    status,
    email,
    visitCount: 2,
    lastVisitDate: relativeDateStr(visit2DaysAgo),
    indexDate: relativeDateStr(visit1DaysAgo),
    
    // HF Registry demographics overrides
    educationYears: 8 + (i % 9),
    abhaId: `98-7654-3210-${String(1000 + i)}`,
    occupation: occupationsList[i % occupationsList.length],
    indexEtiology: i % 2 === 0 ? ['Ischemic'] : ['Hypertension'],
    familyHistoryPrematureCVD: i % 4 === 0,
    familyHistorySuddenDeath: i % 5 === 0,
    familyHistoryCardiomyopathy: i % 6 === 0,
    familyHistoryGeneticHeart: i % 7 === 0,
    addressHouse: `Plot No. ${50 + i}`,
    addressStreet: 'Main Bazar Road',
    addressPost: 'GPO',
    addressDistrict: loc.district,
    addressState: loc.state,
    addressPin: loc.pin,
    secondaryContact: `+91 90${String(11000000 + i)}`,
    caregiverContact: `+91 99${String(33000000 + i)}`,
    caregiverSecondaryContact: `+91 99${String(44000000 + i)}`
  };

  // Generate 2 visits
  const height = isMale ? 165 + (i % 15) : 153 + (i % 12);
  const startWeight = 60 + (i % 25);
  const endWeight = startWeight - (phenotype === 'HFrEF' ? 2 : 1) - (i % 2);
  
  let lvef1 = 30;
  let lvef2 = 33;
  let nt1 = 2000;
  let nt2 = 1500;
  let nyha1: 'I' | 'II' | 'III' | 'IV' = 'III';
  let nyha2: 'I' | 'II' | 'III' | 'IV' = 'II';

  if (phenotype === 'HFrEF') {
    lvef1 = 20 + (i % 15); // 20 to 34%
    lvef2 = lvef1 + 3 + (i % 3);
    nt1 = 2200 + (i % 10) * 150;
    nt2 = 1400 + (i % 10) * 100;
    nyha1 = (i % 3 === 0) ? 'IV' : 'III';
    nyha2 = (i % 3 === 0) ? 'II' : 'I';
  } else if (phenotype === 'HFmrEF') {
    lvef1 = 41 + (i % 7); // 41 to 47%
    lvef2 = lvef1 + 2 + (i % 2);
    nt1 = 1100 + (i % 10) * 80;
    nt2 = 700 + (i % 10) * 50;
    nyha1 = 'III';
    nyha2 = 'I';
  } else {
    lvef1 = 51 + (i % 12); // 51 to 62%
    lvef2 = lvef1 + (i % 2);
    nt1 = 600 + (i % 10) * 40;
    nt2 = 400 + (i % 10) * 25;
    nyha1 = 'II';
    nyha2 = 'I';
  }

  const bpSys1 = 130 + (i % 20);
  const bpDia1 = 80 + (i % 12);
  const bpSys2 = 115 + (i % 10);
  const bpDia2 = 72 + (i % 8);
  const hr1 = 82 + (i % 12);
  const hr2 = 68 + (i % 10);
  const egfr1 = 45 + (i % 35);
  const egfr2 = egfr1 + 2 + (i % 2);
  const potassium1 = 4.0 + (i % 10) * 0.09;
  const potassium2 = 4.2 + (i % 10) * 0.06;

  const diureticType = i % 2 === 0 ? 'Furosemide' : 'Torsemide';
  const raasiType = i % 3 === 0 ? 'Sacubitril/Valsartan' : i % 3 === 1 ? 'Ramipril' : 'Telmisartan';
  const bbType = i % 2 === 0 ? 'Carvedilol' : 'Metoprolol Succinate';

  MOCK_VISITS_COHORT.push(
    {
      patientId: String(i),
      visitId: `v-${i}-1`,
      data: {
        patientId: String(i),
        visitDate: relativeDateStr(visit1DaysAgo),
        visitType: 'OPD',
        weight: startWeight,
        height,
        bpSystolic: bpSys1,
        bpDiastolic: bpDia1,
        heartRate: hr1,
        nyha: nyha1,
        rhythm: 'Sinus',
        sixMWT: 250 + (i % 150),
        lvef: lvef1,
        ntProBNP: nt1,
        egfr: egfr1,
        potassium: potassium1,
        diuretic: { prescribed: 'Yes', type: diureticType, dose: '40mg OD' },
        raasi: { prescribed: 'Yes', type: raasiType, dose: raasiType === 'Sacubitril/Valsartan' ? '50mg BD' : '5mg OD' },
        betaBlocker: { prescribed: 'Yes', type: bbType, dose: bbType === 'Carvedilol' ? '6.25mg BD' : '25mg OD' },
        mra: emptyMed,
        sglt2i: emptyMed,
        ivabradine: emptyMed, digoxin: emptyMed, ivIron: emptyMed,
        aspirin: { prescribed: 'Yes', dose: '75mg OD' },
        statin: { prescribed: 'Yes', type: 'Atorvastatin', dose: '20mg OD' },
        fibrate: emptyMed, pcsk9: emptyMed, noac: emptyMed, vki: emptyMed,
        clinicalNotes: `Initial visit for ${phenotype}. Enrolled in registry. Starting standard GDMT (RAASi, Beta-Blocker) and diuretic for symptom relief.`,
        followupDate: relativeDateStr(visit2DaysAgo)
      }
    },
    {
      patientId: String(i),
      visitId: `v-${i}-2`,
      data: {
        patientId: String(i),
        visitDate: relativeDateStr(visit2DaysAgo),
        visitType: 'OPD',
        weight: endWeight,
        height,
        bpSystolic: bpSys2,
        bpDiastolic: bpDia2,
        heartRate: hr2,
        nyha: nyha2,
        rhythm: 'Sinus',
        sixMWT: 320 + (i % 130),
        lvef: lvef2,
        ntProBNP: nt2,
        egfr: egfr2,
        potassium: potassium2,
        diuretic: { prescribed: 'Yes', type: diureticType, dose: '20mg OD' },
        raasi: { prescribed: 'Yes', type: raasiType, dose: raasiType === 'Sacubitril/Valsartan' ? '50mg BD' : '10mg OD' },
        betaBlocker: { prescribed: 'Yes', type: bbType, dose: bbType === 'Carvedilol' ? '12.5mg BD' : '50mg OD' },
        mra: { prescribed: 'Yes', type: 'Spironolactone', dose: '25mg OD' },
        sglt2i: { prescribed: 'Yes', type: 'Dapagliflozin', dose: '10mg OD' },
        ivabradine: emptyMed, digoxin: emptyMed, ivIron: emptyMed,
        aspirin: { prescribed: 'Yes', dose: '75mg OD' },
        statin: { prescribed: 'Yes', type: 'Atorvastatin', dose: '20mg OD' },
        fibrate: emptyMed, pcsk9: emptyMed, noac: emptyMed, vki: emptyMed,
        clinicalNotes: `Follow-up visit. Symptoms improved to NYHA ${nyha2}. Decongestion complete (weight reduced). Added MRA (Spironolactone) and SGLT2i (Dapagliflozin) to complete all 4 pillars of GDMT.`,
        followupDate: relativeDateStr(-90)
      }
    }
  );
}

// 3. Enrich mock cohorts with the new Heart Failure Registry variables
Object.keys(MOCK_PATIENTS_COHORT).forEach(id => {
  const p = MOCK_PATIENTS_COHORT[id]
  
  // Find latest visit for this patient to get the hfType, nyha, and lvef
  const patientVisits = MOCK_VISITS_COHORT.filter(v => v.patientId === id)
  let latestVisit = patientVisits[0]
  patientVisits.forEach(v => {
    if (v.data.visitDate && latestVisit?.data.visitDate) {
      if (new Date(v.data.visitDate).getTime() > new Date(latestVisit.data.visitDate).getTime()) {
        latestVisit = v
      }
    }
  })
  
  // Determine hfType
  let hfType: 'HFrEF' | 'HFmrEF' | 'HFpEF' = 'HFrEF'
  if (latestVisit?.data.lvef !== undefined) {
    const lvef = latestVisit.data.lvef
    if (lvef <= 40) hfType = 'HFrEF'
    else if (lvef < 50) hfType = 'HFmrEF'
    else hfType = 'HFpEF'
  } else {
    // Fallback for static ones by MRN/notes context
    if (id === '2' || id === '6' || id === '11' || id === '15') hfType = 'HFpEF'
    else if (id === '4' || id === '13') hfType = 'HFmrEF'
    else hfType = 'HFrEF'
  }

  const nyha = latestVisit?.data.nyha || 'II'
  const lvef = latestVisit?.data.lvef

  MOCK_PATIENTS_COHORT[id] = {
    ...p,
    hfType,
    nyha,
    lvef,
    registryId: 'hf',
    indianCitizen: true,
    studyConsented: p.status === 'Active',
    hfConfirmationDate: relativeDateStr(120),
    educationYears: p.educationYears || (id === '7' ? 15 : id === '3' ? 8 : 12),
    abhaId: p.abhaId || `98-7654-3210-0${id}`,
    occupation: p.occupation || (id === '1' ? 'Farmer' : id === '2' ? 'School Teacher' : id === '3' ? 'Retired Clerk' : id === '7' ? 'Business Consultant' : 'Home Maker'),
    indexEtiology: p.indexEtiology || (id === '1' || id === '3' || id === '8' || id === '10' || id === '14' ? ['Ischemic'] : ['Hypertension']),
    indexEtiologyOther: p.indexEtiologyOther || '',
    familyHistoryPrematureCVD: p.familyHistoryPrematureCVD !== undefined ? p.familyHistoryPrematureCVD : (id === '1' || id === '3' || id === '10' || id === '12'),
    familyHistorySuddenDeath: p.familyHistorySuddenDeath !== undefined ? p.familyHistorySuddenDeath : (id === '3' || id === '14'),
    familyHistoryCardiomyopathy: p.familyHistoryCardiomyopathy !== undefined ? p.familyHistoryCardiomyopathy : (id === '9' || id === '13'),
    familyHistoryGeneticHeart: p.familyHistoryGeneticHeart !== undefined ? p.familyHistoryGeneticHeart : (id === '9' || id === '13'),
    addressHouse: p.addressHouse || `House No. ${10 + Number(id)}`,
    addressStreet: p.addressStreet || 'Main Road',
    addressPost: p.addressPost || 'GPO',
    addressDistrict: p.addressDistrict || 'Pune',
    addressState: p.addressState || 'Maharashtra',
    addressPin: p.addressPin || '411001',
    secondaryContact: p.secondaryContact || '+91 9800000000',
    caregiverContact: p.caregiverContact || '+91 9900000000',
    caregiverSecondaryContact: p.caregiverSecondaryContact || '+91 9911111111'
  }
})

MOCK_VISITS_COHORT.forEach(v => {
  const isSevere = v.data.nyha === 'III' || v.data.nyha === 'IV'
  const hfType = v.data.lvef ? (v.data.lvef <= 40 ? 'HFrEF' : (v.data.lvef < 50 ? 'HFmrEF' : 'HFpEF')) : 'HFrEF'
  
  // Determine hospHistory based on comorbidities
  const p = MOCK_PATIENTS_COHORT[v.patientId]
  const hasCADOrMI = p?.comorbidities?.includes('CAD') || p?.comorbidities?.includes('Prior MI')
  const hospHistory = hasCADOrMI ? 'Yes' : 'No'

  v.data = {
    ...v.data,
    hfType,
    hospHistory,
    respiratoryRate: isSevere ? 22 : 16,
    trGrade: isSevere ? 'Moderate' : 'Mild',
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
    lastHospDate: hospHistory === 'Yes' ? relativeDateStr(180) : ''
  } as any
})

function cleanUndefined(obj: any): any {
  if (obj === null || typeof obj !== 'object') return obj
  const res = Array.isArray(obj) ? [] : {} as any
  Object.keys(obj).forEach(key => {
    const val = obj[key]
    if (val !== undefined) {
      res[key] = cleanUndefined(val)
    }
  })
  return res
}

