import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, updateDoc } from 'firebase/firestore';

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

async function syncGranularComorbidities() {
  console.log('Synchronizing discrete comorbidity variables for all patients in Firestore...');
  const snap = await getDocs(collection(db, 'patients'));
  console.log(`Found ${snap.size} patients.`);

  let updatedCount = 0;

  for (const pDoc of snap.docs) {
    const data = pDoc.data();
    const rawList = Array.isArray(data.comorbidities) ? data.comorbidities : [];
    const rawUpper = rawList.map(s => String(s).toUpperCase());

    const comorbidDiabetes = Boolean(data.comorbidDiabetes ?? (rawUpper.some(s => s.includes('DM') || s.includes('DIABETES'))));
    const comorbidCAD = Boolean(data.comorbidCAD ?? (rawUpper.some(s => s.includes('CAD') || s.includes('CORONARY') || s.includes('ISCHEMIC'))));
    const comorbidPriorMI = Boolean(data.comorbidPriorMI ?? (rawUpper.some(s => s.includes('MI') || s.includes('INFARCT'))));
    const comorbidPriorPCI = Boolean(data.comorbidPriorPCI ?? (rawUpper.some(s => s.includes('PCI') || s.includes('STENT'))));
    const comorbidPriorCABG = Boolean(data.comorbidPriorCABG ?? (rawUpper.some(s => s.includes('CABG') || s.includes('BYPASS'))));
    const comorbidHypertension = Boolean(data.comorbidHypertension ?? (rawUpper.some(s => s.includes('HTN') || s.includes('HYPERTENSION'))));
    const comorbidDyslipidemia = Boolean(data.comorbidDyslipidemia ?? (rawUpper.some(s => s.includes('LIPID') || s.includes('DYSLIPIDEMIA'))));
    const comorbidCKD = Boolean(data.comorbidCKD ?? (rawUpper.some(s => s.includes('CKD') || s.includes('KIDNEY') || s.includes('RENAL'))));
    const comorbidAF = Boolean(data.comorbidAF ?? (rawUpper.some(s => s.includes('AF') || s.includes('ATRIAL FIBRILLATION'))));
    const comorbidCOPD = Boolean(data.comorbidCOPD ?? (rawUpper.some(s => s.includes('COPD') || s.includes('ASTHMA'))));
    const comorbidStrokeTIA = Boolean(data.comorbidStrokeTIA ?? (rawUpper.some(s => s.includes('STROKE') || s.includes('TIA'))));
    const comorbidPAD = Boolean(data.comorbidPAD ?? (rawUpper.some(s => s.includes('PAD') || s.includes('PERIPHERAL'))));

    const normalizedList = [];
    if (comorbidHypertension) normalizedList.push('HTN');
    if (comorbidDiabetes) normalizedList.push('DM2');
    if (comorbidCAD) normalizedList.push('CAD');
    if (comorbidPriorMI) normalizedList.push('Prior MI');
    if (comorbidPriorPCI) normalizedList.push('Prior PCI');
    if (comorbidPriorCABG) normalizedList.push('Prior CABG');
    if (comorbidDyslipidemia) normalizedList.push('Dyslipidemia');
    if (comorbidCKD) normalizedList.push('CKD');
    if (comorbidAF) normalizedList.push('AF');
    if (comorbidCOPD) normalizedList.push('COPD');
    if (comorbidStrokeTIA) normalizedList.push('Stroke / TIA');
    if (comorbidPAD) normalizedList.push('PAD');

    await updateDoc(doc(db, 'patients', pDoc.id), {
      comorbidDiabetes,
      comorbidCAD,
      comorbidPriorMI,
      comorbidPriorPCI,
      comorbidPriorCABG,
      comorbidHypertension,
      comorbidDyslipidemia,
      comorbidCKD,
      comorbidAF,
      comorbidCOPD,
      comorbidStrokeTIA,
      comorbidPAD,
      comorbidities: normalizedList,
    });

    console.log(`Updated ${data.firstName} ${data.lastName}: DM=${comorbidDiabetes}, CAD=${comorbidCAD}, PriorMI=${comorbidPriorMI}, Dyslipidemia=${comorbidDyslipidemia}, HTN=${comorbidHypertension}`);
    updatedCount++;
  }

  console.log(`\nSuccessfully verified and synced ${updatedCount} patients with granular discrete variables.`);
}

syncGranularComorbidities().catch(err => {
  console.error(err);
  process.exit(1);
});
