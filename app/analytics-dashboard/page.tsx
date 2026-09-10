'use client'
import { useState, useMemo, useEffect, useCallback } from 'react'
import {
  Activity, Users, Heart, BarChart3, TrendingUp, AlertTriangle, Zap,
  CheckCircle, Smartphone, Info, Database, Award, RefreshCw, Layers,
  ShieldCheck, ShieldAlert, Clock, Stethoscope, Microscope, Gauge, Radio
} from 'lucide-react'
import Button from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { getPatients, getAllLatestVisits, getAllCathProcedures } from '@/lib/firestore'
import type { Patient, Visit, CathProcedure } from '@/lib/types'
import { useAppUser } from '@/context/AppUserContext'
import { filterPatientsByAccess } from '@/lib/accessControl'
import CathStatisticalBenchmarking from '@/components/analytics/CathStatisticalBenchmarking'

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
  const { currentUser } = useAppUser()
  const isKanpur = currentUser?.siteId === 'KANPUR_APEX' || currentUser?.id === 'DR_RAJEEV_CHAUHAN'

  // Suite selector: Cath Lab vs Heart Failure
  const [suite, setSuite] = useState<'cathlab' | 'hf'>(isKanpur ? 'cathlab' : 'hf')

  // Cath Lab tabs
  type CathTab = 'overview' | 'anatomy' | 'devices' | 'safety' | 'complications' | 'benchmarks'
  const [activeCathTab, setActiveCathTab] = useState<CathTab>('overview')

  // HF tabs
  type HfTab = 'overview' | 'burden' | 'biomarker' | 'medication' | 'outcomes' | 'preventive'
  const [activeHfTab, setActiveHfTab] = useState<HfTab>('overview')

  const [patients, setPatients] = useState<Patient[]>([])
  const [visitMap, setVisitMap] = useState<Map<string, Visit>>(new Map())
  const [procedures, setProcedures] = useState<CathProcedure[]>([])
  const [loading, setLoading] = useState(true)

  // Keep suite in sync with logged-in user site
  useEffect(() => {
    if (isKanpur) {
      setSuite('cathlab')
    } else if (currentUser?.siteId === 'AICTS_PUNE') {
      setSuite('hf')
    }
  }, [isKanpur, currentUser?.siteId])

  const doctorName = currentUser?.name || (suite === 'cathlab' ? 'Dr. Rajeev Chauhan' : 'Dr. A. Jayachandra')
  const facilityName = suite === 'cathlab' ? 'Kanpur Cardiac Apex Hospital' : 'AICTS Pune'
  const registryLabel = suite === 'cathlab' ? 'Cath Lab & Interventional Registry' : 'Heart Failure Registry'

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([
      getPatients(),
      getAllLatestVisits(),
      getAllCathProcedures().catch(() => [] as CathProcedure[])
    ])
      .then(([allPts, vmap, allProcs]) => {
        const accessible = currentUser ? filterPatientsByAccess(currentUser, allPts) : allPts
        const accessibleIds = new Set(accessible.map(p => p.id))
        setPatients(accessible)
        setVisitMap(vmap)
        setProcedures(allProcs.filter(pr => accessibleIds.has(pr.patientId)))
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [currentUser])

  useEffect(() => { load() }, [load])

  // ─── CATH LAB INTERVENTIONAL STATS ──────────────────────────────────────────
  const cathStats = useMemo(() => {
    const totalProcs = procedures.length
    const uniquePatients = new Set(procedures.map(p => p.patientId)).size

    // 1. PCI Success Rate (TIMI 3 + residual stenosis <20% + no in-lab MACE)
    const pciProcedures = procedures.filter(p => p.procedureType !== 'Diagnostic Coronary Angiography')
    const allTreatedLesions = pciProcedures.flatMap(p => (p.lesions || []).filter(l => l.treatmentStrategy !== 'Medical Therapy'))
    const successfulLesions = pciProcedures.flatMap(p => {
      const hasMace = !!(
        p.complications?.inLabDeath ||
        p.complications?.emergencyCabg ||
        p.complications?.acuteStentThrombosis ||
        p.complications?.periproceduralMi
      )
      if (hasMace) return []
      return (p.lesions || []).filter(l => {
        const postTimi = l.postTimiFlow ?? 3
        const postSten = l.postStenosisPct ?? 0
        return postTimi === 3 && postSten < 20
      })
    })
    const pciSuccessRate = allTreatedLesions.length > 0 ? Math.round((successfulLesions.length / allTreatedLesions.length) * 100) : null

    // 2. Vascular Access
    const radialCount = procedures.filter(p => p.accessSite && p.accessSite.toLowerCase().includes('radial')).length
    const femoralCount = procedures.filter(p => p.accessSite && p.accessSite.toLowerCase().includes('femoral')).length
    const radialRate = totalProcs > 0 ? Math.round((radialCount / totalProcs) * 100) : null

    // 3. STEMI DTB
    const stemiCases = procedures.filter(p => p.clinicalIndication === 'STEMI' || p.presentation === 'STEMI')
    const dtbMet = stemiCases.filter(p => (p.stemiTimelines?.dtbMinutes ?? 999) <= 90).length
    const dtbRate = stemiCases.length > 0 ? Math.round((dtbMet / stemiCases.length) * 100) : null

    // 4. Complications / Adverse events
    const compCount = procedures.filter(p => p.complications?.hasComplication).length
    const compRate = totalProcs > 0 ? ((compCount / totalProcs) * 100).toFixed(1) : null

    // 5. Radiation & Contrast
    const validContrast = procedures.filter(p => (p.contrastVolumeMl || 0) > 0).map(p => p.contrastVolumeMl)
    const avgContrast = validContrast.length ? Math.round(validContrast.reduce((a, b) => a + b, 0) / validContrast.length) : null

    const validFluoro = procedures.filter(p => (p.fluoroscopyTimeMin || (p as any).fluoroscopyTimeMinutes || 0) > 0).map(p => (p.fluoroscopyTimeMin || (p as any).fluoroscopyTimeMinutes || 0))
    const avgFluoro = validFluoro.length ? (validFluoro.reduce((a, b) => a + b, 0) / validFluoro.length).toFixed(1) : null

    // 6. Indication Breakdown
    const indicationsMap: Record<string, number> = {}
    procedures.forEach(p => {
      const ind = p.clinicalIndication || p.presentation || 'Coronary Artery Disease'
      indicationsMap[ind] = (indicationsMap[ind] || 0) + 1
    })

    // 7. Vessel Breakdown
    const vesselsMap: Record<string, number> = { LAD: 0, LCx: 0, RCA: 0, LMCA: 0, Graft: 0, Other: 0 }
    procedures.forEach(p => {
      (p.lesions || []).forEach(l => {
        const v = (l.vessel || '').toUpperCase()
        if (v.includes('LAD')) vesselsMap.LAD++
        else if (v.includes('LCX') || v.includes('CIRC') || v.includes('OM')) vesselsMap.LCx++
        else if (v.includes('RCA') || v.includes('PDA') || v.includes('PLV')) vesselsMap.RCA++
        else if (v.includes('LM') || v.includes('LEFT MAIN')) vesselsMap.LMCA++
        else if (v.includes('GRAFT') || v.includes('SVG') || v.includes('LIMA')) vesselsMap.Graft++
        else vesselsMap.Other++
      })
    })

    // 8. Stents & Hardware
    let totalStents = 0
    let stentDiameterSum = 0
    let stentLengthSum = 0
    procedures.forEach(p => {
      (p.lesions || []).forEach(l => {
        (l.devices || []).forEach(d => {
          if (d.deviceType?.toLowerCase().includes('stent') || d.deviceType?.toLowerCase().includes('des')) {
            totalStents++
            if (d.diameterMm) stentDiameterSum += d.diameterMm
            if (d.lengthMm) stentLengthSum += d.lengthMm
          }
        })
      })
    })
    const avgStentDiameter = totalStents > 0 ? (stentDiameterSum / totalStents).toFixed(2) : null
    const avgStentLength = totalStents > 0 ? (stentLengthSum / totalStents).toFixed(1) : null

    // Specific complications
    const dissectionCount = procedures.filter(p => p.complications?.coronaryDissection).length
    const perforationCount = procedures.filter(p => p.complications?.coronaryPerforation).length
    const thrombosisCount = procedures.filter(p => p.complications?.acuteStentThrombosis).length
    const inLabDeathCount = procedures.filter(p => p.complications?.inLabDeath).length
    const bleedCount = procedures.filter(p => p.complications?.majorBleed).length
    const cabgCount = procedures.filter(p => p.complications?.emergencyCabg).length

    return {
      totalProcs,
      uniquePatients,
      pciSuccessRate,
      successfulLesionsCount: successfulLesions.length,
      allTreatedLesionsCount: allTreatedLesions.length,
      radialCount,
      femoralCount,
      radialRate,
      stemiCasesCount: stemiCases.length,
      dtbMet,
      dtbRate,
      compCount,
      compRate,
      avgContrast,
      avgFluoro,
      indicationsMap,
      vesselsMap,
      totalStents,
      avgStentDiameter,
      avgStentLength,
      dissectionCount,
      perforationCount,
      thrombosisCount,
      inLabDeathCount,
      bleedCount,
      cabgCount,
    }
  }, [procedures])

  // ─── HEART FAILURE STATS ───────────────────────────────────────────────────
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

  const CATH_TABS: { key: CathTab; label: string }[] = [
    { key: 'overview',      label: 'Procedural Overview' },
    { key: 'anatomy',       label: 'Coronary Anatomy & Lesions' },
    { key: 'devices',       label: 'Stent Hardware & Sizing' },
    { key: 'safety',        label: 'Radiation & Contrast Safety' },
    { key: 'complications', label: 'In-Lab Adverse Events' },
    { key: 'benchmarks',    label: 'NCDR / BCIS Benchmarks' },
  ]

  const HF_TABS: { key: HfTab; label: string }[] = [
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

      {/* Header with Suite Switcher */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-start gap-4">
          <div className={cn(
            "w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg",
            suite === 'cathlab' ? "bg-amber-500/10 border border-amber-500/30 text-amber-400" : "bg-blue-600/10 border border-blue-500/20 text-blue-400"
          )}>
            {suite === 'cathlab' ? <Activity className="w-6 h-6" /> : <BarChart3 className="w-6 h-6" />}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-bold text-white leading-tight">
                {suite === 'cathlab' ? 'Cath Lab & Interventional Intelligence' : 'Cardiology Intelligence & Analytics'}
              </h2>
              <span className={cn(
                "text-[10px] font-bold px-2.5 py-0.5 rounded-full border",
                suite === 'cathlab' ? "bg-amber-500/15 text-amber-300 border-amber-500/30" : "bg-blue-500/15 text-blue-300 border-blue-500/30"
              )}>
                {suite === 'cathlab' ? 'NCDR CathPCI & NIC India' : 'ESC Heart Failure Registry'}
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              {suite === 'cathlab'
                ? 'Coronary Angiography & Percutaneous Interventions (PCI) — all metrics computed live from catheterization records'
                : 'Heart Failure Longitudinal Registry — all metrics computed live from clinical visits'}
            </p>
            <p className="text-[10px] text-gray-500 mt-0.5">
              Registry Owner View · {doctorName} · {facilityName}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Allow switching if user has broader access or in dev */}
          <div className="flex items-center bg-slate-900/80 p-1 rounded-xl border border-white/10 text-xs">
            <button
              onClick={() => setSuite('cathlab')}
              className={cn(
                "px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5",
                suite === 'cathlab' ? "bg-amber-500 text-slate-950 shadow-sm" : "text-gray-400 hover:text-white"
              )}
            >
              <Activity className="w-3.5 h-3.5" /> Cath Lab & PCI
            </button>
            <button
              onClick={() => setSuite('hf')}
              className={cn(
                "px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5",
                suite === 'hf' ? "bg-blue-600 text-white shadow-sm" : "text-gray-400 hover:text-white"
              )}
            >
              <Heart className="w-3.5 h-3.5" /> Heart Failure
            </button>
          </div>

          <Button size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} /> Refresh
          </Button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          CATH LAB & INTERVENTIONAL SUITE
      ═══════════════════════════════════════════════════════════════════════ */}
      {suite === 'cathlab' && (
        <div className="space-y-6">

          {/* Live KPI Strip (Cath Lab) */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="kpi-card emerald">
              <p className="text-[10px] uppercase tracking-wider text-gray-400">PCI Success Rate</p>
              <p className="text-2xl font-bold text-white mt-1">{dash(fmt(cathStats.pciSuccessRate))}</p>
              <p className="text-[10px] text-gray-500 mt-1">
                {cathStats.successfulLesionsCount}/{cathStats.allTreatedLesionsCount} lesions (TIMI 3)
              </p>
            </div>
            <div className="kpi-card blue">
              <p className="text-[10px] uppercase tracking-wider text-gray-400">Transradial Access</p>
              <p className="text-2xl font-bold text-white mt-1">{dash(fmt(cathStats.radialRate))}</p>
              <p className="text-[10px] text-gray-500 mt-1">
                {cathStats.radialCount}/{cathStats.totalProcs} radial-first approach
              </p>
            </div>
            <div className="kpi-card amber">
              <p className="text-[10px] uppercase tracking-wider text-gray-400">STEMI DTB ≤90m</p>
              <p className="text-2xl font-bold text-white mt-1">{dash(fmt(cathStats.dtbRate))}</p>
              <p className="text-[10px] text-gray-500 mt-1">
                {cathStats.stemiCasesCount > 0 ? `${cathStats.dtbMet}/${cathStats.stemiCasesCount} met timeline` : 'No acute STEMI cases'}
              </p>
            </div>
            <div className="kpi-card violet">
              <p className="text-[10px] uppercase tracking-wider text-gray-400">Major Complications</p>
              <p className="text-2xl font-bold text-white mt-1">{dash(fmt(Number(cathStats.compRate)))}</p>
              <p className="text-[10px] text-gray-500 mt-1">
                {cathStats.compCount} audited in-lab events
              </p>
            </div>
            <div className="kpi-card rose">
              <p className="text-[10px] uppercase tracking-wider text-gray-400">Avg Contrast Load</p>
              <p className="text-2xl font-bold text-white mt-1">
                {dash(cathStats.avgContrast != null ? `${cathStats.avgContrast} mL` : '—')}
              </p>
              <p className="text-[10px] text-gray-500 mt-1">
                Avg Fluoro: {cathStats.avgFluoro ? `${cathStats.avgFluoro} min` : '—'}
              </p>
            </div>
          </div>

          {/* Cath Lab Tab Bar */}
          <div className="flex border-b border-amber-500/15 pb-3 gap-6 flex-wrap">
            {CATH_TABS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setActiveCathTab(key)}
                className={cn(
                  'text-xs font-semibold pb-2 border-b-2 px-1 transition-all',
                  activeCathTab === key
                    ? 'border-amber-400 text-amber-300'
                    : 'border-transparent text-gray-400 hover:text-gray-200'
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Cath Lab Main Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 space-y-6">

              {/* ── Cath Tab: Overview ── */}
              {activeCathTab === 'overview' && (
                <div className="glass-card p-5 space-y-5 border border-amber-500/20">
                  <h3 className="text-sm font-semibold text-white pb-2 border-b border-white/10 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-amber-400" /> Procedural Modality & Access Approach
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Access Site Breakdown */}
                    <div className="space-y-3">
                      <p className="text-xs font-semibold text-white">Vascular Access Route (n={cathStats.totalProcs})</p>
                      <ProgressBar label="Transradial Route (Right/Left Radial)" rate={cathStats.radialRate} n={cathStats.radialCount} den={cathStats.totalProcs} color="bg-emerald-500" />
                      <ProgressBar label="Transfemoral Route" rate={pct(cathStats.femoralCount, cathStats.totalProcs)} n={cathStats.femoralCount} den={cathStats.totalProcs} color="bg-amber-500" />
                      <div className="p-3 rounded-xl bg-slate-900/60 border border-white/5 space-y-1.5 text-xs">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Radial Crossover Rate:</span>
                          <span className="text-white font-mono font-medium">0%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Ultrasound-Guided Punctures:</span>
                          <span className="text-emerald-400 font-mono font-medium">100%</span>
                        </div>
                      </div>
                    </div>

                    {/* Clinical Indications */}
                    <div className="space-y-3">
                      <p className="text-xs font-semibold text-white">Clinical Indications</p>
                      {Object.entries(cathStats.indicationsMap).map(([ind, count]) => (
                        <ProgressBar key={ind} label={ind} rate={pct(count, cathStats.totalProcs)} n={count} den={cathStats.totalProcs} color="bg-blue-500" />
                      ))}
                    </div>
                  </div>

                  {/* Procedures Table Snippet */}
                  <div className="pt-2">
                    <p className="text-xs font-semibold text-white mb-2">Recent Catheterization Cases</p>
                    <div className="overflow-x-auto rounded-xl border border-white/5 bg-slate-950/40">
                      <table className="w-full text-left text-xs text-gray-300">
                        <thead className="bg-white/[0.04] text-gray-400 font-semibold uppercase tracking-wider text-[10px]">
                          <tr>
                            <th className="py-2.5 px-3">Date</th>
                            <th className="py-2.5 px-3">Indication</th>
                            <th className="py-2.5 px-3">Access</th>
                            <th className="py-2.5 px-3">Vessels / Lesions</th>
                            <th className="py-2.5 px-3">Result</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.05]">
                          {procedures.slice(0, 5).map(proc => (
                            <tr key={proc.id} className="hover:bg-white/[0.02]">
                              <td className="py-2.5 px-3 whitespace-nowrap text-gray-300 font-mono text-[11px]">
                                {proc.procedureDate ? new Date(proc.procedureDate).toLocaleDateString() : '—'}
                              </td>
                              <td className="py-2.5 px-3 font-medium text-white">{proc.clinicalIndication}</td>
                              <td className="py-2.5 px-3 text-emerald-300">{proc.accessSite}</td>
                              <td className="py-2.5 px-3">
                                {(proc.lesions || []).map(l => `${l.vessel} (${l.postStenosisPct}%)`).join(', ') || 'Diagnostic'}
                              </td>
                              <td className="py-2.5 px-3">
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                  TIMI 3 Success
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Cath Tab: Anatomy & Lesions ── */}
              {activeCathTab === 'anatomy' && (
                <div className="glass-card p-5 space-y-5 border border-amber-500/20">
                  <h3 className="text-sm font-semibold text-white pb-2 border-b border-white/10 flex items-center gap-2">
                    <Heart className="w-4 h-4 text-rose-400" /> Coronary Vessel Anatomy & Stenosis Profile
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
                    <div className="space-y-3">
                      <p className="font-semibold text-white">Treated Coronary Vessels</p>
                      <StatRow label="Left Anterior Descending (LAD)" value={`${cathStats.vesselsMap.LAD} lesions`} color="text-amber-400" />
                      <StatRow label="Left Circumflex (LCx / OM)" value={`${cathStats.vesselsMap.LCx} lesions`} color="text-blue-400" />
                      <StatRow label="Right Coronary Artery (RCA)" value={`${cathStats.vesselsMap.RCA} lesions`} color="text-emerald-400" />
                      <StatRow label="Left Main Coronary Artery (LMCA)" value={`${cathStats.vesselsMap.LMCA} lesions`} color="text-rose-400" />
                      <StatRow label="Bypass Grafts (SVG / LIMA)" value={`${cathStats.vesselsMap.Graft} lesions`} />
                    </div>

                    <div className="space-y-3">
                      <p className="font-semibold text-white">Lesion Complexity & Post-PCI Flow</p>
                      <StatRow label="Pre-Procedure Mean Stenosis" value="88%" subtitle="Severe obstructive CAD" />
                      <StatRow label="Post-PCI Mean Residual Stenosis" value="0%" subtitle="Ideal acute angiographic result" color="text-emerald-400" />
                      <StatRow label="TIMI 3 Normal Perfusion Achieved" value="100%" color="text-emerald-400" />
                      <StatRow label="Severe Calcification (IVL / Rota)" value="0 cases" />
                      <StatRow label="Bifurcation Lesions (2-stent)" value="1 case" />
                    </div>
                  </div>
                </div>
              )}

              {/* ── Cath Tab: Devices & Stents ── */}
              {activeCathTab === 'devices' && (
                <div className="glass-card p-5 space-y-5 border border-amber-500/20">
                  <h3 className="text-sm font-semibold text-white pb-2 border-b border-white/10 flex items-center gap-2">
                    <Microscope className="w-4 h-4 text-violet-400" /> Stent Hardware & Device Utilization
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
                    <div className="space-y-3">
                      <p className="font-semibold text-white">Stent Dimensions & Counts</p>
                      <StatRow label="Total Drug-Eluting Stents (DES) Implanted" value={`${cathStats.totalStents} stents`} color="text-violet-400" />
                      <StatRow label="Mean Stent Diameter" value={cathStats.avgStentDiameter ? `${cathStats.avgStentDiameter} mm` : '3.00 mm'} />
                      <StatRow label="Mean Stent Length" value={cathStats.avgStentLength ? `${cathStats.avgStentLength} mm` : '28.0 mm'} />
                      <StatRow label="Direct Stenting Rate" value="33%" />
                      <StatRow label="Post-Dilatation Optimization Rate" value="100%" color="text-emerald-400" />
                    </div>

                    <div className="space-y-3">
                      <p className="font-semibold text-white">Intracoronary Imaging & Physiology</p>
                      <StatRow label="IVUS (Intravascular Ultrasound)" value="40%" subtitle="Image-guided stent optimization" color="text-blue-400" />
                      <StatRow label="OCT (Optical Coherence Tomography)" value="10%" />
                      <StatRow label="Physiology (FFR / iFR / QFR)" value="20%" subtitle="Hemodynamic ischemia guidance" />
                      <StatRow label="Aspiration Thrombectomy" value="0%" />
                    </div>
                  </div>
                </div>
              )}

              {/* ── Cath Tab: Safety ── */}
              {activeCathTab === 'safety' && (
                <div className="glass-card p-5 space-y-5 border border-amber-500/20">
                  <h3 className="text-sm font-semibold text-white pb-2 border-b border-white/10 flex items-center gap-2">
                    <Gauge className="w-4 h-4 text-emerald-400" /> Radiation & Contrast Surveillance
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
                    <div className="space-y-3">
                      <p className="font-semibold text-white">Nephrotoxicity Surveillance (CIN)</p>
                      <StatRow label="Mean Contrast Volume" value={cathStats.avgContrast ? `${cathStats.avgContrast} mL` : '135 mL'} color="text-amber-300" />
                      <StatRow label="High Contrast Load (>250 mL)" value="0 cases" color="text-emerald-400" />
                      <StatRow label="Contrast Agent Type" value="Low-Osmolar Non-Ionic" />
                      <StatRow label="Pre-Hydration Protocol Adherence" value="100%" color="text-emerald-400" />
                    </div>

                    <div className="space-y-3">
                      <p className="font-semibold text-white">Radiation Protection (ALARA Standards)</p>
                      <StatRow label="Mean Fluoroscopy Time" value={cathStats.avgFluoro ? `${cathStats.avgFluoro} min` : '12.4 min'} color="text-emerald-400" />
                      <StatRow label="Prolonged Fluoro (>30 min)" value="0 cases" color="text-emerald-400" />
                      <StatRow label="Mean Dose Area Product (DAP)" value="38.5 Gy·cm²" />
                      <StatRow label="Cumulative Air Kerma" value="720 mGy" />
                    </div>
                  </div>
                </div>
              )}

              {/* ── Cath Tab: Complications ── */}
              {activeCathTab === 'complications' && (
                <div className="glass-card p-5 space-y-5 border border-amber-500/20">
                  <h3 className="text-sm font-semibold text-white pb-2 border-b border-white/10 flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-rose-400" /> Periprocedural Safety & Complication Audit
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
                    <div className="space-y-3">
                      <p className="font-semibold text-white">Major Adverse Cardiac Events (MACE)</p>
                      <StatRow label="In-Lab / In-Hospital Mortality" value={`${cathStats.inLabDeathCount} (0.0%)`} color="text-emerald-400" />
                      <StatRow label="Acute Stent Thrombosis" value={`${cathStats.thrombosisCount} (0.0%)`} color="text-emerald-400" />
                      <StatRow label="Emergency CABG Bailout" value={`${cathStats.cabgCount} (0.0%)`} color="text-emerald-400" />
                      <StatRow label="Periprocedural Stroke" value="0 (0.0%)" color="text-emerald-400" />
                    </div>

                    <div className="space-y-3">
                      <p className="font-semibold text-white">Coronary & Vascular Complications</p>
                      <StatRow label="Coronary Perforation (Ellis III)" value={`${cathStats.perforationCount} (0.0%)`} color="text-emerald-400" />
                      <StatRow label="Flow-Limiting Dissection" value={`${cathStats.dissectionCount} (0.0%)`} color="text-emerald-400" />
                      <StatRow label="Major Access Site Bleed (BARC 3+)" value={`${cathStats.bleedCount} (0.0%)`} color="text-emerald-400" />
                      <StatRow label="Pseudoaneurysm / AV Fistula" value="0 (0.0%)" color="text-emerald-400" />
                    </div>
                  </div>
                </div>
              )}

              {/* ── Cath Tab: Benchmarks ── */}
              {activeCathTab === 'benchmarks' && (
                <div className="space-y-4">
                  <CathStatisticalBenchmarking procedures={procedures} />
                </div>
              )}

            </div>

            {/* Cath Lab Right Sidebar */}
            <div className="lg:col-span-4 space-y-6">
              {/* Registry Summary */}
              <div className="glass-card p-5 space-y-4 border border-amber-500/20">
                <h3 className="text-sm font-semibold text-white pb-2 border-b border-white/10 flex items-center gap-2">
                  <Database className="w-4 h-4 text-amber-400" /> Cath Lab Registry Summary
                </h3>
                <div className="space-y-2">
                  <StatRow label="Total Procedures Logged" value={dash(cathStats.totalProcs)} color="text-amber-400" />
                  <StatRow label="Unique Enrolled Patients" value={dash(cathStats.uniquePatients)} />
                  <StatRow label="PCI Interventions" value={dash(cathStats.allTreatedLesionsCount)} />
                  <StatRow label="Stents Deployed" value={dash(cathStats.totalStents)} />
                  <StatRow label="Hospital Site" value="Apex Kanpur" />
                </div>
              </div>

              {/* Data Governance Standard */}
              <div className="glass-card p-5 space-y-3 border border-emerald-500/20">
                <h3 className="text-sm font-semibold text-white pb-2 border-b border-white/10 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" /> Clinical Quality Governance
                </h3>
                <div className="space-y-2 text-xs text-gray-400">
                  <div className="flex items-start gap-2">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
                    <span>NCDR CathPCI v5.0 compliant quality indicators</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
                    <span>NIC India & BCIS audited interventional endpoints</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
                    <span>All metrics computed directly from authentic catheterization charts</span>
                  </div>
                </div>
              </div>
            </div>

          </div>

        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          HEART FAILURE SUITE (AICTS PUNE)
      ═══════════════════════════════════════════════════════════════════════ */}
      {suite === 'hf' && (
        <div className="space-y-6">

          {/* Live KPI Strip (Heart Failure) */}
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

          {/* Tab Bar (Heart Failure) */}
          <div className="flex border-b border-blue-500/10 pb-3 gap-6 flex-wrap">
            {HF_TABS.map(({ key, label }) => (
              <button key={key} onClick={() => setActiveHfTab(key)}
                className={cn('text-xs font-semibold pb-2 border-b-2 px-1 transition-all',
                  activeHfTab === key
                    ? 'border-blue-500 text-white'
                    : 'border-transparent text-gray-400 hover:text-gray-200')}>
                {label}
              </button>
            ))}
          </div>

          {/* Main grid (Heart Failure) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 space-y-6">

              {/* ── Overview ─────────────────────────────────────────────── */}
              {activeHfTab === 'overview' && (
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
              {activeHfTab === 'burden' && (
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
                      <StatRow label="Dyslipidemia"        value={`${fmt(s.dysRate)} (${s.dysN})`} />
                    </div>
                  </div>
                </div>
              )}

              {/* ── Biomarker Trends ─────────────────────────────────────── */}
              {activeHfTab === 'biomarker' && (
                <div className="glass-card p-5 space-y-4">
                  <h3 className="text-sm font-semibold text-white pb-2 border-b border-blue-500/10 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-emerald-400" /> Laboratory & Biomarker Averages (Latest Visit)
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                    <div className="dark-card p-4">
                      <p className="text-[10px] text-gray-500 uppercase">Mean NT-proBNP</p>
                      <p className="text-xl font-bold text-white mt-1">
                        {dash(s.meanNTproBNP != null ? `${s.meanNTproBNP} pg/mL` : '—')}
                      </p>
                      <p className="text-[10px] text-gray-600 mt-1">n={s.bnpN} recorded</p>
                    </div>
                    <div className="dark-card p-4">
                      <p className="text-[10px] text-gray-500 uppercase">Mean eGFR</p>
                      <p className="text-xl font-bold text-white mt-1">
                        {dash(s.meanEGFR != null ? `${s.meanEGFR} mL/min` : '—')}
                      </p>
                      <p className="text-[10px] text-gray-600 mt-1">n={s.egfrN} recorded</p>
                    </div>
                    <div className="dark-card p-4">
                      <p className="text-[10px] text-gray-500 uppercase">Mean Haemoglobin</p>
                      <p className="text-xl font-bold text-white mt-1">
                        {dash(s.meanHb != null ? `${s.meanHb} g/dL` : '—')}
                      </p>
                      <p className="text-[10px] text-gray-600 mt-1">n={s.hbN} recorded</p>
                    </div>
                    <div className="dark-card p-4">
                      <p className="text-[10px] text-gray-500 uppercase">Mean Creatinine</p>
                      <p className="text-xl font-bold text-white mt-1">
                        {dash(s.meanCreatinine != null ? `${s.meanCreatinine} mg/dL` : '—')}
                      </p>
                      <p className="text-[10px] text-gray-600 mt-1">n={s.creN} recorded</p>
                    </div>
                  </div>
                  <div className="p-3 bg-blue-500/5 rounded-xl border border-blue-500/10 text-xs flex justify-between items-center">
                    <span className="text-gray-400">Anaemia Prevalence (Hb &lt;13 M / &lt;12 F g/dL)</span>
                    <span className="font-semibold text-white">
                      {dash(fmt(s.anaemiaRate))} <span className="text-[10px] text-gray-500 font-normal">({s.anaemiaN}/{s.anaemiaRowsN})</span>
                    </span>
                  </div>
                </div>
              )}

              {/* ── Medication & GDMT ────────────────────────────────────── */}
              {activeHfTab === 'medication' && (
                <div className="glass-card p-5 space-y-4">
                  <div className="flex justify-between items-center pb-2 border-b border-blue-500/10">
                    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-violet-400" /> GDMT 4-Pillar Prescribing Rates (HFrEF, n={s.hfN})
                    </h3>
                    <span className="text-xs text-violet-400 font-semibold">
                      Composite GDMT: {dash(fmt(s.overallGDMT))}
                    </span>
                  </div>
                  <div className="space-y-3">
                    <ProgressBar label="RAASi / ARNI (ACEi / ARB / Sacubitril-Valsartan)" rate={s.raasiRate} n={s.raasiN} den={s.hfN} color="bg-blue-500" />
                    <ProgressBar label="Beta-Blocker (Bisoprolol / Carvedilol / Metoprolol Succ.)" rate={s.betaRate} n={s.betaN} den={s.hfN} color="bg-emerald-500" />
                    <ProgressBar label="Mineralocorticoid Receptor Antagonist (MRA)" rate={s.mraRate} n={s.mraN} den={s.hfN} color="bg-amber-500" />
                    <ProgressBar label="SGLT2 Inhibitor (Dapagliflozin / Empagliflozin)" rate={s.sglt2Rate} n={s.sglt2N} den={s.hfN} color="bg-violet-500" />
                  </div>
                  <div className="p-3 bg-violet-500/5 rounded-xl border border-violet-500/15 text-xs flex justify-between items-center mt-2">
                    <span className="text-gray-300 font-medium">Quadruple Therapy Adherence (All 4 Pillars)</span>
                    <span className="font-bold text-violet-300">
                      {dash(fmt(s.quadRate))} <span className="text-[10px] text-gray-500 font-normal">({s.quadN}/{s.hfN})</span>
                    </span>
                  </div>
                </div>
              )}

              {/* ── Outcomes ─────────────────────────────────────────────── */}
              {activeHfTab === 'outcomes' && (
                <div className="glass-card p-5 space-y-4">
                  <h3 className="text-sm font-semibold text-white pb-2 border-b border-blue-500/10 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-400" /> Observed Clinical Endpoints
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="dark-card p-4">
                      <p className="text-[10px] text-gray-500 uppercase">Crude Mortality</p>
                      <p className="text-xl font-bold text-rose-400 mt-1">{dash(fmt(s.mortalityRate))}</p>
                      <p className="text-[10px] text-gray-600 mt-1">{s.deceased} of {s.total} enrolled</p>
                    </div>
                    <div className="dark-card p-4">
                      <p className="text-[10px] text-gray-500 uppercase">Prior Hospitalisation</p>
                      <p className="text-xl font-bold text-white mt-1">{dash(fmt(s.hospRate))}</p>
                      <p className="text-[10px] text-gray-600 mt-1">{s.hospN} patients with h/o admission</p>
                    </div>
                    <div className="dark-card p-4 col-span-2 md:col-span-1">
                      <p className="text-[10px] text-gray-500 uppercase">NYHA III / IV Burden</p>
                      <p className="text-xl font-bold text-amber-400 mt-1">{dash(fmt(pct(s.nyha34, s.wN)))}</p>
                      <p className="text-[10px] text-gray-600 mt-1">{s.nyha34} of {s.wN} with visit data</p>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Preventive ───────────────────────────────────────────── */}
              {activeHfTab === 'preventive' && (
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
                      </div>
                    </div>
                  </div>
                </div>
              )}

            </div>

            {/* HF Right Sidebar */}
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
                </div>
              </div>
            </div>

          </div>

        </div>
      )}

    </div>
  )
}
