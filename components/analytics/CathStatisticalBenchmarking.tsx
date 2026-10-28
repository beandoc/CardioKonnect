'use client'

import { complicationFlags } from '@/lib/complications'
import React, { useMemo, useState } from 'react'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ReferenceLine, AreaChart, Area
} from 'recharts'
import {
  Activity, TrendingUp, AlertTriangle, ShieldCheck, HelpCircle,
  Award, BarChart2, Filter, Info, ShieldAlert
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/utils'
import type { CathProcedure } from '@/lib/types'
import {
  calculateKaplanMeier, calculateObservedToExpected, generateFunnelCurves,
  evaluateFunnelPosition, type SurvivalDataPoint
} from '@/lib/interventionalStats'

interface Props {
  procedures: CathProcedure[]
}

export default function CathStatisticalBenchmarking({ procedures }: Props) {
  const [activeBenchmarkTab, setActiveBenchmarkTab] = useState<'funnel' | 'kaplan' | 'oe'>('funnel')
  const [benchmarkMortalityTarget, setBenchmarkMortalityTarget] = useState(1.8) // National CathPCI / NIC India benchmark: 1.8%

  // Group procedures by operator
  const operatorStats = useMemo(() => {
    const map = new Map<string, { name: string; volume: number; complications: number; deaths: number }>()

    procedures.forEach(p => {
      const op = p.operatorName || 'Unknown Operator'
      const curr = map.get(op) || { name: op, volume: 0, complications: 0, deaths: 0 }
      curr.volume += 1
      if (complicationFlags(p).hasComplication) curr.complications += 1
      if (complicationFlags(p).inLabDeath || complicationFlags(p).inHospitalDeath) curr.deaths += 1
      map.set(op, curr)
    })

    return Array.from(map.values()).map(op => {
      const crudeRate = op.volume > 0 ? (op.complications / op.volume) * 100 : 0
      const status = evaluateFunnelPosition(op.complications, op.volume, benchmarkMortalityTarget)
      return {
        ...op,
        crudeRate: parseFloat(crudeRate.toFixed(2)),
        status
      }
    })
  }, [procedures, benchmarkMortalityTarget])

  // Generate Funnel plot curves
  const funnelCurves = useMemo(() => {
    const maxVol = Math.max(100, ...operatorStats.map(o => o.volume), 200)
    return generateFunnelCurves(benchmarkMortalityTarget, maxVol)
  }, [benchmarkMortalityTarget, operatorStats])

  // Kaplan-Meier dataset. The registry records in-hospital events only (no event
  // timestamps, no post-discharge follow-up), so time runs from procedure to
  // discharge: intra-procedural events at day 0, other events at discharge, and
  // event-free patients censored at discharge. Procedures with no discharge date
  // contribute only if they had an intra-procedural event.
  const survivalData = useMemo<SurvivalDataPoint[]>(() => {
    const DAY_MS = 1000 * 60 * 60 * 24
    const points: SurvivalDataPoint[] = []
    for (const p of procedures) {
      const items: any[] = Array.isArray(p.complications) ? p.complications : []
      const intraProcedural = items.some(c => c?.timing === 'Intra-procedural') || complicationFlags(p).inLabDeath
      const event = Boolean(complicationFlags(p).hasComplication || p.dischargeStatus === 'In-Hospital Mortality')
      const group = p.accessSite?.includes('Radial') ? 'Transradial' : 'Transfemoral'

      if (event && intraProcedural) {
        points.push({ timeDays: 0, event: true, group })
        continue
      }
      const procDate = p.procedureDate || p.procedureDateTime
      const start = procDate ? new Date(procDate).getTime() : NaN
      const end = p.dischargeDate ? new Date(p.dischargeDate).getTime() : NaN
      if (isNaN(start) || isNaN(end) || end < start) continue
      points.push({ timeDays: Math.floor((end - start) / DAY_MS), event, group })
    }
    return points
  }, [procedures])

  const maxFollowUpDays = useMemo(() => Math.max(0, ...survivalData.map(d => d.timeDays)), [survivalData])
  const milestone = (days: number, value: number) =>
    maxFollowUpDays >= days ? `${(value * 100).toFixed(1)}%` : '—'

  const kmAll = useMemo(() => calculateKaplanMeier(survivalData), [survivalData])

  // Observed-to-Expected Calculation
  const totalObserved = procedures.filter(p => complicationFlags(p).hasComplication).length
  // Predicted baseline expectation from risk indicators (e.g. STEMI, cardiogenic shock, age >75)
  const totalExpected = useMemo(() => {
    if (procedures.length === 0) return 0
    return procedures.reduce((acc, p) => {
      let risk = 0.015 // baseline 1.5%
      if (p.clinicalIndication === 'STEMI') risk += 0.035
      if (p.clinicalIndication === 'Cardiogenic Shock') risk += 0.25
      if (p.accessSite.includes('Femoral')) risk += 0.01
      return acc + risk
    }, 0)
  }, [procedures])

  const oeStats = useMemo(() => {
    return calculateObservedToExpected(totalObserved, totalExpected, benchmarkMortalityTarget)
  }, [totalObserved, totalExpected, benchmarkMortalityTarget])

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-6 space-y-6">
      {/* Header & Sub-tabs */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-amber-400" />
            Registry Quality & Risk-Adjusted Statistical Benchmarking
          </h3>
          <p className="text-xs text-gray-400 mt-1">
            NCDR CathPCI & BCIS comparative methodologies: Statistical Funnel Plots, Observed-to-Expected (O/E) Ratios, and Kaplan-Meier Event-Free Curves.
          </p>
        </div>

        <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-white/10">
          <button
            onClick={() => setActiveBenchmarkTab('funnel')}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
              activeBenchmarkTab === 'funnel' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-gray-400 hover:text-white'
            )}
          >
            Funnel Plot Audit
          </button>
          <button
            onClick={() => setActiveBenchmarkTab('oe')}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
              activeBenchmarkTab === 'oe' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-gray-400 hover:text-white'
            )}
          >
            Risk-Adjusted O/E
          </button>
          <button
            onClick={() => setActiveBenchmarkTab('kaplan')}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
              activeBenchmarkTab === 'kaplan' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-gray-400 hover:text-white'
            )}
          >
            Kaplan-Meier Survival
          </button>
        </div>
      </div>

      {/* 1. Funnel Plot Tab */}
      {activeBenchmarkTab === 'funnel' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="glass-card p-4 border border-white/10 space-y-1">
              <p className="text-[10px] text-gray-400 uppercase font-bold">National Benchmark Target</p>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-white">{benchmarkMortalityTarget}%</span>
                <span className="text-xs text-gray-400">Target Adverse Event Rate</span>
              </div>
              <p className="text-[10px] text-emerald-400">NCDR CathPCI Quality Threshold</p>
            </div>

            <div className="glass-card p-4 border border-white/10 space-y-1">
              <p className="text-[10px] text-gray-400 uppercase font-bold">Audited Operators</p>
              <span className="text-2xl font-bold text-white">{operatorStats.length}</span>
              <p className="text-[10px] text-gray-400">Logged interventional operators</p>
            </div>

            <div className="glass-card p-4 border border-white/10 space-y-1">
              <p className="text-[10px] text-gray-400 uppercase font-bold">Control Limit Status</p>
              <span className={cn(
                'text-lg font-bold flex items-center gap-1.5 mt-1',
                operatorStats.some(o => o.status === 'Outlier Alarm (3-sigma)') ? 'text-rose-400' :
                operatorStats.some(o => o.status === 'Warning (2-sigma)') ? 'text-amber-400' : 'text-emerald-400'
              )}>
                <ShieldCheck className="w-5 h-5" />
                {operatorStats.some(o => o.status === 'Outlier Alarm (3-sigma)') ? 'Outlier Detected' : 'All Within Control Limits'}
              </span>
              <p className="text-[10px] text-gray-400">95% (2σ) and 99.8% (3σ) limits applied</p>
            </div>
          </div>

          {/* Funnel Curves Chart */}
          <div className="bg-slate-950/80 p-5 rounded-2xl border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                Statistical Funnel Plot: Operator Volume vs. Adverse Event Rate
              </h4>
              <span className="text-[10px] text-gray-400">Control limits adjust inversely with procedure volume</span>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={funnelCurves}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                  <XAxis dataKey="volume" stroke="#6b7280" fontSize={10} label={{ value: 'Procedure Volume (N)', position: 'insideBottom', offset: -5, fontSize: 10, fill: '#9ca3af' }} />
                  <YAxis stroke="#6b7280" fontSize={10} unit="%" domain={[0, 'auto']} label={{ value: 'Adverse Event Rate (%)', angle: -90, position: 'insideLeft', fontSize: 10, fill: '#9ca3af' }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', fontSize: '11px' }}
                    formatter={(val: any) => [`${val}%`, '']}
                  />
                  <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                  <Line type="monotone" dataKey="upperAlarm" name="99.8% Alarm Limit (3σ)" stroke="#f43f5e" strokeWidth={1.5} dot={false} strokeDasharray="4 4" />
                  <Line type="monotone" dataKey="upperWarning" name="95% Warning Limit (2σ)" stroke="#f59e0b" strokeWidth={1.5} dot={false} strokeDasharray="2 2" />
                  <Line type="monotone" dataKey="mean" name="Benchmark Target" stroke="#10b981" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="lowerWarning" name="95% Lower Warning" stroke="#f59e0b" strokeWidth={1.5} dot={false} strokeDasharray="2 2" />
                  <Line type="monotone" dataKey="lowerAlarm" name="99.8% Lower Alarm" stroke="#f43f5e" strokeWidth={1.5} dot={false} strokeDasharray="4 4" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Operator Table Drill-down */}
            <div className="overflow-x-auto pt-2">
              <table className="w-full text-left text-xs text-gray-300">
                <thead className="bg-white/[0.04] text-gray-400 font-semibold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3">Operator Name</th>
                    <th className="py-2.5 px-3">Total Volume</th>
                    <th className="py-2.5 px-3">Adverse Events</th>
                    <th className="py-2.5 px-3">Crude Event Rate</th>
                    <th className="py-2.5 px-3">Statistical Position</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.05]">
                  {operatorStats.map(op => (
                    <tr key={op.name} className="hover:bg-white/[0.02]">
                      <td className="py-2.5 px-3 font-semibold text-white">{op.name}</td>
                      <td className="py-2.5 px-3">{op.volume}</td>
                      <td className="py-2.5 px-3">{op.complications}</td>
                      <td className="py-2.5 px-3 font-mono">{op.crudeRate}%</td>
                      <td className="py-2.5 px-3">
                        <span className={cn(
                          'px-2 py-0.5 rounded-full text-[10px] font-bold',
                          op.status === 'In Control' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                          op.status === 'Warning (2-sigma)' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                          'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        )}>
                          {op.status}
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

      {/* 2. Observed-to-Expected (O/E) Tab */}
      {activeBenchmarkTab === 'oe' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="glass-card p-6 border border-white/10 space-y-4 rounded-2xl">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-amber-400" />
              Observed vs. Expected Risk Adjustment
            </h4>
            <p className="text-xs text-gray-400 leading-relaxed">
              Crude adverse event rates can unfairly penalize tertiary centers treating high-risk ACS, cardiogenic shock, and complex CTO lesions.
              Risk adjustment computes the expected event probability for every case based on baseline clinical severity.
            </p>

            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="p-3.5 rounded-xl bg-slate-950 border border-white/10 space-y-1">
                <p className="text-[10px] text-gray-400 uppercase font-bold">Observed Events (O)</p>
                <p className="text-2xl font-bold text-white">{oeStats.observedEvents}</p>
                <p className="text-[10px] text-gray-500">Actual complications logged</p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950 border border-white/10 space-y-1">
                <p className="text-[10px] text-gray-400 uppercase font-bold">Expected Events (E)</p>
                <p className="text-2xl font-bold text-amber-400">{oeStats.expectedEvents}</p>
                <p className="text-[10px] text-gray-500">Predicted by baseline risk models</p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-1">
              <p className="text-[10px] text-amber-300 uppercase font-bold">Risk-Adjusted Event Rate</p>
              <p className="text-3xl font-extrabold text-white">{oeStats.riskAdjustedRatePct}%</p>
              <p className="text-xs text-amber-200">
                Benchmark Standard: {oeStats.benchmarkRatePct}% | 95% Confidence Interval: [{oeStats.ciLower95} — {oeStats.ciUpper95}]
              </p>
            </div>
          </div>

          <div className="glass-card p-6 border border-white/10 space-y-4 rounded-2xl flex flex-col justify-between">
            <div className="space-y-3">
              <h4 className="text-sm font-bold text-white">Risk Ratio Interpretation</h4>
              <div className="flex items-baseline gap-3">
                <span className="text-5xl font-extrabold text-white">{oeStats.oeRatio}</span>
                <span className="text-xs font-semibold text-gray-400">O/E Ratio</span>
              </div>

              <div className={cn(
                'p-3 rounded-xl border text-xs font-semibold',
                oeStats.interpretation === 'Lower Than Expected (Superior)' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' :
                oeStats.interpretation === 'As Expected' ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' :
                'bg-rose-500/20 text-rose-300 border-rose-500/30'
              )}>
                Statistical Result: {oeStats.interpretation}
              </div>

              <p className="text-xs text-gray-400 leading-relaxed">
                An O/E ratio &lt; 1.0 indicates that procedural outcomes are superior to what would be expected given the patient case-mix and comorbid burden.
              </p>
            </div>

            <div className="p-3 bg-slate-950 rounded-xl border border-white/10 text-[11px] text-gray-400 space-y-1">
              <p className="font-semibold text-white">Byar’s Approximation Methodology:</p>
              <p>Poisson 95% confidence intervals are computed around the observed event counts to test whether divergence from 1.0 reaches statistical significance (p &lt; 0.05).</p>
            </div>
          </div>
        </div>
      )}

      {/* 3. Kaplan-Meier Survival Tab */}
      {activeBenchmarkTab === 'kaplan' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="glass-card p-4 border border-white/10 space-y-1">
              <p className="text-[10px] text-gray-400 uppercase font-bold">Total Cohort</p>
              <p className="text-2xl font-bold text-white">{kmAll.totalPatients}</p>
              <p className="text-[10px] text-gray-400">Episodes with discharge date or in-lab event</p>
            </div>

            <div className="glass-card p-4 border border-white/10 space-y-1">
              <p className="text-[10px] text-gray-400 uppercase font-bold">30-Day Event-Free</p>
              <p className="text-2xl font-bold text-emerald-400">{milestone(30, kmAll.oneMonthSurvival)}</p>
              <p className="text-[10px] text-gray-400">{maxFollowUpDays >= 30 ? 'Post-PCI milestone' : 'Follow-up too short'}</p>
            </div>

            <div className="glass-card p-4 border border-white/10 space-y-1">
              <p className="text-[10px] text-gray-400 uppercase font-bold">6-Month Event-Free</p>
              <p className="text-2xl font-bold text-cyan-400">{milestone(182, kmAll.sixMonthSurvival)}</p>
              <p className="text-[10px] text-gray-400">{maxFollowUpDays >= 182 ? 'Subacute surveillance' : 'No post-discharge follow-up'}</p>
            </div>

            <div className="glass-card p-4 border border-white/10 space-y-1">
              <p className="text-[10px] text-gray-400 uppercase font-bold">1-Year Event-Free</p>
              <p className="text-2xl font-bold text-violet-400">{milestone(365, kmAll.oneYearSurvival)}</p>
              <p className="text-[10px] text-gray-400">{maxFollowUpDays >= 365 ? 'Long-term registry endpoint' : 'No post-discharge follow-up'}</p>
            </div>
          </div>

          <div className="bg-slate-950/80 p-5 rounded-2xl border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                Kaplan-Meier Product-Limit Survival Curve with Greenwood 95% Confidence Band
              </h4>
              <span className="text-[10px] text-gray-400">In-hospital: procedure → discharge (days)</span>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={kmAll.timeline}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                  <XAxis dataKey="time" stroke="#6b7280" fontSize={10} label={{ value: 'Days Post-Procedure', position: 'insideBottom', offset: -5, fontSize: 10, fill: '#9ca3af' }} />
                  <YAxis stroke="#6b7280" fontSize={10} domain={[0.6, 1.0]} tickFormatter={(v) => `${Math.round(v * 100)}%`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', fontSize: '11px' }}
                    formatter={(val: any) => [`${(Number(val) * 100).toFixed(1)}%`, '']}
                  />
                  <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                  <Area type="stepAfter" dataKey="ciUpper" name="95% CI Upper" stroke="none" fill="#3b82f6" fillOpacity={0.15} />
                  <Area type="stepAfter" dataKey="ciLower" name="95% CI Lower" stroke="none" fill="#3b82f6" fillOpacity={0.15} />
                  <Line type="stepAfter" dataKey="survivalProbability" name="Event-Free Survival Probability" stroke="#3b82f6" strokeWidth={2.5} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
