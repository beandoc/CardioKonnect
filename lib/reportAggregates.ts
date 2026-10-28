/**
 * lib/reportAggregates.ts
 *
 * Live chart data for the reports page, computed from the registry records the
 * user can see. Every value comes from recorded fields; nothing is defaulted.
 * Reports whose data the registry does not capture return null so the page can
 * say so instead of drawing a chart.
 */

import type { Patient, Visit, CathProcedure } from './types'
import { REGISTRY_CONFIG } from './appConfig'
import { complicationFlags } from './complications'
import { isStemiProcedure, procedureDtbMin } from './interventionalMetrics'
import { getAge } from './utils'

export interface ReportSource {
  patients: Patient[]
  latestVisits: Map<string, Visit>
  procedures: CathProcedure[]
}

export interface LiveReport {
  chartData: any[]
  summary: string
}

type Builder = (src: ReportSource) => LiveReport

const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 1000) / 10 : 0)

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2)
}

function mean(values: number[]): number | null {
  return values.length ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10 : null
}

function patientAge(p: Patient): number | null {
  return (p.dob ? getAge(p.dob) : null) ?? p.age ?? null
}

function patientLvef(p: Patient, latest?: Visit): number | null {
  return latest?.lvef ?? p.lvef ?? null
}

function inRegistry(p: Patient, id: string): boolean {
  return p.registryId === id || Boolean(p.registryIds?.includes(id))
}

function procMonth(p: CathProcedure): string | null {
  const raw = p.procedureDate || p.procedureDateTime
  if (!raw) return null
  const d = new Date(raw)
  return isNaN(d.getTime()) ? null : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleString('en-US', { month: 'short', year: '2-digit' })
}

/** Groups procedures by calendar month, oldest first, keeping the last `max` months that have data. */
function byMonth(procs: CathProcedure[], max = 6): Array<[string, CathProcedure[]]> {
  const groups = new Map<string, CathProcedure[]>()
  for (const p of procs) {
    const key = procMonth(p)
    if (!key) continue
    const list = groups.get(key) || []
    list.push(p)
    groups.set(key, list)
  }
  return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b)).slice(-max)
}

