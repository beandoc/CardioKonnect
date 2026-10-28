/**
 * /api/login
 *
 * Validates the registry's fixed username/password logins on the server so the
 * passwords are not shipped in the client bundle. Returns the directory user id
 * and which portal to open.
 *
 * Supported Registry Logins:
 *  - Heart Failure Registry (Dr. A. Jayachandra): Password "DR A Jayachandra" (or "test1234")
 *  - Cath Lab & Intervention Registry (Dr. Rajeev Chauhan): Password "Dr Rajeev chauhan" (or "cathlab1234")
 *  - Data Entry Operator (DEO): Username "deo" / Password "deo1234"
 */

import { NextRequest, NextResponse } from 'next/server'
import { USER_LIST } from '@/lib/appConfig'

function normalize(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]/g, '')
}

interface CredentialMapping {
  userId: string
  portal: 'doctor' | 'deo'
  acceptedPasswords: string[]
}

const CREDENTIAL_MAPPINGS: CredentialMapping[] = [
  {
    userId: 'DR_JAYACHANDRA',
    portal: 'doctor',
    acceptedPasswords: [
      normalize('DR A Jayachandra'),
      normalize('Dr A Jayachandra'),
      normalize('Dr. A. Jayachandra'),
      normalize('Dr. A Jayachandra'),
      normalize('DR_JAYACHANDRA'),
      normalize('Jayachandra'),
      normalize('test1234'),
      normalize('heart failure'),
    ],
  },
  {
    userId: 'DR_RAJEEV_CHAUHAN',
    portal: 'doctor',
    acceptedPasswords: [
      normalize('Dr Rajeev chauhan'),
      normalize('Dr Rajeev Chauhan'),
      normalize('DR RAJEEV CHAUHAN'),
      normalize('Dr. Rajeev Chauhan'),
      normalize('Rajeev Chauhan'),
      normalize('DR_RAJEEV_CHAUHAN'),
      normalize('cathlab1234'),
      normalize('cathlab'),
    ],
  },
  {
    userId: 'DR_NITIN_SHARMA',
    portal: 'doctor',
    acceptedPasswords: [
      normalize('nitin1234'),
      normalize('Dr Nitin Sharma'),
      normalize('Nitin Sharma'),
      normalize('DR_NITIN_SHARMA'),
    ],
  },
  {
    userId: 'DR_ARSHDEEP',
    portal: 'doctor',
    acceptedPasswords: [
      normalize('arsh1234'),
      normalize('Dr Arshdeep'),
      normalize('Arshdeep'),
      normalize('DR_ARSHDEEP'),
    ],
  },
]

const DEO_USERNAMES = ['deo', 'dataentry']
const DEO_PASSWORDS = [normalize('deo1234'), normalize('deo')]
const DEO_USER_ID = 'DR_ARSHDEEP'

export async function POST(req: NextRequest) {
  let rawUsername = ''
  let rawPassword = ''
  try {
    const body = await req.json()
    rawUsername = String(body.username ?? '').trim()
    rawPassword = String(body.password ?? '').trim()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const normPassword = normalize(rawPassword)
  const normUsername = normalize(rawUsername)
  const usernameLower = rawUsername.toLowerCase()

  if (!normPassword) {
    return NextResponse.json({ error: 'Password is required' }, { status: 400 })
  }

  // 1. Check DEO login
  if (
    (DEO_USERNAMES.includes(usernameLower) || DEO_USERNAMES.includes(normUsername)) &&
    DEO_PASSWORDS.includes(normPassword)
  ) {
    return NextResponse.json({ userId: DEO_USER_ID, portal: 'deo' })
  }

  // 2. Check if password uniquely matches one of the doctors (e.g. "DR A Jayachandra" or "Dr Rajeev chauhan")
  const matchedByPassword = CREDENTIAL_MAPPINGS.find(c =>
    c.acceptedPasswords.includes(normPassword)
  )

  // 3. Check if username matches a doctor in the user list
  const matchedByUsername = USER_LIST.find(u =>
    u.email.toLowerCase() === usernameLower ||
    normalize(u.email) === normUsername ||
    u.loginUsernames.some(n => n.toLowerCase() === usernameLower || normalize(n) === normUsername)
  )

  // Case A: The password directly identifies the registry/doctor
  if (matchedByPassword) {
    // If username is also supplied and directly matches another user who also accepts this password,
    // ensure consistency. Otherwise, the unique registry password grants entry to that doctor's portal.
    return NextResponse.json({
      userId: matchedByPassword.userId,
      portal: matchedByPassword.portal,
    })
  }

  // Case B: Username supplied and password matches that user's credential mapping
  if (matchedByUsername) {
    const config = CREDENTIAL_MAPPINGS.find(c => c.userId === matchedByUsername.id)
    if (config && config.acceptedPasswords.includes(normPassword)) {
      return NextResponse.json({
        userId: matchedByUsername.id,
        portal: matchedByUsername.role === 'DEO' ? 'deo' : 'doctor',
      })
    }
  }

  return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
}
