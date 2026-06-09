const XLSX = require('xlsx');

const filePath = '/Users/sachinsrivastava/Desktop/HF.xlsx';
const wb = XLSX.readFile(filePath, { cellDates: true });
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(ws);

if (rows.length > 0) {
  console.log('Parsed object keys:', Object.keys(rows[0]));
}
