// ─── Shared primitives ──────────────────────────────────────────────────────
export type Prescribed = 'Yes' | 'No' | ''

export interface MedEntry {
  prescribed: Prescribed
  type?: string
  dose?: string
  reason?: string  // reason if not prescribed
  startDate?: string
  stopDate?: string
  changeReason?: string
}

// ─── Patient (demographics — relatively static) ──────────────────────────────
export interface Patient {
  id: string
  // Demographics
  firstName: string
  lastName: string
  dob: string          // ISO date: YYYY-MM-DD
  sex: 'Male' | 'Female' | 'Other'
  mrn?: string         // Medical record number
  contact?: string
  email?: string
  status?: 'Active' | 'Inactive' | 'Pending'
  consentStatus?: 'Granted' | 'Revoked' | 'Pending' | 'Declined'
  address?: string
  comorbidities?: string[]
  allergies?: string
  indexDate?: string    // ISO date of diagnosis / enrollment
  // Cached latest visit indicators
  hfType?: string
  nyha?: string
  lvef?: number
  // Meta
  createdAt: string    // ISO timestamp
  updatedAt: string
  visitCount?: number
  lastVisitDate?: string
}

export type PatientInput = Omit<Patient, 'id' | 'createdAt' | 'updatedAt'>

// ─── Visit (all longitudinal clinical data — one per encounter) ───────────────
export interface Visit {
  id: string
  patientId: string
  visitDate: string    // ISO date
  visitType: 'OPD' | 'Telemedicine' | 'Inpatient' | ''
  echoDoneToday?: boolean
  labsDrawnToday?: boolean
  icuDays?: number
  admissionReason?: string
  dischargeDate?: string

  // Anthropometrics
  weight?: number      // kg
  height?: number      // cm
  o2Sat?: number       // %
  oedema?: string      // None / Mild / Moderate / Severe

  // Vitals
  bpSystolic?: number
  bpDiastolic?: number
  heartRate?: number   // bpm

  // Clinical assessment
  nyha?: 'I' | 'II' | 'III' | 'IV'
  rhythm?: 'Sinus' | 'AF' | 'Atrial Flutter' | 'VT' | 'Not Known' | 'Other'
  sixMWT?: number      // metres
  hfType?: 'HFrEF' | 'HFmrEF' | 'HFpEF'
  etiology?: string[]
  etiologyOther?: string

  // Hospitalisation
  hospHistory?: 'Yes' | 'No'
  hospCount?: number
  hospDetails?: string

  // ── Echocardiography ────────────────────────────────────────────────────────
  lvef?: number        // %
  echoDate?: string
  lvdd?: number        // mm
  lvsd?: number        // mm
  eEPrime?: number
  ddGrade?: 'Grade I' | 'Grade II' | 'Grade III' | ''
  rvsp?: number        // mmHg — RV systolic pressure
  wallMotionAbnormality?: boolean
  echNotes?: string

  // ── Laboratory ──────────────────────────────────────────────────────────────
  ntProBNP?: number    // pg/mL
  bnp?: number         // pg/mL
  egfr?: number        // ml/min/1.73m²
  creatinine?: number  // mg/dL
  potassium?: number   // mmol/L
  sodium?: number      // mmol/L
  hb?: number          // g/dL
  tft?: number         // TSH mIU/L
  hba1c?: number       // %
  ferritin?: number    // µg/L
  transferrinSat?: number // %
  uricAcid?: number    // mg/dL
  ldl?: number         // mg/dL
  triglycerides?: number // mg/dL

  // ── ECG ─────────────────────────────────────────────────────────────────────
  qrsDuration?: number // ms
  bbb?: 'LBBB' | 'RBBB' | 'IVCD' | ''
  qtcInterval?: number // ms

  // ── Medications — Core HF Therapy ───────────────────────────────────────────
  diuretic: MedEntry
  raasi: MedEntry      // ACE / ARB / ARNI
  betaBlocker: MedEntry
  digoxin: MedEntry
  sglt2i: MedEntry
  ivabradine: MedEntry
  mra: MedEntry        // Mineralocorticoid receptor antagonist

  // ── Medications — Dyslipidemia ───────────────────────────────────────────────
  aspirin: { prescribed: Prescribed; dose?: string }
  statin: { type?: string; dose?: string; prescribed: Prescribed }
  fibrate: { type?: string; prescribed: Prescribed }
  pcsk9: { type?: string; prescribed: Prescribed }

  // ── Medications — Diabetes ───────────────────────────────────────────────────
  dmManagement?: {
    hba1c?: number
    drug?: string
    reason?: string
  }

  // ── Medications — Iron / Anaemia ─────────────────────────────────────────────
  ivIron: MedEntry

  // ── Medications — Anti-arrhythmic / Anticoagulation ─────────────────────────
  noac: { type?: string; dose?: string; prescribed: Prescribed }
  vki: { type?: string; dose?: string; prescribed: Prescribed }
  antiarrhythmicReason?: string

  // ── Device Therapy ───────────────────────────────────────────────────────────
  device?: string[]    // ICD | CRT-D | CRT-P | PPM
  deviceNotes?: string

