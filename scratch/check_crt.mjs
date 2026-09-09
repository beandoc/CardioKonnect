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

async function checkCRT() {
  const ptsSnap = await getDocs(collection(db, 'patients'));
  
  console.log('=== CRT CANDIDATE AUDIT: (LBBB OR QRS >= 130ms) AND LVEF < 35% ===');
  let crtCount = 0;
  
  for (const doc of ptsSnap.docs) {
    const p = { id: doc.id, ...doc.data() };
    const visitsSnap = await getDocs(collection(db, 'patients', p.id, 'visits'));
    const visits = visitsSnap.docs.map(vd => ({ id: vd.id, ...vd.data() }));
    const latest = [...visits].sort((a,b) => new Date(b.visitDate).getTime() - new Date(a.visitDate).getTime())[0];
    
    const ef = latest?.lvef ?? p.lvef;
    const qrs = latest?.qrsDuration;
    const bbb = latest?.bbb;
    
    // Criterion: either LBBB or QRS >= 130ms and LVEF < 35%
    const isCRT = (ef != null && ef < 35) && (bbb === 'LBBB' || (qrs != null && qrs >= 130));
    if (isCRT) {
      crtCount++;
      console.log(`[CRT CANDIDATE ${crtCount}] ${p.firstName} ${p.lastName} | LVEF: ${ef}% | QRS: ${qrs || '—'} ms | BBB: ${bbb || '—'}`);
    } else {
      console.log(`[Not CRT Candidate] ${p.firstName} ${p.lastName} | LVEF: ${ef}% | QRS: ${qrs || '—'} ms | BBB: ${bbb || '—'}`);
    }
  }

  console.log(`\n>>> Total CRT Candidates meeting (LBBB / QRS >= 130ms + LVEF < 35%): ${crtCount} of ${ptsSnap.size} patients`);
}

checkCRT();
