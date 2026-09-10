import * as xlsx from 'xlsx'
import * as fs from 'fs'
import * as path from 'path'
import { initializeApp, getApps } from 'firebase/app'
import { getFirestore, collection, getDocs, doc, writeBatch, Timestamp } from 'firebase/firestore'
import { cleanMilitaryRanks, splitPatientName } from '../lib/utils'
import {
  parseMedication,
  parseEcg,
  parseDevice,
  parseEtiology,
  parseHospitalisationHistory,
  parseTsh,
  parseBiomarker,
  parseLvef,
  calcEgfr,
  calcBmi,
  parseDaptFromAnticoagulantColumn,
  parseOacFromAntiarrhythmicColumn
} from '../lib/registryParsers'
import type { Patient, Visit, OutcomeEvent, MedEntry } from '../lib/types'

// CLI Flags
const args = process.argv.slice(2)
const isCommit = args.includes('--commit')
const isDryRun = !isCommit

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

// Date Helpers
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

function addDays(isoDate: string, days: number): string {
  if (!isoDate) return ''
  const d = new Date(isoDate)
  if (isNaN(d.getTime())) return ''
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

function daysDiff(d1: string, d2: string): number | undefined {
  if (!d1 || !d2) return undefined
  const dt1 = new Date(d1).getTime()
  const dt2 = new Date(d2).getTime()
  if (isNaN(dt1) || isNaN(dt2)) return undefined
  return Math.max(0, Math.round((dt2 - dt1) / (1000 * 60 * 60 * 24)))
}

function clean<T extends Record<string, any>>(obj: T): T {
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

function extractNumericDose(doseStr?: string): number | undefined {
  if (!doseStr) return undefined
  const m = doseStr.match(/(\d+(?:\.\d+)?)/)
  return m ? parseFloat(m[1]) : undefined
}

async function run() {
  console.log('========================================================================')
  console.log('  CardioKonnect HF Registry Clinical Import — Dr. A. Jayachandra')
  console.log(`  Mode: ${isDryRun ? '🔍 DRY-RUN (0 database writes)' : '🚀 LIVE COMMIT (Writing to Firestore)'}`)
  console.log('  File: /Users/sachinsrivastava/Downloads/HF1 2.xlsx')
  console.log('========================================================================\n')

  const excelPath = '/Users/sachinsrivastava/Downloads/HF1 2.xlsx'
  if (!fs.existsSync(excelPath)) {
    console.error(`Excel file not found at ${excelPath}`)
    process.exit(1)
  }

  const wb = xlsx.readFile(excelPath)
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const excelRows = xlsx.utils.sheet_to_json(sheet) as any[]
  console.log(`Loaded ${excelRows.length} source records from Excel.\n`)

  // Step 1: Existing patients in AICTS_PUNE for scoped deduplication & mapping
  const pSnap = await getDocs(collection(db, 'patients'))
  const existingByHid = new Map<string, string>() // hid -> docId
  const existingBySr = new Map<string, string>()  // srNo -> docId
  const existingByPhone = new Map<string, string>()

  pSnap.forEach(d => {
    const data = d.data()
    if (data.siteId === 'AICTS_PUNE') {
      if (data.mrn) existingByHid.set(data.mrn.trim().toLowerCase(), d.id)
      if (data.srNo) existingBySr.set(String(data.srNo), d.id)
      const ph = String(data.contact || '').replace(/\D/g, '')
      if (ph.length >= 10) existingByPhone.set(ph.slice(0, 10), d.id)
    }
  })

  console.log(`Existing AICTS_PUNE patients in Firestore: ${existingBySr.size || existingByHid.size}\n`)

  const importBatchId = `batch_hf_${Date.now()}`
  const nowIso = new Date().toISOString()
  let processedCount = 0
  let visitsCount = 0
  let outcomesCount = 0

  let batch = writeBatch(db)
  let opsInBatch = 0

  for (let i = 0; i < excelRows.length; i++) {
    const row = excelRows[i]
    const rowIdx = i + 2
    const srNo = parseInt(String(row['SR. NO.'] || '').replace(/\*/g, ''), 10)
    const rawName = String(row['NAME'] || '').trim()
    if (!rawName) continue

    processedCount++
    const rawPhone = String(row['PHONE'] || '').trim()
    const rawHid = String(row['HID NO.'] || '').trim()
    const syntheticMrn = `AICTS-2026-${String(srNo || 1000 + i).padStart(4, '0')}`
    const mrn = rawHid || syntheticMrn

    // Cleaned Name
    const cleanedName = cleanMilitaryRanks(rawName)
    const { firstName, lastName } = splitPatientName(cleanedName)

    // Age & Birth year (precision: 'year')
    const age = parseInt(row['AGE'], 10)
    const doaDate = parseDate(row['DOA'])
    const enrolmentRaw = String(row['ENROLMENT'] || '').trim()
    const enrolmentDate = parseDate(enrolmentRaw)
    const indexDate = doaDate || enrolmentDate || ''

    let birthYear: number | undefined = undefined
    let dob = ''
    if (!isNaN(age) && age > 0) {
      const anchorYear = indexDate ? new Date(indexDate).getFullYear() : 2026
      birthYear = anchorYear - age
      dob = `${birthYear}-01-01`
    }

    const gender = String(row['GENDER'] || '').trim().toUpperCase()
    const sex: 'Male' | 'Female' = (gender === 'M' || gender === 'MALE') ? 'Male' : 'Female'
    const contact = rawPhone
    const address = String(row['ADDRESS'] || '').trim() || 'Pune, Maharashtra'

    // Anthropometrics
    const weight = parseFloat(row['WEIGHT']) || undefined
    const height = parseFloat(row['HEIGHT']) || undefined
    const bmi = calcBmi(weight, height)

    // Vitals
    const heartRate = parseInt(row['HR'], 10) || undefined
    let bpSystolic: number | undefined
    let bpDiastolic: number | undefined
    const bpParts = String(row['BP'] || '').split('/')
    if (bpParts.length === 2) {
      bpSystolic = parseInt(bpParts[0], 10) || undefined
      bpDiastolic = parseInt(bpParts[1], 10) || undefined
    }

    // NYHA (no default 'II' fallback)
    const nyhaRaw = String(row['NYHA CLASS'] || '').trim().toUpperCase()
    const nyha = ['I', 'II', 'III', 'IV'].includes(nyhaRaw) ? (nyhaRaw as 'I' | 'II' | 'III' | 'IV') : undefined

    // 6MWT
    const sixMWT = parseInt(row['6MWT'], 10) || undefined

    // LVEF (Baseline)
    const { lvef: baselineLvef } = parseLvef(row['LVEF'])
    let hfType: 'HFrEF' | 'HFmrEF' | 'HFpEF' = 'HFrEF'
    if (baselineLvef !== undefined) {
      if (baselineLvef >= 50) hfType = 'HFpEF'
      else if (baselineLvef >= 40) hfType = 'HFmrEF'
      else hfType = 'HFrEF'
    }

    // Labs (Baseline)
    const creatinine = parseFloat(row['CREAT']) || undefined
    const egfr = calcEgfr(creatinine, age, sex)
    const potassium = parseFloat(row['POTASSIUM']) || undefined
    const hb = parseFloat(row['HB']) || undefined
    const mcv = parseFloat(row['MCV']) || undefined
    const hba1c = parseFloat(row['HbA1C']) || undefined
    const tft = parseTsh(row['TFT'])
    const biomarker = parseBiomarker(row['NT-Pro BNP'])

    // ECG (Baseline)
    const ecg = parseEcg(row['ECG'])

    // Etiology
    const etiologies = parseEtiology(row['ETIOLOGY'])

    // Revascularization & Hospitalization History
    const hospHistory = parseHospitalisationHistory(row['H/O OF HOSPITALIZATION'])

    // Device Therapy
    const dev = parseDevice(row['DEVICE'])

    // Smoking
    const smokingStr = String(row['SMOKING '] || '').trim().toUpperCase()
    const isSmoker = smokingStr === 'YES' || smokingStr === 'Y'

    // Core GDMT Medications (Baseline)
    const diuretic = parseMedication(row['DIURETICS'], 'diuretic')
    const raasi = parseMedication(row['ACEi/ARNi'], 'raasi')
    const betaBlocker = parseMedication(row['BETA BLOCKERS'], 'betaBlocker')
    const mra = parseMedication(row['MRAs'], 'mra')
    const digoxin = parseMedication(row['DIGOXIN'], 'digoxin')
    const ivabradine = parseMedication(row['IVABRADINE'], 'ivabradine')
    const vericiguat = parseMedication(row['VERICIGUAT'], 'vericiguat')

    // SGLT2i
    const dmField = String(row['IF DM IS DIAGNOSED'] || '').trim()
    const sglt2i = parseMedication(dmField, 'sglt2i')

    // Statin
    const statinField = String(row['IN CASE DYSLIPIDEMIA'] || '').trim()
    const statin = parseMedication(statinField, 'statin')

    // DAPT (Aspirin + P2Y12) from ANTICOGULANT
    const dapt = parseDaptFromAnticoagulantColumn(row['ANTICOGULANT'])

    // OAC & Antiarrhythmics from ANTI-arrhythmic therapy
    const oac = parseOacFromAntiarrhythmicColumn(row['ANTI-arrhythmic therapy'])

    // Numeric GDMT Doses
    const raasiDoseMg = extractNumericDose(raasi.dose)
    const betablockerDoseMg = extractNumericDose(betaBlocker.dose)
    const mraDoseMg = extractNumericDose(mra.dose)
    const sglt2iDoseMg = extractNumericDose(sglt2i.dose)
    const furosemideDoseMgDaily = extractNumericDose(diuretic.dose)

    // Functional Grip (Baseline)
    const gripLeft = parseFloat(row['HARD GRIP TEST L HAND']) || undefined
    const gripRight = parseFloat(row['R HAND']) || undefined

    // Vaccination
    const vaccVal = String(row['VACCINATION'] || '').toUpperCase()
    const vaccInfluenza = (vaccVal.includes('INFLUENZA') || vaccVal.includes('DONE')) ? 'Yes' : 'No'
    const vaccPneumo = (vaccVal.includes('PNEUMO') || vaccVal.includes('DONE')) ? 'Yes' : 'No'

    // Match or create patient ID
    let patientId = existingByHid.get(mrn.toLowerCase()) || (srNo ? existingBySr.get(String(srNo)) : undefined)
    if (!patientId && rawPhone) {
      const ph = rawPhone.replace(/\D/g, '')
      if (ph.length >= 10) patientId = existingByPhone.get(ph.slice(0, 10))
    }
    if (!patientId) {
      patientId = doc(collection(db, 'patients')).id
    }

    // ── Build Patient Document ───────────────────────────────────────────────
    const patientDoc: Partial<Patient> = clean({
      firstName,
      lastName,
      dob,
      birthYear,
      dobPrecision: 'year',
      sex,
      age: !isNaN(age) ? age : undefined,
      mrn,
      registrySerialId: syntheticMrn,
      srNo: !isNaN(srNo) ? srNo : undefined,
      contact,
      address,
      addressDistrict: 'Pune',
      addressState: 'Maharashtra',
      hospitalName: 'AICTS, Pune',
      siteId: 'AICTS_PUNE',
      primaryDoctor: 'Dr. A. Jayachandra',
      attendingDoctor: 'Dr. A. Jayachandra',
      currentSmoker: isSmoker,
      status: 'Active',
      consentStatus: 'Granted',
      studyConsented: true,
      indianCitizen: true,
      ethnicity: 'Indian',
      registryId: 'hf',
      registryIds: ['hf'],
      registryEnrollments: {
        hf: {
          enrolledAt: indexDate ? `${indexDate}T00:00:00.000Z` : nowIso,
          enrolledBy: 'importer_script_v2',
          siteId: 'AICTS_PUNE',
          piName: 'Dr. A. Jayachandra',
          status: 'Active'
        }
      },
      hfConfirmationDate: indexDate || undefined,
      indexEtiology: etiologies,
      hfType,
      nyha,
      lvef: baselineLvef,
      icdPresence: dev.hasIcd,
      crtPresence: dev.hasCrt,
      comorbidCAD: hospHistory.priorPci || hospHistory.priorCabg || etiologies.includes('Ischaemic CAD'),
      comorbidPriorMI: hospHistory.raw.includes('MI') || hospHistory.raw.includes('AWMI') || hospHistory.raw.includes('IWMI'),
      comorbidPriorPCI: hospHistory.priorPci,
      comorbidPriorCABG: hospHistory.priorCabg,
      comorbidAF: ecg.rhythm === 'AF',
      comorbidDiabetes: String(row['IF DM IS DIAGNOSED'] || '').trim().toUpperCase() !== 'NO' && String(row['IF DM IS DIAGNOSED'] || '').trim() !== '',
      comorbidHypertension: etiologies.includes('Hypertensive Heart Disease'),
      comorbidCKD: (creatinine !== undefined && creatinine >= 1.5) || (egfr !== undefined && egfr < 60),
      comorbidDyslipidemia: statin.prescribed === 'Yes',
      importBatchId,
      sourceFile: 'HF1 2.xlsx',
      sourceRow: rowIdx,
      createdAt: indexDate ? `${indexDate}T00:00:00.000Z` : nowIso,
      updatedAt: nowIso
    })

    // ── Build Visit 1 (Baseline Visit) ───────────────────────────────────────
    const baselineVisitDate = indexDate || nowIso.split('T')[0]
    const baselineVisitId = `visit_base_${patientId}`
    const baselineVisit: Partial<Visit> = clean({
      id: baselineVisitId,
      patientId,
      visitDate: baselineVisitDate,
      visitType: doaDate ? 'Inpatient' : 'OPD',
      weight,
      height,
      bmi,
      bpSystolic,
      bpDiastolic,
      heartRate,
      nyha,
      sixMWT,
      lvef: baselineLvef,
      hfType,
      etiology: etiologies,
      hospHistory: hospHistory.hospHistory,
      hospCount: hospHistory.hospCount,
      hospDetails: hospHistory.raw || undefined,
      creatinine,
      egfr,
      potassium,
      hb,
      mcv,
      hba1c,
      tft,
      ntProBNP: biomarker.assay === 'NT-proBNP' ? biomarker.value : undefined,
      bnp: biomarker.assay === 'BNP' ? biomarker.value : undefined,
      qrsDuration: ecg.qrsDuration,
      qtcInterval: ecg.qtcInterval,
      bbb: ecg.bbb || undefined,
      rhythm: ecg.rhythm,
      device: dev.deviceTypes.length ? dev.deviceTypes : undefined,
      deviceNotes: dev.advisedOnly ? 'Advised / Pending Implant' : dev.implantDate ? `Implanted ${dev.implantDate}` : undefined,
      diuretic,
      raasi,
      betaBlocker,
      mra,
      digoxin,
      ivabradine,
      vericiguat,
      sglt2i,
      statin: { prescribed: statin.prescribed, dose: statin.dose, type: statin.type },
      aspirin: dapt.aspirin,
      p2y12Inhibitor: dapt.p2y12Inhibitor,
      noac: oac.noac,
      vki: oac.vki,
      raasiDoseMg,
      betablockerDoseMg,
      mraDoseMg,
      sglt2iDoseMg,
      furosemideDoseMgDaily,
      gripLeft,
      gripRight,
      vaccPneumo,
      vaccInfluenza,
      tobaccoStatus: isSmoker ? 'Current' : 'Never',
      clinicalNotes: `Baseline encounter at AICTS Pune. Etiology: ${etiologies.join(', ') || 'Idiopathic'}. ECG: ${ecg.raw || '—'}. Device status: ${dev.raw || 'None'}.`,
      importBatchId,
      sourceFile: 'HF1 2.xlsx',
      sourceRow: rowIdx,
      importedAt: nowIso
    })
    visitsCount++

    // ── Build Visit 2 (3-Month Follow-Up Visit) ──────────────────────────────
    const fuGripLeft = parseFloat(row['3 MONTHS FU L HAND']) || undefined
    const fuGripRight = parseFloat(row['R HAND_1'] !== undefined ? row['R HAND_1'] : row['R HAND']) || undefined
    const fuWeight = parseFloat(row['WEIGHT_1'] !== undefined ? row['WEIGHT_1'] : row['WEIGHT']) || undefined
    const fuSixMwt = parseInt(row['6MWT_1'] !== undefined ? row['6MWT_1'] : row['6MWT'], 10) || undefined
    const fuBiomarker = parseBiomarker(row['NT proBNP'])
    const { lvef: fuLvef } = parseLvef(row['ECHO'])

    let fuVisit: Partial<Visit> | null = null
    const hasFollowUpData = fuGripLeft !== undefined || fuGripRight !== undefined || fuWeight !== undefined || fuSixMwt !== undefined || fuBiomarker.value !== undefined || fuLvef !== undefined

    if (hasFollowUpData) {
      const fuVisitDate = addDays(baselineVisitDate, 90) || nowIso.split('T')[0]
      const fuVisitId = `visit_fu3m_${patientId}`

      let fuHfType = hfType
      if (fuLvef !== undefined) {
        if (baselineLvef !== undefined && baselineLvef < 40 && fuLvef >= 40) {
          fuHfType = 'HFimpEF' as any // Heart Failure with Improved Ejection Fraction
        } else if (fuLvef >= 50) fuHfType = 'HFpEF'
        else if (fuLvef >= 40) fuHfType = 'HFmrEF'
        else fuHfType = 'HFrEF'
      }

      fuVisit = clean({
        id: fuVisitId,
        patientId,
        visitDate: fuVisitDate,
        visitType: 'Follow-up' as const,
        weight: fuWeight,
        sixMWT: fuSixMwt,
        gripLeft: fuGripLeft,
        gripRight: fuGripRight,
        lvef: fuLvef,
        priorLvef: baselineLvef, // preserves trajectory for delta LVEF & HFimpEF
        hfType: fuHfType,
        ntProBNP: fuBiomarker.assay === 'NT-proBNP' ? fuBiomarker.value : undefined,
        bnp: fuBiomarker.assay === 'BNP' ? fuBiomarker.value : undefined,
        diuretic,
        raasi,
        betaBlocker,
        mra,
        sglt2i,
        aspirin: dapt.aspirin,
        p2y12Inhibitor: dapt.p2y12Inhibitor,
        noac: oac.noac,
        vki: oac.vki,
        clinicalNotes: `3-Month scheduled follow-up. Delta Grip R: ${fuGripRight && gripRight ? (fuGripRight - gripRight).toFixed(1) : '—'}kg, Delta 6MWT: ${fuSixMwt && sixMWT ? fuSixMwt - sixMWT : '—'}m, Delta LVEF: ${fuLvef && baselineLvef ? fuLvef - baselineLvef : '—'}%.`,
        importBatchId,
        sourceFile: 'HF1 2.xlsx',
        sourceRow: rowIdx,
        importedAt: nowIso
      })
      visitsCount++
      patientDoc.visitCount = 2
    } else {
      patientDoc.visitCount = 1
    }

    // ── Build OutcomeEvent (if DOA + DOD present) ────────────────────────────
    let outcomeEvent: Partial<OutcomeEvent> | null = null
    const dodDate = parseDate(row['DOD'])
    if (doaDate && dodDate) {
      const los = daysDiff(doaDate, dodDate)
      outcomeEvent = clean({
        id: `outcome_${patientId}_hosp`,
        patientId,
        eventType: 'HF hospitalisation' as const,
        admissionDate: doaDate,
        dischargeDate: dodDate,
        lengthOfStayDays: los,
        eventDate: doaDate,
        hospitalName: 'AICTS, Pune',
        facilityType: 'Military/ECHS' as const,
        primaryReasonDescription: 'Acute decompensated heart failure / Index inpatient admission',
        hfConfirmationCriteriaMet: true,
        adjudicated: false,
        adjudicationStatus: 'Pending Review' as const,
        createdAt: nowIso
      })
      outcomesCount++
    }

    // Dry Run logging
    if (isDryRun) {
      console.log(`[DRY-RUN Row ${String(rowIdx).padStart(2)}] MRN: ${mrn.padEnd(16)} | Patient: "${firstName} ${lastName}" | LVEF: ${baselineLvef ?? '—'}% -> FU LVEF: ${fuLvef ?? '—'}% | Baseline Visit: YES | 3-Mo FU Visit: ${fuVisit ? 'YES' : 'NO'} | Outcome: ${outcomeEvent ? 'YES (LOS ' + outcomeEvent.lengthOfStayDays + 'd)' : 'NO'}`)
    } else {
      // Live Commit to Firestore
      batch.set(doc(db, 'patients', patientId), patientDoc, { merge: true })
      opsInBatch++

      batch.set(doc(db, 'visits', baselineVisitId), baselineVisit, { merge: true })
      opsInBatch++

      if (fuVisit) {
        batch.set(doc(db, 'visits', fuVisit.id!), fuVisit, { merge: true })
        opsInBatch++
      }

      if (outcomeEvent) {
        batch.set(doc(db, 'patients', patientId, 'outcomes', outcomeEvent.id!), outcomeEvent, { merge: true })
        opsInBatch++
      }

      if (opsInBatch >= 400) {
        await batch.commit()
        batch = writeBatch(db)
        opsInBatch = 0
      }
    }
  }

  if (!isDryRun && opsInBatch > 0) {
    await batch.commit()
  }

  console.log('\n========================================================================')
  console.log(`Summary: Processed ${processedCount} patients.`)
  console.log(`Visits planned: ${visitsCount} (Baseline + Longitudinal Follow-up).`)
  console.log(`Outcome Events planned: ${outcomesCount}.`)
  if (isDryRun) {
    console.log(`🛡️  DRY-RUN COMPLETE: 0 writes made to Firestore.`)
    console.log(`To write to Firestore, re-run with: npx tsx scripts/import_hf1_2_jayachandra.ts --commit`)
  } else {
    console.log(`✅ LIVE COMMIT COMPLETE: Successfully committed to Firestore.`)
  }
  console.log('========================================================================\n')
  process.exit(0)
}

run().catch(err => {
  console.error('Error during clinical import:', err)
  process.exit(1)
})
