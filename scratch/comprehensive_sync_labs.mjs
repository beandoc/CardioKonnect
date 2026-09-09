import XLSX from 'xlsx';
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, updateDoc } from "firebase/firestore";
import fs from "fs";

const envContent = fs.readFileSync(".env.local", "utf8");
const envVars = {};
envContent.split("\n").forEach(line => {
  const [k, ...v] = line.split("=");
  if (k && v.length) envVars[k.trim()] = v.join("=").trim();
});

const firebaseConfig = {
  apiKey: envVars.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: envVars.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: envVars.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: envVars.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: envVars.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: envVars.NEXT_PUBLIC_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

function calculateCKDEPI_eGFR(age, sex, creatinine) {
  if (!age || !creatinine || creatinine <= 0) return null;
  const isFemale = String(sex).toLowerCase().includes('female') || String(sex).toLowerCase() === 'f';
  const kappa = isFemale ? 0.7 : 0.9;
  const alpha = isFemale ? -0.241 : -0.302;
  const genderMultiplier = isFemale ? 1.012 : 1.0;
  const scrOverKappa = creatinine / kappa;
  const minTerm = Math.pow(Math.min(scrOverKappa, 1), alpha);
  const maxTerm = Math.pow(Math.max(scrOverKappa, 1), -1.200);
  const ageTerm = Math.pow(0.9938, age);
  const rawEgfr = 142 * minTerm * maxTerm * ageTerm * genderMultiplier;
  return Math.round(rawEgfr * 10) / 10;
}

async function comprehensiveSync() {
  const wb = XLSX.readFile('/Users/sachinsrivastava/Downloads/HF1.xlsx', { cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet);

  const pSnap = await getDocs(collection(db, "patients"));

  for (const pDoc of pSnap.docs) {
    const pData = pDoc.data();
    const pId = pDoc.id;
    const mrn = String(pData.mrn || '').trim();
    const name = String(pData.firstName || '').trim().toUpperCase();

    const row = rows.find(r => {
      const rowHid = String(r['HID NO.'] || '').trim();
      const rowName = String(r['NAME'] || '').trim().toUpperCase();
      return (rowHid && rowHid === mrn) || (rowName && (rowName.includes(name) || name.includes(rowName)));
    });

    if (!row) continue;

    const age = parseInt(row['AGE'], 10) || pData.age || 60;
    const sex = String(row['GENDER'] || pData.sex || 'M').toUpperCase().includes('F') ? 'Female' : 'Male';

    const creatVal = parseFloat(row['CREAT']) || parseFloat(row['CREATININE']) || undefined;
    let egfrVal = parseFloat(row['eGFR']) || parseFloat(row['EGFR']) || undefined;
    if (!egfrVal && creatVal) {
      egfrVal = calculateCKDEPI_eGFR(age, sex, creatVal);
    }

    const kVal = parseFloat(row['POTASSIUM']) || undefined;
    const bpVal = String(row['BP'] || '').trim();
    let bpSys = undefined, bpDia = undefined;
    if (bpVal.includes('/')) {
      const parts = bpVal.split('/');
      bpSys = parseInt(parts[0], 10) || undefined;
      bpDia = parseInt(parts[1], 10) || undefined;
    }
    const hr = parseInt(row['HR'], 10) || undefined;
    const sixMWT = parseInt(row['6MWT'], 10) || undefined;
    const ntProBNP = parseFloat(row['NT-Pro BNP']) || undefined;
    const lvef = parseFloat(row['LVEF']) || undefined;

    console.log(`Syncing ${pData.firstName} ${pData.lastName}: Creat=${creatVal}, eGFR=${egfrVal}, K=${kVal}, BP=${bpSys}/${bpDia}, HR=${hr}, 6MWT=${sixMWT}, NT-BNP=${ntProBNP}`);

    const visitsSnap = await getDocs(collection(db, "patients", pId, "visits"));
    // Update all visits with baseline labs if missing
    for (const vDoc of visitsSnap.docs) {
      const vData = vDoc.data();
      const updates = {};
      if (creatVal && !vData.creatinine) updates.creatinine = creatVal;
      if (egfrVal && !vData.egfr) updates.egfr = egfrVal;
      if (kVal && !vData.potassium) updates.potassium = kVal;
      if (bpSys && !vData.bpSystolic) updates.bpSystolic = bpSys;
      if (bpDia && !vData.bpDiastolic) updates.bpDiastolic = bpDia;
      if (hr && !vData.heartRate) updates.heartRate = hr;
      if (lvef && !vData.lvef) updates.lvef = lvef;
      if (sixMWT && !vData.sixMWT) updates.sixMWT = sixMWT;
      if (ntProBNP && !vData.ntProBNP) updates.ntProBNP = ntProBNP;

      if (Object.keys(updates).length > 0) {
        await updateDoc(doc(db, "patients", pId, "visits", vDoc.id), updates);
        console.log(`  Updated visit ${vDoc.id} with ${Object.keys(updates).join(', ')}`);
      }
    }
  }

  console.log('Finished comprehensive sync!');
  process.exit(0);
}

comprehensiveSync();
