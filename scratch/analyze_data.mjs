import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, collectionGroup } from 'firebase/firestore';

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

async function analyze() {
  console.log('--- Analyzing Firestore Data ---');
  
  // 1. Check known root collections
  const collectionsToCheck = ['patients', 'visits', 'procedures', 'complications', 'audit', 'reports', 'users', 'settings', 'registryFields'];
  for (const colName of collectionsToCheck) {
    try {
      const s = await getDocs(collection(db, colName));
      console.log(`Collection '${colName}': ${s.size} documents`);
    } catch (e) {
      console.log(`Collection '${colName}': error (${e.message})`);
    }
  }

  // 2. Check visits subcollections via collectionGroup
  try {
    const visitsSnap = await getDocs(collectionGroup(db, 'visits'));
    console.log(`CollectionGroup 'visits': ${visitsSnap.size} documents across all patients`);
  } catch (e) {
    console.log(`CollectionGroup 'visits' error: ${e.message}`);
  }

  // 3. Inspect patients for dummy / test indicators
  const pSnap = await getDocs(collection(db, 'patients'));
  console.log(`Total patients: ${pSnap.size}`);

  const unknownPatients = [];
  const testPatients = [];
  const emptyPatients = [];
  const normalPatients = [];

  pSnap.docs.forEach(d => {
    const p = d.data();
    const fullName = `${p.firstName || ''} ${p.lastName || ''}`.trim();
    const mrn = p.mrn || '';
    
    if (fullName.toLowerCase().includes('unknown') || !fullName) {
      unknownPatients.push({ id: d.id, name: fullName, mrn, age: p.age, keys: Object.keys(p) });
    } else if (fullName.toLowerCase().includes('test') || fullName.toLowerCase().includes('dummy') || mrn.toLowerCase().includes('test')) {
      testPatients.push({ id: d.id, name: fullName, mrn, age: p.age });
    } else {
      normalPatients.push({ id: d.id, name: fullName, mrn, age: p.age });
    }
  });

  console.log(`Unknown named patients: ${unknownPatients.length}`);
  unknownPatients.forEach(p => console.log(`  - ID: ${p.id}, Name: "${p.name}", MRN: "${p.mrn}", Age: ${p.age}`));

  console.log(`Test / Dummy named patients: ${testPatients.length}`);
  testPatients.forEach(p => console.log(`  - ID: ${p.id}, Name: "${p.name}", MRN: "${p.mrn}"`));

  console.log(`Other patients: ${normalPatients.length}`);
  console.log('Sample of other patients (first 10):');
  normalPatients.slice(0, 10).forEach(p => console.log(`  - [${p.mrn}] ${p.name} (Age: ${p.age})`));
}

analyze();
