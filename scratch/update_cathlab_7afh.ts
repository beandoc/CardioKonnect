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

async function updateCathlabMRNPrefix() {
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
  
  const cathlabMRNMap: Record<string, string> = {
    'Rajesh Patil': '7AFH-2026-0001',
    'Sunita Sharma': '7AFH-2026-0002',
    'Mohan Iyer': '7AFH-2026-0003',
    'Priya Nair': '7AFH-2026-0004',
    'Vikram Desai': '7AFH-2026-0005',
  }

  for (const patientDoc of snap.docs) {
    const data = patientDoc.data()
    const fullName = `${data.firstName || ''} ${data.lastName || ''}`.trim()
    
    if (cathlabMRNMap[fullName]) {
      const newMRN = cathlabMRNMap[fullName]
      console.log(`Updating ${fullName} (${patientDoc.id}): MRN -> ${newMRN}`)
      await updateDoc(doc(db, 'patients', patientDoc.id), {
        mrn: newMRN,
      })
    }
  }

  console.log('✓ Done updating Cath Lab MRN prefix to 7AFH-2026-XXXX.')
}

updateCathlabMRNPrefix().catch(console.error)
