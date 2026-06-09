const XLSX = require('xlsx');
const path = require('path');

const filePath = '/Users/sachinsrivastava/Desktop/HF.xlsx';
console.log('Reading file:', filePath);

try {
  const wb = XLSX.readFile(filePath, { cellDates: true });
  console.log('Sheet names:', wb.SheetNames);
  
  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
    console.log(`Sheet "${sheetName}": ${data.length} rows`);
    if (data.length > 0) {
      console.log('Headers:', data[0]);
      console.log('First row data:', data[1]);
    }
    console.log('---');
  }
} catch (e) {
  console.error('Error reading excel:', e);
}
