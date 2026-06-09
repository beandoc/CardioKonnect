import { NextResponse } from 'next/server'

// This server-side route previously read from a local file path that only
// exists on the developer's machine. It is no longer used — seeding now
// happens client-side via the /seed page (Excel upload → Firestore writes).
export async function GET() {
  return NextResponse.json(
    {
      success: false,
      error:
        'Server-side file seeding is not supported on Vercel. ' +
        'Use the /seed page to upload your HF.xlsx file directly — ' +
        'it writes to Firestore and works on any device.',
    },
    { status: 410 }
  )
}
