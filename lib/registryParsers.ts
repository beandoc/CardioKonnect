import type { MedEntry, IndianEtiology, NonPrescriptionReason, DataCertainty } from './types'

// ─── Medication Brand-to-Generic Map (Indian Formulations) ────────────────────
const BRAND_TO_GENERIC: Record<string, { generic: string; defaultDoseMg?: number }> = {
  // ARNI / ACEi / ARB
  VYMADA: { generic: 'Sacubitril/Valsartan' },
  CIDMUS: { generic: 'Sacubitril/Valsartan' },
  AZMARDA: { generic: 'Sacubitril/Valsartan' },
  VALSARTAN: { generic: 'Valsartan' },
  TELMISARTAN: { generic: 'Telmisartan' },
  TELMA: { generic: 'Telmisartan' },
  RAMIPRIL: { generic: 'Ramipril' },
  CARDACE: { generic: 'Ramipril' },
  ENALAPRIL: { generic: 'Enalapril' },
  LOSARTAN: { generic: 'Losartan' },

  // Beta Blockers
  'MET XL': { generic: 'Metoprolol succinate' },
  METOCARD: { generic: 'Metoprolol succinate' },
  STARPRESS: { generic: 'Metoprolol succinate' },
  METOPROLOL: { generic: 'Metoprolol succinate' },
  BISOPROLOL: { generic: 'Bisoprolol' },
  BISO: { generic: 'Bisoprolol' },
  CONCOR: { generic: 'Bisoprolol' },
  CORBIS: { generic: 'Bisoprolol' },
  CARVEDILOL: { generic: 'Carvedilol' },
  CARCA: { generic: 'Carvedilol' },
  CARVIL: { generic: 'Carvedilol' },
  NEBIVOLOL: { generic: 'Nebivolol' },
  NEBICARD: { generic: 'Nebivolol' },

  // MRAs
  ALDACTONE: { generic: 'Spironolactone' },
  SPIRONOLACTONE: { generic: 'Spironolactone' },
  EPLERENONE: { generic: 'Eplerenone' },
  EPLERAN: { generic: 'Eplerenone' },
  EPLERONE: { generic: 'Eplerenone' },
  INSPRA: { generic: 'Eplerenone' },

  // SGLT2i
  DAPAGLIFLOZIN: { generic: 'Dapagliflozin' },
  DAPA: { generic: 'Dapagliflozin' },
  FORXIGA: { generic: 'Dapagliflozin' },
  OXRA: { generic: 'Dapagliflozin' },
  EMPAGLIFLOZIN: { generic: 'Empagliflozin' },
  EMPA: { generic: 'Empagliflozin' },
  JARDIANCE: { generic: 'Empagliflozin' },
  GIBTULIO: { generic: 'Empagliflozin' },

  // Loop Diuretics
  DYTOR: { generic: 'Torsemide' },
  TORSEMIDE: { generic: 'Torsemide' },
  TIDE: { generic: 'Torsemide' },
  LASIX: { generic: 'Furosemide' },
  FUROSEMIDE: { generic: 'Furosemide' },
  LASILACTONE: { generic: 'Furosemide + Spironolactone' },

  // Antiplatelets
  ASPIRIN: { generic: 'Aspirin' },
  ECOSPRIN: { generic: 'Aspirin' },
  CLOPIDOGREL: { generic: 'Clopidogrel' },
  CLOPID: { generic: 'Clopidogrel' },
  CLOPIDIO: { generic: 'Clopidogrel' },
  DEPLATT: { generic: 'Clopidogrel' },
  CLAVIX: { generic: 'Clopidogrel' },
  TICAGRELOR: { generic: 'Ticagrelor' },
  BRILLINTA: { generic: 'Ticagrelor' },
  TICAPLAT: { generic: 'Ticagrelor' },
  PRASUGREL: { generic: 'Prasugrel' },

  // Anticoagulants (OAC)
  APIXABAN: { generic: 'Apixaban' },
  ELIQUIS: { generic: 'Apixaban' },
  RIVAROXABAN: { generic: 'Rivaroxaban' },
  XARELTO: { generic: 'Rivaroxaban' },
  DABIGATRAN: { generic: 'Dabigatran' },
  PRADAXA: { generic: 'Dabigatran' },
  ACENOCMaritime: { generic: 'Acenocoumarol' },
  ACITROME: { generic: 'Acenocoumarol' },
  WARFARIN: { generic: 'Warfarin' },

  // Antiarrhythmics & Others
  AMIODARONE: { generic: 'Amiodarone' },
  CORDARONE: { generic: 'Amiodarone' },
  DIGOXIN: { generic: 'Digoxin' },
  LANOXIN: { generic: 'Digoxin' },
  IVABRADINE: { generic: 'Ivabradine' },
  IVABRAD: { generic: 'Ivabradine' },
  CORALAN: { generic: 'Ivabradine' },
  VERICIGUAT: { generic: 'Vericiguat' },
  VERQUVO: { generic: 'Vericiguat' },

  // Statins
  ATORVASTATIN: { generic: 'Atorvastatin' },
  ATORVAS: { generic: 'Atorvastatin' },
  ATORVA: { generic: 'Atorvastatin' },
  LIPICURE: { generic: 'Atorvastatin' },
  ROSUVASTATIN: { generic: 'Rosuvastatin' },
  ROSUVAS: { generic: 'Rosuvastatin' },
  ROZAVEL: { generic: 'Rosuvastatin' },

  // Antidiabetic (Non-SGLT2i)
  LINAGLIPTIN: { generic: 'Linagliptin' },
  TRAJENTA: { generic: 'Linagliptin' },
  TENELIGLIPTIN: { generic: 'Teneligliptin' },
  VILDAGLIPTIN: { generic: 'Vildagliptin' },
  GALVUS: { generic: 'Vildagliptin' },
  METFORMIN: { generic: 'Metformin' },
  GLIMEPIRIDE: { generic: 'Glimepiride' },
  INSULIN: { generic: 'Insulin' },
}

