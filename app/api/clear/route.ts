import { NextResponse } from 'next/server'

export async function GET() {
  console.log('[API /clear] Clear endpoint triggered — server clears nothing (no auth). Client handles localStorage.')
  return NextResponse.json({
    success: true,
    message: 'Clear signal received. Client will clear its local data.'
  })
}
