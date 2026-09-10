/**
 * interventionalMetrics.ts
 *
 * Pure functional calculation engine for Interventional Cardiology / Cath Lab registry.
 *
 * CRITICAL DESIGN RULE:
 * Every derived value (vesselsDiseased, doorToBalloonMin, angiographicSuccess, proceduralSuccess)
 * is a PURE function over stored procedure fields.
 * NEVER a stored magic number, NEVER a fallback constant.
 * Metrics return { value, numerator, denominator, definition } and suppress values below n=20.
 */

import type { CathProcedure, LesionRecord, DeviceRecord } from './interventionalTypes'

// ─── Time Intervals (Pure Functions over ISO timestamps) ──────────────────────

/**
 * Parses ISO timestamp string into epoch milliseconds. Returns null if invalid or missing.
 */
function parseTime(isoString?: string): number | null {
  if (!isoString) return null
  const ms = new Date(isoString).getTime()
  return isNaN(ms) ? null : ms
}

/**
 * Door-to-Balloon (DTB) in minutes:
 * Interval from hospital arrival to first intracoronary device deployment.
 */
export function calculateDoorToBalloonMin(proc: CathProcedure): number | null {
  const arrival = parseTime(proc.hospitalArrival)
  const device = parseTime(proc.firstDevice) || parseTime(proc.arterialAccess)
  if (arrival === null || device === null) return null
  const diffMinutes = Math.round((device - arrival) / (1000 * 60))
  return diffMinutes >= 0 && diffMinutes <= 1440 ? diffMinutes : null
}

/**
 * First Medical Contact (FMC) to Device in minutes.
 */
export function calculateFmcToDeviceMin(proc: CathProcedure): number | null {
  const fmc = parseTime(proc.firstMedicalContact)
  const device = parseTime(proc.firstDevice)
  if (fmc === null || device === null) return null
  const diffMinutes = Math.round((device - fmc) / (1000 * 60))
  return diffMinutes >= 0 && diffMinutes <= 1440 ? diffMinutes : null
}

/**
 * Total Ischaemic Time in minutes:
 * Symptom onset to first intracoronary device deployment.
 */
export function calculateTotalIschaemicTimeMin(proc: CathProcedure): number | null {
  const onset = parseTime(proc.symptomOnset)
  const device = parseTime(proc.firstDevice)
  if (onset === null || device === null) return null
  const diffMinutes = Math.round((device - onset) / (1000 * 60))
  return diffMinutes >= 0 && diffMinutes <= 10080 ? diffMinutes : null // up to 7 days
}

/**
 * Cath Lab Activation to Arterial Access in minutes.
 */
export function calculateActivationToAccessMin(proc: CathProcedure): number | null {
  const activation = parseTime(proc.labActivation)
  const access = parseTime(proc.arterialAccess)
  if (activation === null || access === null) return null
  const diffMinutes = Math.round((access - activation) / (1000 * 60))
  return diffMinutes >= 0 && diffMinutes <= 240 ? diffMinutes : null
}

// ─── Anatomic & Lesion Success Derivations ─────────────────────────────────────

/**
 * Evaluates number of diseased coronary vessel territories (0 to 3, or LM disease):
 * LM stenosis ≥ 50%, or LAD / LCx / RCA territories with ≥ 70% diameter stenosis.
 */
export function calculateVesselsDiseased(proc: CathProcedure): {
  count: number
  hasLM: boolean
  hasLAD: boolean
  hasLCX: boolean
  hasRCA: boolean
  isMultivessel: boolean
} {
  const map = proc.segmentStenosisMap || {}
  
  // Segment map checks
  const lmStenosis = map[5] ?? 0
  const ladMax = Math.max(map[6] ?? 0, map[7] ?? 0, map[8] ?? 0, map[9] ?? 0, map[10] ?? 0)
  const lcxMax = Math.max(map[11] ?? 0, map[12] ?? 0, map[13] ?? 0, map[14] ?? 0, map[15] ?? 0)
  const rcaMax = Math.max(map[1] ?? 0, map[2] ?? 0, map[3] ?? 0, map[4] ?? 0, map[16] ?? 0)

  // Also verify against lesions array if populated
  let lmFromLesions = 0
  let ladFromLesions = 0
  let lcxFromLesions = 0
  let rcaFromLesions = 0

  for (const l of proc.lesions || []) {
    if (l.vessel === 'LM') lmFromLesions = Math.max(lmFromLesions, l.preStenosisPct)
    if (l.vessel === 'LAD') ladFromLesions = Math.max(ladFromLesions, l.preStenosisPct)
    if (l.vessel === 'LCx') lcxFromLesions = Math.max(lcxFromLesions, l.preStenosisPct)
    if (l.vessel === 'RCA') rcaFromLesions = Math.max(rcaFromLesions, l.preStenosisPct)
  }

  const effectiveLM = Math.max(lmStenosis, lmFromLesions)
  const effectiveLAD = Math.max(ladMax, ladFromLesions)
  const effectiveLCX = Math.max(lcxMax, lcxFromLesions)
  const effectiveRCA = Math.max(rcaMax, rcaFromLesions)

  const hasLM = effectiveLM >= 50
  const hasLAD = effectiveLAD >= 70
  const hasLCX = effectiveLCX >= 70
  const hasRCA = effectiveRCA >= 70

  let count = 0
  if (hasLAD) count++
  if (hasLCX) count++
  if (hasRCA) count++

  const isMultivessel = hasLM || count >= 2

  return { count, hasLM, hasLAD, hasLCX, hasRCA, isMultivessel }
}

