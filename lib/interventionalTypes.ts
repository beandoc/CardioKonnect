/**
 * interventionalTypes.ts
 *
 * Dedicated clinical data model for Cath Lab & Interventional Cardiology (PCI).
 * Structured in conformance with NCDR CathPCI v5.0+, BCIS (UK), SCAAR (Sweden),
 * and Cardiological Society of India / National Interventional Council (CSI/NIC) standards.
 *
 * Stored as a first-class subcollection:
 * patients/{patientId}/procedures/{procedureId}
 */

// ─── ACC/AHA 16-Segment Coronary Model ────────────────────────────────────────

export interface AHACoronarySegment {
  number: number
  code: string
  name: string
  vessel: 'RCA' | 'LM' | 'LAD' | 'LCx' | 'Ramus' | 'Graft'
}

export const AHA_CORONARY_SEGMENTS: AHACoronarySegment[] = [
  { number: 1,  code: 'RCA_PROX', name: 'RCA Proximal', vessel: 'RCA' },
  { number: 2,  code: 'RCA_MID',  name: 'RCA Mid', vessel: 'RCA' },
  { number: 3,  code: 'RCA_DIST', name: 'RCA Distal', vessel: 'RCA' },
  { number: 4,  code: 'RCA_PDA',  name: 'Posterior Descending Artery (RCA)', vessel: 'RCA' },
  { number: 5,  code: 'LM',       name: 'Left Main (LM)', vessel: 'LM' },
  { number: 6,  code: 'LAD_PROX', name: 'LAD Proximal', vessel: 'LAD' },
  { number: 7,  code: 'LAD_MID',  name: 'LAD Mid', vessel: 'LAD' },
  { number: 8,  code: 'LAD_APIC', name: 'LAD Apical / Distal', vessel: 'LAD' },
  { number: 9,  code: 'LAD_D1',   name: 'First Diagonal (D1)', vessel: 'LAD' },
  { number: 10, code: 'LAD_D2',   name: 'Second Diagonal (D2)', vessel: 'LAD' },
  { number: 11, code: 'LCX_PROX', name: 'LCx Proximal', vessel: 'LCx' },
  { number: 12, code: 'LCX_OM1',  name: 'Intermediate / First Obtuse Marginal (OM1)', vessel: 'LCx' },
  { number: 13, code: 'LCX_MID',  name: 'LCx Mid / Distal', vessel: 'LCx' },
  { number: 14, code: 'LCX_OM2',  name: 'Second Obtuse Marginal (OM2)', vessel: 'LCx' },
  { number: 15, code: 'LCX_PDA',  name: 'Posterior Descending Artery (LCx)', vessel: 'LCx' },
  { number: 16, code: 'PLB',      name: 'Posterolateral Branch (PLB)', vessel: 'RCA' },
]

// ─── Lesion Record (Core Unit of Registry) ───────────────────────────────────

export interface LesionRecord {
  id: string
  segmentNumber: number // AHA 1-16
  vessel: 'LM' | 'LAD' | 'LCx' | 'RCA' | 'Ramus' | 'Graft'
  lesionOrder: number
  preStenosisPct: number // 0-100%
  postStenosisPct: number // 0-100%
  lesionLengthMm: number
  referenceVesselDiameterMm: number
  accAhaClass: 'A' | 'B1' | 'B2' | 'C'
  bifurcation: boolean
  medinaClass?: string // e.g. "1,1,1"
  stentStrategy?: 'Provisional 1-stent' | 'Culotte' | 'TAP' | 'DK-Crush' | 'T-stent' | 'Crush' | 'Other'
  ostial: boolean
  cto: boolean
  jCtoScore?: number // 0-5: prior failure (1), blunt stump (1), calcification (1), bending >45° (1), length ≥20mm (1)
  inStentRestenosis: boolean
  mehranIsrClass?: 'I' | 'II' | 'III' | 'IV' // I: Focal, II: Diffuse, III: Proliferative, IV: Total occlusion
  calcification: 'None' | 'Mild' | 'Moderate' | 'Severe'
  thrombusGrade: 0 | 1 | 2 | 3 | 4 | 5 // TIMI 0-5
  tortuosity: 'None' | 'Moderate' | 'Severe'
  culprit: boolean
  treated: boolean
  reasonNotTreated?: 'Medically managed' | 'CABG referral' | 'Failed to cross' | 'Non-flow limiting' | 'Other'
  preTimiFlow: 0 | 1 | 2 | 3
  postTimiFlow: 0 | 1 | 2 | 3
  deviceIds: string[] // IDs of stents/balloons deployed in this lesion

