/**
 * seed_cathlab_demo.ts
 *
 * Seeds 5 clinically realistic Indian cath lab / interventional cardiology patients
 * with complete procedure records into Firestore.
 *
 * MUST be run from the project root:
 *   npx tsx scratch/seed_cathlab_demo.ts
 *
 * Patients:
 *  1. Rajesh Patil     — 58M, anterior STEMI, primary PCI LAD, DTB 58 min
 *  2. Sunita Sharma    — 52F, NSTEMI, two-vessel, staged PCI (2 procedures)
 *  3. Mohan Iyer       — 67M, CCS, LM bifurcation DK-Crush, SYNTAX 28
 *  4. Priya Nair       — 45F, OHCA/CTO, IABP, IVL, radial crossover
 *  5. Vikram Desai     — 72M, NSTEMI, prior CABG, SVG-RCA, CIN complication
 */

import * as fs from 'fs'
import * as path from 'path'

// ─── Step 1: Load .env.local BEFORE any Firebase imports ─────────────────────
const envPath = path.resolve(process.cwd(), '.env.local')
if (fs.existsSync(envPath)) {
  const envFile = fs.readFileSync(envPath, 'utf8')
  envFile.split('\n').forEach(line => {
    const trimmed = line.trim()
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=')
      if (idx !== -1) {
        const key = trimmed.substring(0, idx).trim()
        const val = trimmed.substring(idx + 1).trim()
        process.env[key] = val
      }
    }
  })
  console.log('✓  .env.local loaded — Project:', process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID)
} else {
  console.error('✗  .env.local not found at', envPath)
  process.exit(1)
}

// ─── Step 2: Dynamic import after env is set ─────────────────────────────────