// ─── 1. parseMedication ───────────────────────────────────────────────────────
export function parseMedication(raw: any, category?: string): MedEntry {
  if (!raw) return { prescribed: 'No' }
  const str = String(raw).trim()

  // Strict "No"
  if (/^(NO|N|NONE|-|0|NIL|NA|NOT\s*GIVEN)$/i.test(str)) {
    return { prescribed: 'No' }
  }

  // Check for WITHHELD WITH REASON (e.g. "NO, K -HIGH", "NO-CKD", "NO-COPD", "NO HYPOTENSION")
  const withheldMatch = str.match(/^NO[\s,\-–/:]+(.+)$/i)
  if (withheldMatch) {
    const rawReason = withheldMatch[1].trim().toUpperCase()
    let reason: NonPrescriptionReason = rawReason

    if (/K\s*[\-\+]?\s*HIGH|HYPERKAL/i.test(rawReason)) {
      reason = 'Hyperkalaemia (K+ >5.5 mmol/L)'
    } else if (/CKD|CREAT|RENAL|AKI/i.test(rawReason)) {
      reason = 'Severe Renal Impairment / AKI'
    } else if (/COPD|ASTHMA|ALLERGY|BRONCHO/i.test(rawReason)) {
      reason = 'Allergy / Intolerance'
    } else if (/BP\s*LOW|HYPOTEN/i.test(rawReason)) {
      reason = 'Hypotension (SBP <90–100 mmHg)'
    } else if (/BRADY|BLOCK/i.test(rawReason)) {
      reason = 'Bradycardia / Conduction Block'
    }

    return {
      prescribed: 'No',
      reason,
      type: str,
      certainty: 'reported'
    }
  }

  // Active Prescription parsing
  const upper = str.toUpperCase()
  let genericDrug = ''
  let formulation = ''

  // Look up brand/generic in map
  for (const [key, val] of Object.entries(BRAND_TO_GENERIC)) {
    const regex = new RegExp(`\\b${key.replace(/\s+/g, '\\s+')}\\b`, 'i')
    if (regex.test(upper)) {
      genericDrug = val.generic
      formulation = key
      break
    }
  }

  // Dose extraction (e.g., "50", "2.5", "10", "100/103")
  let dose = ''
  const doseMatch = str.match(/(\d+(?:\.\d+)?(?:\/\d+(?:\.\d+)?)?)\s*(?:MG|G|MCG)?(?!\s*MONTH|\s*YEAR|\s*MIN)/i)
  if (doseMatch) {
    dose = doseMatch[1]
  }

  // Frequency extraction (OD, BD, TDS, QID, HS, SOS, ONCE WEEKLY)
  let frequency: string | undefined = undefined
  if (/\b(?:BD|BID|TWICE)\b/i.test(str)) frequency = 'BD'
  else if (/\b(?:OD|DAILY|ONCE)\b/i.test(str)) frequency = 'OD'
  else if (/\b(?:TDS|TID|THRICE)\b/i.test(str)) frequency = 'TDS'
  else if (/\b(?:QID)\b/i.test(str)) frequency = 'QID'
  else if (/\b(?:HS|NIGHT)\b/i.test(str)) frequency = 'HS'
  else if (/\b(?:PRN|SOS)\b/i.test(str)) frequency = 'PRN'

  return {
    prescribed: 'Yes',
    genericDrug: genericDrug || undefined,
    formulation: formulation || undefined,
    dose: dose || str,
    frequency,
    type: str,
    certainty: 'reported'
  }
}

