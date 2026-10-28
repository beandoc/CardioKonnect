import { describe, it, expect } from 'vitest'

describe('Dashboard Metrics Logic', () => {
  it('correctly calculates GDMT adherence percentages', () => {
    const hfrEF = 62
    const raasiCount = 59
    const bbCount = 58
    const mraCount = 57
    const sglt2iCount = 50

    const raasiPct = Math.round((raasiCount / hfrEF) * 100)
    const bbPct = Math.round((bbCount / hfrEF) * 100)
    const mraPct = Math.round((mraCount / hfrEF) * 100)
    const sglt2iPct = Math.round((sglt2iCount / hfrEF) * 100)

    expect(raasiPct).toBe(95)
    expect(bbPct).toBe(94)
    expect(mraPct).toBe(92)
    expect(sglt2iPct).toBe(81)

    const overallAdherence = Math.round((raasiPct + bbPct + mraPct + sglt2iPct) / 4)
    expect(overallAdherence).toBe(91)
  })

  it('correctly detects CRT candidacy criteria', () => {
    // Criterion: (ef < 35) && (LBBB || QRS >= 130) && !hasCRT
    const isCrtCandidate = (ef: number | null, qrs: number | null, bbb: string | null, dev: string[]) => {
      const hasCRT = dev.includes('CRT-D') || dev.includes('CRT-P')
      return (ef != null && ef < 35) && (bbb === 'LBBB' || (qrs != null && qrs >= 130)) && !hasCRT
    }

    expect(isCrtCandidate(30, 140, null, [])).toBe(true)
    expect(isCrtCandidate(30, 110, 'LBBB', [])).toBe(true)
    expect(isCrtCandidate(45, 140, 'LBBB', [])).toBe(false)
    expect(isCrtCandidate(30, 140, 'LBBB', ['CRT-D'])).toBe(false)
  })

  it('correctly detects AF without anticoagulation', () => {
    const isAfWithoutOac = (rhythm: string | undefined, comorbidities: string[] | undefined, onNoac: boolean, onVki: boolean) => {
      const hasAF = rhythm === 'AF' || comorbidities?.some(c => c.toLowerCase().includes('atrial fib') || c.toLowerCase() === 'af')
      const onOAC = onNoac || onVki
      return Boolean(hasAF && !onOAC)
    }

    expect(isAfWithoutOac('AF', [], false, false)).toBe(true)
    expect(isAfWithoutOac('Sinus', ['HTN', 'AF'], false, false)).toBe(true)
    expect(isAfWithoutOac('AF', [], true, false)).toBe(false)
    expect(isAfWithoutOac('Sinus', ['HTN'], false, false)).toBe(false)
  })

  it('correctly detects uncontrolled diabetes', () => {
    const isUncontrolledDm = (comorbidities: string[] | undefined, hba1c: number | undefined) => {
      const hasDM = comorbidities?.some(c => c.toLowerCase().includes('diabet') || c.toLowerCase().includes('dm') || c.toLowerCase().includes('t2dm')) || hba1c != null
      return Boolean(hasDM && hba1c != null && hba1c > 8.0)
    }

    expect(isUncontrolledDm(['DM2'], 9.5)).toBe(true)
    expect(isUncontrolledDm(['DM2'], 7.2)).toBe(false)
    expect(isUncontrolledDm(['HTN'], 9.5)).toBe(true) // high hba1c implies diagnosed DM
    expect(isUncontrolledDm(['HTN'], undefined)).toBe(false)
  })
})
