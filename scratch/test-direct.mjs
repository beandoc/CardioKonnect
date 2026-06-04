import fs from 'fs';
import path from 'path';
import { initializeApp } from 'firebase/app';
import {
  initializeFirestore,
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  writeBatch
} from 'firebase/firestore';

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
  console.error('Error: .env.local file not found.');
  process.exit(1);
}

// 2. Initialize Firebase App
const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

console.log('Initializing Firebase App...');
const app = initializeApp(firebaseConfig);

// Initialize Firestore with long-polling to bypass sandbox gRPC connectivity limitations
console.log('Initializing Firestore with experimentalForceLongPolling: true...');
const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
});

async function runDirectTest() {
  let testPatientId = null;
  console.log('Starting direct Firebase backend saving & retrieval test...\n');

  try {
    // 1. Create Patient Document
    const patientInput = {
      firstName: 'DirectESM',
      lastName: 'VerifyTest',
      dob: '1970-01-01',
      sex: 'Male',
      mrn: 'ESM-TEST-' + Math.random().toString(36).substring(2, 7).toUpperCase(),
      contact: '+91 9777777777',
      address: 'ESM Direct Context, Pune',
      comorbidities: ['HTN', 'DM2', 'CKD'],
      allergies: 'None',
      status: 'Active',
      email: 'esm.test@cardiokonnect.org',
      indexDate: '2026-03-15',
      visitCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    console.log('[+] Adding patient document to Firestore...');
    const patientRef = await addDoc(collection(db, 'patients'), patientInput);
    testPatientId = patientRef.id;
    console.log('    - Created Patient Firestore ID:', testPatientId);

    // 2. Create Visit Document inside Patient Subcollection
    const visitInput = {
      visitDate: '2026-06-04',
      clinicalNotes: 'ESM test encounter for database saving and verification.',
      nyha: 'IV',
      hfType: 'HFrEF',
      lvef: 28,
      sbp: 110,
      dbp: 70,
      hr: 80,
      temp: 98.6,
      weight: 70,
      height: 175,
      raasi: {
        prescribed: 'Yes',
        type: 'ARNI',
        dose: 'Sacubitril/Valsartan 24/26mg BID',
        startDate: '2026-04-01',
        stopDate: '',
        changeReason: 'Initiated post-discharge'
      },
      betaBlocker: {
        prescribed: 'Yes',
        type: 'Carvedilol',
        dose: '3.125mg BID',
        startDate: '2026-04-10',
        stopDate: '',
        changeReason: 'Stable dose'
      },
      mra: { prescribed: 'No', reason: 'Hyperkalemia' },
      sglt2i: {
        prescribed: 'Yes',
        type: 'Dapagliflozin',
        dose: '10mg QD',
        startDate: '2026-05-01',
        stopDate: '',
        changeReason: 'Added for GDMT'
      },
      createdAt: new Date().toISOString(),
    };

    console.log('[+] Adding visit subcollection document...');
    const visitRef = await addDoc(collection(db, 'patients', testPatientId, 'visits'), visitInput);
    console.log('    - Created Visit Firestore ID:', visitRef.id);

    // 3. Update Patient's cached variables (just like our firestore.ts does)
    console.log('[+] Updating cached clinical variables on patient document...');
    await updateDoc(doc(db, 'patients', testPatientId), {
      visitCount: 1,
      lastVisitDate: visitInput.visitDate,
      hfType: visitInput.hfType,
      nyha: visitInput.nyha,
      lvef: visitInput.lvef,
      updatedAt: new Date().toISOString(),
    });

    // 4. Retrieve and verify patient document
    console.log('[+] Retrieving patient document from Firestore for verification...');
    const patientSnap = await getDoc(doc(db, 'patients', testPatientId));
    if (!patientSnap.exists()) {
      throw new Error('Patient document not found on Firestore after write.');
    }
    const savedPatient = patientSnap.data();
    console.log('    - MRN matches:', savedPatient.mrn === patientInput.mrn ? 'PASS' : 'FAIL');
    console.log('    - Index Date matches:', savedPatient.indexDate === '2026-03-15' ? 'PASS' : 'FAIL');
    console.log('    - Comorbidities list is array:', Array.isArray(savedPatient.comorbidities) ? 'PASS' : 'FAIL');
    console.log('    - Comorbidities values match:', savedPatient.comorbidities.join(',') === 'HTN,DM2,CKD' ? 'PASS' : 'FAIL');
    console.log('    - Cached NYHA matches:', savedPatient.nyha === 'IV' ? 'PASS' : 'FAIL');
    console.log('    - Cached HF Type matches:', savedPatient.hfType === 'HFrEF' ? 'PASS' : 'FAIL');
    console.log('    - Cached LVEF matches:', savedPatient.lvef === 28 ? 'PASS' : 'FAIL');

    if (
      savedPatient.mrn !== patientInput.mrn ||
      savedPatient.indexDate !== '2026-03-15' ||
      savedPatient.nyha !== 'IV' ||
      savedPatient.hfType !== 'HFrEF' ||
      savedPatient.lvef !== 28
    ) {
      throw new Error('Retrieved patient data validation failed!');
    }

    // 5. Retrieve and verify visit document
    console.log('[+] Retrieving visit documents from Firestore subcollection for verification...');
    const visitsSnap = await getDocs(collection(db, 'patients', testPatientId, 'visits'));
    if (visitsSnap.empty) {
      throw new Error('No visits found in patient visits subcollection.');
    }
    const savedVisit = visitsSnap.docs[0].data();
    console.log('    - Visit Date matches:', savedVisit.visitDate === '2026-06-04' ? 'PASS' : 'FAIL');
    console.log('    - RAASi type matches:', savedVisit.raasi.type === 'ARNI' ? 'PASS' : 'FAIL');
    console.log('    - Beta Blocker dose matches:', savedVisit.betaBlocker.dose === '3.125mg BID' ? 'PASS' : 'FAIL');
    console.log('    - SGLT2i startDate matches:', savedVisit.sglt2i.startDate === '2026-05-01' ? 'PASS' : 'FAIL');

    if (
      savedVisit.visitDate !== '2026-06-04' ||
      savedVisit.raasi.type !== 'ARNI' ||
      savedVisit.betaBlocker.dose !== '3.125mg BID' ||
      savedVisit.sglt2i.startDate !== '2026-05-01'
    ) {
      throw new Error('Retrieved visit data validation failed!');
    }

    // 6. Delete test data to clean up
    console.log('[+] Cleaning up: deleting visit and patient documents...');
    const batch = writeBatch(db);
    visitsSnap.docs.forEach((vDoc) => batch.delete(vDoc.ref));
    batch.delete(doc(db, 'patients', testPatientId));
    await batch.commit();
    console.log('    - Firestore cleanup successful.');

    console.log('\n>>> SUCCESS: ALL BACKEND FIREBASE SAVE AND RETRIEVAL TESTS COMPLETED SUCCESSFULLY! <<<');
    process.exit(0);

  } catch (error) {
    console.error('\n>>> TEST SUITE FAILURE DETECTED: <<<');
    console.error(error);

    if (testPatientId) {
      try {
        console.log('Attempting emergency Firestore cleanup...');
        const visitsSnap = await getDocs(collection(db, 'patients', testPatientId, 'visits'));
        const batch = writeBatch(db);
        visitsSnap.docs.forEach((vDoc) => batch.delete(vDoc.ref));
        batch.delete(doc(db, 'patients', testPatientId));
        await batch.commit();
        console.log('Emergency cleanup successful.');
      } catch (cleanErr) {
        console.error('Failed to perform emergency cleanup:', cleanErr);
      }
    }
    process.exit(1);
  }
}

runDirectTest();