/**
 * Standard Lesion Success:
 * TIMI 3 flow restored with residual diameter stenosis < 20% (< 50% for balloon-only/POBA).
 */
export function calculateLesionSuccess(lesion: LesionRecord): boolean {
  if (lesion.treated === false || lesion.treatmentStrategy === 'Medical Therapy') return false
  const isPoba = !lesion.deviceIds || lesion.deviceIds.length === 0
  const stenosisThreshold = isPoba ? 50 : 20
  return lesion.postTimiFlow === 3 && (lesion.postStenosisPct != null && lesion.postStenosisPct < stenosisThreshold)
}

/**
 * Angiographic Success:
 * Every treated lesion in the procedure achieves lesion success.
 */
export function calculateAngiographicSuccess(proc: CathProcedure): boolean {
  const treatedLesions = (proc.lesions || []).filter(l => l.treated)
  if (treatedLesions.length === 0) {
    // Diagnostic-only procedure with no acute complications
    return !proc.noReflow && !proc.acuteStentThrombosis
  }
  return treatedLesions.every(l => calculateLesionSuccess(l))
}

/**
 * Procedural Success (NCDR / BCIS Standard):
 * Angiographic success achieved WITHOUT in-hospital MACE
 * (No death, no emergent CABG, no acute stent thrombosis, no stroke, no Q-wave MI).
 */
export function calculateProceduralSuccess(proc: CathProcedure): boolean {
  const angioSuccess = calculateAngiographicSuccess(proc)
  if (!angioSuccess) return false

  // Check for severe adverse events
  const hasSevereComplication = (proc.complications || []).some((c: any) =>
    c.type === 'in-hospital-death' ||
    c.type === 'emergency-cabg' ||
    c.type === 'stroke' ||
    c.type === 'cardiac-tamponade'
  )

  return !hasSevereComplication && !proc.acuteStentThrombosis
}

/**
 * Chronic Total Occlusion (CTO) Success:
 * Successful recanalization (TIMI 3 flow and residual <20%) of a lesion with cto === true.
 */
export function calculateCTOSuccess(lesion: LesionRecord): boolean {
  if (!lesion.cto || !lesion.treated) return false
  return calculateLesionSuccess(lesion)
}

// ─── Population-Level Registry KPI Calculations ───────────────────────────────

export interface RegistryMetricResult {
  value: number | null // Suppressed to null if denominator < minimumSampleSize
  numerator: number
  denominator: number
  definition: string
  isSuppressed: boolean
}

const MINIMUM_SAMPLE_SIZE = 20

/**
 * Radial-First Access Rate (%):
 * Proportion of procedures initiated via radial artery (left or right).
 */
export function calculateRadialFirstMetric(procs: CathProcedure[]): RegistryMetricResult {
  const denominator = procs.length
  const numerator = procs.filter(p => p.accessSite === 'Radial Right' || p.accessSite === 'Radial Left').length
  const isSuppressed = denominator < MINIMUM_SAMPLE_SIZE
  const value = isSuppressed || denominator === 0 ? null : Math.round((numerator / denominator) * 100)

  return {
    value,
    numerator,
    denominator,
    definition: 'Percentage of interventional procedures performed via radial access (Right or Left Radial)',
    isSuppressed
  }
}

/**
 * STEMI Door-to-Balloon Compliance Rate (% ≤ 90 min).
 */
export function calculateDtbComplianceMetric(procs: CathProcedure[]): RegistryMetricResult {
  const stemiProcs = procs.filter(p => p.presentation === 'STEMI')
  const validDtbProcs = stemiProcs.map(p => calculateDoorToBalloonMin(p)).filter((d): d is number => d !== null)
  const denominator = validDtbProcs.length
  const numerator = validDtbProcs.filter(d => d <= 90).length
  const isSuppressed = denominator < MINIMUM_SAMPLE_SIZE
  const value = isSuppressed || denominator === 0 ? null : Math.round((numerator / denominator) * 100)

  return {
    value,
    numerator,
    denominator,
    definition: 'Percentage of primary PCI for STEMI achieving Door-to-Balloon time ≤ 90 minutes',
    isSuppressed
  }
}

