import { describe, it, expect } from 'vitest'
import { canViewPatient, filterPatientsByAccess, filterRecordsByPatients } from '../lib/accessControl'
import { APP_USERS, resolveLoginEmail } from '../lib/appConfig'

const pune: any = { id: 'p1', siteId: 'AICTS_PUNE', registryId: 'hf', registryIds: ['hf'] }
const kanpur: any = { id: 'p2', siteId: 'KANPUR_APEX', registryId: 'cathlab', registryIds: ['cathlab'] }

describe('access control', () => {
  it('denies everything without a user', () => {
    expect(canViewPatient(null, pune)).toBe(false)
    expect(filterPatientsByAccess(null, [pune, kanpur])).toEqual([])
  })

  it('isolates sites', () => {
    expect(filterPatientsByAccess(APP_USERS.DR_JAYACHANDRA, [pune, kanpur])).toEqual([pune])
    expect(filterPatientsByAccess(APP_USERS.DR_RAJEEV_CHAUHAN, [pune, kanpur])).toEqual([kanpur])
  })

  it('filters child records to accessible patients', () => {
    const procs = [{ patientId: 'p1' }, { patientId: 'p2' }]
    expect(filterRecordsByPatients(procs, [pune])).toEqual([{ patientId: 'p1' }])
  })
})

describe('login directory', () => {
  it('maps each alias to exactly one account and holds no passwords', () => {
    expect(resolveLoginEmail('cathlab')).toBe(APP_USERS.DR_RAJEEV_CHAUHAN.email)
    expect(resolveLoginEmail('doctor')).toBe(APP_USERS.DR_JAYACHANDRA.email)
    for (const u of Object.values(APP_USERS)) expect(u).not.toHaveProperty('defaultPassword')
    const aliases = Object.values(APP_USERS).flatMap(u => u.loginUsernames.map(a => a.toLowerCase()))
    expect(new Set(aliases).size).toBe(aliases.length)
  })
})
