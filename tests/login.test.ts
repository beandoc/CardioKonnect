import { describe, it, expect } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from '../app/api/login/route'

async function callLogin(body: { username?: string; password?: string }) {
  const req = new NextRequest('http://localhost:3000/api/login', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
  const res = await POST(req)
  const data = await res.json()
  return { status: res.status, data }
}

describe('POST /api/login', () => {
  describe('Heart Failure Registry - Dr. A. Jayachandra', () => {
    it('authenticates with password "DR A Jayachandra"', async () => {
      const res = await callLogin({ username: 'cardiokonnect', password: 'DR A Jayachandra' })
      expect(res.status).toBe(200)
      expect(res.data.userId).toBe('DR_JAYACHANDRA')
      expect(res.data.portal).toBe('doctor')
    })

    it('authenticates with case-insensitive password "dr a jayachandra"', async () => {
      const res = await callLogin({ username: 'cardiokonnect', password: 'dr a jayachandra' })
      expect(res.status).toBe(200)
      expect(res.data.userId).toBe('DR_JAYACHANDRA')
    })

    it('authenticates with legacy password "test1234"', async () => {
      const res = await callLogin({ username: 'cardiokonnect', password: 'test1234' })
      expect(res.status).toBe(200)
      expect(res.data.userId).toBe('DR_JAYACHANDRA')
    })

    it('authenticates using Dr. Jayachandra password even when username is omitted', async () => {
      const res = await callLogin({ password: 'DR A Jayachandra' })
      expect(res.status).toBe(200)
      expect(res.data.userId).toBe('DR_JAYACHANDRA')
    })
  })

  describe('Cath Lab & Intervention Registry - Dr. Rajeev Chauhan', () => {
    it('authenticates with password "Dr Rajeev chauhan"', async () => {
      const res = await callLogin({ username: 'cathlab', password: 'Dr Rajeev chauhan' })
      expect(res.status).toBe(200)
      expect(res.data.userId).toBe('DR_RAJEEV_CHAUHAN')
      expect(res.data.portal).toBe('doctor')
    })

    it('authenticates with case-insensitive password "dr rajeev chauhan"', async () => {
      const res = await callLogin({ username: 'dr.rajeev', password: 'dr rajeev chauhan' })
      expect(res.status).toBe(200)
      expect(res.data.userId).toBe('DR_RAJEEV_CHAUHAN')
    })

    it('authenticates with legacy password "cathlab1234"', async () => {
      const res = await callLogin({ username: 'cathlab', password: 'cathlab1234' })
      expect(res.status).toBe(200)
      expect(res.data.userId).toBe('DR_RAJEEV_CHAUHAN')
    })

    it('authenticates using Dr. Rajeev password even when username is omitted', async () => {
      const res = await callLogin({ password: 'Dr Rajeev chauhan' })
      expect(res.status).toBe(200)
      expect(res.data.userId).toBe('DR_RAJEEV_CHAUHAN')
    })
  })

  describe('DEO and other accounts', () => {
    it('authenticates DEO', async () => {
      const res = await callLogin({ username: 'deo', password: 'deo1234' })
      expect(res.status).toBe(200)
      expect(res.data.portal).toBe('deo')
    })

    it('authenticates Dr. Nitin Sharma', async () => {
      const res = await callLogin({ username: 'nitin', password: 'nitin1234' })
      expect(res.status).toBe(200)
      expect(res.data.userId).toBe('DR_NITIN_SHARMA')
    })

    it('authenticates Dr. Arshdeep', async () => {
      const res = await callLogin({ username: 'arshdeep', password: 'arsh1234' })
      expect(res.status).toBe(200)
      expect(res.data.userId).toBe('DR_ARSHDEEP')
    })
  })

  describe('Invalid attempts', () => {
    it('rejects wrong password', async () => {
      const res = await callLogin({ username: 'cardiokonnect', password: 'wrongpassword' })
      expect(res.status).toBe(401)
      expect(res.data.error).toBe('Invalid credentials')
    })

    it('rejects empty password', async () => {
      const res = await callLogin({ username: 'cardiokonnect', password: '' })
      expect(res.status).toBe(400)
    })
  })
})

