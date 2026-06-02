/**
 * statistics.ts
 * Comprehensive statistical utility library for the Cardio-Konnect analytics module.

 */

import { Visit } from './types'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FieldSummary {
  label: string
  key: string
  unit: string
  domain: string
  n: number
  mean: number | null
  sd: number | null
  median: number | null
  iqr: number | null
  min: number | null
  max: number | null
  missing: number // percentage 0–100
}

export interface ResearchField {
  key: string
  label: string
  unit: string
  domain: string
}

// ─── Research Fields Constant ─────────────────────────────────────────────────

export const RESEARCH_FIELDS: ResearchField[] = [
  // Anthropometrics
  { key: 'weight',          label: 'Weight',                unit: 'kg',              domain: 'Anthropometrics' },
  { key: 'height',          label: 'Height',                unit: 'cm',              domain: 'Anthropometrics' },
  { key: 'o2Sat',           label: 'O₂ Saturation',         unit: '%',               domain: 'Anthropometrics' },

  // Vitals
  { key: 'bpSystolic',      label: 'Systolic BP',           unit: 'mmHg',            domain: 'Vitals' },
  { key: 'bpDiastolic',     label: 'Diastolic BP',          unit: 'mmHg',            domain: 'Vitals' },
  { key: 'heartRate',       label: 'Heart Rate',            unit: 'bpm',             domain: 'Vitals' },

  // Clinical Assessment
  { key: 'sixMWT',          label: '6-Minute Walk Test',    unit: 'm',               domain: 'Clinical Assessment' },

  // Echocardiography
  { key: 'lvef',            label: 'LVEF',                  unit: '%',               domain: 'Echocardiography' },
  { key: 'lvdd',            label: 'LVDD',                  unit: 'mm',              domain: 'Echocardiography' },
  { key: 'lvsd',            label: 'LVSD',                  unit: 'mm',              domain: 'Echocardiography' },
  { key: 'eEPrime',         label: "E/E'",                  unit: '',                domain: 'Echocardiography' },
  { key: 'rvsp',            label: 'RVSP',                  unit: 'mmHg',            domain: 'Echocardiography' },

  // Laboratory
  { key: 'ntProBNP',        label: 'NT-proBNP',             unit: 'pg/mL',           domain: 'Laboratory' },
  { key: 'bnp',             label: 'BNP',                   unit: 'pg/mL',           domain: 'Laboratory' },
  { key: 'egfr',            label: 'eGFR',                  unit: 'ml/min/1.73m²',   domain: 'Laboratory' },
  { key: 'creatinine',      label: 'Creatinine',            unit: 'mg/dL',           domain: 'Laboratory' },
  { key: 'potassium',       label: 'Potassium',             unit: 'mmol/L',          domain: 'Laboratory' },
  { key: 'sodium',          label: 'Sodium',                unit: 'mmol/L',          domain: 'Laboratory' },
  { key: 'hb',              label: 'Haemoglobin',           unit: 'g/dL',            domain: 'Laboratory' },
  { key: 'tft',             label: 'TSH',                   unit: 'mIU/L',           domain: 'Laboratory' },
  { key: 'hba1c',           label: 'HbA1c',                 unit: '%',               domain: 'Laboratory' },
  { key: 'ferritin',        label: 'Ferritin',              unit: 'µg/L',            domain: 'Laboratory' },
  { key: 'transferrinSat',  label: 'Transferrin Saturation',unit: '%',               domain: 'Laboratory' },
  { key: 'uricAcid',        label: 'Uric Acid',             unit: 'mg/dL',           domain: 'Laboratory' },
  { key: 'ldl',             label: 'LDL Cholesterol',       unit: 'mg/dL',           domain: 'Laboratory' },
  { key: 'triglycerides',   label: 'Triglycerides',         unit: 'mg/dL',           domain: 'Laboratory' },

  // ECG
  { key: 'qrsDuration',     label: 'QRS Duration',          unit: 'ms',              domain: 'ECG' },
  { key: 'qtcInterval',     label: 'QTc Interval',          unit: 'ms',              domain: 'ECG' },

  // Hospitalisation
  { key: 'hospCount',       label: 'Hospitalisation Count', unit: 'episodes',        domain: 'Hospitalisation' },

  // Functional Assessment
  { key: 'gripRight',       label: 'Grip Strength (Right)', unit: 'kg',              domain: 'Functional Assessment' },
  { key: 'gripLeft',        label: 'Grip Strength (Left)',  unit: 'kg',              domain: 'Functional Assessment' },
]

