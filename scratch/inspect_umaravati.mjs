import XLSX from 'xlsx';

const wb = XLSX.readFile('/Users/sachinsrivastava/Downloads/HF1.xlsx', { cellDates: true });
const sheet = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet);

const umaravati = rows.find(r => String(r['NAME']).includes('UMARAVATI') || String(r['SR. NO.']) === '150');
console.log('=== UMARAVATI DEVI EXCEL ROW ===');
console.log(JSON.stringify(umaravati, null, 2));
