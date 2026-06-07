import fs from 'fs';
import path from 'path';

// 1. Manually load environment variables from .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
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
      process.env[key] = val;
    }
  });
  console.log('Successfully loaded environment variables from .env.local');
} else {
  console.warn('.env.local file not found.');
}

import { getPatients, deletePatient } from '../lib/firestore';

async function runCleanup() {
  console.log('Fetching patients from Firestore...');
  const patients = await getPatients();
  console.log(`Found ${patients.length} total patients.`);

  let deleteCount = 0;
  for (const patient of patients) {
    if (
      patient.firstName === 'BgFirebaseSave' || 
      patient.lastName === 'VerificationTest' || 
      patient.email === 'verification.test@cardiokonnect.org'
    ) {
      console.log(`Deleting patient: ${patient.firstName} ${patient.lastName} (ID: ${patient.id}, Email: ${patient.email})`);
      await deletePatient(patient.id);
      deleteCount++;
    }
  }

  console.log(`Successfully deleted ${deleteCount} verification test patients.`);
  process.exit(0);
}

runCleanup().catch((err) => {
  console.error('Error running cleanup:', err);
  process.exit(1);
});
