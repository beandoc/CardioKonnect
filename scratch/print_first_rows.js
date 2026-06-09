const XLSX = require('xlsx');

const filePath = '/Users/sachinsrivastava/Desktop/HF.xlsx';
const wb = XLSX.readFile(filePath, { cellDates: true });
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(ws);

for (let i = 0; i < 10 && i < rows.length; i++) {
  const r = rows[i];
  console.log(`{ name: '${r['NAME']}', location: '${r['ADDRESS']}', type: '${r['TYPE OF HF']}', hasFollowUp: ${r['3 MONTHS FU L HAND'] !== undefined} }`);
}
