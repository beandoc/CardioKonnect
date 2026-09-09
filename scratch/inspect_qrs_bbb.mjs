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

async function inspectVisits() {
  const ptsSnap = await getDocs(collection(db, 'patients'));
  const visitsSnap = await getDocs(collection(db, 'visits'));
  
  const visitsByPatient = new Map();
  visitsSnap.docs.forEach(doc => {
    const v = { id: doc.id, ...doc.data() };
    if (!visitsByPatient.has(v.patientId)) visitsByPatient.set(v.patientId, []);
    visitsByPatient.get(v.patientId).push(v);
  });

  ptsSnap.docs.forEach((doc, idx) => {
    const p = { id: doc.id, ...doc.data() };
    const visits = visitsByPatient.get(p.id) || [];
    const latest = [...visits].sort((a,b) => new Date(b.visitDate).getTime() - new Date(a.visitDate).getTime())[0];
    
    console.log(`[${idx+1}] ${p.firstName} ${p.lastName} | LVEF: ${latest?.lvef} | QRS: ${latest?.qrsDuration} | BBB: ${latest?.bbb} | ecgNotes: ${latest?.ecgNotes || latest?.ecg}`);
  });
}

inspectVisits();
