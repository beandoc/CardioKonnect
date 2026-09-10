import * as fs from 'fs'
import * as path from 'path'

// Load .env.local
const envPath = path.resolve(process.cwd(), '.env.local')
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const t = line.trim()
    if (t && !t.startsWith('#')) {
      const i = t.indexOf('=')
      if (i !== -1) process.env[t.substring(0, i).trim()] = t.substring(i + 1).trim()
    }
  })
}

async function fixCathlabDetails() {
  const { collection, getDocs, updateDoc, doc, query, where } = await import('firebase/firestore')
  const { initializeApp, getApps } = await import('firebase/app')
  const { getFirestore } = await import('firebase/firestore')

  const app = getApps().length
    ? getApps()[0]
    : initializeApp({
        apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
        authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
      })
  const db = getFirestore(app)

  console.log('Fetching cath lab patients...')
  const snap = await getDocs(query(collection(db, 'patients'), where('registryIds', 'array-contains', 'cathlab')))
  
  const cathlabPatientUpdates: Record<string, { mrn: string; addressState: string; addressDistrict: string; address: string }> = {
    'Rajesh Patil': {
      mrn: 'KCAH-2026-0001',
      addressState: 'Uttar Pradesh',
      addressDistrict: 'Kanpur Nagar',
      address: 'Swaroop Nagar, Kanpur, UP',
    },
    'Sunita Sharma': {
      mrn: 'KCAH-2026-0002',
      addressState: 'Uttar Pradesh',
      addressDistrict: 'Kanpur Nagar',
      address: 'Kakadeo, Kanpur, UP',
    },
    'Mohan Iyer': {
      mrn: 'KCAH-2026-0003',
      addressState: 'Uttar Pradesh',
      addressDistrict: 'Kanpur Nagar',
      address: 'Civil Lines, Kanpur, UP',
    },
    'Priya Nair': {
      mrn: 'KCAH-2026-0004',
      addressState: 'Uttar Pradesh',
      addressDistrict: 'Kanpur Nagar',
      address: 'Govind Nagar, Kanpur, UP',
    },
    'Vikram Desai': {
      mrn: 'KCAH-2026-0005',
      addressState: 'Uttar Pradesh',
      addressDistrict: 'Kanpur Nagar',
      address: 'Lajpat Nagar, Kanpur, UP',
    },
  }

  for (const patientDoc of snap.docs) {
    const data = patientDoc.data()
    const fullName = `${data.firstName || ''} ${data.lastName || ''}`.trim()
    
    if (cathlabPatientUpdates[fullName]) {
      const updateData = cathlabPatientUpdates[fullName]
      console.log(`Updating ${fullName} (${patientDoc.id}): MRN -> ${updateData.mrn}, State -> ${updateData.addressState}`)
      await updateDoc(doc(db, 'patients', patientDoc.id), {
        ...updateData,
        siteId: 'KANPUR_APEX',
        hospitalName: 'Kanpur Cardiac Apex Hospital',
        'registryEnrollments.cathlab.siteId': 'KANPUR_APEX',
      })

      // Also update subcollection procedures if any
      const procSnap = await getDocs(collection(db, 'patients', patientDoc.id, 'procedures'))
      for (const pDoc of procSnap.docs) {
        console.log(`  Updating procedure ${pDoc.id} siteId -> KANPUR_APEX`)
        await updateDoc(doc(db, 'patients', patientDoc.id, 'procedures', pDoc.id), {
          siteId: 'KANPUR_APEX',
        })
      }
    }
  }

  console.log('✓ Done fixing Cath Lab patient details.')
}

fixCathlabDetails().catch(console.error)
