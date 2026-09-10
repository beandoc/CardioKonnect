import * as xlsx from 'xlsx'
import * as fs from 'fs'
import * as path from 'path'
import { initializeApp, getApps } from 'firebase/app'
import { getFirestore, collection, getDocs, doc, writeBatch, Timestamp } from 'firebase/firestore'
import { cleanMilitaryRanks, splitPatientName } from '../lib/utils'

// Load environment variables from .env.local
const envPath = path.resolve(process.cwd(), '.env.local')
if (fs.existsSync(envPath)) {
  const envFile = fs.readFileSync(envPath, 'utf8')
  envFile.split('\n').forEach(line => {
    const trimmed = line.trim()
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=')
      if (idx !== -1) {
        process.env[trimmed.substring(0, idx).trim()] = trimmed.substring(idx + 1).trim()
      }
    }
  })
}

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'AIzaSyBl9MjJgsGqjdYqNVTQLzTgeysOSlsIF0U',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'cardio-konnect-sachin-1.firebaseapp.com',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'cardio-konnect-sachin-1',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'cardio-konnect-sachin-1.firebasestorage.app',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '855879428060',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '1:855879428060:web:4754ebe71646eb75b69119',
}

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig)
const db = getFirestore(app)

// --- Helper Functions ---
function parseDate(val: any): string {
  if (!val) return ''
  if (val instanceof Date) return val.toISOString().split('T')[0]
  const str = String(val).trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.split('T')[0]
  const parts = str.split(/[/-]/)
  if (parts.length === 3) {
    let d = parseInt(parts[0], 10), m = parseInt(parts[1], 10), y = parseInt(parts[2], 10)
    if (y < 100) y += 2000
    if (!isNaN(d) && !isNaN(m) && !isNaN(y)) return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  }
  const d = new Date(str)
  if (!isNaN(d.getTime())) return d.toISOString().split('T')[0]
  return ''
}

function parseMed(val: any) {
  if (!val) return { prescribed: 'No' as const }
  const s = String(val).trim()
  if (s.toUpperCase() === 'NO' || s.toUpperCase() === 'N' || s.toUpperCase() === 'NONE' || s === '-' || s === '0') {
    return { prescribed: 'No' as const }
  }
  return { prescribed: 'Yes' as const, type: s, dose: s }
}

