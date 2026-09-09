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

const militaryPatterns = [
  /\bMAJOR\s+GENERAL\b/gi, /\bMAJ\s+GEN\b/gi, /\bLIEUTENANT\s+COLONEL\b/gi, /\bLT\s+COL\b/gi,
  /\bBRIGADIER\b/gi, /\bBRIG\b/gi, /\bCOLONEL\b/gi, /\bCOL\b/gi, /\bMAJOR\b/gi, /\bMAJ\b/gi,
  /\bCAPTAIN\b/gi, /\bCAPT\b/gi, /\bLIEUTENANT\b/gi, /\bLT\b/gi, /\bSUBEDAR\s+MAJOR\b/gi,
  /\bSUB\s+MAJ\b/gi, /\bNAIB\s+SUBEDAR\b/gi, /\bNB\s+SUB\b/gi, /\bSUBEDAR\b/gi, /\bSUB\b/gi,
  /\bHAVILDAR\b/gi, /\bHAVALDAR\b/gi, /\bHAV\b/gi, /\bNAIK\b/gi, /\bNK\b/gi, /\bSEPOY\b/gi,
  /\bSEP\b/gi, /\bJCO\b/gi, /\bNCO\b/gi, /\bARMY\b/gi, /\bMILITARY\b/gi, /\bDEFENCE\b/gi
];

async function checkAllNotes() {
  const pSnap = await getDocs(collection(db, "patients"));
  for (const p of pSnap.docs) {
    const vSnap = await getDocs(collection(db, "patients", p.id, "visits"));
    for (const v of vSnap.docs) {
      const data = v.data();
      let notes = data.clinicalNotes || '';
      let changed = false;
      for (const pat of militaryPatterns) {
        if (pat.test(notes)) {
          notes = notes.replace(pat, '');
          changed = true;
        }
      }
      if (changed) {
        await updateDoc(doc(db, "patients", p.id, "visits", v.id), {
          clinicalNotes: notes.replace(/\s+/g, ' ').trim()
        });
        console.log(`Sanitized notes in visit ${v.id}`);
      }
    }
  }
  console.log('Finished checking all clinical notes.');
  process.exit(0);
}

checkAllNotes();
