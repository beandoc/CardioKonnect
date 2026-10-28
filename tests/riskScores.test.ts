import { describe, it, expect } from 'vitest'
import { calculateMAGGIC, calculateH2FPEF, calculateNCDRMortality, type MAGGICInput } from '../lib/riskScores'
import { evaluateGDMT } from '../lib/clinicalIntelligence'

const base: MAGGICInput = {
  age: 50, lvef: 45, systolicBP: 130, bmi: 32, creatinine: 0.8, nyha: 'I', sex: 'Female',
  diabetesMellitus: false, currentSmoker: false, copd: false, heartFailureDiagnosisYears: 0,
  betaBlocker: true, aceInhibitorOrArb: true,
}

describe('MAGGIC integer score (Pocock 2013)', () => {
  it('scores a lowest-risk patient at 0, and male sex adds 1', () => {
    expect(calculateMAGGIC(base).score).toBe(0)
    expect(calculateMAGGIC({ ...base, sex: 'Male' }).score).toBe(1)
  })

  it('adds points for NOT being on a beta-blocker (3) or ACEi/ARB (1)', () => {
    expect(calculateMAGGIC({ ...base, betaBlocker: false }).score).toBe(3)
    expect(calculateMAGGIC({ ...base, aceInhibitorOrArb: false }).score).toBe(1)
  })

  it('uses the EF-specific age and SBP columns', () => {
    // Age 80+: 10 / 13 / 15 points for EF <30 / 30–39 / ≥40
    const old = { ...base, age: 82, systolicBP: 150 }
    expect(calculateMAGGIC({ ...old, lvef: 45 }).score).toBe(15)
    expect(calculateMAGGIC({ ...old, lvef: 35 }).score).toBe(13 + 2)  // + EF 35–39 = 2
    expect(calculateMAGGIC({ ...old, lvef: 25 }).score).toBe(10 + 5)
    // SBP <110: 5 / 3 / 2 points
    expect(calculateMAGGIC({ ...base, systolicBP: 100, lvef: 25 }).score).toBe(5 + 5)
    expect(calculateMAGGIC({ ...base, systolicBP: 100, lvef: 37 }).score).toBe(3 + 2)
    expect(calculateMAGGIC({ ...base, systolicBP: 100, lvef: 45 }).score).toBe(2)
  })

  it('uses the published creatinine bands (µmol/L)', () => {
    expect(calculateMAGGIC({ ...base, creatinine: 1.0 }).score).toBe(0)   // 88 µmol/L
    expect(calculateMAGGIC({ ...base, creatinine: 1.1 }).score).toBe(1)   // 97
    expect(calculateMAGGIC({ ...base, creatinine: 2.5 }).score).toBe(6)   // 221
    expect(calculateMAGGIC({ ...base, creatinine: 3.0 }).score).toBe(8)   // 265
  })

  it('matches a hand-computed composite patient', () => {
    const score = calculateMAGGIC({
      age: 72, lvef: 35, systolicBP: 115, bmi: 27, creatinine: 1.5, nyha: 'III', sex: 'Male',
      diabetesMellitus: true, currentSmoker: false, copd: false, heartFailureDiagnosisYears: 3,
      betaBlocker: true, aceInhibitorOrArb: false,
    }).score
    // EF(35–39) 2 + age 8 + SBP 2 + BMI 2 + Cr 3 + NYHA 6 + male 1 + DM 3 + HF>18m 2 + no ACEi 1
    expect(score).toBe(30)
  })

  it('maps the score to Table 4 mortality', () => {
    expect(calculateMAGGIC(base)).toMatchObject({ score: 0, oneYearMortality: 0.015, threeYearMortality: 0.039 })
    const s30 = calculateMAGGIC({
      age: 72, lvef: 35, systolicBP: 115, bmi: 27, creatinine: 1.5, nyha: 'III', sex: 'Male',
      diabetesMellitus: true, currentSmoker: false, copd: false, heartFailureDiagnosisYears: 3,
      betaBlocker: true, aceInhibitorOrArb: false,
    })
    expect(s30).toMatchObject({ score: 30, oneYearMortality: 0.248, threeYearMortality: 0.523 })
    const worst = calculateMAGGIC({
      age: 85, lvef: 15, systolicBP: 100, bmi: 14, creatinine: 3.5, nyha: 'IV', sex: 'Male',
      diabetesMellitus: true, currentSmoker: true, copd: true, heartFailureDiagnosisYears: 3,
      betaBlocker: false, aceInhibitorOrArb: false,
    })
    expect(worst.score).toBeGreaterThan(50)
    expect(worst).toMatchObject({ oneYearMortality: 0.842, threeYearMortality: 0.985 })
  })
})

