/**
 * xlsxUtils.ts
 * Excel and CSV import/export utilities for the Cardio-Konnect research dashboard.
 *
 * Export dependencies: xlsx (SheetJS), papaparse
 * Import dependencies: xlsx (SheetJS), papaparse
 */

import * as XLSX from 'xlsx'
import Papa from 'papaparse'
import type { Patient, Visit, PopulationStats } from './types'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Trigger a browser file download from a Blob. */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  // Small delay before revoking to ensure the download has started
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Calculate age in years from an ISO date string. */
function calcAge(dob: string): number | null {
  if (!dob) return null
  const birth = new Date(dob)
  const now = new Date()
  let age = now.getFullYear() - birth.getFullYear()
  const m = now.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--
  return isNaN(age) ? null : age
}

/** Find the most-recent visit for a patient from a list of visits. */
function latestVisit(patientId: string, visits: Visit[]): Visit | undefined {
  return visits
    .filter(v => v.patientId === patientId)
    .sort((a, b) => (b.visitDate ?? '').localeCompare(a.visitDate ?? ''))[0]
}

/** XLSX colour fill helper. */
function fill(hex: string): any {
  return { fgColor: { rgb: hex }, patternType: 'solid' } as unknown as any
}

const HEADER_FILL = fill('1F4E79')          // dark blue header bg
const HEADER_FONT: any = { color: { rgb: 'FFFFFF' }, bold: true } as unknown as any

const ROW_FILL_ODD = fill('FFFFFF')         // white
const ROW_FILL_EVEN = fill('DCE6F1')        // light blue

const RED_FILL = fill('FF0000')
const AMBER_FILL = fill('FFC000')

// ─────────────────────────────────────────────────────────────────────────────
// Sheet builders
// ─────────────────────────────────────────────────────────────────────────────

/** Apply header style + alternating row colours + conditional formatting to a worksheet. */
function styleSheet(
  ws: XLSX.WorkSheet,
  rowCount: number,
  colCount: number,
  conditionals: Array<{
    col: number
    predicate: (cellValue: unknown) => 'red' | 'amber' | null
  }> = []
): void {
  const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1')

  for (let R = range.s.r; R <= range.e.r; R++) {
    for (let C = range.s.c; C <= range.e.c; C++) {
      const addr = XLSX.utils.encode_cell({ r: R, c: C })
      if (!ws[addr]) ws[addr] = { t: 's', v: '' }
      if (!ws[addr].s) ws[addr].s = {}

      if (R === 0) {
        // Header row
        ws[addr].s = {
          fill: HEADER_FILL,
          font: HEADER_FONT,
          alignment: { horizontal: 'center', wrapText: true },
          border: {
            bottom: { style: 'thin', color: { rgb: '000000' } },
          },
        }
      } else {
        // Data rows — alternating fill
        const baseFill = R % 2 === 0 ? ROW_FILL_ODD : ROW_FILL_EVEN
        ws[addr].s = {
          fill: baseFill,
          alignment: { horizontal: 'left', wrapText: false },
          border: {
            bottom: { style: 'hair', color: { rgb: 'CCCCCC' } },
            right: { style: 'hair', color: { rgb: 'CCCCCC' } },
          },
        }

        // Conditional formatting overrides
        for (const cond of conditionals) {
          if (C === cond.col) {
            const result = cond.predicate(ws[addr].v)
            if (result === 'red') {
              ws[addr].s.fill = RED_FILL
              ws[addr].s.font = { color: { rgb: 'FFFFFF' }, bold: true }
            } else if (result === 'amber') {
              ws[addr].s.fill = AMBER_FILL
              ws[addr].s.font = { color: { rgb: '000000' }, bold: true }
            }
          }
        }
      }
    }
  }

  // Auto column widths (rough heuristic)
  const colWidths: { wch: number }[] = []
  for (let C = 0; C < colCount; C++) {
    let maxLen = 8
    for (let R = 0; R <= rowCount; R++) {
      const addr = XLSX.utils.encode_cell({ r: R, c: C })
      const cell = ws[addr]
      const len = cell ? String(cell.v ?? '').length : 0
      if (len > maxLen) maxLen = len
    }
    colWidths.push({ wch: Math.min(maxLen + 2, 40) })
  }
  ws['!cols'] = colWidths

  // Freeze first row
  ws['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2', activePane: 'bottomLeft' }
}

// ─────────────────────────────────────────────────────────────────────────────
// Sheet 1 — Patients
// ─────────────────────────────────────────────────────────────────────────────

const PATIENT_HEADERS: Array<{ label: string; key: keyof Patient | 'age' }> = [
  { label: 'Patient ID', key: 'id' },
  { label: 'First Name', key: 'firstName' },
  { label: 'Last Name', key: 'lastName' },
  { label: 'Date of Birth', key: 'dob' },
  { label: 'Age (years)', key: 'age' },
  { label: 'Sex', key: 'sex' },
  { label: 'MRN', key: 'mrn' },
  { label: 'Contact', key: 'contact' },
  { label: 'Address', key: 'address' },
  { label: 'Comorbidities', key: 'comorbidities' },
  { label: 'Allergies', key: 'allergies' },
  { label: 'Visit Count', key: 'visitCount' },
  { label: 'Last Visit Date', key: 'lastVisitDate' },
  { label: 'Created At', key: 'createdAt' },
  { label: 'Updated At', key: 'updatedAt' },
]

function buildPatientsSheet(patients: Patient[]): XLSX.WorkSheet {
  const rows: unknown[][] = [PATIENT_HEADERS.map(h => h.label)]
  for (const p of patients) {
    rows.push(
      PATIENT_HEADERS.map(h => {
        if (h.key === 'age') return calcAge(p.dob)
        if (h.key === 'comorbidities') {
          return Array.isArray(p.comorbidities) ? p.comorbidities.join(', ') : (p.comorbidities ?? '')
        }
        return (p as unknown as Record<string, unknown>)[h.key] ?? ''
      })
    )
  }
  const ws = XLSX.utils.aoa_to_sheet(rows)
  styleSheet(ws, patients.length, PATIENT_HEADERS.length)
  return ws
}

// ─────────────────────────────────────────────────────────────────────────────
// Sheet 2 — Visits
// ─────────────────────────────────────────────────────────────────────────────

type VisitRow = Record<string, unknown>

