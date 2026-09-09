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

async function syncTrueHidsAndSrNos() {
  const wb = XLSX.readFile('/Users/sachinsrivastava/Downloads/HF1.xlsx', { cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet);

  const pSnap = await getDocs(collection(db, "patients"));
  console.log(`Auditing ${pSnap.size} patients...`);

  for (const pDoc of pSnap.docs) {
    const pData = pDoc.data();
    const pId = pDoc.id;
    const name = String(pData.firstName || '').trim().toUpperCase();

    const row = rows.find(r => {
      const rowName = String(r['NAME'] || '').trim().toUpperCase();
      return rowName.includes(name) || name.includes(rowName);
    });

    if (!row) continue;

    const srNo = parseInt(row['SR. NO.'], 10) || undefined;
    const rawHid = String(row['HID NO.'] || '').trim();
    const realHid = (rawHid && rawHid !== 'undefined' && rawHid !== 'null' && rawHid !== '-') ? rawHid : '—';

    console.log(`${pData.firstName} ${pData.lastName}: SrNo = ${srNo}, True Column D HID = "${realHid}"`);

    await updateDoc(doc(db, "patients", pId), {
      srNo: srNo,
      mrn: realHid,
      updatedAt: new Date().toISOString()
    });
  }

  console.log('\nFinished updating all patients with exact Column D HIDs and distinct Serial Numbers.');
  process.exit(0);
}

syncTrueHidsAndSrNos().catch(err => {
  console.error(err);
  process.exit(1);
});
