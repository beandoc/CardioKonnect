import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, writeBatch } from 'firebase/firestore';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const XLSX = require('xlsx');

const firebaseConfig = {
  apiKey: 'AIzaSyBl9MjJgsGqjdYqNVTQLzTgeysOSlsIF0U',
  authDomain: 'cardio-konnect-sachin-1.firebaseapp.com',
  projectId: 'cardio-konnect-sachin-1',
  storageBucket: 'cardio-konnect-sachin-1.firebasestorage.app',
  messagingSenderId: '855879428060',
  appId: '1:855879428060:web:4754ebe71646eb75b69119',
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// --- Helpers ---
function parseDate(val) {
  if (!val) return '';
  if (val instanceof Date) return val.toISOString().split('T')[0];
  const str = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.split('T')[0];
  const parts = str.split(/[/-]/);
  if (parts.length === 3) {
    let d = parseInt(parts[0], 10), m = parseInt(parts[1], 10), y = parseInt(parts[2], 10);
    if (y < 100) y += 2000;
    if (!isNaN(d) && !isNaN(m) && !isNaN(y)) return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
  }
  const d = new Date(str);
  if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  return '';
}

function parseMed(val) {
  if (!val) return { prescribed: '' };
  const s = String(val).trim();
  if (s.toUpperCase() === 'NO' || s.toUpperCase() === 'N' || s.toUpperCase() === 'NONE' || s === '-') return { prescribed: 'No' };
  return { prescribed: 'Yes', type: s, dose: s };
}

function clean(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  const res = Array.isArray(obj) ? [] : {};
  Object.keys(obj).forEach(key => {
    const val = obj[key];
    if (val !== undefined) res[key] = clean(val);
  });
  return res;
}

// --- Main ---
async function importHF1() {
  const filePath = '/Users/sachinsrivastava/Downloads/HF1.xlsx';
  console.log('Reading', filePath);
  const wb = XLSX.readFile(filePath, { cellDates: true });
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
  console.log(`Found ${rows.length} rows.`);

  const now = new Date().toISOString();
  const batch = writeBatch(db);
  let patientCount = 0;
  let visitCount = 0;

  for (const row of rows) {
    const srNo = row['SR. NO.'];
    if (!srNo) continue;

    const nameVal = String(row['NAME'] || '').trim();
    if (!nameVal) continue;

    const nameParts = nameVal.split(/\s+/);
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    const age = parseInt(row['AGE'], 10);
    let dob = '';
    if (!isNaN(age)) dob = `${new Date().getFullYear() - age}-01-01`;

    const gender = String(row['GENDER'] || '').trim().toUpperCase();
    const sex = gender === 'M' || gender === 'MALE' ? 'Male' : 'Female';
    const contact = String(row['PHONE'] || '').trim();
    const address = String(row['ADDRESS'] || '').trim();

    // Enrolment date
    const enrolmentDate = parseDate(row['ENROLMENT']) || parseDate(row['DOA']) || now.split('T')[0];

    // Comorbidities
    const hospVal = String(row['H/O OF HOSPITALIZATION'] || '').toUpperCase();
    const etVal = String(row['ETIOLOGY'] || '').toUpperCase();
    const dmVal = String(row['IF DM IS DIAGNOSED'] || '').toUpperCase();
    const lipidVal = String(row['IN CASE DYSLIPIDEMIA'] || '').toUpperCase();
    const mraVal = String(row['MRAs'] || '').toUpperCase();

    const comorbidDiabetes = (dmVal !== 'NO' && dmVal !== '');
    const comorbidCAD = hospVal.includes('CAD') || hospVal.includes('PCI') || hospVal.includes('CABG') || hospVal.includes('MI');
    const comorbidPriorPCI = hospVal.includes('PCI');
    const comorbidPriorCABG = hospVal.includes('CABG');
    const comorbidPriorMI = hospVal.includes('MI') || hospVal.includes('AWMI') || hospVal.includes('IWMI');
    const comorbidHypertension = hospVal.includes('HTN') || etVal.includes('HYPERTENSION');
    const comorbidCKD = hospVal.includes('CKD') || mraVal.includes('CKD');
    const comorbidCOPD = hospVal.includes('COPD');
    const comorbidAF = hospVal.includes('AF') || hospVal.includes('ATRIAL FIBRILLATION');
    const comorbidDyslipidemia = lipidVal !== 'NO' && lipidVal !== '';

    const comorbidities = [];
    if (comorbidHypertension) comorbidities.push('HTN');
    if (comorbidDiabetes) comorbidities.push('DM2');
    if (comorbidCAD) comorbidities.push('CAD');
    if (comorbidPriorMI) comorbidities.push('Prior MI');
    if (comorbidPriorPCI) comorbidities.push('Prior PCI');
    if (comorbidPriorCABG) comorbidities.push('Prior CABG');
    if (comorbidCKD) comorbidities.push('CKD');
    if (comorbidCOPD) comorbidities.push('COPD');
    if (comorbidAF) comorbidities.push('AF');
    if (comorbidDyslipidemia) comorbidities.push('Dyslipidemia');

    // NYHA
    const nyhaRaw = String(row['NYHA CLASS'] || '').trim().replace(/\s+/g, '');
    const nyha = ['I','II','III','IV'].includes(nyhaRaw) ? nyhaRaw : 'II';

    // LVEF & HF type
    const lvef = parseFloat(row['LVEF']) || undefined;
    let hfType = 'HFrEF';
    if (lvef !== undefined) {
      if (lvef >= 50) hfType = 'HFpEF';
      else if (lvef >= 40) hfType = 'HFmrEF';
    }

    // ECG
    const ecgUpper = String(row['ECG'] || '').toUpperCase();
    let bbb = '';
    if (ecgUpper.includes('LBBB')) bbb = 'LBBB';
    else if (ecgUpper.includes('RBBB')) bbb = 'RBBB';

    // Labs
    const ntProBNP = parseFloat(row['NT-Pro BNP']) || undefined;
    const potassium = parseFloat(row['POTASSIUM']) || undefined;
    const hb = parseFloat(row['HB']) || undefined;
    const weight = parseFloat(row['WEIGHT']) || undefined;
    const heartRate = parseInt(row['HR'], 10) || undefined;
    const sixMWT = parseInt(row['6MWT'], 10) || undefined;

    let bpSystolic, bpDiastolic;
    const bpParts = String(row['BP'] || '').split('/');
    if (bpParts.length === 2) {
      bpSystolic = parseInt(bpParts[0], 10) || undefined;
      bpDiastolic = parseInt(bpParts[1], 10) || undefined;
    }

    // Medications
    const diuretic = parseMed(row['DIURETICS']);
    const raasi = parseMed(row['ACEi/ARNi']);
    const betaBlocker = parseMed(row['BETA BLOCKERS']);
    const mra = parseMed(row['MRAs']);
    const digoxin = parseMed(row['DIGOXIN']);
    const ivabradine = parseMed(row['IVABRADINE']);
    const statin = lipidVal !== 'NO' && lipidVal !== '' ? { prescribed: 'Yes', type: String(row['IN CASE DYSLIPIDEMIA']).trim(), dose: String(row['IN CASE DYSLIPIDEMIA']).trim() } : { prescribed: 'No' };
    const antiArrhVal = String(row['ANTI-arrhythmic therapy'] || '').trim();
    const anticoagulation = (antiArrhVal.toUpperCase() !== 'NO' && antiArrhVal) ? antiArrhVal : '';
    const antiarrhythmic = (antiArrhVal.toUpperCase() !== 'NO' && antiArrhVal) ? antiArrhVal : '';

    // SGLT2i from DM field
    const dmDrug = String(row['IF DM IS DIAGNOSED'] || '').trim().toUpperCase();
    const sglt2i = (dmDrug.includes('DAPA') || dmDrug.includes('EMPA'))
      ? { prescribed: 'Yes', type: String(row['IF DM IS DIAGNOSED']).trim(), dose: String(row['IF DM IS DIAGNOSED']).trim() }
      : { prescribed: 'No' };

    // Device
    const deviceVal = String(row['DEVICE'] || '').toUpperCase();
    const icdPresence = deviceVal.includes('ICD');
    const crtPresence = deviceVal.includes('CRT');

    // Vaccination
    const vaccVal = String(row['VACCINATION'] || '').toUpperCase();
    const vaccInfluenza = vaccVal.includes('INFLUENZA') || vaccVal === 'DONE' ? 'Yes' : 'No';
    const vaccPneumo = vaccVal.includes('PNEUMO') || vaccVal === 'DONE' ? 'Yes' : 'No';

    // Grip
    const gripLeft = parseFloat(row['HARD GRIP TEST L HAND']) || undefined;
    const gripRight = parseFloat(row['R HAND']) || undefined;

    const etiologies = etVal.split(/[,\n]/).map(s => s.trim()).filter(Boolean);

    // --- Create Firestore Patient Doc ---
    const patientRef = doc(collection(db, 'patients'));

    const patientData = clean({
      firstName, lastName, dob, sex,
      mrn: `MRN-${1000 + srNo}`,
      contact, address, comorbidities,
      status: 'Active',
      consentStatus: 'Granted',
      studyConsented: true,
      indianCitizen: true,
      registryId: 'hf',
      hfConfirmationDate: enrolmentDate,
      hfType, nyha, lvef,
      visitCount: 1,
      lastVisitDate: enrolmentDate,
      age: !isNaN(age) ? age : undefined,
      comorbidHypertension, comorbidDiabetes, comorbidDyslipidemia,
      comorbidCAD, comorbidPriorMI, comorbidPriorPCI, comorbidPriorCABG,
      comorbidAF, comorbidCKD, comorbidCOPD,
      icdPresence, crtPresence,
      anticoagulation, antiarrhythmic,
      createdAt: now, updatedAt: now,
    });

    batch.set(patientRef, patientData);
    patientCount++;

    // --- Create Visit Doc ---
    const visitRef = doc(collection(db, 'patients', patientRef.id, 'visits'));
    const visitData = clean({
      patientId: patientRef.id,
      visitDate: enrolmentDate,
      visitType: 'Outpatient',
      weight, heartRate, bpSystolic, bpDiastolic,
      nyha, sixMWT, lvef, hfType,
      ntProBNP, potassium, hb,
      bbb,
      diuretic, raasi, betaBlocker, mra, sglt2i,
      statin, digoxin, ivabradine,
      noac: { prescribed: 'No' },
      vki: { prescribed: 'No' },
      aspirin: { prescribed: '' },
      fibrate: { prescribed: '' },
      pcsk9: { prescribed: '' },
      ivIron: { prescribed: '' },
      anticoagulation, antiarrhythmic,
      device: [],
      vaccInfluenza, vaccPneumo,
      gripLeft, gripRight,
      hospHistory: comorbidCAD || comorbidPriorMI ? 'Yes' : 'No',
      dischargeOutcome: '',
      clinicalNotes: `Etiology: ${etiologies.join(', ')}. H/O: ${String(row['H/O OF HOSPITALIZATION'] || '').trim()}.`,
      createdAt: now,
    });

    batch.set(visitRef, visitData);
    visitCount++;

    console.log(`Prepared: ${firstName} ${lastName} (MRN-${1000 + srNo}, LVEF ${lvef}%, NYHA ${nyha}, ${hfType})`);
  }

  console.log(`\nCommitting ${patientCount} patients and ${visitCount} visits to Firestore...`);
  await batch.commit();
  console.log(`✅ Done! ${patientCount} patients and ${visitCount} visits written to Firestore.`);
}

importHF1().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
