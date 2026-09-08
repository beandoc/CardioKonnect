'use client'
import { useMemo } from 'react'
import type { Patient, Visit } from '@/lib/types'
import { targetDoseFromVisit } from '@/lib/riskScores'
import { cn } from '@/lib/utils'
import {
  Heart,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Award,
  Sparkles,
  Zap,
  Info,
  ChevronRight,
  TrendingUp
} from 'lucide-react'

interface Props {
  patient: Patient
  visits: Visit[]
}

export default function GDMTDashboard({ patient, visits }: Props) {
  const latestVisit = useMemo(() => visits[0] || null, [visits])

  // Calculate target dose achievements
  const doseAchievements = useMemo(() => {
    if (!latestVisit) return []
    const medSummary = {
      raasi: latestVisit.raasi?.prescribed === 'Yes'
        ? { type: latestVisit.raasi.type, dose: latestVisit.raasi.dose }
        : undefined,
      betaBlocker: latestVisit.betaBlocker?.prescribed === 'Yes'
        ? { type: latestVisit.betaBlocker.type, dose: latestVisit.betaBlocker.dose }
        : undefined,
      mra: latestVisit.mra?.prescribed === 'Yes'
        ? { type: latestVisit.mra.type, dose: latestVisit.mra.dose }
        : undefined,
      sglt2i: latestVisit.sglt2i?.prescribed === 'Yes'
        ? { type: latestVisit.sglt2i.type, dose: latestVisit.sglt2i.dose }
        : undefined,
      ivabradine: latestVisit.ivabradine?.prescribed === 'Yes'
        ? { type: latestVisit.ivabradine.type, dose: latestVisit.ivabradine.dose }
        : undefined,
    }
    return targetDoseFromVisit(medSummary)
  }, [latestVisit])

  const pillars = useMemo(() => {
    if (!latestVisit) return []
    return [
      {
        id: 'raasi',
        label: 'RAASi / ARNI',
        desc: 'ACEi / ARB / ARNI (First-line to block RAAS pathway)',
        entry: latestVisit.raasi,
        achievement: doseAchievements.find(d => ['ACEi', 'ARB', 'ARNI'].includes(d.drugClass)),
      },
      {
        id: 'betaBlocker',
        label: 'Beta Blocker',
        desc: 'SNS blockade (Carvedilol, Metoprolol, Bisoprolol, Nebivolol)',
        entry: latestVisit.betaBlocker,
        achievement: doseAchievements.find(d => d.drugClass === 'BetaBlocker'),
      },
      {
        id: 'mra',
        label: 'MRA',
        desc: 'Mineralocorticoid Receptor Antagonist (Spironolactone/Eplerenone)',
        entry: latestVisit.mra,
        achievement: doseAchievements.find(d => d.drugClass === 'MRA'),
      },
      {
        id: 'sglt2i',
        label: 'SGLT2 Inhibitor',
        desc: 'Dapagliflozin / Empagliflozin (Class I HFrEF, HFmrEF, HFpEF)',
        entry: latestVisit.sglt2i,
        achievement: doseAchievements.find(d => d.drugClass === 'SGLT2i'),
      },
    ]
  }, [latestVisit, doseAchievements])

  // Count prescribed pillars
  const prescribedCount = useMemo(() => {
    return pillars.filter(p => p.entry?.prescribed === 'Yes').length
  }, [pillars])

  // Multi-factor Device criteria evaluation (ICD & CRT)
  const deviceStatus = useMemo(() => {
    if (!latestVisit) return null
    const lvef = latestVisit.lvef ?? 100
    const qrs = latestVisit.qrsDuration ?? 0
    const bbb = latestVisit.bbb || 'None'
    const rhythm = latestVisit.rhythm || 'Sinus'
    const nyha = latestVisit.nyha || patient.nyha || 'II'
    const currentDevices = latestVisit.device || []

    const hasICD = currentDevices.includes('ICD') || currentDevices.includes('CRT-D')
    const hasCRT = currentDevices.includes('CRT-D') || currentDevices.includes('CRT-P')

    // Determine HF Etiology context
    const etiologyList: string[] = latestVisit.etiology || (patient as any).etiology || []
    const isIschemic = etiologyList.some((e: string) => /cad|coronary|ischemic|infarct|mi/i.test(e)) ||
      patient.comorbidCAD || patient.comorbidPriorMI || patient.comorbidPriorPCI || patient.comorbidPriorCABG

    // ICD evaluation trigger: LVEF <= 35% in NYHA II-III (or I if ischemic) without existing ICD
    const meetsICDTrigger = lvef <= 35 && !hasICD

    // CRT evaluation pathways:
    // Class I: Sinus Rhythm + LBBB + QRS >= 150ms + LVEF <= 35%
    // Class IIa: (Sinus + LBBB + QRS 130-149ms) OR (Sinus + Non-LBBB + QRS >= 150ms)
    // Class IIb: Sinus + Non-LBBB + QRS 130-149ms
    // AF Pathway: AF + LVEF <= 35% + QRS >= 130ms (requires >=95% BiV pacing feasibility / AV node ablation)
    const isLBBB = bbb === 'LBBB'
    const isWideQRS = qrs >= 130
    const isVeryWideQRS = qrs >= 150
    const isAF = rhythm === 'AF' || rhythm === 'Atrial Flutter'

    let crtPathway: 'Class I' | 'Class IIa' | 'Class IIb' | 'AF Pathway' | 'None' = 'None'
    if (lvef <= 35 && isWideQRS && !hasCRT) {
      if (!isAF) {
        if (isLBBB && isVeryWideQRS) crtPathway = 'Class I'
        else if ((isLBBB && !isVeryWideQRS) || (!isLBBB && isVeryWideQRS)) crtPathway = 'Class IIa'
        else if (!isLBBB && !isVeryWideQRS) crtPathway = 'Class IIb'
      } else {
        crtPathway = 'AF Pathway'
      }
    }

    const meetsCRTTrigger = crtPathway !== 'None'

    return {
      hasICD,
      hasCRT,
      meetsICDTrigger,
      meetsCRTTrigger,
      crtPathway,
      isIschemic,
      lvef,
      qrs,
      bbb,
      rhythm,
      nyha,
    }
  }, [latestVisit, patient])

  // Newer agent indication checks (Vericiguat / Tafamidis)
  const newerAgents = useMemo(() => {
    if (!latestVisit) return null
    
    // Vericiguat (VICTORIA Trial): HFrEF (EF < 45%), NYHA II-IV, and worsening HF event (recent inpatient or outcome event)
    const lvef = latestVisit.lvef ?? 100
    const nyha = latestVisit.nyha || ''
    const isWorsening = latestVisit.visitType === 'Inpatient' || latestVisit.eventHospitalisation === true
    
    const qualifiesVericiguat = lvef < 45 && ['II', 'III', 'IV'].includes(nyha) && isWorsening
    const prescribedVericiguat = latestVisit.vericiguat?.prescribed === 'Yes'

    // Tafamidis: ATTR Amyloidosis genetics or etiology documented
    const etiology = latestVisit.etiology || []
    const hasAmyloidosis = etiology.some(e => e.toLowerCase().includes('amyloid')) || (latestVisit.genetics as any)?.ttrAmyloidosis === true
    const qualifiesTafamidis = hasAmyloidosis
    const prescribedTafamidis = latestVisit.tafamidis?.prescribed === 'Yes'

    return {
      qualifiesVericiguat,
      prescribedVericiguat,
      qualifiesTafamidis,
      prescribedTafamidis,
    }
  }, [latestVisit])

  // Standardized HF Phenotype classification
  const phenotype = useMemo(() => {
    const ef = latestVisit?.lvef ?? patient.lvef ?? null
    const rawType = latestVisit?.hfType || patient.hfType || ''
    
    let type: 'HFrEF' | 'HFmrEF' | 'HFpEF' | 'HFimpEF' = 'HFrEF'
    if (rawType === 'HFimpEF' || (latestVisit?.priorLvef && latestVisit.priorLvef <= 40 && ef && ef > 40)) {
      type = 'HFimpEF'
    } else if (ef !== null) {
      if (ef <= 40) type = 'HFrEF'
      else if (ef <= 49) type = 'HFmrEF'
      else type = 'HFpEF'
    } else if (rawType === 'HFmrEF') {
      type = 'HFmrEF'
    } else if (rawType === 'HFpEF') {
      type = 'HFpEF'
    }

    return {
      type,
      ef,
      isHFrEF: type === 'HFrEF',
      isHFmrEF: type === 'HFmrEF',
      isHFpEF: type === 'HFpEF',
      isHFimpEF: type === 'HFimpEF',
      isFourPillarsMandatory: type === 'HFrEF' || type === 'HFimpEF',
    }
  }, [latestVisit, patient])

  if (!latestVisit) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center bg-slate-900/40 rounded-2xl border border-blue-500/10">
        <Heart className="w-8 h-8 text-gray-500 mb-3 animate-pulse" />
        <h3 className="text-sm font-semibold text-white">No Visits Recorded</h3>
        <p className="text-xs text-gray-500 max-w-xs mt-1">
          Add a visit record with medication and echo parameters to enable GDMT optimization checklists.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6 text-gray-300">

      {/* Phenotype Guidance Banner */}
      <div className={cn(
        "p-4 rounded-xl border flex items-start gap-3",
        phenotype.isHFrEF || phenotype.isHFimpEF
          ? "bg-blue-950/30 border-blue-500/25 text-blue-200"
          : "bg-emerald-950/20 border-emerald-500/25 text-emerald-200"
      )}>
        <Info className="w-5 h-5 flex-shrink-0 mt-0.5 text-blue-400" />
        <div className="text-xs space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-white uppercase tracking-wider">
              Phenotype: {phenotype.type} {phenotype.ef !== null ? `(LVEF ${phenotype.ef}%)` : ''}
            </span>
            <span className="badge badge-blue text-[9px] font-extrabold uppercase">
              {phenotype.isFourPillarsMandatory ? '4-Pillar GDMT Target' : 'Phenotype-Specific Management'}
            </span>
          </div>
          <p className="text-gray-300 leading-relaxed">
            {phenotype.isHFrEF
              ? 'HFrEF (LVEF ≤40%): Quadruple foundational therapy (ARNI/RAASi, Beta-Blocker, MRA, SGLT2i) is Class I-A guideline mandated to reduce mortality and hospitalization.'
              : phenotype.isHFimpEF
              ? 'HFimpEF (Improved EF >40% after prior ≤40%): Maintain full 4-pillar GDMT indefinitely to prevent relapse and left ventricular remodelling.'
              : phenotype.isHFmrEF
              ? 'HFmrEF (LVEF 41–49%): SGLT2 inhibitors and loop diuretics represent foundational Class I therapies. RAASi, MRA, and Beta-blockers carry Class IIb/IIa recommendations.'
              : 'HFpEF (LVEF ≥50%): SGLT2 inhibitors (Class I-A) and loop diuretics for congestion represent core evidence-based therapies. Full 4-pillar therapy is not mandated unless hypertension, CAD, or specific comorbidities warrant.'}
          </p>
        </div>
      </div>
      
      {/* Adherence Score Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Core Pillars Gauge */}
        <div className="gradient-card bg-gradient-to-br from-blue-950/20 to-indigo-950/10 p-5 rounded-2xl border border-blue-500/15 flex items-center justify-between">
          <div className="space-y-2">
            <p className="text-[10px] uppercase text-gray-400 font-bold tracking-wider">
              {phenotype.isFourPillarsMandatory ? '4-Pillar GDMT Count' : 'SGLT2i & Core Therapy'}
            </p>
            <h4 className="text-3xl font-extrabold text-white">
              {phenotype.isFourPillarsMandatory ? `${prescribedCount} / 4` : `${latestVisit.sglt2i?.prescribed === 'Yes' ? 'Active' : 'Missing'}`}
            </h4>
            <p className="text-[11px] text-gray-400">
              {phenotype.isFourPillarsMandatory
                ? prescribedCount === 4
                  ? 'All 4 foundational pillars prescribed! 🎉'
                  : `${4 - prescribedCount} missing or documented contraindications`
                : latestVisit.sglt2i?.prescribed === 'Yes'
                ? 'SGLT2i prescribed (Class I in HFmrEF/HFpEF)'
                : 'Consider SGLT2i for CV death / HF hospitalization reduction'}
            </p>
          </div>
          <div className="relative w-16 h-16 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90">
              <circle cx="32" cy="32" r="28" stroke="rgba(59, 130, 246, 0.1)" strokeWidth="5" fill="transparent" />
              <circle cx="32" cy="32" r="28" stroke="#3b82f6" strokeWidth="5" fill="transparent"
                strokeDasharray={175} strokeDashoffset={175 - (prescribedCount / 4) * 175} />
            </svg>
            <span className="absolute text-xs font-extrabold text-white font-mono">{(prescribedCount / 4) * 100}%</span>
          </div>
        </div>

        {/* Target Dosage Optimization Status */}
        <div className="gradient-card bg-gradient-to-br from-violet-950/20 to-purple-950/10 p-5 rounded-2xl border border-violet-500/15 flex items-center justify-between">
          <div className="space-y-1.5 w-full">
            <p className="text-[10px] uppercase text-gray-400 font-bold tracking-wider">Dose Escalation Status</p>
            {prescribedCount === 0 ? (
              <p className="text-xs text-gray-500 py-3">No core GDMT pillars prescribed.</p>
            ) : (
              <div className="space-y-2.5 pt-1">
                {doseAchievements.map(ach => (
                  <div key={ach.drugClass} className="space-y-1">
                    <div className="flex justify-between text-[10px] text-gray-400">
                      <span className="font-semibold text-white">{ach.drugClass === 'BetaBlocker' ? 'Beta Blocker' : ach.drugClass}</span>
                      <span>{ach.percentage}% achieved</span>
                    </div>
                    <div className="progress-track h-1 bg-gray-900">
                      <div className={cn(
                        "progress-fill h-full rounded",
                        ach.percentage >= 100 ? "bg-emerald-500" : ach.percentage >= 50 ? "bg-amber-400" : "bg-rose-500"
                      )} style={{ width: `${ach.percentage}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Overall Guideline Award Card */}
        <div className="gradient-card bg-gradient-to-br from-emerald-950/20 to-teal-950/10 p-5 rounded-2xl border border-emerald-500/15 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 flex-shrink-0">
            <Award className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <p className="text-[10px] uppercase text-gray-400 font-bold tracking-wider">Clinical Guideline Status</p>
            <h4 className="text-sm font-bold text-white">
              {prescribedCount === 4
                ? 'Optimal Guideline Adherence'
                : phenotype.isFourPillarsMandatory
                ? 'GDMT Optimization Target'
                : 'Phenotype Protocol Active'}
            </h4>
            <p className="text-[10px] text-gray-400 leading-normal">
              {phenotype.isFourPillarsMandatory
                ? prescribedCount === 4
                  ? 'Excellent work. Maintain patient on target doses and audit regularly.'
                  : 'Titrate pillars up to target doses to improve long-term survival.'
                : 'Tailor therapy to volume status, comorbidities, and SGLT2i coverage.'}
            </p>
          </div>
        </div>

      </div>

      {/* The 4 Pillars Checklist Grid */}
      <div>
        <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-1.5">
          <Zap className="w-4 h-4 text-blue-400" />
          {phenotype.isFourPillarsMandatory ? 'The 4 Pillars of HFrEF Therapy Checklist' : 'Medication & Decongestion Checklist'}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {pillars.map(p => {
            const isPrescribed = p.entry?.prescribed === 'Yes'
            const isContraindicated = p.entry?.prescribed === 'No' && p.entry?.reason
            const isMissing = !isPrescribed && !isContraindicated

            return (
              <div key={p.id} className={cn(
                "p-4 rounded-xl border flex flex-col justify-between space-y-3 transition-all",
                isPrescribed && "bg-emerald-950/5 border-emerald-500/20",
                isContraindicated && "bg-amber-950/5 border-amber-500/20",
                isMissing && "bg-rose-950/5 border-rose-500/20"
              )}>
                
                {/* Header & Status Badge */}
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <h4 className="text-sm font-bold text-white">{p.label}</h4>
                    <p className="text-[10px] text-gray-500 mt-0.5">{p.desc}</p>
                  </div>
                  <span className={cn(
                    "badge text-[9px] uppercase font-extrabold flex items-center gap-1",
                    isPrescribed && "badge-green",
                    isContraindicated && "badge-amber",
                    isMissing && "badge-red"
                  )}>
                    {isPrescribed && <CheckCircle2 className="w-3 h-3" />}
                    {isContraindicated && <AlertTriangle className="w-3 h-3" />}
                    {isMissing && <XCircle className="w-3 h-3" />}
                    {isPrescribed ? 'Prescribed' : isContraindicated ? 'Contraindicated' : 'Missing'}
                  </span>
                </div>

                {/* Body Details */}
                <div className="text-xs bg-slate-900/30 p-2.5 rounded-lg border border-gray-800/40 min-h-[50px] flex flex-col justify-center">
                  {isPrescribed ? (
                    <div className="space-y-1">
                      <div className="flex justify-between font-semibold flex-wrap gap-1">
                        <span className="text-blue-400 font-mono">{p.entry?.formulation || p.entry?.type || 'Generic molecule active'}</span>
                        <span className="text-white font-mono">{p.entry?.dose || '—'} {p.entry?.frequency ? `(${p.entry.frequency})` : ''}</span>
                      </div>
                      {p.achievement && (
                        <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                          <span>Target: {p.achievement.targetDrugLabel}</span>
                          <span className={cn(
                            "font-bold font-mono",
                            p.achievement.percentage < 50 ? "text-rose-400" : "text-emerald-400"
                          )}>{p.achievement.percentage}% of Target Dose</span>
                        </div>
                      )}
                    </div>
                  ) : isContraindicated ? (
                    <div className="space-y-1">
                      <span className="text-amber-400 font-semibold text-[11px]">Documented Clinical / Economic Reason:</span>
                      <p className="text-gray-300 font-medium text-xs bg-amber-950/20 border border-amber-500/20 px-2 py-1 rounded">
                        {p.entry?.reason}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1 text-rose-300">
                      <p className="font-semibold flex items-center gap-1">
                        <ShieldAlert className="w-3.5 h-3.5" /> High priority clinical gap!
                      </p>
                      <p className="text-[10px] text-gray-400 leading-normal">
                        No documented prescription or contraindication. Evaluate for initiation of this pillar.
                      </p>
                    </div>
                  )}
                </div>

                {/* Dosage Recommendation Alert */}
                {isPrescribed && p.achievement && p.achievement.percentage < 50 && (
                  <div className="flex items-start gap-2 bg-rose-500/5 p-2 rounded-lg border border-rose-500/10 text-[10px] text-rose-300">
                    <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                    <p>
                      Dose is below 50% target (current: {p.entry?.dose} vs target: {p.achievement.targetDailyDoseMg}mg/day).
                      Consider uptitration every 2 weeks if tolerated (check blood pressure, heart rate, and serum chemistries).
                    </p>
                  </div>
                )}

              </div>
            )
          })}
        </div>
      </div>

      {/* Device Optimization Advisor Card */}
      {deviceStatus && (
        <div className="glass-card p-5 border border-blue-500/10 rounded-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-blue-500/10 pb-2 flex-wrap gap-2">
            <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-400" />
              Device Therapy Referral &amp; Eligibility Evaluation (ICD / CRT)
            </h3>
            <span className="text-[10px] text-gray-400 font-medium">
              Clinical Decision Support: Screening Trigger Only · Formal Evaluation Required
            </span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* ICD Evaluation */}
            <div className={cn(
              "p-4 rounded-xl border space-y-3",
              deviceStatus.meetsICDTrigger ? "bg-amber-500/5 border-amber-500/25" : "bg-slate-900/40 border-gray-800"
            )}>
              <div className="flex justify-between items-center flex-wrap gap-1">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">ICD Evaluation Status</h4>
                {deviceStatus.hasICD ? (
                  <span className="badge badge-green text-[8px] font-extrabold uppercase">Existing Implant (ICD/CRT-D)</span>
                ) : deviceStatus.meetsICDTrigger ? (
                  <span className="badge badge-amber text-[8px] font-extrabold uppercase">Possible Referral for Eligibility Assessment</span>
                ) : (
                  <span className="badge badge-gray text-[8px] font-extrabold uppercase">Criteria Not Met</span>
                )}
              </div>

              <div className="space-y-1.5 text-[11px] text-gray-300">
                <div className="flex items-center justify-between border-b border-white/5 pb-1">
                  <span className="text-gray-400">LVEF Trigger:</span>
                  <span className={cn("font-semibold", deviceStatus.lvef <= 35 ? "text-amber-400" : "text-gray-300")}>
                    {deviceStatus.lvef}% ({deviceStatus.lvef <= 35 ? '≤ 35% Threshold Met' : '> 35%'})
                  </span>
                </div>
                <div className="flex items-center justify-between border-b border-white/5 pb-1">
                  <span className="text-gray-400">Etiology Context:</span>
                  <span className="font-semibold text-gray-200">
                    {deviceStatus.isIschemic ? 'Ischemic CMP (>40d post-MI / >90d post-CABG/PCI required)' : 'Non-Ischemic CMP (DCM/NICM)'}
                  </span>
                </div>
                <div className="flex items-center justify-between border-b border-white/5 pb-1">
                  <span className="text-gray-400">Functional Class:</span>
                  <span className="font-semibold text-gray-200">NYHA Class {deviceStatus.nyha}</span>
                </div>
                <div className="flex items-center justify-between border-b border-white/5 pb-1">
                  <span className="text-gray-400">Medical Therapy:</span>
                  <span className="font-semibold text-gray-200">≥3 months optimized GDMT required</span>
                </div>
                <div className="flex items-center justify-between border-b border-white/5 pb-1">
                  <span className="text-gray-400">Prognosis &amp; Goals:</span>
                  <span className="font-semibold text-gray-200">&gt;1 year meaningful survival &amp; shared decision-making</span>
                </div>
              </div>

              <p className="text-xs text-gray-400 leading-normal pt-1">
                {deviceStatus.hasICD
                  ? "Patient has documented ICD / CRT-D device in situ."
                  : deviceStatus.meetsICDTrigger
                    ? "Patient exhibits severe LV systolic dysfunction (LVEF ≤35%). Consider electrophysiology (EP) referral for sudden cardiac death (SCD) risk assessment and primary prevention ICD counselling after verifying ≥3 months of optimized GDMT and appropriate post-revascularization windows."
                    : `LVEF is ${deviceStatus.lvef}% (>35%). Standard primary prevention ICD guideline criteria not triggered.`}
              </p>
            </div>

            {/* CRT Evaluation */}
            <div className={cn(
              "p-4 rounded-xl border space-y-3",
              deviceStatus.meetsCRTTrigger ? "bg-amber-500/5 border-amber-500/25" : "bg-slate-900/40 border-gray-800"
            )}>
              <div className="flex justify-between items-center flex-wrap gap-1">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">CRT-D/P Evaluation Status</h4>
                {deviceStatus.hasCRT ? (
                  <span className="badge badge-green text-[8px] font-extrabold uppercase">Existing Implant (CRT)</span>
                ) : deviceStatus.meetsCRTTrigger ? (
                  <span className="badge badge-amber text-[8px] font-extrabold uppercase">Possible Referral for Eligibility Assessment</span>
                ) : (
                  <span className="badge badge-gray text-[8px] font-extrabold uppercase">Criteria Not Met</span>
                )}
              </div>

              <div className="space-y-1.5 text-[11px] text-gray-300">
                <div className="flex items-center justify-between border-b border-white/5 pb-1">
                  <span className="text-gray-400">Guideline Pathway:</span>
                  <span className={cn(
                    "font-bold",
                    deviceStatus.crtPathway === 'Class I' ? 'text-emerald-400' :
                    deviceStatus.crtPathway.startsWith('Class II') ? 'text-amber-400' :
                    deviceStatus.crtPathway === 'AF Pathway' ? 'text-cyan-400' : 'text-gray-400'
                  )}>
                    {deviceStatus.crtPathway !== 'None' ? `${deviceStatus.crtPathway} Evaluation Pathway` : 'Criteria Not Met'}
                  </span>
                </div>
                <div className="flex items-center justify-between border-b border-white/5 pb-1">
                  <span className="text-gray-400">ECG Morphology:</span>
                  <span className="font-semibold text-gray-200">{deviceStatus.bbb} (LBBB Class I vs Non-LBBB Class II)</span>
                </div>
                <div className="flex items-center justify-between border-b border-white/5 pb-1">
                  <span className="text-gray-400">QRS Duration:</span>
                  <span className={cn("font-semibold", deviceStatus.qrs >= 130 ? "text-amber-400" : "text-gray-200")}>
                    {deviceStatus.qrs} ms ({deviceStatus.qrs >= 150 ? '≥150ms' : deviceStatus.qrs >= 130 ? '130–149ms' : '<130ms'})
                  </span>
                </div>
                <div className="flex items-center justify-between border-b border-white/5 pb-1">
                  <span className="text-gray-400">Rhythm Context:</span>
                  <span className="font-semibold text-gray-200">
                    {deviceStatus.rhythm} ({deviceStatus.rhythm === 'AF' ? 'AF pathway: ≥95% BiV capture / AV junction ablation required' : 'Sinus rhythm'})
                  </span>
                </div>
                <div className="flex items-center justify-between border-b border-white/5 pb-1">
                  <span className="text-gray-400">Pacing Context:</span>
                  <span className="font-semibold text-gray-200">High RV pacing burden (&gt;40%) prevention</span>
                </div>
              </div>

              <p className="text-xs text-gray-400 leading-normal pt-1">
                {deviceStatus.hasCRT
                  ? "Patient has documented CRT-D or CRT-P device in situ."
                  : deviceStatus.meetsCRTTrigger
                    ? `Cardiac resynchronization screening criteria met (LVEF ${deviceStatus.lvef}%, ${deviceStatus.bbb}, QRS ${deviceStatus.qrs}ms). Consider referral to EP / heart failure device clinic for individualized candidacy evaluation.`
                    : `Patient does not meet primary resynchronization screening thresholds (QRS: ${deviceStatus.qrs}ms, Morphology: ${deviceStatus.bbb}, LVEF: ${deviceStatus.lvef}%). CRT requires LVEF ≤35% with QRS ≥130ms.`}
              </p>
            </div>

          </div>
        </div>
      )}

      {/* Newer Medical Agents Section */}
      {newerAgents && (
        <div className="glass-card p-5 border border-blue-500/10 rounded-2xl space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-1.5 border-b border-blue-500/10 pb-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            Newer HF Agents &amp; Target Population Advisor (Victoria / Amyloid)
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Vericiguat */}
            <div className={cn(
              "p-4 rounded-xl border space-y-2.5",
              newerAgents.qualifiesVericiguat && !newerAgents.prescribedVericiguat ? "bg-amber-500/5 border-amber-500/20" : "bg-slate-900/40 border-gray-800"
            )}>
              <div className="flex justify-between items-center">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">Vericiguat (sGC Stimulator)</h4>
                {newerAgents.prescribedVericiguat ? (
                  <span className="badge badge-green text-[8px] font-extrabold uppercase">Prescribed</span>
                ) : newerAgents.qualifiesVericiguat ? (
                  <span className="badge badge-amber text-[8px] font-extrabold uppercase">Indicated</span>
                ) : (
                  <span className="badge badge-gray text-[8px] font-extrabold uppercase">Not Indicated</span>
                )}
              </div>
              <p className="text-xs text-gray-400 leading-normal">
                {newerAgents.prescribedVericiguat
                  ? "Vericiguat is already prescribed."
                  : newerAgents.qualifiesVericiguat
                    ? "Patient qualifies for Vericiguat (VICTORIA trial: NYHA II-IV, LVEF < 45%, and a recent worsening HF event / hospitalization). Consider initiation to reduce CV death and HF hospitalization risk."
                    : `Criteria not met. Requires HFrEF/HFmrEF (<45%) with recent worsening HF hospitalization/IV diuretic event.`}
              </p>
            </div>

            {/* Tafamidis */}
            <div className={cn(
              "p-4 rounded-xl border space-y-2.5",
              newerAgents.qualifiesTafamidis && !newerAgents.prescribedTafamidis ? "bg-amber-500/5 border-amber-500/20" : "bg-slate-900/40 border-gray-800"
            )}>
              <div className="flex justify-between items-center">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">Tafamidis (Amyloidosis Stabilizer)</h4>
                {newerAgents.prescribedTafamidis ? (
                  <span className="badge badge-green text-[8px] font-extrabold uppercase">Prescribed</span>
                ) : newerAgents.qualifiesTafamidis ? (
                  <span className="badge badge-amber text-[8px] font-extrabold uppercase">Indicated</span>
                ) : (
                  <span className="badge badge-gray text-[8px] font-extrabold uppercase">Not Indicated</span>
                )}
              </div>
              <p className="text-xs text-gray-400 leading-normal">
                {newerAgents.prescribedTafamidis
                  ? "Tafamidis is prescribed for TTR-CM amyloidosis."
                  : newerAgents.qualifiesTafamidis
                    ? "Patient has documented ATTR Amyloidosis etiology/genetics. Tafamidis is indicated to reduce all-cause mortality and cardiovascular hospitalizations."
                    : "No documented diagnosis of Transthyretin amyloid cardiomyopathy (TTR-CM) / Amyloidosis etiology."}
              </p>
            </div>

          </div>
        </div>
      )}

    </div>
  )
}
