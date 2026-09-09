import XLSX from 'xlsx';
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, getDoc } from "firebase/firestore";
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

async function inspectRamchandra() {
  const wb = XLSX.readFile('/Users/sachinsrivastava/Downloads/HF1.xlsx', { cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet);

  const ramExcel = rows.find(r => String(r['NAME']).includes('RAMCHANDRA') || String(r['SR. NO.']) === '126');
  console.log('=== 1. RAW EXCEL ROW FOR RAMCHANDRA BHOSALE ===');
  console.log(JSON.stringify(ramExcel, null, 2));

  const pSnap = await getDocs(collection(db, "patients"));
  let ramDoc = null;
  pSnap.forEach(d => {
    if (d.data().firstName?.includes('RAMCHANDRA') || d.data().mrn?.includes('126')) {
      ramDoc = { id: d.id, ...d.data() };
    }
  });

  console.log('\n=== 2. FIRESTORE PATIENT DOCUMENT ===');
  console.log(JSON.stringify(ramDoc, null, 2));

  if (ramDoc) {
    const vSnap = await getDocs(collection(db, "patients", ramDoc.id, "visits"));
    console.log(`\n=== 3. FIRESTORE VISITS (${vSnap.size} visits) ===`);
    vSnap.forEach(v => {
      console.log(`Visit ID: ${v.id}`, JSON.stringify(v.data(), null, 2));
    });
  }

  process.exit(0);
}

inspectRamchandra();
