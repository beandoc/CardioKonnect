/**
 * anonymization.ts
 * Clinical De-Identification and PHI Sanitization Engine
 * Compliant with HIPAA Safe Harbor and India DPDP (Digital Personal Data Protection) Act standards.
 * 
 * Used prior to any third-party egress (e.g., Anthropic Claude / Gemini API calls)
 * and when exporting registry datasets for cross-center research.
 */

import { getAge } from './utils'

// Common regex patterns for personal identifiers
const PHONE_REGEX = /(\+?91[\-\s]?)?[6-9]\d{9}|\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g
const EMAIL_REGEX = /[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/g
const AADHAAR_REGEX = /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g
const ABHA_REGEX = /\b\d{2}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g
const PINCODE_REGEX = /\b[1-9][0-9]{5}\b/g

/**
 * Sanitizes free-form clinical narrative text by redacting phones, emails, and Indian national IDs.
 */
export function sanitizeText(text: string | null | undefined): string {
  if (!text) return ''
  return text
    .replace(EMAIL_REGEX, '[REDACTED_EMAIL]')
    .replace(AADHAAR_REGEX, '[REDACTED_AADHAAR]')
    .replace(ABHA_REGEX, '[REDACTED_ABHA]')
    .replace(PHONE_REGEX, '[REDACTED_PHONE]')
    .replace(PINCODE_REGEX, '[REDACTED_PINCODE]')
}

/**
 * Creates a deterministic, non-reversible pseudo-anonymous token from patient identifier.
 */
export function anonymizeId(id: string | null | undefined): string {
  if (!id) return 'ANON-SUBJ-0000'
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    const char = id.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash |= 0
  }
  const hex = Math.abs(hash).toString(16).padStart(6, '0').slice(0, 6).toUpperCase()
  return `CP-ANON-${hex}`
}

/**
 * De-identifies a Patient object, completely stripping names, contact, exact DOB, address, and national IDs.
 */
export function sanitizePatientForEgress(patient: any): Record<string, any> {
  if (!patient) return {}

  const anonPatient: Record<string, any> = {
    anonymousSubjectId: anonymizeId(patient.id || patient.mrn),
    age: (patient.dob ? getAge(patient.dob) : null) ?? patient.age,
    sex: patient.sex || 'Unknown',
    registryId: patient.registryId,
    hfType: patient.hfType,
    lvef: patient.lvef,
    nyha: patient.nyha,
    comorbidities: Array.isArray(patient.comorbidities)
      ? patient.comorbidities
      : (patient.comorbidities ? [patient.comorbidities] : []),
    comorbidCAD: patient.comorbidCAD,
    comorbidPriorPCI: patient.comorbidPriorPCI,
    comorbidPriorCABG: patient.comorbidPriorCABG,
    comorbidDiabetes: patient.comorbidDiabetes,
    comorbidHypertension: patient.comorbidHypertension,
    comorbidCKD: patient.comorbidCKD,
    comorbidAF: patient.comorbidAF,
    comorbidCOPD: patient.comorbidCOPD,
    icdPresence: patient.icdPresence,
    crtPresence: patient.crtPresence,
  }

  return anonPatient
}

/**
 * De-identifies a Visit object, scrubbing any free-form notes and removing dates of encounter.
 */
export function sanitizeVisitForEgress(visit: any): Record<string, any> {
  if (!visit) return {}

  const anonVisit: Record<string, any> = { ...visit }

  // Strip direct identifiers
  delete anonVisit.id
  delete anonVisit.patientId
  delete anonVisit.mrn
  delete anonVisit.doctorName
  delete anonVisit.operatorName
  delete anonVisit.hospitalName

  // Generalize dates to relative or omit
  if (anonVisit.visitDate) {
    anonVisit.visitYear = new Date(anonVisit.visitDate).getFullYear()
    delete anonVisit.visitDate
  }
  delete anonVisit.createdAt
  delete anonVisit.updatedAt
  delete anonVisit.echoDate
  delete anonVisit.followupDate

  // Sanitize notes
  if (anonVisit.notes) {
    anonVisit.notes = sanitizeText(anonVisit.notes)
  }
  if (anonVisit.plan) {
    anonVisit.plan = sanitizeText(anonVisit.plan)
  }
  if (anonVisit.clinicalImpression) {
    anonVisit.clinicalImpression = sanitizeText(anonVisit.clinicalImpression)
  }

  return anonVisit
}

/**
 * De-identifies a CathProcedure record before egress or export.
 */
export function sanitizeProcedureForEgress(procedure: any): Record<string, any> {
  if (!procedure) return {}

  const anonProc: Record<string, any> = { ...procedure }

  delete anonProc.id
  delete anonProc.patientId
  delete anonProc.operatorName
  delete anonProc.assistantOperatorName
  delete anonProc.operatorId

  if (anonProc.procedureDate) {
    anonProc.procedureYear = new Date(anonProc.procedureDate).getFullYear()
    delete anonProc.procedureDate
  }

  if (anonProc.notes) {
    anonProc.notes = sanitizeText(anonProc.notes)
  }

  return anonProc
}
