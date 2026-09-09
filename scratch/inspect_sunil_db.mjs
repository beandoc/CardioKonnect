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

async function inspectSunil() {
  const snapshot = await getDocs(collection(db, "patients"));
  let sunilDoc = null;
  snapshot.forEach(d => {
    if (d.data().firstName?.includes('SUNILKUMAR') || d.data().mrn === '110013694221') {
      sunilDoc = { id: d.id, ...d.data() };
    }
  });

  if (!sunilDoc) {
    console.log('Sunil not found!');
    process.exit(1);
  }

  console.log('Sunil Patient Doc:', JSON.stringify(sunilDoc, null, 2));

  const visitsSnap = await getDocs(collection(db, "patients", sunilDoc.id, "visits"));
  console.log(`Found ${visitsSnap.size} visits for Sunil:`);
  visitsSnap.forEach(v => {
    console.log(`Visit ID: ${v.id}`, JSON.stringify(v.data(), null, 2));
  });

  process.exit(0);
}

inspectSunil();
