import { NextResponse } from 'next/server'
import { seedRealPatientsFromExcel } from '@/lib/excelSeeder'

export async function GET() {
  console.log('API seed endpoint triggered...')
  try {
    const result = await seedRealPatientsFromExcel()
    return NextResponse.json({
      success: true,
      message: `Database seeded successfully with ${result.patientsCount} real patient registry records!`,
      ...result
    })
  } catch (error: any) {
    console.error('Seeding error via API:', error)
    return NextResponse.json({
      success: false,
      error: error.message || String(error)
    }, { status: 500 })
  }
}