const BUILDERS: Record<string, Builder> = {
  'Demographic Distribution': ({ patients }) => {
    const bands = [
      { name: '<40 yrs', test: (a: number) => a < 40 },
      { name: '40–49 yrs', test: (a: number) => a >= 40 && a < 50 },
      { name: '50–59 yrs', test: (a: number) => a >= 50 && a < 60 },
      { name: '60–69 yrs', test: (a: number) => a >= 60 && a < 70 },
      { name: '≥70 yrs', test: (a: number) => a >= 70 },
    ]
    const ages = patients.map(patientAge).filter((a): a is number => a !== null)
    const chartData = bands.map(b => ({ name: b.name, Patients: ages.filter(b.test).length }))
    const top = [...chartData].sort((a, b) => b.Patients - a.Patients)[0]
    return {
      chartData,
      summary: `Age distribution of ${ages.length} patients with a recorded age${ages.length < patients.length ? ` (${patients.length - ages.length} without DOB or age)` : ''}.${ages.length ? ` Largest band: ${top.name} (${top.Patients}).` : ''}`,
    }
  },

  'Disease Category Distribution': ({ patients }) => {
    const chartData = Object.values(REGISTRY_CONFIG)
      .map(r => ({ name: r.shortName, value: patients.filter(p => inRegistry(p, r.id)).length }))
      .filter(d => d.value > 0)
    return {
      chartData,
      summary: `Registry enrolment across ${patients.length} accessible patients. A patient enrolled in more than one registry is counted in each.`,
    }
  },

  'HF Population Cohorts': ({ patients, latestVisits }) => {
    const efs = patients
      .filter(p => inRegistry(p, 'hf'))
      .map(p => patientLvef(p, latestVisits.get(p.id)))
      .filter((v): v is number => v !== null)
    const chartData = [
      { name: 'HFrEF', value: efs.filter(e => e < 40).length },
      { name: 'HFmrEF', value: efs.filter(e => e >= 40 && e < 50).length },
      { name: 'HFpEF', value: efs.filter(e => e >= 50).length },
    ].filter(d => d.value > 0)
    return {
      chartData,
      summary: `LVEF phenotype of ${efs.length} HF registry patients with a recorded LVEF (HFrEF <40%, HFmrEF 40–49%, HFpEF ≥50%).`,
    }
  },

  'Guideline-Directed Medical Therapy (GDMT)': ({ patients, latestVisits }) => {
    const visits = patients
      .filter(p => inRegistry(p, 'hf'))
      .map(p => latestVisits.get(p.id))
      .filter((v): v is Visit => Boolean(v))
    const pillars: Array<{ label: string; key: 'betaBlocker' | 'raasi' | 'sglt2i' | 'mra' }> = [
      { label: 'Beta-Blocker', key: 'betaBlocker' },
      { label: 'RAASi', key: 'raasi' },
      { label: 'SGLT2i', key: 'sglt2i' },
      { label: 'MRA', key: 'mra' },
    ]
    const chartData = pillars.map(({ label, key }) => {
      const recorded = visits.filter(v => v[key]?.prescribed === 'Yes' || v[key]?.prescribed === 'No')
      const yes = recorded.filter(v => v[key]?.prescribed === 'Yes').length
      return { class: label, Compliance: pct(yes, recorded.length), n: recorded.length }
    })
    return {
      chartData: chartData.map(({ class: c, Compliance }) => ({ class: c, Compliance })),
      summary: `Prescribing rate per pillar at each HF patient's latest visit, among visits where the pillar was recorded (n = ${chartData.map(d => `${d.class} ${d.n}`).join(', ')}).`,
    }
  },

  'Angiography Distribution Patterns': ({ procedures }) => {
    const withLesions = procedures.filter(p => Array.isArray(p.lesions) && p.lesions.length > 0)
    const has = (vessel: string) => withLesions.filter(p => p.lesions.some(l => l.vessel === vessel)).length
    const chartData = [
      { vessel: 'LAD Involvement', Prevalence: pct(has('LAD'), withLesions.length) },
      { vessel: 'RCA Involvement', Prevalence: pct(has('RCA'), withLesions.length) },
      { vessel: 'LCx Involvement', Prevalence: pct(has('LCx'), withLesions.length) },
      { vessel: 'Left Main Disease', Prevalence: pct(has('LM'), withLesions.length) },
    ]
    return {
      chartData: withLesions.length ? chartData : [],
      summary: `Share of the ${withLesions.length} procedures with recorded lesions that involved each vessel.`,
    }
  },

  'STEMI Quality Metrics': ({ procedures }) => {
    const stemi = procedures.filter(isStemiProcedure)
    const chartData = byMonth(stemi)
      .map(([key, procs]) => ({
        month: monthLabel(key),
        'Median D2B': median(procs.map(procedureDtbMin).filter((d): d is number => d !== null)),
        Target: 90,
      }))
      .filter(d => d['Median D2B'] !== null)
    const all = stemi.map(procedureDtbMin).filter((d): d is number => d !== null)
    const met = all.filter(d => d <= 90).length
    return {
      chartData,
      summary: all.length
        ? `Monthly median door-to-balloon time for ${all.length} STEMI procedures with recorded timestamps. ${met}/${all.length} (${pct(met, all.length)}%) met the ≤90 min target.`
        : 'No STEMI procedures with both arrival and device/access timestamps recorded.',
    }
  },

  'Outcomes & MACE Records': ({ procedures }) => {
    const n = procedures.length
    const complications = procedures.filter(p => complicationFlags(p).hasComplication).length
    const deaths = procedures.filter(p => {
      const f = complicationFlags(p)
      return f.inLabDeath || f.inHospitalDeath || p.dischargeStatus === 'In-Hospital Mortality'
    }).length
    return {
      chartData: n ? [{ period: 'In-Hospital', 'Any complication (%)': pct(complications, n), 'Death (%)': pct(deaths, n) }] : [],
      summary: `In-hospital outcomes across ${n} procedures: ${complications} with a recorded complication, ${deaths} deaths. The registry does not record post-discharge follow-up, so 30- and 90-day rates are not shown.`,
    }
  },

  'Safety, Contrast & Radiation Logs': ({ procedures }) => {
    const chartData = byMonth(procedures).map(([key, procs]) => {
      const dap = procs.map(p => p.dapGyCm2 ?? p.doseAreaProductGyCm2).filter((v): v is number => typeof v === 'number' && v > 0)
      return {
        month: monthLabel(key),
        'CIN Rate (%)': pct(procs.filter(p => complicationFlags(p).contrastInducedAki).length, procs.length),
        'Mean DAP (Gy.cm²)': mean(dap) ?? 0,
      }
    })
    return {
      chartData,
      summary: `Monthly contrast-induced AKI rate and mean dose-area product across ${procedures.length} procedures. Mean DAP uses only procedures with a recorded DAP.`,
    }
  },
}

/** Live chart data for a report, or null when the registry captures no data for it. */
export function buildLiveReport(title: string, src: ReportSource): LiveReport | null {
  const build = BUILDERS[title]
  return build ? build(src) : null
}