function clean(obj: any): any {
  if (obj === null || typeof obj !== 'object') return obj
  const res: any = Array.isArray(obj) ? [] : {}
  Object.keys(obj).forEach(key => {
    const val = obj[key]
    if (val !== undefined && val !== null) {
      if (typeof val === 'object' && !(val instanceof Date)) {
        res[key] = clean(val)
      } else {
        res[key] = val
      }
    }
  })
  return res
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

function normalizePhone(phone: any): string {
  if (!phone) return ''
  return String(phone).replace(/\D/g, '')
}

async function run() {
  console.log('====================================================')
  console.log('  CardioKonnect HF Registry Import — Dr. A. Jayachandra')
  console.log('  File: /Users/sachinsrivastava/Downloads/HF1 2.xlsx')
  console.log('====================================================\n')

  // Step 1: Read existing patients from Firestore
  console.log('Fetching existing patients from Firestore...')
  const snap = await getDocs(collection(db, 'patients'))
  const existingPatients: any[] = []
  const existingNameSet = new Set<string>()
  const existingPhoneSet = new Set<string>()
  const existingMrnSet = new Set<string>()

  snap.docs.forEach(d => {
    const data = d.data()
    const p = { id: d.id, ...data }
    existingPatients.push(p)
    const fullName = normalizeName(`${data.firstName || ''} ${data.lastName || ''}`)
    if (fullName) existingNameSet.add(fullName)
    const contactNorm = normalizePhone(data.contact)
    if (contactNorm) existingPhoneSet.add(contactNorm)
    if (data.mrn) existingMrnSet.add(data.mrn.trim().toLowerCase())
  })

  console.log(`Found ${existingPatients.length} existing patients in database.\n`)

  // Step 2: Read Excel
  const filePath = '/Users/sachinsrivastava/Downloads/HF1 2.xlsx'
  const wb = xlsx.readFile(filePath, { cellDates: true })
  const sheetName = wb.SheetNames[0]
  const rows: any[] = xlsx.utils.sheet_to_json(wb.Sheets[sheetName])
  console.log(`Read ${rows.length} total rows from Excel sheet "${sheetName}".\n`)

  const now = new Date().toISOString()
  const batch = writeBatch(db)

  let duplicateCount = 0
  let newPatientCount = 0
  let newVisitCount = 0

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const rowIdx = i + 2
    const rawName = String(row['NAME'] || '').trim()
    if (!rawName) continue

    const srNo = row['SR. NO.']
    const rawPhone = String(row['PHONE'] || '').trim()
    const normPhone = normalizePhone(rawPhone)
    const normName = normalizeName(rawName)
    const expectedMrn = `AICTS-2026-${String(srNo || 1000 + i).padStart(4, '0')}`

    // Deduplication check
    const isNameDuplicate = existingNameSet.has(normName)
    const isPhoneDuplicate = normPhone.length >= 8 && existingPhoneSet.has(normPhone)
    const isMrnDuplicate = existingMrnSet.has(expectedMrn.toLowerCase()) || (srNo && existingMrnSet.has(`mrn-${1000 + srNo}`.toLowerCase()))

    if (isNameDuplicate || isPhoneDuplicate || isMrnDuplicate) {
      duplicateCount++
      console.log(`⏭️  SKIP DUPLICATE [Row ${rowIdx} | Sr ${srNo}]: ${rawName} | Phone: ${rawPhone || '—'} | ${isNameDuplicate ? '[Name Match]' : ''} ${isPhoneDuplicate ? '[Phone Match]' : ''}`)
      continue
    }

    // Name formatting (sanitized of all military ranks and sensitive prefixes)
    const cleanedName = cleanMilitaryRanks(rawName)
    const { firstName, lastName } = splitPatientName(cleanedName)

    const age = parseInt(row['AGE'], 10)
    let dob = ''
    if (!isNaN(age) && age > 0) {
      dob = `${new Date().getFullYear() - age}-01-01`
    }

    const gender = String(row['GENDER'] || '').trim().toUpperCase()
    const sex = (gender === 'M' || gender === 'MALE') ? 'Male' : 'Female'
    const contact = rawPhone
    const address = String(row['ADDRESS'] || '').trim() || 'Pune, Maharashtra'

    // Enrolment / Admission date
    const enrolmentDate = parseDate(row['ENROLMENT']) || parseDate(row['DOA']) || now.split('T')[0]

    // Comorbidities analysis
    const hospVal = String(row['H/O OF HOSPITALIZATION'] || '').toUpperCase()
    const etVal = String(row['ETIOLOGY'] || '').toUpperCase()
    const dmVal = String(row['IF DM IS DIAGNOSED'] || '').toUpperCase()
    const lipidVal = String(row['IN CASE DYSLIPIDEMIA'] || '').toUpperCase()
    const mraVal = String(row['MRAs'] || '').toUpperCase()

    const comorbidDiabetes = (dmVal !== 'NO' && dmVal !== '' && dmVal !== 'NONE') || etVal.includes('DIABET') || hospVal.includes('DM')
    const comorbidCAD = hospVal.includes('CAD') || hospVal.includes('PCI') || hospVal.includes('CABG') || hospVal.includes('MI') || etVal.includes('ISCHEMIC') || etVal.includes('CAD')
    const comorbidPriorPCI = hospVal.includes('PCI')
    const comorbidPriorCABG = hospVal.includes('CABG')
    const comorbidPriorMI = hospVal.includes('MI') || hospVal.includes('AWMI') || hospVal.includes('IWMI')
    const comorbidHypertension = hospVal.includes('HTN') || etVal.includes('HYPERTENSION') || hospVal.includes('HYPERTENSION')
    const comorbidCKD = hospVal.includes('CKD') || mraVal.includes('CKD') || etVal.includes('CKD')
    const comorbidCOPD = hospVal.includes('COPD') || hospVal.includes('ASTHMA')
    const comorbidAF = hospVal.includes('AF') || hospVal.includes('ATRIAL FIBRILLATION') || String(row['ECG'] || '').toUpperCase().includes('AF')
    const comorbidDyslipidemia = lipidVal !== 'NO' && lipidVal !== '' && lipidVal !== 'NONE'

    const comorbidities: string[] = []
    if (comorbidHypertension) comorbidities.push('HTN')
    if (comorbidDiabetes) comorbidities.push('DM2')
    if (comorbidCAD) comorbidities.push('CAD')
    if (comorbidPriorMI) comorbidities.push('Prior MI')
    if (comorbidPriorPCI) comorbidities.push('Prior PCI')
    if (comorbidPriorCABG) comorbidities.push('Prior CABG')
    if (comorbidCKD) comorbidities.push('CKD')
    if (comorbidCOPD) comorbidities.push('COPD')
    if (comorbidAF) comorbidities.push('AF')
    if (comorbidDyslipidemia) comorbidities.push('Dyslipidemia')

    // NYHA
    const nyhaRaw = String(row['NYHA CLASS'] || '').trim().replace(/\s+/g, '')
    const nyha = ['I', 'II', 'III', 'IV'].includes(nyhaRaw) ? (nyhaRaw as 'I' | 'II' | 'III' | 'IV') : 'II'

    // LVEF & HF type
    const lvef = parseFloat(row['LVEF']) || undefined
    let hfType: 'HFrEF' | 'HFmrEF' | 'HFpEF' = 'HFrEF'
    if (lvef !== undefined) {
      if (lvef >= 50) hfType = 'HFpEF'
      else if (lvef >= 40) hfType = 'HFmrEF'
      else hfType = 'HFrEF'
    }

    // ECG
    const ecgUpper = String(row['ECG'] || '').toUpperCase()
    let bbb = 'None'
    if (ecgUpper.includes('LBBB')) bbb = 'LBBB'
    else if (ecgUpper.includes('RBBB')) bbb = 'RBBB'

    // Labs
    const ntProBNP = parseFloat(row['NT-Pro BNP'] || row['NT proBNP']) || undefined
    const potassium = parseFloat(row['POTASSIUM']) || undefined
    const creatinine = parseFloat(row['CREAT']) || undefined
    const egfr = parseFloat(row['eGFR']) || undefined
    const hb = parseFloat(row['HB']) || undefined
    const mcv = parseFloat(row['MCV']) || undefined
    const hba1c = parseFloat(row['HbA1C']) || undefined
    const tft = String(row['TFT'] || '').trim() || undefined
    const weight = parseFloat(row['WEIGHT']) || undefined
    const height = parseFloat(row['HEIGHT']) || undefined
    const heartRate = parseInt(row['HR'], 10) || undefined
    const sixMWT = parseInt(row['6MWT'], 10) || undefined
    const isSmoker = String(row['SMOKING '] || '').toUpperCase().includes('YES')

    let bpSystolic: number | undefined
    let bpDiastolic: number | undefined
    const bpParts = String(row['BP'] || '').split('/')
    if (bpParts.length === 2) {
      bpSystolic = parseInt(bpParts[0], 10) || undefined
      bpDiastolic = parseInt(bpParts[1], 10) || undefined
    }

    // Medications
    const diuretic = parseMed(row['DIURETICS'])
    const raasi = parseMed(row['ACEi/ARNi'])
    const betaBlocker = parseMed(row['BETA BLOCKERS'])
    const mra = parseMed(row['MRAs'])
    const digoxin = parseMed(row['DIGOXIN'])
    const ivabradine = parseMed(row['IVABRADINE'])
    const statin = (lipidVal !== 'NO' && lipidVal !== '' && lipidVal !== 'NONE')
      ? { prescribed: 'Yes' as const, type: String(row['IN CASE DYSLIPIDEMIA']).trim(), dose: String(row['IN CASE DYSLIPIDEMIA']).trim() }
      : { prescribed: 'No' as const }
    
    const antiArrhVal = String(row['ANTI-arrhythmic therapy'] || '').trim()
    const antiarrhythmic = (antiArrhVal.toUpperCase() !== 'NO' && antiArrhVal !== '') ? antiArrhVal : ''
    const anticoVal = String(row['ANTICOGULANT'] || '').trim()
    const anticoagulation = (anticoVal.toUpperCase() !== 'NO' && anticoVal !== '') ? anticoVal : ''

    // SGLT2i from DM diagnosed field
    const dmDrug = String(row['IF DM IS DIAGNOSED'] || '').trim().toUpperCase()
    const isSglt2 = dmDrug.includes('DAPA') || dmDrug.includes('EMPA') || dmDrug.includes('FORXIGA') || dmDrug.includes('JARDIANCE')
    const sglt2i = isSglt2
      ? { prescribed: 'Yes' as const, type: String(row['IF DM IS DIAGNOSED']).trim(), dose: String(row['IF DM IS DIAGNOSED']).trim() }
      : { prescribed: 'No' as const }

    const vericiguat = parseMed(row['VERICIGUAT'])

    // Device
    const deviceVal = String(row['DEVICE'] || '').toUpperCase()
    const icdPresence = deviceVal.includes('ICD') || deviceVal.includes('AICD')
    const crtPresence = deviceVal.includes('CRT')

    // Vaccination
    const vaccVal = String(row['VACCINATION'] || '').toUpperCase()
    const vaccInfluenza = (vaccVal.includes('INFLUENZA') || vaccVal.includes('DONE')) ? 'Yes' : 'No'
    const vaccPneumo = (vaccVal.includes('PNEUMO') || vaccVal.includes('DONE')) ? 'Yes' : 'No'

    // Functional Grip Test
    const gripLeft = parseFloat(row['HARD GRIP TEST L HAND']) || undefined
    const gripRight = parseFloat(row['R HAND']) || undefined
    const fuGripLeft = parseFloat(row['3 MONTHS FU L HAND']) || undefined
    const fuGripRight = parseFloat(row['R HAND_1']) || undefined

    const etiologies = etVal ? etVal.split(/[,\n]/).map(s => s.trim()).filter(Boolean) : []

    // --- Create Firestore Patient Doc for Dr. A. Jayachandra ---
    const patientRef = doc(collection(db, 'patients'))
    const assignedMrn = `AICTS-2026-${String(srNo || 1000 + i).padStart(4, '0')}`

    const patientData = clean({
      firstName,
      lastName,
      dob,
      sex,
      age: !isNaN(age) ? age : undefined,
      mrn: assignedMrn,
      contact,
      address,
      addressDistrict: 'Pune',
      addressState: 'Maharashtra',
      hospitalName: 'All India Institute of Cardiothoracic Sciences (AICTS), Pune',
      primaryDoctor: 'Dr. A. Jayachandra',
      attendingDoctor: 'Dr. A. Jayachandra',
      siteId: 'AICTS_PUNE',
      registryId: 'hf',
      registryIds: ['hf'],
      status: 'Active',
      consentStatus: 'Granted',
      studyConsented: true,
      indianCitizen: true,
      hfConfirmationDate: enrolmentDate,
      hfType,
      nyha,
      lvef,
      comorbidities,
      comorbidHypertension,
      comorbidDiabetes,
      comorbidDyslipidemia,
      comorbidCAD,
      comorbidPriorMI,
      comorbidPriorPCI,
      comorbidPriorCABG,
      comorbidAF,
      comorbidCKD,
      comorbidCOPD,
      icdPresence,
      crtPresence,
      anticoagulation,
      antiarrhythmic,
      currentSmoker: isSmoker,
      visitCount: 1,
      lastVisitDate: enrolmentDate,
      createdAt: now,
      updatedAt: now,
    })

    batch.set(patientRef, patientData)
    newPatientCount++

    // --- Create Visit Doc in subcollection ---
    const visitRef = doc(collection(db, 'patients', patientRef.id, 'visits'))
    const visitData = clean({
      patientId: patientRef.id,
      visitDate: enrolmentDate,
      visitType: 'Outpatient',
      weight,
      height,
      heartRate,
      bpSystolic,
      bpDiastolic,
      nyha,
      sixMWT,
      lvef,
      hfType,
      ntProBNP,
      potassium,
      creatinine,
      egfr,
      hb,
      mcv,
      hba1c,
      tft,
      bbb,
      diuretic,
      raasi,
      betaBlocker,
      mra,
      sglt2i,
      statin,
      digoxin,
      ivabradine,
      vericiguat,
      noac: { prescribed: 'No' },
      vki: { prescribed: 'No' },
      aspirin: { prescribed: 'No' },
      fibrate: { prescribed: 'No' },
      pcsk9: { prescribed: 'No' },
      ivIron: { prescribed: 'No' },
      anticoagulation,
      antiarrhythmic,
      device: [],
      vaccInfluenza,
      vaccPneumo,
      gripLeft,
      gripRight,
      fuGripLeft,
      fuGripRight,
      hospHistory: (comorbidCAD || comorbidPriorMI || hospVal.includes('HOSPITAL')) ? 'Yes' : 'No',
      clinicalNotes: `Etiology: ${etiologies.join(', ') || 'Ischemic / Hypertensive'}. H/O: ${String(row['H/O OF HOSPITALIZATION'] || 'None documented')}. ECG: ${String(row['ECG'] || 'N/A')}.`,
      createdAt: now,
      updatedAt: now,
    })

    batch.set(visitRef, visitData)
    newVisitCount++

    // Add to local sets to prevent duplicate rows within the same sheet
    existingNameSet.add(normName)
    if (normPhone) existingPhoneSet.add(normPhone)
    existingMrnSet.add(assignedMrn.toLowerCase())

    console.log(`✅ [ADD Row ${rowIdx} | Sr ${srNo}]: ${firstName} ${lastName} | MRN: ${assignedMrn} | LVEF: ${lvef || '—'}% | NYHA: ${nyha} | Site: AICTS Pune`)
  }

  console.log('\n----------------------------------------------------')
  console.log(`Summary of Import:`)
  console.log(`  - Total Rows Processed: ${rows.length}`)
  console.log(`  - Duplicates Skipped:    ${duplicateCount}`)
  console.log(`  - New Patients to Save: ${newPatientCount}`)
  console.log(`  - New Visits to Save:   ${newVisitCount}`)
  console.log('----------------------------------------------------\n')

  if (newPatientCount > 0) {
    console.log(`Committing batch of ${newPatientCount} patients to Firestore...`)
    await batch.commit()
    console.log('🎉 Successfully saved all new patients and visits to Firestore!')
  } else {
    console.log('ℹ️ No new unique patients to add (all were already present).')
  }
}

run().catch(err => {
  console.error('Fatal Import Error:', err)
  process.exit(1)
})