  // ── Vaccination ──────────────────────────────────────────────────────────────
  vaccInfluenza?: string
  vaccInfluenzaDate?: string
  vaccPneumo?: string
  vaccPneumoDate?: string

  // ── Functional Assessment ────────────────────────────────────────────────────
  gripRight?: number   // kg
  gripLeft?: number    // kg
  frailty?: 'Not frail' | 'Pre-frail' | 'Frail' | ''

  // ── Patient Education ────────────────────────────────────────────────────────
  education?: string[]
  eduNotes?: string

  // ── Follow-up & Notes ────────────────────────────────────────────────────────
  followupDate?: string
  followupType?: 'OPD' | 'Telemedicine' | 'Inpatient' | ''
  clinicalNotes?: string

  // ── Advanced Biomarkers (Novel) ──────────────────────────────────────────────
  hsTnT?: number           // High-sensitivity Troponin T (pg/mL) — PARADIGM-HF, EMPEROR standard
  hsTnI?: number           // High-sensitivity Troponin I (pg/mL)
  hsCrp?: number           // High-sensitivity CRP (mg/L)
  il6?: number             // Interleukin-6 (pg/mL)
  tnfAlpha?: number        // TNF-alpha (pg/mL)
  sST2?: number            // Soluble ST2 (ng/mL) — fibrosis / myocardial stress marker
  galectin3?: number       // Galectin-3 (ng/mL) — fibrosis marker
  gdf15?: number           // Growth Differentiation Factor-15 (pg/mL) — cachexia / poor prognosis
  ca125?: number           // CA-125 (U/mL) — congestion marker
  cystatinC?: number       // Cystatin C (mg/L) — more sensitive renal marker
  crp?: number             // C-Reactive Protein (mg/L)
  esr?: number             // ESR (mm/hr)
  proBNP?: number          // BNP (pg/mL) — alternative to NT-proBNP

  // ── Vascular & Endothelial Assessment ────────────────────────────────────────
  vascular?: {
    pulseWaveVelocity?: number       // m/s
    augmentationIndex?: number       // %
    centralAorticPressure?: number   // mmHg
    arterialStiffnessIndex?: number 
    flowMediatedDilation?: number    // %
    carotidImt?: number              // Carotid intima-media thickness (mm)
    carotidPlaqueBurden?: string     // e.g., 'None', 'Mild', 'Moderate', 'Severe'
  }

  // ── Advanced Echocardiography ────────────────────────────────────────────────
  gls?: number             // Global Longitudinal Strain (%) — normal > -18%; most sensitive systolic marker
  glsRV?: number           // RV Global Longitudinal Strain (%)
  laStrain?: number        // Left atrial strain (%)
  rvFreeWallStrain?: number // Right ventricular free-wall strain (%)
  lvMassIndex?: number     // LV mass index (g/m²)
  relativeWallThickness?: number
  tapse?: number           // TAPSE (mm) — RV function; <17 = RV dysfunction
  rvFAC?: number           // RV Fractional Area Change (%) — <35% = RV dysfunction
  rvS?: number             // RV S' tissue Doppler (cm/s) — <9.5 = abnormal
  eaRatio?: number         // E/A ratio — diastology
  decelerationTime?: number // Deceleration time (ms)
  laVolumeIndex?: number   // LA Volume Index (ml/m²) — >34 = dilated LA
  ivcDiameter?: number     // IVC diameter (mm)
  ivcCollapsibility?: number // IVC collapsibility (%)
  laPressureEstimate?: number // Estimated LA pressure (mmHg)
  mrGrade?: 'None' | 'Mild' | 'Moderate' | 'Severe' | ''
  arGrade?: 'None' | 'Mild' | 'Moderate' | 'Severe' | ''
  asGrade?: 'None' | 'Mild' | 'Moderate' | 'Severe' | ''
  msGrade?: 'None' | 'Mild' | 'Moderate' | 'Severe' | ''
  valvularHemodynamics?: {
    asAVA?: number
    asMeanGradient?: number
    asVmax?: number
    mrRegurgitantVolume?: number
    mrEROA?: number
    arRegurgitantVolume?: number
    arEROA?: number
    msMVA?: number
    msMeanGradient?: number
  }
  wallMotionScore?: number
  cardiacMRI?: {
    lgePresent?: boolean
    lgePattern?: string      // Ischaemic, Mid-wall, Sub-epicardial, Diffuse
    t1Native?: number        // ms — T1 mapping
    t2Star?: number          // ms — iron overload
    t2Mapping?: number       // ms — T2 mapping
    ecv?: number             // % — extracellular volume (fibrosis surrogate)
    lgeBurden?: number       // % — late gadolinium enhancement burden
    rvefMRI?: number         // RV EF by MRI (%)
    lvMassMRI?: number       // LV mass by MRI (g/m²)
  }

