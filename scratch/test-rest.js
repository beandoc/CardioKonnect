import fs from 'fs';
import path from 'path';

// 1. Manually load environment variables from .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
let apiKey = '';
let projectId = '';

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const parts = trimmed.split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      let val = parts.slice(1).join('=').trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (key === 'NEXT_PUBLIC_FIREBASE_API_KEY') apiKey = val;
      if (key === 'NEXT_PUBLIC_FIREBASE_PROJECT_ID') projectId = val;
    }
  });
  console.log('Successfully loaded environment variables from .env.local');
} else {
  console.error('Error: .env.local file not found.');
  process.exit(1);
}

if (!apiKey || !projectId) {
  console.error('Error: Missing API Key or Project ID in .env.local');
  process.exit(1);
}

const baseUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;

async function runRestTest() {
  console.log(`Starting Firestore REST API verification test for project: ${projectId}...\n`);
  let docName = '';

  try {
    // 1. Define Patient document in Firestore REST format
    // See https://firebase.google.com/docs/firestore/reference/rest/v1/projects.databases.documents
    const testMrn = 'REST-TEST-' + Math.random().toString(36).substring(2, 7).toUpperCase();
    const patientData = {
      fields: {
        firstName: { stringValue: 'REST' },
        lastName: { stringValue: 'Verification' },
        dob: { stringValue: '1980-05-15' },
        sex: { stringValue: 'Female' },
        mrn: { stringValue: testMrn },
        contact: { stringValue: '+91 9555555555' },
        address: { stringValue: 'REST Verification Context, Pune' },
        comorbidities: {
          arrayValue: {
            values: [
              { stringValue: 'HTN' },
              { stringValue: 'CAD' }
            ]
          }
        },
        allergies: { stringValue: 'None' },
        status: { stringValue: 'Active' },
        email: { stringValue: 'rest.verify@cardiokonnect.org' },
        indexDate: { stringValue: '2026-04-01' },
        visitCount: { integerValue: '0' },
        createdAt: { stringValue: new Date().toISOString() },
        updatedAt: { stringValue: new Date().toISOString() }
      }
    };

    // 2. Add Patient Document
    console.log('[+] Sending POST request to create patient document...');
    const createRes = await fetch(`${baseUrl}/patients?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patientData)
    });

    if (!createRes.ok) {
      const errText = await createRes.text();
      throw new Error(`Failed to create patient: ${createRes.status} ${createRes.statusText}\n${errText}`);
    }

    const createdDoc = await createRes.json();
    docName = createdDoc.name; // Full resource path: projects/{project}/databases/{database}/documents/patients/{id}
    const docId = docName.split('/').pop();
    console.log(`    - Created Patient Doc Name: ${docName}`);
    console.log(`    - Created Patient ID: ${docId}`);

    // 3. Add Visit Document under Patient's visits subcollection
    const visitData = {
      fields: {
        visitDate: { stringValue: '2026-06-04' },
        clinicalNotes: { stringValue: 'REST API verification test visit.' },
        nyha: { stringValue: 'II' },
        hfType: { stringValue: 'HFmrEF' },
        lvef: { integerValue: '45' },
        sbp: { integerValue: '120' },
        dbp: { integerValue: '80' },
        hr: { integerValue: '70' },
        temp: { doubleValue: 98.6 },
        weight: { doubleValue: 65.2 },
        height: { integerValue: 168 },
        raasi: {
          mapValue: {
            fields: {
              prescribed: { stringValue: 'Yes' },
              type: { stringValue: 'ACEi' },
              dose: { stringValue: 'Enalapril 5mg BID' },
              startDate: { stringValue: '2026-05-01' }
            }
          }
        },
        betaBlocker: {
          mapValue: {
            fields: {
              prescribed: { stringValue: 'No' },
              reason: { stringValue: 'Bradycardia' }
            }
          }
        },
        mra: {
          mapValue: {
            fields: {
              prescribed: { stringValue: 'Yes' },
              type: { stringValue: 'Spironolactone' },
              dose: { stringValue: '25mg QD' },
              startDate: { stringValue: '2026-05-15' }
            }
          }
        },
        sglt2i: {
          mapValue: {
            fields: {
              prescribed: { stringValue: 'No' },
              reason: { stringValue: 'Not started' }
            }
          }
        },
        createdAt: { stringValue: new Date().toISOString() }
      }
    };

    console.log('[+] Sending POST request to create visit document...');
    const visitRes = await fetch(`${baseUrl}/patients/${docId}/visits?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(visitData)
    });

    if (!visitRes.ok) {
      const errText = await visitRes.text();
      throw new Error(`Failed to create visit: ${visitRes.status} ${visitRes.statusText}\n${errText}`);
    }

    const createdVisit = await visitRes.json();
    const visitName = createdVisit.name;
    const visitId = visitName.split('/').pop();
    console.log(`    - Created Visit Doc Name: ${visitName}`);
    console.log(`    - Created Visit ID: ${visitId}`);

    // 4. Retrieve and verify Patient Document
    console.log('[+] Sending GET request to retrieve patient document...');
    const getPatientRes = await fetch(`https://firestore.googleapis.com/v1/${docName}?key=${apiKey}`);
    if (!getPatientRes.ok) {
      throw new Error(`Failed to get patient: ${getPatientRes.status} ${getPatientRes.statusText}`);
    }
    const retrievedPatient = await getPatientRes.json();
    const fields = retrievedPatient.fields;

    console.log('    - MRN matches:', fields.mrn.stringValue === testMrn ? 'PASS' : 'FAIL');
    console.log('    - Index Date matches:', fields.indexDate.stringValue === '2026-04-01' ? 'PASS' : 'FAIL');
    
    const comorbidities = fields.comorbidities.arrayValue.values.map(v => v.stringValue);
    console.log('    - Comorbidities array contains HTN & CAD:', (comorbidities.includes('HTN') && comorbidities.includes('CAD')) ? 'PASS' : 'FAIL');

    if (
      fields.mrn.stringValue !== testMrn ||
      fields.indexDate.stringValue !== '2026-04-01' ||
      !comorbidities.includes('HTN') ||
      !comorbidities.includes('CAD')
    ) {
      throw new Error('Retrieved patient validation failed.');
    }

    // 5. Retrieve and verify Visit Document
    console.log('[+] Sending GET request to retrieve visit document...');
    const getVisitRes = await fetch(`https://firestore.googleapis.com/v1/${visitName}?key=${apiKey}`);
    if (!getVisitRes.ok) {
      throw new Error(`Failed to get visit: ${getVisitRes.status} ${getVisitRes.statusText}`);
    }
    const retrievedVisit = await getVisitRes.json();
    const visitFields = retrievedVisit.fields;

    console.log('    - Visit Date matches:', visitFields.visitDate.stringValue === '2026-06-04' ? 'PASS' : 'FAIL');
    console.log('    - RAASi type matches:', visitFields.raasi.mapValue.fields.type.stringValue === 'ACEi' ? 'PASS' : 'FAIL');
    console.log('    - MRA dose matches:', visitFields.mra.mapValue.fields.dose.stringValue === '25mg QD' ? 'PASS' : 'FAIL');

    if (
      visitFields.visitDate.stringValue !== '2026-06-04' ||
      visitFields.raasi.mapValue.fields.type.stringValue !== 'ACEi' ||
      visitFields.mra.mapValue.fields.dose.stringValue !== '25mg QD'
    ) {
      throw new Error('Retrieved visit validation failed.');
    }

    // 6. Delete test documents (Clean up)
    console.log('[+] Sending DELETE request to remove visit document...');
    const delVisitRes = await fetch(`https://firestore.googleapis.com/v1/${visitName}?key=${apiKey}`, { method: 'DELETE' });
    console.log(`    - Visit deleted (Status ${delVisitRes.status})`);

    console.log('[+] Sending DELETE request to remove patient document...');
    const delPatientRes = await fetch(`https://firestore.googleapis.com/v1/${docName}?key=${apiKey}`, { method: 'DELETE' });
    console.log(`    - Patient deleted (Status ${delPatientRes.status})`);

    console.log('\n>>> SUCCESS: ALL BACKEND FIREBASE SAVE AND RETRIEVAL TESTS COMPLETED SUCCESSFULLY! <<<');
    process.exit(0);

  } catch (error) {
    console.error('\n>>> REST TEST SUITE FAILURE: <<<');
    console.error(error.message || error);

    if (docName) {
      try {
        console.log('Attempting emergency REST cleanup...');
        await fetch(`https://firestore.googleapis.com/v1/${docName}?key=${apiKey}`, { method: 'DELETE' });
        console.log('Emergency cleanup successful.');
      } catch (err) {
        console.error('Emergency cleanup failed:', err);
      }
    }
    process.exit(1);
  }
}

runRestTest();