// ─── Descriptive Statistics ───────────────────────────────────────────────────

/** Arithmetic mean. Returns null for empty arrays. */
export function mean(data: number[]): number | null {
  if (data.length === 0) return null
  return data.reduce((acc, v) => acc + v, 0) / data.length
}

/** Minimum value. Returns null for empty arrays. */
export function min(data: number[]): number | null {
  if (data.length === 0) return null
  return Math.min(...data)
}

/** Maximum value. Returns null for empty arrays. */
export function max(data: number[]): number | null {
  if (data.length === 0) return null
  return Math.max(...data)
}

/** Range (max − min). Returns null for empty arrays. */
export function range(data: number[]): number | null {
  if (data.length === 0) return null
  return Math.max(...data) - Math.min(...data)
}

/** Count of non-null/undefined values in a mixed array. */
export function countNonMissing(data: (number | null | undefined)[]): number {
  return data.filter((v) => v != null && !Number.isNaN(v as number)).length
}

/**
 * Missing percentage (0–100) for a mixed array that may contain
 * null, undefined, or NaN as missing indicators.
 */
export function missingPct(data: (number | null | undefined)[]): number {
  if (data.length === 0) return 100
  const missing = data.filter((v) => v == null || Number.isNaN(v as number)).length
  return (missing / data.length) * 100
}

/**
 * p-th percentile of a numeric array using linear interpolation (R type 7).
 * p must be in [0, 100].
 */
export function percentile(data: number[], p: number): number | null {
  if (data.length === 0) return null
  if (p < 0 || p > 100) throw new RangeError('p must be between 0 and 100')
  const sorted = [...data].sort((a, b) => a - b)
  const n = sorted.length
  if (n === 1) return sorted[0]
  const idx = (p / 100) * (n - 1)
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  if (lo === hi) return sorted[lo]
  return sorted[lo] + (idx - lo) * (sorted[hi] - sorted[lo])
}

/** Median (50th percentile). Returns null for empty arrays. */
export function median(data: number[]): number | null {
  return percentile(data, 50)
}

/**
 * Mode(s) — returns all values that appear most frequently.
 * Returns an empty array when data is empty.
 */
export function mode(data: number[]): number[] {
  if (data.length === 0) return []
  const freq = new Map<number, number>()
  for (const v of data) freq.set(v, (freq.get(v) ?? 0) + 1)
  const maxFreq = Math.max(...Array.from(freq.values()))
  return Array.from(freq.entries()).filter(([, f]) => f === maxFreq).map(([v]) => v)
}

/** Population variance (divided by N). Returns null for empty arrays. */
export function variance(data: number[]): number | null {
  if (data.length === 0) return null
  const m = mean(data) as number
  return data.reduce((acc, v) => acc + (v - m) ** 2, 0) / data.length
}

/**
 * Sample standard deviation (divided by N−1, Bessel-corrected).
 * Returns null for arrays with fewer than 2 elements.
 */
export function std(data: number[]): number | null {
  if (data.length < 2) return null
  const m = mean(data) as number
  const sumSq = data.reduce((acc, v) => acc + (v - m) ** 2, 0)
  return Math.sqrt(sumSq / (data.length - 1))
}

/**
 * Inter-quartile range (Q3 − Q1).
 * Returns null for empty arrays.
 */
export function iqr(data: number[]): number | null {
  if (data.length === 0) return null
  const q1 = percentile(data, 25) as number
  const q3 = percentile(data, 75) as number
  return q3 - q1
}

// ─── summarizeNumeric ─────────────────────────────────────────────────────────

export interface NumericSummary {
  label: string
  n: number
  mean: number | null
  sd: number | null
  median: number | null
  iqr: number | null
  min: number | null
  max: number | null
  missing: number // percentage
}

/**
 * Produces a concise descriptive summary for a numeric field.
 * Null / NaN / undefined values within `values` are treated as missing.
 *
 * @param values - Raw array that may include nulls (pass as number[]).
 * @param label  - Human-readable label for the field.
 */
export function summarizeNumeric(values: number[], label: string): NumericSummary {
  const clean = values.filter((v) => v != null && !Number.isNaN(v))
  const totalN = values.length
  const missing = totalN === 0 ? 100 : ((totalN - clean.length) / totalN) * 100

  return {
    label,
    n: clean.length,
    mean: mean(clean),
    sd: std(clean),
    median: median(clean),
    iqr: iqr(clean),
    min: min(clean),
    max: max(clean),
    missing,
  }
}

