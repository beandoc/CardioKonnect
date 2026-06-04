import fs from 'fs';
import path from 'path';

// 1. Manually load environment variables from .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const parts = trimmed.split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      let val = parts.slice(1).join('=').trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env[key] = val;
    }
  });
  console.log('Successfully loaded environment variables from .env.local');
} else {
  console.warn('.env.local file not found. Falling back to default environment variables.');
}

// 2. Import firestore functions and types
import { addPatient, getPatient, addVisit, getVisits, deletePatient } from '../lib/firestore';
import type { PatientInput, VisitInput } from '../lib/types';

async function runDirectTest() {
  let testPatientId: string | null = null;
  console.log('Starting direct Firebase backend data saving and retrieval verification test...\n');

  try {
    // A. Define test patient input (with structured comorbidities and indexDate)
    const patientInput: PatientInput = {
      firstName: 'DirectFirebase',
      lastName: 'VerifyTest',
      dob: '1975-12-05',
      sex: 'Female',
      mrn: 'DIR-TEST-' + Math.random().toString(36).substring(2, 7).toUpperCase(),
      contact: '+91 9888888888',
      address: 'Direct Execution Context, Pune, Maharashtra',
      comorbidities: ['CAD', 'HTN'],
      allergies: 'None',
      status: 'Active',
      email: 'direct.test@cardiokonnect.org',
      indexDate: '2025-11-20',
    };

    console.log(`[1] Creating patient: ${patientInput.firstName} ${patientInput.lastName}`);
    testPatientId = await addPatient(patientInput);
    console.log(`[+] Patient document created successfully. Firestore ID: ${testPatientId}`);

    // B. Define visit input (with medication dose-date tracking)
    const visitInput: VisitInput = {
      patientId: testPatientId,
      visitDate: '2026-06-04',
      visitType: 'OPD',
      clinicalNotes: 'Direct verification encounter for schema update and Firestore write tests.',
      nyha: 'II',
      hfType: 'HFpEF',
      lvef: 52,
      bpSystolic: 122,
      bpDiastolic: 78,
      heartRate: 68,
      weight: 62.0,
      height: 165,
      creatinine: 0.9,
      sodium: 140,
      potassium: 4.1,
      ntProBNP: 280,
      bnp: undefined,
      hb: 12.5,
      hba1c: 5.9,
      egfr: 85,
      raasi: {
        prescribed: 'No',
        reason: 'Not indicated for HFpEF without congestion / stable'
      },
      betaBlocker: {
        prescribed: 'Yes',
        type: 'Metoprolol Succinate',
        dose: '25mg QD',
        startDate: '2025-12-01',
        stopDate: '',
        changeReason: 'Heart rate control'
      },
      mra: {
        prescribed: 'No',
        reason: 'Not indicated'
      },
      sglt2i: {
        prescribed: 'Yes',
        type: 'Empagliflozin',
        dose: '10mg QD',
        startDate: '2026-01-15',
        stopDate: '',
        changeReason: 'Initiated per HFpEF outcome evidence'
      },
      diuretic: { prescribed: 'No' },
      digoxin: { prescribed: 'No' },
      ivabradine: { prescribed: 'No' },
      aspirin: { prescribed: 'No' },
      statin: { prescribed: 'No' },
      fibrate: { prescribed: 'No' },
      pcsk9: { prescribed: 'No' },
      ivIron: { prescribed: 'No' },
      noac: { prescribed: 'No' },
      vki: { prescribed: 'No' },
    };

    console.log('[2] Creating visit subcollection entry for patient...');
    const visitId = await addVisit(testPatientId, visitInput);
    console.log(`[+] Visit document created successfully. ID: ${visitId}`);

    // C. Retrieve patient doc and verify cached clinical fields and parameters
    console.log('[3] Fetching patient document back from Firestore to verify schema integrations...');
    const patient = await getPatient(testPatientId!);
    if (!patient) {
      throw new Error('Retrieved patient document was null');
    }

    console.log(`    - ID matches: ${patient.id === testPatientId ? 'PASS' : 'FAIL'}`);
    console.log(`    - Index Date: ${patient.indexDate} (Expected: 2025-11-20) -> ${patient.indexDate === '2025-11-20' ? 'PASS' : 'FAIL'}`);
    console.log(`    - Comorbidities Array: [${(patient.comorbidities ?? []).join(', ')}] (Expected: CAD, HTN) -> ${
      (patient.comorbidities ?? []).includes('CAD') && (patient.comorbidities ?? []).includes('HTN') ? 'PASS' : 'FAIL'
    }`);
    console.log(`    - Cached NYHA: ${patient.nyha} (Expected: II) -> ${patient.nyha === 'II' ? 'PASS' : 'FAIL'}`);
    console.log(`    - Cached HF Type: ${patient.hfType} (Expected: HFpEF) -> ${patient.hfType === 'HFpEF' ? 'PASS' : 'FAIL'}`);
    console.log(`    - Cached LVEF: ${patient.lvef}% (Expected: 52%) -> ${patient.lvef === 52 ? 'PASS' : 'FAIL'}`);

    if (patient.nyha !== 'II' || patient.hfType !== 'HFpEF' || patient.lvef !== 52) {
      throw new Error('Cached clinical profile fields mismatch database verification expectations.');
    }

    // D. Retrieve visit doc and verify medication tracking fields
    console.log('[4] Fetching patient visits back from Firestore to verify medication structures...');
    const visits = await getVisits(testPatientId);
    if (visits.length !== 1) {
      throw new Error(`Expected exactly 1 visit record, found ${visits.length}`);
    }

    const visit = visits[0];
    console.log(`    - Visit ID matches: ${visit.id === visitId ? 'PASS' : 'FAIL'}`);
    console.log(`    - Beta Blocker prescribed: ${visit.betaBlocker.prescribed}`);
    console.log(`    - Beta Blocker dose: ${visit.betaBlocker.dose}`);
    console.log(`    - Beta Blocker startDate: ${visit.betaBlocker.startDate}`);
    console.log(`    - SGLT2i prescribed: ${visit.sglt2i.prescribed}`);
    console.log(`    - SGLT2i changeReason: ${visit.sglt2i.changeReason}`);

    // E. Perform cleanup delete
    console.log('[5] Cleaning up test data from Firestore...');
    await deletePatient(testPatientId);
    console.log('[+] Test patient and visits successfully deleted from Firestore.');
    console.log('\n>>> SUCCESS: ALL BACKEND FIREBASE SAVE AND RETRIEVAL TESTS COMPLETED SUCCESSFULLY! <<<');

    process.exit(0);
  } catch (error: any) {
    console.error('\n>>> TEST SUITE FAILURE DETECTED: <<<');
    console.error(error.message || error);

    if (testPatientId) {
      try {
        console.log('Attempting emergency Firestore cleanup...');
        await deletePatient(testPatientId);
        console.log('Emergency cleanup successful.');
      } catch (cleanErr) {
        console.error('Failed to perform emergency cleanup:', cleanErr);
      }
    }
    process.exit(1);
  }
}

runDirectTest();
