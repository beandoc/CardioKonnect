import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, collection, getDocs } from 'firebase/firestore';

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

async function checkUnknown() {
  const ids = ['1C6KLxLxRaN3B6rLj3Rg', '85RvADD0oa04BpkfU2NJ', 'INHFLnQ4CqfWSigoCwfQ'];
  for (const id of ids) {
    const snap = await getDoc(doc(db, 'patients', id));
    console.log(`\nPatient ID: ${id}`);
    console.log(JSON.stringify(snap.data(), null, 2));
    const visits = await getDocs(collection(db, 'patients', id, 'visits'));
    console.log(`Visits count: ${visits.size}`);
    visits.forEach(v => console.log('Visit:', JSON.stringify(v.data(), null, 2)));
  }
}

checkUnknown();