// ─── computeVisitStats ────────────────────────────────────────────────────────

/**
 * Extracts numeric fields listed in `fields` from an array of visits
 * and returns a FieldSummary for each field.
 *
 * The field metadata (label, unit, domain) is sourced from RESEARCH_FIELDS;
 * unknown keys receive sensible defaults.
 */
export function computeVisitStats(visits: Visit[], fields: string[]): FieldSummary[] {
  return fields.map((key) => {
    const meta = RESEARCH_FIELDS.find((f) => f.key === key) ?? {
      key,
      label: key,
      unit: '',
      domain: 'Unknown',
    }

    const values = visits.map((v) => (v as unknown as Record<string, unknown>)[key] as number)
    const clean = values.filter((v) => v != null && !Number.isNaN(v))
    const totalN = values.length
    const missingPercentage = totalN === 0 ? 100 : ((totalN - clean.length) / totalN) * 100

    return {
      label: meta.label,
      key,
      unit: meta.unit,
      domain: meta.domain,
      n: clean.length,
      mean: mean(clean),
      sd: std(clean),
      median: median(clean),
      iqr: iqr(clean),
      min: min(clean),
      max: max(clean),
      missing: missingPercentage,
    }
  })
}

// ─── computeDataCompleteness ──────────────────────────────────────────────────

/**
 * Returns a record mapping every key that appears in any visit to its
 * completeness percentage (0–100).  Only own enumerable properties are
 * considered; MedEntry objects and arrays are treated as present when
 * the property exists and is non-null.
 */
export function computeDataCompleteness(visits: Visit[]): Record<string, number> {
  if (visits.length === 0) return {}

  // Collect all keys that appear across every visit
  const allKeys = new Set<string>()
  for (const v of visits) {
    for (const k of Object.keys(v)) allKeys.add(k)
  }

  const result: Record<string, number> = {}
  const total = visits.length

  for (const key of Array.from(allKeys)) {
    let present = 0
    for (const v of visits) {
      const val = (v as unknown as Record<string, unknown>)[key]
      if (val !== undefined && val !== null && val !== '') present++
    }
    result[key] = (present / total) * 100
  }

  return result
}

// ─── categorialFrequency ──────────────────────────────────────────────────────

/**
 * Returns frequency counts and percentages for each unique string value.
 * Empty / null-ish strings are excluded.
 * Results are sorted descending by frequency.
 */
export function categorialFrequency(
  values: string[]
): Array<{ value: string; n: number; pct: number }> {
  const clean = values.filter((v) => v != null && v !== '')
  const total = clean.length
  if (total === 0) return []

  const freq = new Map<string, number>()
  for (const v of clean) freq.set(v, (freq.get(v) ?? 0) + 1)

  return Array.from(freq.entries())
    .map(([value, n]) => ({ value, n, pct: (n / total) * 100 }))
    .sort((a, b) => b.n - a.n)
}

// ─── correlationCoefficient ───────────────────────────────────────────────────

/**
 * Pearson product-moment correlation coefficient between two equal-length
 * numeric arrays.  Paired observations where either value is NaN / null
 * are dropped before computation.
 *
 * Returns NaN if fewer than 2 valid pairs exist.
 */
export function correlationCoefficient(x: number[], y: number[]): number {
  if (x.length !== y.length) throw new Error('x and y must have equal length')

  // Keep only pairs where both values are finite
  const pairs: [number, number][] = []
  for (let i = 0; i < x.length; i++) {
    if (x[i] != null && y[i] != null && !Number.isNaN(x[i]) && !Number.isNaN(y[i])) {
      pairs.push([x[i], y[i]])
    }
  }

  const n = pairs.length
  if (n < 2) return NaN

  const xs = pairs.map(([a]) => a)
  const ys = pairs.map(([, b]) => b)
  const mx = mean(xs) as number
  const my = mean(ys) as number

  let num = 0
  let dX = 0
  let dY = 0
  for (const [a, b] of pairs) {
    num += (a - mx) * (b - my)
    dX += (a - mx) ** 2
    dY += (b - my) ** 2
  }

  const denom = Math.sqrt(dX * dY)
  return denom === 0 ? NaN : num / denom
}

// ─── tTest ────────────────────────────────────────────────────────────────────

