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

/** Safe Harbor: ages over 89 are aggregated into a single 90+ category. */
function safeHarborAge(age: number | null | undefined): number | string | null {
  if (age == null) return null
  return age > 89 ? '90+' : age
}

/**
 * De-identifies a Patient object, completely stripping names, contact, exact DOB, address, and national IDs.
 */
export function sanitizePatientForEgress(patient: any): Record<string, any> {
  if (!patient || typeof patient !== 'object') return {}

  const anonPatient: Record<string, any> = {
    anonymousSubjectId: anonymizeId(patient.id || patient.mrn),
    age: safeHarborAge((patient.dob ? getAge(patient.dob) : null) ?? patient.age),
    sex: patient.sex || 'Unknown',
    registryId: patient.registryId,
    hfType: patient.hfType,
    lvef: patient.lvef,
    nyha: patient.nyha,
    comorbidities: Array.isArray(patient.comorbidities)
      ? patient.comorbidities.map((c: unknown) => sanitizeText(String(c)))
      : [],
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

/** Structured visit fields that may leave the system. Everything else — free text, dates, IDs — is dropped. */
const VISIT_NUMERIC_FIELDS = [
  'lvef', 'bpSystolic', 'bpDiastolic', 'heartRate', 'weight', 'height', 'bmi', 'o2Sat',
  'creatinine', 'egfr', 'sodium', 'potassium', 'ntProBNP', 'bnp', 'hb', 'hba1c', 'ferritin',
  'transferrinSat', 'platelets', 'tft', 'ldl', 'triglycerides', 'uricAcid', 'qrsDuration',
  'sixMWT', 'phq9Score', 'rvsp', 'eEPrime', 'lvdd', 'lvsd',
] as const

const VISIT_ENUM_FIELDS = ['visitType', 'nyha', 'hfType', 'rhythm', 'bbb', 'ddGrade', 'oedema'] as const

const VISIT_MED_FIELDS = [
  'diuretic', 'raasi', 'betaBlocker', 'mra', 'sglt2i', 'ivabradine', 'digoxin', 'ivIron',
  'aspirin', 'statin', 'noac', 'vki', 'fibrate', 'pcsk9',
] as const

const MAX_ENUM_LENGTH = 40

/**
 * De-identifies a Visit by allowlist: only numeric measurements, short coded
 * values and medication prescribed/type/dose are kept. Free-text fields
 * (clinicalNotes, plan, reasons, history) never leave the system.
 */
export function sanitizeVisitForEgress(visit: any): Record<string, any> {
  if (!visit || typeof visit !== 'object') return {}
  const out: Record<string, any> = {}

  for (const k of VISIT_NUMERIC_FIELDS) {
    const v = visit[k]
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = v
  }
  for (const k of VISIT_ENUM_FIELDS) {
    const v = visit[k]
    if (typeof v === 'string' && v.length <= MAX_ENUM_LENGTH) out[k] = sanitizeText(v)
  }
  for (const k of ['etiology', 'device'] as const) {
    if (Array.isArray(visit[k])) {
      out[k] = visit[k].filter((x: unknown) => typeof x === 'string' && x.length <= MAX_ENUM_LENGTH).map(sanitizeText)
    }
  }
  for (const k of VISIT_MED_FIELDS) {
    const m = visit[k]
    if (m && typeof m === 'object' && (m.prescribed === 'Yes' || m.prescribed === 'No')) {
      out[k] = {
        prescribed: m.prescribed,
        ...(typeof m.type === 'string' && m.type.length <= MAX_ENUM_LENGTH ? { type: sanitizeText(m.type) } : {}),
        ...(typeof m.dose === 'string' && m.dose.length <= MAX_ENUM_LENGTH ? { dose: sanitizeText(m.dose) } : {}),
      }
    }
  }
  const kccq = visit.kccq?.overallSummaryScore
  if (typeof kccq === 'number') out.kccqOverall = kccq

  if (visit.visitDate) {
    const year = new Date(visit.visitDate).getFullYear()
    if (!Number.isNaN(year)) out.visitYear = year
  }
  return out
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

  delete anonProc.siteId
  delete anonProc.enteredBy
  delete anonProc.transferringFacility
  return stripFreeText(anonProc)
}

const FREE_TEXT_KEY = /note|detail|comment|reason|finding|description|narrative|serial|lotnumber|name$|by$/i
const DATE_KEY = /(date|time|onset|arrival|contact|activation|access|device)$/i

/** Recursively removes free-text and timestamp fields from an export payload. */
function stripFreeText(value: any): any {
  if (Array.isArray(value)) return value.map(stripFreeText)
  if (!value || typeof value !== 'object') return value
  const out: Record<string, any> = {}
  for (const [k, v] of Object.entries(value)) {
    if (FREE_TEXT_KEY.test(k)) continue
    if (typeof v === 'string' && DATE_KEY.test(k)) continue
    out[k] = stripFreeText(v)
  }
  return out
}