  // Backward-compatibility aliases
  isCulprit?: boolean
  chronicTotalOcclusion?: boolean
  treatmentStrategy?: string
  devices?: DeviceRecord[]
  lesionSuccess?: boolean
  segmentName?: string
  ahaAccClass?: string
  bifurcationTechnique?: string
  calciumArcDegrees?: string
  myocardialBlushGrade?: number
  intravascularImaging?: string
  physiology?: string
}

// ─── Device Record ────────────────────────────────────────────────────────────

export interface DeviceRecord {
  id: string
  targetSegment: number // AHA 1-16
  type: 'DES' | 'BMS' | 'DCB' | 'BVS' | 'POBA'
  make: string // Manufacturer (e.g. Abbott, Medtronic, Boston Sci, Meril)
  model: string // Model (e.g. Xience Sierra, Onyx, Synergy, BioMime)
  diameterMm: number // 1.5 - 6.0 mm
  lengthMm: number // 6 - 60 mm
  deploymentPressureAtm: number // atmospheres
  postDilatation: boolean
  postDilatationPressureAtm?: number
  serialOrLotNumber?: string

  // Backward-compatibility aliases
  deviceType?: string
  brandName?: string
  serialOrBatchNumber?: string
  deploymentOutcome?: string
  maxPressureAtm?: number
}

// ─── Complications ────────────────────────────────────────────────────────────

export type ComplicationType =
  | 'access-site-haematoma'
  | 'access-site-pseudoaneurysm'
  | 'access-site-av-fistula'
  | 'access-site-retroperitoneal'
  | 'access-site-limb-ischaemia'
  | 'barc-bleeding'
  | 'aki-kdigo'
  | 'stroke'
  | 'periprocedural-mi-scai'
  | 'periprocedural-mi-4th-udmi'
  | 'emergency-cabg'
  | 'cardiac-tamponade'
  | 'ventricular-arrhythmia'
  | 'contrast-reaction'
  | 'in-hospital-death'
  | 'other'

export interface CathComplicationItem {
  type: ComplicationType
  severity?: 'Mild' | 'Moderate' | 'Severe' | 'Life-threatening'
  details?: string
  barcType?: '0' | '1' | '2' | '3a' | '3b' | '3c' | '4' | '5a' | '5b'
  kdigoStage?: 1 | 2 | 3
  deathCause?: 'Cardiac' | 'Non-Cardiac'
  timing?: 'Intra-procedural' | 'Post-procedural' | 'Prior to discharge'
}

// ─── Right Heart Catheterisation Block ────────────────────────────────────────

export interface CathRHC {
  rhcDate?: string
  indication?: string
  mPAP?: number            // Mean PAP (mmHg)
  sPAP?: number            // Systolic PAP (mmHg)
  dPAP?: number            // Diastolic PAP (mmHg)
  pcwp?: number            // PCWP (mmHg)
  cardiacOutput?: number   // L/min
  cardiacIndex?: number    // L/min/m²
  pvr?: number             // Wood units
  svr?: number             // dyn.s/cm⁵
  tpg?: number             // Transpulmonary gradient
  dpg?: number             // Diastolic pulmonary gradient
  svO2?: number            // Mixed venous O2 (%)
  raPressure?: number      // RA pressure (mmHg)
  vasoreactivity?: boolean
  vasoreactivityAgent?: string
  vasoreactivityPositive?: boolean
}