  // ── Cardiopulmonary Exercise Test (CPET) ─────────────────────────────────────
  cpet?: {
    cpetDate?: string
    protocol?: string        // Bruce, Modified Bruce, Ramp, Naughton
    peakVO2?: number         // ml/kg/min — THE most important HF prognosis marker
    veCO2Slope?: number      // VE/VCO2 slope — <30 good, 30-35 mild, 36-44 mod, >44 severe
    anaerobicThreshold?: number // ml/kg/min
    peakRER?: number         // >1.05 = maximal effort
    o2Pulse?: number         // ml/beat
    oues?: number            // O2 Uptake Efficiency Slope
    peakWorkload?: number    // Watts
    exerciseDuration?: number // minutes
    terminationReason?: string
    weberClass?: 'A' | 'B' | 'C' | 'D' | '' // A: >20, B: 16-20, C: 10-16, D: <10
    cpetNotes?: string
  }

  // ── Right Heart Catheterisation (RHC) ────────────────────────────────────────
  rhc?: {
    rhcDate?: string
    indication?: string
    mPAP?: number            // Mean PAP (mmHg) — normal <25
    sPAP?: number            // Systolic PAP (mmHg)
    dPAP?: number            // Diastolic PAP (mmHg)
    pcwp?: number            // PCWP (mmHg) — normal <15
    cardiacOutput?: number   // L/min
    cardiacIndex?: number    // L/min/m² — <2.2 = low output, <1.8 = shock
    pvr?: number             // PVR (Wood units) — >3 = elevated
    svr?: number             // SVR (dyn.s/cm⁵)
    tpg?: number             // Transpulmonary gradient (mPAP - PCWP)
    dpg?: number             // Diastolic pulmonary gradient
    svO2?: number            // Mixed venous O2 sat (%) — normal >65%
    raPressure?: number      // RA pressure (mmHg)
    vasoreactivity?: boolean
    vasoreactivityAgent?: string
    vasoreactivityPositive?: boolean
  }

  // ── Coronary Imaging ─────────────────────────────────────────────────────────
  coronaryCalciumScore?: number   // Agatston CAC score — 0=none, 1-10=minimal, 11-100=mild, 101-400=mod, >400=severe
  cacCategory?: 'Zero' | 'Minimal' | 'Mild' | 'Moderate' | 'Severe' | ''
  ctAngiographyDone?: boolean
  ctaFindings?: string
  ctca?: {
    stenosisSeverity?: string
    highRiskPlaqueFeatures?: boolean
    notes?: string
  }
  invasiveAngiographyDone?: boolean
  angiographyFindings?: string   // e.g., "3VD", "LM disease", "Normal coronaries"
  coronaryAnatomy?: {
    lmStenosis?: number
    ladStenosis?: number
    lcxStenosis?: number
    rcaStenosis?: number
    syntaxScore?: number
    priorPciDate?: string
    priorCabgDate?: string
    revascularizationType?: 'None' | 'PCI' | 'CABG' | 'Both' | ''
  }

  // ── Heart Rate Variability (HRV) ─────────────────────────────────────────────
  hrv?: {
    hrvDate?: string
    sdnn?: number            // SDNN (ms) — <50 = very low, 50-100 = low; normal >100
    rmssd?: number           // RMSSD (ms) — parasympathetic activity
    pnn50?: number           // pNN50 (%) — proportion of NN >50ms difference
    lfPower?: number         // Low frequency power (ms²)
    hfPower?: number         // High frequency power (ms²)
    lfHfRatio?: number       // LF/HF ratio — sympathovagal balance
    sdannIndex?: number      // SDANN index (ms) — from 24h Holter
    holterDuration?: number  // Holter duration (hours)
    hrvNotes?: string
  }

  // ── Wearables & Rhythm Monitoring ─────────────────────────────────────────────
  holterWearable?: {
    afBurden?: number                // %
    pvcBurden?: number               // %
    circadianRhythmMetrics?: string  
  }

  // ── Quality of Life ──────────────────────────────────────────────────────────
  kccq?: {
    date?: string
    physicalLimitation?: number    // 0-100 domain score
    symptomFrequency?: number
    symptomBurden?: number
    qualityOfLife?: number
    socialLimitation?: number
    overallSummaryScore?: number   // Primary QoL endpoint in HF trials (DAPA-HF, EMPEROR)
    clinicalSummaryScore?: number
    totalSymptomScore?: number
  }
  mlhfq?: {
    date?: string
    totalScore?: number       // 0-105; <24 mild, 24-45 moderate, >45 severe
    physicalScore?: number
    emotionalScore?: number
  }
  saq?: {
    date?: string
    physicalLimitation?: number    // 0-100
    anginaFrequency?: number
    anginaStability?: number
    treatmentSatisfaction?: number
    qualityOfLife?: number
    summaryScore?: number
  }
  phq9Score?: number               // 0-27: depression screening; ≥10 = moderate depression
  gad7Score?: number               // 0-21: anxiety screening; ≥10 = moderate anxiety
  hadsAnxiety?: number
  hadsDepression?: number

