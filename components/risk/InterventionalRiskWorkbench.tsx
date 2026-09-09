'use client'

import React, { useState, useMemo, useEffect } from 'react'
import {
  Zap, AlertTriangle, ShieldAlert, Heart, Activity, CheckCircle,
  HelpCircle, Clock, Droplets, AlertCircle, FileText, ChevronRight
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import {
  calculateGRACE2, calculateTIMIRiskSTEMI, calculateTIMIRiskNSTEMI,
  calculateCRUSADE, calculateARCHBR, calculatePRECISEDAPT, calculateACEF,
  calculateContrastNephropathyRisk,
  type GRACEInput, type TIMIStemiInput, type TIMINstemiInput,
  type CRUSADEInput, type ARCHBRInput, type PRECISEDAPTInput, type ACEFInput
} from '@/lib/riskScores'
import type { Patient, Visit } from '@/lib/types'

interface Props {
  patient?: Patient | null
  visit?: Visit | null
}

type PciCalculatorId = 'grace' | 'timi' | 'crusade' | 'archbr' | 'precisedapt' | 'mehran' | 'acef'

export default function InterventionalRiskWorkbench({ patient, visit }: Props) {
  const [activeCalc, setActiveCalc] = useState<PciCalculatorId>('grace')

  // Patient base demographics
  const age = useMemo(() => {
    if (patient?.dob) {
      return Math.floor((Date.now() - new Date(patient.dob).getTime()) / (365.25 * 86400000))
    }
    return patient?.age || 62
  }, [patient])

  const sex = (patient?.sex || 'Male') as 'Male' | 'Female'
  const creatinine = visit?.creatinine || 1.1
  const eGFR = visit?.egfr || Math.max(15, Math.round(90 / creatinine))
  const lvef = visit?.lvef ?? patient?.lvef ?? 45
  const sbp = visit?.bpSystolic || 128
  const hr = visit?.heartRate || 78

  // 1. GRACE State
  const [graceAge, setGraceAge] = useState(age)
  const [graceHr, setGraceHr] = useState(hr)
  const [graceSbp, setGraceSbp] = useState(sbp)
  const [graceCr, setGraceCr] = useState(creatinine)
  const [graceKillip, setGraceKillip] = useState<'I' | 'II' | 'III' | 'IV'>('I')
  const [graceCardiacArrest, setGraceCardiacArrest] = useState(false)
  const [graceStDev, setGraceStDev] = useState(true)
  const [graceEnzymes, setGraceEnzymes] = useState(true)

  // 2. TIMI STEMI State
  const [timiStemiAge, setTimiStemiAge] = useState(age)
  const [timiRiskFactors, setTimiRiskFactors] = useState(true)
  const [timiStemiSbp, setTimiStemiSbp] = useState(sbp)
  const [timiStemiHr, setTimiStemiHr] = useState(hr)
  const [timiStemiKillip, setTimiStemiKillip] = useState<'I' | 'II' | 'III' | 'IV'>('I')
  const [timiStemiWeight, setTimiStemiWeight] = useState(70)
  const [timiAnteriorOrLbbb, setTimiAnteriorOrLbbb] = useState(true)
  const [timiTreatmentDelay, setTimiTreatmentDelay] = useState(3)

  // 3. TIMI NSTEMI State
  const [timiNstemiAge65, setTimiNstemiAge65] = useState(age >= 65)
  const [timiNstemiRiskFactors, setTimiNstemiRiskFactors] = useState(true)
  const [timiNstemiKnownCad, setTimiNstemiKnownCad] = useState(Boolean(patient?.comorbidCAD || patient?.comorbidPriorPCI))
  const [timiNstemiAspirin, setTimiNstemiAspirin] = useState(true)
  const [timiNstemiSevereAngina, setTimiNstemiSevereAngina] = useState(true)
  const [timiNstemiStDev, setTimiNstemiStDev] = useState(true)
  const [timiNstemiEnzymes, setTimiNstemiEnzymes] = useState(true)

  // 4. CRUSADE State
  const [crusadeHct, setCrusadeHct] = useState(38)
  const [crusadeCrCl, setCrusadeCrCl] = useState(eGFR)
  const [crusadeHr, setCrusadeHr] = useState(hr)
  const [crusadeFemale, setCrusadeFemale] = useState(sex === 'Female')
  const [crusadeChf, setCrusadeChf] = useState(false)
  const [crusadeVasc, setCrusadeVasc] = useState(Boolean(patient?.comorbidCAD || patient?.comorbidPriorPCI))
  const [crusadeDm, setCrusadeDm] = useState(Boolean(patient?.comorbidDiabetes))
  const [crusadeSbp, setCrusadeSbp] = useState(sbp)

  // 5. ARC-HBR State
  const [hbrOac, setHbrOac] = useState(false)
  const [hbrSevereCkd, setHbrSevereCkd] = useState(eGFR < 30)
  const [hbrHbUnder11, setHbrHbUnder11] = useState(false)
  const [hbrSpontBleed6m, setHbrSpontBleed6m] = useState(false)
  const [hbrPltUnder100, setHbrPltUnder100] = useState(false)
  const [hbrDiathesis, setHbrDiathesis] = useState(false)
  const [hbrCirrhosis, setHbrCirrhosis] = useState(false)
  const [hbrMalignancy, setHbrMalignancy] = useState(false)
  const [hbrIch, setHbrIch] = useState(false)
  const [hbrStroke6m, setHbrStroke6m] = useState(false)
  const [hbrAge75, setHbrAge75] = useState(age >= 75)
  const [hbrModCkd, setHbrModCkd] = useState(eGFR >= 30 && eGFR < 60)
  const [hbrMildAnemia, setHbrMildAnemia] = useState(false)
  const [hbrBleed12m, setHbrBleed12m] = useState(false)
  const [hbrNsaid, setHbrNsaid] = useState(false)
  const [hbrPriorStroke, setHbrPriorStroke] = useState(false)

  // 6. PRECISE-DAPT State
  const [pdAge, setPdAge] = useState(age)
  const [pdCrCl, setPdCrCl] = useState(eGFR)
  const [pdHb, setPdHb] = useState(13.2)
  const [pdWbc, setPdWbc] = useState(8.5)
  const [pdPriorBleed, setPdPriorBleed] = useState(false)

  // 7. Mehran CIN State (corrected)
  const [mehranAge, setMehranAge] = useState(age)
  const [mehranCr, setMehranCr] = useState(creatinine)
  const [mehranEgfr, setMehranEgfr] = useState(eGFR)
  const [mehranContrast, setMehranContrast] = useState(160)
  const [mehranDm, setMehranDm] = useState(Boolean(patient?.comorbidDiabetes))
  const [mehranHypotension, setMehranHypotension] = useState(false)
  const [mehranIabp, setMehranIabp] = useState(false)
  const [mehranChf, setMehranChf] = useState(lvef < 40)
  const [mehranAnemia, setMehranAnemia] = useState(false)

  // 8. ACEF State
  const [acefAge, setAcefAge] = useState(age)
  const [acefLvef, setAcefLvef] = useState(lvef)
  const [acefCr, setAcefCr] = useState(creatinine)

  // Synchronize when patient or visit changes
  useEffect(() => {
    setGraceAge(age)
    setGraceHr(hr)
    setGraceSbp(sbp)
    setGraceCr(creatinine)
    setTimiStemiAge(age)
    setTimiStemiSbp(sbp)
    setTimiStemiHr(hr)
    setCrusadeCrCl(eGFR)
    setCrusadeHr(hr)
    setCrusadeSbp(sbp)
    setCrusadeFemale(sex === 'Female')
    setPdAge(age)
    setPdCrCl(eGFR)
    setMehranAge(age)
    setMehranCr(creatinine)
    setMehranEgfr(eGFR)
    setAcefAge(age)
    setAcefLvef(lvef)
    setAcefCr(creatinine)
  }, [age, hr, sbp, creatinine, eGFR, lvef, sex])

  // Computations
  const graceResult = useMemo(() => calculateGRACE2({
    age: graceAge,
    heartRate: graceHr,
    systolicBp: graceSbp,
    creatinine: graceCr,
    killipClass: graceKillip,
    cardiacArrestAtAdmission: graceCardiacArrest,
    stSegmentDeviation: graceStDev,
    elevatedCardiacEnzymes: graceEnzymes,
  }), [graceAge, graceHr, graceSbp, graceCr, graceKillip, graceCardiacArrest, graceStDev, graceEnzymes])

  const timiStemiResult = useMemo(() => calculateTIMIRiskSTEMI({
    age: timiStemiAge,
    diabetesOrHypertensionOrAngina: timiRiskFactors,
    systolicBp: timiStemiSbp,
    heartRate: timiStemiHr,
    killipClass: timiStemiKillip,
    weightKg: timiStemiWeight,
    anteriorStemiOrLbbb: timiAnteriorOrLbbb,
    timeToTreatmentHours: timiTreatmentDelay,
  }), [timiStemiAge, timiRiskFactors, timiStemiSbp, timiStemiHr, timiStemiKillip, timiStemiWeight, timiAnteriorOrLbbb, timiTreatmentDelay])

  const timiNstemiResult = useMemo(() => calculateTIMIRiskNSTEMI({
    age65OrOlder: timiNstemiAge65,
    threeOrMoreCadRiskFactors: timiNstemiRiskFactors,
    knownCadStenosis50PctOrMore: timiNstemiKnownCad,
    aspirinUsePast7Days: timiNstemiAspirin,
    severeAnginaInPast24Hours: timiNstemiSevereAngina,
    stSegmentDeviation05MmOrMore: timiNstemiStDev,
    elevatedCardiacMarkers: timiNstemiEnzymes,
  }), [timiNstemiAge65, timiNstemiRiskFactors, timiNstemiKnownCad, timiNstemiAspirin, timiNstemiSevereAngina, timiNstemiStDev, timiNstemiEnzymes])

  const crusadeResult = useMemo(() => calculateCRUSADE({
    hematocrit: crusadeHct,
    creatinineClearance: crusadeCrCl,
    heartRate: crusadeHr,
    femaleSex: crusadeFemale,
    signsOfChfAtPresentation: crusadeChf,
    priorVascularDisease: crusadeVasc,
    diabetes: crusadeDm,
    systolicBp: crusadeSbp,
  }), [crusadeHct, crusadeCrCl, crusadeHr, crusadeFemale, crusadeChf, crusadeVasc, crusadeDm, crusadeSbp])

  const archbrResult = useMemo(() => calculateARCHBR({
    anticipatedOralAnticoagulation: hbrOac,
    severeOrEndStageCkd: hbrSevereCkd,
    hemoglobinLessThan11: hbrHbUnder11,
    spontaneousBleedingPast6Months: hbrSpontBleed6m,
    thrombocytopeniaUnder100k: hbrPltUnder100,
    chronicBleedingDiathesis: hbrDiathesis,
    liverCirrhosisWithPortalHypertension: hbrCirrhosis,
    activeMalignancyPast12Months: hbrMalignancy,
    priorSpontaneousIchOrBrainAvm: hbrIch,
    recentIschemicStrokePast6Months: hbrStroke6m,
    age75OrOlder: hbrAge75,
    moderateCkd: hbrModCkd,
    hemoglobin11To12Point9MenOr11To11Point9Women: hbrMildAnemia,
    spontaneousBleedingPast12Months: hbrBleed12m,
    chronicNsaidOrSteroidUse: hbrNsaid,
    anyPriorIschemicStrokeNotMeetingMajor: hbrPriorStroke,
  }), [hbrOac, hbrSevereCkd, hbrHbUnder11, hbrSpontBleed6m, hbrPltUnder100, hbrDiathesis, hbrCirrhosis, hbrMalignancy, hbrIch, hbrStroke6m, hbrAge75, hbrModCkd, hbrMildAnemia, hbrBleed12m, hbrNsaid, hbrPriorStroke])

  const preciseDaptResult = useMemo(() => calculatePRECISEDAPT({
    age: pdAge,
    creatinineClearance: pdCrCl,
    hemoglobin: pdHb,
    whiteBloodCellCount: pdWbc,
    priorSpontaneousBleeding: pdPriorBleed,
  }), [pdAge, pdCrCl, pdHb, pdWbc, pdPriorBleed])

  const mehranResult = useMemo(() => calculateContrastNephropathyRisk({
    age: mehranAge,
    creatinine: mehranCr,
    eGFR: mehranEgfr,
    contrastVolumeMl: mehranContrast,
    diabetes: mehranDm,
    hypotension: mehranHypotension,
    iabpUse: mehranIabp,
    heartFailure: mehranChf,
    anemia: mehranAnemia,
  }), [mehranAge, mehranCr, mehranEgfr, mehranContrast, mehranDm, mehranHypotension, mehranIabp, mehranChf, mehranAnemia])

  const acefResult = useMemo(() => calculateACEF({
    age: acefAge,
    lvef: acefLvef,
    creatinine: acefCr,
  }), [acefAge, acefLvef, acefCr])

  return (
    <div className="space-y-6">
      {/* Category Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-white/10">
        {[
          { id: 'grace', label: 'GRACE 2.0 (ACS Mortality)' },
          { id: 'timi', label: 'TIMI (STEMI & NSTEMI)' },
          { id: 'crusade', label: 'CRUSADE (Bleeding Risk)' },
          { id: 'archbr', label: 'ARC-HBR (Consensus HBR)' },
          { id: 'precisedapt', label: 'PRECISE-DAPT (DAPT Duration)' },
          { id: 'mehran', label: 'Mehran CIN (Nephropathy)' },
          { id: 'acef', label: 'ACEF (PCI Mortality)' },
        ].map(calc => (
          <button
            key={calc.id}
            onClick={() => setActiveCalc(calc.id as PciCalculatorId)}
            className={cn(
              'px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border',
              activeCalc === calc.id
                ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold shadow-md'
                : 'text-gray-400 bg-slate-900/60 border-white/5 hover:text-white'
            )}
          >
            {calc.label}
          </button>
        ))}
      </div>

      {/* 1. GRACE 2.0 */}
      {activeCalc === 'grace' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" /> GRACE 2.0 ACS Mortality Predictor
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400">Age (years)</label>
                <input
                  type="number"
                  value={graceAge}
                  onChange={e => setGraceAge(Number(e.target.value))}
                  className="input-field w-full text-xs mt-1"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400">Heart Rate (bpm)</label>
                <input
                  type="number"
                  value={graceHr}
                  onChange={e => setGraceHr(Number(e.target.value))}
                  className="input-field w-full text-xs mt-1"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400">Systolic BP (mmHg)</label>
                <input
                  type="number"
                  value={graceSbp}
                  onChange={e => setGraceSbp(Number(e.target.value))}
                  className="input-field w-full text-xs mt-1"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400">Creatinine (mg/dL)</label>
                <input
                  type="number"
                  step="0.1"
                  value={graceCr}
                  onChange={e => setGraceCr(Number(e.target.value))}
                  className="input-field w-full text-xs mt-1"
                />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-gray-400">Killip Class</label>
                <select
                  value={graceKillip}
                  onChange={e => setGraceKillip(e.target.value as any)}
                  className="input-field w-full text-xs mt-1"
                >
                  <option value="I">Class I: No signs of heart failure</option>
                  <option value="II">Class II: Rales / S3 gallop / elevated JVP</option>
                  <option value="III">Class III: Frank pulmonary edema</option>
                  <option value="IV">Class IV: Cardiogenic shock</option>
                </select>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <label className="flex items-center gap-2 text-xs text-gray-300">
                <input
                  type="checkbox"
                  checked={graceCardiacArrest}
                  onChange={e => setGraceCardiacArrest(e.target.checked)}
                  className="rounded border-white/20"
                />
                Cardiac arrest at initial presentation (+43 pts)
              </label>
              <label className="flex items-center gap-2 text-xs text-gray-300">
                <input
                  type="checkbox"
                  checked={graceStDev}
                  onChange={e => setGraceStDev(e.target.checked)}
                  className="rounded border-white/20"
                />
                ST-segment deviation (depression or elevation) (+30 pts)
              </label>
              <label className="flex items-center gap-2 text-xs text-gray-300">
                <input
                  type="checkbox"
                  checked={graceEnzymes}
                  onChange={e => setGraceEnzymes(e.target.checked)}
                  className="rounded border-white/20"
                />
                Elevated cardiac troponin / biomarkers (+15 pts)
              </label>
            </div>
          </div>

          <div className="lg:col-span-5 space-y-4">
            <div className="glass-card p-5 border border-amber-500/20 bg-amber-950/20 space-y-4 rounded-2xl">
              <div>
                <p className="text-[10px] uppercase font-bold text-amber-300">Calculated GRACE Score</p>
                <div className="flex items-baseline gap-3 mt-1">
                  <span className="text-4xl font-extrabold text-white">{graceResult.graceScore}</span>
                  <span className={cn(
                    'px-2.5 py-0.5 rounded-full text-xs font-bold',
                    graceResult.inHospitalRiskTier === 'High' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' :
                    graceResult.inHospitalRiskTier === 'Intermediate' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                    'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  )}>
                    {graceResult.inHospitalRiskTier} Risk
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/10">
                <div>
                  <p className="text-[11px] text-gray-400">In-Hospital Mortality</p>
                  <p className="text-xl font-bold text-rose-400">{graceResult.inHospitalMortalityPct}%</p>
                </div>
                <div>
                  <p className="text-[11px] text-gray-400">6-Month Mortality</p>
                  <p className="text-xl font-bold text-amber-400">{graceResult.sixMonthMortalityPct}%</p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-900/80 border border-white/10 text-xs text-gray-300 leading-relaxed">
                <p className="font-semibold text-white mb-1">Guideline Recommendation:</p>
                {graceResult.recommendation}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. TIMI STEMI & NSTEMI */}
      {activeCalc === 'timi' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* TIMI STEMI */}
            <div className="glass-card p-5 border border-red-500/20 space-y-4 rounded-2xl">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Heart className="w-4 h-4 text-red-400" /> TIMI Risk Score for STEMI
              </h3>
              <div className="space-y-2 text-xs text-gray-300">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={timiStemiAge >= 75}
                    onChange={e => setTimiStemiAge(e.target.checked ? 76 : 60)}
                  />
                  Age ≥ 75 (3 pts) or 65–74 (2 pts)
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={timiRiskFactors}
                    onChange={e => setTimiRiskFactors(e.target.checked)}
                  />
                  History of DM, HTN, or Angina (1 pt)
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={timiStemiSbp < 100}
                    onChange={e => setTimiStemiSbp(e.target.checked ? 90 : 120)}
                  />
                  Systolic BP &lt; 100 mmHg (3 pts)
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={timiStemiHr > 100}
                    onChange={e => setTimiStemiHr(e.target.checked ? 108 : 75)}
                  />
                  Heart Rate &gt; 100 bpm (2 pts)
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={timiStemiKillip !== 'I'}
                    onChange={e => setTimiStemiKillip(e.target.checked ? 'II' : 'I')}
                  />
                  Killip Class II–IV (2 pts)
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={timiStemiWeight < 67}
                    onChange={e => setTimiStemiWeight(e.target.checked ? 62 : 75)}
                  />
                  Weight &lt; 67 kg (1 pt)
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={timiAnteriorOrLbbb}
                    onChange={e => setTimiAnteriorOrLbbb(e.target.checked)}
                  />
                  Anterior STEMI or new LBBB (1 pt)
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={timiTreatmentDelay > 4}
                    onChange={e => setTimiTreatmentDelay(e.target.checked ? 5 : 2)}
                  />
                  Time to treatment &gt; 4 hours (1 pt)
                </label>
              </div>

              <div className="pt-3 border-t border-white/10 flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase text-gray-400">Score & 30-Day Mortality</p>
                  <p className="text-2xl font-bold text-white">{timiStemiResult.score} / 14</p>
                </div>
                <div className="text-right">
                  <span className="text-xl font-bold text-rose-400">{timiStemiResult.thirtyDayMortalityPct}%</span>
                  <p className="text-[10px] text-gray-400">{timiStemiResult.riskTier} Risk</p>
                </div>
              </div>
            </div>

            {/* TIMI UA / NSTEMI */}
            <div className="glass-card p-5 border border-orange-500/20 space-y-4 rounded-2xl">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-orange-400" /> TIMI Risk Score for UA / NSTEMI
              </h3>
              <div className="space-y-2 text-xs text-gray-300">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={timiNstemiAge65}
                    onChange={e => setTimiNstemiAge65(e.target.checked)}
                  />
                  Age ≥ 65 (1 pt)
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={timiNstemiRiskFactors}
                    onChange={e => setTimiNstemiRiskFactors(e.target.checked)}
                  />
                  ≥3 CAD risk factors (FHx, HTN, Lipids, DM, Smoker) (1 pt)
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={timiNstemiKnownCad}
                    onChange={e => setTimiNstemiKnownCad(e.target.checked)}
                  />
                  Prior coronary stenosis ≥ 50% (1 pt)
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={timiNstemiAspirin}
                    onChange={e => setTimiNstemiAspirin(e.target.checked)}
                  />
                  Aspirin use in past 7 days (1 pt)
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={timiNstemiSevereAngina}
                    onChange={e => setTimiNstemiSevereAngina(e.target.checked)}
                  />
                  ≥2 severe anginal episodes in last 24h (1 pt)
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={timiNstemiStDev}
                    onChange={e => setTimiNstemiStDev(e.target.checked)}
                  />
                  ST deviation ≥ 0.5 mm (1 pt)
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={timiNstemiEnzymes}
                    onChange={e => setTimiNstemiEnzymes(e.target.checked)}
                  />
                  Elevated cardiac troponin / CK-MB (1 pt)
                </label>
              </div>

              <div className="pt-3 border-t border-white/10 flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase text-gray-400">14-Day MACE Risk</p>
                  <p className="text-2xl font-bold text-white">{timiNstemiResult.score} / 7</p>
                </div>
                <div className="text-right">
                  <span className="text-xl font-bold text-amber-400">{timiNstemiResult.fourteenDayEventRatePct}%</span>
                  <p className="text-[10px] text-gray-400">{timiNstemiResult.strategy}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. CRUSADE Bleeding Score */}
      {activeCalc === 'crusade' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Droplets className="w-4 h-4 text-rose-400" /> CRUSADE In-Hospital Bleeding Score
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400">Baseline Hematocrit (%)</label>
                <input
                  type="number"
                  value={crusadeHct}
                  onChange={e => setCrusadeHct(Number(e.target.value))}
                  className="input-field w-full text-xs mt-1"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400">CrCl / eGFR (mL/min)</label>
                <input
                  type="number"
                  value={crusadeCrCl}
                  onChange={e => setCrusadeCrCl(Number(e.target.value))}
                  className="input-field w-full text-xs mt-1"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400">Heart Rate (bpm)</label>
                <input
                  type="number"
                  value={crusadeHr}
                  onChange={e => setCrusadeHr(Number(e.target.value))}
                  className="input-field w-full text-xs mt-1"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400">Systolic BP (mmHg)</label>
                <input
                  type="number"
                  value={crusadeSbp}
                  onChange={e => setCrusadeSbp(Number(e.target.value))}
                  className="input-field w-full text-xs mt-1"
                />
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <label className="flex items-center gap-2 text-xs text-gray-300">
                <input
                  type="checkbox"
                  checked={crusadeFemale}
                  onChange={e => setCrusadeFemale(e.target.checked)}
                />
                Female sex (+8 pts)
              </label>
              <label className="flex items-center gap-2 text-xs text-gray-300">
                <input
                  type="checkbox"
                  checked={crusadeChf}
                  onChange={e => setCrusadeChf(e.target.checked)}
                />
                Signs of heart failure at admission (+7 pts)
              </label>
              <label className="flex items-center gap-2 text-xs text-gray-300">
                <input
                  type="checkbox"
                  checked={crusadeVasc}
                  onChange={e => setCrusadeVasc(e.target.checked)}
                />
                Prior vascular disease (PAD / stroke) (+6 pts)
              </label>
              <label className="flex items-center gap-2 text-xs text-gray-300">
                <input
                  type="checkbox"
                  checked={crusadeDm}
                  onChange={e => setCrusadeDm(e.target.checked)}
                />
                Diabetes mellitus (+6 pts)
              </label>
            </div>
          </div>

          <div className="lg:col-span-5 space-y-4">
            <div className="glass-card p-5 border border-rose-500/20 bg-rose-950/20 space-y-4 rounded-2xl">
              <div>
                <p className="text-[10px] uppercase font-bold text-rose-300">CRUSADE Bleeding Score</p>
                <div className="flex items-baseline gap-3 mt-1">
                  <span className="text-4xl font-extrabold text-white">{crusadeResult.score}</span>
                  <span className={cn(
                    'px-2.5 py-0.5 rounded-full text-xs font-bold',
                    crusadeResult.riskTier === 'High' || crusadeResult.riskTier === 'Very High'
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  )}>
                    {crusadeResult.riskTier} Risk
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-white/10">
                <p className="text-[11px] text-gray-400">Predicted In-Hospital Major Bleeding</p>
                <p className="text-2xl font-bold text-rose-400 mt-1">{crusadeResult.inHospitalBleedingPct}%</p>
              </div>

              <div className="p-3 rounded-xl bg-slate-900/80 border border-white/10 text-xs text-gray-300 leading-relaxed">
                {crusadeResult.recommendation}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. ARC-HBR Consensus Criteria */}
      {activeCalc === 'archbr' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-400" /> ARC-HBR High Bleeding Risk Criteria
            </h3>
            
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-rose-500/5 border border-rose-500/20 space-y-2">
                <p className="text-xs font-bold text-rose-300">Major Criteria (≥1 qualifies for HBR)</p>
                <div className="space-y-1.5 text-xs text-gray-300">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={hbrOac} onChange={e => setHbrOac(e.target.checked)} />
                    Anticipated long-term oral anticoagulation
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={hbrSevereCkd} onChange={e => setHbrSevereCkd(e.target.checked)} />
                    Severe CKD (eGFR &lt; 30 mL/min)
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={hbrHbUnder11} onChange={e => setHbrHbUnder11(e.target.checked)} />
                    Baseline Hemoglobin &lt; 11 g/dL
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={hbrSpontBleed6m} onChange={e => setHbrSpontBleed6m(e.target.checked)} />
                    Spontaneous bleeding requiring transfusion/hosp in past 6 months
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={hbrPltUnder100} onChange={e => setHbrPltUnder100(e.target.checked)} />
                    Thrombocytopenia (platelets &lt; 100 × 10⁹/L)
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={hbrCirrhosis} onChange={e => setHbrCirrhosis(e.target.checked)} />
                    Liver cirrhosis with portal hypertension
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={hbrMalignancy} onChange={e => setHbrMalignancy(e.target.checked)} />
                    Active malignancy in past 12 months
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={hbrIch} onChange={e => setHbrIch(e.target.checked)} />
                    Prior spontaneous intracranial hemorrhage
                  </label>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-2">
                <p className="text-xs font-bold text-amber-300">Minor Criteria (≥2 qualifies for HBR)</p>
                <div className="space-y-1.5 text-xs text-gray-300">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={hbrAge75} onChange={e => setHbrAge75(e.target.checked)} />
                    Age ≥ 75 years
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={hbrModCkd} onChange={e => setHbrModCkd(e.target.checked)} />
                    Moderate CKD (eGFR 30–59 mL/min)
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={hbrMildAnemia} onChange={e => setHbrMildAnemia(e.target.checked)} />
                    Mild anemia (Hb 11–12.9 g/dL men, 11–11.9 g/dL women)
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={hbrBleed12m} onChange={e => setHbrBleed12m(e.target.checked)} />
                    Spontaneous bleeding in past 12m not meeting major
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={hbrNsaid} onChange={e => setHbrNsaid(e.target.checked)} />
                    Chronic oral NSAID or steroid therapy
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 space-y-4">
            <div className="glass-card p-5 border border-amber-500/20 bg-amber-950/20 space-y-4 rounded-2xl">
              <div>
                <p className="text-[10px] uppercase font-bold text-amber-300">ARC-HBR Consensus Status</p>
                <div className="mt-2">
                  <span className={cn(
                    'px-3 py-1 rounded-full text-xs font-extrabold uppercase',
                    archbrResult.isHighBleedingRisk ? 'bg-rose-500 text-white' : 'bg-emerald-500 text-slate-950'
                  )}>
                    {archbrResult.isHighBleedingRisk ? 'High Bleeding Risk (HBR)' : 'Non-HBR'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/10 text-xs text-gray-300">
                <div>
                  <p className="text-gray-400">Major Criteria</p>
                  <p className="text-xl font-bold text-white">{archbrResult.majorCount}</p>
                </div>
                <div>
                  <p className="text-gray-400">Minor Criteria</p>
                  <p className="text-xl font-bold text-white">{archbrResult.minorCount}</p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-900/80 border border-white/10 text-xs text-gray-300 leading-relaxed">
                {archbrResult.recommendation}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. PRECISE-DAPT */}
      {activeCalc === 'precisedapt' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-cyan-400" /> PRECISE-DAPT Duration Decision Score
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400">Age (years)</label>
                <input
                  type="number"
                  value={pdAge}
                  onChange={e => setPdAge(Number(e.target.value))}
                  className="input-field w-full text-xs mt-1"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400">CrCl (mL/min)</label>
                <input
                  type="number"
                  value={pdCrCl}
                  onChange={e => setPdCrCl(Number(e.target.value))}
                  className="input-field w-full text-xs mt-1"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400">Hemoglobin (g/dL)</label>
                <input
                  type="number"
                  step="0.1"
                  value={pdHb}
                  onChange={e => setPdHb(Number(e.target.value))}
                  className="input-field w-full text-xs mt-1"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400">WBC Count (× 10⁹/L)</label>
                <input
                  type="number"
                  step="0.1"
                  value={pdWbc}
                  onChange={e => setPdWbc(Number(e.target.value))}
                  className="input-field w-full text-xs mt-1"
                />
              </div>
            </div>

            <div className="pt-2">
              <label className="flex items-center gap-2 text-xs text-gray-300">
                <input
                  type="checkbox"
                  checked={pdPriorBleed}
                  onChange={e => setPdPriorBleed(e.target.checked)}
                />
                Prior spontaneous bleeding (+15 pts)
              </label>
            </div>
          </div>

          <div className="lg:col-span-5 space-y-4">
            <div className="glass-card p-5 border border-cyan-500/20 bg-cyan-950/20 space-y-4 rounded-2xl">
              <div>
                <p className="text-[10px] uppercase font-bold text-cyan-300">PRECISE-DAPT Score</p>
                <div className="flex items-baseline gap-3 mt-1">
                  <span className="text-4xl font-extrabold text-white">{preciseDaptResult.score}</span>
                  <span className={cn(
                    'px-2.5 py-0.5 rounded-full text-xs font-bold',
                    preciseDaptResult.isHighBleedingRisk
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  )}>
                    {preciseDaptResult.isHighBleedingRisk ? 'Score ≥ 25 (HBR)' : 'Score < 25 (Standard)'}
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-white/10">
                <p className="text-[11px] text-gray-400">Suggested DAPT Duration</p>
                <p className="text-lg font-bold text-cyan-300 mt-0.5">{preciseDaptResult.recommendedDaptDuration}</p>
              </div>

              <div className="p-3 rounded-xl bg-slate-900/80 border border-white/10 text-xs text-gray-300 leading-relaxed">
                {preciseDaptResult.recommendation}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. Mehran CIN (Corrected) */}
      {activeCalc === 'mehran' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Droplets className="w-4 h-4 text-cyan-400" /> Mehran Contrast-Induced Nephropathy (Corrected 2004)
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400">Age (years)</label>
                <input
                  type="number"
                  value={mehranAge}
                  onChange={e => setMehranAge(Number(e.target.value))}
                  className="input-field w-full text-xs mt-1"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400">Planned Contrast (mL)</label>
                <input
                  type="number"
                  value={mehranContrast}
                  onChange={e => setMehranContrast(Number(e.target.value))}
                  className="input-field w-full text-xs mt-1"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400">Creatinine (mg/dL)</label>
                <input
                  type="number"
                  step="0.1"
                  value={mehranCr}
                  onChange={e => setMehranCr(Number(e.target.value))}
                  className="input-field w-full text-xs mt-1"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400">eGFR (mL/min)</label>
                <input
                  type="number"
                  value={mehranEgfr}
                  onChange={e => setMehranEgfr(Number(e.target.value))}
                  className="input-field w-full text-xs mt-1"
                />
              </div>
            </div>

            <div className="space-y-2 pt-2 text-xs text-gray-300">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={mehranHypotension}
                  onChange={e => setMehranHypotension(e.target.checked)}
                />
                Peri-procedural Hypotension (SBP &lt;80 mmHg for ≥1h / inotropes) (+5 pts)
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={mehranIabp}
                  onChange={e => setMehranIabp(e.target.checked)}
                />
                Intra-Aortic Balloon Pump (IABP) (+5 pts)
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={mehranChf}
                  onChange={e => setMehranChf(e.target.checked)}
                />
                Congestive Heart Failure (NYHA III/IV or pulmonary edema history) (+5 pts)
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={mehranAnemia}
                  onChange={e => setMehranAnemia(e.target.checked)}
                />
                Baseline Anemia (Hct &lt;39% men, &lt;36% women) (+3 pts)
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={mehranDm}
                  onChange={e => setMehranDm(e.target.checked)}
                />
                Diabetes Mellitus (+3 pts)
              </label>
            </div>
          </div>

          <div className="lg:col-span-5 space-y-4">
            <div className="glass-card p-5 border border-cyan-500/20 bg-cyan-950/20 space-y-4 rounded-2xl">
              <div>
                <p className="text-[10px] uppercase font-bold text-cyan-300">Corrected Mehran Integer Score</p>
                <div className="flex items-baseline gap-3 mt-1">
                  <span className="text-4xl font-extrabold text-white">{mehranResult.mehranScore}</span>
                  <span className={cn(
                    'px-2.5 py-0.5 rounded-full text-xs font-bold',
                    mehranResult.riskCategory === 'High' || mehranResult.riskCategory === 'Very High'
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  )}>
                    {mehranResult.riskCategory} Risk
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/10 text-xs text-gray-300">
                <div>
                  <p className="text-gray-400">Post-Contrast AKI Risk</p>
                  <p className="text-2xl font-bold text-amber-400">{(mehranResult.akiRisk * 100).toFixed(1)}%</p>
                </div>
                <div>
                  <p className="text-gray-400">Dialysis Requirement</p>
                  <p className="text-2xl font-bold text-rose-400">{(mehranResult.dialysisRisk * 100).toFixed(2)}%</p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-900/80 border border-white/10 text-xs text-gray-300 leading-relaxed">
                <p className="font-semibold text-white mb-1">Max Safe Contrast Cap: {mehranResult.suggestedContrastCap} mL</p>
                <p>{mehranResult.recommendation}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 7. ACEF Score */}
      {activeCalc === 'acef' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" /> ACEF Score for PCI Mortality
            </h3>
            <p className="text-xs text-gray-400">
              Age / Ejection Fraction + 1 (if Creatinine &gt; 2.0 mg/dL). High discrimination for in-hospital and long-term PCI mortality.
            </p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-gray-400">Age (years)</label>
                <input
                  type="number"
                  value={acefAge}
                  onChange={e => setAcefAge(Number(e.target.value))}
                  className="input-field w-full text-xs mt-1"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400">LVEF (%)</label>
                <input
                  type="number"
                  value={acefLvef}
                  onChange={e => setAcefLvef(Number(e.target.value))}
                  className="input-field w-full text-xs mt-1"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400">Creatinine (mg/dL)</label>
                <input
                  type="number"
                  step="0.1"
                  value={acefCr}
                  onChange={e => setAcefCr(Number(e.target.value))}
                  className="input-field w-full text-xs mt-1"
                />
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 space-y-4">
            <div className="glass-card p-5 border border-emerald-500/20 bg-emerald-950/20 space-y-4 rounded-2xl">
              <div>
                <p className="text-[10px] uppercase font-bold text-emerald-300">ACEF Score</p>
                <div className="flex items-baseline gap-3 mt-1">
                  <span className="text-4xl font-extrabold text-white">{acefResult.acefScore}</span>
                  <span className={cn(
                    'px-2.5 py-0.5 rounded-full text-xs font-bold',
                    acefResult.riskTier === 'High' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' :
                    acefResult.riskTier === 'Intermediate' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                    'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  )}>
                    {acefResult.riskTier} Risk
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-white/10">
                <p className="text-[11px] text-gray-400">Predicted In-Hospital Mortality</p>
                <p className="text-2xl font-bold text-emerald-400 mt-1">{acefResult.predictedInHospitalMortalityPct}%</p>
              </div>

              <div className="p-3 rounded-xl bg-slate-900/80 border border-white/10 text-xs text-gray-300 leading-relaxed">
                {acefResult.recommendation}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
