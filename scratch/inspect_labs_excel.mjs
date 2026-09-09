import XLSX from 'xlsx';

const wb = XLSX.readFile('/Users/sachinsrivastava/Downloads/HF1.xlsx');
const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);

console.log('Columns:', Object.keys(rows[0]));

rows.forEach((r, idx) => {
  console.log(`[${idx+1}] ${r['NAME'] || r['NAME ']} | Age: ${r['AGE']} | Gender: ${r['GENDER']} | Creatinine: ${r['CREATININE'] || r['SERUM CREATININE'] || r['CR']} | eGFR: ${r['eGFR'] || r['EGFR']} | Potassium: ${r['POTASSIUM'] || r['K+'] || r['K']}`);
});
