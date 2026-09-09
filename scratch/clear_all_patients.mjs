import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, writeBatch, doc } from 'firebase/firestore';

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

const BATCH_SIZE = 400;

async function clearAll() {
  console.log('--- STEP 1: Clear ALL existing patients and visits ---');

  const patientsSnap = await getDocs(collection(db, 'patients'));
  console.log(`Found ${patientsSnap.size} patients to delete.`);

  if (patientsSnap.empty) {
    console.log('No patients to delete.');
    return;
  }

  const ops = [];

  for (const patDoc of patientsSnap.docs) {
    // Delete visits subcollection first
    const visitsSnap = await getDocs(collection(db, 'patients', patDoc.id, 'visits'));
    for (const vDoc of visitsSnap.docs) {
      ops.push(vDoc.ref);
    }
    ops.push(patDoc.ref);
  }

  console.log(`Total delete ops: ${ops.length}`);

  // Commit in batches of BATCH_SIZE
  for (let i = 0; i < ops.length; i += BATCH_SIZE) {
    const batch = writeBatch(db);
    const chunk = ops.slice(i, i + BATCH_SIZE);
    chunk.forEach(ref => batch.delete(ref));
    await batch.commit();
    console.log(`Deleted batch ${Math.floor(i / BATCH_SIZE) + 1} (${chunk.length} ops)`);
  }

  // Verify
  const remaining = await getDocs(collection(db, 'patients'));
  console.log(`Remaining patients after clear: ${remaining.size}`);
}

clearAll().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