// ─── Cath Procedure Master Entity ─────────────────────────────────────────────

export interface CathProcedure {
  // Identifiers & Tenancy (mandatory from day one)
  id: string
  patientId: string
  siteId: string
  operatorId: string
  operatorName?: string
  procedureDateTime: string // ISO timestamp
  procedureDate?: string // ISO date string (YYYY-MM-DD or full ISO) for backward compatibility
  seqForPatient: number // 1 for first procedure, 2 for staged/repeat, etc.

  // Compatibility fields
  procedureType?: string
  clinicalIndication?: string
  stemiTimelines?: any
  overallSuccess?: boolean
  syntaxScore?: number

  // Encounter & Presentation
  admissionType: 'Elective' | 'Urgent' | 'Emergency' | 'Salvage'
  presentation: 'STEMI' | 'NSTEMI' | 'UA' | 'ChronicCoronarySyndrome' | 'Shock' | 'OHCA' | 'Other'
  killipClass: 'I' | 'II' | 'III' | 'IV'
  priorPCI: boolean
  priorCABG: boolean
  cardiacArrestPreProcedure: boolean

  // Timings (ISO timestamps; all intervals derived)
  symptomOnset?: string
  firstMedicalContact?: string
  hospitalArrival?: string
  ecgTime?: string
  labActivation?: string
  arterialAccess?: string
  firstDevice?: string // First balloon/stent deployment or aspiration catheter
  transferredIn: boolean
  transferringFacility?: string
  thrombolysisGiven: boolean
  thrombolysisTime?: string // Pharmaco-invasive timeline (crucial in India)

  // Vascular Access
  accessSite: 'Radial Right' | 'Radial Left' | 'Femoral Right' | 'Femoral Left' | 'Ulnar' | 'Brachial'
  sheathSize: '4F' | '5F' | '6F' | '7F' | '8F'
  accessCrossover: boolean
  crossoverReason?: 'Spasm' | 'Tortuosity' | 'Radial loop' | 'Occlusion' | 'Support needed' | 'Other'
  crossoverSite?: 'Radial Right' | 'Radial Left' | 'Femoral Right' | 'Femoral Left' | 'Ulnar' | 'Brachial'
  closureDevice?: 'AngioSeal' | 'Perclose' | 'Mynx' | 'StarClose' | 'Manual Compression' | 'Radial Band' | 'None'
  ultrasoundGuidedAccess: boolean

  // Diagnostic Angiography & Hemodynamics
  dominance: 'Right' | 'Left' | 'Codominant'
  segmentStenosisMap: Record<number, number> // AHA Segment Number -> Stenosis %
  rentropCollaterals?: 'Grade 0' | 'Grade 1' | 'Grade 2' | 'Grade 3'
  preTimiPerVessel?: {
    lad?: 0 | 1 | 2 | 3
    lcx?: 0 | 1 | 2 | 3
    rca?: 0 | 1 | 2 | 3
    lm?: 0 | 1 | 2 | 3
  }
  ivusOctDone: boolean
  ivusOctFindings?: string
  ffrIfrDone: boolean
  ffrIfrValues?: string

  // Interventional Lesions & Devices
  lesions: LesionRecord[]
  devices: DeviceRecord[]

  // Adjuncts & Mechanical Support
  thrombectomyDone: boolean
  thrombectomyType?: 'Manual Aspiration' | 'Mechanical' | 'None'
  atherectomyDone: boolean
  atherectomyType?: 'Rotational' | 'Orbital' | 'None'
  ivlShockwaveDone: boolean
  ivlCycles?: number
  laserDone: boolean
  guideExtensionUsed: boolean
  mcsUsed: boolean
  mcsType?: 'IABP' | 'Impella' | 'ECMO' | 'None'
  mcsTiming?: 'Elective' | 'Bailout'
  temporaryPacingDone: boolean