// ─── 2. parseEcg ─────────────────────────────────────────────────────────────
export interface EcgParsed {
  qrsDuration?: number
  qtcInterval?: number
  bbb?: 'LBBB' | 'RBBB' | 'IVCD' | ''
  rhythm?: 'Sinus' | 'AF' | 'Atrial Flutter' | 'VT' | 'Not Known' | 'Other'
  raw: string
}

export function parseEcg(raw: any): EcgParsed {
  if (!raw) return { raw: '' }
  const str = String(raw).trim()
  const upper = str.toUpperCase()

  // QRS Duration (e.g., "QRS 139", "QRs 141", "QRS-120")
  let qrsDuration: number | undefined = undefined
  const qrsMatch = str.match(/(?:QRS|QRs|qrs)\s*[:=\-]?\s*(\d{2,3})/i)
  if (qrsMatch) {
    const val = parseInt(qrsMatch[1], 10)
    if (val >= 40 && val <= 300) qrsDuration = val
  }

  // QTc Interval (e.g., "QTc 473", "QTC 450")
  let qtcInterval: number | undefined = undefined
  const qtcMatch = str.match(/QT[cC]?\s*[:=\-]?\s*(\d{2,3})/i)
  if (qtcMatch) {
    const val = parseInt(qtcMatch[1], 10)
    if (val >= 250 && val <= 700) qtcInterval = val
  }

  // Conduction defect (LBBB, RBBB, IVCD, LAFB)
  let bbb: 'LBBB' | 'RBBB' | 'IVCD' | '' = ''
  if (/\bLBBB\b/i.test(upper)) {
    bbb = 'LBBB'
  } else if (/\bRBBB\b/i.test(upper) || /\bqRBBB\b/i.test(upper)) {
    bbb = 'RBBB'
  } else if (/\bIVCD\b/i.test(upper)) {
    bbb = 'IVCD'
  }

  // Rhythm — word boundary prevents LAFB (Left Anterior Fascicular Block) from matching AF!
  let rhythm: 'Sinus' | 'AF' | 'Atrial Flutter' | 'VT' | 'Not Known' | 'Other' | undefined = undefined
  if (/\b(?:AF|A-FIB|ATRIAL\s+FIBRILLATION)\b/i.test(upper)) {
    rhythm = 'AF'
  } else if (/\b(?:AFL|FLUTTER)\b/i.test(upper)) {
    rhythm = 'Atrial Flutter'
  } else if (/\b(?:PACED|PM|PACE)\b/i.test(upper)) {
    rhythm = 'Other'
  } else if (/\b(?:SINUS|NSR)\b/i.test(upper)) {
    rhythm = 'Sinus'
  } else if (/\b(?:VT)\b/i.test(upper)) {
    rhythm = 'VT'
  }

  return {
    qrsDuration,
    qtcInterval,
    bbb,
    rhythm,
    raw: str
  }
}