const VISIT_COLUMN_MAP: Array<{ label: string; extractor: (v: Visit) => unknown }> = [
  { label: 'Visit ID', extractor: v => v.id },
  { label: 'Patient ID', extractor: v => v.patientId },
  { label: 'Visit Date', extractor: v => v.visitDate },
  { label: 'Visit Type', extractor: v => v.visitType },
  // Anthropometrics
  { label: 'Weight (kg)', extractor: v => v.weight ?? '' },
  { label: 'Height (cm)', extractor: v => v.height ?? '' },
  { label: 'O2 Saturation (%)', extractor: v => v.o2Sat ?? '' },
  { label: 'Oedema', extractor: v => v.oedema ?? '' },
  // Vitals
  { label: 'BP Systolic (mmHg)', extractor: v => v.bpSystolic ?? '' },
  { label: 'BP Diastolic (mmHg)', extractor: v => v.bpDiastolic ?? '' },
  { label: 'Heart Rate (bpm)', extractor: v => v.heartRate ?? '' },
  // Clinical assessment
  { label: 'NYHA Class', extractor: v => v.nyha ?? '' },
  { label: 'Rhythm', extractor: v => v.rhythm ?? '' },
  { label: '6MWT (metres)', extractor: v => v.sixMWT ?? '' },
  { label: 'HF Type', extractor: v => v.hfType ?? '' },
  { label: 'Etiology', extractor: v => (v.etiology ?? []).join('; ') },
  { label: 'Etiology (Other)', extractor: v => v.etiologyOther ?? '' },
  // Hospitalisation
  { label: 'Hospitalisation History', extractor: v => v.hospHistory ?? '' },
  { label: 'Hospitalisation Count', extractor: v => v.hospCount ?? '' },
  { label: 'Hospitalisation Details', extractor: v => v.hospDetails ?? '' },
  // Echo
  { label: 'LVEF (%)', extractor: v => v.lvef ?? '' },
  { label: 'Echo Date', extractor: v => v.echoDate ?? '' },
  { label: 'LVDD (mm)', extractor: v => v.lvdd ?? '' },
  { label: 'LVSD (mm)', extractor: v => v.lvsd ?? '' },
  { label: "E/E' Ratio", extractor: v => v.eEPrime ?? '' },
  { label: 'DD Grade', extractor: v => v.ddGrade ?? '' },
  { label: 'RVSP (mmHg)', extractor: v => v.rvsp ?? '' },
  { label: 'Wall Motion Abnormality', extractor: v => v.wallMotionAbnormality != null ? (v.wallMotionAbnormality ? 'Yes' : 'No') : '' },
  { label: 'Echo Notes', extractor: v => v.echNotes ?? '' },
  // Labs
  { label: 'NT-proBNP (pg/mL)', extractor: v => v.ntProBNP ?? '' },
  { label: 'BNP (pg/mL)', extractor: v => v.bnp ?? '' },
  { label: 'eGFR (ml/min/1.73m²)', extractor: v => v.egfr ?? '' },
  { label: 'Creatinine (mg/dL)', extractor: v => v.creatinine ?? '' },
  { label: 'Potassium (mmol/L)', extractor: v => v.potassium ?? '' },
  { label: 'Sodium (mmol/L)', extractor: v => v.sodium ?? '' },
  { label: 'Haemoglobin (g/dL)', extractor: v => v.hb ?? '' },
  { label: 'TSH (mIU/L)', extractor: v => v.tft ?? '' },
  { label: 'HbA1c (%)', extractor: v => v.hba1c ?? '' },
  { label: 'Ferritin (µg/L)', extractor: v => v.ferritin ?? '' },
  { label: 'Transferrin Saturation (%)', extractor: v => v.transferrinSat ?? '' },
  { label: 'Uric Acid (mg/dL)', extractor: v => v.uricAcid ?? '' },
  { label: 'LDL (mg/dL)', extractor: v => v.ldl ?? '' },
  { label: 'Triglycerides (mg/dL)', extractor: v => v.triglycerides ?? '' },
  // ECG
  { label: 'QRS Duration (ms)', extractor: v => v.qrsDuration ?? '' },
  { label: 'Bundle Branch Block', extractor: v => v.bbb ?? '' },
  { label: 'QTc Interval (ms)', extractor: v => v.qtcInterval ?? '' },
  // Core HF Meds
  { label: 'Diuretic Prescribed', extractor: v => v.diuretic?.prescribed ?? '' },
  { label: 'Diuretic Type', extractor: v => v.diuretic?.type ?? '' },
  { label: 'Diuretic Dose', extractor: v => v.diuretic?.dose ?? '' },
  { label: 'RAASi Prescribed', extractor: v => v.raasi?.prescribed ?? '' },
  { label: 'RAASi Type', extractor: v => v.raasi?.type ?? '' },
  { label: 'RAASi Dose', extractor: v => v.raasi?.dose ?? '' },
  { label: 'Beta-Blocker Prescribed', extractor: v => v.betaBlocker?.prescribed ?? '' },
  { label: 'Beta-Blocker Type', extractor: v => v.betaBlocker?.type ?? '' },
  { label: 'Beta-Blocker Dose', extractor: v => v.betaBlocker?.dose ?? '' },
  { label: 'Digoxin Prescribed', extractor: v => v.digoxin?.prescribed ?? '' },
  { label: 'Digoxin Dose', extractor: v => v.digoxin?.dose ?? '' },
  { label: 'SGLT2i Prescribed', extractor: v => v.sglt2i?.prescribed ?? '' },
  { label: 'SGLT2i Type', extractor: v => v.sglt2i?.type ?? '' },
  { label: 'SGLT2i Dose', extractor: v => v.sglt2i?.dose ?? '' },
  { label: 'Ivabradine Prescribed', extractor: v => v.ivabradine?.prescribed ?? '' },
  { label: 'Ivabradine Dose', extractor: v => v.ivabradine?.dose ?? '' },
  { label: 'MRA Prescribed', extractor: v => v.mra?.prescribed ?? '' },
  { label: 'MRA Type', extractor: v => v.mra?.type ?? '' },
  { label: 'MRA Dose', extractor: v => v.mra?.dose ?? '' },
  // Dyslipidaemia meds
  { label: 'Aspirin Prescribed', extractor: v => v.aspirin?.prescribed ?? '' },
  { label: 'Aspirin Dose', extractor: v => v.aspirin?.dose ?? '' },
  { label: 'Statin Prescribed', extractor: v => v.statin?.prescribed ?? '' },
  { label: 'Statin Type', extractor: v => v.statin?.type ?? '' },
  { label: 'Statin Dose', extractor: v => v.statin?.dose ?? '' },
  { label: 'Fibrate Prescribed', extractor: v => v.fibrate?.prescribed ?? '' },
  { label: 'Fibrate Type', extractor: v => v.fibrate?.type ?? '' },
  { label: 'PCSK9 Prescribed', extractor: v => v.pcsk9?.prescribed ?? '' },
  { label: 'PCSK9 Type', extractor: v => v.pcsk9?.type ?? '' },
  // Diabetes
  { label: 'DM Drug', extractor: v => v.dmManagement?.drug ?? '' },
  { label: 'DM HbA1c (%)', extractor: v => v.dmManagement?.hba1c ?? '' },
  // Iron
  { label: 'IV Iron Prescribed', extractor: v => v.ivIron?.prescribed ?? '' },
  { label: 'IV Iron Dose', extractor: v => v.ivIron?.dose ?? '' },
  // Anticoag
  { label: 'NOAC Prescribed', extractor: v => v.noac?.prescribed ?? '' },
  { label: 'NOAC Type', extractor: v => v.noac?.type ?? '' },
  { label: 'NOAC Dose', extractor: v => v.noac?.dose ?? '' },
  { label: 'VKI Prescribed', extractor: v => v.vki?.prescribed ?? '' },
  { label: 'VKI Type', extractor: v => v.vki?.type ?? '' },
  { label: 'VKI Dose', extractor: v => v.vki?.dose ?? '' },
  {
    label: 'Anticoagulant Therapy',
    extractor: v => {
      if (v.anticoagulation) return v.anticoagulation;
      const parts: string[] = [];
      if (v.noac?.prescribed === 'Yes') {
        parts.push(v.noac.type ? `${v.noac.type}${v.noac.dose ? ' (' + v.noac.dose + ')' : ''}` : 'NOAC');
      }
      if (v.vki?.prescribed === 'Yes') {
        parts.push(v.vki.type ? `${v.vki.type}${v.vki.dose ? ' (' + v.vki.dose + ')' : ''}` : 'VKI');
      }
      if (parts.length > 0) return parts.join(', ');
      if (v.noac?.prescribed === 'No' && v.vki?.prescribed === 'No') return 'No';
      return '';
    }
  },
  { label: 'Antiarrhythmic Therapy', extractor: v => v.antiarrhythmic ?? '' },
  { label: 'Antiarrhythmic Reason', extractor: v => v.antiarrhythmicReason ?? '' },
  // Devices
  { label: 'Devices', extractor: v => (v.device ?? []).join('; ') },
  { label: 'Device Notes', extractor: v => v.deviceNotes ?? '' },
  // Vaccinations
  { label: 'Influenza Vaccine', extractor: v => v.vaccInfluenza ?? '' },
  { label: 'Influenza Vaccine Date', extractor: v => v.vaccInfluenzaDate ?? '' },
  { label: 'Pneumococcal Vaccine', extractor: v => v.vaccPneumo ?? '' },
  { label: 'Pneumococcal Vaccine Date', extractor: v => v.vaccPneumoDate ?? '' },
  // Functional
  { label: 'Grip Strength Right (kg)', extractor: v => v.gripRight ?? '' },
  { label: 'Grip Strength Left (kg)', extractor: v => v.gripLeft ?? '' },
  { label: 'Frailty Status', extractor: v => v.frailty ?? '' },
  // Education
  { label: 'Patient Education Topics', extractor: v => (v.education ?? []).join('; ') },
  { label: 'Education Notes', extractor: v => v.eduNotes ?? '' },
  // Follow-up
  { label: 'Follow-up Date', extractor: v => v.followupDate ?? '' },
  { label: 'Follow-up Type', extractor: v => v.followupType ?? '' },
  { label: 'Clinical Notes', extractor: v => v.clinicalNotes ?? '' },
  { label: 'Created At', extractor: v => v.createdAt },
]

