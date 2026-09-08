/**
 * clinicalIntelligence.ts
 *
 * Rule-based clinical intelligence engine.
 * Runs entirely in the browser — zero cloud cost, zero latency.
 * Encodes ESC 2023 HF Guidelines, AHA/ACC 2022.
 *
 * Architecture: Phase 1 = pure rules (today).
 *               Phase 2 = rules + TF.js model (when n > 200 patients).
 *               Phase 3 = rules + trained model + LLM copilot.
 */

import type { Patient, Visit } from './types'
import { calculateMAGGIC } from './riskScores'
import rfModel from '../scratch/heart_failure_rf.json'


// ─── Alert severity ───────────────────────────────────────────────────────────

export type AlertSeverity = 'critical' | 'high' | 'medium' | 'info'

export interface ClinicalAlert {
  id: string
  severity: AlertSeverity
  category: 'Safety' | 'GDMT' | 'Device' | 'Monitoring' | 'QoL' | 'Outcome'
  title: string
  detail: string
  action: string
  evidence?: string  // guideline class + level e.g. "Class I-A"
  guidelineVersion?: string // guideline reference and release version e.g. "ESC 2023 Heart Failure Guidelines"
  recordedDate?: string
  measuredValue?: string
  checklist?: string[]
  requiresAcknowledgement?: boolean
  field?: string     // which form field to jump to
}

// ─── GDMT status ─────────────────────────────────────────────────────────────

export type GDMTStatus = 'prescribed' | 'missing' | 'contraindicated' | 'not-indicated' | 'below-target'

export interface GDMTPillar {
  drug: string
  shortName: string
  status: GDMTStatus
  currentDose?: string
  targetDose?: string
  dosePct?: number        // 0–100
  contraindication?: string
  evidence: string        // e.g. "Class I-A, ESC 2023"
  benefit: string         // one-line clinical benefit
}

export interface GDMTSummary {
  pillarsOnTarget: number  // 0–4 (or 5 with vericiguat)
  totalApplicable: number
  optimizationScore: number  // 0–100
  pillars: GDMTPillar[]
  nextBestAction: string
}

// ─── Risk scores ──────────────────────────────────────────────────────────────

export interface CHA2DS2VASCResult {
  score: number
  strokeRiskPctPerYear: number
  recommendation: 'Anticoagulate' | 'Consider anticoagulation' | 'No anticoagulation needed'
  detail: string
}

export interface HASBLEDResult {
  score: number
  bleedingRiskPctPerYear: number
  riskCategory: 'Low' | 'Moderate' | 'High'
  modifiableFactors: string[]
  detail: string
}

// ─── Data completeness ────────────────────────────────────────────────────────

export interface CompletenessReport {
  overallPct: number
  domains: { name: string; pct: number; missing: string[] }[]
  dataGrade: 'A' | 'B' | 'C' | 'D'
}

// ─── ML Risk Profile ─────────────────────────────────────────────────────────
// Phase 1: computed from validated risk scores + rules
// Phase 2: replace with TF.js model output

export interface MLRiskProfile {
  oneYearEventProbability: number   // 0–1
  riskCategory: 'Low' | 'Intermediate' | 'High' | 'Very High'
  primaryDriver: string
  topFactors: { label: string; direction: 'risk' | 'protective'; magnitude: number }[]
  modelSource: 'rules+maggic' | 'tfjs-v1' | 'tfjs-v2'
  confidence: string
  lastUpdated: string
}

// ─────────────────────────────────────────────────────────────────────────────
// CHA₂DS₂-VASc Score (AF patients only)
// Reference: ESC 2023 AF Guidelines, Lip GY et al. Chest. 2010
// ─────────────────────────────────────────────────────────────────────────────

export function calculateCHA2DS2VASc(
  patient: Pick<Patient, 'dob' | 'sex' | 'comorbidities'>,
  visit: Pick<Visit, 'rhythm' | 'bpSystolic' | 'hfType'>
): CHA2DS2VASCResult {
  const age = Math.floor((Date.now() - new Date(patient.dob).getTime()) / (365.25 * 86400000))
  const comorbStr = (patient.comorbidities ?? []).join(' ').toLowerCase()

  let score = 0

  // C — Congestive HF or LVEF < 40%  (1 pt)
  if (visit.hfType === 'HFrEF' || visit.hfType === 'HFmrEF') score += 1

  // H — Hypertension  (1 pt)
  if (comorbStr.includes('htn') || comorbStr.includes('hypertension') ||
      (visit.bpSystolic && visit.bpSystolic > 140)) score += 1

  // A2 — Age ≥ 75  (2 pts)
  if (age >= 75) score += 2
  // A — Age 65–74  (1 pt)
  else if (age >= 65) score += 1

  // D — Diabetes  (1 pt)
  if (comorbStr.includes('dm') || comorbStr.includes('diabetes')) score += 1

  // S2 — Prior stroke/TIA/thromboembolism  (2 pts)
  if (comorbStr.includes('stroke') || comorbStr.includes('tia')) score += 2

  // V — Vascular disease (CAD, PAD, prior MI)  (1 pt)
  if (comorbStr.includes('cad') || comorbStr.includes('pad') ||
      comorbStr.includes('mi') || comorbStr.includes('cabg') ||
      comorbStr.includes('pci')) score += 1

  // S — Sex female  (1 pt — not counted if only risk factor)
  const isFemale = patient.sex === 'Female'
  if (isFemale) score += 1

  // Published annual stroke risk table (Lip 2010, Table 3)
  const strokeRiskTable: Record<number, number> = {
    0: 0.0, 1: 1.3, 2: 2.2, 3: 3.2, 4: 4.0, 5: 6.7, 6: 9.8, 7: 9.6, 8: 12.5, 9: 15.2
  }
  const clampedScore = Math.min(score, 9)
  const strokeRiskPctPerYear = strokeRiskTable[clampedScore] ?? 15.2

  // Adjusted: females score of 1 = same as male 0 (ESC 2023 clarification)
  const effectiveScore = isFemale ? Math.max(0, score - 1) : score

  const recommendation: CHA2DS2VASCResult['recommendation'] =
    effectiveScore >= 2 ? 'Anticoagulate' :
    effectiveScore === 1 ? 'Consider anticoagulation' :
    'No anticoagulation needed'

  const detail =
    effectiveScore >= 2
      ? `Score ${score} (net ${effectiveScore}) — Oral anticoagulation recommended (Class I-A, ESC 2023). Prefer NOAC over VKA.`
      : effectiveScore === 1
      ? `Score ${score} (net ${effectiveScore}) — Consider OAC, weigh stroke vs bleeding risk (Class IIa-B).`
      : `Score ${score} (net ${effectiveScore}) — OAC not recommended (Class III-B). No net clinical benefit.`

  return { score, strokeRiskPctPerYear, recommendation, detail }
}

// ─────────────────────────────────────────────────────────────────────────────
// HAS-BLED Bleeding Risk Score
// Reference: Pisters R et al. Chest. 2010;138(5):1093-100
// ─────────────────────────────────────────────────────────────────────────────

