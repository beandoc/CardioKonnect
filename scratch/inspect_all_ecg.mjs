import XLSX from "xlsx";

const wb = XLSX.readFile('/Users/sachinsrivastava/Downloads/HF1.xlsx', { cellDates: true });
const sheet = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet);

console.log('=== ALL ECG AND DEVICE DATA IN HF1.XLSX ===');
rows.forEach((r, idx) => {
  console.log(`[${idx+1}] ${r['NAME']} | LVEF: ${r['2 D ECHO ( LVEF )'] || r['LVEF']} | ECG: ${r['ECG']} | DEVICE: ${r['DEVICE ( CRTD/AICD/PPM )'] || r['DEVICE']}`);
});
