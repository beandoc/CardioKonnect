import fs from 'fs'
import type { Patient, Visit, MedEntry } from './types'
import * as XLSX from 'xlsx'

// Helper to format date relative to today or as ISO strings
function parseExcelDate(val: any): string {
  if (!val) return '';
  if (val instanceof Date) {
    return val.toISOString().split('T')[0];
  }
  const str = String(val).trim();
  
  // Check if it's already in YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }

  // Try parsing DD/MM/YYYY or DD-MM-YYYY
  const parts = str.split(/[/-]/);
  if (parts.length === 3) {
    let day = parseInt(parts[0], 10);
    let month = parseInt(parts[1], 10);
    let year = parseInt(parts[2], 10);
    if (year < 100) year += 2000; // handle 2-digit years
    if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split('T')[0];
  }
  return '';
}

function cleanUndefined(obj: any): any {
  if (obj === null || typeof obj !== 'object') return obj
  const res = Array.isArray(obj) ? [] : {} as any
  Object.keys(obj).forEach(key => {
    const val = obj[key]
    if (val !== undefined) {
      res[key] = cleanUndefined(val)
    }
  })
  return res
}

/**
 * clearAllPatients — no-op on server side (client handles localStorage clearing).
 * Firestore clearing must be done via Firebase Console or Admin SDK.
 */
export async function clearAllPatients(): Promise<void> {
  console.log('[excelSeeder] clearAllPatients: skipping Firestore (no server-side auth). Client will clear localStorage.')
}

