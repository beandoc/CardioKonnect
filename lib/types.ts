// ─── Shared primitives ──────────────────────────────────────────────────────
export type Prescribed = 'Yes' | 'No' | ''

export type DataCertainty = 
  | 'measured'       // Directly measured / tested in current encounter
  | 'reported'       // Patient / caregiver verbal report
  | 'not_done'       // Intentionally not done / unavailable at site
  | 'unknown'        // Requested or checked but inconclusive / unknown
  | 'not_applicable' // Not applicable for this patient phenotype

export type IndianEtiology =
  | 'Ischaemic CAD'
  | 'Rheumatic Heart Disease'
  | 'Hypertensive Heart Disease'
  | 'Dilated / Non-ischaemic Cardiomyopathy'
  | 'Peripartum Cardiomyopathy'
  | 'Myocarditis'
  | 'Tachycardia-mediated Cardiomyopathy'
  | 'Congenital Heart Disease'
  | 'Infiltrative / Amyloidosis'
  | 'Endomyocardial Fibrosis'
  | 'Alcohol / Toxic Cardiomyopathy'
  | 'Chemotherapy / Cardio-oncology'
  | 'CKD / Cardiorenal / Uremic'
  | 'Pulmonary / Cor Pulmonale / Right HF'
  | 'Unknown / Cryptogenic'

export type NonPrescriptionReason =
  | 'Hypotension (SBP <90–100 mmHg)'
  | 'Severe Renal Impairment / AKI'
  | 'Hyperkalaemia (K+ >5.5 mmol/L)'
  | 'Bradycardia / Conduction Block'
  | 'Allergy / Intolerance'
  | 'Cost / Financial Unavailability'
  | 'Patient / Family Refusal'
  | 'Clinician Clinical Decision'
  | 'Not Indicated for Phenotype'
  | string

export interface SocioeconomicData {
  facilityType?: 'Public / Government Medical College' | 'Private Corporate' | 'Trust / Charitable' | 'Military / Armed Forces / ECHS'
  state?: string
  district?: string
  residenceType?: 'Urban' | 'Peri-Urban' | 'Rural'
  insuranceScheme?: 'PMJAY (Ayushman Bharat)' | 'CGHS' | 'ECHS' | 'State Scheme (e.g. MPJAY)' | 'Private Commercial Insurance' | 'Out-of-pocket / Self-funded' | 'Charity / Concession'
  outOfPocketCostCategory?: '< ₹3,000/mo' | '₹3,000 - ₹10,000/mo' | '> ₹10,000/mo'
  travelDistanceKm?: number
  travelTimeHours?: number
  drugAvailabilitySource?: 'Jan Aushadhi Kendra (Generic)' | 'Hospital / Govt Free Pharmacy' | 'Retail Chemist' | 'Home Delivery'
  caregiverPhoneAccess?: 'Dedicated Patient Phone' | 'Caregiver Phone Available' | 'No Direct Phone'
  educationLevel?: 'No formal education' | 'Primary school' | 'Secondary / High school' | 'Graduate / Higher'
  primaryLanguage?: string
}

export interface MedEntry {
  prescribed: Prescribed
  genericDrug?: string            // e.g., Sacubitril/Valsartan, Dapagliflozin, Bisoprolol
  type?: string
  formulation?: string            // e.g., Sacubitril 24mg + Valsartan 26mg (50mg salt), Metoprolol succinate ER
  dose?: string
  frequency?: 'OD' | 'BD' | 'TDS' | 'QID' | 'PRN' | string
  route?: 'Oral' | 'IV' | 'Subcutaneous' | 'Inhaled' | string
  reason?: NonPrescriptionReason  // reason if not prescribed
  startDate?: string
  stopDate?: string
  changeDate?: string
  changeReason?: string
  certainty?: DataCertainty
}

// ─── Patient (demographics & cohort definition) ──────────────────────────────
export interface Patient {
  id: string
  // Cohort Classification (ADHF vs Chronic OPD separation)
  cohortType?: 'ADHF_Inpatient' | 'Chronic_OPD'
  
  // Demographics
  firstName: string
  lastName: string
  dob: string          // ISO date: YYYY-MM-DD
  sex: 'Male' | 'Female'
  mrn?: string         // Medical record number / Hospital ID (Column D)
  srNo?: number        // Registry Serial Number (Column A)
  contact?: string
  email?: string
  status?: 'Active' | 'Inactive' | 'Pending'
  consentStatus?: 'Granted' | 'Revoked' | 'Pending' | 'Declined'
  address?: string
  comorbidities?: string[]
  allergies?: string
  indexDate?: string    // ISO date of diagnosis / enrollment
  
  // Cached latest visit indicators
  hfType?: 'HFrEF' | 'HFmrEF' | 'HFpEF' | 'HFimpEF' | string
  nyha?: string
  lvef?: number
  
  // Meta
  createdAt: string    // ISO timestamp
  updatedAt: string
  visitCount?: number
  lastVisitDate?: string

  // HF Registry demographics & Indian Hierarchy
  registryId?: string
  indianCitizen?: boolean
  ethnicity?: 'Indian' | string
  studyConsented?: boolean
  hfConfirmationDate?: string
  educationYears?: number
  abhaId?: string
  occupation?: string
  indexEtiology?: (IndianEtiology | string)[]
  indexEtiologyOther?: string
  familyHistoryPrematureCVD?: boolean
  familyHistorySuddenDeath?: boolean
  familyHistoryCardiomyopathy?: boolean
  familyHistoryGeneticHeart?: boolean
  
  // Socio-Economic & Health Equity Matrix
  socioeconomic?: SocioeconomicData
  
  addressHouse?: string
  addressStreet?: string
  addressPost?: string
  addressDistrict?: string
  addressState?: string
  addressPin?: string
  secondaryContact?: string
  caregiverContact?: string
  caregiverSecondaryContact?: string

  // eConsent Version Tracking
  consentVersion?: string
  consentDate?: string
  consentWitness?: string
  consentWithdrawalDate?: string
  consentWithdrawalReason?: string
  reConsentNeeded?: boolean
  reConsentDate?: string