/** Column index (0-based) for conditional formatting look-ups. */
const VISIT_COL_LVEF = VISIT_COLUMN_MAP.findIndex(c => c.label === 'LVEF (%)')
const VISIT_COL_NYHA = VISIT_COLUMN_MAP.findIndex(c => c.label === 'NYHA Class')
const VISIT_COL_NTPROBNP = VISIT_COLUMN_MAP.findIndex(c => c.label === 'NT-proBNP (pg/mL)')

const VISIT_CONDITIONALS = [
  {
    col: VISIT_COL_LVEF,
    predicate: (v: unknown) => (typeof v === 'number' && v < 35 ? 'red' : null) as 'red' | 'amber' | null,
  },
  {
    col: VISIT_COL_NYHA,
    predicate: (v: unknown) =>
      (v === 'III' || v === 'IV' ? 'amber' : null) as 'red' | 'amber' | null,
  },
  {
    col: VISIT_COL_NTPROBNP,
    predicate: (v: unknown) => (typeof v === 'number' && v > 2000 ? 'red' : null) as 'red' | 'amber' | null,
  },
]

function buildVisitsSheet(visits: Visit[]): XLSX.WorkSheet {
  const rows: unknown[][] = [VISIT_COLUMN_MAP.map(c => c.label)]
  for (const v of visits) {
    rows.push(VISIT_COLUMN_MAP.map(c => c.extractor(v)))
  }
  const ws = XLSX.utils.aoa_to_sheet(rows)
  styleSheet(ws, visits.length, VISIT_COLUMN_MAP.length, VISIT_CONDITIONALS)
  return ws
}

// ─────────────────────────────────────────────────────────────────────────────
// Sheet 3 — Latest Visit (one row per patient, demographics + latest visit)
// ─────────────────────────────────────────────────────────────────────────────

function buildLatestVisitSheet(patients: Patient[], visits: Visit[]): XLSX.WorkSheet {
  const patientHeaders = PATIENT_HEADERS.map(h => h.label)
  const visitHeaders = VISIT_COLUMN_MAP.map(c => c.label)
  const headers = [...patientHeaders, ...visitHeaders]

  const rows: unknown[][] = [headers]
  for (const p of patients) {
    const pRow = PATIENT_HEADERS.map(h => {
      if (h.key === 'age') return calcAge(p.dob)
      return (p as unknown as Record<string, unknown>)[h.key] ?? ''
    })
    const lv = latestVisit(p.id, visits)
    const vRow = lv ? VISIT_COLUMN_MAP.map(c => c.extractor(lv)) : new Array(VISIT_COLUMN_MAP.length).fill('')
    rows.push([...pRow, ...vRow])
  }

  const ws = XLSX.utils.aoa_to_sheet(rows)
  // Shift conditional column indices by patientHeaders.length
  const offset = patientHeaders.length
  const shiftedConditionals = VISIT_CONDITIONALS.map(c => ({ ...c, col: c.col + offset }))
  styleSheet(ws, patients.length, headers.length, shiftedConditionals)
  return ws
}

// ─────────────────────────────────────────────────────────────────────────────
// Sheet 4 — Medications matrix
// ─────────────────────────────────────────────────────────────────────────────

