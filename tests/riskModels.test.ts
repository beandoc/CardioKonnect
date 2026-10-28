import { describe, it, expect } from 'vitest'
import { computeMLRiskProfile, buildMaggicInputs, predictKaggleHeartFailure } from '../lib/clinicalIntelligence'

const visit: any = { id: 'v', patientId: 'p', visitDate: '2026-01-01' }

describe('risk models never present imputed inputs as individualized', () => {
  it('flags missing age and LVEF as not estimable', () => {
    const r = computeMLRiskProfile({ id: 'p', sex: 'Male' } as any, visit, [visit])
    expect(r.insufficientData).toBe(true)
    expect(r.primaryDriver).toMatch(/Age and LVEF/)
  })

  it('lists every defaulted MAGGIC input', () => {
    const { imputed, missingCore } = buildMaggicInputs({ id: 'p', sex: 'Female', age: 70 } as any, { ...visit, lvef: 30 })
    expect(missingCore).toEqual([])
    expect(imputed).toEqual(expect.arrayContaining(['Systolic BP', 'BMI', 'Creatinine', 'NYHA class', 'Smoking status', 'HF duration']))
  })

  it('uses recorded values when present', () => {
    const { imputed, input } = buildMaggicInputs(
      { id: 'p', sex: 'Male', age: 60, currentSmoker: true, hfConfirmationDate: '2020-01-01' } as any,
      { ...visit, lvef: 25, bpSystolic: 100, weight: 70, height: 170, creatinine: 1.4, nyha: 'III' },
    )
    expect(imputed).toEqual([])
    expect(input.currentSmoker).toBe(true)
    expect(input.heartFailureDiagnosisYears).toBeGreaterThan(5)
  })

  it('reports defaulted random-forest features', () => {
    const r = predictKaggleHeartFailure({ id: 'p', sex: 'Male' } as any, visit)
    expect(r.imputedFeatures).toEqual(expect.arrayContaining(['age', 'ejection_fraction', 'serum_sodium', 'creatinine_phosphokinase']))
  })
})