// ─── 3. parseDevice ──────────────────────────────────────────────────────────
export interface DeviceParsed {
  implanted: boolean
  deviceTypes: string[]
  implantDate?: string
  advisedOnly: boolean
  hasIcd: boolean
  hasCrt: boolean
  raw: string
}

export function parseDevice(raw: any): DeviceParsed {
  if (!raw) return { implanted: false, deviceTypes: [], advisedOnly: false, hasIcd: false, hasCrt: false, raw: '' }
  const str = String(raw).trim()
  const upper = str.toUpperCase()

  // Not done / nil
  if (/^(NOT\s*DONE|NIL|NO|NONE|-|0)$/i.test(str)) {
    return { implanted: false, deviceTypes: [], advisedOnly: false, hasIcd: false, hasCrt: false, raw: str }
  }

  // Advised only (e.g. "ADV-AICD", "ADV AICD", "ADVISED AICD", "NOT YET", "PLANNED")
  const advisedOnly = /\b(?:ADV|ADVISED|ADV-|NOT\s*YET|PLANNED|CANDIDATE)\b/i.test(upper)

  const deviceTypes: string[] = []
  let hasIcd = false
  let hasCrt = false

  // Detect CRT-D (e.g. "CRTD", "CRT-D", "CRTD (20/3/25)")
  if (/\b(?:CRTD|CRT[\s\-]?D)\b/i.test(upper)) {
    deviceTypes.push('CRT-D')
    hasIcd = true
    hasCrt = true
  } else if (/\b(?:CRTP|CRT[\s\-]?P)\b/i.test(upper)) {
    deviceTypes.push('CRT-P')
    hasCrt = true
  }

  // Detect ICD / AICD (if not already CRT-D)
  if (/\b(?:AICD|ICD)\b/i.test(upper)) {
    if (!deviceTypes.includes('CRT-D')) {
      deviceTypes.push('ICD')
    }
    hasIcd = true
  }

  // Detect PPM
  if (/\b(?:PPM|PACEMAKER)\b/i.test(upper)) {
    deviceTypes.push('PPM')
  }

  // Extract implant date from parentheses or text (e.g. "(20/3/25)", "(2017)", "JUN2026")
  let implantDate: string | undefined = undefined
  const dateMatch = str.match(/\(([^)]+)\)/) || str.match(/\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}|(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s*\d{4})\b/i)
  if (dateMatch) {
    implantDate = dateMatch[1].trim()
  }

  const implanted = !advisedOnly && deviceTypes.length > 0

  return {
    implanted,
    deviceTypes,
    implantDate,
    advisedOnly,
    hasIcd: implanted && hasIcd,
    hasCrt: implanted && hasCrt,
    raw: str
  }
}