describe('H2FPEF', () => {
  it('derives probability from the continuous model, not the integer score', () => {
    const r = calculateH2FPEF({ bmi: 32, antihypertensiveDrugs: 2, atrialFibrillation: true, pulmonaryArterialPressure: 40, age: 70, echoEEPrime: 12 })
    expect(r.score).toBe(9)
    expect(r.probability).toBeCloseTo(0.951, 2)
    expect(r.interpretation).toMatch(/High probability/)
  })
})

describe('NCDR CathPCI', () => {
  it('counts cardiogenic shock once when Killip IV is also recorded', () => {
    const input = { age: 65, cardiacArrestWithin24h: false, presentation: 'STEMI' as const }
    const shockOnly = calculateNCDRMortality({ ...input, cardiogenicShockPreProcedure: true })
    const both = calculateNCDRMortality({ ...input, cardiogenicShockPreProcedure: true, killipClass: 'IV' })
    const killipOnly = calculateNCDRMortality({ ...input, cardiogenicShockPreProcedure: false, killipClass: 'IV' })
    expect(both.logOdds).toBe(shockOnly.logOdds)
    expect(killipOnly.logOdds).toBe(shockOnly.logOdds)
  })
})

describe('GDMT optimisation score', () => {
  it('gives partial credit to pillars started below target dose', () => {
    const patient: any = { id: 'p', hfType: 'HFrEF' }
    const visit: any = {
      id: 'v', patientId: 'p', visitDate: '2026-01-01', hfType: 'HFrEF', lvef: 30, bpSystolic: 120, heartRate: 75, potassium: 4.5, egfr: 70,
      raasi: { prescribed: 'Yes', type: 'Ramipril', dose: '2.5mg' },
      betaBlocker: { prescribed: 'Yes', type: 'Bisoprolol', dose: '2.5mg' },
      mra: { prescribed: 'Yes', type: 'Spironolactone', dose: '25mg' },
      sglt2i: { prescribed: 'Yes', type: 'Dapagliflozin', dose: '10mg' },
    }
    const g = evaluateGDMT(patient, visit)
    const below = g.pillars.filter(p => p.status === 'below-target').length
    expect(below).toBeGreaterThan(0)
    expect(g.optimizationScore).toBeGreaterThan(0)
    expect(g.optimizationScore).toBe(Math.round(((4 - below) + below * 0.75) / 4 * 100))
  })

  it('does not start RAASi above K+ 5.0 but keeps an existing one until 5.5', () => {
    const patient: any = { id: 'p', hfType: 'HFrEF' }
    const v: any = { id: 'v', patientId: 'p', visitDate: '2026-01-01', hfType: 'HFrEF', lvef: 30, potassium: 5.2 }
    const notOn = evaluateGDMT(patient, { ...v, raasi: { prescribed: 'No' } })
    const on = evaluateGDMT(patient, { ...v, raasi: { prescribed: 'Yes', type: 'Ramipril', dose: '10mg' } })
    expect(notOn.pillars[0].status).toBe('contraindicated')
    expect(on.pillars[0].status).not.toBe('contraindicated')
  })
})
