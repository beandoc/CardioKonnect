import fs from 'fs';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const parts = trimmed.split('=');
    if (parts.length >= 2) {
      process.env[parts[0].trim()] = parts.slice(1).join('=').trim();
    }
  });
}

import { db } from '../lib/firebase';
import { collection, getDocs } from 'firebase/firestore';

async function listAll() {
  console.log('Firebase config loaded. API Key:', process.env.NEXT_PUBLIC_FIREBASE_API_KEY);
  const snap = await getDocs(collection(db, 'patients'));
  console.log(`Number of patient documents: ${snap.size}`);
  snap.docs.forEach((doc) => {
    console.log(`ID: ${doc.id}, Data:`, doc.data());
  });
}

listAll().catch(console.error);
