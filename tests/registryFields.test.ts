import { describe, it, expect } from 'vitest'
import {
  sanitizeFieldName,
  isCustomRegistryField,
  formatFieldLabel,
  BUILT_IN_FIELD_NAMES
} from '@/lib/registryFields'
import type { RegistryField } from '@/lib/types'

describe('Registry Fields Utilities', () => {
  it('correctly identifies built-in core registry fields', () => {
    expect(BUILT_IN_FIELD_NAMES.has('visitDate')).toBe(true)
    expect(BUILT_IN_FIELD_NAMES.has('lvef')).toBe(true)
    expect(BUILT_IN_FIELD_NAMES.has('ntProBNP')).toBe(true)
    expect(BUILT_IN_FIELD_NAMES.has('randomNonExistentField')).toBe(false)
  })

  it('detects custom vs built-in registry fields', () => {
    const builtIn: RegistryField = {
      id: '15',
      srNo: 15,
      fieldName: 'lvef',
      displayLabel: 'LVEF (%)',
      dataType: 'Number',
      mandatory: false,
      pii: false,
      active: true,
      category: 'Echo',
      level: 'Level 1'
    }

    const customField: RegistryField = {
      id: '172',
      srNo: 172,
      fieldName: 'troponinDelta',
      displayLabel: 'Troponin Delta 0-3h',
      dataType: 'Number',
      mandatory: false,
      pii: false,
      active: true,
      category: 'Labs',
      level: 'Level 2'
    }

    expect(isCustomRegistryField(builtIn)).toBe(false)
    expect(isCustomRegistryField(customField)).toBe(true)
  })

  it('sanitizes user input into clean camelCase JavaScript identifiers', () => {
    expect(sanitizeFieldName('Troponin Delta')).toBe('troponinDelta')
    expect(sanitizeFieldName('peak VO2 (mL/kg/min)')).toBe('peakVO2MLKgMin')
    expect(sanitizeFieldName('amyloidosis_subtype')).toBe('amyloidosisSubtype')
    expect(sanitizeFieldName('  genetic variant  ')).toBe('geneticVariant')
    expect(sanitizeFieldName('')).toBe('')
  })

  it('formats field keys into human-readable Title Case labels', () => {
    expect(formatFieldLabel('troponinDelta')).toBe('Troponin Delta')
    expect(formatFieldLabel('geneticVariant')).toBe('Genetic Variant')
    expect(formatFieldLabel('amyloidosis_subtype')).toBe('Amyloidosis Subtype')
  })
})