  // ── Sleep-Disordered Breathing ───────────────────────────────────────────────
  sleep?: {
    screeningResult?: 'Positive' | 'Negative' | 'Not done'
    ahiIndex?: number          // Events/hr — <5 normal, 5-14 mild, 15-29 mod, ≥30 severe
    sleepApneaType?: 'OSA' | 'CSA' | 'Mixed' | ''
    epworthScore?: number      // 0-24; >10 = excessive daytime sleepiness
    treatment?: 'CPAP' | 'ASV' | 'BiPAP' | 'Mandibular' | 'Weight loss' | 'None' | ''
    nocturnalSatNadir?: number // % — O2 saturation nadir
    odiIndex?: number          // Oxygen desaturation index
    sleepStudyDate?: string
  }

  // ── Cardio-Oncology ──────────────────────────────────────────────────────────
  cardioOncology?: {
    cancerType?: string
    cancerStage?: string
    anthracyclineAgent?: string    // Doxorubicin, Epirubicin, etc.
    anthracyclineCumDose?: number  // mg/m² — >300 mg/m² doxorubicin = high risk
    trastuzumabExposure?: boolean
    pertuzumabExposure?: boolean
    tyrosineKinaseInhibitor?: string
    radiationField?: string
    radiationDose?: number         // Gy
    ctrcdClass?: 'None' | 'Class 1' | 'Class 2a' | 'Class 2b' | 'Class 3'
    baselineLvef?: number          // LVEF before chemotherapy
    lvefNadir?: number             // Lowest LVEF during treatment
    ongoingChemo?: boolean
    lastChemoDate?: string
    cardioprotection?: string      // e.g., lisinopril, carvedilol prophylaxis
  }

  // ── Genetics & Molecular ─────────────────────────────────────────────────────
  genetics?: {
    panelDone?: boolean
    panelDate?: string
    panelType?: string             // DCM panel, Comprehensive cardiomyopathy panel
    pathogenicVariant?: boolean
    gene?: string                  // TTN, LMNA, SCN5A, MYH7, TNNT2, PLN, RBM20, FLNC, BAG3
    variant?: string               // HGVS nomenclature
    variantClassification?: 'Pathogenic' | 'Likely pathogenic' | 'VUS' | 'Benign' | ''
    ttrAmyloidosis?: boolean
    ttrType?: 'Val122Ile' | 'Val30Met' | 'Thr60Ala' | 'wtTTR' | ''
    boneScintigraphyGrade?: 'Grade 0' | 'Grade 1' | 'Grade 2' | 'Grade 3' | ''
    autoantibodies?: boolean
    autoantibodyType?: string
    polygenicRiskScore?: number    // Standardised PRS — number of SD above population mean
    polygenicRiskPercentile?: number // Population percentile
    prsPanel?: string              // Which PRS panel used
    familialScreening?: 'Completed' | 'Recommended' | 'Declined' | 'Not indicated' | ''
  }

  // ── Medication Adherence ─────────────────────────────────────────────────────
  mmas8Score?: number              // 0-8 Morisky scale: <6=low, 6-<8=medium, 8=high adherence

  // ── Social Determinants of Health ────────────────────────────────────────────
  socialDeterminants?: {
    // Education
    educationYears?: number
    educationLevel?: 'None' | 'Primary' | 'Secondary' | 'Graduate' | 'Postgraduate' | ''
    // Employment & Income
    employmentStatus?: 'Employed' | 'Unemployed' | 'Retired' | 'Student' | 'Unable to work' | ''
    monthlyIncomeGroup?: '<10k' | '10-25k' | '25-50k' | '>50k' | '' // INR/month
    // Insurance & Access
    insuranceType?: 'Government (PMJAY/CGHS)' | 'Private' | 'Employer' | 'None' | ''
    distanceFromHospital?: number  // km
    transportAccess?: 'Own vehicle' | 'Public transport' | 'Relies on others' | 'Ambulance only' | ''
    // Living situation
    livingAlone?: boolean
    caregiver?: boolean
    caregiverRelationship?: string
    householdSize?: number
    residenceType?: 'Urban' | 'Semi-urban' | 'Rural' | ''
    // Literacy & adherence support
    healthLiteracy?: 'Adequate' | 'Marginal' | 'Inadequate' | ''
    localLanguage?: string
    mobilePhoneAccess?: boolean    // for telehealth/remote monitoring
    // Diet assessment
    dietSodiumIntake?: '<2g/day' | '2-4g/day' | '4-6g/day' | '>6g/day' | '' // WHO target <2g Na/day
    dietPotassiumIntake?: 'Adequate' | 'Low' | 'Excessive' | '' // RAASi patients risk hyperkalaemia
    dietType?: 'Vegetarian' | 'Non-vegetarian' | 'Vegan' | ''
    fluidRestriction?: '<1.5L/day' | '1.5-2L/day' | '>2L/day' | 'Not restricted' | ''
    dietaryAdherenceScore?: number  // 0-10 clinician-rated
    dietaryNotes?: string
  }

  // ── Environmental Exposure ────────────────────────────────────────────────────
  environmentalExposure?: {
    smokingPackYears?: number      // Pack-years (packs/day × years)
    currentSmoker?: boolean
    passiveSmoke?: boolean
    occupation?: string
    occupationalExposures?: string // Dust, chemicals, heavy metals
    pm25Exposure?: number          // Annual mean PM2.5 (µg/m³)
    airQualityIndex?: number       // Local AQI at residence
    residenceType?: 'Urban' | 'Semi-urban' | 'Rural' | ''
    biomassExposure?: boolean      // Cooking fuel / indoor air pollution
  }

