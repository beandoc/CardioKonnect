/**
 * Client-safe Excel row parser.
 * NO Node.js `fs` module — safe to import in browser/client components.
 */
import type { Patient, Visit, MedEntry } from './types'

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

export function parseExcelRows(rows: any[]): { patientsCount: number; visitsCount: number; patients: Patient[]; visits: Visit[] } {
  let patientsCount = 0;
  let visitsCount = 0;
  const patients: Patient[] = [];
  const visits: Visit[] = [];

  for (const row of rows) {
    const srNo = row['SR. NO.'];
    if (!srNo) continue;

    const nameVal = String(row['NAME'] || '').trim();
    if (!nameVal || nameVal.toLowerCase() === 'unknown' || nameVal.toLowerCase() === 'nil' || nameVal === '-') {
      continue;
    }
    const nameParts = nameVal.split(/\s+/);
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    const doa = parseExcelDate(row['DOA']);
    const dod = parseExcelDate(row['DOD']);

    const age = parseInt(row['AGE'], 10);
    let dob = '';
    if (doa && !isNaN(age)) {
      const doaYear = new Date(doa).getFullYear();
      dob = `${doaYear - age}-01-01`;
    } else if (!isNaN(age)) {
      dob = `${new Date().getFullYear() - age}-01-01`;
    } else {
      dob = '1970-01-01';
    }

    const gender = String(row['GENDER'] || '').trim().toUpperCase();
    const sex: 'Male' | 'Female' = gender === 'M' || gender === 'MALE' ? 'Male' : 'Female';

    const contact = String(row['PHONE'] || '').trim();
    const address = String(row['ADDRESS'] || '').trim();

    // Map comorbidities & histories
    const dmVal = String(row['IF DM IS DIAGNOSED'] || '').trim().toUpperCase();
    const hospVal = String(row['H/O OF HOSPITALIZATION'] || '').trim().toUpperCase();
    const etVal = String(row['ETIOLOGY'] || '').trim().toUpperCase();
    const mraVal = String(row['MRAs'] || '').trim().toUpperCase();
    const lipidVal = String(row['IN CASE DYSLIPIDEMIA'] || '').trim().toUpperCase();

    const comorbidDiabetes = (dmVal !== 'NO' && dmVal !== '') || hospVal.includes('DM') || hospVal.includes('DIABETES');
    const comorbidCAD = hospVal.includes('CAD') || hospVal.includes('CAG') || hospVal.includes('PCI') || hospVal.includes('CABG') || hospVal.includes('AWMI') || hospVal.includes('IWMI') || hospVal.includes('MI');
    const comorbidPriorPCI = hospVal.includes('PCI');
    const comorbidPriorCABG = hospVal.includes('CABG');
    const comorbidPriorMI = hospVal.includes('MI') || hospVal.includes('AWMI') || hospVal.includes('IWMI');
    const comorbidHypertension = hospVal.includes('HYPERTENSION') || hospVal.includes('HTN') || etVal.includes('HYPERTENSION') || etVal.includes('HTN');
    const comorbidCKD = hospVal.includes('CKD') || hospVal.includes('KIDNEY') || mraVal.includes('CKD');
    const comorbidCOPD = hospVal.includes('COPD') || hospVal.includes('COAD') || hospVal.includes('ASTHMA');
    const comorbidAF = hospVal.includes('AF') || hospVal.includes('ATRIAL FIBRILLATION');
    const comorbidDyslipidemia = lipidVal !== 'NO' && lipidVal !== '';

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
    const typeOfHF = String(row['TYPE OF HF'] || '').trim().toUpperCase();
    const hfType = typeOfHF.includes('REDUCED') ? 'HFrEF' : (typeOfHF.includes('MID') ? 'HFmrEF' : (typeOfHF.includes('PRESERVED') ? 'HFpEF' : 'HFrEF'));

    // NYHA
    const nyhaStr = String(row['NYHA CLASS'] || '').trim();
    const nyha = (nyhaStr === 'II' || nyhaStr === 'III' || nyhaStr === 'IV') ? nyhaStr : 'II';

    // Heart rate & weight & walk test
    const heartRate = parseInt(row['HR'], 10) || undefined;
    const weight = parseFloat(row['WEIGHT']) || undefined;
    const sixMWT = parseInt(row['6MWT'], 10) || undefined;
    const lvef = parseFloat(row['LVEF']) || undefined;

    // Blood pressure
    let bpSystolic: number | undefined = undefined;
    let bpDiastolic: number | undefined = undefined;
    const bpVal = String(row['BP'] || '').trim();
    const bpParts = bpVal.split('/');
    if (bpParts.length === 2) {
      bpSystolic = parseInt(bpParts[0], 10) || undefined;
      bpDiastolic = parseInt(bpParts[1], 10) || undefined;
    }

    // Grip tests
    const gripLeft = parseFloat(row['HARD GRIP TEST L HAND']) || undefined;
    const gripRight = parseFloat(row['R HAND']) || undefined;

    const etiologies = String(row['ETIOLOGY'] || '').trim().split(/[,\n]/).map(s => s.trim()).filter(Boolean);

    // Generate a local unique patient ID (no Firestore needed)
    const patientId = 'p-' + Math.random().toString(36).substr(2, 9) + '-' + (patientsCount + 1);

    // Build Patient document data
    const patientInput: Omit<Patient, 'id' | 'createdAt' | 'updatedAt'> = {
      firstName,
      lastName,
      dob,
      sex,
      mrn: `MRN-${1000 + srNo}`,
      contact,
      address,
      comorbidities,
      status: 'Active',
      consentStatus: 'Granted',
      studyConsented: true,
      indianCitizen: true,
      registryId: 'hf',
      hfConfirmationDate: doa,
      hfType,
      nyha,
      lvef,
      visitCount: 1,
      lastVisitDate: dod || doa,
      age: !isNaN(age) ? age : undefined,
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
    patients.push(cleanUndefined({
      ...patientInput,
      id: patientId,
      createdAt: nowISO,
      updatedAt: nowISO
    }) as Patient);

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

  console.log(`[excelParser] Parsing complete. Prepared ${patientsCount} patients and ${visitsCount} visits.`);
  return { patientsCount, visitsCount, patients, visits };
}
