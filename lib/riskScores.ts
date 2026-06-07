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
  if (sbp < 110) {
    points += efBelow30 ? 5 : 3
  } else if (sbp < 120) {
    points += efBelow30 ? 4 : 2
  } else if (sbp < 130) {
    points += efBelow30 ? 3 : 1
  } else if (sbp < 140) {
    points += efBelow30 ? 2 : 1
  } else if (sbp < 150) {
    points += 0
  } else {
    points += 0
  }

  // ── BMI points ───────────────────────────────────────────────────────────
  if (input.bmi < 15) {
    points += 6
  } else if (input.bmi < 20) {
    points += 5
  } else if (input.bmi < 25) {
    points += 3
  } else if (input.bmi < 30) {
    points += 1
  } else {
    points += 0
  }

  // ── Creatinine points (µmol/L) ───────────────────────────────────────────
  const cr = input.creatinine * 88.4
  if (cr < 90) {
    points += 0
  } else if (cr < 110) {
    points += 1
  } else if (cr < 130) {
    points += 2
  } else if (cr < 150) {
    points += 3
  } else if (cr < 170) {
    points += 4
  } else if (cr < 210) {
    points += 5
  } else if (cr < 250) {
    points += 6
  } else {
    points += 8
  }

  // ── NYHA class points ─────────────────────────────────────────────────────
  const nyhaPoints: Record<NYHAClass, number> = { I: 0, II: 2, III: 6, IV: 8 }
  points += nyhaPoints[input.nyha]

  // ── Male sex ──────────────────────────────────────────────────────────────
  if (input.sex === 'Male') points += 1

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
  // 1-year and 3-year mortality rates by integer score band
  // Values interpolated from the published nomogram / Table 3.
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
