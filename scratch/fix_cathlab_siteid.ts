/**
 * fix_cathlab_siteid.ts
 * 
 * One-time fix: update siteId on cathlab patients and their registryEnrollments
 * from 'AICTS_PUNE' (incorrect) to 'KANPUR_APEX' (correct — Kanpur Cardiac Apex Hospital).
 *
 * Usage: npx tsx scratch/fix_cathlab_siteid.ts
 */
import * as fs from 'fs'
import * as path from 'path'

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

async function fix() {
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

  const snap = await getDocs(query(collection(db, 'patients'), where('registryId', '==', 'cathlab')))
  console.log(`\nFound ${snap.docs.length} cath lab patients to fix\n`)

  let fixed = 0
  for (const d of snap.docs) {
    const data = d.data()
    const name = `${data.firstName || ''} ${data.lastName || ''}`.trim()
    await updateDoc(doc(db, 'patients', d.id), {
      siteId: 'KANPUR_APEX',
      'registryEnrollments.cathlab.siteId': 'KANPUR_APEX',
    })
    console.log(`  ✓  ${name} (${d.id}) → siteId: KANPUR_APEX`)
    fixed++
  }

  console.log(`\n✓  Fixed ${fixed} cath lab patients → site: Kanpur Cardiac Apex Hospital`)
}

fix().catch(err => { console.error('✗  Failed:', err); process.exit(1) })
