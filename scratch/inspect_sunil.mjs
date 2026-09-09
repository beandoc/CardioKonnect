import XLSX from 'xlsx';

const wb = XLSX.readFile('/Users/sachinsrivastava/Downloads/HF1.xlsx', { cellDates: true });
const sheet = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet);

const sunil = rows.find(r => String(r['NAME']).includes('SUNILKUMAR') || String(r['HID NO.']) === '110013694221');
console.log('=== SUNILKUMAR BHONDWE ROW DATA ===');
console.log(JSON.stringify(sunil, null, 2));
