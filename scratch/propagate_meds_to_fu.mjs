import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, updateDoc } from "firebase/firestore";
import XLSX from "xlsx";
import fs from "fs";

const envContent = fs.readFileSync(".env.local", "utf8");
const envVars = {};
envContent.split("\n").forEach(line => {
  const [k, ...v] = line.split("=");
  if (k && v.length) envVars[k.trim()] = v.join("=").trim();
});

const firebaseConfig = {
  apiKey: envVars.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: envVars.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: envVars.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: envVars.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: envVars.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: envVars.NEXT_PUBLIC_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function propagateMedsAndLabs() {
  const pSnap = await getDocs(collection(db, "patients"));
  console.log(`Found ${pSnap.size} patients.`);

  for (const pDoc of pSnap.docs) {
    const pId = pDoc.id;
    const pData = pDoc.data();
    const vSnap = await getDocs(collection(db, "patients", pId, "visits"));
    
    if (vSnap.size < 2) continue;

    const visits = vSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    // Sort chronological: oldest (baseline) first
    visits.sort((a, b) => new Date(a.visitDate).getTime() - new Date(b.visitDate).getTime());

    const baseline = visits[0];

    // For all subsequent follow-up visits, propagate ongoing chronic medications & baseline labs if missing
    for (let i = 1; i < visits.length; i++) {
      const fu = visits[i];
      const updates = {};

      // Propagate GDMT Medications
      if (!fu.raasi?.prescribed && baseline.raasi?.prescribed) updates.raasi = baseline.raasi;
      if (!fu.betaBlocker?.prescribed && baseline.betaBlocker?.prescribed) updates.betaBlocker = baseline.betaBlocker;
      if (!fu.mra?.prescribed && baseline.mra?.prescribed) updates.mra = baseline.mra;
      if (!fu.sglt2i?.prescribed && baseline.sglt2i?.prescribed) updates.sglt2i = baseline.sglt2i;
      if (!fu.diuretic?.prescribed && baseline.diuretic?.prescribed) updates.diuretic = baseline.diuretic;
      if (!fu.statin?.prescribed && baseline.statin?.prescribed) updates.statin = baseline.statin;
      if (!fu.aspirin?.prescribed && baseline.aspirin?.prescribed) updates.aspirin = baseline.aspirin;
      if (!fu.noac?.prescribed && baseline.noac?.prescribed) updates.noac = baseline.noac;
      if (!fu.vki?.prescribed && baseline.vki?.prescribed) updates.vki = baseline.vki;
      if (!fu.digoxin?.prescribed && baseline.digoxin?.prescribed) updates.digoxin = baseline.digoxin;
      if (!fu.ivabradine?.prescribed && baseline.ivabradine?.prescribed) updates.ivabradine = baseline.ivabradine;

      // Propagate labs & clinical assessment
      if (!fu.etiology && baseline.etiology) updates.etiology = baseline.etiology;
      if (!fu.rhythm && baseline.rhythm) updates.rhythm = baseline.rhythm;
      if (!fu.creatinine && baseline.creatinine) updates.creatinine = baseline.creatinine;
      if (!fu.egfr && baseline.egfr) updates.egfr = baseline.egfr;
      if (!fu.potassium && baseline.potassium) updates.potassium = baseline.potassium;
      if (!fu.hb && baseline.hb) updates.hb = baseline.hb;
      if (!fu.mcv && baseline.mcv) updates.mcv = baseline.mcv;
      if (!fu.hba1c && baseline.hba1c) updates.hba1c = baseline.hba1c;
      if (!fu.tft && baseline.tft) updates.tft = baseline.tft;
      if (!fu.bpSystolic && baseline.bpSystolic) updates.bpSystolic = baseline.bpSystolic;
      if (!fu.bpDiastolic && baseline.bpDiastolic) updates.bpDiastolic = baseline.bpDiastolic;
      if (!fu.heartRate && baseline.heartRate) updates.heartRate = baseline.heartRate;

      if (Object.keys(updates).length > 0) {
        await updateDoc(doc(db, "patients", pId, "visits", fu.id), updates);
        console.log(`Propagated ${Object.keys(updates).length} fields to FU visit ${fu.id} for ${pData.firstName} ${pData.lastName}`);
      }
    }
  }

  console.log('\nFinished propagating GDMT medications and clinical parameters across follow-up visits.');
  process.exit(0);
}

propagateMedsAndLabs().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