  // ── Health Service Utilisation ───────────────────────────────────────────────
  healthUtilisation?: {
    // Prior 12 months
    hvHospAdmissions?: number        // Total hospital admissions (any cause)
    hvHfAdmissions?: number          // HF-specific admissions
    hvEmergencyVisits?: number       // A&E / Emergency department visits
    hvIcuAdmissions?: number         // ICU/HDU admissions
    hvIcuDays?: number               // Total ICU days
    hvHospitalDays?: number          // Total inpatient days
    hvCvProcedures?: string          // e.g., "PCI, CRT-D implant"
    hvReadmission30d?: boolean       // 30-day readmission after index event
    hvReadmission90d?: boolean
    hvLastAdmissionDate?: string
    hvLastAdmissionReason?: string
  }

  // ── Extended Patient-Reported Outcomes ───────────────────────────────────────
  sf36?: {
    date?: string
    physicalFunctioning?: number     // 0-100 domain score
    roleLimPhysical?: number
    bodilyPain?: number
    generalHealth?: number
    vitality?: number
    socialFunctioning?: number
    roleEmotional?: number
    mentalHealth?: number
    physicalComponentSummary?: number // PCS — norm ~50
    mentalComponentSummary?: number   // MCS — norm ~50
  }
  promis?: {
    date?: string
    fatigueScore?: number            // PROMIS Fatigue T-score (norm 50, SD 10)
    painIntensity?: number
    dyspneaScore?: number
    physicalFunction?: number
    globalPhysical?: number
    globalMental?: number
  }

  // ── Frailty Assessment (Extended) ────────────────────────────────────────────
  frailtyFried?: {
    date?: string
    weightLoss?: boolean             // Unintentional >4.5 kg in past year
    exhaustion?: boolean             // Self-reported
    weaknessGripRight?: number       // Grip strength (kg)
    weaknessGripLeft?: number
    slowness?: boolean               // Gait speed <0.8 m/s
    gaitSpeed?: number               // m/s — <0.8 = slow; measured over 5m
    lowPhysicalActivity?: boolean    // Kcal/week below sex-specific threshold
    friedScore?: 0 | 1 | 2 | 3 | 4 | 5  // 0=robust, 1-2=pre-frail, 3-5=frail
    friedCategory?: 'Robust' | 'Pre-frail' | 'Frail' | ''
  }
  clinicalFrailtyScale?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 // CFS: 1=very fit → 9=terminally ill

  // ── Functional Status Battery ────────────────────────────────────────────────
  functionalStatus?: {
    sppbScore?: number               // Short Physical Performance Battery (0-12): <10 = limited
    sppbBalance?: 0 | 1 | 2 | 3 | 4 // Balance tests
    sppbGait?: 0 | 1 | 2 | 3 | 4    // 4-metre walk
    sppbChair?: 0 | 1 | 2 | 3 | 4   // Chair rise x5
    adlScore?: number                // Basic ADL (Katz 0-6: 0=dependent, 6=independent)
    adlBathing?: boolean
    adlDressing?: boolean
    adlToileting?: boolean
    adlTransferring?: boolean
    adlContinence?: boolean
    adlFeeding?: boolean
    iadlScore?: number               // Lawton IADL (0-8): 0=low function
    tug?: number                     // Timed Up-and-Go test (seconds) — >12s = fall risk
    barthelIndex?: number            // 0-100: functional independence
  }

  // ── MACE Composite (last follow-up period) ───────────────────────────────────
  // Note: individual events are in the OutcomeEvent subcollection.
  // These fields store the most recent period summary for quick analytics.
  maceOccurred?: boolean             // MACE = CV death + MI + Stroke
  primaryEndpointMet?: boolean       // Site-defined primary endpoint
  primaryEndpointDate?: string
  censoredDate?: string              // Date of censoring if no event
  censorReason?: 'Lost to follow-up' | 'Withdrew consent' | 'Study end' | 'Alive no event' | ''

  // ── Risk Scores (computed + stored) ──────────────────────────────────────────
  maggicScore?: number
  maggicOneYearMortality?: number
  maggicThreeYearMortality?: number
  charmScore?: number
  h2fpefScore?: number
  h2fpefProbability?: number
  shfmOneYearSurvival?: number

  // Quality of Life - EQ-5D-5L
  symptomTrajectory?: 'Improving' | 'Stable' | 'Worsening' | ''
  eq5d?: {
    date?: string
    mobility?: 1 | 2 | 3 | 4 | 5
    selfCare?: 1 | 2 | 3 | 4 | 5
    usualActivities?: 1 | 2 | 3 | 4 | 5
    painDiscomfort?: 1 | 2 | 3 | 4 | 5
    anxietyDepression?: 1 | 2 | 3 | 4 | 5
    vasScore?: number                // EQ-VAS 0-100: patient's overall health today
    utilityIndex?: number            // Derived utility score (0-1)
    healthStateScore?: number        // Legacy alias for vasScore
  }

