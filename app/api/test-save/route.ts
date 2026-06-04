import { NextResponse } from 'next/server'
import { addPatient, getPatient, addVisit, getVisits, deletePatient } from '@/lib/firestore'
import type { PatientInput, VisitInput } from '@/lib/types'
import fs from 'fs'
import path from 'path'

// Async test runner function that runs in the background
async function executeTest() {
  const logs: string[] = []
  let testPatientId: string | null = null
  let success = false
  let errorMsg = null

  try {
    logs.push('Starting Firebase backend save verification test in background...')

    // 1. Define test patient input using updated schema (comorbidities array, indexDate)
    const patientInput: PatientInput = {
      firstName: 'BgFirebaseSave',
      lastName: 'VerificationTest',
      dob: '1985-08-15',
      sex: 'Male',
      mrn: 'BG-TEST-' + Math.random().toString(36).substring(2, 7).toUpperCase(),
      contact: '+91 9999999999',
      address: 'Test Environment, Pune, Maharashtra',
      comorbidities: ['HTN', 'DM2', 'CKD'],
      allergies: 'None',
      status: 'Active',
      email: 'verification.test@cardiokonnect.org',
      indexDate: '2026-01-10',
    }

    // 2. Add patient
    logs.push(`Attempting to add patient: ${patientInput.firstName} ${patientInput.lastName}`)
    testPatientId = await addPatient(patientInput)
    logs.push(`Patient created successfully with Firestore ID: ${testPatientId}`)

    // 3. Add visit for this patient with medication dosage & tracking details
    const visitInput: VisitInput = {
      visitDate: '2026-06-04',
      clinicalNotes: 'Background encounter verification test of GDMT dosing/tracking logic and Firestore save.',
      nyha: 'III',
      hfType: 'HFrEF',
      lvef: 32,
      sbp: 118,
      dbp: 76,
      hr: 72,
      temp: 98.4,
      respRate: 16,
      weight: 68.5,
      height: 170,
      bmi: 23.7,
      jugularVenousPressure: 'Normal',
      creatinine: 1.1,
      sodium: 139,
      potassium: 4.2,
      ntProBnp: 1450,
      bnp: null,
      hb: 13.8,
      hba1c: 6.8,
      egfr: 75,
      raasi: {
        prescribed: 'Yes',
        type: 'ARNI',
        dose: 'Sacubitril/Valsartan 49/51mg BID',
        startDate: '2026-02-15',
        stopDate: '',
        changeReason: 'Initiated GDMT titration'
      },
      betaBlocker: {
        prescribed: 'Yes',
        type: 'Carvedilol',
        dose: '6.25mg BID',
        startDate: '2026-01-20',
        stopDate: '',
        changeReason: 'Stable maintenance dose'
      },
      mra: {
        prescribed: 'No',
        reason: 'Hyperkalemia history',
      },
      sglt2i: {
        prescribed: 'Yes',
        type: 'Dapagliflozin',
        dose: '10mg QD',
        startDate: '2026-03-01',
        stopDate: '',
        changeReason: 'Added for HFrEF pillar management'
      },
    }

    logs.push('Attempting to add visit to patient...')
    const visitId = await addVisit(testPatientId, visitInput)
    logs.push(`Visit created successfully with ID: ${visitId}`)

    // 4. Retrieve patient back and check properties
    logs.push('Retrieving patient document back from Firestore to verify schema integration and caching...')
    const retrievedPatient = await getPatient(testPatientId)
    if (!retrievedPatient) {
      throw new Error('Failed to retrieve patient from Firestore.')
    }

    logs.push(`Verified Patient ID matches: ${retrievedPatient.id === testPatientId}`)
    logs.push(`Verified Comorbidities stored as array: ${Array.isArray(retrievedPatient.comorbidities)} -> [${retrievedPatient.comorbidities.join(', ')}]`)
    logs.push(`Verified Patient indexDate: ${retrievedPatient.indexDate}`)
    logs.push(`Verified Cached NYHA: ${retrievedPatient.nyha}`)
    logs.push(`Verified Cached HF Type: ${retrievedPatient.hfType}`)
    logs.push(`Verified Cached LVEF: ${retrievedPatient.lvef}%`)

    // Assert cache check
    if (retrievedPatient.nyha !== 'III' || retrievedPatient.hfType !== 'HFrEF' || retrievedPatient.lvef !== 32) {
      throw new Error(`Cached values mismatch! Expected NYHA: III, hfType: HFrEF, lvef: 32. Got NYHA: ${retrievedPatient.nyha}, hfType: ${retrievedPatient.hfType}, lvef: ${retrievedPatient.lvef}`)
    }

    // 5. Retrieve visits back and verify medication tracking
    logs.push('Retrieving visits list from Firestore to verify subcollection mapping and meds tracking...')
    const visitsList = await getVisits(testPatientId)
    if (visitsList.length !== 1) {
      throw new Error(`Expected 1 visit, found: ${visitsList.length}`)
    }

    const savedVisit = visitsList[0]
    logs.push(`Verified Visit ID: ${savedVisit.id}`)
    logs.push(`Verified RAASi prescribed: ${savedVisit.raasi.prescribed}, type: ${savedVisit.raasi.type}, dose: ${savedVisit.raasi.dose}, startDate: ${savedVisit.raasi.startDate}`)
    logs.push(`Verified Beta Blocker prescribed: ${savedVisit.betaBlocker.prescribed}, type: ${savedVisit.betaBlocker.type}, dose: ${savedVisit.betaBlocker.dose}`)

    // 6. Delete test patient (which deletes visits subcollection in firestore too)
    logs.push('Cleaning up: Attempting to delete test patient document and cascade delete visits...')
    await deletePatient(testPatientId)
    logs.push('Cleanup complete.')
    success = true

  } catch (error: any) {
    errorMsg = error.message || error
    logs.push(`TEST FAILED with error: ${errorMsg}`)
    
    // Attempt cleanup if patient was created
    if (testPatientId) {
      try {
        logs.push('Attempting emergency cleanup for test patient...')
        await deletePatient(testPatientId)
        logs.push('Emergency cleanup complete.')
      } catch (cleanError) {
        logs.push(`Emergency cleanup failed: ${cleanError}`)
      }
    }
  } finally {
    // Write results to a local file in the workspace
    try {
      const resultsDir = path.resolve(process.cwd(), 'scratch')
      if (!fs.existsSync(resultsDir)) {
        fs.mkdirSync(resultsDir, { recursive: true })
      }
      fs.writeFileSync(
        path.join(resultsDir, 'test-results.json'),
        JSON.stringify({ success, logs, error: errorMsg, timestamp: new Date().toISOString() }, null, 2),
        'utf8'
      )
      console.log('Background test results written to scratch/test-results.json')
    } catch (fsError) {
      console.error('Failed to write background test results file:', fsError)
    }
  }
}

export async function GET() {
  // Trigger the test in the background without blocking or awaiting it
  executeTest().catch((err) => {
    console.error('Background test execution failed:', err)
  })

  return NextResponse.json({
    success: true,
    message: 'Test started in the background. Check scratch/test-results.json in 30-40 seconds for completion details.'
  })
}
