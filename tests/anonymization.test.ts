import { describe, it, expect } from 'vitest'
import { sanitizeVisitForEgress, sanitizePatientForEgress, sanitizeProcedureForEgress } from '../lib/anonymization'

describe('egress de-identification', () => {
  it('drops free-text and identifier fields from visits', () => {
    const out = sanitizeVisitForEgress({
      id: 'v1', patientId: 'p1', visitDate: '2026-03-04',
      clinicalNotes: 'Mr Sharma, ph 9876543210, lives at Kothrud',
      hospHistory: 'admitted at Ruby Hall', lvef: 30, nyha: 'III',
      raasi: { prescribed: 'Yes', type: 'ARNI', dose: '49/51 BID', changeReason: 'Called wife Sunita' },
      nested: { anything: 'secret' },
    })
    const json = JSON.stringify(out)
    expect(json).not.toMatch(/Sharma|9876543210|Kothrud|Ruby Hall|Sunita|secret|p1/)
    expect(out).toMatchObject({ lvef: 30, nyha: 'III', visitYear: 2026, raasi: { prescribed: 'Yes', type: 'ARNI' } })
  })

  it('aggregates ages over 89', () => {
    expect(sanitizePatientForEgress({ id: 'x', age: 93 }).age).toBe('90+')
    expect(sanitizePatientForEgress({ id: 'x', age: 70, firstName: 'A' })).not.toHaveProperty('firstName')
  })

  it('strips nested free text and timestamps from procedures', () => {
    const out = sanitizeProcedureForEgress({
      operatorName: 'Dr X', symptomOnset: '2026-01-01T10:00', contrastVolumeMl: 120,
      lesions: [{ vessel: 'LAD', notes: 'patient anxious' }],
      devices: [{ type: 'DES', serialOrLotNumber: 'SN-1' }],
    })
    expect(JSON.stringify(out)).not.toMatch(/Dr X|anxious|SN-1|2026-01-01/)
    expect(out.contrastVolumeMl).toBe(120)
  })
})
