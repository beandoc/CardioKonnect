/**
 * /api/login
 *
 * Validates the registry's fixed username/password logins on the server so the
 * passwords are not shipped in the client bundle. Returns the directory user id
 * and which portal to open.
 */

import { NextRequest, NextResponse } from 'next/server'
import { USER_LIST } from '@/lib/appConfig'

const PASSWORDS: Record<string, string> = {
  DR_JAYACHANDRA: 'test1234',
  DR_RAJEEV_CHAUHAN: 'cathlab1234',
  DR_NITIN_SHARMA: 'nitin1234',
  DR_ARSHDEEP: 'arsh1234',
}

const DEO_USERNAMES = ['deo', 'dataentry']
const DEO_PASSWORD = 'deo1234'
const DEO_USER_ID = 'DR_ARSHDEEP'

export async function POST(req: NextRequest) {
  let username = ''
  let password = ''
  try {
    const body = await req.json()
    username = String(body.username ?? '').trim().toLowerCase()
    password = String(body.password ?? '').trim()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  if (DEO_USERNAMES.includes(username) && password === DEO_PASSWORD) {
    return NextResponse.json({ userId: DEO_USER_ID, portal: 'deo' })
  }

  // 1. Username (alias or email) + password
  const byName = USER_LIST.find(u =>
    u.email.toLowerCase() === username || u.loginUsernames.some(n => n.toLowerCase() === username)
  )
  if (byName && PASSWORDS[byName.id] === password) {
    return NextResponse.json({ userId: byName.id, portal: byName.role === 'DEO' ? 'deo' : 'doctor' })
  }

  // 2. Password that belongs to exactly one user (previous login behaviour)
  const byPassword = USER_LIST.find(u => PASSWORDS[u.id] === password)
  if (byPassword) {
    return NextResponse.json({ userId: byPassword.id, portal: byPassword.role === 'DEO' ? 'deo' : 'doctor' })
  }

  return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
}
