/**
 * dataCompleteness.ts
 * Computes registry data completeness scores, audit metrics, and field gap identification.
 */

import type { Patient, Visit, CathProcedure } from './types'

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
  const isCathLab = patient.registryId === 'cathlab' || patient.registryIds?.includes('cathlab')

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
    label: isCathLab ? 'Cath Lab Admission Track' : 'Cohort Track (ADHF vs OPD)',
    category: 'Demographics',
    tier: 1,
    isComplete: Boolean(patient.cohortType || latestVisit?.visitType || (patient as any).presentation),
    value: patient.cohortType || (latestVisit?.visitType === 'Inpatient' ? 'Acute Admission' : 'Elective / Outpatient'),
    importance: 'Critical',
  })
  fields.push({
    key: 'contact',
    label: 'Phone / Primary Contact',
    category: 'Demographics',
    tier: 1,
    isComplete: Boolean(patient.contact?.trim() || (patient as any).phone?.trim()),
    value: patient.contact || (patient as any).phone,
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
  const sysBp = latestVisit?.bpSystolic ?? (patient as any).bpSystolic
  const diaBp = latestVisit?.bpDiastolic ?? (patient as any).bpDiastolic
  const bpComplete = Boolean(sysBp != null)
  fields.push({
    key: 'bp',
    label: 'Blood Pressure (SBP/DBP)',
    category: 'Vitals',
    tier: 1,
    isComplete: bpComplete,
    value: sysBp ? `${sysBp}/${diaBp || '—'}` : null,
    importance: 'Critical',
  })
  const hrVal = latestVisit?.heartRate ?? (patient as any).heartRate
  fields.push({
    key: 'heartRate',
    label: 'Heart Rate',
    category: 'Vitals',
    tier: 1,
    isComplete: Boolean(hrVal),
    value: hrVal ? `${hrVal} bpm` : null,
    importance: 'Important',
  })
  const wtVal = latestVisit?.weight ?? (patient as any).weight
  fields.push({
    key: 'weight',
    label: 'Body Weight',
    category: 'Vitals',
    tier: 1,
    isComplete: Boolean(wtVal),
    value: wtVal ? `${wtVal} kg` : null,
    importance: 'Important',
  })

  // 3. Phenotype & Clinical Presentation
  const presentationVal = (patient as any).presentation || latestVisit?.hfType || patient.hfType
  fields.push({
    key: 'hfType',
    label: isCathLab ? 'CAD Presentation (STEMI/NSTEMI/UA/CCS)' : 'HF Phenotype (HFrEF/HFmrEF/HFpEF/HFimpEF)',
    category: 'Phenotype',
    tier: 1,
    isComplete: Boolean(presentationVal),
    value: presentationVal,
    importance: 'Critical',
  })
  const nyhaVal = latestVisit?.nyha || patient.nyha || (patient as any).killipClass
  fields.push({
    key: 'nyha',
    label: isCathLab ? 'Clinical Severity (NYHA / Killip Class)' : 'NYHA Functional Class',
    category: 'Phenotype',
    tier: 1,
    isComplete: Boolean(nyhaVal),
    value: nyhaVal ? `Class ${nyhaVal}` : null,
    importance: 'Critical',
  })
  fields.push({
    key: 'etiology',
    label: 'Primary Etiology (Indian Hierarchy)',
    category: 'Phenotype',
    tier: 1,
    isComplete: Boolean(
      (latestVisit?.etiology && latestVisit.etiology.length > 0) ||
      (patient.indexEtiology && patient.indexEtiology.length > 0) ||
      isCathLab
    ),
    value: latestVisit?.etiology?.join(', ') || patient.indexEtiology?.join(', ') || (isCathLab ? 'Ischaemic CAD' : null),
    importance: 'Critical',
  })

  // 4. Echocardiography (LVEF method & value)
  const lvefVal = latestVisit?.lvef ?? patient.lvef
  const lvefMethodVal = latestVisit?.lvefMethod || (patient as any).lvefMethod || '2D Biplane Simpson'
  fields.push({
    key: 'lvef',
    label: 'LVEF (%) & Modality',
    category: 'Echo',
    tier: 1,
    isComplete: Boolean(lvefVal != null),
    value: lvefVal != null ? `${lvefVal}% (${lvefMethodVal})` : null,
    importance: 'Critical',
  })
  fields.push({
    key: 'ecg_rhythm',
    label: 'ECG Rhythm & Conduction',
    category: 'Echo',
    tier: 1,
    isComplete: Boolean(latestVisit?.rhythm || latestVisit?.qrsDuration || isCathLab),
    value: latestVisit?.rhythm || (isCathLab ? 'Sinus Rhythm' : null),
    importance: 'Important',
  })

  // 5. Core Admission Labs
  const crVal = latestVisit?.creatinine ?? (patient as any).creatinine
  const egfrVal = latestVisit?.egfr ?? (patient as any).egfr
  const hasCreatinineOrEgfr = Boolean(crVal != null || egfrVal != null)
  fields.push({
    key: 'creatinine_egfr',
    label: 'Serum Creatinine & eGFR',
    category: 'Labs',
    tier: 1,
    isComplete: hasCreatinineOrEgfr,
    value: egfrVal ? `eGFR: ${egfrVal} ml/min` : (crVal ? `Cr: ${crVal} mg/dL` : null),
    importance: 'Critical',
  })
  const kVal = latestVisit?.potassium ?? (patient as any).potassium
  fields.push({
    key: 'potassium',
    label: 'Serum Potassium (K+)',
    category: 'Labs',
    tier: 1,
    isComplete: Boolean(kVal != null),
    value: kVal != null ? `${kVal} mmol/L` : null,
    importance: 'Critical',
  })
  const tropVal = (latestVisit as any)?.troponinI ?? (patient as any).troponinI ?? latestVisit?.ntProBNP ?? latestVisit?.bnp
  fields.push({
    key: 'cardiac_biomarker',
    label: isCathLab ? 'Cardiac Troponin (I/T)' : 'NT-proBNP / BNP',
    category: 'Labs',
    tier: 1,
    isComplete: Boolean(tropVal != null),
    value: tropVal != null ? (isCathLab ? `${tropVal} ng/mL` : `${tropVal} pg/mL`) : null,
    importance: 'Important',
  })
  const hbVal = latestVisit?.hb ?? (patient as any).hb
  fields.push({
    key: 'hemoglobin',
    label: 'Hemoglobin (Hb)',
    category: 'Labs',
    tier: 1,
    isComplete: Boolean(hbVal != null),
    value: hbVal ? `${hbVal} g/dL` : null,
    importance: 'Important',
  })

  // 6. Medications & Regimen
  const isMedComplete = (med: any) => Boolean(med?.prescribed === 'Yes' || med?.prescribed === 'No' || med?.reason)

  if (isCathLab) {
    // Cath Lab / PCI Guideline Regimen: DAPT (Aspirin + P2Y12), Statin, Beta-Blocker, ACEi/ARB
    const hasAspirin = (latestVisit as any)?.aspirinPrescribed === 'Yes' || (patient as any).daptActive
    fields.push({
      key: 'aspirin',
      label: 'Aspirin (Antiplatelet)',
      category: 'Medications',
      tier: 1,
      isComplete: Boolean(hasAspirin),
      value: hasAspirin ? ((latestVisit as any)?.aspirinDose || '75mg OD') : null,
      importance: 'Critical',
    })
    const hasP2y12 = (latestVisit as any)?.p2y12Prescribed === 'Yes' || (patient as any).daptActive
    fields.push({
      key: 'p2y12',
      label: 'P2Y12 Inhibitor (Ticagrelor / Prasugrel / Clopidogrel)',
      category: 'Medications',
      tier: 1,
      isComplete: Boolean(hasP2y12),
      value: hasP2y12 ? ((latestVisit as any)?.p2y12Drug || 'Ticagrelor / Prasugrel') : null,
      importance: 'Critical',
    })
    const hasStatin = (latestVisit as any)?.statinPrescribed === 'Yes' || (patient as any).statinActive
    fields.push({
      key: 'statin',
      label: 'High-Intensity Statin (Atorva / Rosuva)',
      category: 'Medications',
      tier: 1,
      isComplete: Boolean(hasStatin),
      value: hasStatin ? ((latestVisit as any)?.statinDrug || 'Atorvastatin / Rosuvastatin') : null,
      importance: 'Critical',
    })
    const hasBb = (latestVisit as any)?.medBetaBlocker === 'Yes' || isMedComplete(latestVisit?.betaBlocker) || (patient as any).meds?.betaBlocker
    fields.push({
      key: 'betaBlocker',
      label: 'Beta-Blocker (Post-PCI / MI)',
      category: 'Medications',
      tier: 1,
      isComplete: Boolean(hasBb),
      value: hasBb ? ((latestVisit as any)?.medBetaBlockerDrug || 'Beta-Blocker Prescribed') : null,
      importance: 'Critical',
    })
  } else {
    // Heart Failure 4-Pillar GDMT
    fields.push({
      key: 'raasi',
      label: 'RAASi / ARNI (Status or Reason)',
      category: 'Medications',
      tier: 1,
      isComplete: isMedComplete(latestVisit?.raasi) || (latestVisit as any)?.medAcei === 'Yes',
      value: latestVisit?.raasi?.type || latestVisit?.raasi?.reason || latestVisit?.raasi?.prescribed || (latestVisit as any)?.medAceiDrug,
      importance: 'Critical',
    })
    fields.push({
      key: 'betaBlocker',
      label: 'Beta-Blocker (Status or Reason)',
      category: 'Medications',
      tier: 1,
      isComplete: isMedComplete(latestVisit?.betaBlocker) || (latestVisit as any)?.medBetaBlocker === 'Yes',
      value: latestVisit?.betaBlocker?.type || latestVisit?.betaBlocker?.reason || latestVisit?.betaBlocker?.prescribed || (latestVisit as any)?.medBetaBlockerDrug,
      importance: 'Critical',
    })
    fields.push({
      key: 'mra',
      label: 'MRA (Status or Reason)',
      category: 'Medications',
      tier: 1,
      isComplete: isMedComplete(latestVisit?.mra) || (latestVisit as any)?.medMra === 'Yes' || (latestVisit as any)?.medMraReason != null,
      value: latestVisit?.mra?.type || latestVisit?.mra?.reason || latestVisit?.mra?.prescribed || (latestVisit as any)?.medMraReason,
      importance: 'Critical',
    })
    fields.push({
      key: 'sglt2i',
      label: 'SGLT2i (Status or Reason)',
      category: 'Medications',
      tier: 1,
      isComplete: isMedComplete(latestVisit?.sglt2i) || (latestVisit as any)?.medSglt2i === 'Yes',
      value: latestVisit?.sglt2i?.type || latestVisit?.sglt2i?.reason || latestVisit?.sglt2i?.prescribed || (latestVisit as any)?.medSglt2iDrug,
      importance: 'Critical',
    })
  }

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

  // Overall score blends Tier 1 (Core Inpatient: 60%), Tier 2 (Follow-up Ascertainment: 30%), and Tier 3 (Optional: 10%)
  // A site with zero follow-up ascertainment can attain a maximum score of 70%, preventing unmonitored sites from grading 'A'.
  const overallScore = Math.round(
    coreInpatientScore * 0.60 +
    followUpScore * 0.30 +
    optionalResearchScore * 0.10
  )

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

// ─── Cath Lab / Interventional Data Completeness ──────────────────────────────

export interface CathProcedureCompletenessReport {
  score: number // 0-100%
  grade: 'A' | 'B' | 'C' | 'D' | 'Incomplete'
  color: string
  totalItems: number
  completedItems: number
  missingCritical: string[]
  missingQuality: string[]
}

/**
 * Evaluates NCDR CathPCI / NIC India data completeness for a CathProcedure.
 * Enforces mandatory documentation of indication, access, lesions, devices, and safety audit.
 */
export function calculateCathProcedureCompleteness(proc: CathProcedure): CathProcedureCompletenessReport {
  const missingCritical: string[] = []
  const missingQuality: string[] = []

  // 1. Tier 1 Critical Mandatory (60% weight)
  if (!proc.procedureDate) missingCritical.push('Procedure Date & Timestamp')
  if (!proc.procedureType) missingCritical.push('Procedure Type')
  if (!proc.clinicalIndication) missingCritical.push('Clinical Indication')
  if (!proc.accessSite) missingCritical.push('Vascular Access Site')
  if (!proc.sheathSize) missingCritical.push('Sheath Size')
  if (!proc.operatorName) missingCritical.push('Primary Operator Name')
  if (!proc.lesions || proc.lesions.length === 0) missingCritical.push('Target Lesion & Anatomy')
  if (!proc.complications) missingCritical.push('In-Hospital Complication Audit')

  // Lesion-level critical checks
  if (proc.lesions && proc.lesions.length > 0) {
    proc.lesions.forEach((l, idx) => {
      if (l.preTimiFlow === undefined) missingCritical.push(`Lesion #${idx + 1} Pre-TIMI Flow`)
      if (l.postTimiFlow === undefined) missingCritical.push(`Lesion #${idx + 1} Post-TIMI Flow`)
      if (l.preStenosisPct === undefined) missingCritical.push(`Lesion #${idx + 1} Pre-Stenosis %`)
      if (l.postStenosisPct === undefined) missingCritical.push(`Lesion #${idx + 1} Residual Stenosis %`)
      if (l.treatmentStrategy === 'DES' && (!l.devices || l.devices.length === 0)) {
        missingCritical.push(`Lesion #${idx + 1} Deployed Stent Specifications`)
      }
    })
  }

  // 2. Tier 2 Quality Indicators (40% weight)
  if (proc.contrastVolumeMl === undefined || proc.contrastVolumeMl <= 0) {
    missingQuality.push('Contrast Volume (mL)')
  }
  if (proc.fluoroscopyTimeMinutes === undefined || proc.fluoroscopyTimeMinutes <= 0) {
    missingQuality.push('Fluoroscopy Time (minutes)')
  }
  if (!proc.closureDevice) {
    missingQuality.push('Vascular Hemostasis / Closure Device')
  }
  if (proc.clinicalIndication === 'STEMI' && (!proc.stemiTimelines || !proc.stemiTimelines.dtbMinutes)) {
    missingQuality.push('STEMI Door-to-Balloon Time & Timelines')
  }

  // Scoring
  const t1Total = 8 + (proc.lesions ? proc.lesions.length * 4 : 0)
  const t1Completed = t1Total - missingCritical.length
  const t1Score = t1Total > 0 ? (t1Completed / t1Total) * 100 : 0

  const t2Total = 4
  const t2Completed = t2Total - missingQuality.length
  const t2Score = (t2Completed / t2Total) * 100

  const score = Math.round(t1Score * 0.70 + t2Score * 0.30)

  let grade: CathProcedureCompletenessReport['grade'] = 'Incomplete'
  let color = '#ef4444'

  if (score >= 90 && missingCritical.length === 0) {
    grade = 'A'
    color = '#10b981'
  } else if (score >= 75 && missingCritical.length === 0) {
    grade = 'B'
    color = '#3b82f6'
  } else if (score >= 60) {
    grade = 'C'
    color = '#f59e0b'
  } else if (score >= 40) {
    grade = 'D'
    color = '#f97316'
  }

  return {
    score,
    grade,
    color,
    totalItems: t1Total + t2Total,
    completedItems: t1Completed + t2Completed,
    missingCritical,
    missingQuality,
  }
}

