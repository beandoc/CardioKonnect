const XLSX = require('xlsx');

const filePath = '/Users/sachinsrivastava/Desktop/HF.xlsx';
const wb = XLSX.readFile(filePath, { cellDates: true });
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(ws);

const uniqueVals = {};
const colsToInspect = [
  'GENDER',
  'SMOKING ',
  'NYHA CLASS',
  'TYPE OF HF',
  'TFT',
  'ECG',
  'H/O OF HOSPITALIZATION',
  'DIGOXIN',
  'DIURETICS',
  'ACEi/ARNi',
  'ANTICOGULANT',
  'BETA BLOCKERS',
  'IVABRADINE',
  'MRAs',
  'IN CASE DYSLIPIDEMIA',
  'IF DM IS DIAGNOSED',
  'ANTI-arrhythmic therapy',
  'DEVICE',
  'VACCINATION',
  'ENROLMENT'
];

colsToInspect.forEach(col => {
  uniqueVals[col] = new Set();
});

rows.forEach(row => {
  colsToInspect.forEach(col => {
    if (row[col] !== undefined) {
      uniqueVals[col].add(String(row[col]).trim());
    }
  });
});

for (const col of colsToInspect) {
  console.log(`Column "${col}":`, Array.from(uniqueVals[col]).slice(0, 15));
}
