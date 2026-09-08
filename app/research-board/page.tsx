'use client'
import { useState, useMemo, useEffect, useCallback } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend, Cell, ReferenceLine, LineChart, Line, ScatterChart, Scatter,
} from 'recharts'
import {
  FlaskConical, RefreshCw, AlertTriangle, TrendingUp, CheckCircle,
  BarChart3, Database, Activity, Info, ChevronDown, ChevronUp,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { getPatients, getAllLatestVisits } from '@/lib/firestore'
import type { Patient, Visit } from '@/lib/types'
import {
  mean, std, median, iqr, percentile,
  tTest, chiSquareTest, mannWhitneyTest, spearmanR, correlationCoefficient, wilsonCI,
} from '@/lib/statistics'
import { getAge } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'table1' | 'charts' | 'gdmt' | 'correlations' | 'quality'

interface Row { patient: Patient; visit: Visit }

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isPrescribed(me: unknown) {
  return (me as { prescribed?: string })?.prescribed === 'Yes'
}

function fmtMean(m: number | null, s: number | null) {
  if (m === null) return '—'
  return s !== null ? `${m.toFixed(1)} ± ${s.toFixed(1)}` : m.toFixed(1)
}

function fmtMedian(med: number | null, q1: number | null, q3: number | null) {
  if (med === null) return '—'
  return (q1 !== null && q3 !== null)
    ? `${med.toFixed(0)} [${q1.toFixed(0)}–${q3.toFixed(0)}]`
    : med.toFixed(0)
}

function fmtPct(k: number, n: number) {
  if (n === 0) return '—'
  const p = (k / n * 100).toFixed(1)
  const [lo, hi] = wilsonCI(k, n)
  return `${k} (${p}%)`
}

function pFmt(p: number) {
  if (isNaN(p)) return '—'
  if (p < 0.001) return '<0.001'
  if (p < 0.01) return p.toFixed(3)
  return p.toFixed(3)
}

function pColor(p: number) {
  if (isNaN(p)) return 'text-gray-500'
  if (p < 0.001) return 'text-rose-400 font-bold'
  if (p < 0.05) return 'text-amber-400 font-semibold'
  return 'text-gray-400'
}

// ─── Sub-components ──────────────────────────────────────────────────────────

const DarkTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-gray-900 border border-blue-500/20 rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="font-semibold text-white mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>{p.name}: <span className="text-white font-semibold">{
          typeof p.value === 'number' ? p.value.toFixed(1) : p.value
        }</span></p>
      ))}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ResearchBoardPage() {
  const [activeTab, setActiveTab] = useState<Tab>('table1')
  const [patients, setPatients] = useState<Patient[]>([])
  const [visitMap, setVisitMap] = useState<Map<string, Visit>>(new Map())
  const [loading, setLoading] = useState(true)
  const [expandedSection, setExpandedSection] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([getPatients(), getAllLatestVisits()])
      .then(([pts, vmap]) => { setPatients(pts); setVisitMap(vmap) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  // ── Core dataset ──────────────────────────────────────────────────────────

  const rows = useMemo<Row[]>(() =>
    patients
      .map(p => ({ patient: p, visit: visitMap.get(p.id) ?? null }))
      .filter((r): r is Row => r.visit !== null),
    [patients, visitMap]
  )

  const byType = useMemo(() => ({
    all:     rows,
    HFrEF:   rows.filter(r => r.visit.hfType === 'HFrEF'),
    HFmrEF:  rows.filter(r => r.visit.hfType === 'HFmrEF'),
    HFpEF:   rows.filter(r => r.visit.hfType === 'HFpEF'),
    HFimpEF: rows.filter(r => r.visit.hfType === 'HFimpEF'),
  }), [rows])

  // ── Table 1 computations ──────────────────────────────────────────────────

  interface GroupStats {
    n: number
    ageMean: number | null; ageSD: number | null
    pctMale: string
    lvefMean: number | null; lvefSD: number | null
    hrMean: number | null; hrSD: number | null
    sbpMean: number | null; sbpSD: number | null
    ntpMedian: number | null; ntpQ1: number | null; ntpQ3: number | null
    egfrMean: number | null; egfrSD: number | null
    creMean: number | null; creSD: number | null
    hbMean: number | null; hbSD: number | null
    natrMean: number | null; natrSD: number | null
    potMean: number | null; potSD: number | null
    qrsMean: number | null; qrsSD: number | null
    sixtMean: number | null; sixtSD: number | null
    // Categorical
    nyha1N: number; nyha2N: number; nyha3N: number; nyha4N: number
    htnN: number; dmN: number; ckdN: number; afN: number; ironN: number; dysN: number
    hospN: number
    raasiN: number; betaN: number; mraN: number; sglt2N: number; quadN: number
    hfNforGDMT: number  // denominator for GDMT (only HFrEF rows in HFrEF group)
  }

  function computeGroupStats(gr: Row[]): GroupStats {
    const n = gr.length
    const vals = (key: keyof Visit) => gr.map(r => r.visit[key] as number).filter(v => v != null && !isNaN(v))
    const ages = gr.map(r => getAge(r.patient.dob)).filter((a): a is number => a != null)
    const ntp = vals('ntProBNP')
    const ntpSorted = [...ntp].sort((a, b) => a - b)
    const lvef  = vals('lvef')
    const hr    = vals('heartRate')
    const sbp   = vals('bpSystolic')
    const egfr  = vals('egfr')
    const cre   = vals('creatinine')
    const hb    = vals('hb')
    const na    = vals('sodium')
    const pot   = vals('potassium')
    const qrs   = vals('qrsDuration')
    const sixt  = vals('sixMWT')
    // GDMT denom = HFrEF rows within this group
    const hfRows = gr.filter(r => r.visit.hfType === 'HFrEF')
    const hfN = hfRows.length
    return {
      n,
      ageMean: mean(ages), ageSD: std(ages),
      pctMale: fmtPct(gr.filter(r => r.patient.sex === 'Male').length, n),
      lvefMean: mean(lvef), lvefSD: std(lvef),
      hrMean: mean(hr), hrSD: std(hr),
      sbpMean: mean(sbp), sbpSD: std(sbp),
      ntpMedian: median(ntpSorted), ntpQ1: percentile(ntpSorted, 25), ntpQ3: percentile(ntpSorted, 75),
      egfrMean: mean(egfr), egfrSD: std(egfr),
      creMean: mean(cre), creSD: std(cre),
      hbMean: mean(hb), hbSD: std(hb),
      natrMean: mean(na), natrSD: std(na),
      potMean: mean(pot), potSD: std(pot),
      qrsMean: mean(qrs), qrsSD: std(qrs),
      sixtMean: mean(sixt), sixtSD: std(sixt),
      nyha1N: gr.filter(r => r.visit.nyha === 'I').length,
      nyha2N: gr.filter(r => r.visit.nyha === 'II').length,
      nyha3N: gr.filter(r => r.visit.nyha === 'III').length,
      nyha4N: gr.filter(r => r.visit.nyha === 'IV').length,
      htnN:  gr.filter(r => r.patient.comorbidHypertension).length,
      dmN:   gr.filter(r => r.patient.comorbidDiabetes).length,
      ckdN:  gr.filter(r => r.patient.comorbidCKD).length,
      afN:   gr.filter(r => r.patient.comorbidAF).length,
      ironN: gr.filter(r => r.patient.comorbidIronDeficiency).length,
      dysN:  gr.filter(r => r.patient.comorbidDyslipidemia).length,
      hospN: gr.filter(r => r.visit.hospHistory === 'Yes').length,
      raasiN: hfRows.filter(r => isPrescribed(r.visit.raasi)).length,
      betaN:  hfRows.filter(r => isPrescribed(r.visit.betaBlocker)).length,
      mraN:   hfRows.filter(r => isPrescribed(r.visit.mra)).length,
      sglt2N: hfRows.filter(r => isPrescribed(r.visit.sglt2i)).length,
      quadN:  hfRows.filter(r => isPrescribed(r.visit.raasi) && isPrescribed(r.visit.betaBlocker) && isPrescribed(r.visit.mra) && isPrescribed(r.visit.sglt2i)).length,
      hfNforGDMT: hfN,
    }
  }

  const gs = useMemo(() => ({
    all:    computeGroupStats(byType.all),
    hfref:  computeGroupStats(byType.HFrEF),
    hfmref: computeGroupStats(byType.HFmrEF),
    hfpef:  computeGroupStats(byType.HFpEF),
  }), [byType])

  // p-values: HFrEF vs HFpEF (most clinically relevant comparison)
  const pVals = useMemo(() => {
    const vA = (key: keyof Visit) => byType.HFrEF.map(r => r.visit[key] as number).filter(v => v != null && !isNaN(v))
    const vB = (key: keyof Visit) => byType.HFpEF.map(r => r.visit[key] as number).filter(v => v != null && !isNaN(v))
    const chiCat = (nA: number, nB: number, dnA: number, dnB: number) => {
      if (dnA < 2 || dnB < 2) return NaN
      return chiSquareTest([[nA, dnA - nA], [nB, dnB - nB]]).pValue
    }
    const mw = (key: keyof Visit) => mannWhitneyTest(vA(key), vB(key)).pValue
    const tt = (key: keyof Visit) => tTest(vA(key), vB(key)).pValue
    const ageA = byType.HFrEF.map(r => getAge(r.patient.dob)).filter((a): a is number => a != null)
    const ageB = byType.HFpEF.map(r => getAge(r.patient.dob)).filter((a): a is number => a != null)
    return {
      age: tTest(ageA, ageB).pValue,
      lvef: tt('lvef'),
      hr: tt('heartRate'),
      sbp: tt('bpSystolic'),
      ntp: mw('ntProBNP'),
      egfr: tt('egfr'),
      cre: tt('creatinine'),
      hb: tt('hb'),
      na: tt('sodium'),
      pot: tt('potassium'),
      qrs: tt('qrsDuration'),
      sixt: mw('sixMWT'),
      htn: chiCat(byType.HFrEF.filter(r => r.patient.comorbidHypertension).length, byType.HFpEF.filter(r => r.patient.comorbidHypertension).length, byType.HFrEF.length, byType.HFpEF.length),
      dm:  chiCat(byType.HFrEF.filter(r => r.patient.comorbidDiabetes).length, byType.HFpEF.filter(r => r.patient.comorbidDiabetes).length, byType.HFrEF.length, byType.HFpEF.length),
      ckd: chiCat(byType.HFrEF.filter(r => r.patient.comorbidCKD).length, byType.HFpEF.filter(r => r.patient.comorbidCKD).length, byType.HFrEF.length, byType.HFpEF.length),
      af:  chiCat(byType.HFrEF.filter(r => r.patient.comorbidAF).length, byType.HFpEF.filter(r => r.patient.comorbidAF).length, byType.HFrEF.length, byType.HFpEF.length),
    }
  }, [byType])

  // ── Chart data ────────────────────────────────────────────────────────────

  const lvefHistData = useMemo(() => {
    const bins = [
      { label: '<20%', lo: 0, hi: 20 }, { label: '20–29%', lo: 20, hi: 30 },
      { label: '30–39%', lo: 30, hi: 40 }, { label: '40–49%', lo: 40, hi: 50 },
      { label: '50–59%', lo: 50, hi: 60 }, { label: '≥60%', lo: 60, hi: 100 },
    ]
    return bins.map(b => ({
      range: b.label,
      HFrEF:   byType.HFrEF.filter(r => r.visit.lvef != null && r.visit.lvef! >= b.lo && r.visit.lvef! < b.hi).length,
      HFmrEF:  byType.HFmrEF.filter(r => r.visit.lvef != null && r.visit.lvef! >= b.lo && r.visit.lvef! < b.hi).length,
      HFpEF:   byType.HFpEF.filter(r => r.visit.lvef != null && r.visit.lvef! >= b.lo && r.visit.lvef! < b.hi).length,
      HFimpEF: byType.HFimpEF.filter(r => r.visit.lvef != null && r.visit.lvef! >= b.lo && r.visit.lvef! < b.hi).length,
    }))
  }, [byType])

  const ntpByNYHA = useMemo(() => {
    return ['I', 'II', 'III', 'IV'].map(cls => {
      const gr = rows.filter(r => r.visit.nyha === cls && r.visit.ntProBNP != null)
      const vals = gr.map(r => r.visit.ntProBNP!)
      const med = median(vals)
      const q1 = percentile(vals, 25)
      const q3 = percentile(vals, 75)
      return {
        nyha: `NYHA ${cls}`,
        n: gr.length,
        median: med != null ? Math.round(med) : 0,
        q1: q1 != null ? Math.round(q1) : 0,
        q3: q3 != null ? Math.round(q3) : 0,
        iqr: (q1 != null && q3 != null) ? Math.round(q3 - q1) : 0,
      }
    })
  }, [rows])

  const comorbidityRanked = useMemo(() => {
    const n = patients.length
    if (n === 0) return []
    return [
      { name: 'Hypertension', count: patients.filter(p => p.comorbidHypertension).length },
      { name: 'Diabetes', count: patients.filter(p => p.comorbidDiabetes).length },
      { name: 'Dyslipidaemia', count: patients.filter(p => p.comorbidDyslipidemia).length },
      { name: 'CKD', count: patients.filter(p => p.comorbidCKD).length },
      { name: 'AF', count: patients.filter(p => p.comorbidAF).length },
      { name: 'Iron Deficiency', count: patients.filter(p => p.comorbidIronDeficiency).length },
      { name: 'Prior CAD', count: patients.filter(p => p.comorbidCAD).length },
      { name: 'Prior MI', count: patients.filter(p => p.comorbidPriorMI).length },
      { name: 'Stroke/TIA', count: patients.filter(p => p.comorbidStrokeTIA).length },
      { name: 'COPD', count: patients.filter(p => p.comorbidCOPD).length },
    ]
      .map(x => ({ ...x, pct: n > 0 ? +(x.count / n * 100).toFixed(1) : 0 }))
      .sort((a, b) => b.count - a.count)
      .filter(x => x.count > 0)
  }, [patients])

  const eGFRbyType = useMemo(() => {
    return ['HFrEF', 'HFmrEF', 'HFpEF', 'HFimpEF'].map(t => {
      const gr = rows.filter(r => r.visit.hfType === t && r.visit.egfr != null)
      const vals = gr.map(r => r.visit.egfr!)
      return {
        type: t, n: gr.length,
        mean: mean(vals) != null ? +mean(vals)!.toFixed(1) : 0,
        sd: std(vals) != null ? +std(vals)!.toFixed(1) : 0,
        median: median(vals) != null ? +median(vals)!.toFixed(1) : 0,
      }
    }).filter(x => x.n > 0)
  }, [rows])

  // ── Correlation data ──────────────────────────────────────────────────────

  const correlationPairs = useMemo(() => {
    const pairs = [
      { x: 'NT-proBNP', y: 'LVEF',       xKey: 'ntProBNP' as keyof Visit, yKey: 'lvef' as keyof Visit },
      { x: 'NT-proBNP', y: 'eGFR',        xKey: 'ntProBNP' as keyof Visit, yKey: 'egfr' as keyof Visit },
      { x: 'eGFR',      y: 'LVEF',        xKey: 'egfr' as keyof Visit,     yKey: 'lvef' as keyof Visit },
      { x: 'LVEF',      y: '6MWT (m)',    xKey: 'lvef' as keyof Visit,     yKey: 'sixMWT' as keyof Visit },
      { x: 'Sodium',    y: 'LVEF',        xKey: 'sodium' as keyof Visit,    yKey: 'lvef' as keyof Visit },
      { x: 'RVSP',      y: 'NT-proBNP',  xKey: 'rvsp' as keyof Visit,     yKey: 'ntProBNP' as keyof Visit },
      { x: 'Haemoglobin', y: 'LVEF',     xKey: 'hb' as keyof Visit,       yKey: 'lvef' as keyof Visit },
      { x: 'QRS (ms)',  y: 'LVEF',        xKey: 'qrsDuration' as keyof Visit, yKey: 'lvef' as keyof Visit },
    ]
    return pairs.map(p => {
      const xs = rows.map(r => r.visit[p.xKey] as number).filter(v => v != null && !isNaN(v))
      const ys_aligned: number[] = []
      const xs_aligned: number[] = []
      for (const r of rows) {
        const xv = r.visit[p.xKey] as number
        const yv = r.visit[p.yKey] as number
        if (xv != null && !isNaN(xv) && yv != null && !isNaN(yv)) {
          xs_aligned.push(xv)
          ys_aligned.push(yv)
        }
      }
      const rho = spearmanR(xs_aligned, ys_aligned)
      const n = xs_aligned.length
      const tStat = !isNaN(rho) && n > 2 ? rho * Math.sqrt(n - 2) / Math.sqrt(1 - rho * rho) : NaN
      // Approximate p-value using t-distribution (df = n-2)
      const pApprox = !isNaN(tStat) ? 2 * (1 - normalCDFApprox(Math.abs(tStat))) : NaN
      return { ...p, rho: isNaN(rho) ? null : +rho.toFixed(3), n, p: pApprox }
    })
  }, [rows])

  // ── Data quality ──────────────────────────────────────────────────────────

  const completenessData = useMemo(() => {
    const visits = rows.map(r => r.visit)
    const KEY_FIELDS: { key: keyof Visit; label: string }[] = [
      { key: 'lvef', label: 'LVEF' },
      { key: 'ntProBNP', label: 'NT-proBNP' },
      { key: 'egfr', label: 'eGFR' },
      { key: 'creatinine', label: 'Creatinine' },
      { key: 'hb', label: 'Haemoglobin' },
      { key: 'sodium', label: 'Sodium' },
      { key: 'potassium', label: 'Potassium' },
      { key: 'bpSystolic', label: 'Systolic BP' },
      { key: 'heartRate', label: 'Heart Rate' },
      { key: 'nyha', label: 'NYHA Class' },
      { key: 'hfType', label: 'HF Type' },
      { key: 'rhythm', label: 'ECG Rhythm' },
      { key: 'qrsDuration', label: 'QRS Duration' },
      { key: 'sixMWT', label: '6-Minute Walk' },
      { key: 'ferritin', label: 'Ferritin' },
      { key: 'transferrinSat', label: 'Transferrin Sat.' },
      { key: 'ldl', label: 'LDL' },
      { key: 'hba1c', label: 'HbA1c' },
      { key: 'rvsp', label: 'RVSP' },
      { key: 'eEPrime', label: "E/E'" },
    ]
    if (visits.length === 0) return []
    return KEY_FIELDS.map(f => {
      const present = visits.filter(v => {
        const val = v[f.key]
        return val !== null && val !== undefined && val !== ''
      }).length
      const pct = +(present / visits.length * 100).toFixed(1)
      return { field: f.label, pct, present, total: visits.length }
    }).sort((a, b) => b.pct - a.pct)
  }, [rows])

  const GDMT_BY_NYHA = useMemo(() => {
    const hfRows = rows.filter(r => r.visit.hfType === 'HFrEF')
    const mild = hfRows.filter(r => r.visit.nyha === 'I' || r.visit.nyha === 'II')
    const severe = hfRows.filter(r => r.visit.nyha === 'III' || r.visit.nyha === 'IV')
    const rate = (gr: Row[], key: 'raasi' | 'betaBlocker' | 'mra' | 'sglt2i') =>
      gr.length ? +(gr.filter(r => isPrescribed(r.visit[key])).length / gr.length * 100).toFixed(1) : 0
    return [
      { pillar: 'RAASI/ARNI', mild: rate(mild, 'raasi'), severe: rate(severe, 'raasi') },
      { pillar: 'Beta-Blocker', mild: rate(mild, 'betaBlocker'), severe: rate(severe, 'betaBlocker') },
      { pillar: 'MRA', mild: rate(mild, 'mra'), severe: rate(severe, 'mra') },
      { pillar: 'SGLT2i', mild: rate(mild, 'sglt2i'), severe: rate(severe, 'sglt2i') },
    ]
  }, [rows])

  const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: 'table1',       label: 'Table 1 — Baseline',       icon: Database },
    { key: 'charts',       label: 'Key Charts',               icon: BarChart3 },
    { key: 'gdmt',         label: 'GDMT Analysis',            icon: CheckCircle },
    { key: 'correlations', label: 'Correlations',             icon: TrendingUp },
    { key: 'quality',      label: 'Data Quality',             icon: Activity },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 text-sm gap-3">
        <RefreshCw className="w-5 h-5 animate-spin text-blue-400" />
        Loading registry data for research board…
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="glass-card p-12 text-center text-gray-500 text-sm">
        <FlaskConical className="w-10 h-10 mx-auto mb-3 text-gray-600" />
        <p className="font-semibold text-white">No patient visit data found</p>
        <p className="mt-1">Enrol patients and record visits to populate the research board.</p>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5 animate-fade-in text-gray-300">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-violet-600/10 border border-violet-500/20 flex items-center justify-center text-violet-400 flex-shrink-0">
            <FlaskConical className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Research Board</h2>
            <p className="text-xs text-gray-400 mt-1">
              HF Registry Statistical Analysis · n = {rows.length} patients with visit data · {patients.length} total enrolled
            </p>
            <p className="text-[10px] text-gray-600 mt-0.5">
              Statistical tests: Welch t-test (continuous), Mann–Whitney U (skewed), Pearson χ² (categorical) · Significance: p &lt; 0.05
            </p>
          </div>
        </div>
        <button onClick={load} className="flex items-center gap-2 text-xs text-gray-400 hover:text-white transition px-3 py-2 rounded-xl border border-blue-500/10 hover:border-blue-500/30">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* Tab Bar */}
      <div className="flex border-b border-blue-500/10 gap-1 flex-wrap">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={cn('flex items-center gap-1.5 text-xs font-semibold pb-3 pt-1 px-3 border-b-2 transition-all',
              activeTab === key ? 'border-violet-500 text-white' : 'border-transparent text-gray-400 hover:text-gray-200')}>
            <Icon className="w-3.5 h-3.5" /> {label}
          </button>
        ))}
      </div>

      {/* ── TAB: Table 1 ────────────────────────────────────────────────────── */}
      {activeTab === 'table1' && (
        <div className="space-y-3">
          <div className="bg-blue-500/5 border border-blue-500/10 rounded-xl p-3 text-xs text-gray-400 flex items-start gap-2">
            <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
            <span>
              Continuous variables expressed as <strong className="text-white">Mean ± SD</strong> (t-test) or <strong className="text-white">Median [IQR]</strong> (Mann–Whitney U for skewed data).
              Categorical variables as <strong className="text-white">n (%)</strong> (χ² test). p-values compare HFrEF vs HFpEF.
            </span>
          </div>

          <div className="glass-card overflow-x-auto">
            <table className="w-full text-xs min-w-[640px]">
              <thead>
                <tr className="border-b border-blue-500/10">
                  <th className="text-left px-4 py-3 text-gray-400 font-semibold w-48">Variable</th>
                  <th className="text-center px-3 py-3 text-white font-semibold">All<br /><span className="text-gray-500 font-normal">n={gs.all.n}</span></th>
                  <th className="text-center px-3 py-3 text-rose-400 font-semibold">HFrEF<br /><span className="text-gray-500 font-normal">n={gs.hfref.n}</span></th>
                  <th className="text-center px-3 py-3 text-amber-400 font-semibold">HFmrEF<br /><span className="text-gray-500 font-normal">n={gs.hfmref.n}</span></th>
                  <th className="text-center px-3 py-3 text-blue-400 font-semibold">HFpEF<br /><span className="text-gray-500 font-normal">n={gs.hfpef.n}</span></th>
                  <th className="text-center px-3 py-3 text-gray-500 font-semibold">p-value<br /><span className="text-gray-600 font-normal text-[10px]">rEF vs pEF</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-blue-500/5">
                {/* Section headers */}
                {[
                  {
                    section: 'Demographics & Anthropometrics',
                    rows: [
                      { label: 'Age (years)', vals: [fmtMean(gs.all.ageMean, gs.all.ageSD), fmtMean(gs.hfref.ageMean, gs.hfref.ageSD), fmtMean(gs.hfmref.ageMean, gs.hfmref.ageSD), fmtMean(gs.hfpef.ageMean, gs.hfpef.ageSD)], p: NaN, note: 'Mean ± SD' },
                      { label: 'Male sex', vals: [gs.all.pctMale, gs.hfref.pctMale, gs.hfmref.pctMale, gs.hfpef.pctMale], p: pVals.htn, note: 'n (%)' },
                    ],
                  },
                  {
                    section: 'Cardiac Function',
                    rows: [
                      { label: 'LVEF (%)', vals: [fmtMean(gs.all.lvefMean, gs.all.lvefSD), fmtMean(gs.hfref.lvefMean, gs.hfref.lvefSD), fmtMean(gs.hfmref.lvefMean, gs.hfmref.lvefSD), fmtMean(gs.hfpef.lvefMean, gs.hfpef.lvefSD)], p: pVals.lvef, note: 'Mean ± SD; t-test' },
                      { label: 'Heart Rate (bpm)', vals: [fmtMean(gs.all.hrMean, gs.all.hrSD), fmtMean(gs.hfref.hrMean, gs.hfref.hrSD), fmtMean(gs.hfmref.hrMean, gs.hfmref.hrSD), fmtMean(gs.hfpef.hrMean, gs.hfpef.hrSD)], p: pVals.hr, note: 'Mean ± SD; t-test' },
                      { label: 'Systolic BP (mmHg)', vals: [fmtMean(gs.all.sbpMean, gs.all.sbpSD), fmtMean(gs.hfref.sbpMean, gs.hfref.sbpSD), fmtMean(gs.hfmref.sbpMean, gs.hfmref.sbpSD), fmtMean(gs.hfpef.sbpMean, gs.hfpef.sbpSD)], p: pVals.sbp, note: 'Mean ± SD; t-test' },
                      { label: 'QRS Duration (ms)', vals: [fmtMean(gs.all.qrsMean, gs.all.qrsSD), fmtMean(gs.hfref.qrsMean, gs.hfref.qrsSD), fmtMean(gs.hfmref.qrsMean, gs.hfmref.qrsSD), fmtMean(gs.hfpef.qrsMean, gs.hfpef.qrsSD)], p: pVals.qrs, note: 'Mean ± SD; t-test' },
                      { label: '6MWT Distance (m)', vals: [fmtMean(gs.all.sixtMean, gs.all.sixtSD), fmtMean(gs.hfref.sixtMean, gs.hfref.sixtSD), fmtMean(gs.hfmref.sixtMean, gs.hfmref.sixtSD), fmtMean(gs.hfpef.sixtMean, gs.hfpef.sixtSD)], p: pVals.sixt, note: 'Mean ± SD; Mann-Whitney' },
                    ],
                  },
                  {
                    section: 'Biomarkers',
                    rows: [
                      { label: 'NT-proBNP (pg/mL)', vals: [fmtMedian(gs.all.ntpMedian, gs.all.ntpQ1, gs.all.ntpQ3), fmtMedian(gs.hfref.ntpMedian, gs.hfref.ntpQ1, gs.hfref.ntpQ3), fmtMedian(gs.hfmref.ntpMedian, gs.hfmref.ntpQ1, gs.hfmref.ntpQ3), fmtMedian(gs.hfpef.ntpMedian, gs.hfpef.ntpQ1, gs.hfpef.ntpQ3)], p: pVals.ntp, note: 'Median [IQR]; Mann-Whitney' },
                      { label: 'eGFR (mL/min/1.73m²)', vals: [fmtMean(gs.all.egfrMean, gs.all.egfrSD), fmtMean(gs.hfref.egfrMean, gs.hfref.egfrSD), fmtMean(gs.hfmref.egfrMean, gs.hfmref.egfrSD), fmtMean(gs.hfpef.egfrMean, gs.hfpef.egfrSD)], p: pVals.egfr, note: 'Mean ± SD; t-test' },
                      { label: 'Creatinine (mg/dL)', vals: [fmtMean(gs.all.creMean, gs.all.creSD), fmtMean(gs.hfref.creMean, gs.hfref.creSD), fmtMean(gs.hfmref.creMean, gs.hfmref.creSD), fmtMean(gs.hfpef.creMean, gs.hfpef.creSD)], p: pVals.cre, note: 'Mean ± SD; t-test' },
                      { label: 'Haemoglobin (g/dL)', vals: [fmtMean(gs.all.hbMean, gs.all.hbSD), fmtMean(gs.hfref.hbMean, gs.hfref.hbSD), fmtMean(gs.hfmref.hbMean, gs.hfmref.hbSD), fmtMean(gs.hfpef.hbMean, gs.hfpef.hbSD)], p: pVals.hb, note: 'Mean ± SD; t-test' },
                      { label: 'Sodium (mmol/L)', vals: [fmtMean(gs.all.natrMean, gs.all.natrSD), fmtMean(gs.hfref.natrMean, gs.hfref.natrSD), fmtMean(gs.hfmref.natrMean, gs.hfmref.natrSD), fmtMean(gs.hfpef.natrMean, gs.hfpef.natrSD)], p: pVals.na, note: 'Mean ± SD; t-test' },
                      { label: 'Potassium (mmol/L)', vals: [fmtMean(gs.all.potMean, gs.all.potSD), fmtMean(gs.hfref.potMean, gs.hfref.potSD), fmtMean(gs.hfmref.potMean, gs.hfmref.potSD), fmtMean(gs.hfpef.potMean, gs.hfpef.potSD)], p: pVals.pot, note: 'Mean ± SD; t-test' },
                    ],
                  },
                  {
                    section: 'NYHA Functional Class',
                    rows: [
                      { label: 'NYHA I', vals: [fmtPct(gs.all.nyha1N, gs.all.n), fmtPct(gs.hfref.nyha1N, gs.hfref.n), fmtPct(gs.hfmref.nyha1N, gs.hfmref.n), fmtPct(gs.hfpef.nyha1N, gs.hfpef.n)], p: NaN, note: 'n (%)' },
                      { label: 'NYHA II', vals: [fmtPct(gs.all.nyha2N, gs.all.n), fmtPct(gs.hfref.nyha2N, gs.hfref.n), fmtPct(gs.hfmref.nyha2N, gs.hfmref.n), fmtPct(gs.hfpef.nyha2N, gs.hfpef.n)], p: NaN, note: 'n (%)' },
                      { label: 'NYHA III', vals: [fmtPct(gs.all.nyha3N, gs.all.n), fmtPct(gs.hfref.nyha3N, gs.hfref.n), fmtPct(gs.hfmref.nyha3N, gs.hfmref.n), fmtPct(gs.hfpef.nyha3N, gs.hfpef.n)], p: NaN, note: 'n (%)' },
                      { label: 'NYHA IV', vals: [fmtPct(gs.all.nyha4N, gs.all.n), fmtPct(gs.hfref.nyha4N, gs.hfref.n), fmtPct(gs.hfmref.nyha4N, gs.hfmref.n), fmtPct(gs.hfpef.nyha4N, gs.hfpef.n)], p: NaN, note: 'n (%)' },
                    ],
                  },
                  {
                    section: 'Comorbidities',
                    rows: [
                      { label: 'Hypertension', vals: [fmtPct(gs.all.htnN, gs.all.n), fmtPct(gs.hfref.htnN, gs.hfref.n), fmtPct(gs.hfmref.htnN, gs.hfmref.n), fmtPct(gs.hfpef.htnN, gs.hfpef.n)], p: pVals.htn, note: 'n (%)' },
                      { label: 'Diabetes Mellitus', vals: [fmtPct(gs.all.dmN, gs.all.n), fmtPct(gs.hfref.dmN, gs.hfref.n), fmtPct(gs.hfmref.dmN, gs.hfmref.n), fmtPct(gs.hfpef.dmN, gs.hfpef.n)], p: pVals.dm, note: 'n (%)' },
                      { label: 'Chronic Kidney Dis.', vals: [fmtPct(gs.all.ckdN, gs.all.n), fmtPct(gs.hfref.ckdN, gs.hfref.n), fmtPct(gs.hfmref.ckdN, gs.hfmref.n), fmtPct(gs.hfpef.ckdN, gs.hfpef.n)], p: pVals.ckd, note: 'n (%)' },
                      { label: 'Atrial Fibrillation', vals: [fmtPct(gs.all.afN, gs.all.n), fmtPct(gs.hfref.afN, gs.hfref.n), fmtPct(gs.hfmref.afN, gs.hfmref.n), fmtPct(gs.hfpef.afN, gs.hfpef.n)], p: pVals.af, note: 'n (%)' },
                      { label: 'Iron Deficiency', vals: [fmtPct(gs.all.ironN, gs.all.n), fmtPct(gs.hfref.ironN, gs.hfref.n), fmtPct(gs.hfmref.ironN, gs.hfmref.n), fmtPct(gs.hfpef.ironN, gs.hfpef.n)], p: NaN, note: 'n (%)' },
                      { label: 'Prior HF Hospitalisation', vals: [fmtPct(gs.all.hospN, gs.all.n), fmtPct(gs.hfref.hospN, gs.hfref.n), fmtPct(gs.hfmref.hospN, gs.hfmref.n), fmtPct(gs.hfpef.hospN, gs.hfpef.n)], p: NaN, note: 'n (%)' },
                    ],
                  },
                  {
                    section: 'GDMT (HFrEF patients only)',
                    rows: [
                      { label: 'RAASI / ARNI prescribed', vals: [fmtPct(gs.all.raasiN, gs.all.hfNforGDMT), fmtPct(gs.hfref.raasiN, gs.hfref.hfNforGDMT), '—', '—'], p: NaN, note: 'n (%) of HFrEF' },
                      { label: 'Beta-Blocker prescribed', vals: [fmtPct(gs.all.betaN, gs.all.hfNforGDMT), fmtPct(gs.hfref.betaN, gs.hfref.hfNforGDMT), '—', '—'], p: NaN, note: 'n (%) of HFrEF' },
                      { label: 'MRA prescribed', vals: [fmtPct(gs.all.mraN, gs.all.hfNforGDMT), fmtPct(gs.hfref.mraN, gs.hfref.hfNforGDMT), '—', '—'], p: NaN, note: 'n (%) of HFrEF' },
                      { label: 'SGLT2i prescribed', vals: [fmtPct(gs.all.sglt2N, gs.all.hfNforGDMT), fmtPct(gs.hfref.sglt2N, gs.hfref.hfNforGDMT), '—', '—'], p: NaN, note: 'n (%) of HFrEF' },
                      { label: 'Quadruple therapy (all 4)', vals: [fmtPct(gs.all.quadN, gs.all.hfNforGDMT), fmtPct(gs.hfref.quadN, gs.hfref.hfNforGDMT), '—', '—'], p: NaN, note: 'n (%) of HFrEF' },
                    ],
                  },
                ].map(sec => (
                  <tr key={sec.section} className="contents">
                    <td colSpan={6} className="px-4 py-2 bg-blue-500/5 text-[10px] font-bold text-blue-400 uppercase tracking-widest">
                      {sec.section}
                    </td>
                    {sec.rows.map(row => (
                      <tr key={row.label} className="hover:bg-white/[0.02] transition">
                        <td className="px-4 py-2.5 text-gray-300">
                          {row.label}
                          <span className="ml-1 text-[9px] text-gray-600">{row.note}</span>
                        </td>
                        {row.vals.map((v, i) => (
                          <td key={i} className="text-center px-3 py-2.5 text-white font-mono text-[11px]">{v}</td>
                        ))}
                        <td className={`text-center px-3 py-2.5 font-mono text-[11px] ${pColor(row.p)}`}>
                          {pFmt(row.p)}
                        </td>
                      </tr>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-[10px] text-gray-600 px-1">
            † Welch two-sample t-test for continuous normally-distributed variables. Mann–Whitney U for skewed biomarkers (NT-proBNP, 6MWT). Pearson χ² for categorical variables. p &lt; 0.05 considered statistically significant.
          </p>
        </div>
      )}

      {/* ── TAB: Key Charts ──────────────────────────────────────────────────── */}
      {activeTab === 'charts' && (
        <div className="space-y-6">

          {/* Row 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* LVEF Distribution Histogram */}
            <div className="glass-card p-5">
              <p className="text-sm font-semibold text-white mb-1">LVEF Distribution by HF Phenotype</p>
              <p className="text-[10px] text-gray-500 mb-4">Counts per LVEF bin, colour-coded by HF type (n={rows.filter(r => r.visit.lvef != null).length} with echo data)</p>
              {lvefHistData.every(d => d.HFrEF + d.HFmrEF + d.HFpEF + d.HFimpEF === 0) ? (
                <p className="text-xs text-gray-500 text-center py-8">No LVEF data recorded yet</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={lvefHistData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="range" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip content={<DarkTooltip />} />
                    <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                    <Bar dataKey="HFrEF"   stackId="a" fill="#f43f5e" />
                    <Bar dataKey="HFmrEF"  stackId="a" fill="#f59e0b" />
                    <Bar dataKey="HFpEF"   stackId="a" fill="#3b82f6" />
                    <Bar dataKey="HFimpEF" stackId="a" fill="#10b981" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* NT-proBNP Median by NYHA */}
            <div className="glass-card p-5">
              <p className="text-sm font-semibold text-white mb-1">NT-proBNP Median by NYHA Class</p>
              <p className="text-[10px] text-gray-500 mb-4">Median NT-proBNP (pg/mL) per NYHA class · bars show median, error represents IQR</p>
              {ntpByNYHA.every(d => d.n === 0) ? (
                <p className="text-xs text-gray-500 text-center py-8">No NT-proBNP data recorded</p>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={ntpByNYHA} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis dataKey="nyha" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                      <Tooltip content={<DarkTooltip />} />
                      <Bar dataKey="median" name="Median NT-proBNP" radius={[4, 4, 0, 0]} maxBarSize={50}>
                        {ntpByNYHA.map((_, i) => (
                          <Cell key={i} fill={['#10b981', '#3b82f6', '#f59e0b', '#ef4444'][i]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="grid grid-cols-4 gap-1 mt-2">
                    {ntpByNYHA.map(d => (
                      <div key={d.nyha} className="text-center text-[10px] text-gray-500">
                        <p className="text-white font-semibold">{d.n}</p>
                        <p>n</p>
                        {d.q1 > 0 && <p className="text-[9px] text-gray-600">[{d.q1}–{d.q3}]</p>}
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-gray-600 mt-1">Note: Log-scale recommended for NT-proBNP — values are right-skewed. Use Mann–Whitney U for group comparisons.</p>
                </>
              )}
            </div>
          </div>

          {/* Row 2 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Comorbidity Ranked Bar */}
            <div className="glass-card p-5">
              <p className="text-sm font-semibold text-white mb-1">Comorbidity Prevalence (Ranked)</p>
              <p className="text-[10px] text-gray-500 mb-4">% of enrolled patients (n={patients.length}) with each comorbidity</p>
              {comorbidityRanked.length === 0 ? (
                <p className="text-xs text-gray-500 text-center py-8">No comorbidity data recorded</p>
              ) : (
                <ResponsiveContainer width="100%" height={Math.max(200, comorbidityRanked.length * 32)}>
                  <BarChart data={comorbidityRanked} layout="vertical" margin={{ top: 4, right: 40, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} unit="%" />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#cbd5e1' }} tickLine={false} axisLine={false} width={110} />
                    <Tooltip content={<DarkTooltip />} formatter={(v: any) => [`${v}%`]} />
                    <Bar dataKey="pct" name="Prevalence (%)" fill="#6366f1" radius={[0, 4, 4, 0]} maxBarSize={14} label={{ position: 'right', fontSize: 9, fill: '#94a3b8', formatter: (v: number) => `${v}%` }} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* eGFR by HF Type */}
            <div className="glass-card p-5">
              <p className="text-sm font-semibold text-white mb-1">Mean eGFR by HF Phenotype</p>
              <p className="text-[10px] text-gray-500 mb-4">Cardiorenal syndrome burden across HF categories (mL/min/1.73m²) — eGFR &lt;60 indicates CKD stage ≥3</p>
              {eGFRbyType.length === 0 ? (
                <p className="text-xs text-gray-500 text-center py-8">No eGFR data recorded</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={eGFRbyType} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="type" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                    <YAxis domain={[0, 120]} tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} unit=" mL" />
                    <Tooltip content={<DarkTooltip />} />
                    <ReferenceLine y={60} stroke="#f59e0b" strokeDasharray="4 2" label={{ value: 'CKD stage ≥3 (<60)', position: 'right', fontSize: 9, fill: '#f59e0b' }} />
                    <Bar dataKey="mean" name="Mean eGFR" radius={[4, 4, 0, 0]} maxBarSize={60}>
                      {eGFRbyType.map((d, i) => (
                        <Cell key={i} fill={d.mean < 60 ? '#ef4444' : d.mean < 90 ? '#f59e0b' : '#10b981'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
              <div className="flex gap-4 mt-2 text-[10px] text-gray-500">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> ≥90 normal</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> 60–89 mildly ↓</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500 inline-block" /> &lt;60 CKD ≥3</span>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ── TAB: GDMT Analysis ──────────────────────────────────────────────── */}
      {activeTab === 'gdmt' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* GDMT by NYHA severity */}
            <div className="glass-card p-5">
              <p className="text-sm font-semibold text-white mb-1">GDMT 4-Pillar by NYHA Severity (HFrEF only)</p>
              <p className="text-[10px] text-gray-500 mb-4">Prescription rate (%) in NYHA I–II vs III–IV — should not differ significantly if guidelines followed</p>
              {rows.filter(r => r.visit.hfType === 'HFrEF').length === 0 ? (
                <p className="text-xs text-gray-500 text-center py-8">No HFrEF patients with visit data</p>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={GDMT_BY_NYHA} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="pillar" tick={{ fontSize: 9, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} unit="%" />
                    <Tooltip content={<DarkTooltip />} />
                    <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                    <Bar dataKey="mild"   name="NYHA I–II"  fill="#10b981" radius={[3, 3, 0, 0]} maxBarSize={30} />
                    <Bar dataKey="severe" name="NYHA III–IV" fill="#ef4444" radius={[3, 3, 0, 0]} maxBarSize={30} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* GDMT single pillar rates */}
            <div className="glass-card p-5">
              <p className="text-sm font-semibold text-white mb-1">4-Pillar Adherence Rate — HFrEF Cohort</p>
              <p className="text-[10px] text-gray-500 mb-4">ESC 2023 guideline targets: each pillar ≥ 80% for optimal registry performance</p>
              <div className="space-y-4">
                {[
                  { label: 'RAASI / ARNI', n: gs.hfref.raasiN, color: 'bg-blue-500', target: 80 },
                  { label: 'Beta-Blocker', n: gs.hfref.betaN, color: 'bg-violet-500', target: 80 },
                  { label: 'MRA (Spironolactone / Eplerenone)', n: gs.hfref.mraN, color: 'bg-emerald-500', target: 70 },
                  { label: 'SGLT2 Inhibitor (Dapa/Empa)', n: gs.hfref.sglt2N, color: 'bg-cyan-500', target: 70 },
                  { label: 'Quadruple Therapy', n: gs.hfref.quadN, color: 'bg-amber-500', target: 50 },
                ].map(({ label, n, color, target }) => {
                  const den = gs.hfref.hfNforGDMT
                  const pct = den > 0 ? Math.round(n / den * 100) : 0
                  const atTarget = pct >= target
                  return (
                    <div key={label}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-400">{label}</span>
                        <div className="flex items-center gap-2">
                          <span className={atTarget ? 'text-emerald-400' : 'text-rose-400'}>{pct}%</span>
                          <span className="text-gray-600 text-[10px]">target {target}%</span>
                          <span className="text-gray-600 text-[10px]">({n}/{den})</span>
                        </div>
                      </div>
                      <div className="h-2 bg-gray-800 rounded-full overflow-hidden relative">
                        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                        <div className="absolute top-0 h-full w-0.5 bg-white/20" style={{ left: `${target}%` }} />
                      </div>
                    </div>
                  )
                })}
                {gs.hfref.n === 0 && <p className="text-xs text-gray-500">No HFrEF patients with visit data.</p>}
              </div>
            </div>
          </div>

          {/* Statistical notes */}
          <div className="glass-card p-4 text-xs text-gray-400 space-y-2">
            <p className="font-semibold text-white text-sm">Statistical Tests for GDMT Analysis</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <p className="font-semibold text-blue-400">Within-cohort tests (run manually)</p>
                <p>• Chi-square (χ²) — compare GDMT rates between NYHA I–II vs III–IV</p>
                <p>• McNemar test — compare same-patient GDMT at enrollment vs follow-up</p>
                <p>• Cochran-Armitage — trend test across NYHA classes I → IV</p>
              </div>
              <div className="space-y-1.5">
                <p className="font-semibold text-violet-400">Benchmarking tests</p>
                <p>• One-sample χ² vs EuroHeart HF survey rates (RAASI ~85%, BB ~87%)</p>
                <p>• Fisher's exact when cell n &lt; 5 (small subgroups)</p>
                <p>• Bonferroni correction when testing all 4 pillars simultaneously (α = 0.0125)</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: Correlations ────────────────────────────────────────────────── */}
      {activeTab === 'correlations' && (
        <div className="space-y-5">
          <div className="bg-blue-500/5 border border-blue-500/10 rounded-xl p-3 text-xs text-gray-400 flex items-start gap-2">
            <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
            <span>
              Spearman ρ (rank correlation) — robust to non-normality and outliers, appropriate for HF biomarkers.
              Interpretation: |ρ| ≥ 0.7 strong, 0.4–0.7 moderate, 0.2–0.4 weak, &lt;0.2 negligible.
            </span>
          </div>

          <div className="glass-card overflow-x-auto">
            <table className="w-full text-xs min-w-[500px]">
              <thead>
                <tr className="border-b border-blue-500/10">
                  <th className="text-left px-4 py-3 text-gray-400 font-semibold">Variable X</th>
                  <th className="text-left px-4 py-3 text-gray-400 font-semibold">Variable Y</th>
                  <th className="text-center px-3 py-3 text-gray-400 font-semibold">n pairs</th>
                  <th className="text-center px-3 py-3 text-gray-400 font-semibold">Spearman ρ</th>
                  <th className="text-center px-3 py-3 text-gray-400 font-semibold">Strength</th>
                  <th className="text-center px-3 py-3 text-gray-400 font-semibold">Direction</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-blue-500/5">
                {correlationPairs.map((c, i) => {
                  const rho = c.rho
                  const absR = rho !== null ? Math.abs(rho) : 0
                  const strength = rho === null ? '—' : absR >= 0.7 ? 'Strong' : absR >= 0.4 ? 'Moderate' : absR >= 0.2 ? 'Weak' : 'Negligible'
                  const strengthColor = rho === null ? 'text-gray-500' : absR >= 0.7 ? 'text-emerald-400' : absR >= 0.4 ? 'text-blue-400' : absR >= 0.2 ? 'text-amber-400' : 'text-gray-500'
                  const dirColor = rho !== null && rho > 0 ? 'text-blue-400' : 'text-rose-400'
                  return (
                    <tr key={i} className="hover:bg-white/[0.02] transition">
                      <td className="px-4 py-2.5 text-gray-300">{c.x}</td>
                      <td className="px-4 py-2.5 text-gray-300">{c.y}</td>
                      <td className="text-center px-3 py-2.5 text-gray-400">{c.n}</td>
                      <td className="text-center px-3 py-2.5 font-mono font-bold text-white">
                        {rho !== null ? rho.toFixed(3) : '—'}
                      </td>
                      <td className={`text-center px-3 py-2.5 font-semibold ${strengthColor}`}>{strength}</td>
                      <td className={`text-center px-3 py-2.5 ${dirColor}`}>
                        {rho === null ? '—' : rho > 0.05 ? '↑ Positive' : rho < -0.05 ? '↓ Negative' : '≈ Null'}
                      </td>
                    </tr>
                  )
                })}
                {correlationPairs.every(c => c.n < 3) && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">Insufficient paired data — record biomarker values in patient visits to compute correlations</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="glass-card p-4 text-xs space-y-3">
            <p className="font-semibold text-white">Biostatistician-Recommended Correlation Hypotheses for HF Registry</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-gray-400">
              <div className="space-y-1.5">
                <p className="font-semibold text-blue-400">Expected significant negative correlations</p>
                <p>• NT-proBNP ↔ LVEF (ρ ≈ −0.5 to −0.7 in HFrEF cohorts)</p>
                <p>• eGFR ↔ NT-proBNP (cardiorenal syndrome)</p>
                <p>• LVEF ↔ RVSP (RV afterload)</p>
                <p>• 6MWT ↔ NT-proBNP (functional capacity)</p>
              </div>
              <div className="space-y-1.5">
                <p className="font-semibold text-violet-400">Expected positive correlations</p>
                <p>• LVEF ↔ 6MWT (functional capacity tracks EF)</p>
                <p>• Sodium ↔ LVEF (hyponatraemia = poor prognosis)</p>
                <p>• eGFR ↔ LVEF (cardio-renal interdependence)</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: Data Quality ────────────────────────────────────────────────── */}
      {activeTab === 'quality' && (
        <div className="space-y-5">
          <div className="glass-card p-5">
            <p className="text-sm font-semibold text-white mb-1">Field Completeness — Key Research Variables</p>
            <p className="text-[10px] text-gray-500 mb-5">
              % of visits with each field recorded · n={rows.length} visits · Green ≥80%, Amber 50–79%, Red &lt;50%
            </p>
            {completenessData.length === 0 ? (
              <p className="text-xs text-gray-500 text-center py-8">No visit data to analyse</p>
            ) : (
              <div className="space-y-2.5">
                {completenessData.map(d => (
                  <div key={d.field}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-300 w-40">{d.field}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-gray-600 text-[10px]">{d.present}/{d.total}</span>
                        <span className={cn('font-semibold w-12 text-right', d.pct >= 80 ? 'text-emerald-400' : d.pct >= 50 ? 'text-amber-400' : 'text-rose-400')}>
                          {d.pct}%
                        </span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className={cn('h-full rounded-full', d.pct >= 80 ? 'bg-emerald-500' : d.pct >= 50 ? 'bg-amber-500' : 'bg-rose-500')}
                        style={{ width: `${d.pct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            {[
              { color: 'emerald', label: 'Excellent (≥80%)', count: completenessData.filter(d => d.pct >= 80).length, desc: 'Fields meeting minimum research quality threshold' },
              { color: 'amber',   label: 'Acceptable (50–79%)', count: completenessData.filter(d => d.pct >= 50 && d.pct < 80).length, desc: 'Fields requiring active data completion before analysis' },
              { color: 'rose',    label: 'Poor (<50%)', count: completenessData.filter(d => d.pct < 50).length, desc: 'Fields with critical data gaps — exclude from univariate analysis' },
            ].map(g => (
              <div key={g.label} className={`glass-card p-4 border border-${g.color}-500/20`}>
                <p className={`text-2xl font-bold text-${g.color}-400`}>{g.count}</p>
                <p className={`text-xs font-semibold text-${g.color}-300 mt-1`}>{g.label}</p>
                <p className="text-[10px] text-gray-500 mt-1">{g.desc}</p>
              </div>
            ))}
          </div>

          <div className="glass-card p-4 text-xs space-y-2">
            <p className="font-semibold text-white">Missing Data Handling — Biostatistician Recommendations</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-gray-400">
              <div className="space-y-1.5">
                <p className="font-semibold text-blue-400">For fields &lt;20% missing (MCAR assumed)</p>
                <p>• Complete-case analysis is acceptable for primary endpoints</p>
                <p>• Report exact n for every summary statistic</p>
                <p>• No imputation needed for &lt;5% missingness</p>
              </div>
              <div className="space-y-1.5">
                <p className="font-semibold text-amber-400">For fields 20–50% missing (MAR assumed)</p>
                <p>• Multiple imputation (m ≥ 5 imputations, mice package)</p>
                <p>• Sensitivity analysis: compare complete-case vs imputed results</p>
                <p>• Document missing data mechanism in methods section</p>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

// Helper: approximate normal CDF for Spearman p-value
function normalCDFApprox(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x))
  const d = 0.3989422820 * Math.exp(-x * x / 2)
  const poly = t * (0.3193815302 + t * (-0.3565637813 + t * (1.7814779372 + t * (-1.8212559978 + t * 1.3302744290))))
  const p = 1 - d * poly
  return x >= 0 ? p : 1 - p
}