/**
 * Welch's (unequal-variance) two-sample t-test.
 *
 * Returns:
 *  - t          — t-statistic
 *  - pValue     — two-tailed p-value (approximated via the incomplete beta
 *                 function, accurate to ~3 decimal places for df ≥ 3)
 *  - significant — true when pValue < 0.05
 *
 * Returns { t: NaN, pValue: NaN, significant: false } when either array
 * has fewer than 2 observations.
 */
export function tTest(
  a: number[],
  b: number[]
): { t: number; pValue: number; significant: boolean } {
  const cleanA = a.filter((v) => v != null && !Number.isNaN(v))
  const cleanB = b.filter((v) => v != null && !Number.isNaN(v))

  if (cleanA.length < 2 || cleanB.length < 2) {
    return { t: NaN, pValue: NaN, significant: false }
  }

  const nA = cleanA.length
  const nB = cleanB.length
  const mA = mean(cleanA) as number
  const mB = mean(cleanB) as number
  const sA = std(cleanA) as number
  const sB = std(cleanB) as number

  const seA = sA ** 2 / nA
  const seB = sB ** 2 / nB
  const se = Math.sqrt(seA + seB)

  if (se === 0) return { t: 0, pValue: 1, significant: false }

  const t = (mA - mB) / se

  // Welch–Satterthwaite degrees of freedom
  const df = (seA + seB) ** 2 / (seA ** 2 / (nA - 1) + seB ** 2 / (nB - 1))

  const pValue = tDistTwoTailed(Math.abs(t), df)

  return { t, pValue, significant: pValue < 0.05 }
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Two-tailed p-value from a t distribution using a continued-fraction
 * approximation of the regularised incomplete beta function.
 * Accurate to roughly 4 significant figures for df ≥ 3.
 */
function tDistTwoTailed(tAbs: number, df: number): number {
  // P(T > tAbs) = I(df / (df + tAbs^2); df/2, 0.5)
  const x = df / (df + tAbs * tAbs)
  return incompleteBeta(x, df / 2, 0.5)
}

/**
 * Regularised incomplete beta function I_x(a, b) via continued fractions
 * (Lentz algorithm). Used only internally by tTest.
 */
function incompleteBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0
  if (x >= 1) return 1

  // Use symmetry relation when x > (a+1)/(a+b+2) for faster convergence
  if (x > (a + 1) / (a + b + 2)) {
    return 1 - incompleteBeta(1 - x, b, a)
  }

  const lbeta = logGamma(a) + logGamma(b) - logGamma(a + b)
  const front = Math.exp(Math.log(x) * a + Math.log(1 - x) * b - lbeta) / a

  // Continued fraction (modified Lentz)
  const MAX_ITER = 200
  const EPS = 1e-10
  let f = 1
  let C = 1
  let D = 1 - ((a + b) * x) / (a + 1)
  if (Math.abs(D) < 1e-30) D = 1e-30
  D = 1 / D
  f = D

  for (let m = 1; m <= MAX_ITER; m++) {
    // Even step
    let numerator = (m * (b - m) * x) / ((a + 2 * m - 1) * (a + 2 * m))
    D = 1 + numerator * D
    if (Math.abs(D) < 1e-30) D = 1e-30
    C = 1 + numerator / C
    if (Math.abs(C) < 1e-30) C = 1e-30
    D = 1 / D
    f *= D * C

    // Odd step
    numerator = -((a + m) * (a + b + m) * x) / ((a + 2 * m) * (a + 2 * m + 1))
    D = 1 + numerator * D
    if (Math.abs(D) < 1e-30) D = 1e-30
    C = 1 + numerator / C
    if (Math.abs(C) < 1e-30) C = 1e-30
    D = 1 / D
    const delta = D * C
    f *= delta

    if (Math.abs(delta - 1) < EPS) break
  }

  return front * f
}

/** Natural log of the gamma function (Lanczos approximation). */
function logGamma(z: number): number {
  const g = 7
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6,
    1.5056327351493116e-7,
  ]
  if (z < 0.5) {
    return Math.log(Math.PI / Math.sin(Math.PI * z)) - logGamma(1 - z)
  }
  const zz = z - 1
  let x = c[0]
  for (let i = 1; i < g + 2; i++) x += c[i] / (zz + i)
  const t = zz + g + 0.5
  return 0.5 * Math.log(2 * Math.PI) + (zz + 0.5) * Math.log(t) - t + Math.log(x)
}