async function seed() {
  const { addPatient, addProcedure } = await import('../lib/firestore')

  const SITE_ID  = 'KANPUR_APEX'
  const OP1_ID   = 'DR_RAJEEV_CHAUHAN'
  const OP1_NAME = 'Dr. Rajeev Chauhan'
  const OP2_ID   = 'DR_RANE_SP'
  const OP2_NAME = 'Dr. S.P. Rane'

  function dt(date: string, time: string) {
    return `${date}T${time}:00`
  }

  // ── Deep-strip any undefined/null so Firestore never sees invalid values ──
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function clean(obj: any): any {
    return JSON.parse(JSON.stringify(obj))
  }

  console.log('\n' + '═'.repeat(60))
  console.log('  CardioPlus Cath Lab — Demo Patient Seeder')
  console.log('═'.repeat(60) + '\n')

  // ──────────────────────────────────────────────────────────────────────────
  // PATIENT 1: Rajesh Patil — Anterior STEMI, Primary PCI, DTB 58 min
  // ──────────────────────────────────────────────────────────────────────────
  console.log('▶  Patient 1: Rajesh Patil (58M) — Anterior STEMI, Primary PCI')
  const p1Id = await addPatient(clean({
    firstName: 'Rajesh', lastName: 'Patil',
    mrn: '7AFH-2026-0001',
    dob: '1968-03-14', sex: 'Male', age: 58,
    registryId: 'cathlab',
    siteId: 'KANPUR_APEX',
    hospitalName: 'Kanpur Cardiac Apex Hospital',
    addressState: 'Uttar Pradesh',
    addressDistrict: 'Kanpur Nagar',
    address: 'Swaroop Nagar, Kanpur, UP',
    indianCitizen: true, studyConsented: true,
    consentStatus: 'Granted', status: 'Active',
    comorbidities: ['HTN', 'Hypertension', 'DM', 'Diabetes Mellitus', 'Dyslipidaemia'],
    comorbidPriorPCI: false, comorbidPriorCABG: false, comorbidCAD: true,
    comorbidDiabetes: true, comorbidHypertension: true, comorbidDyslipidemia: true,
    comorbidCKD: false,
  }))
  console.log('   Patient ID:', p1Id)

  const proc1p1Id = await addProcedure(p1Id, clean({
    patientId: p1Id,
    siteId: SITE_ID, operatorId: OP1_ID, operatorName: OP1_NAME,
    procedureDateTime: dt('2026-08-15', '09:30'),
    seqForPatient: 1,
    admissionType: 'Emergency', presentation: 'STEMI',
    killipClass: 'II', priorPCI: false, priorCABG: false,
    cardiacArrestPreProcedure: false,
    symptomOnset:    dt('2026-08-15', '07:15'),
    firstMedicalContact: dt('2026-08-15', '07:45'),
    hospitalArrival: dt('2026-08-15', '09:00'),
    ecgTime:         dt('2026-08-15', '09:05'),
    labActivation:   dt('2026-08-15', '09:10'),
    arterialAccess:  dt('2026-08-15', '09:25'),
    firstDevice:     dt('2026-08-15', '09:58'),  // DTB = 58 min ✓
    transferredIn: false, thrombolysisGiven: false,
    accessSite: 'Radial Right', sheathSize: '6F',
    accessCrossover: false, closureDevice: 'Radial Band',
    ultrasoundGuidedAccess: false,
    dominance: 'Right',
    segmentStenosisMap: { 5: 20, 6: 100, 7: 30, 2: 15 },
    rentropCollaterals: 'Grade 0',
    preTimiPerVessel: { lad: 0, rca: 3 },
    ivusOctDone: true,
    ivusOctFindings: 'Plaque rupture with thrombus at LAD proximal. MLA 3.8 mm². Optimal stent expansion post-DES.',
    ffrIfrDone: false,
    lesions: [{
      id: 'l1', segmentNumber: 6, vessel: 'LAD', lesionOrder: 1,
      preStenosisPct: 100, postStenosisPct: 0,
      lesionLengthMm: 22, referenceVesselDiameterMm: 3.5,
      accAhaClass: 'B2', bifurcation: false, ostial: false,
      cto: false, inStentRestenosis: false,
      calcification: 'Mild', thrombusGrade: 4, tortuosity: 'None',
      culprit: true, treated: true,
      preTimiFlow: 0, postTimiFlow: 3, deviceIds: ['dev1'],
    }],
    devices: [{
      id: 'dev1', targetSegment: 6, type: 'DES',
      make: 'Abbott', model: 'Xience Sierra',
      diameterMm: 3.5, lengthMm: 28,
      deploymentPressureAtm: 14, postDilatation: true,
      postDilatationPressureAtm: 20,
    }],
    thrombectomyDone: true, thrombectomyType: 'Manual Aspiration',
    atherectomyDone: false, ivlShockwaveDone: false,
    laserDone: false, guideExtensionUsed: false,
    mcsUsed: false, temporaryPacingDone: false,
    p2y12Agent: 'Ticagrelor', p2y12LoadingDoseGiven: true,
    gpIIbIIIaUsed: false,
    anticoagulant: 'Unfractionated Heparin',
    anticoagulantDose: 'UFH 70 U/kg IV bolus', peakActSeconds: 285,
    contrastVolumeMl: 185,
    contrastAgent: 'Low-osmolar (e.g. Omnipaque, Ultravist)',
    fluoroscopyTimeMin: 14, dapGyCm2: 48, airKermaMGy: 820,
    noReflow: false, dissectionNhlbi: 'None', perforationEllis: 'None',
    sideBranchLoss: false, acuteStentThrombosis: false, complications: [],
    dischargeDate: '2026-08-20',
    dischargeDaptAgent: 'Aspirin + Ticagrelor',
    dischargeDaptDurationMonths: 12,
    dischargeStatinIntensity: 'High',
    dischargeBetaBlocker: true, dischargeAceiArb: true, dischargeOac: false,
    stagedPciPlanned: false, heartTeamReferral: false,
    appropriateUseCriteria: 'Appropriate',
    radialFirstAdherence: true, enteredBy: OP1_ID, dataLocked: true,
  }))
  console.log('   Procedure 1 ID:', proc1p1Id, '(Primary PCI, DTB 58 min)\n')

  // ──────────────────────────────────────────────────────────────────────────
  // PATIENT 2: Sunita Sharma — NSTEMI, Two-vessel, Staged PCI
  // ──────────────────────────────────────────────────────────────────────────
  console.log('▶  Patient 2: Sunita Sharma (52F) — NSTEMI, Two-vessel, Staged PCI')
  const p2Id = await addPatient(clean({
    firstName: 'Sunita', lastName: 'Sharma',
    mrn: '7AFH-2026-0002',
    dob: '1974-07-22', sex: 'Female', age: 52,
    registryId: 'cathlab',
    siteId: 'KANPUR_APEX',
    hospitalName: 'Kanpur Cardiac Apex Hospital',
    addressState: 'Uttar Pradesh',
    addressDistrict: 'Kanpur Nagar',
    address: 'Kakadeo, Kanpur, UP',
    indianCitizen: true, studyConsented: true,
    consentStatus: 'Granted', status: 'Active',
    comorbidities: ['HTN', 'Hypertension', 'DM', 'Diabetes Mellitus', 'CKD'],
    comorbidPriorPCI: false, comorbidPriorCABG: false, comorbidCAD: true,
    comorbidDiabetes: true, comorbidHypertension: true,
    comorbidDyslipidemia: false, comorbidCKD: true,
  }))
  console.log('   Patient ID:', p2Id)

  const proc1p2Id = await addProcedure(p2Id, clean({
    patientId: p2Id,
    siteId: SITE_ID, operatorId: OP2_ID, operatorName: OP2_NAME,
    procedureDateTime: dt('2026-08-20', '11:00'),
    seqForPatient: 1,
    admissionType: 'Urgent', presentation: 'NSTEMI',
    killipClass: 'I', priorPCI: false, priorCABG: false,
    cardiacArrestPreProcedure: false,
    symptomOnset:    dt('2026-08-19', '22:00'),
    hospitalArrival: dt('2026-08-20', '00:30'),
    ecgTime:         dt('2026-08-20', '00:35'),
    labActivation:   dt('2026-08-20', '10:30'),
    arterialAccess:  dt('2026-08-20', '10:55'),
    firstDevice:     dt('2026-08-20', '11:42'),
    transferredIn: false, thrombolysisGiven: false,
    accessSite: 'Radial Right', sheathSize: '6F',
    accessCrossover: false, closureDevice: 'Radial Band',
    ultrasoundGuidedAccess: false,
    dominance: 'Right',
    segmentStenosisMap: { 6: 90, 7: 60, 2: 80, 3: 50 },
    preTimiPerVessel: { lad: 3, rca: 3 },
    rentropCollaterals: 'Grade 0',
    ivusOctDone: true,
    ivusOctFindings: 'OCT confirmed thin-cap fibro-atheroma at LAD mid. Adequate stent apposition post-deployment.',
    ffrIfrDone: true,
    ffrIfrValues: 'LAD iFR 0.72 (significant); RCA iFR 0.74 (significant — staged)',
    lesions: [
      {
        id: 'l2a', segmentNumber: 6, vessel: 'LAD', lesionOrder: 1,
        preStenosisPct: 90, postStenosisPct: 5,
        lesionLengthMm: 18, referenceVesselDiameterMm: 3.0,
        accAhaClass: 'B1', bifurcation: false, ostial: false,
        cto: false, inStentRestenosis: false,
        calcification: 'Mild', thrombusGrade: 1, tortuosity: 'None',
        culprit: true, treated: true,
        preTimiFlow: 3, postTimiFlow: 3, deviceIds: ['dev2a'],
      },
      {
        id: 'l2b', segmentNumber: 2, vessel: 'RCA', lesionOrder: 2,
        preStenosisPct: 80, postStenosisPct: 80,
        lesionLengthMm: 25, referenceVesselDiameterMm: 3.5,
        accAhaClass: 'B2', bifurcation: false, ostial: false,
        cto: false, inStentRestenosis: false,
        calcification: 'Moderate', thrombusGrade: 0, tortuosity: 'Moderate',
        culprit: false, treated: false,
        reasonNotTreated: 'Medically managed',
        preTimiFlow: 3, postTimiFlow: 3, deviceIds: [],
      },
    ],
    devices: [{
      id: 'dev2a', targetSegment: 6, type: 'DES',
      make: 'Meril Life Sciences', model: 'BioMime Morph',
      diameterMm: 3.0, lengthMm: 24,
      deploymentPressureAtm: 12, postDilatation: true,
      postDilatationPressureAtm: 18,
    }],
    thrombectomyDone: false, atherectomyDone: false, ivlShockwaveDone: false,
    laserDone: false, guideExtensionUsed: false, mcsUsed: false, temporaryPacingDone: false,
    p2y12Agent: 'Ticagrelor', p2y12LoadingDoseGiven: true, gpIIbIIIaUsed: false,
    anticoagulant: 'Unfractionated Heparin',
    anticoagulantDose: 'UFH 70 U/kg', peakActSeconds: 265,
    contrastVolumeMl: 210, contrastAgent: 'Iso-osmolar (e.g. Visipaque)',
    fluoroscopyTimeMin: 18, dapGyCm2: 55, airKermaMGy: 920,
    noReflow: false, dissectionNhlbi: 'None', perforationEllis: 'None',
    sideBranchLoss: false, acuteStentThrombosis: false, complications: [],
    dischargeDate: '2026-08-25',
    dischargeDaptAgent: 'Aspirin + Ticagrelor', dischargeDaptDurationMonths: 12,
    dischargeStatinIntensity: 'High',
    dischargeBetaBlocker: true, dischargeAceiArb: true, dischargeOac: false,
    stagedPciPlanned: true, stagedPciDate: '2026-09-25', heartTeamReferral: false,
    appropriateUseCriteria: 'Appropriate',
    radialFirstAdherence: true, enteredBy: OP2_ID, dataLocked: true,
  }))
  console.log('   Procedure 1 ID:', proc1p2Id, '(Index — LAD PCI, iFR-guided)')

  const proc2p2Id = await addProcedure(p2Id, clean({
    patientId: p2Id,
    siteId: SITE_ID, operatorId: OP2_ID, operatorName: OP2_NAME,
    procedureDateTime: dt('2026-09-25', '10:30'),
    seqForPatient: 2,
    admissionType: 'Elective', presentation: 'ChronicCoronarySyndrome',
    killipClass: 'I', priorPCI: true, priorCABG: false,
    cardiacArrestPreProcedure: false,
    transferredIn: false, thrombolysisGiven: false,
    arterialAccess: dt('2026-09-25', '10:25'),
    firstDevice:    dt('2026-09-25', '11:05'),
    accessSite: 'Radial Right', sheathSize: '6F',
    accessCrossover: false, closureDevice: 'Radial Band',
    ultrasoundGuidedAccess: false,
    dominance: 'Right',
    segmentStenosisMap: { 6: 0, 2: 5, 3: 20 },
    preTimiPerVessel: { rca: 3 }, rentropCollaterals: 'Grade 0',
    ivusOctDone: false, ffrIfrDone: false,
    lesions: [{
      id: 'l2c', segmentNumber: 2, vessel: 'RCA', lesionOrder: 1,
      preStenosisPct: 80, postStenosisPct: 5,
      lesionLengthMm: 25, referenceVesselDiameterMm: 3.5,
      accAhaClass: 'B2', bifurcation: false, ostial: false,
      cto: false, inStentRestenosis: false,
      calcification: 'Moderate', thrombusGrade: 0, tortuosity: 'Moderate',
      culprit: true, treated: true,
      preTimiFlow: 3, postTimiFlow: 3, deviceIds: ['dev2b'],
    }],
    devices: [{
      id: 'dev2b', targetSegment: 2, type: 'DES',
      make: 'Meril Life Sciences', model: 'BioMime Morph',
      diameterMm: 3.5, lengthMm: 32,
      deploymentPressureAtm: 12, postDilatation: true,
      postDilatationPressureAtm: 18,
    }],
    thrombectomyDone: false, atherectomyDone: false, ivlShockwaveDone: false,
    laserDone: false, guideExtensionUsed: false, mcsUsed: false, temporaryPacingDone: false,
    p2y12Agent: 'Ticagrelor', p2y12LoadingDoseGiven: false, gpIIbIIIaUsed: false,
    anticoagulant: 'Unfractionated Heparin',
    anticoagulantDose: 'UFH 70 U/kg', peakActSeconds: 258,
    contrastVolumeMl: 130, contrastAgent: 'Iso-osmolar (e.g. Visipaque)',
    fluoroscopyTimeMin: 12, dapGyCm2: 32, airKermaMGy: 540,
    noReflow: false, dissectionNhlbi: 'None', perforationEllis: 'None',
    sideBranchLoss: false, acuteStentThrombosis: false, complications: [],
    dischargeDate: '2026-09-26',
    dischargeDaptAgent: 'Aspirin + Ticagrelor', dischargeDaptDurationMonths: 12,
    dischargeStatinIntensity: 'High',
    dischargeBetaBlocker: true, dischargeAceiArb: true, dischargeOac: false,
    stagedPciPlanned: false, heartTeamReferral: false,
    appropriateUseCriteria: 'Appropriate',
    radialFirstAdherence: true, enteredBy: OP2_ID, dataLocked: true,
  }))
  console.log('   Procedure 2 ID:', proc2p2Id, '(Staged — RCA PCI)\n')

  // ──────────────────────────────────────────────────────────────────────────
  // PATIENT 3: Mohan Iyer — CCS, LM Bifurcation, DK-Crush, SYNTAX 28
  // ──────────────────────────────────────────────────────────────────────────
  console.log('▶  Patient 3: Mohan Iyer (67M) — CCS, LM Bifurcation, DK-Crush')
  const p3Id = await addPatient(clean({
    firstName: 'Mohan', lastName: 'Iyer',
    mrn: '7AFH-2026-0003',
    dob: '1959-11-03', sex: 'Male', age: 67,
    registryId: 'cathlab',
    siteId: 'KANPUR_APEX',
    hospitalName: 'Kanpur Cardiac Apex Hospital',
    addressState: 'Uttar Pradesh',
    addressDistrict: 'Kanpur Nagar',
    address: 'Civil Lines, Kanpur, UP',
    indianCitizen: true, studyConsented: true,
    consentStatus: 'Granted', status: 'Active',
    comorbidities: ['HTN', 'Hypertension', 'DM', 'Diabetes Mellitus', 'Dyslipidaemia'],
    comorbidPriorPCI: false, comorbidPriorCABG: false, comorbidCAD: true,
    comorbidDiabetes: true, comorbidHypertension: true,
    comorbidDyslipidemia: true, comorbidCKD: false,
    syntaxScore: 28,
    latestSyntaxScore: 28,
  }))
  console.log('   Patient ID:', p3Id)

  const proc1p3Id = await addProcedure(p3Id, clean({
    patientId: p3Id,
    siteId: SITE_ID, operatorId: OP1_ID, operatorName: OP1_NAME,
    procedureDateTime: dt('2026-09-01', '08:00'),
    seqForPatient: 1,
    admissionType: 'Elective', presentation: 'ChronicCoronarySyndrome',
    killipClass: 'I', priorPCI: false, priorCABG: false,
    cardiacArrestPreProcedure: false,
    transferredIn: false, thrombolysisGiven: false,
    arterialAccess: dt('2026-09-01', '07:55'),
    firstDevice:    dt('2026-09-01', '09:10'),
    accessSite: 'Radial Left', sheathSize: '7F',
    accessCrossover: false, closureDevice: 'Radial Band',
    ultrasoundGuidedAccess: true,
    dominance: 'Right', syntaxScore: 28,
    segmentStenosisMap: { 5: 70, 6: 60, 11: 75, 13: 80 },
    preTimiPerVessel: { lm: 3, lad: 3 }, rentropCollaterals: 'Grade 0',
    ivusOctDone: true,
    ivusOctFindings: 'IVUS: LM bifurcation — MLA 4.9 mm². Calcified plaques. Optimal expansion confirmed post-DK-Crush.',
    ffrIfrDone: true,
    ffrIfrValues: 'LM FFR 0.75; LAD iFR 0.71; LCx iFR 0.73',
    lesions: [
      {
        id: 'l3a', segmentNumber: 5, vessel: 'LM', lesionOrder: 1,
        preStenosisPct: 70, postStenosisPct: 5,
        lesionLengthMm: 10, referenceVesselDiameterMm: 4.5,
        accAhaClass: 'B2', bifurcation: true, medinaClass: '1,1,1',
        stentStrategy: 'DK-Crush', ostial: false,
        cto: false, inStentRestenosis: false,
        calcification: 'Moderate', thrombusGrade: 0, tortuosity: 'None',
        culprit: true, treated: true,
        preTimiFlow: 3, postTimiFlow: 3, deviceIds: ['dev3a', 'dev3b'],
      },
      {
        id: 'l3b', segmentNumber: 13, vessel: 'LCx', lesionOrder: 2,
        preStenosisPct: 80, postStenosisPct: 10,
        lesionLengthMm: 15, referenceVesselDiameterMm: 3.0,
        accAhaClass: 'B1', bifurcation: false, ostial: true,
        cto: false, inStentRestenosis: false,
        calcification: 'Mild', thrombusGrade: 0, tortuosity: 'None',
        culprit: false, treated: true,
        preTimiFlow: 3, postTimiFlow: 3, deviceIds: ['dev3c'],
      },
    ],
    devices: [
      { id: 'dev3a', targetSegment: 5, type: 'DES', make: 'Boston Scientific', model: 'Synergy', diameterMm: 4.0, lengthMm: 16, deploymentPressureAtm: 16, postDilatation: true, postDilatationPressureAtm: 22 },
      { id: 'dev3b', targetSegment: 6, type: 'DES', make: 'Boston Scientific', model: 'Synergy', diameterMm: 3.5, lengthMm: 24, deploymentPressureAtm: 14, postDilatation: true, postDilatationPressureAtm: 20 },
      { id: 'dev3c', targetSegment: 13, type: 'DES', make: 'Boston Scientific', model: 'Synergy', diameterMm: 3.0, lengthMm: 16, deploymentPressureAtm: 14, postDilatation: true, postDilatationPressureAtm: 18 },
    ],
    thrombectomyDone: false, atherectomyDone: true, atherectomyType: 'Rotational',
    ivlShockwaveDone: false, laserDone: false,
    guideExtensionUsed: true, mcsUsed: false, temporaryPacingDone: false,
    p2y12Agent: 'Prasugrel', p2y12LoadingDoseGiven: true,
    gpIIbIIIaUsed: true, gpIIbIIIaAgent: 'Tirofiban',
    anticoagulant: 'Bivalirudin',
    anticoagulantDose: 'Bivalirudin 0.75 mg/kg bolus + 1.75 mg/kg/h infusion',
    peakActSeconds: 310,
    contrastVolumeMl: 280, contrastAgent: 'Iso-osmolar (e.g. Visipaque)',
    fluoroscopyTimeMin: 42, dapGyCm2: 108, airKermaMGy: 1840,
    noReflow: false, dissectionNhlbi: 'None', perforationEllis: 'None',
    sideBranchLoss: false, acuteStentThrombosis: false, complications: [],
    dischargeDate: '2026-09-05',
    dischargeDaptAgent: 'Aspirin + Prasugrel', dischargeDaptDurationMonths: 12,
    dischargeStatinIntensity: 'High',
    dischargeBetaBlocker: true, dischargeAceiArb: true, dischargeOac: false,
    stagedPciPlanned: false, heartTeamReferral: true,
    heartTeamOutcome: 'Staged High-Risk PCI',
    appropriateUseCriteria: 'May Be Appropriate',
    radialFirstAdherence: true, enteredBy: OP1_ID, dataLocked: true,
  }))
  console.log('   Procedure 1 ID:', proc1p3Id, '(LM Bifurcation DK-Crush, SYNTAX 28)\n')

  // ──────────────────────────────────────────────────────────────────────────
  // PATIENT 4: Priya Nair — OHCA, Resuscitated, LAD CTO, IABP
  // ──────────────────────────────────────────────────────────────────────────
  console.log('▶  Patient 4: Priya Nair (45F) — OHCA, Resuscitated, LAD CTO')
  const p4Id = await addPatient(clean({
    firstName: 'Priya', lastName: 'Nair',
    mrn: '7AFH-2026-0004',
    dob: '1981-04-30', sex: 'Female', age: 45,
    registryId: 'cathlab',
    siteId: 'KANPUR_APEX',
    hospitalName: 'Kanpur Cardiac Apex Hospital',
    addressState: 'Uttar Pradesh',
    addressDistrict: 'Kanpur Nagar',
    address: 'Govind Nagar, Kanpur, UP',
    indianCitizen: true, studyConsented: true,
    consentStatus: 'Granted', status: 'Active',
    comorbidities: ['Dyslipidaemia'],
    comorbidPriorPCI: false, comorbidPriorCABG: false, comorbidCAD: true,
    comorbidDiabetes: false, comorbidHypertension: false,
    comorbidDyslipidemia: true, comorbidCKD: false,
  }))
  console.log('   Patient ID:', p4Id)

  const proc1p4Id = await addProcedure(p4Id, clean({
    patientId: p4Id,
    siteId: SITE_ID, operatorId: OP1_ID, operatorName: OP1_NAME,
    procedureDateTime: dt('2026-09-05', '03:15'),
    seqForPatient: 1,
    admissionType: 'Salvage', presentation: 'OHCA',
    killipClass: 'IV', priorPCI: false, priorCABG: false,
    cardiacArrestPreProcedure: true,
    symptomOnset:    dt('2026-09-05', '02:00'),
    firstMedicalContact: dt('2026-09-05', '02:10'),
    hospitalArrival: dt('2026-09-05', '02:55'),
    ecgTime:         dt('2026-09-05', '03:00'),
    labActivation:   dt('2026-09-05', '03:05'),
    arterialAccess:  dt('2026-09-05', '03:20'),
    firstDevice:     dt('2026-09-05', '04:12'),  // DTB = 77 min
    transferredIn: false, thrombolysisGiven: false,
    accessSite: 'Femoral Right', sheathSize: '7F',
    accessCrossover: true, crossoverReason: 'Support needed',
    crossoverSite: 'Femoral Right',
    closureDevice: 'AngioSeal', ultrasoundGuidedAccess: true,
    dominance: 'Right',
    segmentStenosisMap: { 6: 100, 7: 40, 2: 20 },
    preTimiPerVessel: { lad: 0, rca: 3 },
    rentropCollaterals: 'Grade 2',
    ivusOctDone: false, ffrIfrDone: false,
    lesions: [{
      id: 'l4a', segmentNumber: 6, vessel: 'LAD', lesionOrder: 1,
      preStenosisPct: 100, postStenosisPct: 0,
      lesionLengthMm: 30, referenceVesselDiameterMm: 3.0,
      accAhaClass: 'C', bifurcation: false, ostial: false,
      cto: true, jCtoScore: 3, inStentRestenosis: false,
      calcification: 'Severe', thrombusGrade: 3, tortuosity: 'Moderate',
      culprit: true, treated: true,
      preTimiFlow: 0, postTimiFlow: 2,
      deviceIds: ['dev4a', 'dev4b'],
    }],
    devices: [
      { id: 'dev4a', targetSegment: 6, type: 'DES', make: 'Medtronic', model: 'Resolute Onyx', diameterMm: 3.0, lengthMm: 34, deploymentPressureAtm: 12, postDilatation: true, postDilatationPressureAtm: 16 },
      { id: 'dev4b', targetSegment: 7, type: 'DES', make: 'Medtronic', model: 'Resolute Onyx', diameterMm: 2.75, lengthMm: 22, deploymentPressureAtm: 12, postDilatation: false },
    ],
    thrombectomyDone: true, thrombectomyType: 'Manual Aspiration',
    atherectomyDone: false, ivlShockwaveDone: true, ivlCycles: 80,
    laserDone: false, guideExtensionUsed: true,
    mcsUsed: true, mcsType: 'IABP', mcsTiming: 'Bailout',
    temporaryPacingDone: true,
    p2y12Agent: 'Ticagrelor', p2y12LoadingDoseGiven: true,
    gpIIbIIIaUsed: true, gpIIbIIIaAgent: 'Tirofiban',
    anticoagulant: 'Unfractionated Heparin',
    anticoagulantDose: 'UFH 100 U/kg IV bolus', peakActSeconds: 330,
    contrastVolumeMl: 240, contrastAgent: 'Low-osmolar (e.g. Omnipaque, Ultravist)',
    fluoroscopyTimeMin: 55, dapGyCm2: 140, airKermaMGy: 2400,
    noReflow: true, dissectionNhlbi: 'Type B', perforationEllis: 'None',
    sideBranchLoss: false, acuteStentThrombosis: false,
    complications: [{
      type: 'ventricular-arrhythmia',
      severity: 'Life-threatening',
      details: 'VF on table — DC cardioversion 200J × 2, ROSC maintained with IABP support',
      timing: 'Intra-procedural',
    }],
    dischargeDate: '2026-09-14',
    dischargeDaptAgent: 'Aspirin + Ticagrelor', dischargeDaptDurationMonths: 12,
    dischargeStatinIntensity: 'High',
    dischargeBetaBlocker: true, dischargeAceiArb: true, dischargeOac: false,
    stagedPciPlanned: false, heartTeamReferral: false,
    appropriateUseCriteria: 'Appropriate',
    radialFirstAdherence: false, enteredBy: OP1_ID, dataLocked: false,
  }))
  console.log('   Procedure 1 ID:', proc1p4Id, '(OHCA/CTO, IABP, IVL 80 cycles)\n')

  // ──────────────────────────────────────────────────────────────────────────
  // PATIENT 5: Vikram Desai — NSTEMI, Prior CABG, SVG-RCA, CIN complication
  // ──────────────────────────────────────────────────────────────────────────
  console.log('▶  Patient 5: Vikram Desai (72M) — NSTEMI, Prior CABG, SVG-RCA, CIN')
  const p5Id = await addPatient(clean({
    firstName: 'Vikram', lastName: 'Desai',
    mrn: '7AFH-2026-0005',
    dob: '1954-08-18', sex: 'Male', age: 72,
    registryId: 'cathlab',
    siteId: 'KANPUR_APEX',
    hospitalName: 'Kanpur Cardiac Apex Hospital',
    addressState: 'Uttar Pradesh',
    addressDistrict: 'Kanpur Nagar',
    address: 'Lajpat Nagar, Kanpur, UP',
    indianCitizen: true, studyConsented: true,
    consentStatus: 'Granted', status: 'Active',
    comorbidities: ['HTN', 'Hypertension', 'DM', 'Diabetes Mellitus', 'CKD', 'PriorCABG', 'Prior CABG'],
    comorbidPriorPCI: false, comorbidPriorCABG: true, comorbidCAD: true,
    comorbidDiabetes: true, comorbidHypertension: true,
    comorbidDyslipidemia: true, comorbidCKD: true,
  }))
  console.log('   Patient ID:', p5Id)

  const proc1p5Id = await addProcedure(p5Id, clean({
    patientId: p5Id,
    siteId: SITE_ID, operatorId: OP2_ID, operatorName: OP2_NAME,
    procedureDateTime: dt('2026-09-08', '10:00'),
    seqForPatient: 1,
    admissionType: 'Urgent', presentation: 'NSTEMI',
    killipClass: 'II', priorPCI: false, priorCABG: true,
    cardiacArrestPreProcedure: false,
    symptomOnset:    dt('2026-09-07', '20:00'),
    hospitalArrival: dt('2026-09-08', '08:30'),
    ecgTime:         dt('2026-09-08', '08:35'),
    labActivation:   dt('2026-09-08', '09:30'),
    arterialAccess:  dt('2026-09-08', '09:55'),
    firstDevice:     dt('2026-09-08', '10:48'),
    transferredIn: false, thrombolysisGiven: false,
    accessSite: 'Femoral Right', sheathSize: '7F',
    accessCrossover: false, closureDevice: 'AngioSeal',
    ultrasoundGuidedAccess: true,
    dominance: 'Right',
    segmentStenosisMap: { 2: 100, 3: 70 },
    preTimiPerVessel: { rca: 1 }, rentropCollaterals: 'Grade 1',
    ivusOctDone: false, ffrIfrDone: false,
    lesions: [{
      id: 'l5a', segmentNumber: 2, vessel: 'RCA', lesionOrder: 1,
      preStenosisPct: 100, postStenosisPct: 10,
      lesionLengthMm: 40, referenceVesselDiameterMm: 3.5,
      accAhaClass: 'C', bifurcation: false, ostial: false,
      cto: false, inStentRestenosis: false,
      calcification: 'Moderate', thrombusGrade: 3, tortuosity: 'Severe',
      culprit: true, treated: true,
      preTimiFlow: 1, postTimiFlow: 3, deviceIds: ['dev5a', 'dev5b'],
    }],
    devices: [
      { id: 'dev5a', targetSegment: 2, type: 'DES', make: 'Abbott', model: 'Xience Sierra', diameterMm: 3.5, lengthMm: 38, deploymentPressureAtm: 10, postDilatation: true, postDilatationPressureAtm: 14 },
      { id: 'dev5b', targetSegment: 2, type: 'DES', make: 'Abbott', model: 'Xience Sierra', diameterMm: 3.5, lengthMm: 20, deploymentPressureAtm: 10, postDilatation: false },
    ],
    thrombectomyDone: true, thrombectomyType: 'Manual Aspiration',
    atherectomyDone: false, ivlShockwaveDone: false,
    laserDone: false, guideExtensionUsed: false, mcsUsed: false, temporaryPacingDone: false,
    p2y12Agent: 'Clopidogrel', p2y12LoadingDoseGiven: true,
    gpIIbIIIaUsed: false,
    anticoagulant: 'Unfractionated Heparin',
    anticoagulantDose: 'UFH 60 U/kg (reduced — CKD)', peakActSeconds: 240,
    contrastVolumeMl: 160, contrastAgent: 'Iso-osmolar (e.g. Visipaque)',
    fluoroscopyTimeMin: 28, dapGyCm2: 72, airKermaMGy: 1240,
    noReflow: false, dissectionNhlbi: 'None', perforationEllis: 'None',
    sideBranchLoss: false, acuteStentThrombosis: false,
    complications: [{
      type: 'aki-kdigo',
      severity: 'Moderate',
      kdigoStage: 2,
      details: 'CIN: Cr rose 2.1→3.2 mg/dL at 48h (KDIGO Stage 2 AKI). Managed with IV hydration + NAC. No RRT needed. Resolved to Cr 2.3 at discharge.',
      timing: 'Post-procedural',
    }],
    dischargeDate: '2026-09-15',
    dischargeDaptAgent: 'Aspirin + Clopidogrel', dischargeDaptDurationMonths: 6,
    dischargeStatinIntensity: 'Moderate',
    dischargeBetaBlocker: true, dischargeAceiArb: false, dischargeOac: false,
    stagedPciPlanned: false, heartTeamReferral: false,
    appropriateUseCriteria: 'Appropriate',
    radialFirstAdherence: false, enteredBy: OP2_ID, dataLocked: false,
  }))
  console.log('   Procedure 1 ID:', proc1p5Id, '(SVG-RCA, CIN KDIGO-2)\n')

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('═'.repeat(60))
  console.log('✓  Seeded 5 patients with 6 procedures total.')
  console.log()
  console.log('  Patients: ', [p1Id, p2Id, p3Id, p4Id, p5Id].join(', '))
  console.log()
  console.log('  Visit /registry-home/cathlab or /procedures to verify.')
  console.log('═'.repeat(60))
}

seed().catch(err => {
  console.error('\n✗  Seeder failed:', err)
  process.exit(1)
})
