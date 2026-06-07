'use client'
import { useMemo } from 'react'
import { Brain, TrendingUp, TrendingDown, Minus, ShieldCheck, AlertTriangle, Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import { computeMLRiskProfile, evaluateGDMT, generateClinicalAlerts } from '@/lib/clinicalIntelligence'
import type { Patient, Visit } from '@/lib/types'

interface Props {
  patient: Patient
  visit: Visit
  allVisits: Visit[]
  compact?: boolean
}

const RISK_COLORS = {
  'Low':          { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', text: 'text-emerald-400', bar: 'bg-emerald-500' },
  'Intermediate': { bg: 'bg-amber-500/10',   border: 'border-amber-500/20',   text: 'text-amber-400',   bar: 'bg-amber-500'   },
  'High':         { bg: 'bg-orange-500/10',  border: 'border-orange-500/20',  text: 'text-orange-400',  bar: 'bg-orange-500'  },
  'Very High':    { bg: 'bg-rose-500/10',    border: 'border-rose-500/20',    text: 'text-rose-400',    bar: 'bg-rose-500'    },
}

export default function MLRiskCard({ patient, visit, allVisits, compact = false }: Props) {
  const risk = useMemo(() => computeMLRiskProfile(patient, visit, allVisits), [patient, visit, allVisits])
  const gdmt = useMemo(() => evaluateGDMT(patient, visit), [patient, visit])
  const alerts = useMemo(() => generateClinicalAlerts(patient, visit, allVisits), [patient, visit, allVisits])

  const colors = RISK_COLORS[risk.riskCategory]
  const criticalAlerts = alerts.filter(a => a.severity === 'critical')
  const pct = Math.round(risk.oneYearEventProbability * 100)

  if (compact) {
    return (
      <div className={cn('rounded-xl border p-3 flex items-center gap-3', colors.bg, colors.border)}>
        <Brain className={cn('w-5 h-5 flex-shrink-0', colors.text)} />
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-400">1-Year Event Risk</p>
          <p className={cn('text-sm font-bold', colors.text)}>{pct}% · {risk.riskCategory}</p>
        </div>
        {criticalAlerts.length > 0 && (
          <span className="flex-shrink-0 text-[10px] bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-full px-2 py-0.5 font-semibold">
            {criticalAlerts.length} Critical
          </span>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* ── Risk Gauge ────────────────────────────────────────────── */}
      <div className={cn('rounded-xl border p-5', colors.bg, colors.border)}>
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', colors.bg, colors.border)}>
              <Brain className={cn('w-5 h-5', colors.text)} />
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wider">AI Risk Score</p>
              <p className={cn('text-2xl font-extrabold', colors.text)}>{pct}%</p>
            </div>
          </div>
          <div className="text-right">
            <span className={cn(
              'text-xs font-bold px-2.5 py-1 rounded-full border',
              colors.bg, colors.border, colors.text
            )}>
              {risk.riskCategory} Risk
            </span>
            <p className="text-[10px] text-gray-500 mt-1.5">1-year composite event</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-2 bg-gray-800 rounded-full overflow-hidden mb-3">
          <div
            className={cn('h-full rounded-full transition-all duration-700', colors.bar)}
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        </div>

        {/* Primary driver */}
        <p className="text-xs text-gray-400">
          Primary driver: <span className="text-white font-medium">{risk.primaryDriver}</span>
        </p>

        {/* Confidence */}
        <div className="flex items-center gap-1.5 mt-2">
          <div className={cn(
            'w-1.5 h-1.5 rounded-full',
            risk.confidence.toLowerCase().startsWith('high') ? 'bg-emerald-400' :
            risk.confidence.toLowerCase().startsWith('medium') ? 'bg-amber-400' : 'bg-gray-500'
          )} />
          <p className="text-[10px] text-gray-500">
            {risk.confidence} · Model: Clinical rules + MAGGIC
          </p>
        </div>
      </div>

      {/* ── SHAP-like factor list ──────────────────────────────────── */}
      {risk.topFactors.length > 0 && (
        <div className="bg-gray-800/40 border border-blue-500/10 rounded-xl p-4">
          <p className="text-xs font-semibold text-white mb-3 flex items-center gap-2">
            <Info className="w-3.5 h-3.5 text-blue-400" />
            Contributing Factors
          </p>
          <div className="space-y-2">
            {risk.topFactors.map((f, i) => (
              <div key={i} className="flex items-center gap-2.5 text-xs">
                {f.direction === 'risk'
                  ? <TrendingUp className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
                  : <TrendingDown className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                }
                <span className={f.direction === 'risk' ? 'text-rose-300' : 'text-emerald-300'}>
                  {f.label}
                </span>
                <div className="flex-1 h-1 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={cn('h-full rounded-full', f.direction === 'risk' ? 'bg-rose-500' : 'bg-emerald-500')}
                    style={{ width: `${Math.min(100, f.magnitude * 500)}%` }}
                  />
                </div>
                <span className="text-gray-500 w-10 text-right">
                  {f.direction === 'risk' ? '+' : '−'}{Math.round(f.magnitude * 100)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── GDMT Summary ──────────────────────────────────────────── */}
      <div className="bg-gray-800/40 border border-blue-500/10 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-white flex items-center gap-2">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
            GDMT Optimisation
          </p>
          <span className={cn(
            'text-xs font-bold px-2 py-0.5 rounded-full',
            gdmt.optimizationScore >= 75 ? 'bg-emerald-500/15 text-emerald-400' :
            gdmt.optimizationScore >= 50 ? 'bg-amber-500/15 text-amber-400' :
            'bg-rose-500/15 text-rose-400'
          )}>
            {gdmt.optimizationScore}%
          </span>
        </div>

        <div className="grid grid-cols-2 gap-1.5 mb-3">
          {gdmt.pillars.map(p => (
            <div key={p.drug} className={cn(
              'flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs border',
              p.status === 'prescribed'     ? 'bg-emerald-500/8 border-emerald-500/15 text-emerald-300' :
              p.status === 'below-target'   ? 'bg-amber-500/8  border-amber-500/15  text-amber-300'    :
              p.status === 'missing'        ? 'bg-rose-500/8   border-rose-500/15   text-rose-300'     :
              p.status === 'contraindicated'? 'bg-gray-700/50  border-gray-600/30   text-gray-400'     :
                                              'bg-gray-800/40  border-gray-700/20   text-gray-500'
            )}>
              <div className={cn(
                'w-1.5 h-1.5 rounded-full flex-shrink-0',
                p.status === 'prescribed'     ? 'bg-emerald-400' :
                p.status === 'below-target'   ? 'bg-amber-400'   :
                p.status === 'missing'        ? 'bg-rose-400'    :
                                                'bg-gray-500'
              )} />
              <span className="truncate">{p.drug}</span>
              {p.dosePct !== undefined && p.status === 'below-target' && (
                <span className="ml-auto text-[10px] opacity-70">{p.dosePct}%</span>
              )}
            </div>
          ))}
        </div>

        <p className="text-[11px] text-blue-300 bg-blue-500/8 border border-blue-500/15 rounded-lg px-3 py-2">
          {gdmt.nextBestAction}
        </p>
      </div>

      {/* ── Critical Alerts ────────────────────────────────────────── */}
      {criticalAlerts.length > 0 && (
        <div className="space-y-1.5">
          {criticalAlerts.map(alert => (
            <div key={alert.id} className="bg-rose-500/8 border border-rose-500/20 rounded-xl p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400 flex-shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-rose-300">{alert.title}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">{alert.action}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-[10px] text-gray-600 text-center">
        Clinical intelligence · Rules-based v1 · Not a substitute for clinical judgement
      </p>
    </div>
  )
}
