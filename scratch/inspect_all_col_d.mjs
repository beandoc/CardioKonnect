import XLSX from 'xlsx';

const wb = XLSX.readFile('/Users/sachinsrivastava/Downloads/HF1.xlsx', { cellDates: true });
const sheetName = wb.SheetNames[0];
const sheet = wb.Sheets[sheetName];

// Get raw 2D array of all cells
const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1 });

console.log('=== HEADER ROW ===');
console.log(rawData[0]);

console.log('\n=== ALL PATIENTS (Row index, Sr No, Name, Column D / HID NO) ===');
for (let i = 1; i < rawData.length; i++) {
  const row = rawData[i];
  if (!row || !row[1]) continue;
  console.log(`Row ${i}: Col A (Sr): "${row[0]}", Col B (Name): "${row[1]}", Col C (Phone): "${row[2]}", Col D (HID): "${row[3]}"`);
}
