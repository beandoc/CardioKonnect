'use client'
import { useState, useEffect } from 'react'
import {
  X, Check, AlertCircle, Save, Sparkles, Activity, Calculator,
  Heart, Droplet, User, ShieldCheck
} from 'lucide-react'
import { calculateCKDEPI_eGFR, calculateBMI, calculateHemodynamics } from '@/lib/clinicalCalculations'
import { updateVisit, updatePatient, addVisit } from '@/lib/firestore'
import type { Patient, Visit, VisitInput } from '@/lib/types'
import { getAge } from '@/lib/utils'
import { toast } from 'sonner'
import Button from '@/components/ui/Button'

interface QuickDataEntryModalProps {
  isOpen: boolean
  onClose: () => void
  patient: Patient
  latestVisit: Visit | null
  onSaved: () => void
  defaultFocusField?: string
}

export default function QuickDataEntryModal({
  isOpen,
  onClose,
  patient,
  latestVisit,
  onSaved,
  defaultFocusField,
}: QuickDataEntryModalProps) {
  const age = getAge(patient.dob) || patient.age || 60
  const sex = patient.sex || 'Male'

  // Form states initialized with latest visit or patient values
  const [creatinine, setCreatinine] = useState<string>(
    latestVisit?.creatinine != null ? String(latestVisit.creatinine) : ''
  )
  const [crUnit, setCrUnit] = useState<'mg/dL' | 'umol/L'>('mg/dL')
  const [autoCalculatedEgfr, setAutoCalculatedEgfr] = useState<number | null>(
    latestVisit?.egfr ?? null
  )
  const [egfrStageInfo, setEgfrStageInfo] = useState<any>(null)

  const [lvef, setLvef] = useState<string>(
    latestVisit?.lvef != null ? String(latestVisit.lvef) : (patient.lvef != null ? String(patient.lvef) : '')
  )
  const [hfType, setHfType] = useState<string>(
    latestVisit?.hfType || patient.hfType || 'HFrEF'
  )
  const [nyha, setNyha] = useState<string>(
    latestVisit?.nyha || patient.nyha || 'II'
  )
  const [bpSystolic, setBpSystolic] = useState<string>(
    latestVisit?.bpSystolic != null ? String(latestVisit.bpSystolic) : ''
  )
  const [bpDiastolic, setBpDiastolic] = useState<string>(
    latestVisit?.bpDiastolic != null ? String(latestVisit.bpDiastolic) : ''
  )
  const [heartRate, setHeartRate] = useState<string>(
    latestVisit?.heartRate != null ? String(latestVisit.heartRate) : ''
  )
  const [weight, setWeight] = useState<string>(
    latestVisit?.weight != null ? String(latestVisit.weight) : ''
  )
  const [height, setHeight] = useState<string>(
    latestVisit?.height != null ? String(latestVisit.height) : ''
  )
  const [potassium, setPotassium] = useState<string>(
    latestVisit?.potassium != null ? String(latestVisit.potassium) : ''
  )
  const [sodium, setSodium] = useState<string>(
    latestVisit?.sodium != null ? String(latestVisit.sodium) : ''
  )
  const [ntProBNP, setNtProBNP] = useState<string>(
    latestVisit?.ntProBNP != null ? String(latestVisit.ntProBNP) : ''
  )
  const [hb, setHb] = useState<string>(
    latestVisit?.hb != null ? String(latestVisit.hb) : ''
  )
  const [rhythm, setRhythm] = useState<string>(
    latestVisit?.rhythm || 'Sinus Rhythm'
  )
  const [etiology, setEtiology] = useState<string>(
    (latestVisit?.etiology && latestVisit.etiology.length > 0)
      ? latestVisit.etiology.join(', ')
      : (patient.indexEtiology?.join(', ') || 'Ischemic')
  )
  const [tft, setTft] = useState<string>(
    latestVisit?.tft != null ? String(latestVisit.tft) : ''
  )
  const [hba1c, setHba1c] = useState<string>(
    latestVisit?.hba1c != null ? String(latestVisit.hba1c) : ''
  )
  const [followupDate, setFollowupDate] = useState<string>(
    latestVisit?.followupDate || ''
  )
  const [sixMWT, setSixMWT] = useState<string>(
    latestVisit?.sixMWT != null ? String(latestVisit.sixMWT) : ''
  )

  // Discrete comorbidity flags
  const rawList = Array.isArray(patient.comorbidities) ? patient.comorbidities : []
  const rawUpper = rawList.map(s => String(s).toUpperCase())

  const [dm, setDm] = useState<boolean>(Boolean(patient.comorbidDiabetes ?? (rawUpper.some(s => s.includes('DM') || s.includes('DIABETES')))))
  const [cad, setCad] = useState<boolean>(Boolean(patient.comorbidCAD ?? (rawUpper.some(s => s.includes('CAD') || s.includes('CORONARY') || s.includes('ISCHEMIC')))))
  const [priorMI, setPriorMI] = useState<boolean>(Boolean(patient.comorbidPriorMI ?? (rawUpper.some(s => s.includes('MI') || s.includes('INFARCT')))))
  const [priorPCI, setPriorPCI] = useState<boolean>(Boolean(patient.comorbidPriorPCI ?? (rawUpper.some(s => s.includes('PCI') || s.includes('STENT')))))
  const [priorCABG, setPriorCABG] = useState<boolean>(Boolean(patient.comorbidPriorCABG ?? (rawUpper.some(s => s.includes('CABG') || s.includes('BYPASS')))))
  const [htn, setHtn] = useState<boolean>(Boolean(patient.comorbidHypertension ?? (rawUpper.some(s => s.includes('HTN') || s.includes('HYPERTENSION')))))
  const [dyslipidemia, setDyslipidemia] = useState<boolean>(Boolean(patient.comorbidDyslipidemia ?? (rawUpper.some(s => s.includes('LIPID') || s.includes('DYSLIPIDEMIA')))))
  const [ckd, setCkd] = useState<boolean>(Boolean(patient.comorbidCKD ?? (rawUpper.some(s => s.includes('CKD') || s.includes('KIDNEY') || s.includes('RENAL')))))
  const [af, setAf] = useState<boolean>(Boolean(patient.comorbidAF ?? (rawUpper.some(s => s.includes('AF') || s.includes('ATRIAL FIBRILLATION')))))
  const [copd, setCopd] = useState<boolean>(Boolean(patient.comorbidCOPD ?? (rawUpper.some(s => s.includes('COPD') || s.includes('ASTHMA')))))

  const [saving, setSaving] = useState(false)

  // Real-time eGFR CKD-EPI 2021 calculation whenever creatinine or unit changes
  useEffect(() => {
    const numCr = parseFloat(creatinine)
    if (!isNaN(numCr) && numCr > 0) {
      const res = calculateCKDEPI_eGFR({
        age,
        sex,
        creatinine: numCr,
        unit: crUnit,
      })
      if (res) {
        setAutoCalculatedEgfr(res.egfr)
        setEgfrStageInfo(res)
      } else {
        setAutoCalculatedEgfr(null)
        setEgfrStageInfo(null)
      }
    } else {
      setAutoCalculatedEgfr(latestVisit?.egfr ?? null)
      setEgfrStageInfo(null)
    }
  }, [creatinine, crUnit, age, sex, latestVisit])

  // Real-time LVEF HF Type auto-classification
  useEffect(() => {
    const numLvef = parseFloat(lvef)
    if (!isNaN(numLvef)) {
      if (numLvef < 40) setHfType('HFrEF')
      else if (numLvef < 50) setHfType('HFmrEF')
      else setHfType('HFpEF')
    }
  }, [lvef])

  // Real-time BMI calculation
  const bmiResult = calculateBMI(parseFloat(weight), parseFloat(height))
  // Real-time MAP
  const hemoResult = calculateHemodynamics(parseFloat(bpSystolic), parseFloat(bpDiastolic))

  if (!isOpen) return null

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const toastId = toast.loading('Saving clinical data...')

    try {
      const numLvef = lvef ? parseFloat(lvef) : undefined
      const numBpSys = bpSystolic ? parseInt(bpSystolic, 10) : undefined
      const numBpDia = bpDiastolic ? parseInt(bpDiastolic, 10) : undefined
      const numHr = heartRate ? parseInt(heartRate, 10) : undefined
      const numWt = weight ? parseFloat(weight) : undefined
      const numHt = height ? parseFloat(height) : undefined
      const numBmi = bmiResult ? bmiResult.bmi : (latestVisit?.bmi ?? undefined)
      const numK = potassium ? parseFloat(potassium) : undefined
      const numNa = sodium ? parseFloat(sodium) : undefined
      const numNtBnp = ntProBNP ? parseFloat(ntProBNP) : undefined
      const numHb = hb ? parseFloat(hb) : undefined
      const num6mwt = sixMWT ? parseInt(sixMWT, 10) : undefined
      const numCr = creatinine ? parseFloat(creatinine) : undefined
      const computedEgfr = autoCalculatedEgfr ?? latestVisit?.egfr ?? undefined

      const numTft = tft ? parseFloat(tft) : undefined
      const numHba1c = hba1c ? parseFloat(hba1c) : undefined
      const etiologyArr = etiology ? etiology.split(',').map(s => s.trim()).filter(Boolean) : []

      // 1. If visit exists, update it
      if (latestVisit?.id) {
        await updateVisit(patient.id, latestVisit.id, {
          lvef: numLvef,
          hfType: hfType as any,
          nyha: nyha as any,
          rhythm: rhythm as any,
          etiology: etiologyArr,
          bpSystolic: numBpSys,
          bpDiastolic: numBpDia,
          heartRate: numHr,
          weight: numWt,
          height: numHt,
          bmi: numBmi,
          potassium: numK,
          sodium: numNa,
          ntProBNP: numNtBnp,
          hb: numHb,
          hba1c: numHba1c,
          tft: numTft,
          sixMWT: num6mwt,
          creatinine: numCr,
          egfr: computedEgfr,
          followupDate: followupDate || undefined,
        })
      } else {
        // Create baseline visit if none exists
        const today = new Date().toISOString().split('T')[0]
        await addVisit(patient.id, {
          patientId: patient.id,
          visitDate: today,
          visitType: 'OPD',
          lvef: numLvef,
          hfType: hfType as any,
          nyha: nyha as any,
          rhythm: rhythm as any,
          etiology: etiologyArr,
          bpSystolic: numBpSys,
          bpDiastolic: numBpDia,
          heartRate: numHr,
          weight: numWt,
          height: numHt,
          bmi: numBmi,
          potassium: numK,
          sodium: numNa,
          ntProBNP: numNtBnp,
          hb: numHb,
          hba1c: numHba1c,
          tft: numTft,
          sixMWT: num6mwt,
          creatinine: numCr,
          egfr: computedEgfr,
          followupDate: followupDate || undefined,
          raasi: { prescribed: 'Yes' },
          betaBlocker: { prescribed: 'Yes' },
          mra: { prescribed: 'No' },
          sglt2i: { prescribed: 'Yes' },
        } as unknown as VisitInput)
      }

      // 2. Update patient profile cached values and discrete comorbidity flags
      const updatedComorbiditiesList: string[] = []
      if (htn) updatedComorbiditiesList.push('HTN')
      if (dm) updatedComorbiditiesList.push('DM2')
      if (cad) updatedComorbiditiesList.push('CAD')
      if (priorMI) updatedComorbiditiesList.push('Prior MI')
      if (priorPCI) updatedComorbiditiesList.push('Prior PCI')
      if (priorCABG) updatedComorbiditiesList.push('Prior CABG')
      if (dyslipidemia) updatedComorbiditiesList.push('Dyslipidemia')
      if (ckd) updatedComorbiditiesList.push('CKD')
      if (af) updatedComorbiditiesList.push('AF')
      if (copd) updatedComorbiditiesList.push('COPD')

      await updatePatient(patient.id, {
        lvef: numLvef,
        hfType: hfType as any,
        nyha: nyha as any,
        indexEtiology: etiologyArr,
        comorbidDiabetes: dm,
        comorbidCAD: cad,
        comorbidPriorMI: priorMI,
        comorbidPriorPCI: priorPCI,
        comorbidPriorCABG: priorCABG,
        comorbidHypertension: htn,
        comorbidDyslipidemia: dyslipidemia,
        comorbidCKD: ckd,
        comorbidAF: af,
        comorbidCOPD: copd,
        comorbidities: updatedComorbiditiesList,
      })

      toast.success('Clinical data and calculations saved successfully!', { id: toastId })
      onSaved()
      onClose()
    } catch (err) {
      console.error('Save error:', err)
      toast.error('Failed to save data. Please check your connection.', { id: toastId })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="glass-card max-w-2xl w-full border border-blue-500/30 shadow-2xl p-6 relative my-8 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-blue-500/15 pb-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                Quick Data Entry & Clinical Engine
              </h3>
              <p className="text-xs text-gray-400">
                Patient: <span className="text-blue-300 font-semibold">{patient.firstName} {patient.lastName}</span> ({age} yrs, {sex})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          {/* SECTION 1: Renal Function & CKD-EPI Formula */}
          <div className="p-4 rounded-xl bg-blue-950/30 border border-blue-500/25 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Droplet className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-cyan-300">
                  Renal Function & eGFR (CKD-EPI 2021)
                </span>
              </div>
              <div className="flex items-center gap-1 text-[10px] bg-blue-900/40 p-0.5 rounded-lg border border-blue-500/20">
                <button
                  type="button"
                  onClick={() => setCrUnit('mg/dL')}
                  className={`px-2 py-0.5 rounded ${crUnit === 'mg/dL' ? 'bg-blue-600 text-white font-bold' : 'text-gray-400'}`}
                >
                  mg/dL
                </button>
                <button
                  type="button"
                  onClick={() => setCrUnit('umol/L')}
                  className={`px-2 py-0.5 rounded ${crUnit === 'umol/L' ? 'bg-blue-600 text-white font-bold' : 'text-gray-400'}`}
                >
                  µmol/L
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-gray-300 mb-1 block">
                  Serum Creatinine ({crUnit})
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.1"
                  max="20"
                  value={creatinine}
                  onChange={e => setCreatinine(e.target.value)}
                  placeholder="e.g. 1.10"
                  className="w-full px-3 py-2 text-sm rounded-lg bg-slate-900/80 border border-blue-500/30 text-white focus:outline-none focus:border-blue-400 font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-300 mb-1 block">
                  eGFR (Calculated via 2021 CKD-EPI)
                </label>
                <div className="w-full px-3 py-2 text-sm rounded-lg bg-slate-900/90 border border-blue-500/20 text-white flex items-center justify-between">
                  <span className="font-mono font-bold text-base" style={{ color: egfrStageInfo?.color || '#38bdf8' }}>
                    {autoCalculatedEgfr != null ? `${autoCalculatedEgfr} mL/min/1.73m²` : 'Enter Creatinine'}
                  </span>
                  {egfrStageInfo && (
                    <span className="badge text-[10px] font-extrabold" style={{ backgroundColor: `${egfrStageInfo.color}20`, color: egfrStageInfo.color, borderColor: `${egfrStageInfo.color}40` }}>
                      {egfrStageInfo.stage}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {egfrStageInfo && (
              <div className="p-2.5 rounded-lg bg-slate-900/60 border border-blue-500/10 text-xs space-y-1">
                <p className="font-semibold text-white flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ background: egfrStageInfo.color }} />
                  {egfrStageInfo.stageDescription}
                </p>
                <p className="text-[11px] text-gray-400">{egfrStageInfo.recommendation}</p>
              </div>
            )}
          </div>

          {/* SECTION 2: Echo & Phenotype */}
          <div className="p-4 rounded-xl bg-slate-900/40 border border-blue-500/15 space-y-3">
            <div className="flex items-center gap-2">
              <Heart className="w-4 h-4 text-rose-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-rose-300">
                Echocardiography & HF Phenotype
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-300 mb-1 block">LVEF (%)</label>
                <input
                  type="number"
                  min="5"
                  max="85"
                  value={lvef}
                  onChange={e => setLvef(e.target.value)}
                  placeholder="e.g. 35"
                  className="w-full px-3 py-2 text-sm rounded-lg bg-slate-900 border border-blue-500/20 text-white focus:outline-none focus:border-blue-400 font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-300 mb-1 block">HF Phenotype</label>
                <select
                  value={hfType}
                  onChange={e => setHfType(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg bg-slate-900 border border-blue-500/20 text-white focus:outline-none focus:border-blue-400"
                >
                  <option value="HFrEF">HFrEF (LVEF ≤40%)</option>
                  <option value="HFmrEF">HFmrEF (LVEF 41-49%)</option>
                  <option value="HFpEF">HFpEF (LVEF ≥50%)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-300 mb-1 block">NYHA Class</label>
                <select
                  value={nyha}
                  onChange={e => setNyha(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg bg-slate-900 border border-blue-500/20 text-white focus:outline-none focus:border-blue-400"
                >
                  <option value="I">Class I (No limitation)</option>
                  <option value="II">Class II (Mild)</option>
                  <option value="III">Class III (Marked)</option>
                  <option value="IV">Class IV (Severe/At rest)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="text-xs font-semibold text-gray-300 mb-1 block">ECG / Cardiac Rhythm</label>
                <input
                  type="text"
                  value={rhythm}
                  onChange={e => setRhythm(e.target.value)}
                  placeholder="e.g. Sinus Rhythm, Atrial Fibrillation"
                  className="w-full px-3 py-2 text-sm rounded-lg bg-slate-900 border border-blue-500/20 text-white focus:outline-none focus:border-blue-400"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-300 mb-1 block">Etiology of Heart Failure</label>
                <input
                  type="text"
                  value={etiology}
                  onChange={e => setEtiology(e.target.value)}
                  placeholder="e.g. Ischemic, Hypertensive, Dilated CMP"
                  className="w-full px-3 py-2 text-sm rounded-lg bg-slate-900 border border-blue-500/20 text-white focus:outline-none focus:border-blue-400"
                />
              </div>
            </div>
          </div>

          {/* SECTION 3: Vitals & Hemodynamics */}
          <div className="p-4 rounded-xl bg-slate-900/40 border border-blue-500/15 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                  Vitals & Hemodynamics
                </span>
              </div>
              {hemoResult && (
                <span className="text-[11px] text-emerald-400 font-semibold">
                  MAP: {hemoResult.map} mmHg · PP: {hemoResult.pulsePressure} mmHg
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">BP Systolic</label>
                <input
                  type="number"
                  placeholder="120"
                  value={bpSystolic}
                  onChange={e => setBpSystolic(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-slate-900 border border-blue-500/20 text-white font-mono"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">BP Diastolic</label>
                <input
                  type="number"
                  placeholder="80"
                  value={bpDiastolic}
                  onChange={e => setBpDiastolic(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-slate-900 border border-blue-500/20 text-white font-mono"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Heart Rate (bpm)</label>
                <input
                  type="number"
                  placeholder="72"
                  value={heartRate}
                  onChange={e => setHeartRate(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-slate-900 border border-blue-500/20 text-white font-mono"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">6MWT (meters)</label>
                <input
                  type="number"
                  placeholder="350"
                  value={sixMWT}
                  onChange={e => setSixMWT(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-slate-900 border border-blue-500/20 text-white font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Weight (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="65"
                  value={weight}
                  onChange={e => setWeight(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-slate-900 border border-blue-500/20 text-white font-mono"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Height (cm)</label>
                <input
                  type="number"
                  step="0.5"
                  placeholder="165"
                  value={height}
                  onChange={e => setHeight(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-slate-900 border border-blue-500/20 text-white font-mono"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Computed BMI</label>
                <div className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-slate-900 border border-blue-500/20 text-white flex items-center justify-between">
                  <span className="font-bold">{bmiResult?.bmi ? `${bmiResult.bmi} kg/m²` : '—'}</span>
                  {bmiResult && (
                    <span className="text-[10px]" style={{ color: bmiResult.color }}>{bmiResult.category}</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 4: Biomarkers & Electrolytes */}
          <div className="p-4 rounded-xl bg-slate-900/40 border border-blue-500/15 space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-violet-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-violet-300">
                Key Biomarkers & Electrolytes
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Potassium (mmol/L)</label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="4.2"
                  value={potassium}
                  onChange={e => setPotassium(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-slate-900 border border-blue-500/20 text-white font-mono"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Sodium (mmol/L)</label>
                <input
                  type="number"
                  step="1"
                  placeholder="138"
                  value={sodium}
                  onChange={e => setSodium(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-slate-900 border border-blue-500/20 text-white font-mono"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">NT-proBNP (pg/mL)</label>
                <input
                  type="number"
                  placeholder="514"
                  value={ntProBNP}
                  onChange={e => setNtProBNP(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-slate-900 border border-blue-500/20 text-white font-mono"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Hemoglobin (g/dL)</label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="10.7"
                  value={hb}
                  onChange={e => setHb(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-slate-900 border border-blue-500/20 text-white font-mono"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">TSH (mIU/L)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="2.5"
                  value={tft}
                  onChange={e => setTft(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-slate-900 border border-blue-500/20 text-white font-mono"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">HbA1c (%)</label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="6.3"
                  value={hba1c}
                  onChange={e => setHba1c(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-slate-900 border border-blue-500/20 text-white font-mono"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-blue-500/10">
              <label className="text-xs font-semibold text-gray-300 mb-1 block">Scheduled Next Follow-up Date</label>
              <input
                type="date"
                value={followupDate}
                onChange={e => setFollowupDate(e.target.value)}
                className="w-full sm:w-1/2 px-3 py-1.5 text-xs rounded-lg bg-slate-900 border border-blue-500/20 text-white font-mono focus:outline-none focus:border-blue-400"
              />
            </div>
          </div>

          {/* SECTION 5: Comorbidities */}
          <div className="p-4 rounded-xl bg-slate-900/40 border border-blue-500/15 space-y-3">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-rose-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-rose-300">
                Comorbidities &amp; Clinical Variables
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {[
                { label: 'Type 2 Diabetes', checked: dm, set: setDm, color: '#f59e0b' },
                { label: 'Coronary Artery Dis. (CAD)', checked: cad, set: setCad, color: '#ef4444' },
                { label: 'Prior Myocardial Infarct', checked: priorMI, set: setPriorMI, color: '#f43f5e' },
                { label: 'Prior PCI', checked: priorPCI, set: setPriorPCI, color: '#fb7185' },
                { label: 'Prior CABG', checked: priorCABG, set: setPriorCABG, color: '#e11d48' },
                { label: 'Hypertension', checked: htn, set: setHtn, color: '#3b82f6' },
                { label: 'Dyslipidemia', checked: dyslipidemia, set: setDyslipidemia, color: '#a855f7' },
                { label: 'Chronic Kidney Disease', checked: ckd, set: setCkd, color: '#06b6d4' },
                { label: 'Atrial Fibrillation', checked: af, set: setAf, color: '#8b5cf6' },
                { label: 'COPD / Asthma', checked: copd, set: setCopd, color: '#10b981' },
              ].map(item => (
                <label
                  key={item.label}
                  className={`p-2 rounded-lg border text-xs flex items-center gap-2 cursor-pointer transition-colors ${
                    item.checked
                      ? 'bg-blue-950/40 border-blue-500/40 text-white font-semibold'
                      : 'bg-slate-950/40 border-gray-800/60 text-gray-400 hover:text-gray-200'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={item.checked}
                    onChange={e => item.set(e.target.checked)}
                    className="w-3.5 h-3.5 rounded text-blue-600 bg-gray-900 border-gray-700 cursor-pointer"
                  />
                  <span className="truncate">{item.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Footer actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-blue-500/15">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-gray-400 hover:text-white rounded-lg transition-colors"
            >
              Cancel
            </button>
            <Button type="submit" disabled={saving} className="btn-primary">
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save & Recalculate'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
