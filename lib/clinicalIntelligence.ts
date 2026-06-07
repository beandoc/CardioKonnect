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

// ─────────────────────────────────────────────────────────────────────────────
// GDMT Optimization Engine
// Reference: ESC 2023 HF Guidelines, Table 9 (HFrEF pharmacotherapy)
// ─────────────────────────────────────────────────────────────────────────────

const TARGET_DOSES: Record<string, number> = {
  // RAASi
  enalapril: 40, lisinopril: 35, captopril: 150, ramipril: 10,
  perindopril: 8, trandolapril: 4, fosinopril: 40,
  candesartan: 32, valsartan: 320, losartan: 150,
  'sacubitril/valsartan': 400, sacubitril: 400, entresto: 400,
  // Beta-blockers
  carvedilol: 50, bisoprolol: 10, metoprolol: 200, nebivolol: 10,
  // MRA
  spironolactone: 50, eplerenone: 50,
  // SGLT2i
  dapagliflozin: 10, empagliflozin: 10,
  // Ivabradine
  ivabradine: 15,
}

function parseDoseMg(doseStr?: string): number {
  if (!doseStr) return 0
  const m = doseStr.match(/(\d+\.?\d*)/)
  return m ? parseFloat(m[1]) : 0
}

function getDosePct(drugName?: string, doseStr?: string): number | undefined {
  if (!drugName || !doseStr) return undefined
  const target = TARGET_DOSES[drugName.toLowerCase().replace(/\s+/g, '')]
      ?? TARGET_DOSES[drugName.toLowerCase()]
  if (!target) return undefined
  return Math.min(100, Math.round((parseDoseMg(doseStr) / target) * 100))
}