// ─── 4. parseEtiology ────────────────────────────────────────────────────────
export function parseEtiology(raw: any): IndianEtiology[] {
  if (!raw) return []
  const str = String(raw).trim().toUpperCase()
  const res = new Set<IndianEtiology>()

  if (/\b(?:ISCHEMIC|ISCHAEMIC|CAD|ACS|AWMI|IWMI|NSTEMI|STEMI|TVD|DVD|SVD|POST\s*MI)\b/i.test(str)) {
    res.add('Ischaemic CAD')
  }
  if (/\b(?:RHD|RHEUMATIC|VALVULAR|MS|MR|AS|AR)\b/i.test(str)) {
    res.add('Rheumatic Heart Disease')
  }
  if (/\b(?:HTN|HYPERTENSION|HYPERTENSIVE)\b/i.test(str)) {
    res.add('Hypertensive Heart Disease')
  }
  if (/\b(?:DCM|DILATED|IDIOPATHIC|NON[\s\-]?ISCHEMIC)\b/i.test(str)) {
    res.add('Dilated / Non-ischaemic Cardiomyopathy')
  }
  if (/\b(?:PPCM|PERIPARTUM)\b/i.test(str)) {
    res.add('Peripartum Cardiomyopathy')
  }
  if (/\b(?:MYOCARDITIS)\b/i.test(str)) {
    res.add('Myocarditis')
  }
  if (/\b(?:CHEMO|CHEMOTHERAPY|CARDIO[\s\-]?ONCOLOGY|DOXORUBICIN|TRASTUZUMAB)\b/i.test(str)) {
    res.add('Chemotherapy / Cardio-oncology')
  }
  if (/\b(?:ALCOHOL|ALCOHOLIC|ETHANOL)\b/i.test(str)) {
    res.add('Alcohol / Toxic Cardiomyopathy')
  }
  if (/\b(?:CONGENITAL|ASD|VSD|PDA|TOF|EBSTEIN)\b/i.test(str)) {
    res.add('Congenital Heart Disease')
  }
  if (/\b(?:AMYLOID|AMYLOIDOSIS|INFILTRATIVE)\b/i.test(str)) {
    res.add('Infiltrative / Amyloidosis')
  }
  if (/\b(?:CKD|CARDIORENAL|UREMIC|RENAL)\b/i.test(str)) {
    res.add('CKD / Cardiorenal / Uremic')
  }
  if (/\b(?:COR\s*PULMONALE|PULMONARY\s*HYPERTENSION|RIGHT\s*HF)\b/i.test(str)) {
    res.add('Pulmonary / Cor Pulmonale / Right HF')
  }

  if (res.size === 0 && str.length > 2) {
    res.add('Unknown / Cryptogenic')
  }

  return Array.from(res)
}

// ─── 5. parseHospitalisationHistory ──────────────────────────────────────────
export interface HospHistoryParsed {
  hospCount: number
  hospHistory: 'Yes' | 'No'
  priorPci: boolean
  priorCabg: boolean
  vessels: string[]
  dates: string[]
  adjuncts: string[]
  raw: string
}

export function parseHospitalisationHistory(raw: any): HospHistoryParsed {
  if (!raw) return { hospCount: 0, hospHistory: 'No', priorPci: false, priorCabg: false, vessels: [], dates: [], adjuncts: [], raw: '' }
  const str = String(raw).trim()
  const upper = str.toUpperCase()

  if (/^(NO|NONE|NIL|-|0)$/i.test(str)) {
    return { hospCount: 0, hospHistory: 'No', priorPci: false, priorCabg: false, vessels: [], dates: [], adjuncts: [], raw: str }
  }

  const priorPci = /\b(?:PCI|CAG|PTCA|STENT)\b/i.test(upper)
  const priorCabg = /\b(?:CABG|BYPASS)\b/i.test(upper)

  // Extract vessels
  const vessels: string[] = []
  if (/\bLAD\b/i.test(upper)) vessels.push('LAD')
  if (/\bRCA\b/i.test(upper)) vessels.push('RCA')
  if (/\b(?:LCX|CX)\b/i.test(upper)) vessels.push('LCX')
  if (/\bLM(?:CA)?\b/i.test(upper)) vessels.push('LM')
  if (/\bTVD\b/i.test(upper)) vessels.push('TVD')
  if (/\bDVD\b/i.test(upper)) vessels.push('DVD')
  if (/\bSVD\b/i.test(upper)) vessels.push('SVD')

  // Extract adjuncts
  const adjuncts: string[] = []
  if (/\bROTA\b/i.test(upper)) adjuncts.push('Rotablation')
  if (/\bIABP\b/i.test(upper)) adjuncts.push('IABP')
  if (/\bECMO\b/i.test(upper)) adjuncts.push('ECMO')
  if (/\bIVUS\b/i.test(upper)) adjuncts.push('IVUS')
  if (/\bOCT\b/i.test(upper)) adjuncts.push('OCT')

  // Extract dates (e.g. "(22/11/24)", "4/9/23")
  const dates: string[] = []
  const dateRegex = /\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\b/g
  let m: RegExpExecArray | null
  while ((m = dateRegex.exec(str)) !== null) {
    dates.push(m[1])
  }

  // Estimation of hospCount: minimum 1 if prior CAD event or admission listed
  let hospCount = 1
  if (dates.length > 1) hospCount = dates.length

  return {
    hospCount,
    hospHistory: 'Yes',
    priorPci,
    priorCabg,
    vessels,
    dates,
    adjuncts,
    raw: str
  }
}

