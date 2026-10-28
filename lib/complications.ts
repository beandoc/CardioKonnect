/**
 * lib/complications.ts
 *
 * Procedure complications exist in three shapes in Firestore:
 *   1. CathComplicationItem[]   — typed array written by the current CRF
 *   2. Legacy flag object       — { hasComplication, inLabDeath, coronaryPerforation, … }
 *   3. Top-level CRF fields     — noReflow, dissectionNhlbi, perforationEllis, acuteStentThrombosis
 *
 * Every consumer (dashboards, audit, reports, metrics) must read complications
 * through complicationFlags() so all three shapes are counted the same way.
 */

import type { CathComplicationItem, ComplicationType } from './interventionalTypes'

export interface ComplicationFlags {
  hasComplication: boolean
  inLabDeath: boolean
  inHospitalDeath: boolean
  coronaryPerforation: boolean
  coronaryPerforationEllisClass?: string
  coronaryDissection: boolean
  coronaryDissectionNhlbiType?: string
  noReflowSlowReflow: boolean
  acuteStentThrombosis: boolean
  emergencyCabg: boolean
  accessSiteBleeding: boolean
  accessSiteVascular: boolean
  barcBleedingType?: string
  majorBleed: boolean
  contrastInducedAki: boolean
  strokeOrTia: boolean
  periproceduralMi: boolean
  cardiacTamponade: boolean
  ventricularArrhythmia: boolean
  contrastReaction: boolean
  targetVesselRevascularization: boolean
  other: boolean
}

const LEGACY_BOOLEAN_KEYS = [
  'inLabDeath', 'inHospitalDeath', 'coronaryPerforation', 'coronaryDissection',
  'noReflowSlowReflow', 'acuteStentThrombosis', 'emergencyCabg', 'accessSiteBleeding',
  'majorBleed', 'contrastInducedAki', 'strokeOrTia', 'periproceduralMi', 'cardiacTamponade',
  'targetVesselRevascularization',
] as const

/** Major bleeding: BARC types 3–5. */
const MAJOR_BARC = new Set(['3a', '3b', '3c', '4', '5a', '5b'])

function emptyFlags(): ComplicationFlags {
  return {
    hasComplication: false,
    inLabDeath: false,
    inHospitalDeath: false,
    coronaryPerforation: false,
    coronaryDissection: false,
    noReflowSlowReflow: false,
    acuteStentThrombosis: false,
    emergencyCabg: false,
    accessSiteBleeding: false,
    accessSiteVascular: false,
    majorBleed: false,
    contrastInducedAki: false,
    strokeOrTia: false,
    periproceduralMi: false,
    cardiacTamponade: false,
    ventricularArrhythmia: false,
    contrastReaction: false,
    targetVesselRevascularization: false,
    other: false,
  }
}