export async function seedRealPatientsFromExcel(): Promise<{ patientsCount: number; visitsCount: number; patients: Patient[]; visits: Visit[] }> {
  const filePath = '/Users/sachinsrivastava/Desktop/HF.xlsx';
  if (!fs.existsSync(filePath)) {
    throw new Error(`Excel file not found at ${filePath}`);
  }

  console.log('[excelSeeder] Reading Excel file from:', filePath);
  const fileBuffer = fs.readFileSync(filePath);
  const wb = XLSX.read(fileBuffer, { type: 'buffer', cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<any>(ws);
  console.log(`[excelSeeder] Parsed ${rows.length} rows from Excel sheet.`);

  return parseExcelRows(rows);
}

import { cleanMilitaryRanks, splitPatientName } from './utils'

function clampOrUndefined(val: number | undefined, min: number, max: number): number | undefined {
  if (val === undefined || isNaN(val)) return undefined;
  if (val < min || val > max) return undefined;
  return val;
}

export function parseExcelRows(rows: any[]): { patientsCount: number; visitsCount: number; patients: Patient[]; visits: Visit[] } {
  let patientsCount = 0;
  let visitsCount = 0;
  const patients: Patient[] = [];
  const visits: Visit[] = [];
  const patientRegistryMap = new Map<string, Patient>();

  for (const row of rows) {
    const srNo = row['SR. NO.'];
    if (!srNo) continue;

    const rawName = String(row['NAME'] || '').trim();
    const nameVal = cleanMilitaryRanks(rawName);
    if (!nameVal || nameVal.toLowerCase() === 'unknown' || nameVal.toLowerCase() === 'nil' || nameVal === '-') {
      continue;
    }
    const { firstName, lastName } = splitPatientName(nameVal);

    const doa = parseExcelDate(row['DOA']);
    const dod = parseExcelDate(row['DOD']);

    const rawAge = parseInt(row['AGE'], 10);
    const age = clampOrUndefined(rawAge, 0, 120);
    let dob = '';
    if (doa && age !== undefined) {
      const doaYear = new Date(doa).getFullYear();
      if (!isNaN(doaYear)) {
        dob = `${doaYear - age}-01-01`;
      }
    } else if (age !== undefined) {
      dob = `${new Date().getFullYear() - age}-01-01`;
    }
    // Do NOT invent '1970-01-01' when age or DOA is absent

    const gender = String(row['GENDER'] || '').trim().toUpperCase();
    let sex: 'Male' | 'Female' | 'Other' | 'Unknown' = 'Unknown';
    if (gender === 'M' || gender === 'MALE') {
      sex = 'Male';
    } else if (gender === 'F' || gender === 'FEMALE') {
      sex = 'Female';
    } else if (gender === 'O' || gender === 'OTHER') {
      sex = 'Other';
    }

    const contact = String(row['PHONE'] || '').trim();
    const address = String(row['ADDRESS'] || '').trim();

    // Map comorbidities & histories using strict word-boundary matching
    const dmVal = String(row['IF DM IS DIAGNOSED'] || '').trim().toUpperCase();
    const hospVal = String(row['H/O OF HOSPITALIZATION'] || '').trim().toUpperCase();
    const etVal = String(row['ETIOLOGY'] || '').trim().toUpperCase();
    const mraVal = String(row['MRAs'] || '').trim().toUpperCase();
    const lipidVal = String(row['IN CASE DYSLIPIDEMIA'] || '').trim().toUpperCase();

    const hasWord = (text: string, words: string[]) => {
      const pattern = new RegExp(`\\b(${words.join('|')})\\b`, 'i');
      return pattern.test(text);
    };

    const comorbidDiabetes = (dmVal !== 'NO' && dmVal !== '' && !dmVal.includes('NIL')) || hasWord(hospVal, ['DM', 'DM2', 'T2DM', 'T1DM', 'DIABETES', 'DIABETIC']);
    const comorbidPriorPCI = hasWord(hospVal, ['PCI', 'PTCA', 'STENT', 'STENTING']);
    const comorbidPriorCABG = hasWord(hospVal, ['CABG', 'BYPASS']);
    const comorbidPriorMI = hasWord(hospVal, ['MI', 'AWMI', 'IWMI', 'ASWMI', 'STEMI', 'NSTEMI', 'INFARCTION']);
    const comorbidCAD = comorbidPriorPCI || comorbidPriorCABG || comorbidPriorMI || hasWord(hospVal, ['CAD', 'IHD', 'CORONARY', 'ISCHEMIC', 'ISCHAEMIC', 'ANGINA', 'CAG']);
    const comorbidHypertension = hasWord(hospVal, ['HYPERTENSION', 'HTN', 'HYPERTENSIVE']) || hasWord(etVal, ['HYPERTENSION', 'HTN']);
    const comorbidCKD = hasWord(hospVal, ['CKD', 'ESRD', 'RENAL', 'KIDNEY']) || hasWord(mraVal, ['CKD']);
    const comorbidCOPD = hasWord(hospVal, ['COPD', 'COAD', 'ASTHMA']);
    const comorbidAF = hasWord(hospVal, ['AF', 'AFIB', 'ATRIAL FIBRILLATION']);
    const comorbidDyslipidemia = (lipidVal !== 'NO' && lipidVal !== '' && !lipidVal.includes('NIL')) || hasWord(hospVal, ['DYSLIPIDEMIA', 'HYPERLIPIDEMIA', 'LIPID']);

    const comorbidities: string[] = [];
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

    // Parse ECG
    let bbb: 'LBBB' | 'RBBB' | 'IVCD' | '' = '';
    const ecgUpper = String(row['ECG'] || '').toUpperCase();
    if (ecgUpper.includes('LBBB')) bbb = 'LBBB';
    else if (ecgUpper.includes('RBBB')) bbb = 'RBBB';
    else if (ecgUpper.includes('IVCD')) bbb = 'IVCD';

    let qrsDuration: number | undefined = undefined;
    const qrsMatch = ecgUpper.match(/QRS\s*(\d+)/i);
    if (qrsMatch) {
      qrsDuration = parseInt(qrsMatch[1], 10);
    }

    let qtcInterval: number | undefined = undefined;
    const qtcMatch = ecgUpper.match(/QTC\s*(\d+)/i);
    if (qtcMatch) {
      qtcInterval = parseInt(qtcMatch[1], 10);
    }

    // Parse Labs
    let tft: number | undefined = undefined;
    const tftVal = String(row['TFT'] || '').trim();
    const tshMatch = tftVal.match(/TSH\s*([\d.]+)/i);
    if (tshMatch) {
      tft = parseFloat(tshMatch[1]);
    } else if (/^[\d.]+$/.test(tftVal)) {
      tft = parseFloat(tftVal);
    }

    let potassium: number | undefined = undefined;
    const kVal = String(row['POTASSIUM'] || '').trim();
    if (/^[\d.]+$/.test(kVal)) {
      potassium = parseFloat(kVal);
    }

    let hb: number | undefined = undefined;
    let ferritin: number | undefined = undefined;
    const hbVal = String(row['HB'] || '').trim().toUpperCase();
    const hbMatch = hbVal.match(/^([\d.]+)/);
    if (hbMatch) {
      hb = parseFloat(hbMatch[1]);
    }
    const ferritinMatch = hbVal.match(/FERRITIN\s*([\d.]+)/i);
    if (ferritinMatch) {
      ferritin = parseFloat(ferritinMatch[1]);
    }

    let mcv: number | undefined = undefined;
    const mcvVal = String(row['MCV'] || '').trim();
    if (/^[\d.]+$/.test(mcvVal)) {
      mcv = parseFloat(mcvVal);
    }

    let egfr: number | undefined = undefined;
    const egfrVal = String(row['eGFR'] || '').trim();
    if (/^[\d.]+$/.test(egfrVal)) {
      egfr = parseFloat(egfrVal);
    }

    let ntProBNP: number | undefined = undefined;
    const ntVal = String(row['NT-Pro BNP'] || '').trim();
    if (/^[\d.]+$/.test(ntVal)) {
      ntProBNP = parseFloat(ntVal);
    }

    // Parse meds
    const parseMedEntry = (val: any, label: string): MedEntry => {
      if (!val) return { prescribed: '' };
      const s = String(val).trim();
      if (s.toUpperCase() === 'NO' || s.toUpperCase() === 'N' || s.toUpperCase() === 'NONE') {
        return { prescribed: 'No' };
      }
      return { prescribed: 'Yes', type: s, dose: s };
    };

    // Diuretic
    const diureticVal = row['DIURETICS'];
    let dType = undefined;
    let dDose = undefined;
    if (diureticVal && String(diureticVal).toUpperCase() !== 'NO') {
      const s = String(diureticVal).trim();
      if (s.toLowerCase().includes('lasix')) { dType = 'Lasix'; dDose = s; }
      else if (s.toLowerCase().includes('lasilactone')) { dType = 'Lasilactone'; dDose = s; }
      else if (s.toLowerCase().includes('dytor')) { dType = 'Dytor'; dDose = s; }
      else { dType = s; dDose = s; }
    }
    const diuretic: MedEntry = diureticVal ? { prescribed: dType ? 'Yes' : 'No', type: dType, dose: dDose } : { prescribed: '' };

    // RAASi
    const raasiVal = row['ACEi/ARNi'];
    let rType = undefined;
    let rDose = undefined;
    if (raasiVal && String(raasiVal).toUpperCase() !== 'NO') {
      const s = String(raasiVal).trim();
      if (s.toLowerCase().includes('vymada')) { rType = 'Vymada (ARNI)'; rDose = s; }
      else if (s.toLowerCase().includes('ramipril')) { rType = 'Ramipril'; rDose = s; }
      else if (s.toLowerCase().includes('telma')) { rType = 'Telmisartan'; rDose = s; }
      else { rType = s; rDose = s; }
    }
    const raasi: MedEntry = raasiVal ? { prescribed: rType ? 'Yes' : 'No', type: rType, dose: rDose } : { prescribed: '' };

    // Beta Blocker
    const bbVal = row['BETA BLOCKERS'];
    let bType = undefined;
    let bDose = undefined;
    if (bbVal && String(bbVal).toUpperCase() !== 'NO') {
      const s = String(bbVal).trim();
      if (s.toLowerCase().includes('bisoprolol')) { bType = 'Bisoprolol'; bDose = s; }
      else if (s.toLowerCase().includes('carvedilol')) { bType = 'Carvedilol'; bDose = s; }
      else if (s.toLowerCase().includes('met xl')) { bType = 'Metoprolol XL'; bDose = s; }
      else if (s.toLowerCase().includes('metoprolol')) { bType = 'Metoprolol'; bDose = s; }
      else { bType = s; bDose = s; }
    }
    const betaBlocker: MedEntry = bbVal ? { prescribed: bType ? 'Yes' : 'No', type: bType, dose: bDose } : { prescribed: '' };

    // MRA
    const mraValRaw = row['MRAs'];
    let mType = undefined;
    let mDose = undefined;
    if (mraValRaw && String(mraValRaw).toUpperCase() !== 'NO') {
      const s = String(mraValRaw).trim();
      if (s.toLowerCase().includes('aldactone')) { mType = 'Aldactone (Spironolactone)'; mDose = s; }
      else if (s.toLowerCase().includes('eplerenone')) { mType = 'Eplerenone'; mDose = s; }
      else { mType = s; mDose = s; }
    }
    const mra: MedEntry = mraValRaw ? { prescribed: mType ? 'Yes' : 'No', type: mType, dose: mDose } : { prescribed: '' };

    // SGLT2i
    const dmValRaw = row['IF DM IS DIAGNOSED'];
    let sType = undefined;
    let sDose = undefined;
    if (dmValRaw && String(dmValRaw).toUpperCase() !== 'NO') {
      const s = String(dmValRaw).trim();
      if (s.toLowerCase().includes('dapagliflozin')) { sType = 'Dapagliflozin'; sDose = s; }
      else if (s.toLowerCase().includes('empagliflozin')) { sType = 'Empagliflozin'; sDose = s; }
      else if (s.toLowerCase().includes('empa')) { sType = 'Empagliflozin'; sDose = s; }
    }
    const sglt2i: MedEntry = sType ? { prescribed: 'Yes', type: sType, dose: sDose } : { prescribed: 'No' };

    // Statin
    const lipidValRaw = row['IN CASE DYSLIPIDEMIA'];
    let statinType = undefined;
    let statinDose = undefined;
    if (lipidValRaw && String(lipidValRaw).toUpperCase() !== 'NO') {
      const s = String(lipidValRaw).trim();
      if (s.toLowerCase().includes('atorvas')) { statinType = 'Atorvastatin'; statinDose = s; }
      else if (s.toLowerCase().includes('atorva')) { statinType = 'Atorvastatin'; statinDose = s; }
      else if (s.toLowerCase().includes('rosuvas')) { statinType = 'Rosuvastatin'; statinDose = s; }
    }
    const statin = statinType ? { prescribed: 'Yes' as const, type: statinType, dose: statinDose } : { prescribed: 'No' as const };

    // Aspirin / Antiplatelets
    const antVal = row['ANTICOGULANT'];
    let aspPres: 'Yes' | 'No' | '' = '';
    let aspDose = undefined;
    if (antVal && String(antVal).toUpperCase() !== 'NO') {
      const s = String(antVal).trim();
      if (s.toLowerCase().includes('aspirin') || s.toLowerCase().includes('asprin') || s.toLowerCase().includes('ecosprin')) {
        aspPres = 'Yes';
        const m = s.match(/(?:aspirin|asprin|ecosprin)\s*(\d+)/i);
        if (m) aspDose = m[1] + 'mg';
      } else {
        aspPres = 'Yes';
      }
    }
    const aspirin = { prescribed: aspPres, dose: aspDose };

    // Digoxin
    const digoxin = parseMedEntry(row['DIGOXIN'], 'Digoxin');
    // Ivabradine
    const ivabradine = parseMedEntry(row['IVABRADINE'], 'Ivabradine');

    // Antiarrhythmics & anticoagulants
    const aaVal = row['ANTI-arrhythmic therapy'];
    let noac: any = { prescribed: 'No' };
    let vki: any = { prescribed: 'No' };
    let anticoagulation = '';
    let antiarrhythmic = '';
    if (aaVal && String(aaVal).toUpperCase() !== 'NO') {
      const s = String(aaVal).trim();
      if (s.toLowerCase().includes('apixaban') || s.toLowerCase().includes('apixban')) {
        noac = { prescribed: 'Yes', type: 'Apixaban', dose: s };
        anticoagulation = 'Apixaban';
      }
      if (s.toLowerCase().includes('acitrome')) {
        vki = { prescribed: 'Yes', type: 'Acitrom', dose: s };
        anticoagulation = 'Acitrom';
      }
      if (s.toLowerCase().includes('amodarone') || s.toLowerCase().includes('amiodarone')) {
        antiarrhythmic = 'Amiodarone';
      }
    }

    // Devices & vaccinations
    const devList: string[] = [];
    const devVal = String(row['DEVICE'] || '').toUpperCase();
    if (devVal.includes('AICD') || devVal.includes('ICD')) devList.push('ICD');
    if (devVal.includes('CRTD') || devVal.includes('CTRD')) devList.push('CRT-D');
    const icdPresence = devVal.includes('AICD') || devVal.includes('ICD');
    const crtPresence = devVal.includes('CRTD') || devVal.includes('CTRD');

    const vaccVal = String(row['VACCINATION'] || '').toUpperCase();
    const vaccInfluenza = vaccVal.includes('INFLUENZA') || vaccVal.includes('FLU') ? 'Yes' : 'No';
    const vaccPneumo = vaccVal.includes('PNEUMOCOCCAL') ? 'Yes' : 'No';

    // Phenotype
    const rawLvef = parseFloat(row['LVEF']);
    const lvef = clampOrUndefined(rawLvef, 5, 90);

    const typeOfHF = String(row['TYPE OF HF'] || '').trim().toUpperCase();
    const hfType = typeOfHF.includes('REDUCED') ? 'HFrEF' : (typeOfHF.includes('MID') ? 'HFmrEF' : (typeOfHF.includes('PRESERVED') ? 'HFpEF' : (lvef != null ? (lvef <= 40 ? 'HFrEF' : (lvef <= 49 ? 'HFmrEF' : 'HFpEF')) : undefined)));

    // NYHA
    const nyhaStr = String(row['NYHA CLASS'] || '').trim();
    const nyha = (nyhaStr === 'I' || nyhaStr === 'II' || nyhaStr === 'III' || nyhaStr === 'IV') ? nyhaStr : undefined;

    // Heart rate & weight & walk test with range checks
    const heartRate = clampOrUndefined(parseInt(row['HR'], 10), 20, 300);
    const weight = clampOrUndefined(parseFloat(row['WEIGHT']), 10, 350);
    const sixMWT = clampOrUndefined(parseInt(row['6MWT'], 10), 0, 1500);

    // Blood pressure with range checks
    let bpSystolic: number | undefined = undefined;
    let bpDiastolic: number | undefined = undefined;
    const bpVal = String(row['BP'] || '').trim();
    const bpParts = bpVal.split('/');
    if (bpParts.length === 2) {
      bpSystolic = clampOrUndefined(parseInt(bpParts[0], 10), 40, 300);
      bpDiastolic = clampOrUndefined(parseInt(bpParts[1], 10), 20, 200);
    }

    // Grip tests
    const gripLeft = parseFloat(row['HARD GRIP TEST L HAND']) || undefined;
    const gripRight = parseFloat(row['R HAND']) || undefined;

    const etiologies = String(row['ETIOLOGY'] || '').trim().split(/[,\n]/).map(s => s.trim()).filter(Boolean);

    // Extract Column D (HID NO.) strictly - do NOT substitute Serial Number
    const rawHid = String(row['HID NO.'] || row['HID NO'] || row['HID'] || row['MRN'] || '').trim();
    const mrn = (rawHid && rawHid !== 'undefined' && rawHid !== 'null' && rawHid !== '-') ? rawHid : '—';

    const nowISO = new Date().toISOString();

    // Deduplication key: MRN if valid, else unique demographic fingerprint
    const dedupKey = (mrn && mrn !== '—')
      ? `mrn:${mrn}`
      : `demog:${firstName.toLowerCase()}_${lastName.toLowerCase()}_${dob || age || ''}`;

    let patientId: string;
    const existingPt = patientRegistryMap.get(dedupKey);

    if (existingPt) {
      patientId = existingPt.id;
      existingPt.visitCount = (existingPt.visitCount || 1) + 1;
      if (dod || doa) {
        const candidateDate = dod || doa;
        if (!existingPt.lastVisitDate || candidateDate > existingPt.lastVisitDate) {
          existingPt.lastVisitDate = candidateDate;
        }
      }
      comorbidities.forEach(c => {
        if (!existingPt.comorbidities?.includes(c)) {
          existingPt.comorbidities?.push(c);
        }
      });
      if (comorbidHypertension) existingPt.comorbidHypertension = true;
      if (comorbidDiabetes) existingPt.comorbidDiabetes = true;
      if (comorbidCAD) existingPt.comorbidCAD = true;
      if (comorbidPriorPCI) existingPt.comorbidPriorPCI = true;
      if (comorbidPriorCABG) existingPt.comorbidPriorCABG = true;
      if (comorbidPriorMI) existingPt.comorbidPriorMI = true;
      if (comorbidAF) existingPt.comorbidAF = true;
      if (comorbidCKD) existingPt.comorbidCKD = true;
      if (comorbidCOPD) existingPt.comorbidCOPD = true;
      if (comorbidDyslipidemia) existingPt.comorbidDyslipidemia = true;
    } else {
      patientId = 'p-' + Math.random().toString(36).substr(2, 9) + '-' + (patientsCount + 1);

      // Build Patient document data
      const patientInput: Omit<Patient, 'id' | 'createdAt' | 'updatedAt'> = {
        firstName,
        lastName,
        dob,
        sex,
        mrn,
        srNo: typeof srNo === 'number' ? srNo : parseInt(srNo, 10) || undefined,
        contact,
        address,
        comorbidities,
        status: 'Active',
        consentStatus: 'Granted',
        studyConsented: true,
        indianCitizen: true,
        ethnicity: 'Indian',
        registryId: 'hf',
        hfConfirmationDate: doa,
        hfType,
        nyha,
        lvef,
        visitCount: 1,
        lastVisitDate: dod || doa,
        age: age !== undefined ? age : undefined,
        comorbidHypertension,
        comorbidDiabetes,
        comorbidDyslipidemia,
        comorbidCAD,
        comorbidPriorMI,
        comorbidPriorPCI,
        comorbidPriorCABG,
        comorbidAF,
        comorbidCKD,
        comorbidCOPD,
        icdPresence,
        crtPresence,
        anticoagulation,
        antiarrhythmic
      };

      patientsCount++;

      const nowISO = new Date().toISOString();
      const newPt = cleanUndefined({
        ...patientInput,
        id: patientId,
        createdAt: nowISO,
        updatedAt: nowISO
      }) as Patient;

      patients.push(newPt);
      patientRegistryMap.set(dedupKey, newPt);
    }

    // Create Visit 1 (Inpatient encounter)
    const visit1Id = 'v-' + Math.random().toString(36).substr(2, 9) + '-1';
    const visit1Input: Omit<Visit, 'id' | 'createdAt'> = {
      patientId,
      visitDate: doa || new Date().toISOString().split('T')[0],
      visitType: 'Inpatient',
      dischargeDate: dod || undefined,
      weight,
      heartRate,
      bpSystolic,
      bpDiastolic,
      nyha,
      sixMWT,
      lvef,
      hfType,
      egfr,
      ntProBNP,
      tft,
      potassium,
      hb,
      ferritin,
      mcv,
      qrsDuration,
      qtcInterval,
      bbb,
      diuretic,
      raasi,
      betaBlocker,
      mra,
      sglt2i,
      statin,
      aspirin,
      digoxin,
      ivabradine,
      noac,
      vki,
      anticoagulation,
      antiarrhythmic,
      fibrate: { prescribed: '' },
      pcsk9: { prescribed: '' },
      ivIron: { prescribed: '' },
      device: devList,
      vaccInfluenza,
      vaccPneumo,
      gripLeft,
      gripRight,
      hospHistory: comorbidCAD || comorbidPriorMI ? 'Yes' : 'No',
      dischargeOutcome: dod ? 'Discharge' : '',
      clinicalNotes: `Admitted on ${doa}. Discharge on ${dod}. Etiology: ${etiologies.join(', ')}.`
    };

    visitsCount++;
    visits.push(cleanUndefined({
      ...visit1Input,
      id: visit1Id,
      createdAt: nowISO
    }) as Visit);

    // Create Visit 2 (3 Months follow-up visit if grip strength follow-up is documented)
    const fuGripLeft = parseFloat(row['3 MONTHS FU L HAND']) || undefined;
    const fuGripRight = parseFloat(row['R HAND_1']) || undefined;

    if (fuGripLeft !== undefined || fuGripRight !== undefined) {
      // Follow-up date: ~90 days after DOA
      let fuDate = '';
      if (doa) {
        const dObj = new Date(doa);
        dObj.setDate(dObj.getDate() + 90);
        fuDate = dObj.toISOString().split('T')[0];
      } else {
        fuDate = new Date().toISOString().split('T')[0];
      }

      const visit2Id = 'v-' + Math.random().toString(36).substr(2, 9) + '-2';
      const visit2Input: Omit<Visit, 'id' | 'createdAt'> = {
        patientId,
        visitDate: fuDate,
        visitType: 'OPD',
        gripLeft: fuGripLeft,
        gripRight: fuGripRight,
        diuretic,
        raasi,
        betaBlocker,
        mra,
        sglt2i,
        statin,
        aspirin,
        digoxin,
        ivabradine,
        noac,
        vki,
        anticoagulation,
        antiarrhythmic,
        fibrate: { prescribed: '' },
        pcsk9: { prescribed: '' },
        ivIron: { prescribed: '' },
        device: devList,
        hfType,
        hospHistory: comorbidCAD || comorbidPriorMI ? 'Yes' : 'No',
        nyha,
        lvef,
        clinicalNotes: '3-month follow-up functional assessment. Hand grip strength tested.'
      };

      visitsCount++;
      visits.push(cleanUndefined({
        ...visit2Input,
        id: visit2Id,
        createdAt: nowISO
      }) as Visit);

      // Update local array patient cache
      const pIdx = patients.findIndex(p => p.id === patientId);
      if (pIdx !== -1) {
        patients[pIdx].visitCount = 2;
        patients[pIdx].lastVisitDate = fuDate;
      }
    }
  }

  console.log(`[excelSeeder] Parsing complete. Prepared ${patientsCount} patients and ${visitsCount} visits.`);
  return { patientsCount, visitsCount, patients, visits };
}
