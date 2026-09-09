import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, updateDoc, addDoc } from "firebase/firestore";
import XLSX from "xlsx";
import fs from "fs";

// Read .env.local
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

function cleanUndefined(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  const res = Array.isArray(obj) ? [] : {};
  Object.keys(obj).forEach(key => {
    const val = obj[key];
    if (val !== undefined) {
      res[key] = cleanUndefined(val);
    }
  });
  return res;
}

function parseExcelDate(val) {
  if (!val) return '';
  if (val instanceof Date) return val.toISOString().split('T')[0];
  const str = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const parts = str.split(/[/-]/);
  if (parts.length === 3) {
    let day = parseInt(parts[0], 10);
    let month = parseInt(parts[1], 10);
    let year = parseInt(parts[2], 10);
    if (year < 100) year += 2000;
    if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }
  const d = new Date(str);
  if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  return '';
}

async function syncAllData() {
  const wb = XLSX.readFile('/Users/sachinsrivastava/Downloads/HF1.xlsx', { cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet);
  console.log(`Loaded ${rows.length} rows from Excel.`);

  const patientsSnap = await getDocs(collection(db, "patients"));
  console.log(`Found ${patientsSnap.size} patients in Firestore.`);

  for (const pDoc of patientsSnap.docs) {
    const pData = pDoc.data();
    const pId = pDoc.id;
    const mrn = String(pData.mrn || '').trim();
    const name = String(pData.firstName || '').trim().toUpperCase();

    // Match row by Column D HID NO or NAME
    const row = rows.find(r => {
      const rowHid = String(r['HID NO.'] || '').trim();
      const rowName = String(r['NAME'] || '').trim().toUpperCase();
      return (rowHid && rowHid === mrn) || (rowName && (rowName.includes(name) || name.includes(rowName)));
    });

    if (!row) {
      console.log(`No matching Excel row for ${pData.firstName} ${pData.lastName} (MRN: ${mrn})`);
      continue;
    }

    console.log(`\n=== Processing ${pData.firstName} ${pData.lastName} (HID: ${row['HID NO.']}) ===`);

    const doa = parseExcelDate(row['DOA']) || '2026-09-08';
    const dod = parseExcelDate(row['DOD']);
    const weight = parseFloat(row['WEIGHT']) || undefined;
    const hr = parseInt(row['HR'], 10) || undefined;
    const sixMWT = parseInt(row['6MWT'], 10) || undefined;
    const lvef = parseFloat(row['LVEF']) || undefined;
    const ntProBNP = parseFloat(row['NT-Pro BNP']) || undefined;
    const hb = parseFloat(row['HB']) || undefined;
    const mcv = parseFloat(row['MCV']) || undefined;
    const hba1c = parseFloat(row['HbA1C']) || undefined;
    const kVal = parseFloat(row['POTASSIUM']) || undefined;
    const egfrVal = parseFloat(row['eGFR']) || undefined;

    // Blood pressure
    let bpSystolic = undefined;
    let bpDiastolic = undefined;
    const bpVal = String(row['BP'] || '').trim();
    const bpParts = bpVal.split('/');
    if (bpParts.length === 2) {
      bpSystolic = parseInt(bpParts[0], 10) || undefined;
      bpDiastolic = parseInt(bpParts[1], 10) || undefined;
    }

    // NYHA
    const nyhaStr = String(row['NYHA CLASS'] || '').trim();
    const nyha = (nyhaStr === 'I' || nyhaStr === 'II' || nyhaStr === 'III' || nyhaStr === 'IV') ? nyhaStr : 'II';

    // Phenotype
    const typeOfHF = String(row['TYPE OF HF'] || '').trim().toUpperCase();
    const hfType = typeOfHF.includes('REDUCED') ? 'HFrEF' : (typeOfHF.includes('MID') ? 'HFmrEF' : (typeOfHF.includes('PRESERVED') ? 'HFpEF' : (lvef && lvef <= 40 ? 'HFrEF' : 'HFrEF')));

    // Etiology
    const rawEtiology = String(row['ETIOLOGY'] || '').trim();
    const etiologyList = rawEtiology ? rawEtiology.split(/[,\n/]/).map(s => s.trim()).filter(Boolean) : ['Ischemic'];

    // Rhythm from ECG
    const ecgRaw = String(row['ECG'] || '').trim();
    let rhythm = 'Sinus Rhythm';
    if (ecgRaw.toUpperCase().includes('AF') || ecgRaw.toUpperCase().includes('ATRIAL FIB')) {
      rhythm = 'Atrial Fibrillation';
    } else if (ecgRaw) {
      rhythm = `Sinus Rhythm (${ecgRaw})`;
    }

    // TFT
    const tftRaw = String(row['TFT'] || '').trim();
    let tftNum = undefined;
    if (/^[\d.]+$/.test(tftRaw)) {
      tftNum = parseFloat(tftRaw);
    }

    // Follow-up date: default 3 months from DOA
    const dObj = new Date(doa);
    dObj.setDate(dObj.getDate() + 90);
    const followupDate = dObj.toISOString().split('T')[0];

    // Update patient root level
    await updateDoc(doc(db, "patients", pId), cleanUndefined({
      lvef: lvef ?? pData.lvef,
      hfType: hfType ?? pData.hfType,
      nyha: nyha ?? pData.nyha,
      indexEtiology: etiologyList,
      lastVisitDate: dod || doa,
      updatedAt: new Date().toISOString()
    }));

    // Check existing visits
    const visitsSnap = await getDocs(collection(db, "patients", pId, "visits"));
    if (visitsSnap.size > 0) {
      const v0 = visitsSnap.docs[0];
      await updateDoc(doc(db, "patients", pId, "visits", v0.id), cleanUndefined({
        lvef: lvef ?? v0.data().lvef,
        hfType: hfType ?? v0.data().hfType,
        nyha: nyha ?? v0.data().nyha,
        rhythm: rhythm,
        etiology: etiologyList,
        ntProBNP: ntProBNP ?? v0.data().ntProBNP,
        egfr: egfrVal ?? v0.data().egfr,
        potassium: kVal ?? v0.data().potassium,
        tft: tftNum ?? v0.data().tft,
        hb: hb ?? v0.data().hb,
        mcv: mcv ?? v0.data().mcv,
        hba1c: hba1c ?? v0.data().hba1c,
        weight: weight ?? v0.data().weight,
        bpSystolic: bpSystolic ?? v0.data().bpSystolic,
        bpDiastolic: bpDiastolic ?? v0.data().bpDiastolic,
        heartRate: hr ?? v0.data().heartRate,
        sixMWT: sixMWT ?? v0.data().sixMWT,
        followupDate: followupDate,
        dischargeDate: dod || undefined,
        clinicalNotes: `Etiology: ${etiologyList.join(', ')}. ECG: ${ecgRaw}. H/O: ${row['H/O OF HOSPITALIZATION'] || 'None'}.`
      }));
      console.log(`Updated visit ${v0.id} with rich clinical data.`);

      // Check if 3-month follow-up visit exists or should be added
      const fuGripLeft = parseFloat(row['3 MONTHS FU L HAND']) || undefined;
      const fuWeight = parseFloat(row['WEIGHT_1']) || undefined;
      const fu6MWT = parseInt(row['6MWT_1'], 10) || undefined;
      const fuNtBnp = parseFloat(row['NT proBNP']) || undefined;
      const fuEcho = parseFloat(row['ECHO']) || undefined;

      if (fuGripLeft || fuWeight || fu6MWT || fuNtBnp || fuEcho) {
        if (visitsSnap.size > 1) {
          const v1 = visitsSnap.docs[1];
          await updateDoc(doc(db, "patients", pId, "visits", v1.id), cleanUndefined({
            weight: fuWeight ?? v1.data().weight,
            sixMWT: fu6MWT ?? v1.data().sixMWT,
            ntProBNP: fuNtBnp ?? v1.data().ntProBNP,
            lvef: fuEcho ?? v1.data().lvef,
            gripLeft: fuGripLeft ?? v1.data().gripLeft,
            gripRight: parseFloat(row['R HAND_1']) || v1.data().gripRight,
            visitType: 'OPD',
            clinicalNotes: '3-Month Functional Follow-up Visit'
          }));
          console.log(`Updated 3-month follow-up visit ${v1.id}.`);
        } else {
          await addDoc(collection(db, "patients", pId, "visits"), cleanUndefined({
            patientId: pId,
            visitDate: followupDate,
            visitType: 'OPD',
            weight: fuWeight,
            sixMWT: fu6MWT,
            ntProBNP: fuNtBnp,
            lvef: fuEcho,
            gripLeft: fuGripLeft,
            gripRight: parseFloat(row['R HAND_1']) || undefined,
            hfType: hfType,
            nyha: nyha,
            clinicalNotes: '3-Month Functional Follow-up Visit',
            createdAt: new Date().toISOString()
          }));
          console.log(`Created 3-month follow-up visit for ${pData.firstName}`);
        }
      }
    }
  }

  console.log('\nFinished all updates successfully!');
  process.exit(0);
}

syncAllData().catch(err => {
  console.error('Error during sync:', err);
  process.exit(1);
});
