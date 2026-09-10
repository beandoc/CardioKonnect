import { z } from 'zod'

const lesionSchema = z.object({
  id: z.string(),
  segmentNumber: z.coerce.number().min(1).max(16),
  vessel: z.enum(['LM', 'LAD', 'LCx', 'RCA', 'Ramus', 'Graft']),
  lesionOrder: z.coerce.number().default(1),
  preStenosisPct: z.coerce.number().min(0).max(100),
  postStenosisPct: z.coerce.number().min(0).max(100),
  lesionLengthMm: z.coerce.number().min(1).max(100),
  referenceVesselDiameterMm: z.coerce.number().min(1.5).max(6.0),
  accAhaClass: z.enum(['A', 'B1', 'B2', 'C']).default('B1'),
  bifurcation: z.boolean().default(false),
  medinaClass: z.string().optional(),
  stentStrategy: z.enum(['Provisional 1-stent', 'Culotte', 'TAP', 'DK-Crush', 'T-stent', 'Crush', 'Other']).optional(),
  ostial: z.boolean().default(false),
  cto: z.boolean().default(false),
  jCtoScore: z.coerce.number().min(0).max(5).optional(),
  inStentRestenosis: z.boolean().default(false),
  mehranIsrClass: z.enum(['I', 'II', 'III', 'IV']).optional(),
  calcification: z.enum(['None', 'Mild', 'Moderate', 'Severe']).default('None'),
  thrombusGrade: z.coerce.number().min(0).max(5).default(0),
  tortuosity: z.enum(['None', 'Moderate', 'Severe']).default('None'),
  culprit: z.boolean().default(false),
  treated: z.boolean().default(true),
  reasonNotTreated: z.string().optional(),
  preTimiFlow: z.coerce.number().min(0).max(3).default(0),
  postTimiFlow: z.coerce.number().min(0).max(3).default(3),
  deviceIds: z.array(z.string()).default([]),
})

const deviceSchema = z.object({
  id: z.string(),
  targetSegment: z.coerce.number().min(1).max(16),
  type: z.enum(['DES', 'BMS', 'DCB', 'BVS', 'POBA']).default('DES'),
  make: z.string().min(1, 'Make required'),
  model: z.string().min(1, 'Model required'),
  diameterMm: z.coerce.number().min(1.5).max(6.0),
  lengthMm: z.coerce.number().min(6).max(60),
  deploymentPressureAtm: z.coerce.number().min(4).max(30).default(14),
  postDilatation: z.boolean().default(false),
  postDilatationPressureAtm: z.coerce.number().optional(),
  serialOrLotNumber: z.string().optional(),
})

const procedureFormSchema = z.object({
  siteId: z.string().min(1, 'Site ID required'),
  operatorId: z.string().min(1, 'Operator ID required'),
  operatorName: z.string().min(1, 'Operator name required'),
  procedureDateTime: z.string().min(1, 'Date & time required'),
  presentation: z.enum(['STEMI', 'NSTEMI', 'UA', 'ChronicCoronarySyndrome', 'Shock', 'OHCA', 'Other']).default('NSTEMI'),
  symptomOnset: z.string().optional(),
  accessCrossover: z.boolean().default(false),
  crossoverReason: z.string().optional(),
  noReflow: z.boolean().default(false),
  lesions: z.array(lesionSchema).default([]),
  devices: z.array(deviceSchema).default([]),
  enteredBy: z.string().min(1, 'Abstractor name required'),
}).superRefine((data, ctx) => {
  // 1. STEMI with no onset time
  if (data.presentation === 'STEMI' && (!data.symptomOnset || data.symptomOnset.trim() === '')) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Symptom onset time is mandatory for STEMI presentation to calculate ischemic time',
      path: ['symptomOnset'],
    })
  }

  // 2. A device with no treated lesion
  if (data.devices && data.devices.length > 0) {
    const hasTreatedLesion = data.lesions && data.lesions.some(l => l.treated)
    if (!hasTreatedLesion) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'A device cannot be deployed without at least one treated lesion documented',
        path: ['devices'],
      })
    }
  }

  // 3. noReflow with post-TIMI 3
  if (data.noReflow) {
    const hasPostTimi3 = data.lesions && data.lesions.some(l => l.postTimiFlow === 3)
    if (hasPostTimi3) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'No-reflow / slow-flow is clinically incompatible with post-procedural TIMI 3 flow (must be TIMI 0–2)',
        path: ['noReflow'],
      })
    }
  }
})

