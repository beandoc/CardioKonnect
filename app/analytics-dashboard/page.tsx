'use client'
import { useState, useMemo, useEffect, useCallback } from 'react'
import {
  Activity, Users, Heart, BarChart3, TrendingUp, AlertTriangle, Zap,
  CheckCircle, Smartphone, Info, Database, Award, RefreshCw,
} from 'lucide-react'
import Button from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { getPatients, getAllLatestVisits } from '@/lib/firestore'
import type { Patient, Visit } from '@/lib/types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pct(num: number, den: number): number | null {
  if (!den) return null
  return Math.round((num / den) * 100)
}

function avg(arr: number[]): number | null {
  if (!arr.length) return null
  return Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10
}

function fmt(val: number | null, suffix = '%'): string {
  return val === null ? '—' : `${val}${suffix}`
}

function isPrescribed(me: unknown): boolean {
  return (me as { prescribed?: string })?.prescribed === 'Yes'
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatRow({
  label, value, subtitle, color = 'text-white',
}: {
  label: string; value: string | number | null; subtitle?: string; color?: string
}) {
  return (
    <div className="flex justify-between items-center border-b border-blue-500/5 pb-1.5 last:border-0 last:pb-0">
      <div>
        <span className="text-xs text-gray-400">{label}</span>
        {subtitle && <p className="text-[10px] text-gray-600">{subtitle}</p>}
      </div>
      <span className={`text-xs font-semibold ${color}`}>{value ?? '—'}</span>
    </div>
  )
}

function ProgressBar({ label, rate, n, den, color }: {
  label: string; rate: number | null; n: number; den: number; color: string
}) {
  return (
    <div>
      <div className="flex justify-between mb-1">
        <span className="text-xs text-gray-400">{label}</span>
        <span className="text-xs font-semibold text-white">
          {fmt(rate)}{' '}
          <span className="text-[10px] text-gray-600 font-normal">({n}/{den})</span>
        </span>
      </div>
      <div className="progress-track">
        <div className={`progress-fill ${color}`} style={{ width: `${rate ?? 0}%` }} />
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AnalyticsDashboardPage() {
  type Tab = 'overview' | 'burden' | 'biomarker' | 'medication' | 'outcomes' | 'preventive'
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [patients, setPatients] = useState<Patient[]>([])
  const [visitMap, setVisitMap] = useState<Map<string, Visit>>(new Map())
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([getPatients(), getAllLatestVisits()])
      .then(([pts, vmap]) => {
        setPatients(pts)
        setVisitMap(vmap)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const s = useMemo(() => {
    const total = patients.length
    const rows = patients.map(p => ({ patient: p, visit: visitMap.get(p.id) ?? null }))
    const withVisit = rows.filter(r => r.visit !== null) as { patient: Patient; visit: Visit }[]
    const wN = withVisit.length

    // HF type
    const hfrEF  = withVisit.filter(r => r.visit.hfType === 'HFrEF').length
    const hfmrEF = withVisit.filter(r => r.visit.hfType === 'HFmrEF').length
    const hfpEF  = withVisit.filter(r => r.visit.hfType === 'HFpEF').length
    const hfimpEF= withVisit.filter(r => r.visit.hfType === 'HFimpEF').length

    // NYHA
    const nyha1 = withVisit.filter(r => r.visit.nyha === 'I').length
    const nyha2 = withVisit.filter(r => r.visit.nyha === 'II').length
    const nyha3 = withVisit.filter(r => r.visit.nyha === 'III').length
    const nyha4 = withVisit.filter(r => r.visit.nyha === 'IV').length

    // LVEF
    const lvefArr = withVisit.filter(r => r.visit.lvef != null).map(r => r.visit.lvef!)
    const meanLVEF = avg(lvefArr)
    const lvefN = lvefArr.length

    // Mortality
    const deceased = patients.filter(p => p.vitalStatus === 'Dead').length
    const mortalityRate = pct(deceased, total)

    // Visit type distribution
    const opdV = withVisit.filter(r => r.visit.visitType === 'OPD').length
    const inpV = withVisit.filter(r => r.visit.visitType === 'Inpatient').length
    const telV = withVisit.filter(r => r.visit.visitType === 'Telemedicine').length

    // GDMT (HFrEF only)
    const hfRows = withVisit.filter(r => r.visit.hfType === 'HFrEF')
    const hfN = hfRows.length
    const raasiN = hfRows.filter(r => isPrescribed(r.visit.raasi)).length
    const betaN  = hfRows.filter(r => isPrescribed(r.visit.betaBlocker)).length
    const mraN   = hfRows.filter(r => isPrescribed(r.visit.mra)).length
    const sglt2N = hfRows.filter(r => isPrescribed(r.visit.sglt2i)).length
    const quadN  = hfRows.filter(r =>
      isPrescribed(r.visit.raasi) && isPrescribed(r.visit.betaBlocker) &&
      isPrescribed(r.visit.mra)   && isPrescribed(r.visit.sglt2i)
    ).length
    const gdmtPillars = [pct(raasiN, hfN), pct(betaN, hfN), pct(mraN, hfN), pct(sglt2N, hfN)].filter(v => v !== null) as number[]
    const overallGDMT = gdmtPillars.length
      ? Math.round(gdmtPillars.reduce((a, b) => a + b, 0) / gdmtPillars.length)
      : null

    // Hospitalization
    const hospN = withVisit.filter(r => r.visit.hospHistory === 'Yes').length
    const hospRate = pct(hospN, wN)

    // Comorbidities
    const htnN  = patients.filter(p => p.comorbidHypertension).length
    const dmN   = patients.filter(p => p.comorbidDiabetes).length
    const ckdN  = patients.filter(p => p.comorbidCKD).length
    const afN   = patients.filter(p => p.comorbidAF).length
    const ironN = patients.filter(p => p.comorbidIronDeficiency).length
    const dysN  = patients.filter(p => p.comorbidDyslipidemia).length

    // Biomarkers
    const bnpArr  = withVisit.filter(r => r.visit.ntProBNP != null).map(r => r.visit.ntProBNP!)
    const egfrArr = withVisit.filter(r => r.visit.egfr != null).map(r => r.visit.egfr!)
    const hbArr   = withVisit.filter(r => r.visit.hb != null).map(r => r.visit.hb!)
    const creArr  = withVisit.filter(r => r.visit.creatinine != null).map(r => r.visit.creatinine!)
    const anaemiaRows = withVisit.filter(r => r.visit.hb != null)
    const anaemiaN = anaemiaRows.filter(r =>
      r.patient.sex === 'Female' ? r.visit.hb! < 12 : r.visit.hb! < 13
    ).length

    // Preventive (computed from visit data)
    const bpRows = withVisit.filter(r => r.visit.bpSystolic != null && r.visit.bpDiastolic != null)
    const bpCtrlN = bpRows.filter(r => r.visit.bpSystolic! < 130 && r.visit.bpDiastolic! < 80).length
    const ldlRows = withVisit.filter(r => r.visit.ldl != null)
    const ldlCtrlN = ldlRows.filter(r => r.visit.ldl! < 55).length
    const hba1cRows = withVisit.filter(r => r.visit.hba1c != null)
    const hba1cCtrlN = hba1cRows.filter(r => r.visit.hba1c! < 7).length

    return {
      total, wN, deceased, mortalityRate,
      hfrEF, hfmrEF, hfpEF, hfimpEF,
      nyha1, nyha2, nyha3, nyha4, nyha34: nyha3 + nyha4,
      meanLVEF, lvefN,
      opdV, inpV, telV,
      hfN, raasiN, betaN, mraN, sglt2N, quadN,
      raasiRate: pct(raasiN, hfN), betaRate: pct(betaN, hfN), mraRate: pct(mraN, hfN), sglt2Rate: pct(sglt2N, hfN), quadRate: pct(quadN, hfN), overallGDMT,
      hospN, hospRate,
      htnN, dmN, ckdN, afN, ironN, dysN,
      htnRate: pct(htnN, total), dmRate: pct(dmN, total), ckdRate: pct(ckdN, total),
      afRate: pct(afN, total), ironRate: pct(ironN, total), dysRate: pct(dysN, total),
      meanNTproBNP: avg(bnpArr), bnpN: bnpArr.length,
      meanEGFR: avg(egfrArr), egfrN: egfrArr.length,
      meanHb: avg(hbArr), hbN: hbArr.length,
      meanCreatinine: avg(creArr), creN: creArr.length,
      anaemiaRate: pct(anaemiaN, anaemiaRows.length), anaemiaN, anaemiaRowsN: anaemiaRows.length,
      bpCtrlRate: pct(bpCtrlN, bpRows.length), bpN: bpRows.length,
      ldlCtrlRate: pct(ldlCtrlN, ldlRows.length), ldlN: ldlRows.length,
      hba1cCtrlRate: pct(hba1cCtrlN, hba1cRows.length), hba1cN: hba1cRows.length,
    }
  }, [patients, visitMap])

  const TABS: { key: Tab; label: string }[] = [
    { key: 'overview',   label: 'Population Overview' },
    { key: 'burden',     label: 'Disease Burden' },
    { key: 'biomarker',  label: 'Biomarker Trends' },
    { key: 'medication', label: 'Medication & GDMT' },
    { key: 'outcomes',   label: 'Outcomes' },
    { key: 'preventive', label: 'Risk Factor Control' },
  ]

  const dash = (v: string | number | null) => (loading ? '—' : (v ?? '—'))

  return (
    <div className="space-y-6 animate-fade-in text-gray-300">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400 flex-shrink-0">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white leading-tight">Cardiology Intelligence & Analytics</h2>
            <p className="text-xs text-gray-400 mt-1">Heart Failure Registry — all metrics computed live from enrolled patients</p>
            <p className="text-[10px] text-gray-500 mt-0.5">Registry Owner View · Dr. A. Jayachandra · AICTS Pune</p>
          </div>
        </div>
        <Button size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} /> Refresh
        </Button>
      </div>

      {/* Live KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="kpi-card rose">
          <p className="text-[10px] uppercase tracking-wider text-gray-400">Mortality Rate</p>
          <p className="text-2xl font-bold text-white mt-1">{dash(fmt(s.mortalityRate))}</p>
          <p className="text-[10px] text-gray-500 mt-1">{s.deceased}/{s.total} deceased</p>
        </div>
        <div className="kpi-card blue">
          <p className="text-[10px] uppercase tracking-wider text-gray-400">Mean LVEF</p>
          <p className="text-2xl font-bold text-white mt-1">{dash(s.meanLVEF != null ? `${s.meanLVEF}%` : '—')}</p>
          <p className="text-[10px] text-gray-500 mt-1">n={s.lvefN} with echo</p>
        </div>
        <div className="kpi-card amber">
          <p className="text-[10px] uppercase tracking-wider text-gray-400">NYHA III / IV</p>
          <p className="text-2xl font-bold text-white mt-1">{dash(fmt(pct(s.nyha34, s.wN)))}</p>
          <p className="text-[10px] text-gray-500 mt-1">Advanced symptom burden</p>
        </div>
        <div className="kpi-card violet">
          <p className="text-[10px] uppercase tracking-wider text-gray-400">GDMT Adherence</p>
          <p className="text-2xl font-bold text-white mt-1">{dash(fmt(s.overallGDMT))}</p>
          <p className="text-[10px] text-gray-500 mt-1">4-pillar avg · HFrEF only</p>
        </div>
        <div className="kpi-card emerald">
          <p className="text-[10px] uppercase tracking-wider text-gray-400">Prior Hosp.</p>
          <p className="text-2xl font-bold text-white mt-1">{dash(fmt(s.hospRate))}</p>
          <p className="text-[10px] text-gray-500 mt-1">{s.hospN} with h/o admission</p>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex border-b border-blue-500/10 pb-3 gap-6 flex-wrap">
        {TABS.map(({ key, label }) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={cn('text-xs font-semibold pb-2 border-b-2 px-1 transition-all',
              activeTab === key
                ? 'border-blue-500 text-white'
                : 'border-transparent text-gray-400 hover:text-gray-200')}>
            {label}
          </button>
        ))}
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-6">

          {/* ── Overview ─────────────────────────────────────────────── */}
          {activeTab === 'overview' && (
            <div className="glass-card p-5 space-y-5">
              <h3 className="text-sm font-semibold text-white pb-2 border-b border-blue-500/10 flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-400" /> HF Registry Cohort Distribution
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Visit type */}
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-white">Latest Visit Type</p>
                  {[
                    { label: 'Outpatient (OPD)', n: s.opdV, color: 'bg-blue-500' },
                    { label: 'Inpatient Ward', n: s.inpV, color: 'bg-violet-500' },
                    { label: 'Telemedicine', n: s.telV, color: 'bg-emerald-500' },
                  ].map(({ label, n, color }) => (
                    <ProgressBar key={label} label={label} rate={pct(n, s.wN)} n={n} den={s.wN} color={color} />
                  ))}
                </div>
                {/* HF type */}
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-white">HF Phenotype Distribution</p>
                  {[
                    { label: 'HFrEF (LVEF < 40%)', n: s.hfrEF, color: 'bg-rose-500' },
                    { label: 'HFmrEF (LVEF 40–49%)', n: s.hfmrEF, color: 'bg-amber-500' },
                    { label: 'HFpEF (LVEF ≥ 50%)', n: s.hfpEF, color: 'bg-blue-500' },
                    { label: 'HFimpEF (Recovered)', n: s.hfimpEF, color: 'bg-emerald-500' },
                  ].map(({ label, n, color }) => (
                    <ProgressBar key={label} label={label} rate={pct(n, s.wN)} n={n} den={s.wN} color={color} />
                  ))}
                </div>
              </div>

              {/* NYHA grid */}
              <div>
                <p className="text-xs font-semibold text-white mb-3">NYHA Functional Class Distribution</p>
                <div className="grid grid-cols-4 gap-3 text-center">
                  {[
                    { cls: 'I',   n: s.nyha1, color: 'text-emerald-400' },
                    { cls: 'II',  n: s.nyha2, color: 'text-blue-400' },
                    { cls: 'III', n: s.nyha3, color: 'text-amber-400' },
                    { cls: 'IV',  n: s.nyha4, color: 'text-rose-400' },
                  ].map(({ cls, n, color }) => (
                    <div key={cls} className="dark-card p-3">
                      <p className={`text-xl font-bold ${color}`}>{fmt(pct(n, s.wN))}</p>
                      <p className="text-[10px] text-gray-400 mt-1">NYHA {cls}</p>
                      <p className="text-[10px] text-gray-600">n={n}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Disease Burden ───────────────────────────────────────── */}
          {activeTab === 'burden' && (
            <div className="glass-card p-5 space-y-4">
              <h3 className="text-sm font-semibold text-white pb-2 border-b border-blue-500/10 flex items-center gap-2">
                <Heart className="w-4 h-4 text-rose-400" /> Cardiovascular Comorbidity Burden
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
                <div className="space-y-3">
                  <p className="font-semibold text-white">HF Phenotypes (n={s.wN})</p>
                  <StatRow label="HFrEF (EF < 40%)"       value={`${fmt(pct(s.hfrEF,   s.wN))} (${s.hfrEF})`} />
                  <StatRow label="HFmrEF (EF 40–49%)"     value={`${fmt(pct(s.hfmrEF,  s.wN))} (${s.hfmrEF})`} />
                  <StatRow label="HFpEF (EF ≥ 50%)"       value={`${fmt(pct(s.hfpEF,   s.wN))} (${s.hfpEF})`} />
                  <StatRow label="HFimpEF (Recovered)"     value={`${fmt(pct(s.hfimpEF, s.wN))} (${s.hfimpEF})`} color="text-emerald-400" />
                </div>
                <div className="space-y-3">
                  <p className="font-semibold text-white">Comorbidity Prevalence (n={s.total})</p>
                  <StatRow label="Hypertension"        value={`${fmt(s.htnRate)} (${s.htnN})`} />
                  <StatRow label="Diabetes Mellitus"   value={`${fmt(s.dmRate)} (${s.dmN})`} />
                  <StatRow label="Chronic Kidney Dis." value={`${fmt(s.ckdRate)} (${s.ckdN})`} />
                  <StatRow label="Atrial Fibrillation" value={`${fmt(s.afRate)} (${s.afN})`} />
                  <StatRow label="Iron Deficiency"     value={`${fmt(s.ironRate)} (${s.ironN})`} />
                  <StatRow label="Dyslipidaemia"       value={`${fmt(s.dysRate)} (${s.dysN})`} />
                </div>
              </div>
            </div>
          )}

          {/* ── Biomarker Trends ──────────────────────────────────────── */}
          {activeTab === 'biomarker' && (
            <div className="glass-card p-5 space-y-4">
              <h3 className="text-sm font-semibold text-white pb-2 border-b border-blue-500/10 flex items-center gap-2">
                <Activity className="w-4 h-4 text-cyan-400" /> Biomarker & Lab Summary (Latest Visit per Patient)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
                <div className="space-y-3">
                  <p className="font-semibold text-white">Cardiac Biomarkers</p>
                  <StatRow
                    label="Mean NT-proBNP"
                    value={s.meanNTproBNP != null ? `${s.meanNTproBNP} pg/mL` : '—'}
                    subtitle={`n=${s.bnpN} with data`}
                    color={s.meanNTproBNP != null && s.meanNTproBNP > 300 ? 'text-rose-400' : 'text-white'}
                  />
                  <StatRow
                    label="Mean LVEF"
                    value={s.meanLVEF != null ? `${s.meanLVEF}%` : '—'}
                    subtitle={`n=${s.lvefN} with echo`}
                  />
                </div>
                <div className="space-y-3">
                  <p className="font-semibold text-white">Renal & Haematological</p>
                  <StatRow
                    label="Mean eGFR"
                    value={s.meanEGFR != null ? `${s.meanEGFR} mL/min/1.73m²` : '—'}
                    subtitle={`n=${s.egfrN}`}
                    color={s.meanEGFR != null && s.meanEGFR < 60 ? 'text-amber-400' : 'text-white'}
                  />
                  <StatRow
                    label="Mean Creatinine"
                    value={s.meanCreatinine != null ? `${s.meanCreatinine} mg/dL` : '—'}
                    subtitle={`n=${s.creN}`}
                  />
                  <StatRow
                    label="Mean Haemoglobin"
                    value={s.meanHb != null ? `${s.meanHb} g/dL` : '—'}
                    subtitle={`n=${s.hbN}`}
                  />
                  <StatRow
                    label="Anaemia Prevalence"
                    value={fmt(s.anaemiaRate)}
                    subtitle={`n=${s.anaemiaN}/${s.anaemiaRowsN} (Hb <13 M / <12 F)`}
                    color={s.anaemiaRate != null && s.anaemiaRate > 30 ? 'text-rose-400' : 'text-white'}
                  />
                </div>
              </div>
              {s.bnpN === 0 && s.egfrN === 0 && (
                <p className="text-xs text-gray-500 italic">No biomarker data recorded yet — enter lab values in patient visits to populate this panel.</p>
              )}
            </div>
          )}

          {/* ── Medication & GDMT ─────────────────────────────────────── */}
          {activeTab === 'medication' && (
            <div className="glass-card p-5 space-y-4">
              <h3 className="text-sm font-semibold text-white pb-2 border-b border-blue-500/10 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-cyan-400" /> GDMT 4-Pillar Adherence — HFrEF Patients Only
              </h3>
              {s.hfN === 0 ? (
                <p className="text-xs text-gray-500">No HFrEF patients with visit data recorded yet.</p>
              ) : (
                <div className="space-y-3 text-xs">
                  <p className="text-[10px] text-gray-500">Based on {s.hfN} HFrEF patients with a recorded visit</p>
                  <ProgressBar label="RAASI / ARNI" rate={s.raasiRate} n={s.raasiN} den={s.hfN} color="bg-blue-500" />
                  <ProgressBar label="Beta-Blocker" rate={s.betaRate}  n={s.betaN}  den={s.hfN} color="bg-violet-500" />
                  <ProgressBar label="Mineralocorticoid Antagonist (MRA)" rate={s.mraRate} n={s.mraN} den={s.hfN} color="bg-emerald-500" />
                  <ProgressBar label="SGLT2 Inhibitor" rate={s.sglt2Rate} n={s.sglt2N} den={s.hfN} color="bg-cyan-500" />
                  <div className="mt-3 pt-3 border-t border-blue-500/10">
                    <ProgressBar label="Quadruple Therapy (All 4 pillars)" rate={s.quadRate} n={s.quadN} den={s.hfN} color="bg-amber-500" />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Outcomes ─────────────────────────────────────────────── */}
          {activeTab === 'outcomes' && (
            <div className="glass-card p-5 space-y-4">
              <h3 className="text-sm font-semibold text-white pb-2 border-b border-blue-500/10 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-violet-400" /> Clinical Outcomes
              </h3>
              <div className="grid grid-cols-2 gap-4 text-center">
                <div className="dark-card p-4">
                  <p className="text-[10px] text-gray-500 uppercase">Registry Mortality Rate</p>
                  <p className="text-2xl font-bold text-white mt-1">{dash(fmt(s.mortalityRate))}</p>
                  <p className="text-[10px] text-gray-600 mt-1">{s.deceased} deceased / {s.total} enrolled</p>
                </div>
                <div className="dark-card p-4">
                  <p className="text-[10px] text-gray-500 uppercase">Prior HF Hospitalisation</p>
                  <p className="text-2xl font-bold text-white mt-1">{dash(fmt(s.hospRate))}</p>
                  <p className="text-[10px] text-gray-600 mt-1">{s.hospN} patients with h/o admission</p>
                </div>
                <div className="dark-card p-4 col-span-2">
                  <p className="text-[10px] text-gray-500 uppercase">NYHA III / IV — Advanced Symptom Burden</p>
                  <p className="text-xl font-bold text-amber-400 mt-1">{dash(fmt(pct(s.nyha34, s.wN)))}</p>
                  <p className="text-[10px] text-gray-600 mt-1">{s.nyha34} of {s.wN} patients with visit data</p>
                </div>
              </div>
              <div className="bg-blue-500/5 p-3 rounded-xl border border-blue-500/10 text-xs text-gray-400">
                <p className="font-semibold text-blue-400 mb-1 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5" /> Longitudinal Outcomes Note
                </p>
                <p>Time-to-event metrics — Kaplan–Meier survival curves, MACE rates, 30-day readmission — require prospective structured event capture. Enable the Outcome Events module to track these endpoints prospectively per patient.</p>
              </div>
            </div>
          )}

          {/* ── Preventive ───────────────────────────────────────────── */}
          {activeTab === 'preventive' && (
            <div className="glass-card p-5 space-y-4">
              <h3 className="text-sm font-semibold text-white pb-2 border-b border-blue-500/10 flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-400" /> Risk Factor Target Control (Latest Visit per Patient)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
                <div className="space-y-3">
                  <p className="font-semibold text-white">Computed from Registry Data</p>
                  <StatRow label="BP Control (<130/80 mmHg)" value={fmt(s.bpCtrlRate)} subtitle={`n=${s.bpN} with BP recorded`} />
                  <StatRow label="LDL Target (<55 mg/dL)" value={fmt(s.ldlCtrlRate)} subtitle={`n=${s.ldlN} with LDL data`} />
                  <StatRow label="HbA1c Control (<7.0%)" value={fmt(s.hba1cCtrlRate)} subtitle={`n=${s.hba1cN} with HbA1c data`} />
                </div>
                <div className="space-y-3">
                  <p className="font-semibold text-white flex items-center gap-1.5 text-[10px]">
                    <Info className="w-3 h-3 text-gray-500" /> Not Currently Captured
                  </p>
                  <div className="bg-gray-900/50 rounded-xl p-3 border border-gray-700/30 space-y-2 text-[10px] text-gray-500">
                    <p>• Cardiac rehabilitation enrollment — not a registry field</p>
                    <p>• Smoking cessation outcomes — not tracked</p>
                    <p>• Physical activity levels — requires PRO forms</p>
                    <p className="text-blue-400 mt-2">→ Add these as custom registry fields to enable real-time reporting</p>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* ── Right Sidebar ─────────────────────────────────────────── */}
        <div className="lg:col-span-4 space-y-6">

          {/* Registry summary */}
          <div className="glass-card p-5 space-y-4">
            <h3 className="text-sm font-semibold text-white pb-2 border-b border-blue-500/10 flex items-center gap-2">
              <Database className="w-4 h-4 text-blue-400" /> Registry Summary
            </h3>
            <div className="space-y-2">
              <StatRow label="Total Enrolled"         value={dash(s.total)} />
              <StatRow label="With Visit Data"        value={dash(s.wN)} />
              <StatRow label="With LVEF Recorded"     value={dash(s.lvefN)} />
              <StatRow label="HFrEF Patients"         value={dash(s.hfrEF)} />
              <StatRow label="Deceased"               value={dash(s.deceased)} color={s.deceased > 0 ? 'text-rose-400' : 'text-white'} />
            </div>
          </div>

          {/* Data source note */}
          <div className="glass-card p-5 space-y-3">
            <h3 className="text-sm font-semibold text-white pb-2 border-b border-blue-500/10 flex items-center gap-2">
              <Zap className="w-4 h-4 text-violet-400" /> Data Sources
            </h3>
            <div className="space-y-2 text-xs text-gray-400">
              <div className="flex items-start gap-2">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
                <span>All KPIs computed live from Firestore patient and visit records</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
                <span>GDMT rates are HFrEF-specific (ESC 2023 pillars)</span>
              </div>
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                <span>MACE, Kaplan–Meier survival, and 30-day readmission require the Outcome Events module</span>
              </div>
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                <span>Biomarker averages reflect data completeness of visit entries</span>
              </div>
            </div>
          </div>

          {/* Scope note */}
          <div className="bg-blue-500/5 p-4 rounded-2xl border border-blue-500/10 space-y-2 text-xs">
            <p className="font-semibold text-blue-400 flex items-center gap-1.5">
              <Smartphone className="w-4 h-4" /> Registry Scope
            </p>
            <p className="text-gray-400 leading-normal text-[11px]">
              This dashboard is scoped to the Heart Failure longitudinal registry. Cath lab metrics (STEMI D2B, PCI success, radial access) and structural heart outcomes require separate procedure-specific registries with dedicated data capture forms.
            </p>
          </div>

        </div>
      </div>
    </div>
  )
}
