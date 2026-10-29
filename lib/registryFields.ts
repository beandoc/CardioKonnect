/**
 * registryFields.ts
 * Utilities for registry field definitions, custom field detection,
 * identifier sanitization, and display formatting.
 */

import { BUILT_IN_FIELDS, type RegistryField } from './types'

export const BUILT_IN_FIELD_NAMES: Set<string> = new Set(
  BUILT_IN_FIELDS.map(f => f.fieldName)
)

/**
 * Returns true if the registry field is a custom (user-added) parameter
 * rather than one of the 171 standard built-in core registry parameters.
 */
export function isCustomRegistryField(field: RegistryField): boolean {
  if (!field) return false
  return !BUILT_IN_FIELD_NAMES.has(field.fieldName)
}

/**
 * Sanitizes user input for fieldName (code) into a clean, valid
 * lowerCamelCase JavaScript identifier.
 * E.g.: "Troponin Delta (0-3h)" -> "troponinDelta03h"
 *       "Peak VO2" -> "peakVO2"
 */
export function sanitizeFieldName(input: string): string {
  if (!input) return ''
  // Replace symbols, punctuation, underscores with spaces, keep alphanumeric
  const words = input
    .trim()
    .replace(/[^a-zA-Z0-9]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)

  if (words.length === 0) return ''

  return words
    .map((word, i) => {
      if (i === 0) {
        return word.charAt(0).toLowerCase() + word.slice(1)
      }
      return word.charAt(0).toUpperCase() + word.slice(1)
    })
    .join('')
}

/**
 * Formats a camelCase or snake_case key into clean readable Title Case.
 */
export function formatFieldLabel(key: string): string {
  if (!key) return ''
  return key
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .split(/\s+/)
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
    .trim()
}