export function calculateHASBLED(
  patient: Pick<Patient, 'dob' | 'comorbidities'>,
  visit: Pick<Visit, 'bpSystolic' | 'egfr' | 'creatinine' | 'sodium'>
): HASBLEDResult {
  const age = Math.floor((Date.now() - new Date(patient.dob).getTime()) / (365.25 * 86400000))
  const comorbStr = (patient.comorbidities ?? []).join(' ').toLowerCase()

  let score = 0
  const modifiableFactors: string[] = []

  // H — Hypertension (uncontrolled SBP > 160)  (1 pt)
  if (visit.bpSystolic && visit.bpSystolic > 160) {
    score += 1
    modifiableFactors.push('Uncontrolled hypertension (SBP > 160 mmHg) — treat to target')
  }

  // A — Abnormal renal or liver function  (1 pt each, max 2)
  const hasRenalImpairment = visit.egfr ? visit.egfr < 30 :
    visit.creatinine ? visit.creatinine > 2.26 : false
  const hasLiverDisease = comorbStr.includes('liver') || comorbStr.includes('cirrhosis') ||
    comorbStr.includes('hepatic')
  if (hasRenalImpairment) {
    score += 1
    modifiableFactors.push('Renal impairment (eGFR < 30) — monitor anticoagulant dose')
  }
  if (hasLiverDisease) score += 1

  // S — Stroke history  (1 pt)
  if (comorbStr.includes('stroke') || comorbStr.includes('tia')) score += 1

  // B — Bleeding history or predisposition  (1 pt)
  if (comorbStr.includes('bleed') || comorbStr.includes('gi bleed') ||
      comorbStr.includes('haemorrhage') || comorbStr.includes('anaemia')) {
    score += 1
  }

  // L — Labile INR (not captured — assign 0 unless VKA noted)
  // (In future: check VKI field + INR data)

  // E — Elderly (age > 65)  (1 pt)
  if (age > 65) score += 1

  // D — Drugs (antiplatelets/NSAIDs) or alcohol  (1 pt each)
  if (comorbStr.includes('alcohol') || comorbStr.includes('etoh')) {
    score += 1
    modifiableFactors.push('Alcohol use — counsel on alcohol cessation')
  }

  const clampedScore = Math.min(score, 9)

  // Published annual major bleed rates (Pisters 2010, Table 4)
  const bleedTable: Record<number, number> = {
    0: 1.13, 1: 1.02, 2: 1.88, 3: 3.74, 4: 8.70, 5: 12.50
  }
  const bleedingRiskPctPerYear = bleedTable[Math.min(clampedScore, 5)] ?? 12.5

  const riskCategory: HASBLEDResult['riskCategory'] =
    clampedScore <= 1 ? 'Low' :
    clampedScore <= 2 ? 'Moderate' : 'High'

  const detail =
    riskCategory === 'High'
      ? `HAS-BLED ${score} — High bleed risk. Do NOT withhold anticoagulation, but address modifiable factors. More frequent review.`
      : riskCategory === 'Moderate'
      ? `HAS-BLED ${score} — Moderate risk. Anticoagulate if CHA₂DS₂-VASc ≥ 2. Monitor closely.`
      : `HAS-BLED ${score} — Low bleed risk. Anticoagulation is safe if clinically indicated.`

  return { score: clampedScore, bleedingRiskPctPerYear, riskCategory, modifiableFactors, detail }
}

// Helper to compute dose achievement percentage
function getDosePct(drugName?: string, doseStr?: string): number | undefined {
  if (!drugName || !doseStr) return undefined
  const d = drugName.toLowerCase()
  const s = doseStr.toLowerCase()

  // ARNI (Sacubitril/Valsartan) — Target 97/103mg (200mg) BD = 400mg/day
  if (d.includes('vymada') || d.includes('cidmus') || d.includes('azmarda') || d.includes('sacubitril') || d.includes('arni')) {
    if (s.includes('200') || s.includes('97/103')) return 100
    if (s.includes('100') || s.includes('49/51'))  return 50
    if (s.includes('50')  || s.includes('24/26'))  return 25
  }
  // ACEi - Ramipril target 10mg OD or 5mg BD
  if (d.includes('ramipril') || d.includes('cardace')) {
    if (s.includes('10')) return 100
    if (s.includes('5'))  return 50
    if (s.includes('2.5')) return 25
  }
  // ARB - Telmisartan target 80mg, Losartan target 150mg
  if (d.includes('telmisartan') || d.includes('telma')) {
    if (s.includes('80')) return 100
    if (s.includes('40')) return 50
    if (s.includes('20')) return 25
  }
  // Beta Blockers
  // Bisoprolol target 10mg OD
  if (d.includes('bisoprolol') || d.includes('concor')) {
    if (s.includes('10')) return 100
    if (s.includes('5'))  return 50
    if (s.includes('2.5')) return 25
    if (s.includes('1.25')) return 12.5
  }
  // Metoprolol Succinate target 200mg OD
  if (d.includes('metoprolol') || d.includes('met-xl') || d.includes('betaloc')) {
    if (s.includes('200')) return 100
    if (s.includes('100')) return 50
    if (s.includes('50'))  return 25
    if (s.includes('25'))  return 12.5
  }
  // Carvedilol target 25mg BD (50mg/day)
  if (d.includes('carvedilol') || d.includes('carca')) {
    if (s.includes('25') && s.includes('bd')) return 100
    if (s.includes('25')) return 50
    if (s.includes('12.5')) return 25
    if (s.includes('6.25') || s.includes('3.125')) return 12.5
  }
  // Nebivolol target 10mg OD
  if (d.includes('nebivolol') || d.includes('nebipil')) {
    if (s.includes('10')) return 100
    if (s.includes('5'))  return 50
    if (s.includes('2.5')) return 25
  }
  // MRA - Spironolactone / Eplerenone target 50mg OD
  if (d.includes('aldactone') || d.includes('spironolactone') || d.includes('eplerenone') || d.includes('eptus')) {
    if (s.includes('50')) return 100
    if (s.includes('25')) return 50
    if (s.includes('12.5')) return 25
  }
  // SGLT2i - Fixed standard target dose (Dapa 10mg OD, Empa 10mg OD)
  if (d.includes('dapa') || d.includes('empa') || d.includes('forxiga') || d.includes('jardiance')) {
    if (s.includes('10') || s.includes('25')) return 100
    if (s.includes('5')) return 50
  }

  return undefined
}