  // Meta
  createdAt: string
  updatedAt?: string
  editHistory?: Array<{
    updatedAt: string
    updatedFields: string[]
  }>
}

// ─── Outcome Events ──────────────────────────────────────────────────────────
export type EventType =
  | 'All-cause death'
  | 'CV death'
  | 'HF hospitalisation'
  | 'Urgent HF visit'
  | 'LVAD implant'
  | 'Heart transplant'
  | 'ICD appropriate shock'
  | 'ICD inappropriate shock'
  | 'Stroke / TIA'
  | 'Myocardial infarction'
  | 'AKI requiring RRT'
  | 'Worsening HF (outpatient)'
  | 'Ventricular arrhythmia'
  | 'AF new-onset'
  | 'Other CV event'

export interface OutcomeEvent {
  id: string
  patientId: string
  eventDate: string
  eventType: EventType
  description?: string
  hospitalName?: string
  daysFromIndex?: number  // days from first visit
  adjudicated: boolean
  adjudicatedBy?: string
  createdAt: string
}

export type OutcomeEventInput = Omit<OutcomeEvent, 'id' | 'createdAt'>

export type VisitInput = Omit<Visit, 'id' | 'createdAt'>

// ─── Analytics helpers ───────────────────────────────────────────────────────
export interface PopulationStats {
  totalPatients: number
  hfTypeBreakdown: Record<string, number>
  nyhaCounts: Record<string, number>
  etiologyCounts: Record<string, number>
  rhythmCounts: Record<string, number>
  avgLvef: number | null
  avgAge: number | null
  avgNtProBnp: number | null
  avgEgfr: number | null
  medPrescribingRates: Record<string, number>
  deviceCounts: Record<string, number>
  lvefBins: Record<string, number>
}

export interface TrendPoint {
  date: string
  value: number | null
  visitId: string
}

export interface PatientTrends {
  lvef: TrendPoint[]
  ntProBNP: TrendPoint[]
  nyha: TrendPoint[]
  egfr: TrendPoint[]
  weight: TrendPoint[]
  bpSystolic: TrendPoint[]
  heartRate: TrendPoint[]
  sixMWT: TrendPoint[]
}

// ─── Registry Fields Configuration ───────────────────────────────────────────

export type FieldType = 'Text' | 'Number' | 'Date' | 'Dropdown' | 'Boolean' | 'Multi-Select' | 'Textarea' | 'Score'

export interface RegistryField {
  id: string
  srNo: number
  fieldName: string
  displayLabel: string
  dataType: FieldType
  mandatory: boolean
  pii: boolean
  active: boolean
  category: string
  level: 'Level 1' | 'Level 2'
}

