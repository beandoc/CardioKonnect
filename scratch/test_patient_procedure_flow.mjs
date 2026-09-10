import { addPatient, getPatient, addProcedure, getProcedures } from '../lib/firestore.js'
import {
  calculateDoorToBalloonMin,
  calculateAngiographicSuccess,
  calculateProceduralSuccess
} from '../lib/interventionalMetrics.js'
import { calculateContrastNephropathyRisk } from '../lib/riskScores.js'

console.log('=== TEST: Patient Enrolment & Cath Lab Procedure Unit-of-Analysis ===')

async function runTest() {
  // Step 1: Enrol a patient via /patients/new?registry=cathlab ticking "Prior PCI"
  console.log('\n--- Step 1: Patient Enrolment with Prior PCI ---')
  const formComorbidities = ['PriorPCI'] // Value from CheckChipGroup in PatientForm
  const isPriorPCI = formComorbidities.includes('PriorPCI') || formComorbidities.includes('Prior PCI')
  const isCAD = isPriorPCI || formComorbidities.includes('CAD')

  const patientPayload = {
    firstName: 'Ramesh',
    lastName: 'Kulkarni',
    dob: '1964-05-12',
    sex: 'Male',
    age: 62,
    registryId: 'cathlab',
    comorbidities: ['PriorPCI', 'Prior PCI', 'CAD'],
    comorbidPriorPCI: isPriorPCI,
    comorbidCAD: isCAD,
    comorbidDiabetes: false,
    comorbidHypertension: true,
    status: 'Active',
    consentStatus: 'Granted',
    studyConsented: true,
    indianCitizen: true,
  }

  const patientId = await addPatient(patientPayload)
  console.log('Patient enrolled with ID:', patientId)

  const retrievedPatient = await getPatient(patientId)
  console.log('retrievedPatient.comorbidPriorPCI:', retrievedPatient?.comorbidPriorPCI)
  console.log('retrievedPatient.comorbidCAD:', retrievedPatient?.comorbidCAD)

  if (retrievedPatient?.comorbidPriorPCI === true) {
    console.log('✓ PASS: comorbidPriorPCI === true confirmed in database (Phase 0 bug fixed).')
  } else {
    console.error('✗ FAIL: comorbidPriorPCI is not true!')
    process.exit(1)
  }

  // Step 2: Enter full procedure (62-year-old, anterior STEMI, radial, LAD seg 6 culprit, 3.0x28 DES, TIMI 3 post, 180mL contrast)
  console.log('\n--- Step 2: Enter Full STEMI PCI Procedure ---')
  const procedure1Payload = {
    patientId,
    siteId: 'AICTS_PUNE',
    operatorId: 'OP_01',
    operatorName: 'Dr. A. Sharma',
    procedureDateTime: '2026-09-10T08:00',
    admissionType: 'Emergency',
    presentation: 'STEMI',
    killipClass: 'I',
    priorPCI: retrievedPatient.comorbidPriorPCI,
    priorCABG: false,
    symptomOnset: '2026-09-10T06:30',
    hospitalArrival: '2026-09-10T08:00',
    firstDevice: '2026-09-10T09:05', // DTB = 65 minutes
    accessSite: 'Radial Right',
    sheathSize: '6F',
    closureDevice: 'Radial Band',
    contrastVolumeMl: 180,
    fluoroscopyTimeMin: 12,
    noReflow: false,
    lesions: [
      {
        id: 'lesion-1',
        segmentNumber: 6, // LAD Proximal
        vessel: 'LAD',
        lesionOrder: 1,
        preStenosisPct: 100,
        postStenosisPct: 0,
        lesionLengthMm: 28,
        referenceVesselDiameterMm: 3.0,
        culprit: true,
        treated: true,
        preTimiFlow: 0,
        postTimiFlow: 3,
        devices: [
          {
            id: 'dev-1',
            targetSegment: 6,
            type: 'DES',
            make: 'Abbott',
            model: 'Xience Sierra',
            diameterMm: 3.0,
            lengthMm: 28,
            deploymentPressureAtm: 16,
            postDilatation: true
          }
        ]
      }
    ],
    complications: []
  }

  const proc1Id = await addProcedure(patientId, procedure1Payload)
  console.log('Procedure 1 saved with ID:', proc1Id)

  const patientProcedures = await getProcedures(patientId)
  console.log(`Patient now has ${patientProcedures.length} procedure(s)`)

  const savedProc1 = patientProcedures.find(p => p.id === proc1Id)

  // Validate derived calculations
  const dtb = calculateDoorToBalloonMin(savedProc1)
  console.log('Derived Door-to-Balloon Minutes:', dtb)
  if (dtb === 65) {
    console.log('✓ PASS: Derived DTB correctly computed as 65 minutes (≤90m target met).')
  } else {
    console.error(`✗ FAIL: DTB calculation mismatch, got ${dtb}`)
    process.exit(1)
  }

  const angioSuccess = calculateAngiographicSuccess(savedProc1)
  console.log('Derived Angiographic Success:', angioSuccess)
  if (angioSuccess === true) {
    console.log('✓ PASS: Angiographic success confirmed (TIMI 3, residual stenosis 0%).')
  } else {
    console.error('✗ FAIL: Angiographic success should be true')
    process.exit(1)
  }

  const procSuccess = calculateProceduralSuccess(savedProc1)
  console.log('Derived Procedural Success:', procSuccess)
  if (procSuccess === true) {
    console.log('✓ PASS: Procedural success confirmed (Angiographic success without in-hospital MACE).')
  } else {
    console.error('✗ FAIL: Procedural success should be true')
    process.exit(1)
  }

  // Calculate Mehran CIN on read
  const mehran = calculateContrastNephropathyRisk({
    age: retrievedPatient.age || 62,
    diabetes: retrievedPatient.comorbidDiabetes || false,
    hypotension: false,
    heartFailure: false,
    creatinine: 1.0,
    eGFR: 85,
    iabpUse: false,
    anemia: false,
    contrastVolumeMl: savedProc1.contrastVolumeMl || 180
  })
  console.log('Mehran CIN Score:', mehran.mehranScore, `(${mehran.riskCategory} risk)`)
  if (mehran.mehranScore === 1 && mehran.riskCategory === 'Low') {
    console.log('✓ PASS: Mehran CIN on read accurately scored (1 pt for 180mL contrast, Low risk).')
  } else {
    console.error('✗ FAIL: Mehran calculation error')
    process.exit(1)
  }

  // Step 3: Enter a second procedure for the same patient (Staged PCI)
  console.log('\n--- Step 3: Enter Second Procedure for Same Patient (Unit-of-Analysis Test) ---')
  const procedure2Payload = {
    patientId,
    siteId: 'AICTS_PUNE',
    operatorId: 'OP_01',
    operatorName: 'Dr. A. Sharma',
    procedureDateTime: '2026-09-24T11:00',
    admissionType: 'Elective',
    presentation: 'ChronicCoronarySyndrome',
    accessSite: 'Radial Right',
    contrastVolumeMl: 90,
    lesions: [
      {
        id: 'lesion-2',
        segmentNumber: 1, // RCA Proximal
        vessel: 'RCA',
        preStenosisPct: 85,
        postStenosisPct: 0,
        treated: true,
        preTimiFlow: 3,
        postTimiFlow: 3
      }
    ]
  }

  const proc2Id = await addProcedure(patientId, procedure2Payload)
  console.log('Procedure 2 saved with ID:', proc2Id)

  const updatedProcedures = await getProcedures(patientId)
  console.log(`Updated procedure count for patient ${patientId}: ${updatedProcedures.length}`)

  // Verify Unit-of-Analysis: Two procedures, one patient
  const uniquePatientCount = new Set(updatedProcedures.map(p => p.patientId)).size
  console.log(`Registry counts: ${updatedProcedures.length} procedures across ${uniquePatientCount} patient(s)`)

  if (updatedProcedures.length === 2 && uniquePatientCount === 1) {
    console.log('✓ PASS: Unit-of-analysis fix confirmed! 2 procedures properly nested under 1 patient.')
  } else {
    console.error('✗ FAIL: Unit-of-analysis check failed!')
    process.exit(1)
  }

  console.log('\nAll end-to-end patient and procedural tests PASSED successfully.')
}

runTest().catch(err => {
  console.error('Test execution error:', err)
  process.exit(1)
})