const MED_DEFINITIONS: Array<{
  label: string
  prescribed: (v: Visit) => string
  type?: (v: Visit) => string
  dose: (v: Visit) => string
  reason?: (v: Visit) => string
}> = [
  {
    label: 'Diuretic',
    prescribed: v => v.diuretic?.prescribed ?? '',
    type: v => v.diuretic?.type ?? '',
    dose: v => v.diuretic?.dose ?? '',
    reason: v => v.diuretic?.reason ?? '',
  },
  {
    label: 'RAASi (ACE/ARB/ARNI)',
    prescribed: v => v.raasi?.prescribed ?? '',
    type: v => v.raasi?.type ?? '',
    dose: v => v.raasi?.dose ?? '',
    reason: v => v.raasi?.reason ?? '',
  },
  {
    label: 'Beta-Blocker',
    prescribed: v => v.betaBlocker?.prescribed ?? '',
    type: v => v.betaBlocker?.type ?? '',
    dose: v => v.betaBlocker?.dose ?? '',
    reason: v => v.betaBlocker?.reason ?? '',
  },
  {
    label: 'Digoxin',
    prescribed: v => v.digoxin?.prescribed ?? '',
    dose: v => v.digoxin?.dose ?? '',
    reason: v => v.digoxin?.reason ?? '',
  },
  {
    label: 'SGLT2i',
    prescribed: v => v.sglt2i?.prescribed ?? '',
    type: v => v.sglt2i?.type ?? '',
    dose: v => v.sglt2i?.dose ?? '',
    reason: v => v.sglt2i?.reason ?? '',
  },
  {
    label: 'Ivabradine',
    prescribed: v => v.ivabradine?.prescribed ?? '',
    dose: v => v.ivabradine?.dose ?? '',
    reason: v => v.ivabradine?.reason ?? '',
  },
  {
    label: 'MRA',
    prescribed: v => v.mra?.prescribed ?? '',
    type: v => v.mra?.type ?? '',
    dose: v => v.mra?.dose ?? '',
    reason: v => v.mra?.reason ?? '',
  },
  {
    label: 'Aspirin',
    prescribed: v => v.aspirin?.prescribed ?? '',
    dose: v => v.aspirin?.dose ?? '',
  },
  {
    label: 'Statin',
    prescribed: v => v.statin?.prescribed ?? '',
    type: v => v.statin?.type ?? '',
    dose: v => v.statin?.dose ?? '',
  },
  {
    label: 'Fibrate',
    prescribed: v => v.fibrate?.prescribed ?? '',
    type: v => v.fibrate?.type ?? '',
    dose: () => '',
  },
  {
    label: 'PCSK9 Inhibitor',
    prescribed: v => v.pcsk9?.prescribed ?? '',
    type: v => v.pcsk9?.type ?? '',
    dose: () => '',
  },
  {
    label: 'IV Iron',
    prescribed: v => v.ivIron?.prescribed ?? '',
    dose: v => v.ivIron?.dose ?? '',
    reason: v => v.ivIron?.reason ?? '',
  },
  {
    label: 'NOAC',
    prescribed: v => v.noac?.prescribed ?? '',
    type: v => v.noac?.type ?? '',
    dose: v => v.noac?.dose ?? '',
  },
  {
    label: 'VKI',
    prescribed: v => v.vki?.prescribed ?? '',
    type: v => v.vki?.type ?? '',
    dose: v => v.vki?.dose ?? '',
  },
]

function buildMedicationsSheet(visits: Visit[]): XLSX.WorkSheet {
  // Build column headers dynamically from MED_DEFINITIONS
  const fixedHeaders = ['Visit ID', 'Patient ID', 'Visit Date']
  const medHeaders: string[] = []
  for (const med of MED_DEFINITIONS) {
    medHeaders.push(`${med.label} — Prescribed`)
    if (med.type) medHeaders.push(`${med.label} — Type`)
    medHeaders.push(`${med.label} — Dose`)
    if (med.reason) medHeaders.push(`${med.label} — Reason Not Prescribed`)
  }

  const headers = [...fixedHeaders, ...medHeaders]
  const rows: unknown[][] = [headers]

  for (const v of visits) {
    const row: unknown[] = [v.id, v.patientId, v.visitDate]
    for (const med of MED_DEFINITIONS) {
      row.push(med.prescribed(v))
      if (med.type) row.push(med.type(v))
      row.push(med.dose ? med.dose(v) : '')
      if (med.reason) row.push(med.reason(v))
    }
    rows.push(row)
  }

  const ws = XLSX.utils.aoa_to_sheet(rows)
  styleSheet(ws, visits.length, headers.length)
  return ws
}

// ─────────────────────────────────────────────────────────────────────────────
// Sheet 5 — Analytics Summary
// ─────────────────────────────────────────────────────────────────────────────