export const BUILT_IN_FIELDS: RegistryField[] = [
  // ─── Level 1: Common Core Dataset ───────────────────────────────────────────
  { id: '1',  srNo: 1,  fieldName: 'visitDate',     displayLabel: 'Visit Date',             dataType: 'Date',        mandatory: true,  pii: false, active: true, category: 'Visit',       level: 'Level 1' },
  { id: '2',  srNo: 2,  fieldName: 'visitType',     displayLabel: 'Visit Type',             dataType: 'Dropdown',    mandatory: true,  pii: false, active: true, category: 'Visit',       level: 'Level 1' },
  { id: '3',  srNo: 3,  fieldName: 'firstName',     displayLabel: 'First Name',             dataType: 'Text',        mandatory: true,  pii: true,  active: true, category: 'Clinical',    level: 'Level 1' },
  { id: '4',  srNo: 4,  fieldName: 'lastName',      displayLabel: 'Last Name',              dataType: 'Text',        mandatory: true,  pii: true,  active: true, category: 'Clinical',    level: 'Level 1' },
  { id: '5',  srNo: 5,  fieldName: 'dob',           displayLabel: 'Date of Birth',          dataType: 'Date',        mandatory: true,  pii: true,  active: true, category: 'Clinical',    level: 'Level 1' },
  { id: '6',  srNo: 6,  fieldName: 'sex',           displayLabel: 'Sex',                    dataType: 'Dropdown',    mandatory: true,  pii: false, active: true, category: 'Clinical',    level: 'Level 1' },
  { id: '7',  srNo: 7,  fieldName: 'mrn',           displayLabel: 'Hospital ID (HID)',      dataType: 'Text',        mandatory: false, pii: true,  active: true, category: 'Clinical',    level: 'Level 1' },
  { id: '8',  srNo: 8,  fieldName: 'bpSystolic',    displayLabel: 'Systolic BP (mmHg)',     dataType: 'Number',      mandatory: false, pii: false, active: true, category: 'Clinical',    level: 'Level 1' },
  { id: '9',  srNo: 9,  fieldName: 'bpDiastolic',   displayLabel: 'Diastolic BP (mmHg)',    dataType: 'Number',      mandatory: false, pii: false, active: true, category: 'Clinical',    level: 'Level 1' },
  { id: '10', srNo: 10, fieldName: 'heartRate',     displayLabel: 'Heart Rate (bpm)',       dataType: 'Number',      mandatory: false, pii: false, active: true, category: 'Clinical',    level: 'Level 1' },
  { id: '11', srNo: 11, fieldName: 'weight',        displayLabel: 'Weight (kg)',            dataType: 'Number',      mandatory: false, pii: false, active: true, category: 'Clinical',    level: 'Level 1' },
  { id: '12', srNo: 12, fieldName: 'height',        displayLabel: 'Height (cm)',            dataType: 'Number',      mandatory: false, pii: false, active: true, category: 'Clinical',    level: 'Level 1' },
  { id: '13', srNo: 13, fieldName: 'currentSmoker', displayLabel: 'Current Smoker',         dataType: 'Boolean',     mandatory: false, pii: false, active: true, category: 'Clinical',    level: 'Level 1' },
  { id: '14', srNo: 14, fieldName: 'comorbidities',  displayLabel: 'Comorbidities',          dataType: 'Textarea',    mandatory: false, pii: false, active: true, category: 'Clinical',    level: 'Level 1' },
  { id: '15', srNo: 15, fieldName: 'lvef',          displayLabel: 'LVEF (%)',               dataType: 'Number',      mandatory: false, pii: false, active: true, category: 'Echo',        level: 'Level 1' },
  { id: '16', srNo: 16, fieldName: 'ntProBNP',      displayLabel: 'NT-proBNP (pg/mL)',      dataType: 'Number',      mandatory: false, pii: false, active: true, category: 'Labs',        level: 'Level 1' },
  { id: '17', srNo: 17, fieldName: 'creatinine',    displayLabel: 'Creatinine (mg/dL)',     dataType: 'Number',      mandatory: false, pii: false, active: true, category: 'Labs',        level: 'Level 1' },
  { id: '18', srNo: 18, fieldName: 'egfr',          displayLabel: 'eGFR (ml/min)',          dataType: 'Number',      mandatory: false, pii: false, active: true, category: 'Labs',        level: 'Level 1' },
  { id: '19', srNo: 19, fieldName: 'hb',            displayLabel: 'Hemoglobin (g/dL)',      dataType: 'Number',      mandatory: false, pii: false, active: true, category: 'Labs',        level: 'Level 1' },
  { id: '20', srNo: 20, fieldName: 'hba1c',         displayLabel: 'HbA1c (%)',              dataType: 'Number',      mandatory: false, pii: false, active: true, category: 'Labs',        level: 'Level 1' },

  // ─── Level 2: Subregistry & Disease-Specific Fields ─────────────────────────
  { id: '21', srNo: 21, fieldName: 'hfType',        displayLabel: 'HF Phenotype',           dataType: 'Dropdown',    mandatory: false, pii: false, active: true, category: 'Clinical',    level: 'Level 2' },
  { id: '22', srNo: 22, fieldName: 'nyha',          displayLabel: 'NYHA Class',             dataType: 'Dropdown',    mandatory: false, pii: false, active: true, category: 'Clinical',    level: 'Level 2' },
  { id: '23', srNo: 23, fieldName: 'eEPrime',       displayLabel: 'E/e\' Ratio',            dataType: 'Number',      mandatory: false, pii: false, active: true, category: 'Echo',        level: 'Level 2' },
  { id: '24', srNo: 24, fieldName: 'lvMassIndex',   displayLabel: 'LV Mass Index (g/m²)',   dataType: 'Number',      mandatory: false, pii: false, active: true, category: 'Echo',        level: 'Level 2' },
  { id: '25', srNo: 25, fieldName: 'rvFreeWallStrain', displayLabel: 'RV Free Wall Strain (%)', dataType: 'Number',   mandatory: false, pii: false, active: true, category: 'Echo',        level: 'Level 2' },
  { id: '26', srNo: 26, fieldName: 'gls',           displayLabel: 'GLS (%)',                dataType: 'Number',      mandatory: false, pii: false, active: true, category: 'Echo',        level: 'Level 2' },
  { id: '27', srNo: 27, fieldName: 'betaBlocker',   displayLabel: 'Beta Blocker Util.',     dataType: 'Dropdown',    mandatory: false, pii: false, active: true, category: 'Medications', level: 'Level 2' },
  { id: '28', srNo: 28, fieldName: 'raasi',         displayLabel: 'RAASi Util. (ACE/ARB/ARNI)', dataType: 'Dropdown', mandatory: false, pii: false, active: true, category: 'Medications', level: 'Level 2' },
  { id: '29', srNo: 29, fieldName: 'sglt2i',        displayLabel: 'SGLT2i Util.',           dataType: 'Dropdown',    mandatory: false, pii: false, active: true, category: 'Medications', level: 'Level 2' },
  { id: '30', srNo: 30, fieldName: 'mra',           displayLabel: 'MRA Util.',              dataType: 'Dropdown',    mandatory: false, pii: false, active: true, category: 'Medications', level: 'Level 2' },
  { id: '31', srNo: 31, fieldName: 'hospHistory',   displayLabel: 'Prior Hospitalization',  dataType: 'Dropdown',    mandatory: false, pii: false, active: true, category: 'Clinical',    level: 'Level 2' },
  { id: '32', srNo: 32, fieldName: 'hospCount',     displayLabel: 'Hospitalization Count',  dataType: 'Number',      mandatory: false, pii: false, active: true, category: 'Clinical',    level: 'Level 2' },
  { id: '33', srNo: 33, fieldName: 'rhythm',        displayLabel: 'Cardiac Rhythm',         dataType: 'Dropdown',    mandatory: false, pii: false, active: true, category: 'Clinical',    level: 'Level 2' },
  { id: '34', srNo: 34, fieldName: 'afBurden',      displayLabel: 'AF Burden (%)',          dataType: 'Number',      mandatory: false, pii: false, active: true, category: 'Wearables',   level: 'Level 2' },
  { id: '35', srNo: 35, fieldName: 'noac',          displayLabel: 'NOAC Util.',             dataType: 'Dropdown',    mandatory: false, pii: false, active: true, category: 'Medications', level: 'Level 2' },
  { id: '36', srNo: 36, fieldName: 'vki',           displayLabel: 'VKA Util.',              dataType: 'Dropdown',    mandatory: false, pii: false, active: true, category: 'Medications', level: 'Level 2' },
  { id: '37', srNo: 37, fieldName: 'sdnn',          displayLabel: 'SDNN (ms)',              dataType: 'Number',      mandatory: false, pii: false, active: true, category: 'Wearables',   level: 'Level 2' },
  { id: '38', srNo: 38, fieldName: 'rmssd',         displayLabel: 'RMSSD (ms)',             dataType: 'Number',      mandatory: false, pii: false, active: true, category: 'Wearables',   level: 'Level 2' },
  { id: '39', srNo: 39, fieldName: 'ahiIndex',      displayLabel: 'Sleep AHI Index',        dataType: 'Number',      mandatory: false, pii: false, active: true, category: 'Clinical',    level: 'Level 2' },
  { id: '40', srNo: 40, fieldName: 'sleepApneaType', displayLabel: 'Sleep Apnea Type',      dataType: 'Dropdown',    mandatory: false, pii: false, active: true, category: 'Clinical',    level: 'Level 2' },
  { id: '41', srNo: 41, fieldName: 'device',        displayLabel: 'Implanted Device Types',  dataType: 'Multi-Select', mandatory: false, pii: false, active: true, category: 'Clinical',    level: 'Level 2' },
  { id: '42', srNo: 42, fieldName: 'deviceNotes',   displayLabel: 'Device Model/Telemetry', dataType: 'Textarea',    mandatory: false, pii: false, active: true, category: 'Clinical',    level: 'Level 2' },
  { id: '43', srNo: 43, fieldName: 'sixMWT',        displayLabel: '6-Minute Walk Test (m)', dataType: 'Number',      mandatory: false, pii: false, active: true, category: 'Clinical',    level: 'Level 2' },
  { id: '44', srNo: 44, fieldName: 'peakVO2',       displayLabel: 'Peak VO2 (ml/kg/min)',   dataType: 'Number',      mandatory: false, pii: false, active: true, category: 'Clinical',    level: 'Level 2' },
  { id: '45', srNo: 45, fieldName: 'exerciseDuration', displayLabel: 'Exercise Duration (min)', dataType: 'Number',    mandatory: false, pii: false, active: true, category: 'Clinical',    level: 'Level 2' },
  { id: '46', srNo: 46, fieldName: 'kccqScore',     displayLabel: 'KCCQ Summary Score',     dataType: 'Score',       mandatory: false, pii: false, active: true, category: 'QoL',         level: 'Level 2' },
  { id: '47', srNo: 47, fieldName: 'employmentStatus', displayLabel: 'Employment Status',   dataType: 'Dropdown',    mandatory: false, pii: false, active: true, category: 'Clinical',    level: 'Level 2' },
  { id: '48', srNo: 48, fieldName: 'maceOccurred',  displayLabel: 'MACE Occurred',          dataType: 'Boolean',     mandatory: false, pii: false, active: true, category: 'Clinical',    level: 'Level 2' },
  { id: '49', srNo: 49, fieldName: 'pulseWaveVelocity', displayLabel: 'Pulse Wave Velocity (m/s)', dataType: 'Number',  mandatory: false, pii: false, active: true, category: 'Vascular',   level: 'Level 2' },
  { id: '50', srNo: 50, fieldName: 'hsTnT',         displayLabel: 'hs-TnT (pg/mL)',         dataType: 'Number',      mandatory: false, pii: false, active: true, category: 'Biomarkers',  level: 'Level 2' },
  { id: '51', srNo: 51, fieldName: 'hsCrp',         displayLabel: 'hs-CRP (mg/L)',          dataType: 'Number',      mandatory: false, pii: false, active: true, category: 'Biomarkers',  level: 'Level 2' },
  { id: '52', srNo: 52, fieldName: 'il6',           displayLabel: 'IL-6 (pg/mL)',           dataType: 'Number',      mandatory: false, pii: false, active: true, category: 'Biomarkers',  level: 'Level 2' },
]

