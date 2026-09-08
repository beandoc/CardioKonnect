/**
 * dataCompleteness.ts
 * Computes registry data completeness scores, audit metrics, and field gap identification.
 */

import type { Patient, Visit } from './types'

export interface FieldAuditItem {
  key: string
  label: string
  category: 'Demographics' | 'Vitals' | 'Phenotype' | 'Echo' | 'Labs' | 'Medications'
  isComplete: boolean
  value: any
  importance: 'Critical' | 'Important' | 'Standard'
}

export interface CompletenessReport {
  overallScore: number // 0 - 100%
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

export function assessPatientCompleteness(patient: Patient, latestVisit: Visit | null): CompletenessReport {
  const fields: FieldAuditItem[] = []

  // 1. Demographics
  fields.push({
    key: 'name',
    label: 'Full Name',
    category: 'Demographics',
    isComplete: Boolean(patient.firstName?.trim() && patient.firstName !== 'Unknown'),
    value: `${patient.firstName || ''} ${patient.lastName || ''}`.trim(),
    importance: 'Critical',
  })
  fields.push({
    key: 'age_dob',
    label: 'Date of Birth / Age',
    category: 'Demographics',
    isComplete: Boolean(patient.dob || patient.age),
    value: patient.dob || (patient.age ? `${patient.age} yrs` : null),
    importance: 'Critical',
  })
  fields.push({
    key: 'sex',
    label: 'Sex / Gender',
    category: 'Demographics',
    isComplete: Boolean(patient.sex),
    value: patient.sex,
    importance: 'Critical',
  })
  fields.push({
    key: 'contact',
    label: 'Phone / Contact',
    category: 'Demographics',
    isComplete: Boolean(patient.contact?.trim()),
    value: patient.contact,
    importance: 'Important',
  })
  fields.push({
    key: 'consent',
    label: 'Consent Status',
    category: 'Demographics',
    isComplete: Boolean(patient.consentStatus === 'Granted'),
    value: patient.consentStatus,
    importance: 'Critical',
  })
  fields.push({
    key: 'registry',
    label: 'Registry Track',
    category: 'Demographics',
    isComplete: Boolean(patient.registryId),
    value: patient.registryId,
    importance: 'Important',
  })

  // 2. Vitals & Anthropometrics
  const bpComplete = Boolean(
    (latestVisit?.bpSystolic && latestVisit?.bpDiastolic) ||
    (latestVisit?.bpSystolic)
  )
  fields.push({
    key: 'bp',
    label: 'Blood Pressure',
    category: 'Vitals',
    isComplete: bpComplete,
    value: latestVisit?.bpSystolic ? `${latestVisit.bpSystolic}/${latestVisit.bpDiastolic || '—'}` : null,
    importance: 'Critical',
  })
  fields.push({
    key: 'heartRate',
    label: 'Heart Rate',
    category: 'Vitals',
    isComplete: Boolean(latestVisit?.heartRate),
    value: latestVisit?.heartRate ? `${latestVisit.heartRate} bpm` : null,
    importance: 'Important',
  })
  fields.push({
    key: 'weight',
    label: 'Body Weight',
    category: 'Vitals',
    isComplete: Boolean(latestVisit?.weight),
    value: latestVisit?.weight ? `${latestVisit.weight} kg` : null,
    importance: 'Important',
  })

  // 3. Phenotype & Clinical Status
  fields.push({
    key: 'hfType',
    label: 'HF Phenotype (HFrEF/HFpEF)',
    category: 'Phenotype',
    isComplete: Boolean(latestVisit?.hfType || patient.hfType),
    value: latestVisit?.hfType || patient.hfType,
    importance: 'Critical',
  })
  fields.push({
    key: 'nyha',
    label: 'NYHA Functional Class',
    category: 'Phenotype',
    isComplete: Boolean(latestVisit?.nyha || patient.nyha),
    value: latestVisit?.nyha || patient.nyha,
    importance: 'Critical',
  })
  fields.push({
    key: 'sixMWT',
    label: '6-Minute Walk Test (6MWT)',
    category: 'Phenotype',
    isComplete: Boolean(latestVisit?.sixMWT),
    value: latestVisit?.sixMWT ? `${latestVisit.sixMWT} m` : null,
    importance: 'Standard',
  })

  // 4. Echocardiography
  fields.push({
    key: 'lvef',
    label: 'LVEF (%)',
    category: 'Echo',
    isComplete: Boolean(latestVisit?.lvef != null || patient.lvef != null),
    value: latestVisit?.lvef ?? patient.lvef,
    importance: 'Critical',
  })
  fields.push({
    key: 'ecg_rhythm',
    label: 'ECG / Conduction (BBB)',
    category: 'Echo',
    isComplete: Boolean(latestVisit?.bbb || latestVisit?.rhythm),
    value: latestVisit?.bbb || latestVisit?.rhythm,
    importance: 'Important',
  })

  // 5. Labs & Renal Function
  const hasCreatinineOrEgfr = Boolean(
    latestVisit?.creatinine != null || latestVisit?.egfr != null
  )
  fields.push({
    key: 'creatinine_egfr',
    label: 'Serum Creatinine & eGFR',
    category: 'Labs',
    isComplete: hasCreatinineOrEgfr,
    value: latestVisit?.egfr ? `eGFR: ${latestVisit.egfr} ml/min` : (latestVisit?.creatinine ? `Cr: ${latestVisit.creatinine} mg/dL` : null),
    importance: 'Critical',
  })
  fields.push({
    key: 'potassium',
    label: 'Serum Potassium (K+)',
    category: 'Labs',
    isComplete: Boolean(latestVisit?.potassium != null),
    value: latestVisit?.potassium ? `${latestVisit.potassium} mmol/L` : null,
    importance: 'Critical',
  })
  fields.push({
    key: 'ntProBNP',
    label: 'NT-proBNP / BNP',
    category: 'Labs',
    isComplete: Boolean(latestVisit?.ntProBNP != null || latestVisit?.bnp != null),
    value: latestVisit?.ntProBNP ? `${latestVisit.ntProBNP} pg/mL` : null,
    importance: 'Important',
  })
  fields.push({
    key: 'hemoglobin',
    label: 'Hemoglobin (Hb)',
    category: 'Labs',
    isComplete: Boolean(latestVisit?.hb != null),
    value: latestVisit?.hb ? `${latestVisit.hb} g/dL` : null,
    importance: 'Important',
  })

  // 6. Medications (GDMT 4 Pillars)
  const isMedComplete = (med: any) => med?.prescribed === 'Yes' || med?.prescribed === 'No'
  fields.push({
    key: 'raasi',
    label: 'RAASi / ARNI Status',
    category: 'Medications',
    isComplete: isMedComplete(latestVisit?.raasi),
    value: latestVisit?.raasi?.type || latestVisit?.raasi?.prescribed,
    importance: 'Critical',
  })
  fields.push({
    key: 'betaBlocker',
    label: 'Beta-Blocker Status',
    category: 'Medications',
    isComplete: isMedComplete(latestVisit?.betaBlocker),
    value: latestVisit?.betaBlocker?.type || latestVisit?.betaBlocker?.prescribed,
    importance: 'Critical',
  })
  fields.push({
    key: 'mra',
    label: 'MRA Status',
    category: 'Medications',
    isComplete: isMedComplete(latestVisit?.mra),
    value: latestVisit?.mra?.type || latestVisit?.mra?.prescribed,
    importance: 'Critical',
  })
  fields.push({
    key: 'sglt2i',
    label: 'SGLT2i Status',
    category: 'Medications',
    isComplete: isMedComplete(latestVisit?.sglt2i),
    value: latestVisit?.sglt2i?.type || latestVisit?.sglt2i?.prescribed,
    importance: 'Critical',
  })

  // Weights: Critical = 3, Important = 2, Standard = 1
  let totalWeight = 0
  let earnedWeight = 0

  fields.forEach(f => {
    const w = f.importance === 'Critical' ? 3 : f.importance === 'Important' ? 2 : 1
    totalWeight += w
    if (f.isComplete) earnedWeight += w
  })

  const overallScore = totalWeight > 0 ? Math.round((earnedWeight / totalWeight) * 100) : 0

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

  // Categories Breakdown
  const categoryNames: ('Demographics' | 'Vitals' | 'Phenotype' | 'Echo' | 'Labs' | 'Medications')[] = [
    'Demographics', 'Vitals', 'Phenotype', 'Echo', 'Labs', 'Medications'
  ]

  const categories = categoryNames.map(name => {
    const catFields = fields.filter(f => f.category === name)
    const completed = catFields.filter(f => f.isComplete).length
    const total = catFields.length
    const score = total > 0 ? Math.round((completed / total) * 100) : 0
    return { name, score, completed, total }
  })

  const missingCritical = fields.filter(f => !f.isComplete && f.importance === 'Critical')
  const missingImportant = fields.filter(f => !f.isComplete && f.importance === 'Important')

  return {
    overallScore,
    grade,
    color,
    totalFields: fields.length,
    completedFields: fields.filter(f => f.isComplete).length,
    missingCritical,
    missingImportant,
    categories,
    allFields: fields,
  }
}