// ─── 6. parseTsh ─────────────────────────────────────────────────────────────
export function parseTsh(raw: any): number | undefined {
  if (!raw) return undefined
  const str = String(raw).trim()
  // Matches "TSH-4.20", "TSH 18.76", "0.18", etc.
  const m = str.match(/(\d+(?:\.\d+)?)/)
  if (m) {
    const val = parseFloat(m[1])
    if (val >= 0 && val <= 100) return val
  }
  return undefined
}

// ─── 7. parseBiomarker ───────────────────────────────────────────────────────
export interface BiomarkerParsed {
  value?: number
  assay: 'BNP' | 'NT-proBNP' | 'Unknown'
  raw: string
}

export function parseBiomarker(raw: any): BiomarkerParsed {
  if (!raw) return { assay: 'Unknown', raw: '' }
  const str = String(raw).trim()
  const upper = str.toUpperCase()

  // Distinguish "BNP 948" or "BNP 251" from NT-proBNP
  const isBnp = /\bBNP\b/i.test(upper) && !/\bNT[\s\-]?PRO\b/i.test(upper)
  const assay = isBnp ? 'BNP' : 'NT-proBNP'

  const m = str.match(/(\d+(?:\.\d+)?)/)
  if (m) {
    return {
      value: parseFloat(m[1]),
      assay,
      raw: str
    }
  }

  return { assay: 'Unknown', raw: str }
}

// ─── 8. parseLvef ────────────────────────────────────────────────────────────
export function parseLvef(raw: any): { lvef?: number; raw: string } {
  if (!raw) return { raw: '' }
  const str = String(raw).trim()
  if (/^(NOT\s*DONE|ND|DONE|NIL|-|0)$/i.test(str)) {
    return { raw: str }
  }

  // Handle ranges e.g. "30-35" or "30 - 35"
  const rangeMatch = str.match(/(\d+)\s*[\-–]\s*(\d+)/)
  if (rangeMatch) {
    const low = parseInt(rangeMatch[1], 10)
    const high = parseInt(rangeMatch[2], 10)
    if (!isNaN(low) && !isNaN(high)) {
      return { lvef: Math.round((low + high) / 2), raw: str }
    }
  }

  // Single number e.g. "25", "35%"
  const singleMatch = str.match(/(\d+(?:\.\d+)?)/)
  if (singleMatch) {
    const val = Math.round(parseFloat(singleMatch[1]))
    if (val >= 5 && val <= 85) {
      return { lvef: val, raw: str }
    }
  }

  return { raw: str }
}

// ─── 9. calcEgfr (CKD-EPI 2021 Formula) ───────────────────────────────────────
/**
 * CKD-EPI 2021 Creatinine Equation (Ref: Inker LA et al. NEJM 2021; 385:1737-1749)
 * eGFR = 142 * min(Scr/kappa, 1)^alpha * max(Scr/kappa, 1)^(-1.200) * 0.9938^Age * (1.012 if female)
 */