export function evaluateGDMT(patient: Patient, visit: Visit): GDMTSummary {
  const comorbStr = (patient.comorbidities ?? []).join(' ').toLowerCase()
  const pillars: GDMTPillar[] = []

  const egfr = visit.egfr
  const k = visit.potassium
  const sbp = visit.bpSystolic
  const hr = visit.heartRate
  const hfType = visit.hfType || patient.hfType

  const isHFrEF = hfType === 'HFrEF'
  const isHFpEF = hfType === 'HFpEF'
  const hasCOPD = comorbStr.includes('copd')

  // ── 1. RAASi (ACEi / ARB / ARNI) ─────────────────────────────────────────
  const raasi = visit.raasi
  const raasContra = egfr && egfr < 15 ? 'eGFR < 15 ml/min'
    : k && k > 5.5 ? 'Hyperkalaemia > 5.5 mmol/L'
    : sbp && sbp < 90 ? 'Hypotension SBP < 90 mmHg'
    : null

  pillars.push({
    drug: 'RAASi',
    shortName: raasi?.type || 'ACEi / ARB / ARNI',
    status: raasContra ? 'contraindicated'
      : !isHFrEF && !hfType ? 'not-indicated'
      : raasi?.prescribed !== 'Yes' ? 'missing'
      : getDosePct(raasi.type, raasi.dose) !== undefined && (getDosePct(raasi.type, raasi.dose)! < 50) ? 'below-target'
      : 'prescribed',
    currentDose: raasi?.dose,
    targetDose: raasi?.type ? `${TARGET_DOSES[raasi.type.toLowerCase()] ?? '?'} mg/day` : undefined,
    dosePct: getDosePct(raasi?.type, raasi?.dose),
    contraindication: raasContra ?? undefined,
    evidence: 'Class I-A, ESC 2023',
    benefit: 'Reduces mortality by 17% and HF hospitalization by 19%',
  })

  // ── 2. Beta-Blocker ────────────────────────────────────────────────────────
  const bb = visit.betaBlocker
  const bbContra = hr && hr < 50 ? 'Bradycardia < 50 bpm'
    : sbp && sbp < 90 ? 'Hypotension SBP < 90 mmHg'
    : null

  pillars.push({
    drug: 'Beta-Blocker',
    shortName: bb?.type || 'Carvedilol / Bisoprolol',
    status: bbContra ? 'contraindicated'
      : !isHFrEF && !hfType ? 'not-indicated'
      : bb?.prescribed !== 'Yes' ? 'missing'
      : getDosePct(bb.type, bb.dose) !== undefined && (getDosePct(bb.type, bb.dose)! < 50) ? 'below-target'
      : 'prescribed',
    currentDose: bb?.dose,
    targetDose: bb?.type ? `${TARGET_DOSES[bb.type.toLowerCase()] ?? '?'} mg/day` : undefined,
    dosePct: getDosePct(bb?.type, bb?.dose),
    contraindication: bbContra ?? undefined,
    evidence: 'Class I-A, ESC 2023',
    benefit: 'Reduces mortality by 34% in HFrEF (CIBIS-II, MERIT-HF)',
  })

  // ── 3. MRA ────────────────────────────────────────────────────────────────
  const mra = visit.mra
  const mraContra = egfr && egfr < 30 ? 'eGFR < 30 ml/min'
    : k && k > 5.0 ? 'Hyperkalaemia > 5.0 mmol/L'
    : null

  pillars.push({
    drug: 'MRA',
    shortName: mra?.type || 'Spironolactone / Eplerenone',
    status: mraContra ? 'contraindicated'
      : !isHFrEF && !hfType ? 'not-indicated'
      : mra?.prescribed !== 'Yes' ? 'missing'
      : 'prescribed',
    currentDose: mra?.dose,
    dosePct: getDosePct(mra?.type, mra?.dose),
    contraindication: mraContra ?? undefined,
    evidence: 'Class I-A, ESC 2023',
    benefit: 'Reduces mortality by 30% (RALES, EMPHASIS-HF)',
  })

  // ── 4. SGLT2i ─────────────────────────────────────────────────────────────
  const sglt2 = visit.sglt2i
  const sglt2Contra = egfr && egfr < 20 ? 'eGFR < 20 ml/min (dapagliflozin)'
    : null

  pillars.push({
    drug: 'SGLT2i',
    shortName: sglt2?.type || 'Dapagliflozin / Empagliflozin',
    status: sglt2Contra ? 'contraindicated'
      : sglt2?.prescribed !== 'Yes' ? 'missing'
      : 'prescribed',
    currentDose: sglt2?.dose,
    dosePct: getDosePct(sglt2?.type, sglt2?.dose),
    contraindication: sglt2Contra ?? undefined,
    evidence: isHFpEF ? 'Class IIa-B, ESC 2023' : 'Class I-A, ESC 2023',
    benefit: isHFpEF
      ? 'Reduces HF hospitalisation by 21% in HFpEF (EMPEROR-Preserved)'
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
      ? `Initiate ${missing[0].drug} — ${missing[0].evidence}`
      : belowTarget.length > 0
      ? `Uptitrate ${belowTarget[0].drug} to target dose — ${belowTarget[0].evidence}`
      : 'Patient on optimal GDMT — maintain current regimen'

  return { pillarsOnTarget: prescribed, totalApplicable: applicable, optimizationScore, pillars, nextBestAction }
}

// ─────────────────────────────────────────────────────────────────────────────
// Clinical Safety Alert Engine
// ─────────────────────────────────────────────────────────────────────────────

export function generateClinicalAlerts(patient: Patient, visit: Visit, allVisits: Visit[]): ClinicalAlert[] {
  const alerts: ClinicalAlert[] = []
  const comorbStr = (patient.comorbidities ?? []).join(' ').toLowerCase()
  const age = Math.floor((Date.now() - new Date(patient.dob).getTime()) / (365.25 * 86400000))

  // ── Safety Alerts ─────────────────────────────────────────────────────────

  if (visit.potassium && visit.potassium > 5.5) {
    alerts.push({
      id: 'k-high', severity: 'critical', category: 'Safety',
      title: 'Hyperkalaemia',
      detail: `K⁺ ${visit.potassium} mmol/L — dangerous with current RAASi/MRA`,
      action: 'Hold MRA. Reduce RAASi dose. Dietitian referral for low-K diet. Recheck in 48–72h.',
      evidence: 'ESC 2023 HF Safety',
    })
  }

  if (visit.potassium && visit.potassium < 3.5) {
    alerts.push({
      id: 'k-low', severity: 'high', category: 'Safety',
      title: 'Hypokalaemia',
      detail: `K⁺ ${visit.potassium} mmol/L — arrhythmia risk, especially with digoxin`,
      action: 'Oral or IV potassium replacement. Review diuretic dose. Recheck in 48h.',
    })
  }

  if (visit.egfr && visit.egfr < 20) {
    alerts.push({
      id: 'egfr-critical', severity: 'critical', category: 'Safety',
      title: 'Severe Renal Impairment',
      detail: `eGFR ${visit.egfr} ml/min — nephrology review mandatory`,
      action: 'Stop SGLT2i. Review RAASi. Reduce MRA/digoxin. Consider nephrology co-management.',
      evidence: 'KDIGO 2022',
    })
  }

  if (visit.sodium && visit.sodium < 130) {
    alerts.push({
      id: 'na-low', severity: 'high', category: 'Safety',
      title: 'Severe Hyponatraemia',
      detail: `Na⁺ ${visit.sodium} mmol/L — poor prognosis marker in HF`,
      action: 'Fluid restriction to 1 L/day. Review diuretics. Consider vasopressin antagonist if refractory.',
    })
  }

  if (visit.bpSystolic && visit.bpSystolic < 90) {
    alerts.push({
      id: 'bp-low', severity: 'critical', category: 'Safety',
      title: 'Hypotension',
      detail: `SBP ${visit.bpSystolic} mmHg — unsafe to uptitrate HF medications`,
      action: 'Hold diuretics if dehydrated. Reduce vasodilator doses. Rule out cardiogenic shock.',
    })
  }

  if (visit.heartRate && visit.heartRate < 50 && visit.rhythm === 'Sinus') {
    alerts.push({
      id: 'hr-low', severity: 'high', category: 'Safety',
      title: 'Significant Bradycardia',
      detail: `HR ${visit.heartRate} bpm in sinus rhythm`,
      action: 'Reduce or hold beta-blocker. Stop digoxin if co-prescribed. ECG + Holter.',
    })
  }

  if (visit.qtcInterval && visit.qtcInterval > 500) {
    alerts.push({
      id: 'qtc-long', severity: 'critical', category: 'Safety',
      title: 'Prolonged QTc Interval',
      detail: `QTc ${visit.qtcInterval} ms — torsades de pointes risk`,
      action: 'Stop QT-prolonging drugs (digoxin if co-prescribed). Check electrolytes. Cardiology/EP review.',
    })
  }

  // ── GDMT / Device Alerts ──────────────────────────────────────────────────

  const lvef = visit.lvef
  const qrs = visit.qrsDuration
  const hasBBB = visit.bbb

  if (lvef && lvef <= 35 && !(visit.device ?? []).includes('ICD') && !(visit.device ?? []).includes('CRT-D')) {
    const prevVisitWithLowEF = allVisits.filter(v => v.id !== visit.id && v.lvef && v.lvef <= 35)
    if (prevVisitWithLowEF.length >= 1) {
      alerts.push({
        id: 'icd-eligible', severity: 'high', category: 'Device',
        title: 'Possible ICD Eligibility',
        detail: `LVEF ${lvef}% on ≥2 visits — may meet criteria for primary prevention ICD`,
        action: 'Confirm LVEF on optimised therapy ≥90 days. Refer to EP if NYHA II–III. Check LVEF is not recovering.',
        evidence: 'Class I-A, ESC 2023',
      })
    }
  }

  if (lvef && lvef <= 35 && qrs && qrs >= 150 && hasBBB === 'LBBB') {
    alerts.push({
      id: 'crt-eligible', severity: 'high', category: 'Device',
      title: 'CRT Eligibility Criteria Met',
      detail: `LVEF ${lvef}%, LBBB, QRS ${qrs} ms — strong CRT indication`,
      action: 'Refer for CRT-D implantation. Expected LVEF improvement 10–15% and mortality reduction.',
      evidence: 'Class I-A, ESC 2023',
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
          id: 'bnp-rising', severity: 'high', category: 'Monitoring',
          title: 'NT-proBNP Rising Sharply',
          detail: `NT-proBNP doubled: ${lastTwo[1].ntProBNP} → ${lastTwo[0].ntProBNP} pg/mL`,
          action: 'Assess for decompensation. Intensify diuresis. Review medication adherence. Consider early admission.',
        })
      }
    }
  }

  if (visit.ntProBNP && visit.ntProBNP > 5000 && visit.nyha && ['III', 'IV'].includes(visit.nyha)) {
    alerts.push({
      id: 'bnp-very-high', severity: 'high', category: 'Monitoring',
      title: 'Very High NT-proBNP with NYHA III/IV',
      detail: `NT-proBNP ${visit.ntProBNP} pg/mL with NYHA ${visit.nyha}`,
      action: 'High-risk status. Consider hospital admission. Review diuretic regimen.',
    })
  }

  if (visit.rhythm === 'AF' || visit.rhythm === 'Atrial Flutter') {
    const anticoagulated = visit.noac?.prescribed === 'Yes' || visit.vki?.prescribed === 'Yes'
    if (!anticoagulated) {
      const cha2 = calculateCHA2DS2VASc(patient, visit)
      if (cha2.score >= 2) {
        alerts.push({
          id: 'af-no-oac', severity: 'critical', category: 'Safety',
          title: 'AF Without Anticoagulation',
          detail: `CHA₂DS₂-VASc ${cha2.score} — ${cha2.strokeRiskPctPerYear.toFixed(1)}%/yr stroke risk. No OAC prescribed.`,
          action: 'Initiate NOAC immediately unless absolute contraindication. Document decision.',
          evidence: 'Class I-A, ESC 2023',
        })
      }
    }
  }

  if (visit.hb && visit.hb < 10 && visit.ferritin !== undefined && visit.transferrinSat !== undefined) {
    const ironDeficient = visit.ferritin < 100 || (visit.ferritin < 300 && visit.transferrinSat < 20)
    if (ironDeficient && visit.ivIron?.prescribed !== 'Yes') {
      alerts.push({
        id: 'iron-deficiency', severity: 'medium', category: 'GDMT',
        title: 'Iron Deficiency — IV Iron Not Prescribed',
        detail: `Hb ${visit.hb} g/dL, Ferritin ${visit.ferritin}, TSAT ${visit.transferrinSat}%`,
        action: 'Consider IV ferric carboxymaltose. AFFIRM-AHF: reduced HF rehospitalisation by 26%.',
        evidence: 'Class IIa-A, ESC 2023',
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
  allVisits: Visit[],
): MLRiskProfile {
  const age = Math.floor((Date.now() - new Date(patient.dob).getTime()) / (365.25 * 86400000))
  const comorbStr = (patient.comorbidities ?? []).join(' ').toLowerCase()

  // Use MAGGIC as the mortality backbone
  let maggicOneYr = 0.10  // default if inputs missing
  try {
    const bmi = visit.weight && visit.height
      ? visit.weight / ((visit.height / 100) ** 2)
      : 24
    const result = calculateMAGGIC({
      age,
      lvef: visit.lvef ?? 40,
      systolicBP: visit.bpSystolic ?? 120,
      bmi,
      creatinine: visit.creatinine ?? 1.0,
      nyha: visit.nyha ?? 'II',
      sex: patient.sex === 'Female' ? 'Female' : 'Male',
      diabetesMellitus: comorbStr.includes('dm') || comorbStr.includes('diabetes'),
      currentSmoker: false,
      copd: comorbStr.includes('copd'),
      heartFailureDiagnosisYears: 2,
      betaBlocker: visit.betaBlocker?.prescribed === 'Yes',
      aceInhibitorOrArb: visit.raasi?.prescribed === 'Yes',
    })
    maggicOneYr = result.oneYearMortality
  } catch (_) {}

  // Layer 2: Augment with additional registry signals not in MAGGIC
  let adjustment = 0

  // NT-proBNP > 2000 → +5% risk
  if (visit.ntProBNP && visit.ntProBNP > 2000) adjustment += 0.05
  if (visit.ntProBNP && visit.ntProBNP > 5000) adjustment += 0.08

  // No SGLT2i → +3% risk (DAPA-HF showed 3.9% ARR)
  if (visit.sglt2i?.prescribed !== 'Yes') adjustment += 0.03

  // Iron deficiency → +3% risk
  if (visit.ferritin && visit.ferritin < 100) adjustment += 0.03

  // eGFR < 30 → +5% risk
  if (visit.egfr && visit.egfr < 30) adjustment += 0.05

  // Improving LVEF → −5% risk (LV reverse remodelling)
  if (allVisits.length >= 2) {
    const sorted = [...allVisits].sort((a, b) =>
      new Date(a.visitDate).getTime() - new Date(b.visitDate).getTime()
    )
    const first = sorted[0]?.lvef
    const last = sorted[sorted.length - 1]?.lvef
    if (first && last && last > first + 5) adjustment -= 0.05
  }

  // High SDOH burden → +4% risk
  const sdoh = visit.socialDeterminants
  if (sdoh?.insuranceType === 'None') adjustment += 0.02
  if (sdoh?.distanceFromHospital && sdoh.distanceFromHospital > 50) adjustment += 0.02

  let finalProb = Math.max(0.02, Math.min(0.95, maggicOneYr + adjustment))
  try {
    const kaggle = predictKaggleHeartFailure(patient, visit)
    const blended = 0.5 * maggicOneYr + 0.5 * kaggle.deathEventProbability + adjustment
    finalProb = Math.max(0.02, Math.min(0.95, blended))
  } catch (_) {}

  const riskCategory: MLRiskProfile['riskCategory'] =
    finalProb < 0.08 ? 'Low' :
    finalProb < 0.20 ? 'Intermediate' :
    finalProb < 0.40 ? 'High' : 'Very High'

  // Build SHAP-like factor list
  const factors: MLRiskProfile['topFactors'] = []

  if (visit.nyha === 'III' || visit.nyha === 'IV')
    factors.push({ label: `NYHA ${visit.nyha}`, direction: 'risk', magnitude: 0.08 })
  if (visit.lvef && visit.lvef < 25)
    factors.push({ label: `LVEF ${visit.lvef}%`, direction: 'risk', magnitude: 0.07 })
  if (visit.ntProBNP && visit.ntProBNP > 2000)
    factors.push({ label: `NT-proBNP ${visit.ntProBNP} pg/mL`, direction: 'risk', magnitude: 0.06 })
  if (visit.egfr && visit.egfr < 30)
    factors.push({ label: `eGFR ${visit.egfr} ml/min`, direction: 'risk', magnitude: 0.05 })
  if (visit.sglt2i?.prescribed !== 'Yes')
    factors.push({ label: 'SGLT2i not prescribed', direction: 'risk', magnitude: 0.04 })
  if (visit.betaBlocker?.prescribed === 'Yes')
    factors.push({ label: 'Beta-blocker on therapy', direction: 'protective', magnitude: 0.05 })
  if (visit.raasi?.prescribed === 'Yes')
    factors.push({ label: 'RAASi on therapy', direction: 'protective', magnitude: 0.04 })
  if (visit.device?.includes('ICD') || visit.device?.includes('CRT-D'))
    factors.push({ label: 'ICD / CRT-D in situ', direction: 'protective', magnitude: 0.06 })

  const missingPoints: string[] = []
  if ((visit as any).creatinine_phosphokinase === undefined && (visit as any).cpk === undefined) {
    missingPoints.push('CPK')
  }
  if (visit.platelets === undefined || visit.platelets === null) {
    missingPoints.push('platelets')
  }

  const confidence = missingPoints.length > 0
    ? `Low confidence — ${missingPoints.join(', ')} not captured`
    : 'High confidence'

  const primaryDriver = factors.filter(f => f.direction === 'risk')
    .sort((a, b) => b.magnitude - a.magnitude)[0]?.label ?? 'Insufficient data'

  return {
    oneYearEventProbability: parseFloat(finalProb.toFixed(3)),
    riskCategory,
    primaryDriver,
    topFactors: factors.sort((a, b) => b.magnitude - a.magnitude).slice(0, 5),
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

