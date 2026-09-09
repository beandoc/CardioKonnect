import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

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

async function inspect() {
  console.log('Fetching patients from Firestore...');
  try {
    const snap = await getDocs(collection(db, 'patients'));
    console.log(`Found ${snap.size} patient document(s).`);
    snap.docs.forEach((doc, idx) => {
      const data = doc.data();
      console.log(`[${idx + 1}] ID: ${doc.id}`);
      console.log(`    Name: ${data.firstName} ${data.lastName}`);
      console.log(`    MRN: ${data.mrn}, Age: ${data.age}, Gender: ${data.gender}`);
      console.log(`    Status: ${data.status}, CreatedAt: ${data.createdAt}`);
      console.log(`    Sample keys: ${Object.keys(data).slice(0, 10).join(', ')}`);
    });
  } catch (err) {
    console.error('Error fetching patients:', err);
  }
}

inspect();