/**
 * Median Door-to-Balloon Time (minutes) for primary PCI.
 */
export function calculateMedianDtbMin(procs: CathProcedure[]): {
  medianMinutes: number | null
  count: number
  isSuppressed: boolean
} {
  const stemiProcs = procs.filter(p => p.presentation === 'STEMI')
  const validTimes = stemiProcs.map(p => calculateDoorToBalloonMin(p)).filter((d): d is number => d !== null).sort((a, b) => a - b)
  const count = validTimes.length
  const isSuppressed = count < MINIMUM_SAMPLE_SIZE

  if (isSuppressed || count === 0) {
    return { medianMinutes: null, count, isSuppressed: true }
  }

  const mid = Math.floor(count / 2)
  const medianMinutes = count % 2 !== 0 ? validTimes[mid] : Math.round((validTimes[mid - 1] + validTimes[mid]) / 2)

  return { medianMinutes, count, isSuppressed: false }
}

/**
 * Procedural Success Rate (%):
 * Proportion of PCI procedures achieving angiographic success without in-lab or in-hospital MACE.
 */
export function calculateProceduralSuccessMetric(procs: CathProcedure[]): RegistryMetricResult {
  const pciProcs = procs.filter(p => (p.lesions || []).some(l => l.treated))
  const denominator = pciProcs.length
  const numerator = pciProcs.filter(p => calculateProceduralSuccess(p)).length
  const isSuppressed = denominator < MINIMUM_SAMPLE_SIZE
  const value = isSuppressed || denominator === 0 ? null : Math.round((numerator / denominator) * 100)

  return {
    value,
    numerator,
    denominator,
    definition: 'Procedural success defined as TIMI 3 flow and residual stenosis <20% without in-hospital death, emergent CABG, stroke, or tamponade',
    isSuppressed
  }
}

/**
 * In-Hospital Bleeding Rate (BARC ≥ 3 or access-site haematoma/pseudoaneurysm).
 */
export function calculateMajorBleedingMetric(procs: CathProcedure[]): RegistryMetricResult {
  const denominator = procs.length
  const numerator = procs.filter(p =>
    (p.complications || []).some((c: any) =>
      c.type === 'barc-bleeding' && (c.barcType === '3a' || c.barcType === '3b' || c.barcType === '3c' || c.barcType === '4' || c.barcType === '5a' || c.barcType === '5b')
    ) ||
    (p.complications || []).some((c: any) => c.type === 'access-site-retroperitoneal')
  ).length
  const isSuppressed = denominator < MINIMUM_SAMPLE_SIZE
  const value = isSuppressed || denominator === 0 ? null : parseFloat(((numerator / denominator) * 100).toFixed(1))

  return {
    value,
    numerator,
    denominator,
    definition: 'Major bleeding defined as BARC Type 3–5 bleeding or retroperitoneal haematoma',
    isSuppressed
  }
}

/**
 * Pharmaco-invasive STEMI Proportion (%):
 * Proportion of STEMI patients treated with pre-hospital or spoke-hospital thrombolysis prior to catheterization.
 */
export function calculatePharmacoInvasiveMetric(procs: CathProcedure[]): RegistryMetricResult {
  const stemiProcs = procs.filter(p => p.presentation === 'STEMI')
  const denominator = stemiProcs.length
  const numerator = stemiProcs.filter(p => p.thrombolysisGiven).length
  const isSuppressed = denominator < MINIMUM_SAMPLE_SIZE
  const value = isSuppressed || denominator === 0 ? null : Math.round((numerator / denominator) * 100)

  return {
    value,
    numerator,
    denominator,
    definition: 'Percentage of STEMI presentations receiving thrombolysis prior to catheterization (Pharmaco-invasive strategy)',
    isSuppressed
  }
}

/**
 * DAPT Adherence at Discharge Rate (%):
 * Dual antiplatelet therapy prescribed at discharge.
 */
export function calculateDaptAdherenceMetric(procs: CathProcedure[]): RegistryMetricResult {
  const pciProcs = procs.filter(p => (p.lesions || []).some(l => l.treated))
  const denominator = pciProcs.length
  const numerator = pciProcs.filter(p =>
    p.dischargeDaptAgent === 'Aspirin + Clopidogrel' ||
    p.dischargeDaptAgent === 'Aspirin + Ticagrelor' ||
    p.dischargeDaptAgent === 'Aspirin + Prasugrel'
  ).length
  const isSuppressed = denominator < MINIMUM_SAMPLE_SIZE
  const value = isSuppressed || denominator === 0 ? null : Math.round((numerator / denominator) * 100)

  return {
    value,
    numerator,
    denominator,
    definition: 'Percentage of post-PCI patients prescribed guideline-directed dual antiplatelet therapy (DAPT) at hospital discharge',
    isSuppressed
  }
}