export function calcEgfr(creatinine?: number, age?: number, sex?: 'Male' | 'Female' | string): number | undefined {
  if (!creatinine || !age || creatinine <= 0 || age <= 0) return undefined

  const isFemale = String(sex).toUpperCase().startsWith('F')
  const kappa = isFemale ? 0.7 : 0.9
  const alpha = isFemale ? -0.241 : -0.302
  const genderFactor = isFemale ? 1.012 : 1.0

  const scrRatio = creatinine / kappa
  const minTerm = Math.pow(Math.min(scrRatio, 1), alpha)
  const maxTerm = Math.pow(Math.max(scrRatio, 1), -1.200)
  const ageTerm = Math.pow(0.9938, age)

  const egfr = 142 * minTerm * maxTerm * ageTerm * genderFactor
  return Math.round(egfr * 10) / 10
}

// ─── 10. calcBmi ─────────────────────────────────────────────────────────────
export function calcBmi(weightKg?: number, heightCm?: number): number | undefined {
  if (!weightKg || !heightCm || weightKg <= 0 || heightCm <= 0) return undefined
  const heightM = heightCm / 100
  const bmi = weightKg / (heightM * heightM)
  return Math.round(bmi * 10) / 10
}

// ─── 11. parseDaptFromAnticoagulantColumn ─────────────────────────────────────
/**
 * Extracts Aspirin and P2Y12 inhibitor from the mislabelled ANTICOGULANT column
 * Examples: "ASPIRIN 75, CLOPID 75", "ECOSPRIN 75", "ASPIRIN 75, TICAGRELOR 90"
 */
export function parseDaptFromAnticoagulantColumn(raw: any): {
  aspirin: { prescribed: 'Yes' | 'No'; dose?: string }
  p2y12Inhibitor: { prescribed: 'Yes' | 'No'; type?: 'Clopidogrel' | 'Ticagrelor' | 'Prasugrel' | 'Cangrelor' | 'Other' | ''; dose?: string }
} {
  const res: {
    aspirin: { prescribed: 'Yes' | 'No'; dose?: string }
    p2y12Inhibitor: { prescribed: 'Yes' | 'No'; type?: 'Clopidogrel' | 'Ticagrelor' | 'Prasugrel' | 'Cangrelor' | 'Other' | ''; dose?: string }
  } = {
    aspirin: { prescribed: 'No' },
    p2y12Inhibitor: { prescribed: 'No', type: '' }
  }

  if (!raw) return res
  const str = String(raw).trim()
  if (/^(NO|NONE|NIL|-|0)$/i.test(str)) return res

  const upper = str.toUpperCase()

  // Aspirin
  if (/\b(?:ASPIRIN|ECOSPRIN)\b/i.test(upper)) {
    const doseMatch = str.match(/(?:ASPIRIN|ECOSPRIN)\s*(\d+)/i)
    res.aspirin = {
      prescribed: 'Yes',
      dose: doseMatch ? `${doseMatch[1]} mg` : '75 mg'
    }
  }

  // P2Y12: Clopidogrel
  if (/\b(?:CLOPID|CLOPIDOGREL|CLOPIDIO|DEPLATT)\b/i.test(upper)) {
    const doseMatch = str.match(/(?:CLOPID|CLOPIDOGREL|CLOPIDIO|DEPLATT)\s*(\d+)/i)
    res.p2y12Inhibitor = {
      prescribed: 'Yes',
      type: 'Clopidogrel',
      dose: doseMatch ? `${doseMatch[1]} mg` : '75 mg'
    }
  } else if (/\b(?:TICAGRELOR|BRILLINTA)\b/i.test(upper)) {
    const doseMatch = str.match(/(?:TICAGRELOR|BRILLINTA)\s*(\d+)/i)
    res.p2y12Inhibitor = {
      prescribed: 'Yes',
      type: 'Ticagrelor',
      dose: doseMatch ? `${doseMatch[1]} mg` : '90 mg BD'
    }
  } else if (/\b(?:PRASUGREL)\b/i.test(upper)) {
    const doseMatch = str.match(/PRASUGREL\s*(\d+)/i)
    res.p2y12Inhibitor = {
      prescribed: 'Yes',
      type: 'Prasugrel',
      dose: doseMatch ? `${doseMatch[1]} mg` : '10 mg'
    }
  }

  return res
}