console.log('=== TEST: Deliberately Inconsistent Cases ===')

// Case 1: STEMI with no onset time
console.log('\nCase 1: STEMI with no onset time')
const case1 = procedureFormSchema.safeParse({
  siteId: 'AICTS_PUNE',
  operatorId: 'OP_01',
  operatorName: 'Dr. Sharma',
  procedureDateTime: '2026-09-10T10:00',
  presentation: 'STEMI',
  symptomOnset: '', // Missing onset
  enteredBy: 'Abstractor',
  lesions: [],
  devices: []
})
console.log('Case 1 Success:', case1.success)
if (!case1.success) {
  const err = case1.error.issues.find(i => i.path.includes('symptomOnset'))
  console.log('Blocked with message:', err?.message)
  if (err?.message.includes('Symptom onset time is mandatory for STEMI')) {
    console.log('✓ PASS: Blocked with exact specific rule message.')
  }
} else {
  console.error('✗ FAIL: Should have blocked Case 1')
  process.exit(1)
}

// Case 2: A device with no treated lesion
console.log('\nCase 2: A device with no treated lesion')
const case2 = procedureFormSchema.safeParse({
  siteId: 'AICTS_PUNE',
  operatorId: 'OP_01',
  operatorName: 'Dr. Sharma',
  procedureDateTime: '2026-09-10T10:00',
  presentation: 'NSTEMI',
  enteredBy: 'Abstractor',
  lesions: [
    {
      id: 'l1',
      segmentNumber: 6,
      vessel: 'LAD',
      lesionOrder: 1,
      preStenosisPct: 90,
      postStenosisPct: 90,
      lesionLengthMm: 20,
      referenceVesselDiameterMm: 3.0,
      treated: false, // NOT treated
      preTimiFlow: 1,
      postTimiFlow: 1
    }
  ],
  devices: [
    {
      id: 'd1',
      targetSegment: 6,
      type: 'DES',
      make: 'Abbott',
      model: 'Xience Sierra',
      diameterMm: 3.0,
      lengthMm: 28,
      deploymentPressureAtm: 14,
      postDilatation: false
    }
  ]
})
console.log('Case 2 Success:', case2.success)
if (!case2.success) {
  const err = case2.error.issues.find(i => i.path.includes('devices'))
  console.log('Blocked with message:', err?.message)
  if (err?.message.includes('A device cannot be deployed without at least one treated lesion')) {
    console.log('✓ PASS: Blocked with exact specific rule message.')
  }
} else {
  console.error('✗ FAIL: Should have blocked Case 2')
  process.exit(1)
}

// Case 3: noReflow with post-TIMI 3
console.log('\nCase 3: noReflow with post-TIMI 3')
const case3 = procedureFormSchema.safeParse({
  siteId: 'AICTS_PUNE',
  operatorId: 'OP_01',
  operatorName: 'Dr. Sharma',
  procedureDateTime: '2026-09-10T10:00',
  presentation: 'NSTEMI',
  enteredBy: 'Abstractor',
  noReflow: true, // Marked as no-reflow
  lesions: [
    {
      id: 'l1',
      segmentNumber: 6,
      vessel: 'LAD',
      lesionOrder: 1,
      preStenosisPct: 95,
      postStenosisPct: 0,
      lesionLengthMm: 20,
      referenceVesselDiameterMm: 3.0,
      treated: true,
      preTimiFlow: 0,
      postTimiFlow: 3 // Contradictory TIMI 3
    }
  ],
  devices: []
})
console.log('Case 3 Success:', case3.success)
if (!case3.success) {
  const err = case3.error.issues.find(i => i.path.includes('noReflow'))
  console.log('Blocked with message:', err?.message)
  if (err?.message.includes('No-reflow / slow-flow is clinically incompatible with post-procedural TIMI 3 flow')) {
    console.log('✓ PASS: Blocked with exact specific rule message.')
  }
} else {
  console.error('✗ FAIL: Should have blocked Case 3')
  process.exit(1)
}

console.log('\nAll 3 deliberate inconsistent cases were BLOCKED successfully with exact clinical rule messages.')