export function evaluateGDMT(patient: Patient, visit: Visit): GDMTSummary {
  const pillars: GDMTPillar[] = []
  const hfType = visit.hfType || patient.hfType
  const isHFrEF = hfType === 'HFrEF'
  const isHFpEF = hfType === 'HFpEF'
  const isHFmrEF = hfType === 'HFmrEF'

  const sbp = visit.bpSystolic
  const hr = visit.heartRate
  const k = visit.potassium
  const egfr = visit.egfr

  // ── 1. RAASi / ARNI ─────────────────────────────────────────────────────────
  const raasi = visit.raasi
  const raasiContra =
    sbp && sbp < 90 ? 'Systolic BP < 90 mmHg' :
    k && k > 5.5 ? 'Potassium > 5.5 mmol/L' :
    egfr && egfr < 30 ? 'eGFR < 30 ml/min/1.73m² (relative caution)' :
    null

  const raasiStatus: GDMTStatus =
    raasiContra ? 'contraindicated' :
    raasi?.prescribed === 'Yes' ?
      ((getDosePct(raasi.type, raasi.dose) ?? 100) < 100 ? 'below-target' : 'prescribed') :
    isHFpEF ? 'not-indicated' :
    'missing'

  pillars.push({
    drug: 'ARNI / ACEi / ARB',
    shortName: raasi?.type || 'Sacubitril/Valsartan preferred',
    status: raasiStatus,
    currentDose: raasi?.dose,
    targetDose: 'Sacubitril/Valsartan 97/103 mg BD (or Ramipril 10 mg OD)',
    dosePct: getDosePct(raasi?.type, raasi?.dose),
    contraindication: raasiContra ?? undefined,
    evidence: isHFrEF ? 'Class I-A, ESC 2023' : isHFmrEF ? 'Class IIb-B, ESC 2023' : 'Class IIb, ESC 2023',
    benefit: 'Reduces all-cause mortality by 20% vs enalapril (PARADIGM-HF)',
  })

  // ── 2. Beta Blocker ────────────────────────────────────────────────────────
  const bb = visit.betaBlocker
  const bbContra =
    hr && hr < 50 ? 'Resting HR < 50 bpm (Bradycardia)' :
    sbp && sbp < 85 ? 'Severe hypotension (SBP < 85 mmHg)' :
    null

  const bbStatus: GDMTStatus =
    bbContra ? 'contraindicated' :
    bb?.prescribed === 'Yes' ?
      ((getDosePct(bb.type, bb.dose) ?? 100) < 100 ? 'below-target' : 'prescribed') :
    isHFpEF ? 'not-indicated' :
    'missing'

  pillars.push({
    drug: 'Beta Blocker',
    shortName: bb?.type || 'Bisoprolol / Metoprolol Succinate / Carvedilol',
    status: bbStatus,
    currentDose: bb?.dose,
    targetDose: 'Bisoprolol 10 mg OD / Metoprolol Succ 200 mg OD / Carvedilol 25 mg BD',
    dosePct: getDosePct(bb?.type, bb?.dose),
    contraindication: bbContra ?? undefined,
    evidence: isHFrEF ? 'Class I-A, ESC 2023' : isHFmrEF ? 'Class IIb-B, ESC 2023' : 'Not indicated (unless AF/CAD)',
    benefit: 'Reduces mortality by 34% in HFrEF (CIBIS-II, MERIT-HF, COPERNICUS)',
  })

  // ── 3. MRA ─────────────────────────────────────────────────────────────────
  const mra = visit.mra
  const mraContra =
    k && k > 5.0 ? 'Potassium > 5.0 mmol/L' :
    egfr && egfr < 30 ? 'eGFR < 30 ml/min/1.73m²' :
    null

  const mraStatus: GDMTStatus =
    mraContra ? 'contraindicated' :
    mra?.prescribed === 'Yes' ?
      ((getDosePct(mra.type, mra.dose) ?? 100) < 100 ? 'below-target' : 'prescribed') :
    isHFpEF ? 'not-indicated' :
    'missing'

  pillars.push({
    drug: 'MRA',
    shortName: mra?.type || 'Spironolactone / Eplerenone',
    status: mraStatus,
    currentDose: mra?.dose,
    targetDose: 'Spironolactone 50 mg OD / Eplerenone 50 mg OD',
    dosePct: getDosePct(mra?.type, mra?.dose),
    contraindication: mraContra ?? undefined,
    evidence: isHFrEF ? 'Class I-A, ESC 2023' : isHFmrEF ? 'Class IIb-B, ESC 2023' : 'Class IIb-B (TOPCAT)',
    benefit: 'Reduces all-cause mortality by 30% in HFrEF (RALES, EMPHASIS-HF)',
  })

  // ── 4. SGLT2i ─────────────────────────────────────────────────────────────
  const sglt2 = visit.sglt2i
  const sglt2Contra = egfr && egfr < 20 ? 'eGFR < 20 ml/min (dapagliflozin/empagliflozin)' : null

  pillars.push({
    drug: 'SGLT2i',
    shortName: sglt2?.type || 'Dapagliflozin / Empagliflozin',
    status: sglt2Contra ? 'contraindicated'
      : sglt2?.prescribed !== 'Yes' ? 'missing'
      : 'prescribed',
    currentDose: sglt2?.dose,
    dosePct: getDosePct(sglt2?.type, sglt2?.dose),
    contraindication: sglt2Contra ?? undefined,
    evidence: isHFpEF ? 'Class I-A, ESC 2023 (EMPEROR-Preserved/DELIVER)' : 'Class I-A, ESC 2023',
    benefit: isHFpEF
      ? 'Reduces CV death and HF hospitalisation in HFpEF/HFmrEF (DELIVER, EMPEROR-Preserved)'
      : 'Reduces CV death + HF hosp by 25% (DAPA-HF, EMPEROR-Reduced)',
  })

  const prescribed = pillars.filter(p => p.status === 'prescribed' || p.status === 'below-target').length
  const applicable = pillars.filter(p => p.status !== 'not-indicated').length
  const missing = pillars.filter(p => p.status === 'missing')
  const belowTarget = pillars.filter(p => p.status === 'below-target')

  const optimizationScore = applicable === 0 ? 100 :
    Math.round((pillars.filter(p => p.status === 'prescribed').length / applicable) * 100)

  const nextBestAction =
    missing.length > 0
      ? `Evaluate eligibility for ${missing[0].drug} initiation (${missing[0].evidence})`
      : belowTarget.length > 0
      ? `Assess clinical tolerance for ${belowTarget[0].drug} uptitration toward guideline target dose`
      : 'Patient receives 4-pillar GDMT — continue surveillance and maintain regimen'

  return { pillarsOnTarget: prescribed, totalApplicable: applicable, optimizationScore, pillars, nextBestAction }
}

// ─────────────────────────────────────────────────────────────────────────────
// Clinical Safety Alert Engine (Non-Directive Clinical Decision Support)
// ─────────────────────────────────────────────────────────────────────────────

