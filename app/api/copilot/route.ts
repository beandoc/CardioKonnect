/**
 * /api/copilot
 *
 * LLM clinical co-pilot endpoint.
 * Uses Anthropic Claude claude-haiku-4-5 via API — extremely cheap (~$0.25/1M input tokens).
 * For a registry of <500 patients with daily use, cost < $5/month.
 *
 * Requires a Firebase ID token (Authorization: Bearer) for a registry user.
 * Requests are size- and rate-limited, inputs are de-identified by allowlist
 * before egress, and model output is schema-validated before it is returned.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { sanitizePatientForEgress, sanitizeVisitForEgress } from '@/lib/anonymization'
import { findUserByEmail } from '@/lib/appConfig'

const SYSTEM_PROMPT = `You are a clinical decision support system embedded in the CardioKonnect Cardiovascular Registry Network.

You follow ESC 2023 Heart Failure Guidelines and AHA/ACC 2022 HF Guidelines.

You will receive structured patient data in JSON format and must return a JSON response with these exact fields:
{
  "summary": "2-3 sentence clinical summary of this patient's current status",
  "alerts": [{"severity": "critical|high|medium", "title": "...", "detail": "...", "action": "..."}],
  "recommendations": [{"priority": 1-5, "category": "GDMT|Device|Monitoring|Referral|Lifestyle", "action": "...", "evidence": "Class X-Y, ESC 2023"}],
  "monitoringDue": ["list of overdue tests or follow-ups"],
  "prognosis": "one sentence on expected trajectory if current plan continues"
}

Rules:
- Never invent clinical values not present in the input.
- Always cite guideline class (I/IIa/IIb/III) and evidence level (A/B/C).
- Keep each recommendation under 25 words.
- If a value is missing, say "not available" — do not assume.
- Maximum 5 alerts and 5 recommendations.
- This is for cardiologist review only — not for direct patient use.`

const MAX_BODY_BYTES = 32 * 1024
const RATE_LIMIT_PER_MINUTE = 10

const RequestSchema = z.object({
  patientSummary: z.record(z.unknown()),
  visitData: z.record(z.unknown()).optional(),
})

const ResponseSchema = z.object({
  summary: z.string().max(2000),
  alerts: z.array(z.object({
    severity: z.enum(['critical', 'high', 'medium']),
    title: z.string().max(200),
    detail: z.string().max(1000),
    action: z.string().max(1000),
  })).max(5),
  recommendations: z.array(z.object({
    priority: z.number().int().min(1).max(5),
    category: z.enum(['GDMT', 'Device', 'Monitoring', 'Referral', 'Lifestyle']),
    action: z.string().max(500),
    evidence: z.string().max(200),
  })).max(5),
  monitoringDue: z.array(z.string().max(300)).max(10),
  prognosis: z.string().max(1000),
})

// Best-effort per-instance limiter; serverless instances do not share it.
const recentCalls = new Map<string, number[]>()

function rateLimited(uid: string): boolean {
  const now = Date.now()
  const calls = (recentCalls.get(uid) || []).filter(t => now - t < 60_000)
  calls.push(now)
  recentCalls.set(uid, calls)
  return calls.length > RATE_LIMIT_PER_MINUTE
}

/**
 * Verifies a Firebase ID token via the Identity Toolkit API and returns the
 * caller's uid if the account maps to a registry user.
 */
async function authenticate(req: NextRequest): Promise<string | null> {
  const header = req.headers.get('authorization') || ''
  const idToken = header.startsWith('Bearer ') ? header.slice(7) : ''
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY
  if (!idToken || !apiKey) return null

  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ idToken }),
  })
  if (!res.ok) return null
  const data = await res.json()
  const account = data.users?.[0]
  if (!account?.localId || !findUserByEmail(account.email)) return null
  return account.localId
}

function buildFallbackResponse(reason: string): object {
  return {
    summary: `AI co-pilot unavailable: ${reason}`,
    alerts: [
      {
        severity: 'medium',
        title: 'AI Co-pilot Offline',
        detail: reason,
        action: 'Use the rule-based Clinical Intelligence panel.',
      },
    ],
    recommendations: [],
    monitoringDue: [],
    prognosis: 'Not available.',
  }
}

export async function POST(req: NextRequest) {
  const uid = await authenticate(req).catch(() => null)
  if (!uid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (rateLimited(uid)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const raw = await req.text()
  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Request too large' }, { status: 413 })
  }

  let parsedBody: z.infer<typeof RequestSchema>
  try {
    parsedBody = RequestSchema.parse(JSON.parse(raw))
  } catch {
    return NextResponse.json({ error: 'patientSummary object required' }, { status: 400 })
  }

  try {
    // De-identify PHI prior to any third-party egress (allowlist-based)
    const sanitizedPatient = sanitizePatientForEgress(parsedBody.patientSummary)
    const sanitizedVisit = sanitizeVisitForEgress(parsedBody.visitData)

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json(buildFallbackResponse('ANTHROPIC_API_KEY is not configured.'))
    }

    const userMessage = `
Clinical Data (De-Identified):
${JSON.stringify({ patient: sanitizedPatient, visit: sanitizedVisit }, null, 2)}

Analyse this patient and provide clinical recommendations in the exact JSON format specified.`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',  // cheapest, fast, good for structured output
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
      }),
    })

    if (!response.ok) {
      console.error('Anthropic API error:', response.status)
      return NextResponse.json(buildFallbackResponse('The AI service returned an error.'))
    }

    const data = await response.json()
    const text = data.content?.find((b: { type: string }) => b.type === 'text')?.text ?? ''

    // Extract JSON from response (model may wrap in markdown) and validate its shape
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    const validated = jsonMatch ? ResponseSchema.safeParse(JSON.parse(jsonMatch[0])) : null
    if (!validated?.success) {
      return NextResponse.json(buildFallbackResponse('The AI response did not match the expected format.'))
    }
    return NextResponse.json(validated.data)
  } catch (error) {
    console.error('Copilot API error:', error)
    return NextResponse.json(buildFallbackResponse('Error processing clinical data.'))
  }
}
