import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, updateDoc } from "firebase/firestore";
import XLSX from "xlsx";
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

async function parseEcgAndHosp() {
  const wb = XLSX.readFile('/Users/sachinsrivastava/Downloads/HF1.xlsx', { cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet);

  const pSnap = await getDocs(collection(db, "patients"));

  for (const pDoc of pSnap.docs) {
    const pData = pDoc.data();
    const pId = pDoc.id;
    const name = String(pData.firstName || '').trim().toUpperCase();

    const row = rows.find(r => {
      const rowName = String(r['NAME'] || '').trim().toUpperCase();
      return rowName.includes(name) || name.includes(rowName);
    });

    if (!row) continue;

    const ecgRaw = String(row['ECG'] || '').toUpperCase();
    let qrsDuration = undefined;
    const qrsMatch = ecgRaw.match(/QRS\s*[:>]?\s*(\d+)/i) || ecgRaw.match(/QRs\s*(\d+)/i);
    if (qrsMatch) {
      qrsDuration = parseInt(qrsMatch[1], 10);
    }

    const hospRaw = String(row['H/O OF HOSPITALIZATION'] || '').trim();
    const hospHistory = hospRaw && hospRaw.toUpperCase() !== 'NO' && hospRaw !== '-' ? 'Yes' : 'No';

    console.log(`${pData.firstName} ${pData.lastName}: ECG="${ecgRaw}" -> QRS=${qrsDuration}, HospHistory=${hospHistory}`);

    const vSnap = await getDocs(collection(db, "patients", pId, "visits"));
    for (const vDoc of vSnap.docs) {
      const updates = {};
      if (qrsDuration) updates.qrsDuration = qrsDuration;
      updates.hospHistory = hospHistory;

      await updateDoc(doc(db, "patients", pId, "visits", vDoc.id), updates);
    }
  }

  console.log('\nFinished updating QRS duration and Hospitalization history across all visits.');
  process.exit(0);
}

parseEcgAndHosp().catch(e => {
  console.error(e);
  process.exit(1);
});
