# Auth & Firestore rules rollout

## Current state

- Login uses the fixed usernames/passwords, checked server-side by `app/api/login/route.ts`
  (passwords are no longer in the browser bundle). The session is stored in localStorage.
- Every query is scoped to the signed-in user's `siteId` in `lib/firestore.ts`, and all
  mutations write to the `auditLog` collection.
- **The live Firestore database is still open** (the previously deployed allow-all rules).
  Anyone with the public Firebase config can read and write it directly, bypassing the app.
- `firestore.rules` in this repo is the locked-down version. **Do not deploy it** while the
  fixed logins are in use: it requires Firebase Auth, so it would reject every request.

## To close the open database later

1. Enable Email/Password sign-in in Firebase Console → Authentication; disable self sign-up.
2. Generate a service-account key (Project settings → Service accounts); keep it outside the repo.
3. `GOOGLE_APPLICATION_CREDENTIALS=/path/sa.json npx tsx scripts/provision_users.ts`
4. `GOOGLE_APPLICATION_CREDENTIALS=/path/sa.json npx tsx scripts/backfill_site_ids.ts` (dry run), then `--apply`.
5. Switch the login page and `context/AppUserContext.tsx` to Firebase Auth
   (`signInWithEmailAndPassword` / `onAuthStateChanged`), mapping the account email to its
   `APP_USERS` entry with `findUserByEmail`.
6. `firebase deploy --only firestore:rules,firestore:indexes`, then deploy the app.

Step 4 is safe to run any time and is worth doing now: records without `siteId` are hidden by
the site-scoped queries.

## Notes
- `/api/copilot` expects a Firebase ID token, so it returns 401 until step 5. Nothing in the UI calls it yet.
- Scripts under `scripts/` that use the client SDK stop working once the rules are deployed;
  port them to `firebase-admin` if still needed.
