import fs from 'fs'
import path from 'path'

// 1. Manually load environment variables from .env.local
const envPath = path.resolve(process.cwd(), '.env.local')
console.log('Loading environment variables from:', envPath)
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
}

// 3. Run the seeder
async function run() {
  console.log('Starting Firestore seeding...')
  console.log('Project ID:', process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID)
  console.log('API Key configured:', !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY)
  
  try {
    const { seedRealPatientsFromExcel } = await import('../lib/excelSeeder')
    await seedRealPatientsFromExcel()
    console.log('Successfully seeded database with clinical records from Excel!')
    process.exit(0)
  } catch (error) {
    console.error('Failed to seed database:', error)
    process.exit(1)
  }
}

run()

