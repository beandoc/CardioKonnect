import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, updateDoc } from "firebase/firestore";
import fs from "fs";

// Read .env.local manually
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

async function setEthnicity() {
  const snapshot = await getDocs(collection(db, "patients"));
  console.log(`Setting ethnicity = 'Indian' for ${snapshot.size} patients...`);
  
  for (const docSnap of snapshot.docs) {
    await updateDoc(doc(db, "patients", docSnap.id), {
      ethnicity: 'Indian',
      indianCitizen: true,
      updatedAt: new Date().toISOString()
    });
    console.log(`Updated ${docSnap.data().firstName} ${docSnap.data().lastName}: ethnicity = Indian, indianCitizen = true`);
  }
  console.log('Finished updating all patients.');
  process.exit(0);
}

setEthnicity();
