import XLSX from 'xlsx';

const wb = XLSX.readFile('/Users/sachinsrivastava/Downloads/HF1.xlsx');
const sheet = wb.Sheets[wb.SheetNames[0]];

// Read range and inspect raw cell values for columns A, B, C, D, E
const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1 });

console.log('Row 1 (Headers):', rawData[0]);
console.log('Row 2 (First Patient):', rawData[1]);
console.log('Row 3 (Second Patient):', rawData[2]);
console.log('Row 4 (Third Patient - Sunilkumar):', rawData[3]);

// Print all rows with column D
rawData.slice(1, 20).forEach((r, idx) => {
  console.log(`[Row ${idx+2}] SrNo: ${r[0]} | Name: ${r[1]} | Phone: ${r[2]} | Col D (${rawData[0][3]}): "${r[3]}" | Col E (${rawData[0][4]}): "${r[4]}"`);
});
