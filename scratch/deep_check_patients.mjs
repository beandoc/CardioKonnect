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

async function checkAll() {
  const snap = await getDocs(collection(db, 'patients'));
  const list = [];
  snap.docs.forEach(doc => {
    const d = doc.data();
    list.push({
      id: doc.id,
      name: `${d.firstName || ''} ${d.lastName || ''}`.trim(),
      mrn: d.mrn || '',
      age: d.age,
      dob: d.dob,
      phone: d.contact || '',
      address: d.address || '',
      createdAt: d.createdAt,
      status: d.status
    });
  });

  console.log(`Total: ${list.length}`);
  // Check for any obvious test patterns (test, sample, fake, foo, bar, 12345, lorem)
  const suspicious = list.filter(p => {
    const str = `${p.name} ${p.mrn} ${p.phone} ${p.address}`.toLowerCase();
    return str.includes('test') || str.includes('dummy') || str.includes('fake') || str.includes('sample') || str.includes('unknown') || !p.name || p.name === 'Unknown';
  });

  console.log(`Suspicious count: ${suspicious.length}`);
  suspicious.forEach(p => console.log(JSON.stringify(p)));

  // Show distribution of MRNs
  const mrns = list.map(p => p.mrn).filter(Boolean);
  console.log(`Sample MRNs: ${mrns.slice(0, 15).join(', ')} ... ${mrns.slice(-15).join(', ')}`);
}

checkAll();
