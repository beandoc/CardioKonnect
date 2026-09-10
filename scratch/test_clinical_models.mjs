import { calculateContrastNephropathyRisk, calculateGRACE2 } from '../lib/riskScores.js'
import {
  calculateRadialFirstMetric,
  calculateDtbComplianceMetric,
  calculateProceduralSuccessMetric,
  calculateMajorBleedingMetric,
  calculatePharmacoInvasiveMetric,
  calculateDaptAdherenceMetric
} from '../lib/interventionalMetrics.js'

console.log('=== TEST 1: Mehran CIN Scoring with Anemia & Renal Impairment ===')
// Patient with Cr 2.0, eGFR 35, anemia = true, contrast 100mL
const mehranTest = calculateContrastNephropathyRisk({
  age: 65,
  diabetes: false,
  hypotension: false,
  heartFailure: false,
  creatinine: 2.0,
  eGFR: 35,
  iabpUse: false,
  anemia: true,
  contrastVolumeMl: 100
})

console.log('Mehran Score:', mehranTest.mehranScore)
console.log('Risk Category:', mehranTest.riskCategory)

// Assertions:
// Age 65: 0
// Hypotension: 0
// IABP: 0
// HF: 0
// Anemia: 3
// Diabetes: 0
// Renal: eGFR 35 gives 4 pts (mutually exclusive with Cr > 1.5)
// Contrast: 100 mL gives 1 pt
// Total = 8 points
if (mehranTest.mehranScore === 8) {
  console.log('✓ PASS: Mehran score is exactly 8 (4 renal + 3 anemia + 1 contrast, not double-counted renal or dropped anemia).')
} else {
  console.error(`✗ FAIL: Expected 8, got ${mehranTest.mehranScore}`)
  process.exit(1)
}

console.log('\n=== TEST 2: GRACE 2.0 Reference Case ===')
// Standard reference case
const graceTest = calculateGRACE2({
  age: 65,
  heartRate: 78,
  systolicBp: 130,
  creatinine: 1.1,
  killipClass: 'I',
  cardiacArrestAtAdmission: false,
  stSegmentDeviation: true,
  elevatedCardiacEnzymes: true
})

console.log('GRACE Score:', graceTest.graceScore)
console.log('In-Hospital Mortality %:', graceTest.inHospitalMortalityPct)
console.log('In-Hospital Risk Tier:', graceTest.inHospitalRiskTier)

// Expected:
// Age 65: 55
// HR 78: 9
// SBP 130: 34
// Cr 1.1: 8
// Killip I: 0
// Arrest: 0
// ST deviation: 30
// Biomarkers: 15
// Total = 151
if (graceTest.graceScore === 151) {
  console.log('✓ PASS: GRACE score is exactly 151.')
} else {
  console.error(`✗ FAIL: Expected 151, got ${graceTest.graceScore}`)
  process.exit(1)
}

console.log('\n=== TEST 3: Small Denominator (< 20) Suppression ===')
// 10 mock procedures (less than 20)
const mockSmallProcedures = Array.from({ length: 10 }, (_, i) => ({
  id: `proc-${i}`,
  patientId: `pt-${i}`,
  siteId: 'AICTS_PUNE',
  operatorId: 'OP_01',
  procedureDateTime: '2026-09-01T10:00:00',
  accessSite: 'Radial Right',
  clinicalIndication: 'STEMI',
  stemiTimelines: { dtbMinutes: 65 },
  overallSuccess: true,
  complications: { hasComplication: false },
  thrombolysisGiven: false
}))

const radialMetric = calculateRadialFirstMetric(mockSmallProcedures)
const dtbMetric = calculateDtbComplianceMetric(mockSmallProcedures)
const successMetric = calculateProceduralSuccessMetric(mockSmallProcedures)

console.log('Radial metric with N=10:', radialMetric)
console.log('DTB metric with N=10:', dtbMetric)
console.log('Success metric with N=10:', successMetric)

if (radialMetric.value === null && dtbMetric.value === null && successMetric.value === null && radialMetric.isSuppressed === true) {
  console.log('✓ PASS: All metrics return value: null and isSuppressed: true with <20 procedures (displaying "—").')
} else {
  console.error('✗ FAIL: Expected null rate for n < 20')
  process.exit(1)
}

// 25 mock procedures (>= 20)
const mockLargeProcedures = Array.from({ length: 25 }, (_, i) => ({
  id: `proc-${i}`,
  patientId: `pt-${i}`,
  siteId: 'AICTS_PUNE',
  operatorId: 'OP_01',
  procedureDateTime: '2026-09-01T10:00:00',
  accessSite: 'Radial Right',
  presentation: 'STEMI',
  stemiTimelines: { dtbMinutes: 65 },
  overallSuccess: true,
  complications: [],
  thrombolysisGiven: false
}))

const largeRadial = calculateRadialFirstMetric(mockLargeProcedures)
console.log('Radial metric with N=25:', largeRadial)
if (largeRadial.value === 100 && largeRadial.isSuppressed === false) {
  console.log('✓ PASS: Metric renders 100% when N >= 20.')
} else {
  console.error('✗ FAIL: Expected 100% for N >= 20')
  process.exit(1)
}

console.log('\nAll clinical model and metric unit tests PASSED.')
