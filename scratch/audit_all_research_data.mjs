import XLSX from 'xlsx';

const wb = XLSX.readFile('/Users/sachinsrivastava/Downloads/HF1.xlsx', { cellDates: true });
const sheet = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet);

console.log(`=== AUDIT OF ALL ${rows.length} PATIENTS FROM EXCEL ===\n`);

rows.forEach((r, idx) => {
  console.log(`[${idx+1}] Name: ${r['NAME']}`);
  console.log(`    LVEF: ${r['LVEF']}, Type: "${r['TYPE OF HF'] || ''}", NYHA: "${r['NYHA CLASS']}"`);
  console.log(`    ECG: "${r['ECG'] || ''}"`);
  console.log(`    Hosp H/O: "${r['H/O OF HOSPITALIZATION'] || ''}"`);
  console.log(`    DM: "${r['IF DM IS DIAGNOSED'] || ''}", HTN/Lipid: "${r['IN CASE DYSLIPIDEMIA'] || ''}"`);
  console.log(`    Meds: ARNI="${r['ACEi/ARNi'] || ''}", BB="${r['BETA BLOCKERS'] || ''}", MRA="${r['MRAs'] || ''}", Diuretic="${r['DIURETICS'] || ''}"\n`);
});