function computePopulationStats(patients: Patient[], visits: Visit[]): PopulationStats {
  const totalPatients = patients.length

  // HF type breakdown
  const hfTypeBreakdown: Record<string, number> = {}
  const nyhaCounts: Record<string, number> = {}
  const etiologyCounts: Record<string, number> = {}
  const rhythmCounts: Record<string, number> = {}
  const medPrescribingRates: Record<string, number> = {}
  const deviceCounts: Record<string, number> = {}
  const lvefBins: Record<string, number> = { '<35': 0, '35-49': 0, '>=50': 0, 'Not recorded': 0 }

  let lvefSum = 0, lvefCount = 0
  let ntProBNPSum = 0, ntProBNPCount = 0
  let egfrSum = 0, egfrCount = 0
  let ageSum = 0, ageCount = 0

  // Use only latest visit per patient for certain stats
  for (const p of patients) {
    const age = calcAge(p.dob)
    if (age !== null) { ageSum += age; ageCount++ }

    const lv = latestVisit(p.id, visits)
    if (!lv) continue

    if (lv.hfType) hfTypeBreakdown[lv.hfType] = (hfTypeBreakdown[lv.hfType] ?? 0) + 1
    if (lv.nyha) nyhaCounts[lv.nyha] = (nyhaCounts[lv.nyha] ?? 0) + 1
    if (lv.rhythm) rhythmCounts[lv.rhythm] = (rhythmCounts[lv.rhythm] ?? 0) + 1
    for (const e of lv.etiology ?? []) {
      etiologyCounts[e] = (etiologyCounts[e] ?? 0) + 1
    }

    if (typeof lv.lvef === 'number') {
      lvefSum += lv.lvef; lvefCount++
      if (lv.lvef < 35) lvefBins['<35']++
      else if (lv.lvef < 50) lvefBins['35-49']++
      else lvefBins['>=50']++
    } else {
      lvefBins['Not recorded']++
    }

    if (typeof lv.ntProBNP === 'number') { ntProBNPSum += lv.ntProBNP; ntProBNPCount++ }
    if (typeof lv.egfr === 'number') { egfrSum += lv.egfr; egfrCount++ }

    // Medication prescribing rates (latest visit)
    const medChecks: Array<[string, string]> = [
      ['Diuretic', lv.diuretic?.prescribed ?? ''],
      ['RAASi', lv.raasi?.prescribed ?? ''],
      ['Beta-Blocker', lv.betaBlocker?.prescribed ?? ''],
      ['Digoxin', lv.digoxin?.prescribed ?? ''],
      ['SGLT2i', lv.sglt2i?.prescribed ?? ''],
      ['Ivabradine', lv.ivabradine?.prescribed ?? ''],
      ['MRA', lv.mra?.prescribed ?? ''],
      ['Aspirin', lv.aspirin?.prescribed ?? ''],
      ['Statin', lv.statin?.prescribed ?? ''],
      ['IV Iron', lv.ivIron?.prescribed ?? ''],
      ['NOAC', lv.noac?.prescribed ?? ''],
      ['VKI', lv.vki?.prescribed ?? ''],
    ]
    for (const [med, val] of medChecks) {
      if (val === 'Yes') {
        medPrescribingRates[med] = (medPrescribingRates[med] ?? 0) + 1
      }
    }

    for (const d of lv.device ?? []) {
      deviceCounts[d] = (deviceCounts[d] ?? 0) + 1
    }
  }

  return {
    totalPatients,
    hfTypeBreakdown,
    nyhaCounts,
    etiologyCounts,
    rhythmCounts,
    avgLvef: lvefCount > 0 ? Math.round((lvefSum / lvefCount) * 10) / 10 : null,
    avgAge: ageCount > 0 ? Math.round((ageSum / ageCount) * 10) / 10 : null,
    avgNtProBnp: ntProBNPCount > 0 ? Math.round(ntProBNPSum / ntProBNPCount) : null,
    avgEgfr: egfrCount > 0 ? Math.round((egfrSum / egfrCount) * 10) / 10 : null,
    medPrescribingRates,
    deviceCounts,
    lvefBins,
  }
}