  // GCP Exclusions
  exclusionReviewed?: boolean
  excludeActiveTrial?: boolean
  excludeTerminalIllness?: boolean
  excludeNonCompliance?: boolean

  // Mortality / vital status & fixed follow-up tracking
  vitalStatus?: 'Alive' | 'Dead' | 'Lost to Follow-Up'
  dateOfDeath?: string              // ISO date
  deathCauseCategory?: 'Cardiovascular' | 'Non-cardiovascular' | 'Unknown'
  lastKnownAliveDate?: string       // ISO date for Kaplan-Meier / censoring
  vitalStatusSource?: 'In-Person Visit' | 'Phone Call (Patient)' | 'Phone Call (Caregiver)' | 'Hospital Record' | 'Civil Registry'
  lostToFollowUpReason?: string

  // Additional registry variables
  age?: number
  residenceType?: string
  hfDuration?: string
  comorbidHypertension?: boolean
  comorbidDiabetes?: boolean
  comorbidDyslipidemia?: boolean
  comorbidCAD?: boolean
  comorbidPriorMI?: boolean
  comorbidPriorPCI?: boolean
  comorbidPriorCABG?: boolean
  comorbidAF?: boolean
  comorbidStrokeTIA?: boolean
  comorbidPAD?: boolean
  comorbidCKD?: boolean
  comorbidCOPD?: boolean
  comorbidOSA?: boolean
  comorbidThyroid?: boolean
  comorbidIronDeficiency?: boolean
  icdPresence?: boolean
  crtPresence?: boolean
  anticoagulation?: string
  antiarrhythmic?: string
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
  bmi?: number         // kg/m²
  o2Sat?: number       // %
  oedema?: string      // None / Mild / Moderate / Severe

  // Vitals
  bpSystolic?: number
  bpDiastolic?: number
  heartRate?: number   // bpm
  respiratoryRate?: number

  // Clinical assessment
  nyha?: 'I' | 'II' | 'III' | 'IV'
  rhythm?: 'Sinus' | 'AF' | 'Atrial Flutter' | 'VT' | 'Not Known' | 'Other'
  sixMWT?: number      // metres
  hfType?: 'HFrEF' | 'HFmrEF' | 'HFpEF' | 'HFimpEF'
  etiology?: string[]
  etiologyOther?: string

  // Hospitalisation
  hospHistory?: 'Yes' | 'No'
  hospCount?: number
  hospDetails?: string

  // ── Echocardiography ────────────────────────────────────────────────────────
  lvef?: number        // %
  priorLvef?: number   // prior documented LVEF (for HFimpEF determination)
  lvefMethod?: 'Biplane Simpson (2D)' | '3D Echo' | 'Automated Strain' | 'Visual Eyeballing' | string
  lvefModality?: 'TTE' | 'TEE' | 'CMR' | 'MUGA' | string
  echoImageAvailability?: 'DICOM Archived' | 'Report Only' | 'None' | string
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
  hdl?: number         // mg/dL — HDL cholesterol
  totalCholesterol?: number // mg/dL — Total cholesterol
  alt?: number         // U/L — ALT (SGPT)
  ast?: number         // U/L — AST (SGOT)
  bilirubin?: number   // mg/dL — Total bilirubin
  albumin?: number     // g/dL — Albumin
  magnesium?: number   // mg/dL — Magnesium
  wbc?: number         // cells/µL — White Blood Cell count
  platelets?: number   // 10³/µL — Platelet count
  inr?: number         // INR
  pt?: number          // seconds — Prothrombin Time
  alp?: number         // U/L — Alkaline Phosphatase
  ggt?: number         // U/L — Gamma-Glutamyl Transferase
  totalProtein?: number // g/dL — Total Protein
  directBilirubin?: number // mg/dL — Direct Bilirubin
  aptt?: number        // seconds — activated Partial Thromboplastin Time
  hct?: number         // % — Hematocrit
  mcv?: number         // fL — Mean Corpuscular Volume
  nonHdl?: number      // mg/dL — Non-HDL Cholesterol
  apoB?: number        // mg/dL — Apolipoprotein B
  lpA?: number         // mg/dL — Lipoprotein(a)

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
  vericiguat?: MedEntry
  tafamidis?: MedEntry

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

  // ── 6MWT Extended ────────────────────────────────────────────────────────────
  sixMWTBorgScore?: number        // Borg dyspnea scale at end (0–10)
  sixMWTO2SatPre?: number         // O2 saturation before walk (%)
  sixMWTO2SatPost?: number        // O2 saturation after walk (%)
  sixMWTHrPeak?: number           // Peak HR during walk (bpm)
  sixMWTStoppedEarly?: boolean    // Walk stopped before 6 min

  // ── Tobacco & Alcohol — Social History ────────────────────────────────────────
  tobaccoStatus?: 'Never' | 'Current' | 'Former' | ''
  tobaccoType?: string[]          // Cigarette / Bidi / Smokeless (gutka/pan) / Mixed
  tobaccoPackYears?: number
  tobaccoQuitDate?: string
  alcoholStatus?: 'Never' | 'Current' | 'Former' | ''
  alcoholUnitsPerWeek?: number
  alcoholCardiomyopathy?: boolean // Is alcohol the primary HF etiology?

  // ── Thyroid Detail ────────────────────────────────────────────────────────────
  thyroidType?: 'Hypothyroid' | 'Hyperthyroid' | 'Subclinical hypo' | 'Subclinical hyper' | ''
  thyroidOnTreatment?: boolean

  // ── GDMT Numeric Doses (mg) ───────────────────────────────────────────────────
  raasiDoseMg?: number            // e.g. ramipril 10, sacubitril/valsartan 97/103
  betablockerDoseMg?: number      // e.g. carvedilol 25
  mraDoseMg?: number              // e.g. spironolactone 25
  sglt2iDoseMg?: number           // e.g. dapagliflozin 10
  furosemideDoseMgDaily?: number  // Daily loop diuretic dose in mg

