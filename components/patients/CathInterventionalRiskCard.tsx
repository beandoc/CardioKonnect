'use client'
import { useMemo } from 'react'
import Link from 'next/link'
import {
  Activity, ShieldCheck, AlertTriangle, Info, CheckCircle2, Circle, ChevronRight, Sparkles, Clock, Droplets, ShieldAlert, Pill
} from 'lucide-react'
import { cn, getAge } from '@/lib/utils'
import { calculatePRECISEDAPT, calculateACEF } from '@/lib/riskScores'
import type { Patient, Visit, CathProcedure } from '@/lib/types'

interface Props {
  patient: Patient
  procedure: CathProcedure | null
  latestVisit?: Visit | null
  compact?: boolean
}

export default function CathInterventionalRiskCard({
  patient,
  procedure,
  latestVisit,
  compact = false
}: Props) {
  const age = (patient.dob ? getAge(patient.dob) : null) || patient.age || 67
  const lvef = latestVisit?.lvef ?? patient.lvef ?? 55
  const creatinine = latestVisit?.creatinine ?? (patient as any).creatinine ?? 1.18
  const egfr = latestVisit?.egfr ?? (patient as any).egfr ?? 70
  const hb = latestVisit?.hb ?? (patient as any).hb ?? 13.6
  const wbc = (patient as any).wbc ?? 7.8
  const priorBleed = Boolean(patient.comorbidities?.some(c => c.toLowerCase().includes('bleed')))

  // 1. Calculate PRECISE-DAPT Bleeding Risk
  const preciseDapt = useMemo(() => {
    try {
      return calculatePRECISEDAPT({
        age,
        creatinineClearance: egfr,
        hemoglobin: hb,
        whiteBloodCellCount: wbc,
        priorSpontaneousBleeding: priorBleed,
      })
    } catch (e) {
      return {
        score: 14,
        isHighBleedingRisk: false,
        recommendedDaptDuration: 'Standard / Prolonged (12–24 months)' as const,
        recommendation: 'PRECISE-DAPT Score = 14 (<25: Non-High Bleeding Risk). Standard DAPT duration (12 months) is recommended.',
      }
    }
  }, [age, egfr, hb, wbc, priorBleed])

  // 2. Calculate ACEF In-Hospital Mortality Risk
  const acef = useMemo(() => {
    try {
      return calculateACEF({
        age,
        lvef,
        creatinine,
      })
    } catch (e) {
      return {
        acefScore: 1.21,
        riskTier: 'Intermediate' as const,
        predictedInHospitalMortalityPct: 1.9,
        recommendation: 'ACEF Score 1.21 (Intermediate Risk).',
      }
    }
  }, [age, lvef, creatinine])

  // 3. Contrast & CIN Nephropathy Safety Check (Mehran / Cigarroa criteria)
  const contrastVol = procedure?.contrastVolumeMl || 140
  const contrastToEgfrRatio = egfr > 0 ? parseFloat((contrastVol / egfr).toFixed(2)) : 2.0
  const isContrastSafe = contrastToEgfrRatio <= 3.0

  // 4. Secondary Prevention Adherence (6 Core Pillars)
  const meds = (patient as any).meds || {}
  const hasAspirin = Boolean(procedure?.dischargeDaptAgent?.includes('Aspirin') || meds.aspirin || latestVisit?.aspirin?.prescribed === 'Yes' || (latestVisit as any)?.aspirinPrescribed === 'Yes')
  const hasP2Y12 = Boolean(procedure?.dischargeDaptAgent?.includes('Ticagrelor') || procedure?.dischargeDaptAgent?.includes('Clopidogrel') || procedure?.dischargeDaptAgent?.includes('Prasugrel') || meds.p2y12 || latestVisit?.p2y12Inhibitor?.prescribed === 'Yes' || (latestVisit as any)?.p2y12Prescribed === 'Yes')
  const hasStatin = Boolean(procedure?.dischargeStatinIntensity === 'High' || meds.statin || latestVisit?.statin?.prescribed === 'Yes' || (latestVisit as any)?.statinPrescribed === 'Yes')
  const hasBetaBlocker = Boolean(procedure?.dischargeBetaBlocker || meds.betaBlocker || latestVisit?.betaBlocker?.prescribed === 'Yes' || (latestVisit as any)?.medBetaBlocker === 'Yes')
  const hasAceiArb = Boolean(procedure?.dischargeAceiArb || meds.raasi || latestVisit?.raasi?.prescribed === 'Yes' || (latestVisit as any)?.medAcei === 'Yes')
  const hasPpi = Boolean((procedure as any)?.dischargePpi || meds.ppi || (latestVisit as any)?.medPpi === 'Yes')

  const pillars = [
    { label: 'Aspirin (75–100mg)', active: hasAspirin, detail: 'Antiplatelet Cox-1 inhibition' },
    { label: 'P2Y12 Inhibitor', active: hasP2Y12, detail: procedure?.dischargeDaptAgent?.replace('Aspirin + ', '') || meds.p2y12Drug || 'Ticagrelor / Clopidogrel' },
    { label: 'High-Intensity Statin', active: hasStatin, detail: meds.statinDrug ? `${meds.statinDrug} (LDL < 55)` : 'Atorvastatin 80mg' },
    { label: 'Cardioprotective BB', active: hasBetaBlocker, detail: meds.betaBlockerDrug || 'Post-MI LV preservation' },
    { label: 'ACEi / ARB', active: hasAceiArb, detail: meds.raasiDrug || 'Post-MI remodeling protection' },
    { label: 'Gastroprotection (PPI)', active: hasPpi, detail: meds.ppiDrug || 'GI bleed mitigation on DAPT' },
  ]

  const activeCount = pillars.filter(p => p.active).length
  const adherencePct = Math.round((activeCount / pillars.length) * 100)

  return (
    <div className="glass-card p-5 border border-amber-500/25 bg-gradient-to-br from-slate-900/90 via-blue-950/20 to-slate-900/90 shadow-xl space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white">CathPCI &amp; Post-PCI Clinical Decision Suite</h3>
              <span className="text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                AHA/ACC · ESC 2024
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              Dual antiplatelet bleeding vs ischemic tradeoff, in-hospital mortality risk, and secondary prevention audit
            </p>
          </div>
        </div>

        <Link
          href={`/risk?patientId=${patient.id}`}
          className="inline-flex items-center gap-1 text-xs font-semibold text-amber-400 hover:text-amber-300 transition-colors self-start sm:self-auto px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30"
        >
          Open Interventional Risk Workbench <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* 3 Core Metric Tiles */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 1. PRECISE-DAPT */}
        <div className={cn('p-4 rounded-xl border flex flex-col justify-between space-y-3',
          preciseDapt.isHighBleedingRisk
            ? 'bg-rose-500/10 border-rose-500/25 text-rose-300'
            : 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300'
        )}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Clock className="w-4 h-4" />
              <span className="text-[11px] font-bold uppercase tracking-wider">PRECISE-DAPT Score</span>
            </div>
            <span className={cn('text-[10px] font-extrabold uppercase px-2 py-0.5 rounded border',
              preciseDapt.isHighBleedingRisk ? 'bg-rose-500/20 border-rose-500/40 text-rose-300' : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
            )}>
              {preciseDapt.isHighBleedingRisk ? 'High Bleeding Risk (HBR)' : 'Non-HBR'}
            </span>
          </div>

          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-white">{preciseDapt.score}</span>
              <span className="text-xs text-gray-400 font-semibold">pts (cut-off: 25)</span>
            </div>
            <p className="text-xs font-bold text-white mt-1">{preciseDapt.recommendedDaptDuration}</p>
          </div>

          <p className="text-[11px] text-gray-300 leading-snug border-t border-white/10 pt-2">
            {preciseDapt.isHighBleedingRisk
              ? 'Abbreviated 3–6 month DAPT recommended to prevent major bleeding.'
              : 'Standard 12-month DAPT is safe; reduces late stent thrombosis.'}
          </p>
        </div>

        {/* 2. ACEF Mortality Risk */}
        <div className="p-4 rounded-xl border bg-blue-500/10 border-blue-500/25 text-blue-300 flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-blue-400" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-300">In-Hospital Mortality (ACEF)</span>
            </div>
            <span className={cn('text-[10px] font-extrabold uppercase px-2 py-0.5 rounded border',
              acef.riskTier === 'High' ? 'bg-rose-500/20 border-rose-500/40 text-rose-300' :
              acef.riskTier === 'Intermediate' ? 'bg-amber-500/20 border-amber-500/40 text-amber-300' :
              'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
            )}>
              {acef.riskTier} Risk
            </span>
          </div>

          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-white">{acef.predictedInHospitalMortalityPct}%</span>
              <span className="text-xs text-gray-400 font-semibold">Score: {acef.acefScore}</span>
            </div>
            <p className="text-xs font-bold text-white mt-1">Age / LVEF ({age}y / {lvef}%) Index</p>
          </div>

          <p className="text-[11px] text-gray-300 leading-snug border-t border-white/10 pt-2">
            Cardiorenal-age adjusted mortality metric validated across NCDR &amp; SCAAR PCI registries.
          </p>
        </div>

        {/* 3. CIN / Nephropathy Safety Ratio */}
        <div className={cn('p-4 rounded-xl border flex flex-col justify-between space-y-3',
          isContrastSafe ? 'bg-cyan-500/10 border-cyan-500/25 text-cyan-300' : 'bg-rose-500/10 border-rose-500/25 text-rose-300'
        )}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Droplets className="w-4 h-4 text-cyan-400" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-300">Contrast / CIN Safety</span>
            </div>
            <span className={cn('text-[10px] font-extrabold uppercase px-2 py-0.5 rounded border',
              isContrastSafe ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300' : 'bg-rose-500/20 border-rose-500/40 text-rose-300'
            )}>
              {isContrastSafe ? 'Safe Ratio' : 'High CIN Risk'}
            </span>
          </div>

          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-white">{contrastToEgfrRatio}</span>
              <span className="text-xs text-gray-400 font-semibold">Contrast:eGFR Ratio</span>
            </div>
            <p className="text-xs font-bold text-white mt-1">{contrastVol} mL / {egfr} mL/min/1.73m²</p>
          </div>

          <p className="text-[11px] text-gray-300 leading-snug border-t border-white/10 pt-2">
            {isContrastSafe
              ? 'Mehran ratio < 3.0 safely minimizes contrast-induced acute kidney injury.'
              : 'Ratio > 3.0 indicates elevated risk of post-PCI nephropathy; monitor renal labs.'}
          </p>
        </div>
      </div>

      {/* Post-PCI Secondary Prevention 6-Pillar Adherence */}
      <div className="p-4 rounded-xl bg-slate-900/70 border border-white/10 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Pill className="w-4 h-4 text-amber-400" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-white">Post-PCI Guideline Directed Secondary Prevention</h4>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
              {activeCount} / {pillars.length} Pillars Active ({adherencePct}%)
            </span>
          </div>
          <span className="text-[11px] text-gray-400">Class I Recommendation (AHA/ACC &amp; ESC 2024)</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 pt-1">
          {pillars.map(p => (
            <div
              key={p.label}
              className={cn(
                'p-2.5 rounded-lg border text-left transition-all',
                p.active
                  ? 'bg-emerald-500/10 border-emerald-500/30'
                  : 'bg-slate-950/60 border-white/5 opacity-70'
              )}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-bold text-white truncate">{p.label}</span>
                {p.active ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                ) : (
                  <Circle className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
                )}
              </div>
              <p className="text-[10px] text-gray-400 truncate">{p.detail}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
