import * as fs from 'fs'
import * as path from 'path'
import * as xlsx from 'xlsx'
import { initializeApp, getApps } from 'firebase/app'
import { getFirestore, collection, getDocs, doc, writeBatch } from 'firebase/firestore'
import { cleanMilitaryRanks, splitPatientName, initials } from '../lib/utils'

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

async function sanitizeDatabasePatientNames() {
  console.log('--- STARTING PATIENT NAME SANITIZATION IN FIRESTORE ---')
  
  // 1. Index Excel if available
  const excelPath = '/Users/sachinsrivastava/Downloads/HF1 2.xlsx'
  const excelBySr = new Map<string, string>()
  const excelByPhone = new Map<string, string>()

  if (fs.existsSync(excelPath)) {
    const wb = xlsx.readFile(excelPath)
    const sheet = wb.Sheets[wb.SheetNames[0]]
    const excelRows = xlsx.utils.sheet_to_json(sheet) as any[]

    excelRows.forEach(r => {
      const sr = String(r['SR. NO.'] || '').trim().replace(/\*/g, '')
      const name = r['NAME'] || r['PATIENT NAME'] || r['Name']
      if (sr && name) {
        excelBySr.set(sr, name)
        const parsedSr = parseInt(sr, 10)
        if (!isNaN(parsedSr)) {
          excelBySr.set(String(parsedSr), name)
        }
      }
      const rawPhone = String(r['PHONE'] || '').replace(/\D/g, '')
      if (rawPhone.length >= 10 && name) {
        excelByPhone.set(rawPhone.slice(0, 10), name)
      }
    })
    console.log(`Loaded ${excelRows.length} source records from Excel.`)
  }

  // 2. Fetch all patients
  const pSnap = await getDocs(collection(db, 'patients'))
  console.log(`Found ${pSnap.size} patients in Firestore. Processing...`)

  let updatedCount = 0
  let batch = writeBatch(db)
  let opsInBatch = 0
  const nowIso = new Date().toISOString()

  for (const pDoc of pSnap.docs) {
    const p = pDoc.data()
    let rawSource = ''

    // Match by phone
    const pPhone = String(p.contact || '').replace(/\D/g, '')
    if (pPhone.length >= 10 && excelByPhone.has(pPhone.slice(0, 10))) {
      rawSource = excelByPhone.get(pPhone.slice(0, 10))!
    }

    // Match by SR or MRN
    if (!rawSource) {
      let srKey = ''
      if (p.srNo) {
        srKey = String(p.srNo).replace(/\*/g, '')
      } else if (p.mrn && p.mrn.includes('AICTS-2026-')) {
        const match = p.mrn.match(/AICTS-2026-0*(\*?\d+)/)
        if (match) srKey = match[1].replace(/\*/g, '')
      }
      if (srKey && excelBySr.has(srKey)) {
        rawSource = excelBySr.get(srKey)!
      }
    }

    // Fallback to currently stored name
    if (!rawSource) {
      rawSource = `${p.firstName || ''} ${p.lastName || ''}`.trim()
    }

    // Clean military ranks and relationships
    const cleanedFullName = cleanMilitaryRanks(rawSource)
    const { firstName, lastName } = splitPatientName(cleanedFullName)
    const inits = initials(firstName, lastName)

    const needsUpdate = p.firstName !== firstName || p.lastName !== lastName

    if (needsUpdate) {
      updatedCount++
      console.log(`[UPDATE ${updatedCount}] ${p.mrn || 'NO-MRN'} (${p.siteId}): "${p.firstName} ${p.lastName}" -> First: "${firstName}" | Last: "${lastName}" [${inits}]`)
      
      batch.update(doc(db, 'patients', pDoc.id), {
        firstName,
        lastName,
        updatedAt: nowIso
      })
      opsInBatch++

      if (opsInBatch >= 400) {
        await batch.commit()
        batch = writeBatch(db)
        opsInBatch = 0
      }
    } else {
      console.log(`[OK] ${p.mrn || 'NO-MRN'}: First: "${firstName}" | Last: "${lastName}" [${inits}]`)
    }
  }

  if (opsInBatch > 0) {
    await batch.commit()
  }

  console.log(`\n✅ Finished! Updated ${updatedCount} patient records in Firestore.`)
  process.exit(0)
}

sanitizeDatabasePatientNames().catch(err => {
  console.error('Error during sanitization:', err)
  process.exit(1)
})