  // ── Index Admission Type ──────────────────────────────────────────────────────
  indexAdmissionType?: 'De-novo HF' | 'Decompensated chronic HF' | 'Incidental' | ''

  // ── PHQ-9 Extended ────────────────────────────────────────────────────────────
  phq9Date?: string
  phq9Category?: 'Minimal' | 'Mild' | 'Moderate' | 'Moderately Severe' | 'Severe' | ''

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
  pericardialEffusion?: 'None' | 'Trivial' | 'Small' | 'Moderate' | 'Large' | '' // Pericardial effusion grade
  tamponadeFeatures?: boolean // tamponade features present
  lvThrombus?: boolean // LV thrombus present
  lvThrombusLocation?: string // LV thrombus location
  lvotGradientResting?: number // LVOT gradient resting (mmHg)
  lvotGradientProvoked?: number // LVOT gradient provoked (mmHg)
  septalEPrime?: number // Septal E' velocity (cm/s)
  lateralEPrime?: number // Lateral E' velocity (cm/s)
  laPressureEstimate?: number // Estimated LA pressure (mmHg)
  mrGrade?: 'None' | 'Mild' | 'Moderate' | 'Severe' | ''
  arGrade?: 'None' | 'Mild' | 'Moderate' | 'Severe' | ''
  asGrade?: 'None' | 'Mild' | 'Moderate' | 'Severe' | ''
  msGrade?: 'None' | 'Mild' | 'Moderate' | 'Severe' | ''
  trGrade?: 'None' | 'Mild' | 'Moderate' | 'Severe' | ''
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
  // ── Interval Events (since last visit) ───────────────────────────────────
  eventMI?: boolean                  // Myocardial infarction since last visit
  eventStroke?: boolean              // Stroke / TIA since last visit
  eventVTVF?: boolean                // VT / VF episode since last visit
  eventICDShock?: boolean            // ICD appropriate shock since last visit
  eventHospitalisation?: boolean     // Any hospitalisation since last visit (see hospCount)

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
  hfapeffScore?: number
  hfapeffProbability?: number
  chadsvascScore?: number
  hasbledScore?: number
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
    utilityIndex?: number            // Derived utility score (0-1)
    healthStateScore?: number        // Legacy alias for vasScore
  }

  // HF Registry clinical indicators
  symptomDyspnea?: boolean
  symptomFatigue?: boolean
  symptomEdema?: boolean
  symptomPalpitation?: boolean
  symptomAngina?: boolean
  symptomAscites?: boolean
  signLungRales?: boolean
  signPleuralEffusion?: boolean
  signElevatedJVP?: boolean
  signS3?: boolean
  signDependentEdema?: boolean
  signHepatomegaly?: boolean
  signCardiomegaly?: boolean

  jvpStatus?: 'Elevated' | 'Not elevated' | ''
  ventricularArrhythmia?: boolean

  peakTropT?: number
  tropTPositive?: boolean
  peakTropI?: number
  tropIPositive?: boolean
  serumUrea?: number
  bun?: number
  bnpDischarge?: number
  ntProBnpDischarge?: number

  ventilationSupport?: 'No' | 'NIV' | 'Invasive' | ''
  mcsSupport?: 'No' | 'IABP' | 'VAD' | ''

  weightDischarge?: number
  dischargeOutcome?: 'Discharge' | 'Death' | 'Referred' | ''
  causeOfDeath?: 'SCD' | 'Pump failure' | 'MODS' | 'Others' | ''
  lastHospDate?: string

  // Additional registry variables
  residenceType?: string
  hfDuration?: string
  hvHfAdmissions?: number
  comorbidHypertension?: boolean
  comorbidDiabetes?: boolean
  comorbidDyslipidemia?: boolean
  comorbidCAD?: boolean
  comorbidPriorMI?: boolean
  comorbidPriorPCI?: boolean
  comorbidPriorCABG?: boolean
  comorbidAF?: boolean
  comorbidStrokeTIA?: boolean
  comorbidPAD?: boolean
  comorbidCKD?: boolean
  comorbidCOPD?: boolean
  comorbidOSA?: boolean
  comorbidThyroid?: boolean
  comorbidIronDeficiency?: boolean
  symptomOrthopnea?: boolean
  anticoagulation?: string
  antiarrhythmic?: string
  icdPresence?: boolean
  icdIndication?: string
  crtPresence?: boolean
  bivPacingPercent?: number
  gdmtStatus?: string
  medAdherence?: string
  outcomeHeartTransplant?: boolean
  outcomeLVAD?: boolean
  needAdvancedHFTherapy?: boolean

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
  encounterType?: 'Inpatient Index' | 'Readmission' | 'Emergency Visit' | 'Out-of-Hospital Event'
  eventDate: string
  admissionDate?: string
  dischargeDate?: string
  lengthOfStayDays?: number
  
  eventType: EventType
  primaryReasonDescription?: string
  hfConfirmationCriteriaMet?: boolean
  
  // Acute Inpatient Interventions Used
  interventions?: {
    ivLoopDiuretics?: boolean
    ivInotropesOrVasopressors?: boolean
    inotropesUsed?: ('Dobutamine' | 'Milrinone' | 'Noradrenaline' | 'Dopamine' | 'Levosimendan')[]
    nonInvasiveVentilation?: boolean // CPAP / BiPAP
    invasiveMechanicalVentilation?: boolean
    ultrafiltrationOrRRT?: boolean
    mechanicalCirculatorySupport?: boolean // IABP / ECMO / Impella
  }
  
  // Facility Context
  hospitalName?: string
  facilityType?: 'Public/Government' | 'Private/Corporate' | 'Trust/Charitable' | 'Military/ECHS'
  
  // Death Documentation & Certainty (if event is Death)
  deathDetails?: {
    causeCategory?: 'Cardiovascular - Pump Failure' | 'Cardiovascular - Sudden Death' | 'Cardiovascular - Acute MI' | 'Cardiovascular - Stroke' | 'Non-Cardiovascular - Sepsis' | 'Non-Cardiovascular - Renal Failure' | 'Non-Cardiovascular - Malignancy' | 'Non-Cardiovascular - Other' | 'Undetermined'
    causeCertainty?: 'Definite' | 'Probable' | 'Possible'
    deathSource?: 'Hospital Death Summary' | 'Death Certificate' | 'Verbal Autopsy from Family' | 'Municipal Civil Records'
    placeOfDeath?: 'In-Hospital (Enrolled Centre)' | 'In-Hospital (Other Centre)' | 'At Home' | 'En Route / Transit'
  }
  
  supportingDocumentRef?: string
  description?: string
  daysFromIndex?: number  // days from index admission
  
  // Central Adjudication Tracking
  adjudicated: boolean
  adjudicationStatus?: 'Pending Review' | 'Adjudicated - Confirmed' | 'Adjudicated - Reclassified' | 'Adjudicated - Rejected'
  adjudicatedBy?: string
  adjudicationDate?: string
  adjudicationNotes?: string
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
  kccq?: TrendPoint[]
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
  { id: '53', srNo: 53, fieldName: 'indianCitizen', displayLabel: 'Indian Citizen',         dataType: 'Boolean',     mandatory: false, pii: false, active: true, category: 'Clinical',    level: 'Level 2' },
  { id: '54', srNo: 54, fieldName: 'studyConsented', displayLabel: 'Consented for Study',   dataType: 'Boolean',     mandatory: false, pii: false, active: true, category: 'Clinical',    level: 'Level 2' },
  { id: '55', srNo: 55, fieldName: 'hfConfirmationDate', displayLabel: 'HF Confirmation Date', dataType: 'Date',     mandatory: false, pii: false, active: true, category: 'Clinical',    level: 'Level 2' },
  { id: '56', srNo: 56, fieldName: 'educationYears', displayLabel: 'Years of Education',    dataType: 'Number',      mandatory: false, pii: false, active: true, category: 'Clinical',    level: 'Level 2' },
  { id: '57', srNo: 57, fieldName: 'abhaId',         displayLabel: 'ABHA ID',               dataType: 'Text',        mandatory: false, pii: true,  active: true, category: 'Clinical',    level: 'Level 2' },
  { id: '58', srNo: 58, fieldName: 'addressHouse',   displayLabel: 'House/Flat No',         dataType: 'Text',        mandatory: false, pii: false, active: true, category: 'Clinical',    level: 'Level 2' },
  { id: '59', srNo: 59, fieldName: 'addressStreet',  displayLabel: 'Street/Locality',       dataType: 'Text',        mandatory: false, pii: false, active: true, category: 'Clinical',    level: 'Level 2' },
  { id: '60', srNo: 60, fieldName: 'addressPost',    displayLabel: 'Post Office',           dataType: 'Text',        mandatory: false, pii: false, active: true, category: 'Clinical',    level: 'Level 2' },
  { id: '61', srNo: 61, fieldName: 'addressDistrict', displayLabel: 'District',              dataType: 'Text',        mandatory: false, pii: false, active: true, category: 'Clinical',    level: 'Level 2' },
  { id: '62', srNo: 62, fieldName: 'addressState',   displayLabel: 'State / UT',            dataType: 'Text',        mandatory: false, pii: false, active: true, category: 'Clinical',    level: 'Level 2' },
  { id: '63', srNo: 63, fieldName: 'addressPin',     displayLabel: 'PIN Code',              dataType: 'Text',        mandatory: false, pii: false, active: true, category: 'Clinical',    level: 'Level 2' },
  { id: '64', srNo: 64, fieldName: 'secondaryContact', displayLabel: 'Secondary Phone No',   dataType: 'Text',        mandatory: false, pii: false, active: true, category: 'Clinical',    level: 'Level 2' },
  { id: '65', srNo: 65, fieldName: 'caregiverContact', displayLabel: 'Caregiver Phone No',   dataType: 'Text',        mandatory: false, pii: false, active: true, category: 'Clinical',    level: 'Level 2' },
  { id: '66', srNo: 66, fieldName: 'caregiverSecondaryContact', displayLabel: 'Caregiver Sec Phone No', dataType: 'Text', mandatory: false, pii: false, active: true, category: 'Clinical', level: 'Level 2' },
  { id: '67', srNo: 67, fieldName: 'symptomDyspnea', displayLabel: 'Symptoms: Dyspnoea/PND/Orthopnoea', dataType: 'Boolean', mandatory: false, pii: false, active: true, category: 'Clinical', level: 'Level 2' },
  { id: '68', srNo: 68, fieldName: 'symptomFatigue', displayLabel: 'Symptoms: Fatigue/↓ effort tolerance', dataType: 'Boolean', mandatory: false, pii: false, active: true, category: 'Clinical', level: 'Level 2' },
  { id: '69', srNo: 69, fieldName: 'symptomEdema',   displayLabel: 'Symptoms: History of Edema', dataType: 'Boolean', mandatory: false, pii: false, active: true, category: 'Clinical', level: 'Level 2' },
  { id: '70', srNo: 70, fieldName: 'symptomPalpitation', displayLabel: 'Symptoms: Palpitation', dataType: 'Boolean',  mandatory: false, pii: false, active: true, category: 'Clinical',    level: 'Level 2' },
  { id: '71', srNo: 71, fieldName: 'symptomAngina',  displayLabel: 'Symptoms: Angina',       dataType: 'Boolean',     mandatory: false, pii: false, active: true, category: 'Clinical',    level: 'Level 2' },
  { id: '72', srNo: 72, fieldName: 'symptomAscites', displayLabel: 'Symptoms: Ascites',      dataType: 'Boolean',     mandatory: false, pii: false, active: true, category: 'Clinical',    level: 'Level 2' },
  { id: '73', srNo: 73, fieldName: 'signLungRales',  displayLabel: 'Signs: Lung Rales',      dataType: 'Boolean',     mandatory: false, pii: false, active: true, category: 'Clinical',    level: 'Level 2' },
  { id: '74', srNo: 74, fieldName: 'signPleuralEffusion', displayLabel: 'Signs: Pleural Effusion/Ascites', dataType: 'Boolean', mandatory: false, pii: false, active: true, category: 'Clinical', level: 'Level 2' },
  { id: '75', srNo: 75, fieldName: 'signElevatedJVP', displayLabel: 'Signs: Increased JVP',  dataType: 'Boolean',     mandatory: false, pii: false, active: true, category: 'Clinical',    level: 'Level 2' },
  { id: '76', srNo: 76, fieldName: 'signS3',          displayLabel: 'Signs: S3 Gallop',       dataType: 'Boolean',     mandatory: false, pii: false, active: true, category: 'Clinical',    level: 'Level 2' },
  { id: '77', srNo: 77, fieldName: 'signDependentEdema', displayLabel: 'Signs: Dependent Edema', dataType: 'Boolean', mandatory: false, pii: false, active: true, category: 'Clinical',    level: 'Level 2' },
  { id: '78', srNo: 78, fieldName: 'signHepatomegaly', displayLabel: 'Signs: Hepatomegaly',  dataType: 'Boolean',     mandatory: false, pii: false, active: true, category: 'Clinical',    level: 'Level 2' },
  { id: '79', srNo: 79, fieldName: 'signCardiomegaly', displayLabel: 'Signs: Cardiomegaly',  dataType: 'Boolean',     mandatory: false, pii: false, active: true, category: 'Clinical',    level: 'Level 2' },
  { id: '80', srNo: 80, fieldName: 'jvpStatus',      displayLabel: 'JVP Status',            dataType: 'Dropdown',    mandatory: false, pii: false, active: true, category: 'Clinical',    level: 'Level 2' },
  { id: '81', srNo: 81, fieldName: 'ventricularArrhythmia', displayLabel: 'Ventricular Arrhythmia (VT/VF)', dataType: 'Boolean', mandatory: false, pii: false, active: true, category: 'Clinical', level: 'Level 2' },
  { id: '82', srNo: 82, fieldName: 'peakTropT',      displayLabel: 'Peak Trop-T (ng/L)',    dataType: 'Number',      mandatory: false, pii: false, active: true, category: 'Labs',        level: 'Level 2' },
  { id: '83', srNo: 83, fieldName: 'peakTropI',      displayLabel: 'Peak Trop-I (ng/L)',    dataType: 'Number',      mandatory: false, pii: false, active: true, category: 'Labs',        level: 'Level 2' },
  { id: '84', srNo: 84, fieldName: 'serumUrea',      displayLabel: 'Serum Urea (mg/dL)',    dataType: 'Number',      mandatory: false, pii: false, active: true, category: 'Labs',        level: 'Level 2' },
  { id: '85', srNo: 85, fieldName: 'bun',            displayLabel: 'BUN (mg/dL)',           dataType: 'Number',      mandatory: false, pii: false, active: true, category: 'Labs',        level: 'Level 2' },
  { id: '86', srNo: 86, fieldName: 'bnpDischarge',   displayLabel: 'BNP at Discharge (pg/ml)', dataType: 'Number',   mandatory: false, pii: false, active: true, category: 'Labs',        level: 'Level 2' },
  { id: '87', srNo: 87, fieldName: 'ntProBnpDischarge', displayLabel: 'NT-proBNP at Discharge (pg/ml)', dataType: 'Number', mandatory: false, pii: false, active: true, category: 'Labs',     level: 'Level 2' },
  { id: '88', srNo: 88, fieldName: 'ventilationSupport', displayLabel: 'Ventilation Support',dataType: 'Dropdown',    mandatory: false, pii: false, active: true, category: 'Clinical',    level: 'Level 2' },
  { id: '89', srNo: 89, fieldName: 'mcsSupport',      displayLabel: 'Mechanical Circulatory Support', dataType: 'Dropdown', mandatory: false, pii: false, active: true, category: 'Clinical', level: 'Level 2' },
  { id: '90', srNo: 90, fieldName: 'weightDischarge', displayLabel: 'Weight at Discharge (kg)', dataType: 'Number',  mandatory: false, pii: false, active: true, category: 'Clinical',    level: 'Level 2' },
  { id: '91', srNo: 91, fieldName: 'dischargeOutcome', displayLabel: 'Discharge Outcome',    dataType: 'Dropdown',    mandatory: false, pii: false, active: true, category: 'Clinical',    level: 'Level 2' },
  { id: '92', srNo: 92, fieldName: 'causeOfDeath',    displayLabel: 'Cause of Death',        dataType: 'Dropdown',    mandatory: false, pii: false, active: true, category: 'Clinical',    level: 'Level 2' },
  { id: '93', srNo: 93, fieldName: 'lastHospDate',    displayLabel: 'Last HF Admission Date', dataType: 'Date',      mandatory: false, pii: false, active: true, category: 'Clinical',    level: 'Level 2' },
  { id: '94', srNo: 94, fieldName: 'occupation',                 displayLabel: 'Occupation',                      dataType: 'Text',        mandatory: false, pii: false, active: true, category: 'Clinical',    level: 'Level 2' },
  { id: '95', srNo: 95, fieldName: 'indexEtiology',              displayLabel: 'Index Diagnosis Etiology',        dataType: 'Multi-Select', mandatory: false, pii: false, active: true, category: 'Clinical',    level: 'Level 2' },
  { id: '96', srNo: 96, fieldName: 'familyHistoryPrematureCVD',  displayLabel: 'Family history of premature CV disease', dataType: 'Boolean',     mandatory: false, pii: false, active: true, category: 'Clinical',    level: 'Level 2' },
  { id: '97', srNo: 97, fieldName: 'familyHistorySuddenDeath',   displayLabel: 'Family history of sudden cardiac death', dataType: 'Boolean',  mandatory: false, pii: false, active: true, category: 'Clinical',    level: 'Level 2' },
  { id: '98', srNo: 98, fieldName: 'familyHistoryCardiomyopathy', displayLabel: 'Family history of cardiomyopathy', dataType: 'Boolean',       mandatory: false, pii: false, active: true, category: 'Clinical',    level: 'Level 2' },
  { id: '99', srNo: 99, fieldName: 'familyHistoryGeneticHeart',  displayLabel: 'Family history of genetic heart disease', dataType: 'Boolean',  mandatory: false, pii: false, active: true, category: 'Clinical',    level: 'Level 2' },
  // ─── Level 1 and 2 Extensions (Harmonization) ──────────────────────────────────
  { id: '100', srNo: 100, fieldName: 'registryId', displayLabel: 'Registry ID', dataType: 'Dropdown', mandatory: false, pii: false, active: true, category: 'Clinical', level: 'Level 1' },
  { id: '101', srNo: 101, fieldName: 'indexDate', displayLabel: 'Enrollment Date', dataType: 'Date', mandatory: false, pii: false, active: true, category: 'Clinical', level: 'Level 1' },
  { id: '102', srNo: 102, fieldName: 'age', displayLabel: 'Age', dataType: 'Number', mandatory: false, pii: false, active: true, category: 'Clinical', level: 'Level 1' },
  { id: '103', srNo: 103, fieldName: 'bmi', displayLabel: 'BMI', dataType: 'Number', mandatory: false, pii: false, active: true, category: 'Clinical', level: 'Level 1' },
  { id: '104', srNo: 104, fieldName: 'residenceType', displayLabel: 'Residence Type (Urban/Rural)', dataType: 'Dropdown', mandatory: false, pii: false, active: true, category: 'Clinical', level: 'Level 2' },
  { id: '105', srNo: 105, fieldName: 'contact', displayLabel: 'Primary Phone Number', dataType: 'Text', mandatory: false, pii: true, active: true, category: 'Clinical', level: 'Level 1' },
  { id: '106', srNo: 106, fieldName: 'hfDuration', displayLabel: 'HF Duration', dataType: 'Text', mandatory: false, pii: false, active: true, category: 'Clinical', level: 'Level 2' },
  { id: '107', srNo: 107, fieldName: 'etiology', displayLabel: 'Etiology', dataType: 'Multi-Select', mandatory: false, pii: false, active: true, category: 'Clinical', level: 'Level 2' },
  { id: '108', srNo: 108, fieldName: 'hvHfAdmissions', displayLabel: 'Prior HF Hospitalizations (last 12 months)', dataType: 'Number', mandatory: false, pii: false, active: true, category: 'Clinical', level: 'Level 2' },
  { id: '109', srNo: 109, fieldName: 'comorbidHypertension', displayLabel: 'Comorbidity: Hypertension', dataType: 'Boolean', mandatory: false, pii: false, active: true, category: 'Clinical', level: 'Level 2' },
  { id: '110', srNo: 110, fieldName: 'comorbidDiabetes', displayLabel: 'Comorbidity: Diabetes Mellitus', dataType: 'Boolean', mandatory: false, pii: false, active: true, category: 'Clinical', level: 'Level 2' },
  { id: '111', srNo: 111, fieldName: 'comorbidDyslipidemia', displayLabel: 'Comorbidity: Dyslipidemia', dataType: 'Boolean', mandatory: false, pii: false, active: true, category: 'Clinical', level: 'Level 2' },
  { id: '112', srNo: 112, fieldName: 'comorbidCAD', displayLabel: 'Comorbidity: Coronary Artery Disease', dataType: 'Boolean', mandatory: false, pii: false, active: true, category: 'Clinical', level: 'Level 2' },
  { id: '113', srNo: 113, fieldName: 'comorbidPriorMI', displayLabel: 'Comorbidity: Prior Myocardial Infarction', dataType: 'Boolean', mandatory: false, pii: false, active: true, category: 'Clinical', level: 'Level 2' },
  { id: '114', srNo: 114, fieldName: 'comorbidPriorPCI', displayLabel: 'Comorbidity: Prior PCI', dataType: 'Boolean', mandatory: false, pii: false, active: true, category: 'Clinical', level: 'Level 2' },
  { id: '115', srNo: 115, fieldName: 'comorbidPriorCABG', displayLabel: 'Comorbidity: Prior CABG', dataType: 'Boolean', mandatory: false, pii: false, active: true, category: 'Clinical', level: 'Level 2' },
  { id: '116', srNo: 116, fieldName: 'comorbidAF', displayLabel: 'Comorbidity: Atrial Fibrillation', dataType: 'Boolean', mandatory: false, pii: false, active: true, category: 'Clinical', level: 'Level 2' },
  { id: '117', srNo: 117, fieldName: 'comorbidStrokeTIA', displayLabel: 'Comorbidity: Stroke / TIA', dataType: 'Boolean', mandatory: false, pii: false, active: true, category: 'Clinical', level: 'Level 2' },
  { id: '118', srNo: 118, fieldName: 'comorbidPAD', displayLabel: 'Comorbidity: Peripheral Arterial Disease', dataType: 'Boolean', mandatory: false, pii: false, active: true, category: 'Clinical', level: 'Level 2' },
  { id: '119', srNo: 119, fieldName: 'comorbidCKD', displayLabel: 'Comorbidity: Chronic Kidney Disease', dataType: 'Boolean', mandatory: false, pii: false, active: true, category: 'Clinical', level: 'Level 2' },
  { id: '120', srNo: 120, fieldName: 'comorbidCOPD', displayLabel: 'Comorbidity: COPD', dataType: 'Boolean', mandatory: false, pii: false, active: true, category: 'Clinical', level: 'Level 2' },
  { id: '121', srNo: 121, fieldName: 'comorbidOSA', displayLabel: 'Comorbidity: Obstructive Sleep Apnea', dataType: 'Boolean', mandatory: false, pii: false, active: true, category: 'Clinical', level: 'Level 2' },
  { id: '122', srNo: 122, fieldName: 'comorbidThyroid', displayLabel: 'Comorbidity: Thyroid Disease', dataType: 'Boolean', mandatory: false, pii: false, active: true, category: 'Clinical', level: 'Level 2' },
  { id: '123', srNo: 123, fieldName: 'comorbidIronDeficiency', displayLabel: 'Comorbidity: Iron Deficiency', dataType: 'Boolean', mandatory: false, pii: false, active: true, category: 'Clinical', level: 'Level 2' },
  { id: '124', srNo: 124, fieldName: 'symptomOrthopnea', displayLabel: 'Symptoms: Orthopnea', dataType: 'Boolean', mandatory: false, pii: false, active: true, category: 'Clinical', level: 'Level 2' },
  { id: '125', srNo: 125, fieldName: 'sodium', displayLabel: 'Serum Sodium (mmol/L)', dataType: 'Number', mandatory: false, pii: false, active: true, category: 'Labs', level: 'Level 2' },
  { id: '126', srNo: 126, fieldName: 'potassium', displayLabel: 'Serum Potassium (mmol/L)', dataType: 'Number', mandatory: false, pii: false, active: true, category: 'Labs', level: 'Level 2' },
  { id: '127', srNo: 127, fieldName: 'ferritin', displayLabel: 'Serum Ferritin (µg/L)', dataType: 'Number', mandatory: false, pii: false, active: true, category: 'Labs', level: 'Level 2' },
  { id: '128', srNo: 128, fieldName: 'transferrinSat', displayLabel: 'Transferrin Saturation (TSAT) (%)', dataType: 'Number', mandatory: false, pii: false, active: true, category: 'Labs', level: 'Level 2' },
  { id: '129', srNo: 129, fieldName: 'albumin', displayLabel: 'Serum Albumin (g/dL)', dataType: 'Number', mandatory: false, pii: false, active: true, category: 'Labs', level: 'Level 2' },
  { id: '130', srNo: 130, fieldName: 'uricAcid', displayLabel: 'Serum Uric Acid (mg/dL)', dataType: 'Number', mandatory: false, pii: false, active: true, category: 'Labs', level: 'Level 2' },
  { id: '131', srNo: 131, fieldName: 'tft', displayLabel: 'Thyroid Profile (TSH mIU/L)', dataType: 'Number', mandatory: false, pii: false, active: true, category: 'Labs', level: 'Level 2' },
  { id: '132', srNo: 132, fieldName: 'qrsDuration', displayLabel: 'QRS Duration (ms)', dataType: 'Number', mandatory: false, pii: false, active: true, category: 'Clinical', level: 'Level 2' },
  { id: '133', srNo: 133, fieldName: 'bbb', displayLabel: 'ECG: Left Bundle Branch Block (LBBB) vs Non-LBBB', dataType: 'Dropdown', mandatory: false, pii: false, active: true, category: 'Clinical', level: 'Level 2' },
  { id: '134', srNo: 134, fieldName: 'qtcInterval', displayLabel: 'QTc Interval (ms)', dataType: 'Number', mandatory: false, pii: false, active: true, category: 'Clinical', level: 'Level 2' },
  { id: '135', srNo: 135, fieldName: 'lvdd', displayLabel: 'LV End-Diastolic Diameter (LVEDD) (mm)', dataType: 'Number', mandatory: false, pii: false, active: true, category: 'Echo', level: 'Level 2' },
  { id: '136', srNo: 136, fieldName: 'lvsd', displayLabel: 'LV End-Systolic Diameter (LVESD) (mm)', dataType: 'Number', mandatory: false, pii: false, active: true, category: 'Echo', level: 'Level 2' },
  { id: '137', srNo: 137, fieldName: 'tapse', displayLabel: 'TAPSE (mm)', dataType: 'Number', mandatory: false, pii: false, active: true, category: 'Echo', level: 'Level 2' },
  { id: '138', srNo: 138, fieldName: 'rvsp', displayLabel: 'RVSP / PASP (mmHg)', dataType: 'Number', mandatory: false, pii: false, active: true, category: 'Echo', level: 'Level 2' },
  { id: '139', srNo: 139, fieldName: 'mrGrade', displayLabel: 'Mitral Regurgitation Severity', dataType: 'Dropdown', mandatory: false, pii: false, active: true, category: 'Echo', level: 'Level 2' },
  { id: '140', srNo: 140, fieldName: 'trGrade', displayLabel: 'Tricuspid Regurgitation Severity', dataType: 'Dropdown', mandatory: false, pii: false, active: true, category: 'Echo', level: 'Level 2' },
  { id: '141', srNo: 141, fieldName: 'ivcDiameter', displayLabel: 'IVC Diameter (mm)', dataType: 'Number', mandatory: false, pii: false, active: true, category: 'Echo', level: 'Level 2' },
  { id: '142', srNo: 142, fieldName: 'pericardialEffusion', displayLabel: 'Pericardial Effusion', dataType: 'Dropdown', mandatory: false, pii: false, active: true, category: 'Echo', level: 'Level 2' },
  { id: '143', srNo: 143, fieldName: 'lvThrombus', displayLabel: 'LV Thrombus Present', dataType: 'Boolean', mandatory: false, pii: false, active: true, category: 'Echo', level: 'Level 2' },
  { id: '144', srNo: 144, fieldName: 'vericiguat', displayLabel: 'Vericiguat Use', dataType: 'Dropdown', mandatory: false, pii: false, active: true, category: 'Medications', level: 'Level 2' },
  { id: '145', srNo: 145, fieldName: 'diuretic', displayLabel: 'Loop Diuretic Dose', dataType: 'Dropdown', mandatory: false, pii: false, active: true, category: 'Medications', level: 'Level 2' },
  { id: '146', srNo: 146, fieldName: 'ivabradine', displayLabel: 'Ivabradine Use', dataType: 'Dropdown', mandatory: false, pii: false, active: true, category: 'Medications', level: 'Level 2' },
  { id: '147', srNo: 147, fieldName: 'digoxin', displayLabel: 'Digoxin Use', dataType: 'Dropdown', mandatory: false, pii: false, active: true, category: 'Medications', level: 'Level 2' },
  { id: '148', srNo: 148, fieldName: 'anticoagulation', displayLabel: 'Anticoagulation Use', dataType: 'Dropdown', mandatory: false, pii: false, active: true, category: 'Medications', level: 'Level 2' },
  { id: '149', srNo: 149, fieldName: 'antiarrhythmic', displayLabel: 'Antiarrhythmic Use', dataType: 'Dropdown', mandatory: false, pii: false, active: true, category: 'Medications', level: 'Level 2' },
  { id: '150', srNo: 150, fieldName: 'vaccInfluenza', displayLabel: 'Influenza Vaccination Status', dataType: 'Dropdown', mandatory: false, pii: false, active: true, category: 'Clinical', level: 'Level 2' },
  { id: '151', srNo: 151, fieldName: 'vaccPneumo', displayLabel: 'Pneumococcal Vaccination Status', dataType: 'Dropdown', mandatory: false, pii: false, active: true, category: 'Clinical', level: 'Level 2' },
  { id: '152', srNo: 152, fieldName: 'icdPresence', displayLabel: 'ICD Presence', dataType: 'Boolean', mandatory: false, pii: false, active: true, category: 'Clinical', level: 'Level 2' },
  { id: '153', srNo: 153, fieldName: 'icdIndication', displayLabel: 'ICD Indication (Primary/Secondary)', dataType: 'Dropdown', mandatory: false, pii: false, active: true, category: 'Clinical', level: 'Level 2' },
  { id: '154', srNo: 154, fieldName: 'crtPresence', displayLabel: 'CRT Presence (CRT-P/CRT-D)', dataType: 'Boolean', mandatory: false, pii: false, active: true, category: 'Clinical', level: 'Level 2' },
  { id: '155', srNo: 155, fieldName: 'bivPacingPercent', displayLabel: 'Percentage Biventricular Pacing', dataType: 'Number', mandatory: false, pii: false, active: true, category: 'Clinical', level: 'Level 2' },
  { id: '156', srNo: 156, fieldName: 'eventICDShock', displayLabel: 'Appropriate ICD Shock / Therapy', dataType: 'Boolean', mandatory: false, pii: false, active: true, category: 'Clinical', level: 'Level 2' },
  { id: '157', srNo: 157, fieldName: 'clinicalFrailtyScale', displayLabel: 'Clinical Frailty Scale (CFS)', dataType: 'Score', mandatory: false, pii: false, active: true, category: 'QoL', level: 'Level 2' },
  { id: '158', srNo: 158, fieldName: 'gripRight', displayLabel: 'Hand-Grip Strength (Right) (kg)', dataType: 'Number', mandatory: false, pii: false, active: true, category: 'Clinical', level: 'Level 2' },
  { id: '159', srNo: 159, fieldName: 'gripLeft', displayLabel: 'Hand-Grip Strength (Left) (kg)', dataType: 'Number', mandatory: false, pii: false, active: true, category: 'Clinical', level: 'Level 2' },
  { id: '160', srNo: 160, fieldName: 'gdmtStatus', displayLabel: 'GDMT Optimization Status', dataType: 'Dropdown', mandatory: false, pii: false, active: true, category: 'Clinical', level: 'Level 2' },
  { id: '161', srNo: 161, fieldName: 'medAdherence', displayLabel: 'Medication Adherence Status', dataType: 'Dropdown', mandatory: false, pii: false, active: true, category: 'Clinical', level: 'Level 2' },
  { id: '162', srNo: 162, fieldName: 'mmas8Score', displayLabel: 'MMAS-8 Adherence Score', dataType: 'Score', mandatory: false, pii: false, active: true, category: 'Clinical', level: 'Level 2' },
  { id: '163', srNo: 163, fieldName: 'eventHospitalisation', displayLabel: 'Outcome: Heart Failure Hospitalization', dataType: 'Boolean', mandatory: false, pii: false, active: true, category: 'Clinical', level: 'Level 2' },
  { id: '164', srNo: 164, fieldName: 'vitalStatus', displayLabel: 'Outcome: All-Cause Mortality', dataType: 'Dropdown', mandatory: false, pii: false, active: true, category: 'Clinical', level: 'Level 2' },
  { id: '165', srNo: 165, fieldName: 'deathCauseCategory', displayLabel: 'Outcome: Cardiovascular Mortality', dataType: 'Dropdown', mandatory: false, pii: false, active: true, category: 'Clinical', level: 'Level 2' },
  { id: '166', srNo: 166, fieldName: 'outcomeHeartTransplant', displayLabel: 'Outcome: Heart Transplantation', dataType: 'Boolean', mandatory: false, pii: false, active: true, category: 'Clinical', level: 'Level 2' },
  { id: '167', srNo: 167, fieldName: 'outcomeLVAD', displayLabel: 'Outcome: LVAD', dataType: 'Boolean', mandatory: false, pii: false, active: true, category: 'Clinical', level: 'Level 2' },
  { id: '168', srNo: 168, fieldName: 'eventStroke', displayLabel: 'Outcome: Stroke / TIA', dataType: 'Boolean', mandatory: false, pii: false, active: true, category: 'Clinical', level: 'Level 2' },
  { id: '169', srNo: 169, fieldName: 'eventMI', displayLabel: 'Outcome: Myocardial Infarction', dataType: 'Boolean', mandatory: false, pii: false, active: true, category: 'Clinical', level: 'Level 2' },
  { id: '170', srNo: 170, fieldName: 'eventVTVF', displayLabel: 'Outcome: Sustained VT/VF', dataType: 'Boolean', mandatory: false, pii: false, active: true, category: 'Clinical', level: 'Level 2' },
  { id: '171', srNo: 171, fieldName: 'needAdvancedHFTherapy', displayLabel: 'Need for Advanced Heart Failure Therapy', dataType: 'Boolean', mandatory: false, pii: false, active: true, category: 'Clinical', level: 'Level 2' },
]

