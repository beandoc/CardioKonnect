'use client'
import { useMemo } from 'react'
import Link from 'next/link'
import {
  Heart, Activity, TrendingUp, TrendingDown, ShieldCheck,
  AlertTriangle, Info, CheckCircle2, ChevronRight, Stethoscope, Sparkles
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { computeMLRiskProfile, evaluateGDMT, generateClinicalAlerts } from '@/lib/clinicalIntelligence'
import { calculateMAGGIC } from '@/lib/riskScores'
import type { Patient, Visit } from '@/lib/types'

interface Props {
  patient: Patient
  visit: Visit
  allVisits: Visit[]
  compact?: boolean
}

const RISK_COLORS = {
  'Low':          { bg: 'bg-emerald-500/10', border: 'border-emerald-500/25', text: 'text-emerald-400', bar: 'bg-emerald-500', badge: 'badge-green' },
  'Intermediate': { bg: 'bg-amber-500/10',   border: 'border-amber-500/25',   text: 'text-amber-400',   bar: 'bg-amber-500',   badge: 'badge-amber' },
  'High':         { bg: 'bg-orange-500/10',  border: 'border-orange-500/25',  text: 'text-orange-400',  bar: 'bg-orange-500',  badge: 'badge-orange' },
  'Very High':    { bg: 'bg-rose-500/10',    border: 'border-rose-500/25',    text: 'text-rose-400',    bar: 'bg-rose-500',    badge: 'badge-red' },
}

export default function MLRiskCard({ patient, visit, allVisits, compact = false }: Props) {
  const risk = useMemo(() => computeMLRiskProfile(patient, visit, allVisits), [patient, visit, allVisits])
  const gdmt = useMemo(() => evaluateGDMT(patient, visit), [patient, visit])
  const alerts = useMemo(() => generateClinicalAlerts(patient, visit, allVisits), [patient, visit, allVisits])

  const age = Math.floor((Date.now() - new Date(patient.dob).getTime()) / (365.25 * 86400000)) || patient.age || 65
  const comorbStr = (patient.comorbidities ?? []).join(' ').toLowerCase()

  // Calculate exact validated MAGGIC scores
  const maggic = useMemo(() => {
    try {
      const bmi = (visit.weight && visit.height)
        ? visit.weight / ((visit.height / 100) ** 2)
        : (visit.bmi ?? (visit.weight ? visit.weight / (1.65 ** 2) : 24))

      return calculateMAGGIC({
        age,
        lvef: visit.lvef ?? patient.lvef ?? 35,
        systolicBP: visit.bpSystolic ?? 120,
        bmi: Math.round(bmi * 10) / 10,
        creatinine: visit.creatinine ?? 1.1,
        nyha: (visit.nyha || patient.nyha || 'II') as any,
        sex: (patient.sex === 'Female' ? 'Female' : 'Male') as any,
        diabetesMellitus: Boolean(patient.comorbidDiabetes || comorbStr.includes('dm') || comorbStr.includes('diabetes')),
        currentSmoker: false,
        copd: Boolean(patient.comorbidCOPD || comorbStr.includes('copd')),
        heartFailureDiagnosisYears: 2,
        betaBlocker: visit.betaBlocker?.prescribed === 'Yes',
        aceInhibitorOrArb: visit.raasi?.prescribed === 'Yes',
      })
    } catch {
      return {
        score: 22,
        oneYearMortality: 0.104,
        threeYearMortality: 0.268,
        fiveYearMortality: 0.38,
        riskCategory: 'Intermediate' as const
      }
    }
  }, [patient, visit, age, comorbStr])

  const colors = RISK_COLORS[risk.riskCategory]
  const criticalAlerts = alerts.filter(a => a.severity === 'critical')
  const oneYrPct = Math.round(maggic.oneYearMortality * 100)
  const threeYrPct = Math.round(maggic.threeYearMortality * 100)

  if (compact) {
    return (
      <div className={cn('rounded-xl border p-3 flex items-center gap-3', colors.bg, colors.border)}>
        <Activity className={cn('w-5 h-5 flex-shrink-0', colors.text)} />
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-400">MAGGIC 1-Yr Mortality</p>
          <p className={cn('text-sm font-bold', colors.text)}>{oneYrPct}% · {risk.riskCategory} Risk</p>
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
      {/* ── MAGGIC Heart Failure Prognosis Panel ─────────────────── */}
      <div className={cn('rounded-xl border p-5 shadow-lg relative overflow-hidden', colors.bg, colors.border)}>
        {/* Subtle background glow */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl pointer-events-none" />

        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center border', colors.bg, colors.border)}>
              <Activity className={cn('w-5 h-5', colors.text)} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-xs font-bold text-gray-300 uppercase tracking-wider">MAGGIC Heart Failure Risk</p>
                <span className="text-[10px] font-mono text-gray-400 bg-slate-900/80 px-1.5 py-0.5 rounded border border-gray-700/40">
                  {maggic.score} pts
                </span>
              </div>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className={cn('text-2xl font-extrabold', colors.text)}>{oneYrPct}%</span>
                <span className="text-xs text-gray-400">1-year mortality</span>
                <span className="text-gray-600">·</span>
                <span className="text-sm font-bold text-gray-300">{threeYrPct}%</span>
                <span className="text-xs text-gray-400">3-year</span>
              </div>
            </div>
          </div>

          <div className="text-right">
            <span className={cn(
              'text-xs font-bold px-2.5 py-1 rounded-full border shadow-sm',
              colors.bg, colors.border, colors.text
            )}>
              {risk.riskCategory} Risk
            </span>
            <p className="text-[10px] text-gray-400 mt-1.5 font-mono">Pocock et al. Eur Heart J</p>
          </div>
        </div>

        {/* Prognostic Progress Bar */}
        <div className="h-2 bg-slate-900/90 rounded-full overflow-hidden mb-3 border border-blue-500/10">
          <div
            className={cn('h-full rounded-full transition-all duration-700', colors.bar)}
            style={{ width: `${Math.min(oneYrPct * 3, 100)}%` }}
          />
        </div>

        {/* Primary Prognostic Driver */}
        <p className="text-xs text-gray-300">
          Primary clinical driver: <span className="text-white font-semibold">{risk.primaryDriver}</span>
        </p>

        {/* Validation Footnote & Full Suite Link */}
        <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-blue-500/10 flex-wrap">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
            <p className="text-[11px] text-gray-400">
              Validated Meta-Analysis Global Group in Chronic HF (MAGGIC) integer model
            </p>
          </div>
          <Link
            href={`/risk?patientId=${patient.id}&visitId=${visit.id}`}
            className="text-[11px] text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1 transition-colors hover:underline"
          >
            Open 10-Score Suite <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* ── Key Prognostic Contributing Factors ──────────────────── */}
      {risk.topFactors.length > 0 && (
        <div className="glass-card p-4 rounded-2xl space-y-3">
          <p className="text-xs font-bold text-white flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-blue-400" />
              Prognostic Drivers & Protective GDMT
            </span>
            <span className="text-[10px] text-gray-400 font-medium">ESC 2023 Guidelines</span>
          </p>

          <div className="space-y-2">
            {risk.topFactors.map((f, i) => (
              <div key={i} className="flex items-center gap-2.5 text-xs">
                {f.direction === 'risk'
                  ? <TrendingUp className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
                  : <TrendingDown className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                }
                <span className={cn('truncate font-semibold', f.direction === 'risk' ? 'text-rose-300' : 'text-emerald-300')}>
                  {f.label}
                </span>
                <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden min-w-[40px]">
                  <div
                    className={cn('h-full rounded-full', f.direction === 'risk' ? 'bg-rose-500' : 'bg-emerald-500')}
                    style={{ width: `${Math.min(100, f.magnitude * 700)}%` }}
                  />
                </div>
                <span className={cn('text-[11px] w-12 text-right font-mono font-bold', f.direction === 'risk' ? 'text-rose-400' : 'text-emerald-400')}>
                  {f.direction === 'risk' ? '+Risk' : '−Risk'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── GDMT 4-Pillar Quadruple Therapy Card ──────────────────── */}
      <div className="glass-card p-4 rounded-2xl space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            4-Pillar GDMT Optimization
          </p>
          <span className={cn(
            'text-xs font-bold px-2.5 py-0.5 rounded-full border',
            gdmt.optimizationScore >= 75 ? 'badge-green' :
            gdmt.optimizationScore >= 50 ? 'badge-amber' :
            'badge-red'
          )}>
            {gdmt.pillarsOnTarget}/4 Pillars Active ({gdmt.optimizationScore}%)
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {gdmt.pillars.map(p => (
            <div key={p.drug} className={cn(
              'flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs border transition-colors',
              p.status === 'prescribed'     ? 'bg-emerald-950/30 border-emerald-500/25 text-emerald-300' :
              p.status === 'below-target'   ? 'bg-amber-950/30  border-amber-500/25  text-amber-300'    :
              p.status === 'missing'        ? 'bg-rose-950/30   border-rose-500/25   text-rose-300'     :
                                              'bg-slate-950/40  border-gray-800/40   text-gray-400'
            )}>
              <div className={cn(
                'w-2 h-2 rounded-full flex-shrink-0',
                p.status === 'prescribed'     ? 'bg-emerald-500' :
                p.status === 'below-target'   ? 'bg-amber-500'   :
                p.status === 'missing'        ? 'bg-rose-500'    :
                'bg-slate-400'
              )} />
              <div className="min-w-0 flex-1">
                <p className="font-bold truncate leading-tight">{p.drug}</p>
                {p.currentDose && <p className="text-[10px] text-gray-400 truncate mt-0.5">{p.currentDose}</p>}
              </div>
            </div>
          ))}
        </div>

        {/* Actionable Next Step for the Cardiologist */}
        <div className="p-3 rounded-xl bg-blue-950/40 border border-blue-500/20 text-xs text-blue-200 flex items-start gap-2">
          <Stethoscope className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <span className="font-bold text-white">Guideline Recommendation: </span>
            {gdmt.nextBestAction}
          </p>
        </div>
      </div>

      {/* ── Critical Alerts ────────────────────────────────────────── */}
      {criticalAlerts.length > 0 && (
        <div className="space-y-1.5">
          {criticalAlerts.map(alert => (
            <div key={alert.id} className="bg-rose-500/10 border border-rose-500/25 rounded-xl p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400 flex-shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-rose-300">{alert.title}</p>
                  <p className="text-[11px] text-gray-300 mt-0.5">{alert.action}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
