/**
 * clinicalCalculations.ts
 * Rigorous evidence-based clinical formulas and computations.
 *
 * References:
 * - CKD-EPI 2021: Inker LA, Eneanya ND, Coresh J, et al. New Creatinine- and Cystatin C-Based Equations
 *   to Estimate GFR without Race. N Engl J Med. 2021;385(19):1737-1749. DOI: 10.1056/NEJMoa2102953
 * - BMI: World Health Organization (WHO) BMI classification
 * - MAP (Mean Arterial Pressure): (2 * DBP + SBP) / 3
 * - Pulse Pressure: SBP - DBP
 */

export interface CKDEPIInput {
  age: number
  sex: 'Male' | 'Female' | 'Other' | string
  creatinine: number // in mg/dL or umol/L depending on unit
  unit?: 'mg/dL' | 'umol/L'
}

export interface CKDEPIResult {
  egfr: number // mL/min/1.73 m²
  stage: 'G1' | 'G2' | 'G3a' | 'G3b' | 'G4' | 'G5'
  stageDescription: string
  severity: 'Normal' | 'Mild' | 'Moderate' | 'Severe' | 'Kidney Failure'
  color: string
  recommendation: string
}

/**
 * Calculates Estimated Glomerular Filtration Rate (eGFR) using the 2021 CKD-EPI Creatinine Equation (Race-neutral).
 */
export function calculateCKDEPI_eGFR({ age, sex, creatinine, unit = 'mg/dL' }: CKDEPIInput): CKDEPIResult | null {
  if (!age || age < 18 || !creatinine || creatinine <= 0) return null

  // Convert umol/L to mg/dL if needed (1 mg/dL = 88.4 umol/L)
  const scr = unit === 'umol/L' ? creatinine / 88.4 : creatinine
  if (scr <= 0.1 || scr > 30) return null

  const isFemale = String(sex).toLowerCase() === 'female' || String(sex).toLowerCase() === 'f'

  const kappa = isFemale ? 0.7 : 0.9
  const alpha = isFemale ? -0.241 : -0.302
  const genderMultiplier = isFemale ? 1.012 : 1.0

  const scrOverKappa = scr / kappa
  const minTerm = Math.pow(Math.min(scrOverKappa, 1), alpha)
  const maxTerm = Math.pow(Math.max(scrOverKappa, 1), -1.200)
  const ageTerm = Math.pow(0.9938, age)

  const rawEgfr = 142 * minTerm * maxTerm * ageTerm * genderMultiplier
  const egfr = Math.round(rawEgfr * 10) / 10

  let stage: 'G1' | 'G2' | 'G3a' | 'G3b' | 'G4' | 'G5' = 'G1'
  let stageDescription = 'Normal or high renal function'
  let severity: 'Normal' | 'Mild' | 'Moderate' | 'Severe' | 'Kidney Failure' = 'Normal'
  let color = '#10b981' // emerald
  let recommendation = 'Standard HF guideline medical therapy; monitor creatinine annually.'

  if (egfr >= 90) {
    stage = 'G1'
    stageDescription = 'Stage 1: Normal or high (≥90 mL/min/1.73 m²)'
    severity = 'Normal'
    color = '#10b981'
    recommendation = 'Standard GDMT tolerated without renal dose adjustment.'
  } else if (egfr >= 60) {
    stage = 'G2'
    stageDescription = 'Stage 2: Mildly decreased (60–89 mL/min/1.73 m²)'
    severity = 'Mild'
    color = '#3b82f6'
    recommendation = 'Monitor renal function and electrolytes every 6 months.'
  } else if (egfr >= 45) {
    stage = 'G3a'
    stageDescription = 'Stage 3a: Mild-to-moderate decrease (45–59 mL/min/1.73 m²)'
    severity = 'Moderate'
    color = '#f59e0b'
    recommendation = 'Monitor eGFR & K+ every 3 months. Maintain GDMT including SGLT2i.'
  } else if (egfr >= 30) {
    stage = 'G3b'
    stageDescription = 'Stage 3b: Moderate-to-severe decrease (30–44 mL/min/1.73 m²)'
    severity = 'Moderate'
    color = '#f97316'
    recommendation = 'Caution with MRA initiation if K+ > 5.0. SGLT2i indicated down to eGFR 20.'
  } else if (egfr >= 15) {
    stage = 'G4'
    stageDescription = 'Stage 4: Severely decreased (15–29 mL/min/1.73 m²)'
    severity = 'Severe'
    color = '#ef4444'
    recommendation = 'Nephrology consultation recommended. Close monitoring of K+ and volume status.'
  } else {
    stage = 'G5'
    stageDescription = 'Stage 5: Kidney failure (<15 mL/min/1.73 m²)'
    severity = 'Kidney Failure'
    color = '#b91c1c'
    recommendation = 'Renal replacement therapy evaluation. Adjust or hold RAASi/MRA under specialist guidance.'
  }

  return {
    egfr,
    stage,
    stageDescription,
    severity,
    color,
    recommendation,
  }
}

/**
 * Calculates BMI and classifies nutritional risk.
 */
export function calculateBMI(weightKg: number, heightCm: number): { bmi: number; category: string; color: string } | null {
  if (!weightKg || !heightCm || weightKg <= 0 || heightCm <= 0) return null
  const heightM = heightCm / 100
  const bmi = Math.round((weightKg / (heightM * heightM)) * 10) / 10

  let category = 'Normal'
  let color = '#10b981'

  if (bmi < 18.5) {
    category = 'Underweight / Cardiac Cachexia Risk'
    color = '#f59e0b'
  } else if (bmi < 25) {
    category = 'Normal weight'
    color = '#10b981'
  } else if (bmi < 30) {
    category = 'Overweight'
    color = '#3b82f6'
  } else if (bmi < 35) {
    category = 'Obesity Class I'
    color = '#f97316'
  } else if (bmi < 40) {
    category = 'Obesity Class II'
    color = '#ef4444'
  } else {
    category = 'Obesity Class III (Severe)'
    color = '#b91c1c'
  }

  return { bmi, category, color }
}

/**
 * Calculates Mean Arterial Pressure (MAP) and Pulse Pressure.
 */
export function calculateHemodynamics(sbp: number, dbp: number): { map: number; pulsePressure: number } | null {
  if (!sbp || !dbp || sbp <= dbp) return null
  const map = Math.round(((2 * dbp + sbp) / 3) * 10) / 10
  const pulsePressure = sbp - dbp
  return { map, pulsePressure }
}