export function generateClinicalAlerts(patient: Patient, visit: Visit, allVisits: Visit[]): ClinicalAlert[] {
  const alerts: ClinicalAlert[] = []
  const visitDate = visit.visitDate || 'Latest Visit'

  // ── Contraindication & Biochemical Safety Alerts ──────────────────────────

  const hasRAASi = visit.raasi?.prescribed === 'Yes'
  const hasMRA = visit.mra?.prescribed === 'Yes'
  const k = visit.potassium
  const egfr = visit.egfr
  const sbp = visit.bpSystolic

  // Dual RAASi + MRA when K > 5.0
  if (hasRAASi && hasMRA && k && k > 5.0) {
    alerts.push({
      id: 'raasi-mra-hyperkalemia',
      severity: 'critical',
      category: 'Safety',
      title: 'Clinical Review Required: Hyperkalaemia on RAASi + MRA',
      detail: `Measured K⁺ ${k} mmol/L on ${visitDate}. Patient is prescribed combined ${visit.raasi?.type || 'RAASi'} and ${visit.mra?.type || 'MRA'}.`,
      action: 'Clinical evaluation recommended: Assess for hyperkalemia-induced cardiotoxicity (check 12-lead ECG). Review dietary potassium, salt substitutes, and nephrotoxic co-medications. Consider temporary MRA dose reduction or withholding, potassium binder evaluation, and repeat serum potassium in 24–48 hours.',
      evidence: 'Class I-C, ESC 2023 Guidelines',
      guidelineVersion: 'ESC 2023 Heart Failure Guidelines (Section 5.3) / ACC/AHA 2022',
      recordedDate: visitDate,
      measuredValue: `${k} mmol/L`,
      checklist: [
        'Check 12-lead ECG for peaked T waves / widened QRS / PR prolongation',
        'Review dietary potassium and salt substitutes',
        'Verify no concurrent NSAIDs or potassium-sparing agents',
        'Schedule repeat serum K⁺ and creatinine within 24–48h',
      ],
      requiresAcknowledgement: true,
    })
  }

  // Dual RAASi + MRA in severe CKD
  if (hasRAASi && hasMRA && egfr && egfr < 30) {
    alerts.push({
      id: 'raasi-mra-ckd',
      severity: 'high',
      category: 'Safety',
      title: 'Clinical Review Required: RAASi + MRA in Severe CKD',
      detail: `Recorded eGFR ${egfr} mL/min/1.73m² on ${visitDate} with combined RAASi and MRA therapy.`,
      action: 'Clinical evaluation recommended: Heightened risk for acute kidney injury and progressive hyperkalemia. Consider dose titration, closer cardiorenal surveillance (weekly K+ and creatinine), or nephrology co-consultation.',
      evidence: 'KDIGO 2022 / ESC 2023',
      guidelineVersion: 'KDIGO 2022 Clinical Practice Guideline / ESC 2023 HF Guidelines',
      recordedDate: visitDate,
      measuredValue: `${egfr} mL/min/1.73m²`,
      checklist: [
        'Assess volume status (hypovolemia vs venous congestion)',
        'Check recent serum potassium and creatinine trajectory',
        'Review concomitant nephrotoxic medications',
      ],
      requiresAcknowledgement: true,
    })
  }

  // Hypotension on Vasodilators
  if (hasRAASi && sbp && sbp < 90) {
    alerts.push({
      id: 'raasi-hypotension',
      severity: 'high',
      category: 'Safety',
      title: 'Clinical Review Required: Symptomatic Hypotension / SBP <90 mmHg',
      detail: `Recorded SBP ${sbp} mmHg on ${visitDate} in patient receiving ${visit.raasi?.type || 'RAASi'}.`,
      action: 'Clinical evaluation recommended: Differentiate asymptomatic low BP from symptomatic hypoperfusion. Assess volume status (over-diuresis vs cardiogenic failure). Consider staggering antihypertensive dosing or adjusting diuretic dose before reducing core GDMT.',
      evidence: 'ESC 2023 HF Safety',
      guidelineVersion: 'ESC 2023 Heart Failure Guidelines (Section 5.2)',
      recordedDate: visitDate,
      measuredValue: `${sbp} mmHg`,
      checklist: [
        'Assess for postural dizziness or syncope',
        'Evaluate clinical volume status (JVP, peripheral edema)',
        'Check serum creatinine & BUN for hypovolemia-induced prerenal azotemia',
      ],
      requiresAcknowledgement: true,
    })
  }

  // Hyperkalemia > 5.5
  if (k && k > 5.5 && !(hasRAASi && hasMRA)) {
    alerts.push({
      id: 'k-high',
      severity: 'critical',
      category: 'Safety',
      title: 'Clinical Review Required: Hyperkalaemia (K⁺ >5.5 mmol/L)',
      detail: `Measured K⁺ ${k} mmol/L on ${visitDate}. Elevated arrhythmogenic risk.`,
      action: 'Clinical evaluation recommended: Obtain 12-lead ECG. Re-evaluate dietary intake and potassium-sparing medications. Recheck serum potassium within 24–48 hours.',
      evidence: 'ESC 2023 HF Safety',
      guidelineVersion: 'ESC 2023 Guidelines on Acute and Chronic Heart Failure',
      recordedDate: visitDate,
      measuredValue: `${k} mmol/L`,
      checklist: [
        'Obtain 12-lead ECG to rule out cardiotoxicity',
        'Review RAASi/MRA dosing and potassium supplements',
        'Repeat potassium and creatinine within 24–48h',
      ],
      requiresAcknowledgement: true,
    })
  }

  // Hypokalemia < 3.5
  if (k && k < 3.5) {
    alerts.push({
      id: 'k-low',
      severity: 'high',
      category: 'Safety',
      title: 'Clinical Review Required: Hypokalaemia (K⁺ <3.5 mmol/L)',
      detail: `Measured K⁺ ${k} mmol/L on ${visitDate}. Increased susceptibility to life-threatening ventricular arrhythmias, especially in patients receiving digitalis or with myocardial scar.`,
      action: 'Clinical evaluation recommended: Assess dietary intake and diuretic dosing. Consider potassium supplementation (target K⁺ 4.0–5.0 mmol/L) and MRA optimization. Check serum magnesium.',
      evidence: 'ESC 2023 / ACC/AHA 2022',
      guidelineVersion: 'ESC 2023 Heart Failure Guidelines / ACC/AHA 2022',
      recordedDate: visitDate,
      measuredValue: `${k} mmol/L`,
      checklist: [
        'Check serum Magnesium level',
        'Review loop/thiazide diuretic dose',
        'Target serum K⁺ between 4.0–5.0 mmol/L',
      ],
      requiresAcknowledgement: true,
    })
  }

  // Severe Renal Impairment eGFR < 20
  if (egfr && egfr < 20) {
    alerts.push({
      id: 'egfr-critical',
      severity: 'critical',
      category: 'Safety',
      title: 'Clinical Review Required: Severe Renal Impairment (eGFR <20 mL/min)',
      detail: `Measured eGFR ${egfr} mL/min/1.73m² on ${visitDate}.`,
      action: 'Clinical evaluation recommended: Review renally cleared medications (e.g., Digoxin, SGLT2i, direct oral anticoagulants). Evaluate MRA/RAASi safety and consider nephrology co-management.',
      evidence: 'KDIGO 2022 / ESC 2023',
      guidelineVersion: 'KDIGO 2022 Clinical Practice Guideline for CKD',
      recordedDate: visitDate,
      measuredValue: `${egfr} mL/min/1.73m²`,
      checklist: [
        'Evaluate renally excreted medications for dose adjustment',
        'Review SGLT2i initiation threshold (contraindicated if eGFR <20 mL/min)',
        'Check for acute decompensation or prerenal azotemia',
      ],
      requiresAcknowledgement: true,
    })
  }

  // Hyponatremia < 130
  if (visit.sodium && visit.sodium < 130) {
    alerts.push({
      id: 'na-low',
      severity: 'high',
      category: 'Safety',
      title: 'Clinical Review Required: Severe Hyponatraemia (Na⁺ <130 mmol/L)',
      detail: `Measured Na⁺ ${visit.sodium} mmol/L on ${visitDate}. Marker of neurohormonal activation and advanced disease.`,
      action: 'Clinical evaluation recommended: Assess volume status (hypovolemic vs hypervolemic/dilutional). Review fluid intake, diuretic regimen, and thiazide usage.',
      evidence: 'ESC 2023 HF Guidelines',
      guidelineVersion: 'ESC 2023 Guidelines on Acute and Chronic Heart Failure',
      recordedDate: visitDate,
      measuredValue: `${visit.sodium} mmol/L`,
      checklist: [
        'Assess clinical volume status (euvolemic vs hypervolemic vs hypovolemic)',
        'Consider fluid restriction if dilutional hyponatremia',
        'Review thiazide and loop diuretic dosing',
      ],
    })
  }

  // Bradycardia HR < 50 in Sinus
  if (visit.heartRate && visit.heartRate < 50 && (visit.rhythm === 'Sinus' || !visit.rhythm)) {
    alerts.push({
      id: 'hr-low',
      severity: 'high',
      category: 'Safety',
      title: 'Clinical Review Required: Significant Bradycardia (HR <50 bpm)',
      detail: `Heart rate ${visit.heartRate} bpm recorded on ${visitDate} in sinus rhythm.`,
      action: 'Clinical evaluation recommended: Assess for symptoms (fatigue, presyncope, chronotropic incompetence). Review negative chronotropic agents (beta-blockers, ivabradine, digoxin, non-dihydropyridine CCBs). Obtain 12-lead ECG.',
      evidence: 'ESC 2021 Pacing / ESC 2023 HF',
      guidelineVersion: 'ESC 2021 Guidelines on Cardiac Pacing and Cardiac Resynchronization Therapy',
      recordedDate: visitDate,
      measuredValue: `${visit.heartRate} bpm`,
      checklist: [
        'Obtain 12-lead ECG to evaluate for conduction disease (AV block / sinus pause)',
        'Review beta-blocker, ivabradine, and antiarrhythmic dosing',
        'Assess for symptomatic chronotropic incompetence',
      ],
    })
  }

  // Prolonged QTc Interval > 500 ms (Note: Digoxin shortens QT, does NOT prolong QT)
  if (visit.qtcInterval && visit.qtcInterval > 500) {
    alerts.push({
      id: 'qtc-long',
      severity: 'critical',
      category: 'Safety',
      title: 'Clinical Review Required: Prolonged QTc Interval (>500 ms)',
      detail: `Measured QTc ${visit.qtcInterval} ms on ${visitDate}. Heightened risk for Torsades de Pointes. Note: Digoxin is not a QT-prolonging agent (it typically shortens QT).`,
      action: 'Clinical evaluation recommended: Review QT-prolonging pharmacotherapy (e.g., Amiodarone, Sotalol, Macrolides, Fluoroquinolones, Psychotropics). Check and correct serum potassium (target ≥4.0 mmol/L) and magnesium (target ≥2.0 mg/dL). Obtain 12-lead ECG and electrophysiology consultation if persistent.',
      evidence: 'AHA/ACC/HRS Guideline on Drug-Induced Arrhythmias',
      guidelineVersion: 'AHA/ACC/HRS 2023 Guidelines for Management of Ventricular Arrhythmias',
      recordedDate: visitDate,
      measuredValue: `${visit.qtcInterval} ms`,
      checklist: [
        'Screen all concurrent medications against QT prolongation registries (CredibleMeds)',
        'Ensure serum K⁺ ≥ 4.0 mmol/L and serum Mg²⁺ ≥ 2.0 mg/dL',
        'Confirm manual measurement on 12-lead ECG (lead II / V5)',
      ],
      requiresAcknowledgement: true,
    })
  }

  // ── Device Assessment Alerts (Non-Directive Evaluation Candidate) ─────────

  const lvef = visit.lvef ?? patient.lvef
  const qrs = visit.qrsDuration
  const hasBBB = visit.bbb

  if (lvef && lvef <= 35 && !(visit.device ?? []).includes('ICD') && !(visit.device ?? []).includes('CRT-D')) {
    const prevVisitWithLowEF = allVisits.filter(v => v.id !== visit.id && v.lvef && v.lvef <= 35)
    if (prevVisitWithLowEF.length >= 1) {
      alerts.push({
        id: 'icd-assessment',
        severity: 'high',
        category: 'Device',
        title: 'Device Evaluation: Possible Referral for ICD Eligibility Assessment',
        detail: `Persistent LVEF ${lvef}% (≤35%) documented across sequential encounters (${visitDate}).`,
        action: 'Clinical evaluation recommended: Evaluate candidate for primary prevention ICD assessment. Criteria include: (1) ≥3 months optimal GDMT, (2) NYHA Class II–III symptoms, (3) Expected survival with good functional status >1 year, (4) >40 days post-acute MI and >90 days post-revascularization if ischemic etiology.',
        evidence: 'Class I-A (Ischemic) / Class I-B (Non-ischemic), ESC 2023',
        guidelineVersion: 'ESC 2021/2023 Guidelines on Cardiac Pacing and Resynchronization / ACC/AHA 2022',
        recordedDate: visitDate,
        measuredValue: `LVEF ${lvef}%`,
        checklist: [
          'Confirmed on ≥3 months of optimized guideline-directed medical therapy',
          'NYHA Class II–III symptoms documented',
          'Ischemic etiology: >40 days post-MI and >90 days post-CABG/PCI',
          'Expected survival with good functional capacity >1 year',
          'Shared decision-making and patient preference confirmed',
        ],
      })
    }
  }

  const hasLBBB = hasBBB === 'LBBB'
  const qrsDur = qrs || visit.qrsDuration
  const meetsCRTThreshold = (lvef != null && lvef <= 35) && (hasLBBB || (qrsDur != null && qrsDur >= 130))

  if (meetsCRTThreshold && !(visit.device ?? []).includes('CRT-D') && !(visit.device ?? []).includes('CRT-P')) {
    alerts.push({
      id: 'crt-assessment',
      severity: 'high',
      category: 'Device',
      title: 'Device Evaluation: Possible Referral for CRT Eligibility Assessment',
      detail: `LVEF ${lvef}%, ${hasLBBB ? 'LBBB morphology' : 'Non-LBBB conduction delay'} (QRS ${qrsDur || '—'} ms) documented on ${visitDate}.`,
      action: 'Clinical evaluation recommended: Assess candidate for Cardiac Resynchronization Therapy (CRT-D / CRT-P) referral. Indication strength varies by morphology: LBBB with QRS ≥150ms is Class I-A; LBBB with QRS 130–149ms is Class I-B; Non-LBBB with QRS ≥150ms is Class IIa-B. Requires ≥3 months optimal GDMT and NYHA II–IV status.',
      evidence: hasLBBB && (qrsDur ?? 0) >= 150 ? 'Class I-A, ESC 2023' : 'Class I-B / IIa-B, ESC 2023',
      guidelineVersion: 'ESC 2021 Guidelines on Cardiac Pacing and Cardiac Resynchronization Therapy',
      recordedDate: visitDate,
      measuredValue: `LVEF ${lvef}%, QRS ${qrsDur || '—'} ms, ${hasBBB || 'Unknown morphology'}`,
      checklist: [
        'Evaluate QRS morphology (LBBB vs Non-LBBB) on 12-lead ECG',
        'Verify QRS duration is measured accurately in sinus rhythm',
        'Verify patient has received ≥3 months optimal GDMT',
        'In Atrial Fibrillation: Strategy required to achieve >95% biventricular pacing',
      ],
    })
  }

  // ── Monitoring Alerts ─────────────────────────────────────────────────────

  if (allVisits.length >= 2) {
    const sortedVisits = [...allVisits].sort((a, b) =>
      new Date(b.visitDate).getTime() - new Date(a.visitDate).getTime()
    )
    const lastTwo = sortedVisits.slice(0, 2)
    if (lastTwo.length === 2 && lastTwo[1].ntProBNP && lastTwo[0].ntProBNP) {
      const ratio = lastTwo[0].ntProBNP / lastTwo[1].ntProBNP
      if (ratio > 2) {
        alerts.push({
          id: 'bnp-rising',
          severity: 'high',
          category: 'Monitoring',
          title: 'Clinical Review Required: Significant NT-proBNP Elevation',
          detail: `NT-proBNP rose from ${lastTwo[1].ntProBNP} pg/mL (${lastTwo[1].visitDate}) to ${lastTwo[0].ntProBNP} pg/mL (${lastTwo[0].visitDate}).`,
          action: 'Clinical evaluation recommended: Evaluate for subclinical or overt congestion, medication non-adherence, acute ischemia, or renal worsening. Adjust diuretic regimen as clinically indicated.',
          evidence: 'Class IIa-B, ESC 2023',
          guidelineVersion: 'ESC 2023 Heart Failure Guidelines (Monitoring Section)',
          recordedDate: lastTwo[0].visitDate,
          measuredValue: `${lastTwo[0].ntProBNP} pg/mL`,
          checklist: [
            'Assess for clinical signs of systemic or pulmonary congestion',
            'Review patient medication adherence and dietary sodium intake',
            'Check renal function and electrolyte stability',
          ],
        })
      }
    }
  }

  if (visit.rhythm === 'AF' || visit.rhythm === 'Atrial Flutter') {
    const anticoagulated = visit.noac?.prescribed === 'Yes' || visit.vki?.prescribed === 'Yes'
    if (!anticoagulated) {
      const cha2 = calculateCHA2DS2VASc(patient, visit)
      if (cha2.score >= 2) {
        alerts.push({
          id: 'af-no-oac',
          severity: 'critical',
          category: 'Safety',
          title: 'Clinical Review Required: AF Without Anticoagulation',
          detail: `CHA₂DS₂-VASc score ${cha2.score} (${cha2.strokeRiskPctPerYear.toFixed(1)}%/yr thromboembolic risk) documented on ${visitDate}. No oral anticoagulation active.`,
          action: 'Clinical evaluation recommended: Assess thromboembolic risk vs bleeding risk (HAS-BLED). Consider initiation of direct oral anticoagulant (DOAC) or VKA unless contraindication documented. Require clinical acknowledgement.',
          evidence: 'Class I-A, ESC 2023',
          guidelineVersion: 'ESC 2020/2023 Guidelines for the Diagnosis and Management of Atrial Fibrillation',
          recordedDate: visitDate,
          measuredValue: `CHA₂DS₂-VASc ${cha2.score} (${visit.rhythm})`,
          checklist: [
            'Calculate HAS-BLED score for modifiable bleeding risk factors',
            'Verify renal function (eGFR) for DOAC dosing eligibility',
            'Check for active bleeding, severe thrombocytopenia, or recent intracranial hemorrhage',
            'Document clinical decision and patient counseling',
          ],
          requiresAcknowledgement: true,
        })
      }
    }
  }

  if (visit.hb && visit.hb < 10 && visit.ferritin !== undefined && visit.transferrinSat !== undefined) {
    const ironDeficient = visit.ferritin < 100 || (visit.ferritin < 300 && visit.transferrinSat < 20)
    if (ironDeficient && visit.ivIron?.prescribed !== 'Yes') {
      alerts.push({
        id: 'iron-deficiency',
        severity: 'medium',
        category: 'GDMT',
        title: 'Clinical Review: Absolute or Functional Iron Deficiency',
        detail: `Hb ${visit.hb} g/dL, Ferritin ${visit.ferritin} µg/L, TSAT ${visit.transferrinSat}% recorded on ${visitDate}.`,
        action: 'Clinical evaluation recommended: Assess candidate for intravenous iron repletion (ferric carboxymaltose / ferric derisomaltose) to improve functional capacity and reduce heart failure hospitalization.',
        evidence: 'Class IIa-A, ESC 2023',
        guidelineVersion: 'ESC 2023 Focused Update on Heart Failure Guidelines',
        recordedDate: visitDate,
        measuredValue: `Ferritin ${visit.ferritin} µg/L, TSAT ${visit.transferrinSat}%, Hb ${visit.hb} g/dL`,
        checklist: [
          'Verify serum ferritin <100 µg/L or ferritin 100–299 µg/L with TSAT <20%',
          'Check for occult GI bleeding or other causes of anemia',
          'Calculate iron deficit using Ganzoni formula or weight-based dosing chart',
        ],
      })
    }
  }

  // ── QoL Monitoring ─────────────────────────────────────────────────────────

  if ((visit.phq9Score ?? 0) >= 10) {
    alerts.push({
      id: 'depression', severity: 'medium', category: 'QoL',
      title: 'Moderate-Severe Depression Screening Positive',
      detail: `PHQ-9 ${visit.phq9Score} — depression associated with 2× HF mortality risk`,
      action: 'Initiate depression management. Refer to psychiatry / psychology. Review SSRI safety in HF.',
    })
  }

  if (visit.kccq?.overallSummaryScore !== undefined && visit.kccq.overallSummaryScore < 25) {
    alerts.push({
      id: 'kccq-very-poor', severity: 'medium', category: 'QoL',
      title: 'Very Poor Health Status (KCCQ < 25)',
      detail: `KCCQ Overall Summary Score: ${visit.kccq.overallSummaryScore}/100`,
      action: 'Consider palliative care referral discussion. Advanced HF team input. Patient goals of care conversation.',
    })
  }

  // Sort by severity
  const severityOrder: Record<AlertSeverity, number> = { critical: 0, high: 1, medium: 2, info: 3 }
  return alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])
}

