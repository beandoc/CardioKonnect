import { NextResponse } from 'next/server'
import { seedDemoData } from '@/lib/seeder'

export async function GET() {
  console.log('API seed endpoint triggered...')
  try {
    await seedDemoData()
    return NextResponse.json({
      success: true,
      message: 'Database seeded successfully with 150 patients!'
    })
  } catch (error: any) {
    console.error('Seeding error via API:', error)
    return NextResponse.json({
      success: false,
      error: error.message || String(error)
    }, { status: 500 })
  }
}
