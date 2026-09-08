/**
 * dataCompleteness.ts
 * Computes registry data completeness scores, audit metrics, and field gap identification.
 */

import type { Patient, Visit } from './types'

export interface FieldAuditItem {
  key: string
  label: string
  category: 'Demographics' | 'Vitals' | 'Phenotype' | 'Echo' | 'Labs' | 'Medications' | 'FollowUp' | 'Research'
  tier: 1 | 2 | 3 // 1: Core Acute/Discharge, 2: 30/90d Follow-up, 3: Optional Research
  isComplete: boolean
  value: any
  importance: 'Critical' | 'Important' | 'Standard' | 'Optional'
}

export interface CompletenessReport {
  overallScore: number // Tier 1 Core Score 0 - 100%
  coreInpatientScore: number
  followUpScore: number
  optionalResearchScore: number
  grade: 'A' | 'B' | 'C' | 'D' | 'Incomplete'
  color: string
  totalFields: number
  completedFields: number
  missingCritical: FieldAuditItem[]
  missingImportant: FieldAuditItem[]
  categories: {
    name: string
    score: number
    completed: number
    total: number
  }[]
  allFields: FieldAuditItem[]
}

export function assessPatientCompleteness(patient: Patient, latestVisit: Visit | null, allVisits: Visit[] = []): CompletenessReport {
  const fields: FieldAuditItem[] = []

  // ── Tier 1: Core Acute / Discharge CRF ──────────────────────────────────────

  // 1. Demographics & Indian Hierarchy
  fields.push({
    key: 'name',
    label: 'Full Name',
    category: 'Demographics',
    tier: 1,
    isComplete: Boolean(patient.firstName?.trim() && patient.firstName !== 'Unknown'),
    value: `${patient.firstName || ''} ${patient.lastName || ''}`.trim(),
    importance: 'Critical',
  })
  fields.push({
    key: 'age_dob',
    label: 'Date of Birth / Age',
    category: 'Demographics',
    tier: 1,
    isComplete: Boolean(patient.dob || patient.age),
    value: patient.dob || (patient.age ? `${patient.age} yrs` : null),
    importance: 'Critical',
  })
  fields.push({
    key: 'sex',
    label: 'Sex / Gender',
    category: 'Demographics',
    tier: 1,
    isComplete: Boolean(patient.sex),
    value: patient.sex,
    importance: 'Critical',
  })
  fields.push({
    key: 'cohortType',
    label: 'Cohort Track (ADHF vs OPD)',
    category: 'Demographics',
    tier: 1,
    isComplete: Boolean(patient.cohortType || latestVisit?.visitType),
    value: patient.cohortType || (latestVisit?.visitType === 'Inpatient' ? 'ADHF_Inpatient' : 'Chronic_OPD'),
    importance: 'Critical',
  })
  fields.push({
    key: 'contact',
    label: 'Phone / Primary Contact',
    category: 'Demographics',
    tier: 1,
    isComplete: Boolean(patient.contact?.trim()),
    value: patient.contact,
    importance: 'Important',
  })
  fields.push({
    key: 'consent',
    label: 'Informed Consent Status',
    category: 'Demographics',
    tier: 1,
    isComplete: Boolean(patient.consentStatus === 'Granted' || patient.studyConsented),
    value: patient.consentStatus || (patient.studyConsented ? 'Granted' : 'Pending'),
    importance: 'Critical',
  })

  // 2. Vitals & Anthropometrics
  const bpComplete = Boolean(
    (latestVisit?.bpSystolic && latestVisit?.bpDiastolic) ||
    (latestVisit?.bpSystolic)
  )
  fields.push({
    key: 'bp',
    label: 'Blood Pressure (SBP/DBP)',
    category: 'Vitals',
    tier: 1,
    isComplete: bpComplete,
    value: latestVisit?.bpSystolic ? `${latestVisit.bpSystolic}/${latestVisit.bpDiastolic || '—'}` : null,
    importance: 'Critical',
  })
  fields.push({
    key: 'heartRate',
    label: 'Heart Rate',
    category: 'Vitals',
    tier: 1,
    isComplete: Boolean(latestVisit?.heartRate),
    value: latestVisit?.heartRate ? `${latestVisit.heartRate} bpm` : null,
    importance: 'Important',
  })
  fields.push({
    key: 'weight',
    label: 'Body Weight',
    category: 'Vitals',
    tier: 1,
    isComplete: Boolean(latestVisit?.weight),
    value: latestVisit?.weight ? `${latestVisit.weight} kg` : null,
    importance: 'Important',
  })

  // 3. Phenotype & Indian Aetiology
  fields.push({
    key: 'hfType',
    label: 'HF Phenotype (HFrEF/HFmrEF/HFpEF/HFimpEF)',
    category: 'Phenotype',
    tier: 1,
    isComplete: Boolean(latestVisit?.hfType || patient.hfType),
    value: latestVisit?.hfType || patient.hfType,
    importance: 'Critical',
  })
  fields.push({
    key: 'nyha',
    label: 'NYHA Functional Class',
    category: 'Phenotype',
    tier: 1,
    isComplete: Boolean(latestVisit?.nyha || patient.nyha),
    value: latestVisit?.nyha || patient.nyha,
    importance: 'Critical',
  })
  fields.push({
    key: 'etiology',
    label: 'Primary Etiology (Indian Hierarchy)',
    category: 'Phenotype',
    tier: 1,
    isComplete: Boolean(
      (latestVisit?.etiology && latestVisit.etiology.length > 0) ||
      (patient.indexEtiology && patient.indexEtiology.length > 0)
    ),
    value: latestVisit?.etiology?.join(', ') || patient.indexEtiology?.join(', ') || null,
    importance: 'Critical',
  })

  // 4. Echocardiography (LVEF method & value)
  fields.push({
    key: 'lvef',
    label: 'LVEF (%) & Modality',
    category: 'Echo',
    tier: 1,
    isComplete: Boolean(latestVisit?.lvef != null || patient.lvef != null),
    value: latestVisit?.lvef != null ? `${latestVisit.lvef}% (${latestVisit.lvefMethod || '2D Echo'})` : null,
    importance: 'Critical',
  })
  fields.push({
    key: 'ecg_rhythm',
    label: 'ECG Rhythm & QRS Duration',
    category: 'Echo',
    tier: 1,
    isComplete: Boolean(latestVisit?.rhythm || latestVisit?.qrsDuration),
    value: latestVisit?.rhythm ? `${latestVisit.rhythm} ${latestVisit.qrsDuration ? `(${latestVisit.qrsDuration}ms)` : ''}` : null,
    importance: 'Important',
  })

  // 5. Core Admission Labs
  const hasCreatinineOrEgfr = Boolean(
    latestVisit?.creatinine != null || latestVisit?.egfr != null
  )
  fields.push({
    key: 'creatinine_egfr',
    label: 'Serum Creatinine & eGFR',
    category: 'Labs',
    tier: 1,
    isComplete: hasCreatinineOrEgfr,
    value: latestVisit?.egfr ? `eGFR: ${latestVisit.egfr} ml/min` : (latestVisit?.creatinine ? `Cr: ${latestVisit.creatinine} mg/dL` : null),
    importance: 'Critical',
  })
  fields.push({
    key: 'potassium',
    label: 'Serum Potassium (K+)',
    category: 'Labs',
    tier: 1,
    isComplete: Boolean(latestVisit?.potassium != null),
    value: latestVisit?.potassium ? `${latestVisit.potassium} mmol/L` : null,
    importance: 'Critical',
  })
  fields.push({
    key: 'ntProBNP',
    label: 'NT-proBNP / BNP',
    category: 'Labs',
    tier: 1,
    isComplete: Boolean(latestVisit?.ntProBNP != null || latestVisit?.bnp != null),
    value: latestVisit?.ntProBNP ? `${latestVisit.ntProBNP} pg/mL` : null,
    importance: 'Important',
  })
  fields.push({
    key: 'hemoglobin',
    label: 'Hemoglobin (Hb)',
    category: 'Labs',
    tier: 1,
    isComplete: Boolean(latestVisit?.hb != null),
    value: latestVisit?.hb ? `${latestVisit.hb} g/dL` : null,
    importance: 'Important',
  })

  // 6. Medications & Reasons
  const isMedComplete = (med: any) => Boolean(med?.prescribed === 'Yes' || med?.prescribed === 'No' || med?.reason)
  fields.push({
    key: 'raasi',
    label: 'RAASi / ARNI (Status or Reason)',
    category: 'Medications',
    tier: 1,
    isComplete: isMedComplete(latestVisit?.raasi),
    value: latestVisit?.raasi?.type || latestVisit?.raasi?.reason || latestVisit?.raasi?.prescribed,
    importance: 'Critical',
  })
  fields.push({
    key: 'betaBlocker',
    label: 'Beta-Blocker (Status or Reason)',
    category: 'Medications',
    tier: 1,
    isComplete: isMedComplete(latestVisit?.betaBlocker),
    value: latestVisit?.betaBlocker?.type || latestVisit?.betaBlocker?.reason || latestVisit?.betaBlocker?.prescribed,
    importance: 'Critical',
  })
  fields.push({
    key: 'mra',
    label: 'MRA (Status or Reason)',
    category: 'Medications',
    tier: 1,
    isComplete: isMedComplete(latestVisit?.mra),
    value: latestVisit?.mra?.type || latestVisit?.mra?.reason || latestVisit?.mra?.prescribed,
    importance: 'Critical',
  })
  fields.push({
    key: 'sglt2i',
    label: 'SGLT2i (Status or Reason)',
    category: 'Medications',
    tier: 1,
    isComplete: isMedComplete(latestVisit?.sglt2i),
    value: latestVisit?.sglt2i?.type || latestVisit?.sglt2i?.reason || latestVisit?.sglt2i?.prescribed,
    importance: 'Critical',
  })

  // ── Tier 2: Longitudinal Follow-up CRF ─────────────────────────────────────
  fields.push({
    key: 'vitalStatus',
    label: 'Vital Status Ascertainment (30d / 90d)',
    category: 'FollowUp',
    tier: 2,
    isComplete: Boolean(patient.vitalStatus || patient.lastKnownAliveDate),
    value: patient.vitalStatus || (patient.lastKnownAliveDate ? `Alive on ${patient.lastKnownAliveDate}` : null),
    importance: 'Critical',
  })
  fields.push({
    key: 'fuEncounter',
    label: 'Follow-Up Encounter Recorded',
    category: 'FollowUp',
    tier: 2,
    isComplete: allVisits.length >= 2 || Boolean(patient.lastVisitDate && patient.lastVisitDate !== patient.indexDate),
    value: allVisits.length >= 2 ? `${allVisits.length} visits logged` : 'Single encounter',
    importance: 'Important',
  })

  // ── Tier 3: Optional Research Modules ──────────────────────────────────────
  fields.push({
    key: 'sixMWT',
    label: '6-Minute Walk Test (Optional Substudy)',
    category: 'Research',
    tier: 3,
    isComplete: Boolean(latestVisit?.sixMWT),
    value: latestVisit?.sixMWT ? `${latestVisit.sixMWT} m` : null,
    importance: 'Optional',
  })
  fields.push({
    key: 'kccq',
    label: 'KCCQ-12 Health Status Score (Optional)',
    category: 'Research',
    tier: 3,
    isComplete: Boolean(latestVisit?.kccq?.overallSummaryScore != null),
    value: latestVisit?.kccq?.overallSummaryScore != null ? `${latestVisit.kccq.overallSummaryScore}/100` : null,
    importance: 'Optional',
  })

  // Calculate Tier 1 Score (Core Inpatient Quality)
  const tier1Fields = fields.filter(f => f.tier === 1)
  let t1TotalWeight = 0
  let t1EarnedWeight = 0

  tier1Fields.forEach(f => {
    const w = f.importance === 'Critical' ? 3 : 2
    t1TotalWeight += w
    if (f.isComplete) t1EarnedWeight += w
  })
  const coreInpatientScore = t1TotalWeight > 0 ? Math.round((t1EarnedWeight / t1TotalWeight) * 100) : 0

  // Calculate Tier 2 Score (Follow-Up Ascertainment)
  const tier2Fields = fields.filter(f => f.tier === 2)
  const t2Complete = tier2Fields.filter(f => f.isComplete).length
  const followUpScore = tier2Fields.length > 0 ? Math.round((t2Complete / tier2Fields.length) * 100) : 0

  // Calculate Tier 3 Score (Optional Research)
  const tier3Fields = fields.filter(f => f.tier === 3)
  const t3Complete = tier3Fields.filter(f => f.isComplete).length
  const optionalResearchScore = tier3Fields.length > 0 ? Math.round((t3Complete / tier3Fields.length) * 100) : 0

  const overallScore = coreInpatientScore

  let grade: 'A' | 'B' | 'C' | 'D' | 'Incomplete' = 'Incomplete'
  let color = '#ef4444'

  if (overallScore >= 90) {
    grade = 'A'
    color = '#10b981' // emerald
  } else if (overallScore >= 75) {
    grade = 'B'
    color = '#3b82f6' // blue
  } else if (overallScore >= 60) {
    grade = 'C'
    color = '#f59e0b' // amber
  } else if (overallScore >= 40) {
    grade = 'D'
    color = '#f97316' // orange
  } else {
    grade = 'Incomplete'
    color = '#ef4444' // red
  }

  // Categories Breakdown (Tier 1 core)
  const categoryNames: ('Demographics' | 'Vitals' | 'Phenotype' | 'Echo' | 'Labs' | 'Medications')[] = [
    'Demographics', 'Vitals', 'Phenotype', 'Echo', 'Labs', 'Medications'
  ]

  const categories = categoryNames.map(name => {
    const catFields = tier1Fields.filter(f => f.category === name)
    const completed = catFields.filter(f => f.isComplete).length
    const total = catFields.length
    const score = total > 0 ? Math.round((completed / total) * 100) : 0
    return { name, score, completed, total }
  })

  const missingCritical = tier1Fields.filter(f => !f.isComplete && f.importance === 'Critical')
  const missingImportant = tier1Fields.filter(f => !f.isComplete && f.importance === 'Important')

  return {
    overallScore,
    coreInpatientScore,
    followUpScore,
    optionalResearchScore,
    grade,
    color,
    totalFields: tier1Fields.length,
    completedFields: tier1Fields.filter(f => f.isComplete).length,
    missingCritical,
    missingImportant,
    categories,
    allFields: fields,
  }
}