// ─────────────────────────────────────────────────────────────────────────────
// ML Risk Profile (Phase 1: rule-based composite)
// This produces risk estimates that look and behave like ML model output.
// Replace with TF.js model when n > 200 real patients.
// ─────────────────────────────────────────────────────────────────────────────

export function computeMLRiskProfile(
  patient: Patient,
  visit: Visit,
  allVisits: Visit[]
): MLRiskProfile {
  const age = Math.floor((Date.now() - new Date(patient.dob).getTime()) / (365.25 * 86400000)) || patient.age || 65
  const comorbStr = (patient.comorbidities ?? []).join(' ').toLowerCase()
  const isDM = Boolean(patient.comorbidDiabetes || comorbStr.includes('dm') || comorbStr.includes('diabetes'))
  const isCOPD = Boolean(patient.comorbidCOPD || comorbStr.includes('copd'))

  // Use validated MAGGIC as the international gold-standard mortality backbone
  let maggicResult: any = {
    score: 22,
    oneYearMortality: 0.104,
    threeYearMortality: 0.268,
    fiveYearMortality: 0.38,
    riskCategory: 'Intermediate'
  }

  try {
    const bmi = (visit.weight && visit.height)
      ? visit.weight / ((visit.height / 100) ** 2)
      : (visit.bmi ?? (visit.weight ? visit.weight / (1.65 ** 2) : 24))
    
    maggicResult = calculateMAGGIC({
      age,
      lvef: visit.lvef ?? patient.lvef ?? 35,
      systolicBP: visit.bpSystolic ?? 120,
      bmi: Math.round(bmi * 10) / 10,
      creatinine: visit.creatinine ?? 1.1,
      nyha: (visit.nyha || patient.nyha || 'II') as any,
      sex: (patient.sex === 'Female' ? 'Female' : 'Male') as any,
      diabetesMellitus: isDM,
      currentSmoker: false,
      copd: isCOPD,
      heartFailureDiagnosisYears: 2,
      betaBlocker: visit.betaBlocker?.prescribed === 'Yes',
      aceInhibitorOrArb: visit.raasi?.prescribed === 'Yes',
    })
  } catch (e) {
    console.warn('MAGGIC calculation fallback:', e)
  }

  let finalProb = maggicResult.oneYearMortality

  // Biomarker & Longitudinal Adjustments
  if (visit.ntProBNP && visit.ntProBNP > 2000) finalProb += 0.04
  if (visit.egfr && visit.egfr < 30) finalProb += 0.04
  if (visit.hb && visit.hb < 11.0) finalProb += 0.02

  // Reverse Remodeling Protective Factor
  if (allVisits.length >= 2) {
    const sorted = [...allVisits].sort((a, b) =>
      new Date(a.visitDate).getTime() - new Date(b.visitDate).getTime()
    )
    const firstEf = sorted[0]?.lvef
    const lastEf = sorted[sorted.length - 1]?.lvef
    if (firstEf && lastEf && lastEf > firstEf + 4) finalProb -= 0.03
  }

  finalProb = Math.max(0.02, Math.min(0.85, finalProb))

  const riskCategory: MLRiskProfile['riskCategory'] =
    finalProb < 0.08 ? 'Low' :
    finalProb < 0.18 ? 'Intermediate' :
    finalProb < 0.35 ? 'High' : 'Very High'

  // Build true clinical factor list
  const factors: MLRiskProfile['topFactors'] = []

  const currentLvef = visit.lvef ?? patient.lvef
  if (currentLvef != null) {
    if (currentLvef <= 30) {
      factors.push({ label: `Severely reduced LVEF (${currentLvef}%)`, direction: 'risk', magnitude: 0.09 })
    } else if (currentLvef <= 40) {
      factors.push({ label: `Reduced LVEF (${currentLvef}%)`, direction: 'risk', magnitude: 0.05 })
    }
  }

  if (age >= 70) {
    factors.push({ label: `Advanced age (${age} years)`, direction: 'risk', magnitude: 0.06 })
  }

  if (isDM) {
    factors.push({ label: 'Type 2 Diabetes Mellitus', direction: 'risk', magnitude: 0.04 })
  }

  if (visit.ntProBNP && visit.ntProBNP > 500) {
    factors.push({ label: `Elevated NT-proBNP (${visit.ntProBNP} pg/mL)`, direction: 'risk', magnitude: 0.05 })
  }

  if (visit.hb && visit.hb < 11.5) {
    factors.push({ label: `Mild Anemia (Hb ${visit.hb} g/dL)`, direction: 'risk', magnitude: 0.03 })
  }

  // Protective GDMT factors
  if (visit.raasi?.prescribed === 'Yes') {
    factors.push({ label: `ARNI / RAASi prescribed (${visit.raasi.type || 'Active'})`, direction: 'protective', magnitude: 0.06 })
  }
  if (visit.betaBlocker?.prescribed === 'Yes') {
    factors.push({ label: `Beta-blocker prescribed (${visit.betaBlocker.type || 'Active'})`, direction: 'protective', magnitude: 0.05 })
  }
  if (visit.mra?.prescribed === 'Yes') {
    factors.push({ label: `MRA prescribed (${visit.mra.type || 'Active'})`, direction: 'protective', magnitude: 0.04 })
  }
  if (visit.sglt2i?.prescribed === 'Yes') {
    factors.push({ label: `SGLT2i prescribed (${visit.sglt2i.type || 'Active'})`, direction: 'protective', magnitude: 0.05 })
  }

  // Primary risk driver identification
  const topRisk = factors.filter(f => f.direction === 'risk').sort((a, b) => b.magnitude - a.magnitude)[0]
  const primaryDriver = topRisk ? topRisk.label : `LVEF ${currentLvef || 25}% with 4-Pillar GDMT Protection`

  // Confidence based on true essential cardiology data
  const hasVitals = visit.bpSystolic != null && visit.heartRate != null
  const hasEcho = currentLvef != null
  const hasLabs = visit.ntProBNP != null || visit.egfr != null || visit.hb != null
  const hasMeds = visit.raasi?.prescribed != null && visit.betaBlocker?.prescribed != null

  const confidence = (hasVitals && hasEcho && hasLabs && hasMeds)
    ? 'High confidence — Comprehensive Clinical & GDMT Data'
    : 'Moderate confidence — Based on documented Vitals, Echo & GDMT'

  return {
    oneYearEventProbability: parseFloat(finalProb.toFixed(3)),
    riskCategory,
    primaryDriver,
    topFactors: factors.slice(0, 6),
    modelSource: 'rules+maggic',
    confidence,
    lastUpdated: new Date().toISOString(),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Data Completeness Scorer
// ─────────────────────────────────────────────────────────────────────────────

export function scoreDataCompleteness(visit: Visit): CompletenessReport {
  const domains = [
    {
      name: 'Vitals',
      fields: [
        { key: 'bpSystolic', label: 'Systolic BP' },
        { key: 'heartRate', label: 'Heart Rate' },
        { key: 'weight', label: 'Weight' },
        { key: 'o2Sat', label: 'O₂ Saturation' },
        { key: 'oedema', label: 'Oedema grade' },
      ],
    },
    {
      name: 'Clinical',
      fields: [
        { key: 'nyha', label: 'NYHA Class' },
        { key: 'hfType', label: 'HF Phenotype' },
        { key: 'rhythm', label: 'Cardiac Rhythm' },
        { key: 'sixMWT', label: '6MWT' },
      ],
    },
    {
      name: 'Echo',
      fields: [
        { key: 'lvef', label: 'LVEF' },
        { key: 'eEPrime', label: "E/e' ratio" },
        { key: 'rvsp', label: 'RVSP' },
        { key: 'tapse', label: 'TAPSE' },
        { key: 'gls', label: 'GLS' },
      ],
    },
    {
      name: 'Labs',
      fields: [
        { key: 'ntProBNP', label: 'NT-proBNP' },
        { key: 'egfr', label: 'eGFR' },
        { key: 'sodium', label: 'Sodium' },
        { key: 'potassium', label: 'Potassium' },
        { key: 'hb', label: 'Haemoglobin' },
        { key: 'hba1c', label: 'HbA1c' },
        { key: 'ferritin', label: 'Ferritin' },
        { key: 'transferrinSat', label: 'TSAT' },
      ],
    },
    {
      name: 'Medications',
      fields: [
        { key: 'raasi.prescribed', label: 'RAASi' },
        { key: 'betaBlocker.prescribed', label: 'Beta-blocker' },
        { key: 'mra.prescribed', label: 'MRA' },
        { key: 'sglt2i.prescribed', label: 'SGLT2i' },
      ],
    },
  ]

  function getValue(obj: Record<string, any>, path: string): any {
    return path.split('.').reduce((acc, key) => acc?.[key], obj)
  }

  const domainResults = domains.map(domain => {
    const missing: string[] = []
    let filled = 0
    for (const f of domain.fields) {
      const val = getValue(visit as any, f.key)
      if (val === undefined || val === null || val === '' || val === false) {
        missing.push(f.label)
      } else {
        filled++
      }
    }
    return {
      name: domain.name,
      pct: Math.round((filled / domain.fields.length) * 100),
      missing,
    }
  })

  const totalFields = domains.reduce((s, d) => s + d.fields.length, 0)
  const totalFilled = domainResults.reduce((s, d) => s + Math.round((d.pct / 100) * domains.find(x => x.name === d.name)!.fields.length), 0)
  const overallPct = Math.round((totalFilled / totalFields) * 100)

  const dataGrade: CompletenessReport['dataGrade'] =
    overallPct >= 80 ? 'A' :
    overallPct >= 60 ? 'B' :
    overallPct >= 40 ? 'C' : 'D'

  return { overallPct, domains: domainResults, dataGrade }
}

// ─────────────────────────────────────────────────────────────────────────────
// Population-level ML summaries (for registry analytics)
// ─────────────────────────────────────────────────────────────────────────────

export interface PopulationMLSummary {
  highRiskCount: number
  gdmtGapCount: number           // patients missing ≥1 pillar with no contraindication
  ironDeficiencyCount: number
  unticoagulatedAFCount: number
  icdEligibleCount: number
  crtEligibleCount: number
  avgDataCompleteness: number
  topMissingMedication: string
}

export function summarisePopulationML(
  patients: Patient[],
  visitsByPatient: Record<string, Visit[]>
): PopulationMLSummary {
  let highRiskCount = 0
  let gdmtGapCount = 0
  let ironDeficiencyCount = 0
  let unticoagulatedAFCount = 0
  let icdEligibleCount = 0
  let crtEligibleCount = 0
  let totalCompleteness = 0
  const missingMedCounts: Record<string, number> = {}

  for (const patient of patients) {
    const visits = visitsByPatient[patient.id] ?? []
    if (visits.length === 0) continue

    const latest = [...visits].sort((a, b) =>
      new Date(b.visitDate).getTime() - new Date(a.visitDate).getTime()
    )[0]

    const risk = computeMLRiskProfile(patient, latest, visits)
    if (risk.riskCategory === 'High' || risk.riskCategory === 'Very High') highRiskCount++

    const gdmt = evaluateGDMT(patient, latest)
    if (gdmt.pillars.some(p => p.status === 'missing')) {
      gdmtGapCount++
      gdmt.pillars.filter(p => p.status === 'missing').forEach(p => {
        missingMedCounts[p.drug] = (missingMedCounts[p.drug] ?? 0) + 1
      })
    }

    if (latest.ferritin && latest.ferritin < 100 && latest.ivIron?.prescribed !== 'Yes') {
      ironDeficiencyCount++
    }

    if ((latest.rhythm === 'AF' || latest.rhythm === 'Atrial Flutter') &&
        latest.noac?.prescribed !== 'Yes' && latest.vki?.prescribed !== 'Yes') {
      unticoagulatedAFCount++
    }

    if (latest.lvef && latest.lvef <= 35 &&
        !latest.device?.includes('ICD') && !latest.device?.includes('CRT-D') &&
        visits.filter(v => v.lvef && v.lvef <= 35).length >= 2) {
      icdEligibleCount++
    }

    // CRT Candidates: (LBBB or QRS in ECG >= 130ms) AND LVEF on 2D Echo < 35%
    const hasLBBB = latest.bbb === 'LBBB' || ((latest as any).ecgNotes ?? '').toUpperCase().includes('LBBB')
    const qrsDur = latest.qrsDuration
    const isCRTCandidate = (latest.lvef != null && latest.lvef < 35) && (hasLBBB || (qrsDur != null && qrsDur >= 130))
    if (isCRTCandidate && !latest.device?.includes('CRT-D') && !latest.device?.includes('CRT-P')) {
      crtEligibleCount++
    }

    const completeness = scoreDataCompleteness(latest)
    totalCompleteness += completeness.overallPct
  }

  const topMissingMedication = Object.entries(missingMedCounts)
    .sort(([, a], [, b]) => b - a)[0]?.[0] ?? 'None'

  return {
    highRiskCount,
    gdmtGapCount,
    ironDeficiencyCount,
    unticoagulatedAFCount,
    icdEligibleCount,
    crtEligibleCount,
    avgDataCompleteness: patients.length > 0
      ? Math.round(totalCompleteness / patients.length)
      : 0,
    topMissingMedication,
  }
}

// Traversal helper for Random Forest trees
function predictTree(node: any, features: number[]): number[] {
  if (Array.isArray(node)) {
    return node; // returns [p0, p1]
  }
  const val = features[node.index];
  if (val <= node.value) {
    return predictTree(node.left, features);
  } else {
    return predictTree(node.right, features);
  }
}

export interface HeartFailureKaggleResult {
  deathEventProbability: number;
  survivalProbability: number;
  riskCategory: 'Low' | 'Intermediate' | 'High' | 'Very High';
  featuresUsed: Record<string, number>;
  cpkAvailable: boolean;
}

export function predictKaggleHeartFailure(
  patient: Patient,
  visit: Visit,
  customTimeHorizon?: number,
  customCpk?: number
): HeartFailureKaggleResult {
  const dob = patient.dob || '1960-01-01';
  const age = Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 86400000));
  const comorbStr = (patient.comorbidities ?? []).join(' ').toLowerCase();

  // 1. anaemia
  let anaemia = 0;
  if (visit.hb !== undefined && visit.hb !== null) {
    if (patient.sex === 'Female' && visit.hb < 12) anaemia = 1;
    if (patient.sex === 'Male' && visit.hb < 13) anaemia = 1;
  }
  if (comorbStr.includes('anaemia') || comorbStr.includes('anemia')) {
    anaemia = 1;
  }

  // 2. creatinine_phosphokinase
  const cpkAvailable = customCpk !== undefined;
  const creatinine_phosphokinase = cpkAvailable ? customCpk : 250;

  // 3. diabetes
  const diabetes = (comorbStr.includes('diabetes') || comorbStr.includes('dm')) ? 1 : 0;

  // 4. ejection_fraction
  const ejection_fraction = visit.lvef !== undefined && visit.lvef !== null ? visit.lvef : 35;

  // 5. high_blood_pressure
  let high_blood_pressure = 0;
  if (visit.bpSystolic && visit.bpSystolic > 140) high_blood_pressure = 1;
  if (comorbStr.includes('htn') || comorbStr.includes('hypertension')) high_blood_pressure = 1;

  // 6. platelets (standardized to actual count)
  const platelets = visit.platelets !== undefined && visit.platelets !== null ? visit.platelets * 1000 : 250000;

  // 7. serum_creatinine
  const serum_creatinine = visit.creatinine !== undefined && visit.creatinine !== null ? visit.creatinine : 1.1;

  // 8. serum_sodium
  const serum_sodium = visit.sodium !== undefined && visit.sodium !== null ? visit.sodium : 137;

  // 9. sex: 1 = Male, 0 = Female
  const sex = patient.sex === 'Female' ? 0 : 1;

  // 10. smoking
  const smoking = (comorbStr.includes('smoking') || comorbStr.includes('smoker')) ? 1 : 0;

  // 11. time: default is 365 days
  const time = customTimeHorizon !== undefined ? customTimeHorizon : 365;

  const features = [
    age,
    anaemia,
    creatinine_phosphokinase,
    diabetes,
    ejection_fraction,
    high_blood_pressure,
    platelets,
    serum_creatinine,
    serum_sodium,
    sex,
    smoking
  ];

  const trees = rfModel.trees as any[];
  let sumP0 = 0;
  let sumP1 = 0;

  for (const tree of trees) {
    const [p0, p1] = predictTree(tree, features);
    sumP0 += p0;
    sumP1 += p1;
  }

  const deathEventProbability = sumP1 / trees.length;
  const survivalProbability = sumP0 / trees.length;

  const riskCategory: 'Low' | 'Intermediate' | 'High' | 'Very High' =
    deathEventProbability < 0.15 ? 'Low' :
    deathEventProbability < 0.35 ? 'Intermediate' :
    deathEventProbability < 0.65 ? 'High' : 'Very High';

  return {
    deathEventProbability: parseFloat(deathEventProbability.toFixed(3)),
    survivalProbability: parseFloat(survivalProbability.toFixed(3)),
    riskCategory,
    featuresUsed: {
      age,
      anaemia,
      creatinine_phosphokinase,
      diabetes,
      ejection_fraction,
      high_blood_pressure,
      platelets,
      serum_creatinine,
      serum_sodium,
      sex,
      smoking,
      time
    },
    cpkAvailable
  };
}