// ─── 12. parseOacFromAntiarrhythmicColumn ────────────────────────────────────
/**
 * Resolves the mislabelled ANTI-arrhythmic therapy column which mixes:
 * - NOACs ("APIXABAN 5 BD", "RIVAROXABAN 15")
 * - VKIs ("ACITROME 10.5", "WARFARIN 2")
 * - True Antiarrhythmics ("AMIODARONE 200 OD")
 */
export function parseOacFromAntiarrhythmicColumn(raw: any): {
  noac: { prescribed: 'Yes' | 'No'; type?: string; dose?: string }
  vki: { prescribed: 'Yes' | 'No'; type?: string; dose?: string }
  antiarrhythmic: MedEntry
} {
  const res: {
    noac: { prescribed: 'Yes' | 'No'; type?: string; dose?: string }
    vki: { prescribed: 'Yes' | 'No'; type?: string; dose?: string }
    antiarrhythmic: MedEntry
  } = {
    noac: { prescribed: 'No' },
    vki: { prescribed: 'No' },
    antiarrhythmic: { prescribed: 'No' }
  }

  if (!raw) return res
  const str = String(raw).trim()
  if (/^(NO|NONE|NIL|-|0)$/i.test(str)) return res

  const upper = str.toUpperCase()

  // NOAC: Apixaban, Rivaroxaban, Dabigatran
  if (/\b(?:APIXABAN|ELIQUIS)\b/i.test(upper)) {
    const doseMatch = str.match(/(?:APIXABAN|ELIQUIS)\s*(\d+(?:\.\d+)?(?:\s*(?:BD|OD))?)/i)
    res.noac = {
      prescribed: 'Yes',
      type: 'Apixaban',
      dose: doseMatch ? doseMatch[1] : '5 mg BD'
    }
  } else if (/\b(?:RIVAROXABAN|XARELTO)\b/i.test(upper)) {
    const doseMatch = str.match(/(?:RIVAROXABAN|XARELTO)\s*(\d+(?:\.\d+)?)/i)
    res.noac = {
      prescribed: 'Yes',
      type: 'Rivaroxaban',
      dose: doseMatch ? `${doseMatch[1]} mg` : '15 mg'
    }
  } else if (/\b(?:DABIGATRAN|PRADAXA)\b/i.test(upper)) {
    const doseMatch = str.match(/(?:DABIGATRAN|PRADAXA)\s*(\d+(?:\.\d+)?)/i)
    res.noac = {
      prescribed: 'Yes',
      type: 'Dabigatran',
      dose: doseMatch ? `${doseMatch[1]} mg` : '110 mg BD'
    }
  }

  // VKI: Acitrome, Warfarin
  if (/\b(?:ACITROME|ACENOCOUMAROL|WARFARIN)\b/i.test(upper)) {
    const doseMatch = str.match(/(?:ACITROME|ACENOCOUMAROL|WARFARIN)\s*(\d+(?:\.\d+)?)/i)
    res.vki = {
      prescribed: 'Yes',
      type: /\bWARFARIN\b/i.test(upper) ? 'Warfarin' : 'Acenocoumarol',
      dose: doseMatch ? `${doseMatch[1]} mg` : str
    }
  }

  // Antiarrhythmic: Amiodarone
  if (/\b(?:AMIODARONE|CORDARONE)\b/i.test(upper)) {
    res.antiarrhythmic = parseMedication(str, 'antiarrhythmic')
  }

  return res
}
