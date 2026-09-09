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

async function syncBBBAndQRS() {
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

    let bbb = undefined;
    if (ecgRaw.includes('LBBB')) {
      bbb = 'LBBB';
    } else if (ecgRaw.includes('RBBB')) {
      bbb = 'RBBB';
    } else if (ecgRaw.includes('IVCD')) {
      bbb = 'IVCD';
    }

    const devRaw = String(row['DEVICE ( CRTD/AICD/PPM )'] || row['DEVICE'] || '').toUpperCase();
    const deviceList = [];
    if (devRaw.includes('CRTD') || devRaw.includes('CRT-D')) deviceList.push('CRT-D');
    if (devRaw.includes('CRT P') || devRaw.includes('CRT-P')) deviceList.push('CRT-P');
    if (devRaw.includes('AICD') || devRaw.includes('ICD')) deviceList.push('ICD');
    if (devRaw.includes('PPM') || devRaw.includes('PACEMAKER')) deviceList.push('PPM');

    console.log(`[SYNC] ${pData.firstName} ${pData.lastName}: LVEF=${pData.lvef} | ECG="${ecgRaw}" -> QRS=${qrsDuration}, BBB=${bbb}, Devices=[${deviceList.join(', ')}]`);

    // Update patient
    const pUpdates = {};
    if (bbb) pUpdates.bbb = bbb;
    if (deviceList.length) pUpdates.device = deviceList;
    if (Object.keys(pUpdates).length) {
      await updateDoc(doc(db, "patients", pId), pUpdates);
    }

    // Update visits
    const vSnap = await getDocs(collection(db, "patients", pId, "visits"));
    for (const vDoc of vSnap.docs) {
      const vUpdates = {};
      if (qrsDuration) vUpdates.qrsDuration = qrsDuration;
      if (bbb) vUpdates.bbb = bbb;
      if (deviceList.length) vUpdates.device = deviceList;
      if (Object.keys(vUpdates).length) {
        await updateDoc(doc(db, "patients", pId, "visits", vDoc.id), vUpdates);
      }
    }
  }

  console.log('Sync complete!');
}

syncBBBAndQRS();
