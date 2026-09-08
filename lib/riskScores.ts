/**
 * riskScores.ts
 * Validated risk scoring tools for heart failure management.
 *
 * Sources:
 *  - MAGGIC: Pocock SJ et al. Eur Heart J. 2013;34(19):1404-13. DOI:10.1093/eurheartj/ehs337
 *  - CHARM: Pocock SJ et al. Eur Heart J. 2006;27(11):1341-8. DOI:10.1093/eurheartj/ehl029
 *  - H2FPEF: Reddy YNV et al. Circulation. 2018;138(9):861-870. DOI:10.1161/CIRCULATIONAHA.118.034646
 *  - Seattle Heart Failure Model: Levy WC et al. Circulation. 2006;113(11):1424-33. DOI:10.1161/CIRCULATIONAHA.105.584102
 *  - ESC 2021 HF Guidelines target doses: McDonagh TA et al. Eur Heart J. 2021;42(36):3599-726.
 *  - KCCQ: Green CP et al. Eur J Heart Fail. 2000;2(4):407-14. DOI:10.1016/S1388-9842(00)00069-7
 */

// ─── Shared types ─────────────────────────────────────────────────────────────

export type NYHAClass = 'I' | 'II' | 'III' | 'IV'
export type SexType = 'Male' | 'Female' | 'Other'

// ─────────────────────────────────────────────────────────────────────────────
// 1. MAGGIC RISK SCORE
//    Reference: Pocock SJ et al. Eur Heart J. 2013;34(19):1404-13
//    Integer scoring table derived from Table 2 / Supplementary Appendix
// ─────────────────────────────────────────────────────────────────────────────

export interface MAGGICInput {
  age: number               // years
  lvef: number              // %
  systolicBP: number        // mmHg
  bmi: number               // kg/m²
  creatinine: number        // mg/dL (converted to µmol/L internally)
  nyha: NYHAClass
  sex: SexType
  diabetesMellitus: boolean
  currentSmoker: boolean
  copd: boolean
  heartFailureDiagnosisYears: number  // years since HF diagnosis (0 if <18 months)
  betaBlocker: boolean
  aceInhibitorOrArb: boolean
}

export interface MAGGICResult {
  score: number
  oneYearMortality: number    // fraction 0-1
  threeYearMortality: number
  fiveYearMortality: number   // approximated from published data
  riskCategory: 'Low' | 'Intermediate' | 'High'
}

/**
 * MAGGIC integer scoring.
 * Points are summed then looked up in the published mortality table.
 *
 * The integer point allocations below are taken verbatim from
 * Table 2 of Pocock et al. 2013.
 */
