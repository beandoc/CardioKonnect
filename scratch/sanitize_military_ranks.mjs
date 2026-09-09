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

// Comprehensive military rank sanitization function
export function cleanMilitaryRanks(rawName) {
  if (!rawName) return '';
  let str = String(rawName).trim();

  // Remove relations like M/O, F/O, W/O, S/O, D/O, SELF
  str = str.replace(/\b(?:M\/O|F\/O|W\/O|S\/O|D\/O|SELF|EX|EX-|NCE)\b/gi, ' ');

  // Remove Military Ranks
  const militaryPatterns = [
    /\bMAJOR\s+GENERAL\b/gi,
    /\bMAJ\s+GEN\b/gi,
    /\bLIEUTENANT\s+COLONEL\b/gi,
    /\bLT\s+COL\b/gi,
    /\bBRIGADIER\b/gi,
    /\bBRIG\b/gi,
    /\bCOLONEL\b/gi,
    /\bCOL\b/gi,
    /\bMAJOR\b/gi,
    /\bMAJ\b/gi,
    /\bCAPTAIN\b/gi,
    /\bCAPT\b/gi,
    /\bLIEUTENANT\b/gi,
    /\bLT\b/gi,
    /\bSUBEDAR\s+MAJOR\b/gi,
    /\bSUB\s+MAJ\b/gi,
    /\bNAIB\s+SUBEDAR\b/gi,
    /\bNB\s+SUB\b/gi,
    /\bSUBEDAR\b/gi,
    /\bSUB\b/gi,
    /\bHAVILDAR\b/gi,
    /\bHAVALDAR\b/gi,
    /\bHAV\b/gi,
    /\bNAIK\b/gi,
    /\bNK\b/gi,
    /\bSEPOY\b/gi,
    /\bSEP\b/gi,
    /\bJCO\b/gi,
    /\bNCO\b/gi,
    /\bAIR\s+COMMODORE\b/gi,
    /\bGROUP\s+CAPTAIN\b/gi,
    /\bWING\s+COMMANDER\b/gi,
    /\bSQUADRON\s+LEADER\b/gi,
    /\bFLIGHT\s+LIEUTENANT\b/gi,
    /\bFLYING\s+OFFICER\b/gi,
    /\bCOMMODORE\b/gi,
    /\bCOMMANDER\b/gi,
    /\bADMIRAL\b/gi,
  ];

  for (const pattern of militaryPatterns) {
    str = str.replace(pattern, ' ');
  }

  // Handle specific hyphenated names like "K B LAL-PREMVATHI" -> "PREMVATHI LAL"
  if (str.includes('-')) {
    const parts = str.split('-').map(s => s.trim()).filter(Boolean);
    if (parts.length === 2 && parts[1].length > 2) {
      str = parts[1] + ' ' + parts[0].replace(/^[A-Z]\s+[A-Z]\s+/, '');
    }
  }

  // Clean extra dots, hyphens, and whitespace
  str = str.replace(/[.\-_]/g, ' ').replace(/\s+/g, ' ').trim();

  return str;
}

async function sanitizeAllPatients() {
  const pSnap = await getDocs(collection(db, "patients"));
  console.log(`Checking ${pSnap.size} patients in Firestore for military ranks...`);

  for (const pDoc of pSnap.docs) {
    const data = pDoc.data();
    const rawFullName = `${data.firstName || ''} ${data.lastName || ''}`.trim();
    const cleaned = cleanMilitaryRanks(rawFullName);

    const parts = cleaned.split(/\s+/);
    const newFirst = parts[0] || '';
    const newLast = parts.slice(1).join(' ') || '';

    console.log(`Original: "${rawFullName}"  --->  Cleaned: "${newFirst} ${newLast}"`);

    await updateDoc(doc(db, "patients", pDoc.id), {
      firstName: newFirst,
      lastName: newLast,
      updatedAt: new Date().toISOString()
    });
  }

  console.log('\nAll patient names successfully sanitized of military/army ranks.');
  process.exit(0);
}

sanitizeAllPatients().catch(err => {
  console.error(err);
  process.exit(1);
});
