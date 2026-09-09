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

async function verifyRegistryHome() {
  const pSnap = await getDocs(collection(db, 'patients'));
  const patients = pSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  console.log(`Total Patients in Firestore: ${patients.length}`);

  const hfPatients = patients;
  const visitMap = new Map();

  for (const p of patients) {
    const vSnap = await getDocs(collection(db, 'patients', p.id, 'visits'));
    const visits = vSnap.docs.map(d => ({ id: d.id, patientId: p.id, ...d.data() }));
    if (visits.length > 0) {
      const latest = visits.sort((a, b) => new Date(b.visitDate).getTime() - new Date(a.visitDate).getTime())[0];
      visitMap.set(p.id, latest);
    }
  }

  const hfVisits = Array.from(visitMap.values());

  const hfCategories = [
    { name: 'Demographics', fields: ['firstName', 'lastName', 'dob', 'sex', 'mrn', 'contact', 'address', 'indianCitizen', 'studyConsented', 'abhaId', 'occupation', 'addressHouse', 'addressStreet', 'addressPost', 'addressDistrict', 'addressState', 'addressPin', 'secondaryContact', 'caregiverContact'] },
    { name: 'Vitals & Exam', fields: ['bpSystolic', 'bpDiastolic', 'heartRate', 'weight', 'height', 'o2Sat', 'oedema'] },
    { name: 'Echo / Imaging', fields: ['lvef', 'echoDate', 'lvdd', 'lvsd', 'eEPrime', 'ddGrade', 'rvsp', 'laStrain', 'rvFreeWallStrain', 'lvMassIndex', 'relativeWallThickness'] },
    { name: 'Laboratory', fields: ['ntProBNP', 'bnp', 'egfr', 'creatinine', 'potassium', 'sodium', 'hb', 'tft', 'hba1c', 'ferritin', 'transferrinSat', 'uricAcid', 'ldl', 'triglycerides', 'peakTropT', 'peakTropI', 'serumUrea', 'bun'] },
    { name: 'Medications', fields: ['diuretic', 'raasi', 'betaBlocker', 'digoxin', 'sglt2i', 'ivabradine', 'mra', 'aspirin', 'statin', 'noac', 'vki', 'ivIron'] },
    { name: 'QoL / Functional', fields: ['symptomTrajectory', 'eq5d', 'sixMWT', 'gripRight', 'gripLeft', 'education', 'kccq'] }
  ];

  const categoryAverages = {};
  hfCategories.forEach(cat => {
    let totalScoreForCat = 0;
    hfPatients.forEach(p => {
      const latest = visitMap.get(p.id);
      let filled = 0;
      cat.fields.forEach(f => {
        if (f in p) {
          const val = p[f];
          if (val !== undefined && val !== null && val !== '') filled++;
        } else if (latest && f in latest) {
          const val = latest[f];
          if (val !== undefined && val !== null && val !== '') {
            if (typeof val === 'object') {
              if (val.prescribed !== undefined && val.prescribed !== '') filled++;
              else if (Object.keys(val).length > 0) filled++;
            } else {
              filled++;
            }
          }
        }
      });
      totalScoreForCat += Math.round((filled / cat.fields.length) * 100);
    });
    categoryAverages[cat.name] = Math.round(totalScoreForCat / hfPatients.length);
  });

  console.log('\n--- LIVE COMPUTED BREAKDOWN ---');
  for (const [k, v] of Object.entries(categoryAverages)) {
    console.log(`${k.padEnd(20)}: ${v}%`);
  }

  const overall = Math.round(Object.values(categoryAverages).reduce((a, b) => a + b, 0) / 6);
  console.log(`\nOverall Completion   : ${overall}%`);

  const lvefVals = hfVisits.map(v => v.lvef).filter(v => typeof v === 'number');
  const avgLvef = Math.round(lvefVals.reduce((a,b) => a+b, 0) / lvefVals.length);
  console.log(`Avg LVEF             : ${avgLvef}% (from ${lvefVals.length} visits)`);

  const gdmtCount = hfVisits.filter(v => {
    return v.raasi?.prescribed === 'Yes' && v.betaBlocker?.prescribed === 'Yes' && v.mra?.prescribed === 'Yes' && v.sglt2i?.prescribed === 'Yes';
  }).length;
  console.log(`GDMT Rate (4-pillar) : ${Math.round((gdmtCount/hfVisits.length)*100)}% (${gdmtCount}/${hfVisits.length} patients on all 4 pillars)`);

  const nyha34Count = hfVisits.filter(v => v.nyha === 'III' || v.nyha === 'IV').length;
  console.log(`NYHA III-IV Rate     : ${Math.round((nyha34Count/hfVisits.length)*100)}% (${nyha34Count}/${hfVisits.length} in NYHA III or IV)`);
}

verifyRegistryHome().catch(console.error);
