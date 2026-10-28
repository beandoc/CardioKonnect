/**
 * scripts/provision_users.ts
 *
 * Creates (or updates) a Firebase Auth account and a users/{uid} profile for
 * every entry in APP_USERS. Firestore security rules authorize every request
 * against that profile, so this must run before the locked-down rules deploy.
 *
 * New accounts get a random password; the script prints a password-reset link
 * per new user to hand over out-of-band. No passwords are stored in the repo.
 *
 * Run (service-account JSON from Firebase Console → Project settings → Service accounts):
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/sa.json npx tsx scripts/provision_users.ts
 */

import { randomBytes } from 'crypto'
import { initializeApp, applicationDefault } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { USER_LIST } from '../lib/appConfig'

initializeApp({ credential: applicationDefault() })
const auth = getAuth()
const db = getFirestore()

async function main() {
  for (const user of USER_LIST) {
    let uid: string
    let created = false
    try {
      uid = (await auth.getUserByEmail(user.email)).uid
    } catch {
      const record = await auth.createUser({
        email: user.email,
        displayName: user.name,
        password: randomBytes(24).toString('base64url'),
      })
      uid = record.uid
      created = true
    }

    await db.doc(`users/${uid}`).set({
      userId: user.id,
      email: user.email,
      role: user.role,
      siteId: user.siteId,
      registryAccess: user.registryAccess,
      updatedAt: FieldValue.serverTimestamp(),
    })

    if (created) {
      const link = await auth.generatePasswordResetLink(user.email)
      console.log(`CREATED ${user.email} (${user.role}, ${user.siteId})\n  set-password link: ${link}`)
    } else {
      console.log(`UPDATED ${user.email} (${user.role}, ${user.siteId})`)
    }
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
