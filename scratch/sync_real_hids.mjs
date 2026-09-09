import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import XLSX from 'xlsx';

const firebaseConfig = {
  apiKey: 'AIzaSyBl9MjJgsGqjdYqNVTQLzTgeysOSlsIF0U',
  authDomain: 'cardio-konnect-sachin-1.firebaseapp.com',
  projectId: 'cardio-konnect-sachin-1',
  storageBucket: 'cardio-konnect-sachin-1.firebasestorage.app',
  messagingSenderId: '855879428060',
  appId: '1:855879428060:web:4754ebe71646eb75b69119',
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function syncRealHIDs() {
  const wb = XLSX.readFile('/Users/sachinsrivastava/Downloads/HF1.xlsx');
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  // Map each patient in Excel by name / sr. no to their Column D ('HID NO.')
  const excelPatients = [];
  rawRows.slice(1).forEach(r => {
    const srNo = r[0];
    const name = String(r[1] || '').trim();
    const phone = String(r[2] || '').trim();
    const rawHid = r[3] ? String(r[3]).trim() : '';
    const hid = rawHid && rawHid !== 'undefined' ? rawHid : `HID-${srNo}`;

    if (name && srNo) {
      excelPatients.push({ srNo, name, phone, hid });
    }
  });

  console.log(`Parsed ${excelPatients.length} patients from Excel with Column D HID NO.`);

  const snap = await getDocs(collection(db, 'patients'));
  console.log(`Found ${snap.size} patients in Firestore.`);

  let updatedCount = 0;

  for (const pDoc of snap.docs) {
    const pData = pDoc.data();
    const fullName = `${pData.firstName || ''} ${pData.lastName || ''}`.trim().toUpperCase();

    // Match by name or phone or MRN srNo
    const match = excelPatients.find(ep => {
      const epName = ep.name.toUpperCase();
      return epName === fullName || epName.includes(fullName) || fullName.includes(epName) || (ep.phone && ep.phone === pData.contact);
    });

    if (match) {
      console.log(`Updating ${fullName}: mrn = "${match.hid}" (was "${pData.mrn}")`);
      await updateDoc(doc(db, 'patients', pDoc.id), {
        mrn: match.hid,
        updatedAt: new Date().toISOString()
      });
      updatedCount++;
    } else {
      console.log(`No match for ${fullName}`);
    }
  }

  console.log(`\nSuccessfully updated ${updatedCount} patients in Firestore with exact Column D HID numbers.`);
}

syncRealHIDs().catch(err => {
  console.error(err);
  process.exit(1);
});