  // Pharmacology & Anticoagulation
  p2y12Agent: 'Clopidogrel' | 'Ticagrelor' | 'Prasugrel' | 'None'
  p2y12LoadingDoseGiven: boolean
  gpIIbIIIaUsed: boolean
  gpIIbIIIaAgent?: 'Tirofiban' | 'Eptifibatide' | 'Abciximab'
  anticoagulant: 'Unfractionated Heparin' | 'Bivalirudin' | 'Enoxaparin' | 'None'
  anticoagulantDose?: string
  peakActSeconds?: number

  // Radiation & Contrast Exposure
  contrastVolumeMl: number // 0 - 1000 mL
  contrastAgent: 'Iso-osmolar (e.g. Visipaque)' | 'Low-osmolar (e.g. Omnipaque, Ultravist)'
  fluoroscopyTimeMin: number // 0 - 240 min
  dapGyCm2?: number // Dose Area Product (Gy·cm²)
  airKermaMGy?: number // Cumulative Air Kerma (mGy)

  // Acute Results & Angiographic Safety
  noReflow: boolean
  dissectionNhlbi?: 'None' | 'Type A' | 'Type B' | 'Type C' | 'Type D' | 'Type E' | 'Type F'
  perforationEllis?: 'None' | 'Class I' | 'Class II' | 'Class III' | 'Class CS (Cavity Spilling)'
  sideBranchLoss: boolean
  acuteStentThrombosis: boolean

  // Typed Complications Array or legacy audit object
  complications: CathComplicationItem[] | any
  radialCrossover?: boolean
  radialCrossoverReason?: string

  // Disposition & Discharge Secondary Prevention
  dischargeDate?: string
  dischargeDaptAgent?: 'Aspirin + Clopidogrel' | 'Aspirin + Ticagrelor' | 'Aspirin + Prasugrel' | 'Single Antiplatelet' | 'None'
  dischargeDaptDurationMonths?: number // 1, 3, 6, 12, >12
  dischargeStatinIntensity?: 'High' | 'Moderate' | 'Low' | 'None'
  dischargeBetaBlocker: boolean
  dischargeAceiArb: boolean
  dischargeOac: boolean // Oral Anticoagulant (triple vs double therapy)
  stagedPciPlanned: boolean
  stagedPciDate?: string
  heartTeamReferral: boolean
  heartTeamOutcome?: 'CABG' | 'Optimal Medical Therapy' | 'Staged High-Risk PCI' | 'Denied'

  // Right Heart Catheterisation
  rhc?: CathRHC

  // Quality & Governance Flags
  appropriateUseCriteria?: 'Appropriate' | 'May Be Appropriate' | 'Rarely Appropriate'
  radialFirstAdherence: boolean
  enteredBy: string
  verifiedBy?: string
  verifiedAt?: string
  dataLocked: boolean

  // Compatibility aliases
  daptAgent?: 'Aspirin + Clopidogrel' | 'Aspirin + Ticagrelor' | 'Aspirin + Prasugrel' | 'Single Antiplatelet' | 'None'
  daptPlannedDurationMonths?: number
  statinIntensity?: 'High' | 'Moderate' | 'Low' | 'None'
  fluoroscopyTimeMinutes?: number
  radiationAirKermaGy?: number
  doseAreaProduct?: number
  doseAreaProductGyCm2?: number
  doorToBalloonMin?: number | null
  angiographicSuccess?: boolean
  proceduralSuccess?: boolean
  dischargeStatus?: string
  assistantOperatorName?: string
  siteName?: string
  notes?: string
  contrastType?: 'Iso-osmolar' | 'Low-osmolar'

  // Timestamps
  createdAt: string
  updatedAt?: string
}

export type CathProcedureInput = Omit<CathProcedure, 'id' | 'createdAt' | 'updatedAt'>
