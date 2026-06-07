'use client'
import { useState, useEffect, useMemo } from 'react'
import { Brain, Zap, Users, ShieldAlert, Heart, TrendingUp, AlertTriangle,
         CheckCircle2, XCircle, Clock, BarChart2, Pill, Activity,
         ChevronRight, RefreshCw, Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getPatients, getVisits } from '@/lib/firestore'
import type { Patient, Visit } from '@/lib/types'
import {
  summarisePopulationML, evaluateGDMT, generateClinicalAlerts,
  computeMLRiskProfile, calculateCHA2DS2VASc, calculateHASBLED,
  scoreDataCompleteness,
} from '@/lib/clinicalIntelligence'
import Link from 'next/link'
import { Card } from '@/components/ui/Card'

// ─────────────────────────────────────────────────────────────────────────────

interface PatientWithVisits { patient: Patient; latestVisit: Visit; allVisits: Visit[] }

export default function InsightsPage() {
  const [data, setData] = useState<PatientWithVisits[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'population' | 'high-risk' | 'gdmt' | 'data-quality'>('population')
  const [lastRefresh, setLastRefresh] = useState(new Date())

  const load = async () => {
    setLoading(true)
    try {
      const patients = await getPatients()
      const result: PatientWithVisits[] = []
      for (const patient of patients) {
        const visits = await getVisits(patient.id)
        if (visits.length === 0) continue
        const latestVisit = [...visits].sort((a, b) =>
          new Date(b.visitDate).getTime() - new Date(a.visitDate).getTime()
        )[0]
        result.push({ patient, latestVisit, allVisits: visits })
      }
      setData(result)
      setLastRefresh(new Date())
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const visitsByPatient = useMemo(() => {
    const map: Record<string, Visit[]> = {}
    data.forEach(d => { map[d.patient.id] = d.allVisits })
    return map
  }, [data])

  const mlSummary = useMemo(() =>
    summarisePopulationML(data.map(d => d.patient), visitsByPatient),
    [data, visitsByPatient]
  )

  const highRiskPatients = useMemo(() =>
    data
      .map(d => ({
        ...d,
        risk: computeMLRiskProfile(d.patient, d.latestVisit, d.allVisits),
        alerts: generateClinicalAlerts(d.patient, d.latestVisit, d.allVisits),
      }))
      .filter(d => d.risk.riskCategory === 'High' || d.risk.riskCategory === 'Very High')
      .sort((a, b) => b.risk.oneYearEventProbability - a.risk.oneYearEventProbability),
    [data]
  )

  const gdmtGaps = useMemo(() =>
    data
      .map(d => ({ ...d, gdmt: evaluateGDMT(d.patient, d.latestVisit) }))
      .filter(d => d.gdmt.pillars.some(p => p.status === 'missing'))
      .sort((a, b) => a.gdmt.optimizationScore - b.gdmt.optimizationScore),
    [data]
  )

  const dataQuality = useMemo(() =>
    data
      .map(d => ({ ...d, completeness: scoreDataCompleteness(d.latestVisit) }))
      .sort((a, b) => a.completeness.overallPct - b.completeness.overallPct),
    [data]
  )

  // ─── KPI Cards ─────────────────────────────────────────────────────────────

  const kpis = [
    {
      label: 'High-Risk Patients',
      value: mlSummary.highRiskCount,
      total: data.length,
      icon: AlertTriangle,
      color: 'text-rose-400',
      bg: 'bg-rose-500/10',
      border: 'border-rose-500/20',
      tab: 'high-risk' as const,
    },
    {
      label: 'GDMT Gaps',
      value: mlSummary.gdmtGapCount,
      total: data.length,
      icon: Pill,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/20',
      tab: 'gdmt' as const,
    },
    {
      label: 'Unanticipatulated AF',
      value: mlSummary.unticoagulatedAFCount,
      total: data.length,
      icon: Heart,
      color: 'text-orange-400',
      bg: 'bg-orange-500/10',
      border: 'border-orange-500/20',
      tab: 'high-risk' as const,
    },
    {
      label: 'ICD Eligible',
      value: mlSummary.icdEligibleCount,
      total: data.length,
      icon: Zap,
      color: 'text-violet-400',
      bg: 'bg-violet-500/10',
      border: 'border-violet-500/20',
      tab: 'high-risk' as const,
    },
    {
      label: 'Avg Data Quality',
      value: mlSummary.avgDataCompleteness,
      total: 100,
      suffix: '%',
      icon: BarChart2,
      color: mlSummary.avgDataCompleteness >= 70 ? 'text-emerald-400' : 'text-amber-400',
      bg: mlSummary.avgDataCompleteness >= 70 ? 'bg-emerald-500/10' : 'bg-amber-500/10',
      border: mlSummary.avgDataCompleteness >= 70 ? 'border-emerald-500/20' : 'border-amber-500/20',
      tab: 'data-quality' as const,
    },
    {
      label: 'Iron Deficiency Gap',
      value: mlSummary.ironDeficiencyCount,
      total: data.length,
      icon: Activity,
      color: 'text-cyan-400',
      bg: 'bg-cyan-500/10',
      border: 'border-cyan-500/20',
      tab: 'gdmt' as const,
    },
  ]

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-violet-600/10 border border-violet-500/20 flex items-center justify-center">
            <Brain className="w-6 h-6 text-violet-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">AI Clinical Insights</h1>
            <p className="text-xs text-gray-400 mt-0.5">
              Population intelligence · {data.length} patients · Updated {lastRefresh.toLocaleTimeString()}
            </p>
          </div>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 text-xs text-blue-400 hover:text-blue-300 border border-blue-500/20 px-3 py-2 rounded-xl hover:bg-blue-500/5 transition-all"
        >
          <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {/* Model Info Banner */}
      <div className="bg-blue-500/5 border border-blue-500/15 rounded-xl p-3 flex items-start gap-2.5 text-xs text-gray-400">
        <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
        <p>
          <span className="text-blue-300 font-medium">Phase 1 — Clinical Rules Engine:</span>{' '}
          Risk scores derived from MAGGIC (Pocock 2013) + ESC 2023 guideline rules.
          Running entirely in-browser. When n &gt; 200 real patients, this upgrades to a trained XGBoost model via TF.js.
        </p>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpis.map(kpi => (
          <button
            key={kpi.label}
            onClick={() => setActiveTab(kpi.tab)}
            className={cn(
              'rounded-xl border p-4 text-left transition-all hover:scale-[1.02]',
              kpi.bg, kpi.border,
              activeTab === kpi.tab && 'ring-1 ring-blue-500/30'
            )}
          >
            <kpi.icon className={cn('w-4 h-4 mb-2', kpi.color)} />
            <p className={cn('text-xl font-extrabold', kpi.color)}>
              {kpi.value}{kpi.suffix ?? ''}
            </p>
            <p className="text-[10px] text-gray-400 mt-0.5 leading-tight">{kpi.label}</p>
            {kpi.total && !kpi.suffix && (
              <p className="text-[9px] text-gray-600 mt-0.5">of {kpi.total} patients</p>
            )}
          </button>
        ))}
      </div>

      {/* Tab Bar */}
      <div className="flex gap-1 border-b border-blue-500/10 pb-0">
        {([
          { id: 'population', label: 'Population Overview', icon: Users },
          { id: 'high-risk', label: `High Risk (${highRiskPatients.length})`, icon: AlertTriangle },
          { id: 'gdmt', label: `GDMT Gaps (${gdmtGaps.length})`, icon: Pill },
          { id: 'data-quality', label: 'Data Quality', icon: BarChart2 },
        ] as const).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex items-center gap-1.5 text-xs font-semibold px-3 py-2.5 border-b-2 transition-all',
              activeTab === tab.id
                ? 'border-blue-500 text-white'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            )}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="flex flex-col items-center gap-3 text-gray-400">
            <Brain className="w-8 h-8 text-violet-400 animate-pulse" />
            <p className="text-sm">Running clinical intelligence engine…</p>
          </div>
        </div>
      )}

      {!loading && (
        <>
          {/* ── Population Overview ──────────────────────────────────── */}
          {activeTab === 'population' && (
            <div className="grid md:grid-cols-2 gap-4">
              {/* Risk Distribution */}
              <div className="bg-gray-800/40 border border-blue-500/10 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-blue-400" />
                  Risk Distribution
                </h3>
                {(['Low', 'Intermediate', 'High', 'Very High'] as const).map(level => {
                  const count = data.filter(d => {
                    const r = computeMLRiskProfile(d.patient, d.latestVisit, d.allVisits)
                    return r.riskCategory === level
                  }).length
                  const pct = data.length > 0 ? Math.round((count / data.length) * 100) : 0
                  const color = level === 'Low' ? 'bg-emerald-500' :
                    level === 'Intermediate' ? 'bg-amber-500' :
                    level === 'High' ? 'bg-orange-500' : 'bg-rose-500'
                  const textColor = level === 'Low' ? 'text-emerald-400' :
                    level === 'Intermediate' ? 'text-amber-400' :
                    level === 'High' ? 'text-orange-400' : 'text-rose-400'
                  return (
                    <div key={level} className="mb-3">
                      <div className="flex justify-between text-xs mb-1">
                        <span className={textColor}>{level}</span>
                        <span className="text-gray-300">{count} patients ({pct}%)</span>
                      </div>
                      <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                        <div className={cn('h-full rounded-full', color)} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Top Action Items */}
              <div className="bg-gray-800/40 border border-blue-500/10 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-400" />
                  Registry Action Items
                </h3>
                <div className="space-y-2.5">
                  {[
                    { label: `${mlSummary.highRiskCount} high-risk patients need review`, color: 'text-rose-400', icon: AlertTriangle },
                    { label: `${mlSummary.gdmtGapCount} patients missing ≥1 GDMT pillar`, color: 'text-amber-400', icon: Pill },
                    { label: `Most missing drug: ${mlSummary.topMissingMedication}`, color: 'text-orange-400', icon: Pill },
                    { label: `${mlSummary.unticoagulatedAFCount} AF patients without anticoagulation`, color: 'text-rose-400', icon: Heart },
                    { label: `${mlSummary.icdEligibleCount} patients may meet ICD/CRT criteria`, color: 'text-violet-400', icon: Zap },
                    { label: `${mlSummary.ironDeficiencyCount} iron-deficient patients — IV iron gap`, color: 'text-cyan-400', icon: Activity },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-2.5 text-xs">
                      <item.icon className={cn('w-3.5 h-3.5 flex-shrink-0', item.color)} />
                      <span className="text-gray-300">{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── High Risk Patients ───────────────────────────────────── */}
          {activeTab === 'high-risk' && (
            <div className="space-y-2">
              {highRiskPatients.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-emerald-500/40" />
                  <p className="text-sm">No high-risk patients identified in current cohort.</p>
                </div>
              )}
              {highRiskPatients.map(({ patient, latestVisit, allVisits, risk, alerts }) => {
                const criticalCount = alerts.filter(a => a.severity === 'critical').length
                const pct = Math.round(risk.oneYearEventProbability * 100)
                return (
                  <Link
                    key={patient.id}
                    href={`/patients/${patient.id}?tab=overview`}
                    className="block bg-gray-800/40 border border-blue-500/10 rounded-xl p-4 hover:border-blue-500/30 transition-all group"
                  >
                    <div className="flex items-center gap-4 flex-wrap">
                      {/* Risk badge */}
                      <div className={cn(
                        'w-12 h-12 rounded-xl flex flex-col items-center justify-center flex-shrink-0 border',
                        risk.riskCategory === 'Very High'
                          ? 'bg-rose-500/10 border-rose-500/30'
                          : 'bg-orange-500/10 border-orange-500/30'
                      )}>
                        <p className={cn(
                          'text-base font-extrabold leading-none',
                          risk.riskCategory === 'Very High' ? 'text-rose-400' : 'text-orange-400'
                        )}>{pct}%</p>
                        <p className="text-[8px] text-gray-500 mt-0.5">1-yr risk</p>
                      </div>

                      {/* Patient info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white">
                          {patient.firstName} {patient.lastName}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {latestVisit.hfType ?? patient.hfType ?? 'HF'} ·{' '}
                          NYHA {latestVisit.nyha ?? '—'} ·{' '}
                          LVEF {latestVisit.lvef != null ? `${latestVisit.lvef}%` : '—'} ·{' '}
                          {latestVisit.visitDate}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Driver: {risk.primaryDriver}
                        </p>
                      </div>

                      {/* Alert count */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {criticalCount > 0 && (
                          <span className="text-[10px] bg-rose-500/15 text-rose-400 border border-rose-500/25 rounded-full px-2 py-0.5 font-semibold">
                            {criticalCount} Critical
                          </span>
                        )}
                        <span className={cn(
                          'text-[10px] rounded-full px-2 py-0.5 font-semibold border',
                          risk.riskCategory === 'Very High'
                            ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                            : 'bg-orange-500/10 text-orange-400 border-orange-500/20'
                        )}>
                          {risk.riskCategory}
                        </span>
                        <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-gray-400 transition-colors" />
                      </div>
                    </div>

                    {/* Alert list */}
                    {alerts.slice(0, 2).map(alert => (
                      <div key={alert.id} className="mt-2 flex items-start gap-2 text-xs">
                        <AlertTriangle className={cn(
                          'w-3 h-3 flex-shrink-0 mt-0.5',
                          alert.severity === 'critical' ? 'text-rose-400' : 'text-amber-400'
                        )} />
                        <span className="text-gray-400">{alert.title}: {alert.action}</span>
                      </div>
                    ))}
                  </Link>
                )
              })}
            </div>
          )}

          {/* ── GDMT Gaps ─────────────────────────────────────────────── */}
          {activeTab === 'gdmt' && (
            <div className="space-y-2">
              {gdmtGaps.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-emerald-500/40" />
                  <p className="text-sm">All patients on complete GDMT — excellent registry quality.</p>
                </div>
              )}
              {gdmtGaps.map(({ patient, latestVisit, gdmt }) => {
                const missingDrugs = gdmt.pillars.filter(p => p.status === 'missing')
                return (
                  <Link
                    key={patient.id}
                    href={`/patients/${patient.id}?tab=overview`}
                    className="block bg-gray-800/40 border border-blue-500/10 rounded-xl p-4 hover:border-blue-500/30 transition-all group"
                  >
                    <div className="flex items-center gap-4 flex-wrap">
                      {/* Score */}
                      <div className={cn(
                        'w-12 h-12 rounded-xl flex flex-col items-center justify-center border flex-shrink-0',
                        gdmt.optimizationScore < 50
                          ? 'bg-rose-500/10 border-rose-500/20'
                          : 'bg-amber-500/10 border-amber-500/20'
                      )}>
                        <p className={cn(
                          'text-base font-extrabold',
                          gdmt.optimizationScore < 50 ? 'text-rose-400' : 'text-amber-400'
                        )}>{gdmt.optimizationScore}%</p>
                        <p className="text-[8px] text-gray-500 mt-0.5">GDMT</p>
                      </div>

                      {/* Patient */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white">
                          {patient.firstName} {patient.lastName}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {latestVisit.hfType ?? '—'} · NYHA {latestVisit.nyha ?? '—'} · LVEF {latestVisit.lvef ?? '—'}%
                        </p>
                      </div>

                      {/* Missing pills */}
                      <div className="flex flex-wrap gap-1 flex-shrink-0">
                        {missingDrugs.map(p => (
                          <span key={p.drug} className="text-[10px] bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-full px-2 py-0.5">
                            Missing: {p.drug}
                          </span>
                        ))}
                        <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-gray-400 transition-colors self-center" />
                      </div>
                    </div>

                    <p className="text-xs text-blue-300 mt-2 bg-blue-500/5 px-3 py-1.5 rounded-lg border border-blue-500/10">
                      {gdmt.nextBestAction}
                    </p>
                  </Link>
                )
              })}
            </div>
          )}

          {/* ── Data Quality ──────────────────────────────────────────── */}
          {activeTab === 'data-quality' && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {(['A', 'B', 'C', 'D'] as const).map(grade => {
                  const count = dataQuality.filter(d => d.completeness.dataGrade === grade).length
                  return (
                    <div key={grade} className="bg-gray-800/40 border border-blue-500/10 rounded-xl p-4 text-center">
                      <p className={cn(
                        'text-2xl font-extrabold',
                        grade === 'A' ? 'text-emerald-400' :
                        grade === 'B' ? 'text-blue-400' :
                        grade === 'C' ? 'text-amber-400' : 'text-rose-400'
                      )}>Grade {grade}</p>
                      <p className="text-sm text-white font-semibold">{count}</p>
                      <p className="text-[10px] text-gray-500">
                        {grade === 'A' ? '≥80%' : grade === 'B' ? '60–79%' : grade === 'C' ? '40–59%' : '<40%'} complete
                      </p>
                    </div>
                  )
                })}
              </div>

              {/* Patient list */}
              <div className="space-y-2">
                {dataQuality.map(({ patient, latestVisit, completeness }) => (
                  <Link
                    key={patient.id}
                    href={`/patients/${patient.id}?tab=overview`}
                    className="block bg-gray-800/40 border border-blue-500/10 rounded-xl p-4 hover:border-blue-500/30 transition-all group"
                  >
                    <div className="flex items-center gap-4 flex-wrap">
                      <div className={cn(
                        'w-12 h-12 rounded-xl flex flex-col items-center justify-center border flex-shrink-0 font-extrabold text-sm',
                        completeness.dataGrade === 'A' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                        completeness.dataGrade === 'B' ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' :
                        completeness.dataGrade === 'C' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' :
                                                         'bg-rose-500/10 border-rose-500/20 text-rose-400'
                      )}>
                        {completeness.overallPct}%
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white">
                          {patient.firstName} {patient.lastName}
                        </p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {completeness.domains.map(d => (
                            <span key={d.name} className={cn(
                              'text-[10px] px-1.5 py-0.5 rounded-md border',
                              d.pct >= 80 ? 'bg-emerald-500/8 text-emerald-400 border-emerald-500/15' :
                              d.pct >= 50 ? 'bg-amber-500/8 text-amber-400 border-amber-500/15' :
                                            'bg-rose-500/8 text-rose-400 border-rose-500/15'
                            )}>
                              {d.name} {d.pct}%
                            </span>
                          ))}
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-gray-400 flex-shrink-0" />
                    </div>
                    {completeness.domains.some(d => d.missing.length > 0) && (
                      <p className="text-[11px] text-gray-500 mt-2">
                        Missing:{' '}
                        {completeness.domains
                          .flatMap(d => d.missing.slice(0, 2))
                          .slice(0, 5)
                          .join(', ')}
                      </p>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