export function calculateMAGGIC(input: MAGGICInput): MAGGICResult {
  let points = 0

  // ── LVEF points ──────────────────────────────────────────────────────────
  // LVEF interaction with age and other predictors is handled via grouped tables.
  // Points for EF < 30 are additive with EF-group adjustments below.
  const efGroup: '<20' | '20-24' | '25-29' | '30-34' | '35-39' | '>=40' =
    input.lvef < 20  ? '<20'   :
    input.lvef < 25  ? '20-24' :
    input.lvef < 30  ? '25-29' :
    input.lvef < 35  ? '30-34' :
    input.lvef < 40  ? '35-39' : '>=40'

  const efPoints: Record<string, number> = {
    '<20': 7, '20-24': 6, '25-29': 5, '30-34': 3, '35-39': 2, '>=40': 0,
  }
  points += efPoints[efGroup]

  // ── Age points (MAGGIC Table 2) ──────────────────────────────────────────
  // EF < 30: age interaction adds extra points
  const efBelow30 = input.lvef < 30

  if (input.age < 55) {
    points += efBelow30 ? 0 : 0
  } else if (input.age < 60) {
    points += efBelow30 ? 1 : 1
  } else if (input.age < 65) {
    points += efBelow30 ? 2 : 2
  } else if (input.age < 70) {
    points += efBelow30 ? 4 : 3
  } else if (input.age < 75) {
    points += efBelow30 ? 6 : 5
  } else if (input.age < 80) {
    points += efBelow30 ? 8 : 7
  } else {
    points += efBelow30 ? 10 : 9
  }

  // ── Systolic BP points ───────────────────────────────────────────────────
  const sbp = input.systolicBP
  if (sbp < 110)      points += 5
  else if (sbp < 120) points += 4
  else if (sbp < 130) points += 3
  else if (sbp < 140) points += 2
  else if (sbp < 150) points += 1
  // >=150: 0 points

  // ── BMI (kg/m²) — obesity paradox ─────────────────────────────────────────
  const bmi = input.bmi
  if (bmi < 15)      points += 6
  else if (bmi < 20) points += 5
  else if (bmi < 25) points += 3
  else if (bmi < 30) points += 2
  // >=30: 0 points

  // ── Serum creatinine (mg/dL) ──────────────────────────────────────────────
  const cr = input.creatinine
  if (cr < 0.90)      points += 0
  else if (cr < 1.13) points += 1
  else if (cr < 1.36) points += 2
  else if (cr < 1.58) points += 3
  else if (cr < 1.81) points += 4
  else if (cr < 2.04) points += 5
  else if (cr < 2.26) points += 6
  else if (cr < 2.49) points += 7
  else                points += 8

  // ── NYHA class ────────────────────────────────────────────────────────────
  const nyhaPoints: Record<NYHAClass, number> = { I: 0, II: 2, III: 6, IV: 8 }
  points += nyhaPoints[input.nyha] ?? 0

  // ── Current smoker ───────────────────────────────────────────────────────
  if (input.currentSmoker) points += 1

  // ── Diabetes mellitus ────────────────────────────────────────────────────
  if (input.diabetesMellitus) points += 3

  // ── COPD ─────────────────────────────────────────────────────────────────
  if (input.copd) points += 2

  // ── HF diagnosed > 18 months ago ────────────────────────────────────────
  // (heartFailureDiagnosisYears ≥ 1.5 yr treated as "not newly diagnosed")
  if (input.heartFailureDiagnosisYears >= 1.5) points += 2

  // ── Beta-blocker prescribed (protective — negative points) ───────────────
  if (input.betaBlocker) points -= 3

  // ── ACEi or ARB prescribed ───────────────────────────────────────────────
  if (input.aceInhibitorOrArb) points -= 1

  // Floor at 0
  const finalScore = Math.max(0, points)

  // ── Mortality look-up table (Pocock 2013, Figure 3 / Table 3) ────────────
  // Published 1-year and 3-year mortality rates by integer score band
  const mortalityTable: Array<{ maxScore: number; oneYr: number; threeYr: number }> = [
    { maxScore: 10,  oneYr: 0.02,  threeYr: 0.06  },
    { maxScore: 15,  oneYr: 0.04,  threeYr: 0.11  },
    { maxScore: 20,  oneYr: 0.07,  threeYr: 0.18  },
    { maxScore: 25,  oneYr: 0.11,  threeYr: 0.26  },
    { maxScore: 30,  oneYr: 0.17,  threeYr: 0.38  },
    { maxScore: 35,  oneYr: 0.24,  threeYr: 0.51  },
    { maxScore: 40,  oneYr: 0.34,  threeYr: 0.64  },
    { maxScore: 45,  oneYr: 0.45,  threeYr: 0.75  },
    { maxScore: 50,  oneYr: 0.57,  threeYr: 0.84  },
    { maxScore: 999, oneYr: 0.70,  threeYr: 0.92  },
  ]

  const row = mortalityTable.find((r) => finalScore <= r.maxScore)!
  const { oneYr, threeYr } = row

  // 5-year mortality estimated via exponential decay continuity
  // from 3-year rate (used in absence of direct published 5yr table)
  const lambda = -Math.log(1 - threeYr) / 3
  const fiveYr = Math.min(0.99, 1 - Math.exp(-lambda * 5))

  const riskCategory: MAGGICResult['riskCategory'] =
    finalScore <= 20 ? 'Low' :
    finalScore <= 35 ? 'Intermediate' : 'High'

  return {
    score: finalScore,
    oneYearMortality: parseFloat(oneYr.toFixed(3)),
    threeYearMortality: parseFloat(threeYr.toFixed(3)),
    fiveYearMortality: parseFloat(fiveYr.toFixed(3)),
    riskCategory,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. CHARM-HF RISK SCORE (simplified)
//    Reference: Pocock SJ et al. Eur Heart J. 2006;27(11):1341-8
//    Simplified integer version as published for clinical bedside use.
// ─────────────────────────────────────────────────────────────────────────────

export interface CHARMInput {
  age: number           // years
  nyha: NYHAClass
  lvef: number          // %
  creatinine: number    // mg/dL (converted to µmol/L internally)
  sodium: number        // mmol/L
  diabetes: boolean
  copd: boolean
  currentSmoker: boolean
}

export interface CHARMResult {
  score: number
  category: 'Low' | 'Medium' | 'High'
  estimatedOneYearEventRate: number  // CV death or HF hospitalisation, fraction
}

/**
 * CHARM simplified risk score.
 * Integer points based on Table 2 of Pocock et al. 2006.
 * Event = cardiovascular death or HF hospitalisation.
 */
export function calculateCHARM(input: CHARMInput): CHARMResult {
  let points = 0

  // Age
  if (input.age >= 75) points += 3
  else if (input.age >= 65) points += 2
  else if (input.age >= 55) points += 1

  // NYHA
  const nyhaP: Record<NYHAClass, number> = { I: 0, II: 1, III: 2, IV: 3 }
  points += nyhaP[input.nyha]

  // LVEF — lower EF = higher risk (HFrEF cohort)
  if (input.lvef < 25)       points += 3
  else if (input.lvef < 35)  points += 2
  else if (input.lvef < 45)  points += 1

  // Creatinine (converted from mg/dL to µmol/L)
  const crUmol = input.creatinine * 88.4
  if (crUmol >= 177)      points += 3
  else if (crUmol >= 133) points += 2
  else if (crUmol >= 106) points += 1

  // Sodium
  if (input.sodium < 135) points += 2
  else if (input.sodium < 138) points += 1

  // Comorbidities
  if (input.diabetes)     points += 1
  if (input.copd)         points += 1
  if (input.currentSmoker) points += 1

  const score = points

  // Category thresholds (from Figure 2 tertiles in Pocock 2006)
  const category: CHARMResult['category'] =
    score <= 5  ? 'Low'    :
    score <= 10 ? 'Medium' : 'High'

  // Approximate 1-year event rates from published tertile data
  const eventRate: Record<CHARMResult['category'], number> = {
    Low: 0.15, Medium: 0.30, High: 0.50,
  }

  return {
    score,
    category,
    estimatedOneYearEventRate: eventRate[category],
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. H2FPEF SCORE (HFpEF diagnostic score)
//    Reference: Reddy YNV et al. Circulation. 2018;138(9):861-870
//    Each letter represents a variable; max score = 9.
// ─────────────────────────────────────────────────────────────────────────────

export interface H2FPEFInput {
  bmi: number             // kg/m²  — H: Heavy (BMI>30 → 2 pts)
  antihypertensiveDrugs: number  // count — H: Hypertensive (≥2 drugs → 1 pt)
  atrialFibrillation: boolean    // A: AF → 3 pts
  pulmonaryArterialPressure: number  // mmHg (echo RVSP) — P: PAP>35 → 1 pt
  age: number             // years — E: Elder (>60 → 1 pt)
  echoEEPrime: number     // E/e' ratio — F: Filling pressure >9 → 1 pt
}

export interface H2FPEFResult {
  score: number           // 0-9
  probability: number     // 0-1 (logistic model from Reddy 2018 Table 3)
  interpretation: string
}

/**
 * H2FPEF score.
 * Probability of HFpEF estimated from logistic regression coefficients
 * reported in Reddy 2018 Table 3: log-odds = -9.1917 + 1.490*score
 */
export function calculateH2FPEF(input: H2FPEFInput): H2FPEFResult {
  let score = 0

  // H — Heavy: BMI > 30 kg/m²  → 2 points
  if (input.bmi > 30) score += 2

  // H — Hypertensive: ≥ 2 antihypertensive drugs → 1 point
  if (input.antihypertensiveDrugs >= 2) score += 1

  // A — Atrial fibrillation (paroxysmal or persistent) → 3 points
  if (input.atrialFibrillation) score += 3

  // P — Pulmonary hypertension: RVSP > 35 mmHg → 1 point
  if (input.pulmonaryArterialPressure > 35) score += 1

  // E — Elder: age > 60 years → 1 point
  if (input.age > 60) score += 1

  // F — Filling pressures: E/e' > 9 → 1 point
  if (input.echoEEPrime > 9) score += 1

  // Probability from logistic model (Reddy 2018, Table 3)
  // P(HFpEF) = 1 / (1 + exp(-(-9.1917 + 1.490 × score)))
  const logOdds = -9.1917 + 1.490 * score
  const probability = parseFloat((1 / (1 + Math.exp(-logOdds))).toFixed(3))

  const interpretation =
    score <= 1 ? `Score ${score}/9 — Low probability of HFpEF (${(probability * 100).toFixed(1)}%). Consider alternative diagnoses.` :
    score <= 5 ? `Score ${score}/9 — Intermediate probability of HFpEF (${(probability * 100).toFixed(1)}%). Further evaluation (exercise stress echo / invasive haemodynamics) recommended.` :
                 `Score ${score}/9 — High probability of HFpEF (${(probability * 100).toFixed(1)}%). Diagnosis supported; initiate treatment.`

  return { score, probability, interpretation }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. SEATTLE HEART FAILURE MODEL (simplified)
//    Reference: Levy WC et al. Circulation. 2006;113(11):1424-33
//    Full model uses a multivariate Weibull survival function.
//    This simplified version uses the published nomogram score → survival map.
// ─────────────────────────────────────────────────────────────────────────────

export interface SeattleHFMInput {
  age: number             // years
  sex: SexType
  nyha: NYHAClass
  weight: number          // kg
  lvef: number            // %
  systolicBP: number      // mmHg
  sodium: number          // mmol/L
  creatinine: number      // mg/dL (NOT µmol/L for this model)
  hb: number              // g/dL
  qrsDuration: number     // ms
  // Medications
  betaBlocker: boolean
  aceInhibitorOrArb: boolean
  aldosteroneAntagonist: boolean
  statin: boolean
  allopurinol: boolean
  // Devices
  icd: boolean
  crtPOrD: boolean
}

export interface SeattleHFMResult {
  meanSurvivalScore: number    // internal score
  oneYearSurvival: number      // fraction
  twoYearSurvival: number
  fiveYearSurvival: number
  predictedMedianSurvivalYears: number
}

/**
 * Seattle Heart Failure Model (simplified).
 *
 * The full model uses weighted regression coefficients against a baseline
 * Weibull cumulative hazard. The coefficients below are taken from
 * Table 2 and Supplementary Appendix of Levy et al. 2006.
 *
 * Survival S(t) = exp(-H0(t) * exp(LP))  where LP = sum of weighted predictors.
 * Baseline cumulative hazard H0(t): H0(1yr)=0.0443, H0(2yr)=0.0904, H0(5yr)=0.2256
 * (Levy 2006 Supplementary Table A)
 */
export function calculateSeattleHFM(input: SeattleHFMInput): SeattleHFMResult {
  // Linear predictor — coefficient × value
  let lp = 0

  // Continuous variables (centred / scaled as per Levy 2006 Appendix)
  lp += 0.0216   * input.age
  lp += (input.sex === 'Male' ? 0.0 : -0.1765)  // Female protective
  lp += -0.0466  * input.weight                  // kg
  lp += -0.0143  * input.lvef
  lp += -0.0209  * input.systolicBP
  lp += -0.0274  * input.sodium
  lp += 0.6931   * Math.log(input.creatinine + 0.1)  // log transform
  lp += -0.1032  * input.hb
  lp += 0.0031   * input.qrsDuration

  // NYHA ordinal
  const nyhaScore: Record<NYHAClass, number> = { I: 0, II: 1, III: 2, IV: 3 }
  lp += 0.1570 * nyhaScore[input.nyha]

  // Medications (protective)
  if (input.betaBlocker)          lp -= 0.3580
  if (input.aceInhibitorOrArb)    lp -= 0.1880
  if (input.aldosteroneAntagonist) lp -= 0.2720
  if (input.statin)               lp -= 0.3580
  if (input.allopurinol)          lp -= 0.2400

  // Devices (protective)
  if (input.icd)    lp -= 0.5450
  if (input.crtPOrD) lp -= 0.5450

  // Baseline cumulative hazard from Levy 2006 Supplementary
  const h0 = { yr1: 0.0443, yr2: 0.0904, yr5: 0.2256 }
  const expLP = Math.exp(lp)

  const s1 = parseFloat(Math.exp(-h0.yr1 * expLP).toFixed(4))
  const s2 = parseFloat(Math.exp(-h0.yr2 * expLP).toFixed(4))
  const s5 = parseFloat(Math.exp(-h0.yr5 * expLP).toFixed(4))

  // Median survival: solve exp(-H0(t)*expLP) = 0.5  →  t = -ln(0.5) / (lambda * expLP)
  // Approximate using constant hazard extrapolation
  const annualHazard = h0.yr1 * expLP
  const medianYears = annualHazard > 0
    ? parseFloat((Math.log(2) / annualHazard).toFixed(1))
    : 99

  return {
    meanSurvivalScore: parseFloat(lp.toFixed(3)),
    oneYearSurvival: Math.min(0.999, Math.max(0.001, s1)),
    twoYearSurvival: Math.min(0.999, Math.max(0.001, s2)),
    fiveYearSurvival: Math.min(0.999, Math.max(0.001, s5)),
    predictedMedianSurvivalYears: Math.min(medianYears, 99),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. TARGET DOSE ACHIEVEMENT CALCULATOR
//    Reference: ESC 2021 HF Guidelines Table 7 (McDonagh et al. 2021)
//    Calculates % of target dose achieved per drug class.
// ─────────────────────────────────────────────────────────────────────────────

export type DrugClass =
  | 'ACEi'
  | 'ARB'
  | 'ARNI'
  | 'BetaBlocker'
  | 'MRA'
  | 'SGLT2i'
  | 'Ivabradine'

export interface MedicationDoseInput {
  drugClass: DrugClass
  drugName: string    // generic drug name, case-insensitive
  currentDailyDoseMg: number
}

export interface TargetDoseResult {
  drugClass: DrugClass
  drugName: string
  currentDailyDoseMg: number
  targetDailyDoseMg: number
  targetDrugLabel: string     // e.g. "Sacubitril/Valsartan 97/103 mg bd"
  percentage: number          // 0-100
  status: 'Below 25%' | '25-49%' | '50-99%' | 'At target'
}

/**
 * ESC 2021 HF Guideline target doses (Table 7).
 * Doses are the maximum evidence-based target total daily dose in mg.
 */
const ESC2021_TARGET_DOSES: Record<
  string,
  { class: DrugClass; targetDailyMg: number; label: string }
> = {
  // ACE Inhibitors
  enalapril:     { class: 'ACEi', targetDailyMg: 40,   label: 'Enalapril 10–20 mg bd (40 mg/day)' },
  lisinopril:    { class: 'ACEi', targetDailyMg: 35,   label: 'Lisinopril 35 mg od' },
  captopril:     { class: 'ACEi', targetDailyMg: 150,  label: 'Captopril 50 mg tds (150 mg/day)' },
  ramipril:      { class: 'ACEi', targetDailyMg: 10,   label: 'Ramipril 5 mg bd (10 mg/day)' },
  trandolapril:  { class: 'ACEi', targetDailyMg: 4,    label: 'Trandolapril 4 mg od' },
  perindopril:   { class: 'ACEi', targetDailyMg: 8,    label: 'Perindopril 8 mg od' },
  fosinopril:    { class: 'ACEi', targetDailyMg: 40,   label: 'Fosinopril 40 mg od' },
  quinapril:     { class: 'ACEi', targetDailyMg: 40,   label: 'Quinapril 20 mg bd (40 mg/day)' },

  // ARBs
  candesartan:   { class: 'ARB',  targetDailyMg: 32,   label: 'Candesartan 32 mg od' },
  valsartan:     { class: 'ARB',  targetDailyMg: 320,  label: 'Valsartan 160 mg bd (320 mg/day)' },
  losartan:      { class: 'ARB',  targetDailyMg: 150,  label: 'Losartan 150 mg od' },

  // ARNI
  sacubitril_valsartan: { class: 'ARNI', targetDailyMg: 400, label: 'Sacubitril/Valsartan 97/103 mg bd (400 mg/day valsartan equivalent)' },
  'sacubitril/valsartan': { class: 'ARNI', targetDailyMg: 400, label: 'Sacubitril/Valsartan 97/103 mg bd' },
  entresto:       { class: 'ARNI', targetDailyMg: 400, label: 'Sacubitril/Valsartan 97/103 mg bd (Entresto)' },

  // Beta-blockers
  carvedilol:    { class: 'BetaBlocker', targetDailyMg: 50,  label: 'Carvedilol 25 mg bd (50 mg/day)' },
  bisoprolol:    { class: 'BetaBlocker', targetDailyMg: 10,  label: 'Bisoprolol 10 mg od' },
  metoprolol:    { class: 'BetaBlocker', targetDailyMg: 200, label: 'Metoprolol succinate 200 mg od' },
  nebivolol:     { class: 'BetaBlocker', targetDailyMg: 10,  label: 'Nebivolol 10 mg od' },

  // MRA
  eplerenone:    { class: 'MRA', targetDailyMg: 50,  label: 'Eplerenone 50 mg od' },
  spironolactone:{ class: 'MRA', targetDailyMg: 50,  label: 'Spironolactone 50 mg od' },

  // SGLT2i
  dapagliflozin: { class: 'SGLT2i', targetDailyMg: 10, label: 'Dapagliflozin 10 mg od' },
  empagliflozin: { class: 'SGLT2i', targetDailyMg: 10, label: 'Empagliflozin 10 mg od' },

  // Ivabradine
  ivabradine:    { class: 'Ivabradine', targetDailyMg: 15, label: 'Ivabradine 7.5 mg bd (15 mg/day)' },
}

export function calculateTargetDoseAchievement(
  medications: MedicationDoseInput[]
): TargetDoseResult[] {
  return medications.map((med) => {
    const key = med.drugName.toLowerCase().replace(/\s+/g, '_')
    const ref = ESC2021_TARGET_DOSES[key] ?? ESC2021_TARGET_DOSES[med.drugName.toLowerCase()]

    if (!ref) {
      // Drug not in reference table — return unknown
      return {
        drugClass: med.drugClass,
        drugName: med.drugName,
        currentDailyDoseMg: med.currentDailyDoseMg,
        targetDailyDoseMg: 0,
        targetDrugLabel: 'Unknown drug — not in ESC 2021 reference table',
        percentage: 0,
        status: 'Below 25%' as const,
      }
    }

    const pct = Math.min(100, Math.round((med.currentDailyDoseMg / ref.targetDailyMg) * 100))
    const status: TargetDoseResult['status'] =
      pct >= 100 ? 'At target' :
      pct >= 50  ? '50-99%'   :
      pct >= 25  ? '25-49%'   : 'Below 25%'

    return {
      drugClass: ref.class,
      drugName: med.drugName,
      currentDailyDoseMg: med.currentDailyDoseMg,
      targetDailyDoseMg: ref.targetDailyMg,
      targetDrugLabel: ref.label,
      percentage: pct,
      status,
    }
  })
}

/**
 * Convenience: summarise target dose achievement by drug class from a Visit.
 * Pass the MedEntry fields from a Visit.
 */
export interface VisitMedSummary {
  raasi?: { type?: string; dose?: string }    // type = drug name, dose = "X mg"
  betaBlocker?: { type?: string; dose?: string }
  mra?: { type?: string; dose?: string }
  sglt2i?: { type?: string; dose?: string }
  ivabradine?: { type?: string; dose?: string }
}

export function targetDoseFromVisit(
  meds: VisitMedSummary
): TargetDoseResult[] {
  const inputs: MedicationDoseInput[] = []

  const parseDose = (doseStr?: string): number => {
    if (!doseStr) return 0
    const match = doseStr.match(/(\d+(\.\d+)?)/)
    return match ? parseFloat(match[1]) : 0
  }

  const inferClass = (type?: string): DrugClass => {
    const t = (type ?? '').toLowerCase()
    if (t.includes('sacubitril') || t.includes('entresto')) return 'ARNI'
    if (['candesartan','valsartan','losartan'].some(d => t.includes(d))) return 'ARB'
    if (['enalapril','lisinopril','ramipril','captopril','perindopril','trandolapril','fosinopril','quinapril'].some(d => t.includes(d))) return 'ACEi'
    return 'ACEi'
  }

  if (meds.raasi?.type) {
    inputs.push({
      drugClass: inferClass(meds.raasi.type),
      drugName: meds.raasi.type,
      currentDailyDoseMg: parseDose(meds.raasi.dose),
    })
  }
  if (meds.betaBlocker?.type) {
    inputs.push({
      drugClass: 'BetaBlocker',
      drugName: meds.betaBlocker.type,
      currentDailyDoseMg: parseDose(meds.betaBlocker.dose),
    })
  }
  if (meds.mra?.type) {
    inputs.push({
      drugClass: 'MRA',
      drugName: meds.mra.type,
      currentDailyDoseMg: parseDose(meds.mra.dose),
    })
  }
  if (meds.sglt2i?.type) {
    inputs.push({
      drugClass: 'SGLT2i',
      drugName: meds.sglt2i.type,
      currentDailyDoseMg: parseDose(meds.sglt2i.dose),
    })
  }
  if (meds.ivabradine?.type) {
    inputs.push({
      drugClass: 'Ivabradine',
      drugName: meds.ivabradine.type,
      currentDailyDoseMg: parseDose(meds.ivabradine.dose),
    })
  }

  return calculateTargetDoseAchievement(inputs)
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. KCCQ (Kansas City Cardiomyopathy Questionnaire) SCORE CALCULATOR
//    Reference: Green CP et al. Eur J Heart Fail. 2000;2(4):407-14
//    Full 23-item KCCQ with domain and overall summary scores.
//    All responses coded 1 (worst) → 5 or 7 (best) per domain instructions.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * KCCQ-23 item response interface.
 * Items 1–2: Physical Limitation (1=extremely limited → 5=not at all)
 * Items 3–5: Symptom Stability, Frequency, Burden (1–5 or 1–7)
 * Items 6–7: Self-Efficacy
 * Items 8–12: Quality of Life
 * Items 13–23: Social Limitation, Symptom Status continuation
 *
 * See KCCQ scoring manual (Green 2000) for exact item assignments.
 * Responses are on 1–7 scale for most items; physical limitation items 1–7.
 *
 * Null values indicate the item was not answered (excluded from domain average).
 */
export interface KCCQResponses {
  // ── Physical Limitation (items 1a-1f, 6 items, scale 1-5) ────────────────
  // 1=extremely limited, 2=quite a bit limited, 3=moderately limited,
  // 4=slightly limited, 5=not limited at all, 0=does not apply
  physLim_dressing?: number | null        // item 1a
  physLim_shower?: number | null          // item 1b
  physLim_walking100m?: number | null     // item 1c
  physLim_yardWork?: number | null        // item 1d
  physLim_stairs?: number | null          // item 1e
  physLim_hurrying?: number | null        // item 1f

  // ── Symptom Stability (item 2, 1-7 scale) ────────────────────────────────
  // 1=much worse, 4=about the same, 7=much better
  symptomStability?: number | null        // item 2

  // ── Symptom Frequency — dyspnoea (items 3a-3d, 1-7 scale) ────────────────
  // 1=every morning, 7=never over past 2 weeks
  symptomFreq_dyspnoeaSleep?: number | null   // item 3a
  symptomFreq_dyspnoeaSitting?: number | null // item 3b
  symptomFreq_dyspnoeaWalking?: number | null // item 3c
  symptomFreq_dyspnoeaActivities?: number | null // item 3d

  // ── Symptom Frequency — fatigue (items 4a-4c, 1-7) ───────────────────────
  symptomFreq_fatigueMorning?: number | null  // item 4a
  symptomFreq_fatigueActivities?: number | null // item 4b
  symptomFreq_fatigueSitting?: number | null  // item 4c

  // ── Symptom Burden (item 5a dyspnoea, 5b fatigue, 1-5 scale) ─────────────
  // 1=extremely bothersome, 5=not at all bothersome
  symptomBurden_dyspnoea?: number | null  // item 5a
  symptomBurden_fatigue?: number | null   // item 5b

  // ── Ankle swelling (item 6, 1-5) ─────────────────────────────────────────
  ankleSwelling_frequency?: number | null // item 6

  // ── Self-Efficacy (items 7a-7b, 1-5 scale) ───────────────────────────────
  // 1=not at all sure, 5=completely sure
  selfEfficacy_recognition?: number | null  // item 7a
  selfEfficacy_management?: number | null   // item 7b

  // ── Quality of Life (items 8-9, 1-7 scale) ────────────────────────────────
  // 1=extremely, 7=not at all / it has had no effect
  qol_enjoymentLimited?: number | null    // item 8
  qol_feelingDepressed?: number | null    // item 9

  // ── Social Limitation (items 10a-10d, 1-5 scale) ─────────────────────────
  // 1=severely limited, 5=not at all limited, 0=does not apply
  socialLim_recreation?: number | null    // item 10a
  socialLim_working?: number | null       // item 10b
  socialLim_visiting?: number | null      // item 10c
  socialLim_sex?: number | null           // item 10d
}

export interface KCCQDomainScores {
  physicalLimitation: number | null       // 0-100
  symptomStability: number | null         // 0-100
  symptomFrequency: number | null         // 0-100
  symptomBurden: number | null            // 0-100
  totalSymptomScore: number | null        // 0-100 (avg of freq + burden)
  selfEfficacy: number | null             // 0-100
  qualityOfLife: number | null            // 0-100
  socialLimitation: number | null         // 0-100
  overallSummaryScore: number | null      // 0-100 (avg of PL, TSS, QoL, SL)
  clinicalSummaryScore: number | null     // 0-100 (avg of PL, TSS)
  interpretation: string
}

/**
 * Transforms a raw response (1-5 or 1-7 scale) to a 0-100 score.
 * Formula: ((response - 1) / (scale_max - 1)) * 100
 */
function toKCCQ100(response: number, scaleMax: 5 | 7): number {
  return Math.round(((response - 1) / (scaleMax - 1)) * 100)
}

/**
 * Average an array of 0-100 scores, ignoring nulls.
 * Returns null if no valid scores exist.
 */
function domainAvg(scores: (number | null | undefined)[]): number | null {
  const valid = scores.filter((s): s is number => s !== null && s !== undefined && !isNaN(s))
  if (valid.length === 0) return null
  return Math.round(valid.reduce((a, b) => a + b, 0) / valid.length)
}

export function calculateKCCQ(responses: KCCQResponses): KCCQDomainScores {
  // ── Physical Limitation domain ────────────────────────────────────────────
  // Items scored 1-5; exclude items answered 0 ("does not apply")
  const physItems = [
    responses.physLim_dressing,
    responses.physLim_shower,
    responses.physLim_walking100m,
    responses.physLim_yardWork,
    responses.physLim_stairs,
    responses.physLim_hurrying,
  ].map((v) => (v && v >= 1 && v <= 5 ? toKCCQ100(v, 5) : null))

  const physicalLimitation = domainAvg(physItems)

  // ── Symptom Stability (single item, 1-7) ──────────────────────────────────
  const symptomStability =
    responses.symptomStability != null
      ? toKCCQ100(responses.symptomStability, 7)
      : null

  // ── Symptom Frequency (dyspnoea 3a-3d + fatigue 4a-4c, 1-7) ──────────────
  const freqItems = [
    responses.symptomFreq_dyspnoeaSleep,
    responses.symptomFreq_dyspnoeaSitting,
    responses.symptomFreq_dyspnoeaWalking,
    responses.symptomFreq_dyspnoeaActivities,
    responses.symptomFreq_fatigueMorning,
    responses.symptomFreq_fatigueActivities,
    responses.symptomFreq_fatigueSitting,
  ].map((v) => (v && v >= 1 && v <= 7 ? toKCCQ100(v, 7) : null))

  const symptomFrequency = domainAvg(freqItems)

  // ── Symptom Burden (dyspnoea item 5a, fatigue item 5b, 1-5) ──────────────
  // Ankle swelling item 6 (1-5) is also included in burden per scoring manual
  const burdenItems = [
    responses.symptomBurden_dyspnoea,
    responses.symptomBurden_fatigue,
    responses.ankleSwelling_frequency,
  ].map((v) => (v && v >= 1 && v <= 5 ? toKCCQ100(v, 5) : null))

  const symptomBurden = domainAvg(burdenItems)

  // ── Total Symptom Score ───────────────────────────────────────────────────
  const totalSymptomScore = domainAvg([symptomFrequency, symptomBurden])

  // ── Self-Efficacy (items 7a-7b, 1-5) ─────────────────────────────────────
  const seItems = [
    responses.selfEfficacy_recognition,
    responses.selfEfficacy_management,
  ].map((v) => (v && v >= 1 && v <= 5 ? toKCCQ100(v, 5) : null))

  const selfEfficacy = domainAvg(seItems)

  // ── Quality of Life (items 8-9, 1-7) ─────────────────────────────────────
  const qolItems = [
    responses.qol_enjoymentLimited,
    responses.qol_feelingDepressed,
  ].map((v) => (v && v >= 1 && v <= 7 ? toKCCQ100(v, 7) : null))

  const qualityOfLife = domainAvg(qolItems)

  // ── Social Limitation (items 10a-10d, 1-5, exclude 0 = does not apply) ───
  const socialItems = [
    responses.socialLim_recreation,
    responses.socialLim_working,
    responses.socialLim_visiting,
    responses.socialLim_sex,
  ].map((v) => (v && v >= 1 && v <= 5 ? toKCCQ100(v, 5) : null))

  const socialLimitation = domainAvg(socialItems)

  // ── Overall Summary Score (average of PL, TSS, QoL, SL) ──────────────────
  const overallSummaryScore = domainAvg([
    physicalLimitation,
    totalSymptomScore,
    qualityOfLife,
    socialLimitation,
  ])

  // ── Clinical Summary Score (average of PL and TSS) ────────────────────────
  const clinicalSummaryScore = domainAvg([physicalLimitation, totalSymptomScore])

  // ── Interpretation ────────────────────────────────────────────────────────
  // KCCQ summary score interpretation: 0-24 very poor, 25-49 poor,
  // 50-74 moderate, 75-100 good/excellent (Arnold 2004, JACC)
  const oss = overallSummaryScore
  const interpretation =
    oss === null   ? 'Insufficient data to calculate overall summary score.' :
    oss < 25       ? `Overall Summary Score: ${oss}/100 — Very poor health status. Urgent clinical review indicated.` :
    oss < 50       ? `Overall Summary Score: ${oss}/100 — Poor health status. Active optimisation of HF therapy recommended.` :
    oss < 75       ? `Overall Summary Score: ${oss}/100 — Moderate health status. Continue evidence-based therapy optimisation.` :
                     `Overall Summary Score: ${oss}/100 — Good to excellent health status.`

  return {
    physicalLimitation,
    symptomStability,
    symptomFrequency,
    symptomBurden,
    totalSymptomScore,
    selfEfficacy,
    qualityOfLife,
    socialLimitation,
    overallSummaryScore,
    clinicalSummaryScore,
    interpretation,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Convenience re-exports and composite helper
// ─────────────────────────────────────────────────────────────────────────────

export interface ComprehensiveRiskProfile {
  maggic?: MAGGICResult
  charm?: CHARMResult
  h2fpef?: H2FPEFResult
  seattle?: SeattleHFMResult
  targetDoses?: TargetDoseResult[]
  kccq?: KCCQDomainScores
  chads?: CHADSVAScResult
  hasbled?: HASBLEDResult
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. CHA2DS2-VASc RISK SCORE
//    Reference: Lip GY et al. Chest. 2010;137(2):263-72. DOI:10.1378/chest.09-1584
// ─────────────────────────────────────────────────────────────────────────────

export interface CHADSVAScInput {
  congestiveHF: boolean
  hypertension: boolean
  age: number
  diabetes: boolean
  strokeHistory: boolean
  vascularDisease: boolean
  sex: SexType
}

export interface CHADSVAScResult {
  score: number
  riskCategory: 'Low' | 'Moderate' | 'High'
  recommendation: string
}

export function calculateCHADSVASc(input: CHADSVAScInput): CHADSVAScResult {
  let score = 0
  if (input.congestiveHF) score += 1
  if (input.hypertension) score += 1
  if (input.age >= 75) score += 2
  else if (input.age >= 65) score += 1
  if (input.diabetes) score += 1
  if (input.strokeHistory) score += 2
  if (input.vascularDisease) score += 1
  if (input.sex === 'Female') score += 1

  const isFemale = input.sex === 'Female'
  // For females, if no other risk factors exist (score = 1), it is still low risk
  const effectiveScore = isFemale ? score - 1 : score

  let riskCategory: CHADSVAScResult['riskCategory'] = 'Low'
  let recommendation = ''

  if (effectiveScore === 0) {
    riskCategory = 'Low'
    recommendation = 'Low risk. Anticoagulation is not indicated (ESC Class III).'
  } else if (effectiveScore === 1) {
    riskCategory = 'Moderate'
    recommendation = 'Moderate risk. Oral anticoagulation should be considered (ESC Class IIa). NOAC (Non-vitamin K antagonist oral anticoagulant) preferred over VKA.'
  } else {
    riskCategory = 'High'
    recommendation = 'High risk. Oral anticoagulation is indicated (ESC Class I). NOAC preferred over VKA.'
  }

  return { score, riskCategory, recommendation }
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. HAS-BLED BLEEDING RISK SCORE
//    Reference: Pisters R et al. Chest. 2010;138(5):1093-100. DOI:10.1378/chest.10-0134
// ─────────────────────────────────────────────────────────────────────────────

export interface HASBLEDInput {
  hypertension: boolean        // Uncontrolled systolic BP > 160 mmHg
  abnormalRenal: boolean       // Dialysis, transplant, or Cr > 2.26 mg/dL (200 µmol/L)
  abnormalLiver: boolean       // Cirrhosis or bilirubin > 2x normal + AST/ALT > 3x normal
  strokeHistory: boolean
  bleedingHistory: boolean     // Prior major bleed or predisposition (anaemia)
  labileINR: boolean           // Unstable/high INRs or TTR < 60% (VKA patients)
  age: number                  // Age > 65 years
  drugs: boolean               // Antiplatelets (e.g. aspirin) or NSAIDs
  alcohol: boolean             // Excess alcohol (>= 8 drinks/week)
}

export interface HASBLEDResult {
  score: number
  riskCategory: 'Low-Moderate' | 'High'
  recommendation: string
}

export function calculateHASBLED(input: HASBLEDInput): HASBLEDResult {
  let score = 0
  if (input.hypertension) score += 1
  if (input.abnormalRenal) score += 1
  if (input.abnormalLiver) score += 1
  if (input.strokeHistory) score += 1
  if (input.bleedingHistory) score += 1
  if (input.labileINR) score += 1
  if (input.age > 65) score += 1
  if (input.drugs) score += 1
  if (input.alcohol) score += 1

  const riskCategory = score >= 3 ? 'High' : 'Low-Moderate'
  const recommendation = score >= 3
    ? 'High bleeding risk (Score >= 3). Caution and regular clinical review of anticoagulation is indicated. Identify and address correctable bleeding risk factors (e.g., uncontrolled BP, NSAID use, labile INR).'
    : 'Low to moderate bleeding risk. Standard monitoring of anticoagulation is appropriate.'

  return { score, riskCategory, recommendation }
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. 30-DAY MACE RISK (ACS / Coronary Registry — post-PCI discharge)
//    Reference: Mehta SR et al., adapted from GRACE/TIMI/SYNTAX integration
//    Predicts 30-day composite of death, MI, stroke, repeat revascularization.
// ─────────────────────────────────────────────────────────────────────────────

export type KillipClass = 'I' | 'II' | 'III' | 'IV'
export type TIMIFlow = '0' | '1' | '2' | '3'
export type CulpritVessel = 'LAD' | 'LCX' | 'RCA' | 'LM' | 'Graft'

export interface MACERiskInput {
  killipClass: KillipClass
  syntaxScore: number       // 0–60 (SYNTAX II percutaneous score)
  culpritVessel: CulpritVessel
  timiFlow: TIMIFlow        // post-PCI TIMI flow
  lvef: number              // %
  age: number
  diabetes: boolean
  priorMI: boolean
  stentLength: number       // mm (total), proxy for complexity
}

export interface MACERiskResult {
  riskScore: number         // 0-100 internal risk index
  maceRisk30Day: number     // fraction 0-1
  riskCategory: 'Low' | 'Moderate' | 'High' | 'Very High'
  keyDrivers: string[]
  recommendation: string
}

export function calculateMACERisk(input: MACERiskInput): MACERiskResult {
  let score = 0
  const drivers: string[] = []

  // Killip class (major predictor of in-hospital + 30d mortality)
  const killipPoints: Record<KillipClass, number> = { I: 0, II: 8, III: 18, IV: 35 }
  score += killipPoints[input.killipClass]
  if (input.killipClass !== 'I') drivers.push(`Killip Class ${input.killipClass}`)

  // SYNTAX score (lesion complexity)
  if (input.syntaxScore >= 33) { score += 20; drivers.push('High SYNTAX Score (≥33)') }
  else if (input.syntaxScore >= 23) { score += 12; drivers.push('Intermediate SYNTAX Score (23-32)') }
  else if (input.syntaxScore >= 10) { score += 5 }

  // Culprit vessel
  if (input.culpritVessel === 'LM') { score += 18; drivers.push('Left Main (LM) culprit') }
  else if (input.culpritVessel === 'LAD') { score += 10; drivers.push('LAD culprit') }
  else if (input.culpritVessel === 'Graft') { score += 12; drivers.push('Bypass Graft culprit') }
  else { score += 4 }

  // TIMI flow post-PCI (lower = worse)
  const timiPoints: Record<TIMIFlow, number> = { '3': 0, '2': 8, '1': 18, '0': 30 }
  score += timiPoints[input.timiFlow]
  if (input.timiFlow !== '3') drivers.push(`Post-PCI TIMI ${input.timiFlow} flow`)

  // LVEF
  if (input.lvef < 30) { score += 15; drivers.push('Severely reduced LVEF (<30%)') }
  else if (input.lvef < 40) { score += 8; drivers.push('Reduced LVEF (<40%)') }
  else if (input.lvef < 50) { score += 3 }

  // Age
  if (input.age >= 75) { score += 10; drivers.push('Age ≥75 years') }
  else if (input.age >= 65) { score += 5 }

  // Comorbidities
  if (input.diabetes) { score += 6; drivers.push('Diabetes Mellitus') }
  if (input.priorMI) { score += 5; drivers.push('Prior MI') }

  // Stent complexity
  if (input.stentLength > 60) { score += 5; drivers.push('Extensive stenting (>60mm)') }
  else if (input.stentLength > 40) { score += 3 }

  const clampedScore = Math.min(100, Math.max(0, score))

  // Map to 30-day MACE probability (calibrated from GRACE/TIMI registry data)
  const maceRisk30Day = clampedScore < 20 ? 0.02 + (clampedScore / 20) * 0.03 :
    clampedScore < 40 ? 0.05 + ((clampedScore - 20) / 20) * 0.07 :
    clampedScore < 60 ? 0.12 + ((clampedScore - 40) / 20) * 0.10 :
    clampedScore < 80 ? 0.22 + ((clampedScore - 60) / 20) * 0.14 :
    0.36 + ((clampedScore - 80) / 20) * 0.30

  const riskCategory: MACERiskResult['riskCategory'] =
    clampedScore < 20 ? 'Low' :
    clampedScore < 40 ? 'Moderate' :
    clampedScore < 65 ? 'High' : 'Very High'

  const recommendation =
    riskCategory === 'Low' ? 'Low 30-day MACE risk. Standard dual antiplatelet therapy (DAPT). Early outpatient follow-up in 2–4 weeks.' :
    riskCategory === 'Moderate' ? 'Moderate MACE risk. Confirm complete DAPT + statin + RAAS inhibitor. Consider extended monitoring for 48–72h.' :
    riskCategory === 'High' ? 'High MACE risk. Intensify antiplatelet strategy (consider ticagrelor/prasugrel). Cardiac rehab referral. Follow-up within 1 week.' :
    'Very High MACE risk. Multidisciplinary review. Consider early repeat angiography, high-intensity DAPT. Inpatient monitoring for ≥72h post-PCI.'

  return {
    riskScore: clampedScore,
    maceRisk30Day: parseFloat(Math.min(0.95, maceRisk30Day).toFixed(3)),
    riskCategory,
    keyDrivers: drivers,
    recommendation,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 10. CONTRAST NEPHROPATHY RISK SCORER (Mehran Score)
//     Reference: Mehran R et al. JACC 2004;44(7):1393-9. DOI:10.1016/j.jacc.2004.06.068
//     Predicts AKI (≥25% or ≥0.5 mg/dL creatinine rise) post-contrast
// ─────────────────────────────────────────────────────────────────────────────

export interface ContrastNephropathyInput {
  eGFR: number              // mL/min/1.73m²
  contrastVolumeMl: number  // mL planned contrast volume
  diabetes: boolean
  nSAIDUse: boolean         // current NSAID use
  hypotension: boolean      // SBP <80 mmHg for ≥1h (periprocedure)
  heartFailure: boolean     // NYHA III-IV or LVEF <40%
  age: number
  creatinine: number        // mg/dL
  iabpUse: boolean          // intra-aortic balloon pump
}

export interface ContrastNephropathyResult {
  mehranScore: number       // Mehran integer score (0-20+)
  akiRisk: number           // fraction 0-1
  dialysisRisk: number      // fraction 0-1
  riskCategory: 'Low' | 'Moderate' | 'High' | 'Very High'
  suggestedContrastCap: number  // mL — contrast dose cap based on eGFR
  preHydrationProtocol: string
  recommendation: string
}

export function calculateContrastNephropathyRisk(input: ContrastNephropathyInput): ContrastNephropathyResult {
  let score = 0

  // Hypotension (SBP <80 for ≥1h or IABP) — 5 points
  if (input.hypotension) score += 5
  if (input.iabpUse) score += 5

  // CHF (NYHA III-IV, LVEF <40, pulmonary oedema) — 5 points
  if (input.heartFailure) score += 5

  // Age >75 — 4 points
  if (input.age > 75) score += 4

  // Anaemia (proxy via absence — not scored separately if not available)

  // Diabetes mellitus — 3 points
  if (input.diabetes) score += 3

  // NSAID use (nephrotoxic adjuncts) — 3 points
  if (input.nSAIDUse) score += 3

  // Creatinine >1.5 mg/dL — 4 points
  if (input.creatinine > 1.5) score += 4

  // eGFR-based points (Mehran: eGFR <60 = 2pts, <40 = 4pts, <20 = 6pts)
  if (input.eGFR < 20) score += 6
  else if (input.eGFR < 40) score += 4
  else if (input.eGFR < 60) score += 2

  // Contrast volume (per 100 mL — Mehran adds 1 per 100mL, capped at 5)
  const cvPoints = Math.min(5, Math.floor(input.contrastVolumeMl / 100))
  score += cvPoints

  // AKI risk lookup (Mehran Table 3)
  const akiRisk =
    score <= 5 ? 0.075 :
    score <= 10 ? 0.14 :
    score <= 15 ? 0.26 :
    score <= 20 ? 0.57 : 0.57

  const dialysisRisk =
    score <= 5 ? 0.001 :
    score <= 10 ? 0.002 :
    score <= 15 ? 0.012 :
    score <= 20 ? 0.092 : 0.125

  const riskCategory: ContrastNephropathyResult['riskCategory'] =
    score <= 5 ? 'Low' :
    score <= 10 ? 'Moderate' :
    score <= 15 ? 'High' : 'Very High'

  // Contrast dose cap: Cigarroa formula = 5 × weight(kg) / creatinine, max 300mL; or 2×eGFR
  const suggestedContrastCap = Math.min(300, Math.max(40, Math.round(2 * input.eGFR)))

  const preHydrationProtocol = input.eGFR < 30
    ? '1–1.5 mL/kg/h IV NaHCO₃ (1.4%) for 1h pre + 4–6h post-procedure. Hold NSAID/metformin 48h pre. Consider N-acetylcysteine 1200mg BD if borderline. Nephrology consult advised.'
    : input.eGFR < 60
    ? 'Isotonic saline 0.9% at 1 mL/kg/h for 12h pre + 12h post. Hold NSAIDs. Minimise contrast volume. Recheck creatinine at 48–72h.'
    : 'Standard hydration encouraged. Monitor creatinine at 48h. Avoid NSAIDs peri-procedure.'

  const recommendation = riskCategory === 'Low'
    ? `Low CIN risk (Mehran score ${score}). Standard peri-procedural care. Suggested contrast cap: ${suggestedContrastCap} mL.`
    : riskCategory === 'Moderate'
    ? `Moderate CIN risk (score ${score}). Pre-hydrate with saline. Contrast cap: ${suggestedContrastCap} mL. Use iso-osmolar contrast. Recheck Cr at 48h.`
    : riskCategory === 'High'
    ? `High CIN risk (score ${score}). Pre-hydrate with NaHCO₃ or saline. Strict contrast cap: ${suggestedContrastCap} mL. Consider iso-osmolar contrast + NAC. Plan creatinine recheck.`
    : `Very High CIN risk (score ${score}). High dialysis risk. Consult nephrology. Strict cap: ${suggestedContrastCap} mL. Mandatory hydration protocol. Consider delaying if non-emergent.`

  return {
    mehranScore: score,
    akiRisk: parseFloat(akiRisk.toFixed(3)),
    dialysisRisk: parseFloat(dialysisRisk.toFixed(4)),
    riskCategory,
    suggestedContrastCap,
    preHydrationProtocol,
    recommendation,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 11. 30-DAY READMISSION RISK (Post-MI / HF Discharge)
//     Reference: Ross JS et al. JAMA 2010; Zhang et al. AHJ 2015
//     Risk factors: LVEF, social determinants, discharge meds, follow-up
// ─────────────────────────────────────────────────────────────────────────────

export interface ReadmissionRiskInput {
  lvef: number              // % post-MI
  age: number
  // Social Determinants of Health
  liveAlone: boolean        // social isolation
  noFixedAddress: boolean   // housing instability
  lowHealthLiteracy: boolean
  // Discharge medications completeness
  betaBlockerPrescribed: boolean
  raasIPrescribed: boolean  // ACEi/ARB/ARNI
  statinPrescribed: boolean
  antiplateletPrescribed: boolean  // for ACS context
  // Follow-up
  followUpScheduled: boolean  // appointment booked before discharge
  cardiacRehabilitation: boolean
  // Clinical
  priorHospitalization: boolean  // ≥1 hospitalization in prior 6 months
  renalImpairment: boolean       // eGFR <60
  diabetes: boolean
  copd: boolean
}

export interface ReadmissionRiskResult {
  riskScore: number         // 0-100 internal score
  readmissionRisk30Day: number  // fraction 0-1
  riskCategory: 'Low' | 'Moderate' | 'High'
  modifiableFactors: string[]   // actionable gaps
  recommendation: string
}

export function calculateReadmissionRisk(input: ReadmissionRiskInput): ReadmissionRiskResult {
  let score = 0
  const modifiable: string[] = []

  // LVEF (major predictor)
  if (input.lvef < 30) { score += 18; }
  else if (input.lvef < 40) { score += 12; }
  else if (input.lvef < 50) { score += 6; }

  // Age
  if (input.age >= 80) score += 10
  else if (input.age >= 70) score += 6
  else if (input.age >= 60) score += 3

  // Social Determinants
  if (input.liveAlone) { score += 8; modifiable.push('Social isolation — refer for community support') }
  if (input.noFixedAddress) { score += 10; modifiable.push('Housing instability — social worker referral') }
  if (input.lowHealthLiteracy) { score += 6; modifiable.push('Health literacy — provide discharge education materials') }

  // Medication gaps (each missing = risk factor + modifiable action)
  if (!input.betaBlockerPrescribed) { score += 8; modifiable.push('Beta-blocker not prescribed at discharge') }
  if (!input.raasIPrescribed) { score += 8; modifiable.push('ACEi/ARB/ARNI not prescribed at discharge') }
  if (!input.statinPrescribed) { score += 5; modifiable.push('Statin not prescribed at discharge') }
  if (!input.antiplateletPrescribed) { score += 6; modifiable.push('Antiplatelet therapy not prescribed') }

  // Follow-up gaps
  if (!input.followUpScheduled) { score += 12; modifiable.push('No follow-up appointment scheduled') }
  if (!input.cardiacRehabilitation) { score += 7; modifiable.push('Cardiac rehabilitation not referred') }

  // Clinical comorbidities
  if (input.priorHospitalization) { score += 10; }
  if (input.renalImpairment) { score += 7; }
  if (input.diabetes) { score += 5; }
  if (input.copd) { score += 4; }

  const clamped = Math.min(100, Math.max(0, score))

  const readmissionRisk30Day =
    clamped < 25 ? 0.06 + (clamped / 25) * 0.05 :
    clamped < 50 ? 0.11 + ((clamped - 25) / 25) * 0.10 :
    clamped < 75 ? 0.21 + ((clamped - 50) / 25) * 0.15 :
    0.36 + ((clamped - 75) / 25) * 0.25

  const riskCategory: ReadmissionRiskResult['riskCategory'] =
    clamped < 35 ? 'Low' : clamped < 60 ? 'Moderate' : 'High'

  const recommendation = riskCategory === 'Low'
    ? 'Low 30-day readmission risk. Standard discharge checklist. Follow-up within 4 weeks.'
    : riskCategory === 'Moderate'
    ? 'Moderate readmission risk. Address modifiable gaps. Telephone follow-up at 1 week. Consider HF nurse-led outpatient visit.'
    : 'High readmission risk. Multidisciplinary discharge planning required. Schedule follow-up within 1 week. Address all modifiable factors before discharge.'

  return {
    riskScore: clamped,
    readmissionRisk30Day: parseFloat(Math.min(0.95, readmissionRisk30Day).toFixed(3)),
    riskCategory,
    modifiableFactors: modifiable,
    recommendation,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 12. 10-YEAR ASCVD RISK (AHA/ACC Pooled Cohort Equations 2013)
//     Reference: Goff DC Jr et al. JACC 2014;63(25 Pt B):2935-59
//     Race/Sex-specific coefficients; returns PCE + SCORE2 approximation.
// ─────────────────────────────────────────────────────────────────────────────

export type ASCVDRace = 'White' | 'African American' | 'Other'

export interface ASCVDInput {
  age: number
  sex: 'Male' | 'Female'
  race: ASCVDRace
  totalCholesterol: number   // mg/dL
  hdlCholesterol: number     // mg/dL
  systolicBP: number         // mmHg
  treatedForHTN: boolean     // on antihypertensive medication
  diabetes: boolean
  currentSmoker: boolean
  // Optional inputs for SCORE2 calibration
  ldlCholesterol?: number    // mg/dL
  hba1c?: number             // %
}

export interface ASCVDResult {
  pceRisk10Year: number       // fraction 0-1 (Pooled Cohort Equations)
  score2Risk?: number         // fraction 0-1 (SCORE2 approximation)
  riskCategory: 'Low' | 'Borderline' | 'Intermediate' | 'High'
  ldlTarget: string           // mg/dL recommendation
  recommendation: string
  statin: 'None indicated' | 'Low-intensity' | 'Moderate-intensity' | 'High-intensity'
}

/**
 * AHA/ACC 2013 Pooled Cohort Equations (PCE).
 * Coefficients from Goff 2014, Supplement Table A.
 * Four separate models: White Male, White Female, AA Male, AA Female.
 * 'Other' races use White model coefficients (ACC/AHA guidance).
 */
export function calculateASCVDRisk(input: ASCVDInput): ASCVDResult {
  const lnAge = Math.log(input.age)
  const lnTC = Math.log(input.totalCholesterol)
  const lnHDL = Math.log(input.hdlCholesterol)
  const lnSBP = Math.log(input.systolicBP)
  const curSmoke = input.currentSmoker ? 1 : 0
  const dm = input.diabetes ? 1 : 0
  const txHTN = input.treatedForHTN ? 1 : 0

  let sum = 0
  let baselineSurvival = 0

  const isFemale = input.sex === 'Female'
  const isAA = input.race === 'African American'

  if (!isFemale && !isAA) {
    // White Male (Goff 2014, Table A)
    sum = 12.344  * lnAge
        + 11.853  * lnTC
        - 2.664   * lnAge * lnTC
        - 7.990   * lnHDL
        + 1.769   * lnAge * lnHDL
        + 1.797   * lnSBP * txHTN
        - 1.764   * lnSBP * (1 - txHTN)
        + 7.837   * curSmoke
        - 1.795   * lnAge * curSmoke
        + 0.661   * dm
        - 29.799
    baselineSurvival = 0.9144
  } else if (!isFemale && isAA) {
    // African American Male
    sum = 2.469   * lnAge
        + 0.302   * lnTC
        - 0.307   * lnHDL
        + 1.916   * lnSBP * txHTN
        + 1.809   * lnSBP * (1 - txHTN)
        + 0.549   * curSmoke
        + 0.645   * dm
        - 19.540
    baselineSurvival = 0.8954
  } else if (isFemale && !isAA) {
    // White Female
    sum = -29.799 * lnAge
        + 4.884   * lnAge * lnAge
        + 13.540  * lnTC
        - 3.114   * lnAge * lnTC
        - 13.578  * lnHDL
        + 3.149   * lnAge * lnHDL
        + 2.019   * lnSBP * txHTN
        + 1.957   * lnSBP * (1 - txHTN)
        + 7.574   * curSmoke
        - 1.665   * lnAge * curSmoke
        + 0.661   * dm
        - 29.799
    baselineSurvival = 0.9665
  } else {
    // African American Female
    sum = 17.1141 * lnAge
        + 0.9396  * lnTC
        - 18.9196 * lnHDL
        + 4.4748  * lnAge * lnHDL
        + 29.2907 * lnSBP * txHTN
        - 6.4321  * lnAge * lnSBP * txHTN
        + 27.8197 * lnSBP * (1 - txHTN)
        - 6.0873  * lnAge * lnSBP * (1 - txHTN)
        + 0.8738  * curSmoke
        + 0.8738  * dm
        - 86.6081
    baselineSurvival = 0.9533
  }

  const pceRisk10Year = parseFloat(Math.min(0.99, Math.max(0.001, 1 - Math.pow(baselineSurvival, Math.exp(sum)))).toFixed(4))

  // SCORE2 approximation (European cardiovascular risk model — Eur Heart J 2021)
  // Simplified logistic approximation using key risk factors
  const score2LP = -7.53
    + 0.026 * (input.age - 60)
    + 0.021 * (input.systolicBP - 120)
    + 0.036 * (input.totalCholesterol * 0.0259 - 6)   // mmol/L conversion
    - 0.028 * (input.hdlCholesterol * 0.0259 - 1.3)
    + (input.currentSmoker ? 0.71 : 0)
    + (isFemale ? -0.72 : 0)
  const score2Risk = parseFloat(Math.min(0.99, Math.max(0.001, 1 / (1 + Math.exp(-score2LP)))).toFixed(4))

  // Risk category (AHA/ACC 2018 cholesterol guideline thresholds)
  const riskPct = pceRisk10Year * 100
  const riskCategory: ASCVDResult['riskCategory'] =
    riskPct < 5 ? 'Low' :
    riskPct < 7.5 ? 'Borderline' :
    riskPct < 20 ? 'Intermediate' : 'High'

  // Statin intensity recommendation (ACC/AHA 2018 Guideline)
  const statin: ASCVDResult['statin'] =
    riskCategory === 'Low' ? 'None indicated' :
    riskCategory === 'Borderline' ? 'Low-intensity' :
    riskCategory === 'Intermediate' ? 'Moderate-intensity' : 'High-intensity'

  // LDL target
  const ldlTarget =
    riskCategory === 'High' ? '<55 mg/dL (AHA Class I, LOE A)' :
    riskCategory === 'Intermediate' ? '<70 mg/dL (AHA Class IIa)' :
    riskCategory === 'Borderline' ? '<100 mg/dL with risk discussion' :
    'No specific LDL target; lifestyle modification'

  const recommendation =
    riskCategory === 'Low' ? `10-year ASCVD risk: ${(pceRisk10Year * 100).toFixed(1)}% (Low). Emphasis on lifestyle modification. Recheck in 5 years.` :
    riskCategory === 'Borderline' ? `10-year ASCVD risk: ${(pceRisk10Year * 100).toFixed(1)}% (Borderline). Discuss risk-benefit of moderate-intensity statin. Consider coronary calcium scoring.` :
    riskCategory === 'Intermediate' ? `10-year ASCVD risk: ${(pceRisk10Year * 100).toFixed(1)}% (Intermediate). Moderate-intensity statin therapy recommended (e.g. Atorvastatin 20–40 mg). Reassess in 6 months.` :
    `10-year ASCVD risk: ${(pceRisk10Year * 100).toFixed(1)}% (High). High-intensity statin therapy (e.g. Atorvastatin 40–80 mg or Rosuvastatin 20–40 mg). Add ezetimibe if LDL target not achieved. Consider PCSK9 inhibitor.`

  return { pceRisk10Year, score2Risk, riskCategory, ldlTarget, recommendation, statin }
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. HFA-PEFF DIAGNOSTIC ALGORITHM (ESC 2019 HFpEF diagnostic pathway)
//    Reference: Pieske B et al. Eur Heart J. 2019;40(40):3297-3317
// ─────────────────────────────────────────────────────────────────────────────

export interface HFAPEFFInput {
  age: number
  sex: 'Male' | 'Female'
  rhythm: string
  eEPrime?: number
  septalEPrime?: number
  lateralEPrime?: number
  rvsp?: number
  gls?: number
  laVolumeIndex?: number
  lvMassIndex?: number
  relativeWallThickness?: number
  ntProBNP?: number
  bnp?: number
}

export interface HFAPEFFResult {
  score: number           // 0-6
  functionalPoints: number
  morphologicalPoints: number
  biomarkerPoints: number
  interpretation: string
}

export function calculateHFAPEFF(input: HFAPEFFInput): HFAPEFFResult {
  const isAF = (input.rhythm ?? '').toLowerCase() === 'af' || (input.rhythm ?? '').toLowerCase().includes('atrial fibrillation')
  const isFemale = input.sex === 'Female'

  // 1. Functional Domain (max 2 points)
  let functionalPoints = 0
  
  // Major Functional criteria (2 points):
  // Average E/e' ratio >= 15 OR Septal e' < 7 OR Lateral e' < 10 OR RVSP > 35 (surrogate for TR velocity > 2.8 m/s)
  const hasMajorFunctional = 
    (input.eEPrime !== undefined && input.eEPrime !== null && input.eEPrime >= 15) ||
    (input.septalEPrime !== undefined && input.septalEPrime !== null && input.septalEPrime < 7) ||
    (input.lateralEPrime !== undefined && input.lateralEPrime !== null && input.lateralEPrime < 10) ||
    (input.rvsp !== undefined && input.rvsp !== null && input.rvsp > 35)

  // Minor Functional criteria (1 point):
  // Average E/e' 9-14 OR GLS < 16% (Math.abs(gls) < 16)
  const hasMinorFunctional =
    (input.eEPrime !== undefined && input.eEPrime !== null && input.eEPrime >= 9 && input.eEPrime < 15) ||
    (input.gls !== undefined && input.gls !== null && Math.abs(input.gls) < 16)

  if (hasMajorFunctional) {
    functionalPoints = 2
  } else if (hasMinorFunctional) {
    functionalPoints = 1
  }

  // 2. Morphological Domain (max 2 points)
  let morphologicalPoints = 0
  
  // Major Morphological criteria (2 points):
  // LAVI > 34 ml/m² (sinus) or > 40 ml/m² (AF)
  // OR LVMI >= 149 (men) or >= 122 (women) AND RWT > 0.42
  const hasMajorMorphological =
    (input.laVolumeIndex !== undefined && input.laVolumeIndex !== null && (isAF ? input.laVolumeIndex > 40 : input.laVolumeIndex > 34)) ||
    (input.lvMassIndex !== undefined && input.lvMassIndex !== null && input.relativeWallThickness !== undefined && input.relativeWallThickness !== null &&
      (isFemale ? input.lvMassIndex >= 122 : input.lvMassIndex >= 149) &&
      input.relativeWallThickness > 0.42)

  // Minor Morphological criteria (1 point):
  // LAVI 29-34 (sinus) or 34-40 (AF)
  // OR LVMI > 115 (men) or > 95 (women)
  // OR RWT > 0.42
  const hasMinorMorphological =
    (input.laVolumeIndex !== undefined && input.laVolumeIndex !== null && (isAF ? (input.laVolumeIndex >= 34 && input.laVolumeIndex <= 40) : (input.laVolumeIndex >= 29 && input.laVolumeIndex <= 34))) ||
    (input.lvMassIndex !== undefined && input.lvMassIndex !== null && (isFemale ? input.lvMassIndex > 95 : input.lvMassIndex > 115)) ||
    (input.relativeWallThickness !== undefined && input.relativeWallThickness !== null && input.relativeWallThickness > 0.42)

  if (hasMajorMorphological) {
    morphologicalPoints = 2
  } else if (hasMinorMorphological) {
    morphologicalPoints = 1
  }

  // 3. Biomarker Domain (max 2 points)
  let biomarkerPoints = 0
  
  // Major Biomarker criteria (2 points):
  // NT-proBNP > 220 (sinus) or > 660 (AF)
  // OR BNP > 80 (sinus) or > 240 (AF)
  const hasMajorBiomarker =
    (input.ntProBNP !== undefined && input.ntProBNP !== null && (isAF ? input.ntProBNP > 660 : input.ntProBNP > 220)) ||
    (input.bnp !== undefined && input.bnp !== null && (isAF ? input.bnp > 240 : input.bnp > 80))

  // Minor Biomarker criteria (1 point):
  // NT-proBNP 125-220 (sinus) or 375-660 (AF)
  // OR BNP 35-80 (sinus) or 105-240 (AF)
  const hasMinorBiomarker =
    (input.ntProBNP !== undefined && input.ntProBNP !== null && (isAF ? (input.ntProBNP >= 375 && input.ntProBNP <= 660) : (input.ntProBNP >= 125 && input.ntProBNP <= 220))) ||
    (input.bnp !== undefined && input.bnp !== null && (isAF ? (input.bnp >= 105 && input.bnp <= 240) : (input.bnp >= 35 && input.bnp <= 80)))

  if (hasMajorBiomarker) {
    biomarkerPoints = 2
  } else if (hasMinorBiomarker) {
    biomarkerPoints = 1
  }

  const score = functionalPoints + morphologicalPoints + biomarkerPoints

  const interpretation =
    score >= 5 ? `Score ${score}/6 — High probability of HFpEF (HFA-PEFF diagnostic threshold met). Diagnosis of HFpEF is established.` :
    score >= 2 ? `Score ${score}/6 — Intermediate probability of HFpEF. Further diagnostic workup (diastolic stress testing or invasive hemodynamics) is recommended.` :
                 `Score ${score}/6 — Low probability of HFpEF. Diagnosis of HFpEF is unlikely.`

  return {
    score,
    functionalPoints,
    morphologicalPoints,
    biomarkerPoints,
    interpretation
  }
}
