import { describe, it, expect } from 'vitest'
import { complicationFlags, complicationLabels, complicationItemsFromForm, complicationFormDefaults, hasMace } from '../lib/complications'
import { calculateProceduralSuccess, calculateMajorBleedingMetric } from '../lib/interventionalMetrics'

describe('complicationFlags', () => {
  it('reads the typed array written by the current CRF', () => {
    const f = complicationFlags({ complications: [{ type: 'emergency-cabg' }, { type: 'barc-bleeding', barcType: '3b' }] })
    expect(f.emergencyCabg).toBe(true)
    expect(f.majorBleed).toBe(true)
    expect(f.barcBleedingType).toBe('BARC 3b')
    expect(f.hasComplication).toBe(true)
  })

  it('reads the legacy flag object', () => {
    const f = complicationFlags({ complications: { hasComplication: true, coronaryPerforation: true, coronaryPerforationEllisClass: 'II' } })
    expect(f.coronaryPerforation).toBe(true)
    expect(f.coronaryPerforationEllisClass).toBe('II')
  })

  it('counts angiographic events stored as top-level CRF fields', () => {
    const f = complicationFlags({ complications: [], noReflow: true, dissectionNhlbi: 'Type C', perforationEllis: 'None' })
    expect(f.noReflowSlowReflow).toBe(true)
    expect(f.coronaryDissection).toBe(true)
    expect(f.coronaryPerforation).toBe(false)
    expect(complicationLabels(f)).toEqual(['Dissection (NHLBI Type C)', 'Slow / No-Reflow'])
  })

  it('reports a clean procedure as uncomplicated', () => {
    const f = complicationFlags({ complications: [], dissectionNhlbi: 'None', perforationEllis: 'None' })
    expect(f.hasComplication).toBe(false)
    expect(hasMace(f)).toBe(false)
  })

  it('unions a retained legacy audit with newly entered items', () => {
    const f = complicationFlags({ complications: [{ type: 'stroke' }], complicationsLegacy: { inLabDeath: true } })
    expect(f.strokeOrTia).toBe(true)
    expect(f.inLabDeath).toBe(true)
  })
})

describe('CRF complication mapping', () => {
  it('round-trips form values through stored items', () => {
    const items = complicationItemsFromForm({
      compDeath: 'Intra-procedural', compEmergencyCabg: false, compStroke: true, compTamponade: false,
      compPeriMi: false, compVentArrhythmia: false, compContrastReaction: false,
      compAccessSite: 'access-site-haematoma', compBarc: '2', compAkiStage: '1',
    }, [])
    const back = complicationFormDefaults(items)
    expect(back.compDeath).toBe('Intra-procedural')
    expect(back.compStroke).toBe(true)
    expect(back.compAccessSite).toBe('access-site-haematoma')
    expect(back.compBarc).toBe('2')
    expect(back.compAkiStage).toBe('1')
  })

  it('keeps item types the form does not capture, and their details', () => {
    const previous = [{ type: 'other' as const, details: 'vagal reaction' }, { type: 'stroke' as const, details: 'left MCA' }]
    const items = complicationItemsFromForm(complicationFormDefaults(previous), previous)
    expect(items).toContainEqual({ type: 'other', details: 'vagal reaction' })
    expect(items).toContainEqual({ type: 'stroke', details: 'left MCA' })
  })
})

describe('interventional metrics with mixed complication shapes', () => {
  it('does not throw on a legacy object and treats emergency CABG as failure', () => {
    const proc: any = { lesions: [], complications: { emergencyCabg: true } }
    expect(() => calculateProceduralSuccess(proc)).not.toThrow()
    expect(calculateProceduralSuccess(proc)).toBe(false)
  })

  it('counts major bleeding from both shapes', () => {
    const procs: any[] = [
      { complications: [{ type: 'barc-bleeding', barcType: '3a' }] },
      { complications: { majorBleed: true } },
      { complications: [{ type: 'barc-bleeding', barcType: '2' }] },
    ]
    expect(calculateMajorBleedingMetric(procs).numerator).toBe(2)
  })
})