function buildAnalyticsSummarySheet(patients: Patient[], visits: Visit[]): XLSX.WorkSheet {
  const stats = computePopulationStats(patients, visits)

  const rows: unknown[][] = []

  const section = (title: string) => {
    rows.push([title])
    rows.push(['Metric', 'Value'])
  }

  const kv = (k: string, v: unknown) => rows.push([k, v ?? 'N/A'])
  const blank = () => rows.push([])

  section('Population Overview')
  kv('Total Patients', stats.totalPatients)
  kv('Average Age (years)', stats.avgAge)
  kv('Average LVEF (%)', stats.avgLvef)
  kv('Average NT-proBNP (pg/mL)', stats.avgNtProBnp)
  kv('Average eGFR (ml/min/1.73m²)', stats.avgEgfr)
  blank()

  section('HF Type Breakdown')
  for (const [k, v] of Object.entries(stats.hfTypeBreakdown)) {
    kv(k, `${v} (${Math.round((v / stats.totalPatients) * 100)}%)`)
  }
  blank()

  section('NYHA Class Distribution')
  for (const [k, v] of Object.entries(stats.nyhaCounts)) {
    kv(`NYHA ${k}`, `${v} (${Math.round((v / stats.totalPatients) * 100)}%)`)
  }
  blank()

  section('Rhythm Distribution')
  for (const [k, v] of Object.entries(stats.rhythmCounts)) {
    kv(k, `${v} (${Math.round((v / stats.totalPatients) * 100)}%)`)
  }
  blank()

  section('Etiology Distribution')
  for (const [k, v] of Object.entries(stats.etiologyCounts)) {
    kv(k, `${v} (${Math.round((v / stats.totalPatients) * 100)}%)`)
  }
  blank()

  section('LVEF Distribution')
  for (const [k, v] of Object.entries(stats.lvefBins)) {
    kv(k, `${v} (${Math.round((v / stats.totalPatients) * 100)}%)`)
  }
  blank()

  section('Medication Prescribing Rates (Latest Visit)')
  for (const [k, v] of Object.entries(stats.medPrescribingRates)) {
    kv(k, `${v} / ${stats.totalPatients} (${Math.round((v / stats.totalPatients) * 100)}%)`)
  }
  blank()

  section('Device Therapy Counts')
  for (const [k, v] of Object.entries(stats.deviceCounts)) {
    kv(k, `${v} (${Math.round((v / stats.totalPatients) * 100)}%)`)
  }

  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws['!cols'] = [{ wch: 45 }, { wch: 30 }]
  return ws
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC EXPORT: exportPatientsToExcel
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generates a multi-sheet .xlsx file and triggers a browser download.
 *
 * Sheets:
 *   1. Patients          — one row per patient (demographics)
 *   2. Visits            — one row per visit, all clinical fields
 *   3. Latest Visit      — one row per patient with latest visit merged
 *   4. Medications       — medication matrix per visit
 *   5. Analytics Summary — population-level statistics
 */
export function exportPatientsToExcel(patients: Patient[], visits: Visit[]): void {
  const wb = XLSX.utils.book_new()

  XLSX.utils.book_append_sheet(wb, buildPatientsSheet(patients), 'Patients')
  XLSX.utils.book_append_sheet(wb, buildVisitsSheet(visits), 'Visits')
  XLSX.utils.book_append_sheet(wb, buildLatestVisitSheet(patients, visits), 'Latest Visit')
  XLSX.utils.book_append_sheet(wb, buildMedicationsSheet(visits), 'Medications')
  XLSX.utils.book_append_sheet(wb, buildAnalyticsSummarySheet(patients, visits), 'Analytics Summary')

  const date = new Date().toISOString().slice(0, 10)
  const filename = `Cardio-Konnect_Export_${date}.xlsx`

  const wbOut = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  const blob = new Blob([wbOut], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })

  downloadBlob(blob, filename)
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC EXPORT: exportToCSV
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Converts an array of plain objects to CSV and triggers a browser download.
 */
export function exportToCSV(data: object[], filename: string): void {
  const csv = Papa.unparse(data)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const safeName = filename.endsWith('.csv') ? filename : `${filename}.csv`
  downloadBlob(blob, safeName)
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC IMPORT: parseCSVImport
// ─────────────────────────────────────────────────────────────────────────────

export interface CSVImportResult {
  headers: string[]
  rows: object[]
  errors: string[]
}

/**
 * Parses a CSV File object.
 * Returns normalised rows and any parse errors encountered.
 */
export function parseCSVImport(file: File): Promise<CSVImportResult> {
  return new Promise(resolve => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h: string) => h.trim(),
      complete: result => {
        const errors: string[] = result.errors.map(
          e => `Row ${e.row ?? '?'}: ${e.message}`
        )
        const headers = result.meta.fields ?? []
        resolve({
          headers,
          rows: result.data as object[],
          errors,
        })
      },
      error: err => {
        resolve({ headers: [], rows: [], errors: [err.message] })
      },
    })
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC IMPORT: parseExcelImport
// ─────────────────────────────────────────────────────────────────────────────

export interface ExcelImportResult {
  sheets: string[]
  headers: Record<string, string[]>
  rows: Record<string, object[]>
  errors: string[]
}

/**
 * Parses an Excel (.xlsx / .xls) File object.
 * Returns data from all sheets.
 */
export function parseExcelImport(file: File): Promise<ExcelImportResult> {
  return new Promise(resolve => {
    const reader = new FileReader()
    reader.onload = event => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer)
        const wb = XLSX.read(data, { type: 'array', cellDates: true })

        const sheets: string[] = wb.SheetNames
        const headers: Record<string, string[]> = {}
        const rows: Record<string, object[]> = {}
        const errors: string[] = []

        for (const sheetName of sheets) {
          try {
            const ws = wb.Sheets[sheetName]
            const jsonRows = XLSX.utils.sheet_to_json<object>(ws, {
              defval: '',
              raw: false,
            })
            const sheetHeaders =
              jsonRows.length > 0 ? Object.keys(jsonRows[0]) : []
            headers[sheetName] = sheetHeaders
            rows[sheetName] = jsonRows
          } catch (sheetErr) {
            errors.push(
              `Sheet "${sheetName}": ${(sheetErr as Error).message ?? String(sheetErr)}`
            )
            headers[sheetName] = []
            rows[sheetName] = []
          }
        }

        resolve({ sheets, headers, rows, errors })
      } catch (err) {
        resolve({
          sheets: [],
          headers: {},
          rows: {},
          errors: [(err as Error).message ?? String(err)],
        })
      }
    }
    reader.onerror = () => {
      resolve({
        sheets: [],
        headers: {},
        rows: {},
        errors: ['Failed to read file.'],
      })
    }
    reader.readAsArrayBuffer(file)
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// FIELD_MAP — alternative column name → Cardio-Konnect field name
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Maps common alternative / abbreviated column names to canonical Cardio-Konnect
 * field names as used in the Patient and Visit interfaces.
 */
export const FIELD_MAP: Record<string, string> = {
  // Patient demographics
  'Patient ID': 'id',
  'PatientID': 'id',
  'ID': 'id',
  'MRN': 'mrn',
  'Medical Record Number': 'mrn',
  'First Name': 'firstName',
  'Firstname': 'firstName',
  'Given Name': 'firstName',
  'Last Name': 'lastName',
  'Lastname': 'lastName',
  'Surname': 'lastName',
  'Family Name': 'lastName',
  'DOB': 'dob',
  'Date of Birth': 'dob',
  'Birth Date': 'dob',
  'Gender': 'sex',
  'Sex': 'sex',
  'Phone': 'contact',
  'PHONE': 'contact',
  'Telephone': 'contact',

  // Visit basics
  'Visit Date': 'visitDate',
  'Date': 'visitDate',
  'Encounter Date': 'visitDate',
  'Visit Type': 'visitType',

  // Anthropometrics
  'Weight': 'weight',
  'Weight (kg)': 'weight',
  'Wt': 'weight',
  'Height': 'height',
  'Height (cm)': 'height',
  'Ht': 'height',
  'O2 Sat': 'o2Sat',
  'SpO2': 'o2Sat',
  'Oxygen Saturation': 'o2Sat',
  'Oedema': 'oedema',
  'Edema': 'oedema',
  'Pedal Oedema': 'oedema',

  // Vitals
  'BP Systolic': 'bpSystolic',
  'Systolic BP': 'bpSystolic',
  'SBP': 'bpSystolic',
  'BP Diastolic': 'bpDiastolic',
  'Diastolic BP': 'bpDiastolic',
  'DBP': 'bpDiastolic',
  'HR': 'heartRate',
  'Heart Rate': 'heartRate',
  'Pulse': 'heartRate',
  'Pulse Rate': 'heartRate',

  // Clinical
  'NYHA': 'nyha',
  'NYHA Class': 'nyha',
  'NYHA Functional Class': 'nyha',
  'Rhythm': 'rhythm',
  'Cardiac Rhythm': 'rhythm',
  '6MWT': 'sixMWT',
  '6 Min Walk': 'sixMWT',
  '6 Minute Walk Test': 'sixMWT',
  '6MWD': 'sixMWT',
  'HF Type': 'hfType',
  'HF Classification': 'hfType',
  'Etiology': 'etiology',
  'Aetiology': 'etiology',
  'Cause': 'etiology',

  // Echo
  'LVEF': 'lvef',
  'EF': 'lvef',
  'Ejection Fraction': 'lvef',
  'LV EF': 'lvef',
  'LV Ejection Fraction': 'lvef',
  'Echo Date': 'echoDate',
  'LVDD': 'lvdd',
  'LV End Diastolic Diameter': 'lvdd',
  'LVED': 'lvdd',
  'LVSD': 'lvsd',
  'LV End Systolic Diameter': 'lvsd',
  'LVES': 'lvsd',
  "E/E'": 'eEPrime',
  "E/e'": 'eEPrime',
  'E prime ratio': 'eEPrime',
  'DD Grade': 'ddGrade',
  'Diastolic Dysfunction Grade': 'ddGrade',
  'RVSP': 'rvsp',
  'RV Systolic Pressure': 'rvsp',
  'PAP': 'rvsp',

  // Labs
  'NT-proBNP': 'ntProBNP',
  'NTproBNP': 'ntProBNP',
  'NT proBNP': 'ntProBNP',
  'BNP pro': 'ntProBNP',
  'Pro-BNP': 'ntProBNP',
  'BNP': 'bnp',
  'eGFR': 'egfr',
  'GFR': 'egfr',
  'Estimated GFR': 'egfr',
  'Creatinine': 'creatinine',
  'Cr': 'creatinine',
  'SCr': 'creatinine',
  'Serum Creatinine': 'creatinine',
  'Potassium': 'potassium',
  'K': 'potassium',
  'K+': 'potassium',
  'Serum Potassium': 'potassium',
  'Sodium': 'sodium',
  'Na': 'sodium',
  'Na+': 'sodium',
  'Serum Sodium': 'sodium',
  'Haemoglobin': 'hb',
  'Hemoglobin': 'hb',
  'Hb': 'hb',
  'HGB': 'hb',
  'TSH': 'tft',
  'Thyroid': 'tft',
  'TFT': 'tft',
  'HbA1c': 'hba1c',
  'HBA1C': 'hba1c',
  'Glycated Haemoglobin': 'hba1c',
  'A1c': 'hba1c',
  'Ferritin': 'ferritin',
  'TSAT': 'transferrinSat',
  'Transferrin Saturation': 'transferrinSat',
  'Transferrin Sat': 'transferrinSat',
  'Uric Acid': 'uricAcid',
  'Urate': 'uricAcid',
  'LDL': 'ldl',
  'LDL Cholesterol': 'ldl',
  'LDL-C': 'ldl',
  'Triglycerides': 'triglycerides',
  'TG': 'triglycerides',
  'Trigs': 'triglycerides',

  // ECG
  'QRS': 'qrsDuration',
  'QRS Duration': 'qrsDuration',
  'QRS Width': 'qrsDuration',
  'BBB': 'bbb',
  'Bundle Branch Block': 'bbb',
  'QTc': 'qtcInterval',
  'QTc Interval': 'qtcInterval',
  'Corrected QT': 'qtcInterval',
  'Anticoagulant Therapy': 'anticoagulation',
  'Anticoagulation': 'anticoagulation',
  'Antiarrhythmic Therapy': 'antiarrhythmic',
  'Antiarrhythmic': 'antiarrhythmic',
}

// ─────────────────────────────────────────────────────────────────────────────
// autoMapColumns
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fuzzy-maps an array of import column headers to Cardio-Konnect field names.
 *
 * Strategy (in order of priority):
 *   1. Exact match in FIELD_MAP
 *   2. Case-insensitive exact match in FIELD_MAP
 *   3. Case-insensitive exact match against Cardio-Konnect field names directly
 *   4. FIELD_MAP key is a substring of the header (or vice-versa), case-insensitive
 *
 * Returns a Record<importHeader, cardioFieldName>. Unmapped headers are omitted.
 */
export function autoMapColumns(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {}

  // Pre-build a lower-case index of FIELD_MAP for faster lookups
  const lowerFieldMap: Record<string, string> = {}
  for (const [alias, field] of Object.entries(FIELD_MAP)) {
    lowerFieldMap[alias.toLowerCase()] = field
  }

  // All known Cardio-Konnect field names (lower-cased) for direct matching
  const cardioFields = new Set(Object.values(FIELD_MAP))
  const lowerCardioFields: Record<string, string> = {}
  for (const f of Array.from(cardioFields)) {
    lowerCardioFields[f.toLowerCase()] = f
  }

  for (const header of headers) {
    const trimmed = header.trim()
    const lower = trimmed.toLowerCase()

    // 1. Exact match
    if (FIELD_MAP[trimmed]) {
      mapping[header] = FIELD_MAP[trimmed]
      continue
    }

    // 2. Case-insensitive match in FIELD_MAP
    if (lowerFieldMap[lower]) {
      mapping[header] = lowerFieldMap[lower]
      continue
    }

    // 3. Case-insensitive match against Cardio-Konnect field names directly
    if (lowerCardioFields[lower]) {
      mapping[header] = lowerCardioFields[lower]
      continue
    }

    // 4. Substring matching (FIELD_MAP key contains header or header contains key)
    let bestMatch: string | null = null
    let bestMatchLen = 0
    for (const [alias, field] of Object.entries(FIELD_MAP)) {
      const aliasLower = alias.toLowerCase()
      if (aliasLower.includes(lower) || lower.includes(aliasLower)) {
        // Prefer the longest alias match (more specific)
        if (alias.length > bestMatchLen) {
          bestMatch = field
          bestMatchLen = alias.length
        }
      }
    }
    if (bestMatch) {
      mapping[header] = bestMatch
    }
  }

  return mapping
}

// ─────────────────────────────────────────────────────────────────────────────
// validateImportRow
// ─────────────────────────────────────────────────────────────────────────────

/** Clinical range definitions for numeric fields. */
const FIELD_RANGES: Record<
  string,
  { min?: number; max?: number; unit?: string; warnMin?: number; warnMax?: number }
> = {
  lvef: { min: 1, max: 100, unit: '%', warnMin: 10, warnMax: 80 },
  bpSystolic: { min: 50, max: 300, unit: 'mmHg', warnMin: 70, warnMax: 220 },
  bpDiastolic: { min: 20, max: 200, unit: 'mmHg', warnMin: 40, warnMax: 130 },
  heartRate: { min: 20, max: 350, unit: 'bpm', warnMin: 30, warnMax: 200 },
  weight: { min: 1, max: 500, unit: 'kg', warnMin: 20, warnMax: 350 },
  height: { min: 50, max: 280, unit: 'cm', warnMin: 100, warnMax: 230 },
  o2Sat: { min: 50, max: 100, unit: '%', warnMin: 70, warnMax: 100 },
  ntProBNP: { min: 0, max: 500000, unit: 'pg/mL' },
  bnp: { min: 0, max: 50000, unit: 'pg/mL' },
  egfr: { min: 0, max: 200, unit: 'ml/min/1.73m²' },
  creatinine: { min: 0, max: 50, unit: 'mg/dL', warnMax: 20 },
  potassium: { min: 1, max: 10, unit: 'mmol/L', warnMin: 2.5, warnMax: 7 },
  sodium: { min: 100, max: 180, unit: 'mmol/L', warnMin: 120, warnMax: 160 },
  hb: { min: 1, max: 25, unit: 'g/dL', warnMin: 5, warnMax: 22 },
  hba1c: { min: 1, max: 20, unit: '%' },
  ferritin: { min: 0, max: 20000, unit: 'µg/L' },
  transferrinSat: { min: 0, max: 100, unit: '%' },
  ldl: { min: 0, max: 20, unit: 'mg/dL' },
  triglycerides: { min: 0, max: 100, unit: 'mg/dL' },
  lvdd: { min: 10, max: 120, unit: 'mm' },
  lvsd: { min: 5, max: 100, unit: 'mm' },
  rvsp: { min: 10, max: 150, unit: 'mmHg' },
  qrsDuration: { min: 40, max: 400, unit: 'ms' },
  qtcInterval: { min: 200, max: 700, unit: 'ms', warnMax: 500 },
  sixMWT: { min: 0, max: 2000, unit: 'metres' },
}

const VALID_NYHA = new Set(['I', 'II', 'III', 'IV'])
const VALID_HF_TYPE = new Set(['HFrEF', 'HFmrEF', 'HFpEF'])
const VALID_RHYTHM = new Set(['Sinus', 'AF', 'Atrial Flutter', 'VT', 'Not Known', 'Other'])
const VALID_PRESCRIBED = new Set(['Yes', 'No', ''])
const VALID_SEX = new Set(['Male', 'Female', 'Other'])

export interface RowValidationResult {
  valid: boolean
  warnings: string[]
  errors: string[]
}

/**
 * Validates a single import row against clinical and structural rules.
 *
 * @param row       The raw import row (keyed by import column names).
 * @param fieldMap  A mapping from import column names to Cardio-Konnect field names
 *                  (as returned by autoMapColumns).
 */
export function validateImportRow(
  row: object,
  fieldMap: Record<string, string>
): RowValidationResult {
  const warnings: string[] = []
  const errors: string[] = []

  // Build a canonical field → value map using fieldMap
  const mapped: Record<string, unknown> = {}
  for (const [importCol, cardioField] of Object.entries(fieldMap)) {
    const value = (row as unknown as Record<string, unknown>)[importCol]
    if (value !== undefined && value !== '') {
      mapped[cardioField] = value
    }
  }

  // Required fields check
  const requiredFields: string[] = ['patientId', 'visitDate']
  for (const field of requiredFields) {
    if (!mapped[field] && !mapped['id']) {
      // patientId is required for Visit imports; id for Patient imports
      // We check both here as the import may be either type
      if (field === 'patientId' && !mapped['id']) {
        // Only error if neither patient identifier is present
        if (!Object.values(mapped).some(v => v)) continue // empty row, skip
        warnings.push(`Missing "${field}" — row may not link to a patient correctly.`)
      } else if (field === 'visitDate') {
        // visitDate only required if this looks like a visit row
        if (mapped['lvef'] !== undefined || mapped['nyha'] !== undefined) {
          warnings.push(`Missing "visitDate" — visit rows should have a date.`)
        }
      }
    }
  }

  // Date format validation
  for (const dateField of ['visitDate', 'dob', 'echoDate', 'followupDate']) {
    const val = mapped[dateField]
    if (val && typeof val === 'string') {
      const d = new Date(val)
      if (isNaN(d.getTime())) {
        errors.push(`"${dateField}": invalid date format "${val}". Expected YYYY-MM-DD.`)
      } else if (d > new Date()) {
        if (dateField === 'dob') {
          errors.push(`"${dateField}": date of birth cannot be in the future.`)
        } else if (dateField === 'visitDate') {
          warnings.push(`"visitDate": visit date ${val} is in the future.`)
        }
      }
    }
  }

  // Numeric range validation
  for (const [field, range] of Object.entries(FIELD_RANGES)) {
    const raw = mapped[field]
    if (raw === undefined || raw === '') continue
    const num = typeof raw === 'number' ? raw : parseFloat(String(raw))
    if (isNaN(num)) {
      errors.push(`"${field}": expected a number, got "${raw}".`)
      continue
    }
    if (range.min !== undefined && num < range.min) {
      errors.push(`"${field}": value ${num} is below the minimum allowed (${range.min} ${range.unit ?? ''}).`)
    }
    if (range.max !== undefined && num > range.max) {
      errors.push(`"${field}": value ${num} exceeds the maximum allowed (${range.max} ${range.unit ?? ''}).`)
    }
    if (range.warnMin !== undefined && num < range.warnMin) {
      warnings.push(`"${field}": value ${num} ${range.unit ?? ''} is unusually low — please verify.`)
    }
    if (range.warnMax !== undefined && num > range.warnMax) {
      warnings.push(`"${field}": value ${num} ${range.unit ?? ''} is unusually high — please verify.`)
    }
  }

  // Enum validations
  if (mapped['nyha'] && !VALID_NYHA.has(String(mapped['nyha']))) {
    errors.push(`"nyha": "${mapped['nyha']}" is not valid. Expected one of: ${Array.from(VALID_NYHA).join(', ')}.`)
  }
  if (mapped['hfType'] && !VALID_HF_TYPE.has(String(mapped['hfType']))) {
    errors.push(`"hfType": "${mapped['hfType']}" is not valid. Expected one of: ${Array.from(VALID_HF_TYPE).join(', ')}.`)
  }
  if (mapped['rhythm'] && !VALID_RHYTHM.has(String(mapped['rhythm']))) {
    warnings.push(`"rhythm": "${mapped['rhythm']}" is not a recognised rhythm value.`)
  }
  if (mapped['sex'] && !VALID_SEX.has(String(mapped['sex']))) {
    errors.push(`"sex": "${mapped['sex']}" is not valid. Expected one of: ${Array.from(VALID_SEX).join(', ')}.`)
  }

  // Prescribed field validations
  const prescribedFields = [
    'diuretic.prescribed', 'raasi.prescribed', 'betaBlocker.prescribed',
    'digoxin.prescribed', 'sglt2i.prescribed', 'ivabradine.prescribed',
    'mra.prescribed', 'aspirin.prescribed', 'statin.prescribed',
    'ivIron.prescribed', 'noac.prescribed', 'vki.prescribed',
  ]
  for (const f of prescribedFields) {
    if (mapped[f] !== undefined && !VALID_PRESCRIBED.has(String(mapped[f]))) {
      warnings.push(`"${f}": "${mapped[f]}" — expected "Yes", "No", or empty.`)
    }
  }

  // Cross-field consistency checks
  const lvef = mapped['lvef'] !== undefined ? parseFloat(String(mapped['lvef'])) : null
  const hfType = mapped['hfType'] ? String(mapped['hfType']) : null
  if (lvef !== null && hfType) {
    if (hfType === 'HFrEF' && lvef >= 50) {
      warnings.push(`HFrEF classification with LVEF ${lvef}% — HFrEF is typically LVEF < 40%.`)
    } else if (hfType === 'HFpEF' && lvef < 50) {
      warnings.push(`HFpEF classification with LVEF ${lvef}% — HFpEF is typically LVEF ≥ 50%.`)
    } else if (hfType === 'HFmrEF' && (lvef < 40 || lvef >= 50)) {
      warnings.push(`HFmrEF classification with LVEF ${lvef}% — HFmrEF is typically LVEF 40–49%.`)
    }
  }

  const bpSys = mapped['bpSystolic'] !== undefined ? parseFloat(String(mapped['bpSystolic'])) : null
  const bpDia = mapped['bpDiastolic'] !== undefined ? parseFloat(String(mapped['bpDiastolic'])) : null
  if (bpSys !== null && bpDia !== null && !isNaN(bpSys) && !isNaN(bpDia)) {
    if (bpDia >= bpSys) {
      errors.push(`Blood pressure: diastolic (${bpDia}) must be less than systolic (${bpSys}).`)
    }
  }

  return {
    valid: errors.length === 0,
    warnings,
    errors,
  }
}
