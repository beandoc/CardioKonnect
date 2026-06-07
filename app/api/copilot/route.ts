/**
 * /api/copilot
 *
 * LLM clinical co-pilot endpoint.
 * Uses Anthropic Claude claude-haiku-4-5 via API — extremely cheap (~$0.25/1M input tokens).
 * For a registry of <500 patients with daily use, cost < $5/month.
 *
 * Falls back to rule-based summary if ANTHROPIC_API_KEY is not set.
 * This means the feature works TODAY with dummy data and zero API cost.
 */

import { NextRequest, NextResponse } from 'next/server'

const SYSTEM_PROMPT = `You are a clinical decision support system embedded in a Heart Failure Registry (CardioPlus) at AICTS, Pune, India.

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

function buildFallbackResponse(patientSummary: string): object {
  return {
    summary: `Clinical summary generated from registry data. ${patientSummary}`,
    alerts: [
      {
        severity: 'info',
        title: 'AI Co-pilot Offline',
        detail: 'Set ANTHROPIC_API_KEY environment variable to enable AI-powered insights.',
        action: 'Add ANTHROPIC_API_KEY to .env.local and redeploy.',
      },
    ],
    recommendations: [
      {
        priority: 1,
        category: 'GDMT',
        action: 'Review GDMT pillars — see Clinical Intelligence panel for rule-based recommendations.',
        evidence: 'Class I-A, ESC 2023',
      },
    ],
    monitoringDue: ['AI-powered monitoring requires API key configuration'],
    prognosis: 'AI prognosis requires ANTHROPIC_API_KEY to be configured.',
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { patientSummary, visitData } = body

    if (!patientSummary) {
      return NextResponse.json({ error: 'patientSummary required' }, { status: 400 })
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json(buildFallbackResponse(patientSummary))
    }

    const userMessage = `
Patient Data:
${JSON.stringify({ patientSummary, visitData }, null, 2)}

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
      console.error('Anthropic API error:', response.status, await response.text())
      return NextResponse.json(buildFallbackResponse(patientSummary))
    }

    const data = await response.json()
    const text = data.content?.[0]?.text ?? ''

    // Extract JSON from response (model may wrap in markdown)
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json(buildFallbackResponse(patientSummary))
    }

    const parsed = JSON.parse(jsonMatch[0])
    return NextResponse.json(parsed)
  } catch (error) {
    console.error('Copilot API error:', error)
    return NextResponse.json(
      buildFallbackResponse('Error processing clinical data.'),
      { status: 200 }  // return 200 so UI degrades gracefully
    )
  }
}
