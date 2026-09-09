import { initializeApp } from 'firebase/app';
import { getFirestore, doc, collection, getDocs, writeBatch } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyBl9MjJgsGqjdYqNVTQLzTgeysOSlsIF0U',
  authDomain: 'cardio-konnect-sachin-1.firebaseapp.com',
  projectId: 'cardio-konnect-sachin-1',
  storageBucket: 'cardio-konnect-sachin-1.firebasestorage.app',
  messagingSenderId: '855879428060',
  appId: '1:855879428060:web:4754ebe71646eb75b69119',
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const DUMMY_IDS = [
  '1C6KLxLxRaN3B6rLj3Rg',
  '85RvADD0oa04BpkfU2NJ',
  'INHFLnQ4CqfWSigoCwfQ',
  'Kv6YoggfooOtdIXy2eKv',
  'PYn6fLqqmTpF1jxvzjZ6',
  'QXfsiVhypACpspTy7Ipi',
  'VFULZam0XkOtPdVz4XJ9',
  'WhE6oYG3bZ2uZZlttdue',
  'b6VTohEx8gdfiFbDqHtA',
  'nwlSiJNF2A6g2ELuDQ59',
  'p9JYA0AiUIIcCWWMClv2',
  'saWOBJDxJMyMv1I3NH5s',
];

async function deleteDummyData() {
  console.log(`Starting deletion of ${DUMMY_IDS.length} dummy patient records and their visits...`);
  const batch = writeBatch(db);
  let totalOps = 0;

  for (const patientId of DUMMY_IDS) {
    // 1. Get and delete all visits for this patient
    const visitsSnap = await getDocs(collection(db, 'patients', patientId, 'visits'));
    console.log(`Patient ${patientId}: found ${visitsSnap.size} visit(s) to delete.`);
    visitsSnap.docs.forEach(vDoc => {
      batch.delete(vDoc.ref);
      totalOps++;
    });

    // 2. Delete the patient document
    const patientRef = doc(db, 'patients', patientId);
    batch.delete(patientRef);
    totalOps++;
  }

  console.log(`Committing batch with ${totalOps} delete operations...`);
  await batch.commit();
  console.log('Batch commit complete. Successfully deleted dummy patients and visits!');

  // Verification count
  const remainingPatients = await getDocs(collection(db, 'patients'));
  console.log(`Remaining patients in Firestore: ${remainingPatients.size}`);
}

deleteDummyData().catch(err => {
  console.error('Error during deletion:', err);
  process.exit(1);
});