function applyItem(f: ComplicationFlags, item: CathComplicationItem): void {
  const type: ComplicationType | string = item?.type
  switch (type) {
    case 'in-hospital-death':
      f.inHospitalDeath = true
      if (item.timing === 'Intra-procedural') f.inLabDeath = true
      break
    case 'emergency-cabg': f.emergencyCabg = true; break
    case 'stroke': f.strokeOrTia = true; break
    case 'periprocedural-mi-scai':
    case 'periprocedural-mi-4th-udmi': f.periproceduralMi = true; break
    case 'cardiac-tamponade': f.cardiacTamponade = true; break
    case 'ventricular-arrhythmia': f.ventricularArrhythmia = true; break
    case 'contrast-reaction': f.contrastReaction = true; break
    case 'aki-kdigo': f.contrastInducedAki = true; break
    case 'barc-bleeding':
      f.barcBleedingType = item.barcType ? `BARC ${item.barcType}` : 'BARC'
      if (item.barcType && MAJOR_BARC.has(item.barcType)) f.majorBleed = true
      break
    case 'access-site-haematoma':
    case 'access-site-retroperitoneal':
      f.accessSiteBleeding = true
      f.accessSiteVascular = true
      if (type === 'access-site-retroperitoneal') f.majorBleed = true
      break
    case 'access-site-pseudoaneurysm':
    case 'access-site-av-fistula':
    case 'access-site-limb-ischaemia':
      f.accessSiteVascular = true
      break
    case 'other': f.other = true; break
    default: break
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyLegacy(f: ComplicationFlags, raw: any): void {
  for (const key of LEGACY_BOOLEAN_KEYS) {
    if (raw[key]) f[key] = true
  }
  if (raw.coronaryPerforationEllisClass) f.coronaryPerforationEllisClass = raw.coronaryPerforationEllisClass
  if (raw.coronaryDissectionNhlbiType) f.coronaryDissectionNhlbiType = raw.coronaryDissectionNhlbiType
  if (raw.barcBleedingType) f.barcBleedingType = raw.barcBleedingType
  if (raw.hasComplication) f.hasComplication = true
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function complicationFlags(proc: any): ComplicationFlags {
  const f = emptyFlags()
  if (!proc) return f
  const raw = proc.complications

  if (Array.isArray(raw)) {
    raw.forEach(item => applyItem(f, item))
  }
  // Legacy flag objects: either the field itself, or retained alongside a
  // typed array after the record was edited in the current CRF.
  const legacy = Array.isArray(raw) ? proc.complicationsLegacy : raw
  if (legacy && typeof legacy === 'object' && !Array.isArray(legacy)) {
    applyLegacy(f, legacy)
  }

  // Angiographic events captured as top-level CRF fields
  if (proc.noReflow) f.noReflowSlowReflow = true
  if (proc.acuteStentThrombosis) f.acuteStentThrombosis = true
  if (proc.dissectionNhlbi && proc.dissectionNhlbi !== 'None') {
    f.coronaryDissection = true
    f.coronaryDissectionNhlbiType ??= proc.dissectionNhlbi
  }
  if (proc.perforationEllis && proc.perforationEllis !== 'None') {
    f.coronaryPerforation = true
    f.coronaryPerforationEllisClass ??= proc.perforationEllis
  }

  f.hasComplication = f.hasComplication || Object.entries(f).some(
    ([k, v]) => k !== 'hasComplication' && v === true
  ) || !!f.barcBleedingType
  return f
}

/** In-hospital MACE as used by registry dashboards: death, emergent CABG, stent thrombosis, peri-procedural MI. */
export function hasMace(f: ComplicationFlags): boolean {
  return f.inLabDeath || f.inHospitalDeath || f.emergencyCabg || f.acuteStentThrombosis || f.periproceduralMi
}

/** Human-readable event labels for audit tables and timelines. */
export function complicationLabels(f: ComplicationFlags): string[] {
  const labels: string[] = []
  if (f.coronaryPerforation) labels.push(`Perforation (Ellis ${f.coronaryPerforationEllisClass || '?'})`)
  if (f.coronaryDissection) labels.push(`Dissection (NHLBI ${f.coronaryDissectionNhlbiType || '?'})`)
  if (f.noReflowSlowReflow) labels.push('Slow / No-Reflow')
  if (f.acuteStentThrombosis) labels.push('Stent Thrombosis')
  if (f.emergencyCabg) labels.push('Emergent CABG')
  if (f.barcBleedingType) labels.push(`Bleeding (${f.barcBleedingType})`)
  else if (f.accessSiteBleeding) labels.push('Access-site Bleeding')
  if (f.accessSiteVascular && !f.accessSiteBleeding) labels.push('Access-site Vascular')
  if (f.contrastInducedAki) labels.push('Contrast AKI')
  if (f.strokeOrTia) labels.push('Stroke / TIA')
  if (f.periproceduralMi) labels.push('Peri-procedural MI')
  if (f.cardiacTamponade) labels.push('Tamponade')
  if (f.ventricularArrhythmia) labels.push('Ventricular Arrhythmia')
  if (f.contrastReaction) labels.push('Contrast Reaction')
  if (f.inLabDeath || f.inHospitalDeath) labels.push('Mortality')
  if (f.other) labels.push('Other')
  return labels
}

// ─── CRF form mapping ─────────────────────────────────────────────────────────

export const ACCESS_SITE_TYPES = [
  'access-site-haematoma',
  'access-site-pseudoaneurysm',
  'access-site-av-fistula',
  'access-site-retroperitoneal',
  'access-site-limb-ischaemia',
] as const

export interface ComplicationFormValues {
  compDeath: 'None' | 'Intra-procedural' | 'Post-procedural'
  compEmergencyCabg: boolean
  compStroke: boolean
  compTamponade: boolean
  compPeriMi: boolean
  compVentArrhythmia: boolean
  compContrastReaction: boolean
  compAccessSite: 'None' | typeof ACCESS_SITE_TYPES[number]
  compBarc: 'None' | Exclude<NonNullable<CathComplicationItem['barcType']>, '0'>
  compAkiStage: 'None' | '1' | '2' | '3'
}

/** Form defaults from a stored typed-array complications field (legacy objects are retained separately). */
export function complicationFormDefaults(raw: unknown): ComplicationFormValues {
  const items: CathComplicationItem[] = Array.isArray(raw) ? raw : []
  const find = (t: ComplicationType) => items.find(i => i?.type === t)
  const death = find('in-hospital-death')
  const access = items.find(i => (ACCESS_SITE_TYPES as readonly string[]).includes(i?.type))
  return {
    compDeath: death ? (death.timing === 'Intra-procedural' ? 'Intra-procedural' : 'Post-procedural') : 'None',
    compEmergencyCabg: !!find('emergency-cabg'),
    compStroke: !!find('stroke'),
    compTamponade: !!find('cardiac-tamponade'),
    compPeriMi: !!(find('periprocedural-mi-scai') || find('periprocedural-mi-4th-udmi')),
    compVentArrhythmia: !!find('ventricular-arrhythmia'),
    compContrastReaction: !!find('contrast-reaction'),
    compAccessSite: (access?.type as ComplicationFormValues['compAccessSite']) ?? 'None',
    compBarc: (() => { const t = find('barc-bleeding')?.barcType; return t && t !== '0' ? t : 'None' })(),
    compAkiStage: find('aki-kdigo')?.kdigoStage ? String(find('aki-kdigo')!.kdigoStage) as '1' | '2' | '3' : 'None',
  }
}

/** Builds the typed complications array from CRF form values, keeping free-text details of unchanged items. */
export function complicationItemsFromForm(v: ComplicationFormValues, previous: unknown): CathComplicationItem[] {
  const prev: CathComplicationItem[] = Array.isArray(previous) ? previous : []
  const keep = (item: CathComplicationItem): CathComplicationItem => {
    const old = prev.find(p => p?.type === item.type)
    return old?.details ? { ...item, details: old.details } : item
  }
  const items: CathComplicationItem[] = []
  if (v.compDeath !== 'None') items.push({ type: 'in-hospital-death', timing: v.compDeath === 'Intra-procedural' ? 'Intra-procedural' : 'Post-procedural' })
  if (v.compEmergencyCabg) items.push({ type: 'emergency-cabg' })
  if (v.compStroke) items.push({ type: 'stroke' })
  if (v.compTamponade) items.push({ type: 'cardiac-tamponade' })
  if (v.compPeriMi) items.push({ type: prev.find(p => p?.type === 'periprocedural-mi-4th-udmi') ? 'periprocedural-mi-4th-udmi' : 'periprocedural-mi-scai' })
  if (v.compVentArrhythmia) items.push({ type: 'ventricular-arrhythmia' })
  if (v.compContrastReaction) items.push({ type: 'contrast-reaction' })
  if (v.compAccessSite !== 'None') items.push({ type: v.compAccessSite })
  if (v.compBarc !== 'None') items.push({ type: 'barc-bleeding', barcType: v.compBarc })
  if (v.compAkiStage !== 'None') items.push({ type: 'aki-kdigo', kdigoStage: Number(v.compAkiStage) as 1 | 2 | 3 })
  // Item types the form does not capture (e.g. 'other') are carried over untouched.
  const captured = new Set(items.map(i => i.type))
  const formTypes = new Set<string>(['in-hospital-death', 'emergency-cabg', 'stroke', 'cardiac-tamponade', 'periprocedural-mi-scai', 'periprocedural-mi-4th-udmi', 'ventricular-arrhythmia', 'contrast-reaction', 'barc-bleeding', 'aki-kdigo', ...ACCESS_SITE_TYPES])
  prev.filter(p => p && !formTypes.has(p.type) && !captured.has(p.type)).forEach(p => items.push(p))
  return items.map(keep)
}
