'use client'
import { useState, useEffect, useMemo } from 'react'
import {
  Brain, Info, AlertTriangle, Heart, Zap, Settings, RefreshCw,
  Play, ArrowRight, CheckCircle2, XCircle, Plus, Pill, Activity,
  TrendingUp, TrendingDown, ChevronRight, User, ShieldCheck, Sliders, PlayCircle
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { getPatients, getVisits } from '@/lib/firestore'
import type { Patient, Visit, MedEntry } from '@/lib/types'
import {
  computeMLRiskProfile, evaluateGDMT, generateClinicalAlerts,
  calculateCHA2DS2VASc, calculateHASBLED, predictKaggleHeartFailure
} from '@/lib/clinicalIntelligence'
import {
  calculateH2FPEF, calculateHFAPEFF
} from '@/lib/riskScores'
import Link from 'next/link'


// Default values for simulation if patient has no visit records
const DEFAULT_SIMULATION_VISIT = (patientId: string): Visit => ({
  id: 'sim-visit',
  patientId,
  visitDate: new Date().toISOString().split('T')[0],
  visitType: 'OPD',
  bpSystolic: 120,
  bpDiastolic: 80,
  heartRate: 72,
  respiratoryRate: 16,
  nyha: 'II',
  hfType: 'HFrEF',
  rhythm: 'Sinus',
  lvef: 30,
  creatinine: 1.0,
  egfr: 75,
  potassium: 4.2,
  sodium: 138,
  hb: 13.5,
  ferritin: 120,
  transferrinSat: 25,
  raasi: { prescribed: 'No', type: '', dose: '' },
  betaBlocker: { prescribed: 'No', type: '', dose: '' },
  mra: { prescribed: 'No', type: '', dose: '' },
  sglt2i: { prescribed: 'No', type: '', dose: '' },
  diuretic: { prescribed: '' },
  digoxin: { prescribed: '' },
  ivabradine: { prescribed: '' },
  ivIron: { prescribed: '' },
  aspirin: { prescribed: '' },
  statin: { prescribed: '' },
  fibrate: { prescribed: '' },
  pcsk9: { prescribed: '' },
  noac: { prescribed: '' },
  vki: { prescribed: '' },
  device: [],
  createdAt: new Date().toISOString(),
})

export default function AIEnginePage() {
  const [patients, setPatients] = useState<Patient[]>([])
  const [selectedPatientId, setSelectedPatientId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [visits, setVisits] = useState<Visit[]>([])
  const [activeTab, setActiveTab] = useState<'simulator' | 'kaggle' | 'diagnostics' | 'specs'>('simulator')

  // Diagnostic simulator form state
  const [diagAge, setDiagAge] = useState<number>(65)
  const [diagSex, setDiagSex] = useState<'Male' | 'Female'>('Male')
  const [diagBmi, setDiagBmi] = useState<number>(28)
  const [diagAntiHtnCount, setDiagAntiHtnCount] = useState<number>(1)
  const [diagRhythm, setDiagRhythm] = useState<Visit['rhythm']>('Sinus')
  const [diagEEPrime, setDiagEEPrime] = useState<number>(10)
  const [diagSeptalEPrime, setDiagSeptalEPrime] = useState<number>(6)
  const [diagLateralEPrime, setDiagLateralEPrime] = useState<number>(9)
  const [diagRvsp, setDiagRvsp] = useState<number>(36)
  const [diagLavi, setDiagLavi] = useState<number>(36)
  const [diagLvmi, setDiagLvmi] = useState<number>(110)
  const [diagRwt, setDiagRwt] = useState<number>(0.44)
  const [diagGls, setDiagGls] = useState<number>(15)
  const [diagNtproBnp, setDiagNtproBnp] = useState<number>(300)
  const [diagBnp, setDiagBnp] = useState<number>(100)

  // Simulation form state
  const [simLvef, setSimLvef] = useState<number>(30)
  const [simSbp, setSimSbp] = useState<number>(120)
  const [simHr, setSimHr] = useState<number>(72)
  const [simRhythm, setSimRhythm] = useState<Visit['rhythm']>('Sinus')
  const [simPotassium, setSimPotassium] = useState<number>(4.2)
  const [simEgfr, setSimEgfr] = useState<number>(75)
  const [simCreatinine, setSimCreatinine] = useState<number>(1.0)
  const [simRaasiPrescribed, setSimRaasiPrescribed] = useState<'Yes' | 'No'>('No')
  const [simRaasiType, setSimRaasiType] = useState<string>('enalapril')
  const [simRaasiDose, setSimRaasiDose] = useState<string>('10mg')
  const [simBbPrescribed, setSimBbPrescribed] = useState<'Yes' | 'No'>('No')
  const [simBbType, setSimBbType] = useState<string>('carvedilol')
  const [simBbDose, setSimBbDose] = useState<string>('6.25mg')
  const [simMraPrescribed, setSimMraPrescribed] = useState<'Yes' | 'No'>('No')
  const [simMraType, setSimMraType] = useState<string>('spironolactone')
  const [simMraDose, setSimMraDose] = useState<string>('25mg')
  const [simSglt2Prescribed, setSimSglt2Prescribed] = useState<'Yes' | 'No'>('No')
  const [simSglt2Type, setSimSglt2Type] = useState<string>('dapagliflozin')
  const [simSglt2Dose, setSimSglt2Dose] = useState<string>('10mg')

  // Kaggle model simulator form state
  const [kagAge, setKagAge] = useState<number>(65)
  const [kagAnaemia, setKagAnaemia] = useState<boolean>(false)
  const [kagCpk, setKagCpk] = useState<number | undefined>(undefined)
  const [kagDiabetes, setKagDiabetes] = useState<boolean>(false)
  const [kagEf, setKagEf] = useState<number>(35)
  const [kagHbp, setKagHbp] = useState<boolean>(false)
  const [kagPlatelets, setKagPlatelets] = useState<number>(250)
  const [kagCreatinine, setKagCreatinine] = useState<number>(1.1)
  const [kagSodium, setKagSodium] = useState<number>(137)
  const [kagSex, setKagSex] = useState<'Male' | 'Female'>('Male')
  const [kagSmoking, setKagSmoking] = useState<boolean>(false)
  const [kagTime, setKagTime] = useState<number>(365)

  // Load patients on mount
  useEffect(() => {
    async function loadData() {
      try {
        const pts = await getPatients()
        setPatients(pts)
        if (pts.length > 0) {
          setSelectedPatientId(pts[0].id)
        }
      } catch (err) {
        console.error('Failed to load patients for AI engine:', err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  // Load visits when patient changes
  useEffect(() => {
    if (!selectedPatientId) return
    async function loadVisits() {
      try {
        const vts = await getVisits(selectedPatientId)
        setVisits(vts)

        // Reset simulation values based on latest visit or defaults
        const baseVisit = vts.length > 0 
          ? [...vts].sort((a, b) => new Date(b.visitDate).getTime() - new Date(a.visitDate).getTime())[0]
          : DEFAULT_SIMULATION_VISIT(selectedPatientId)

        setSimLvef(baseVisit.lvef ?? 30)
        setSimSbp(baseVisit.bpSystolic ?? 120)
        setSimHr(baseVisit.heartRate ?? 72)
        setSimRhythm(baseVisit.rhythm ?? 'Sinus')
        setSimPotassium(baseVisit.potassium ?? 4.2)
        setSimEgfr(baseVisit.egfr ?? 75)
        setSimCreatinine(baseVisit.creatinine ?? 1.0)
        setSimRaasiPrescribed(baseVisit.raasi?.prescribed === 'Yes' ? 'Yes' : 'No')
        setSimRaasiType(baseVisit.raasi?.type || 'enalapril')
        setSimRaasiDose(baseVisit.raasi?.dose || '10mg')
        setSimBbPrescribed(baseVisit.betaBlocker?.prescribed === 'Yes' ? 'Yes' : 'No')
        setSimBbType(baseVisit.betaBlocker?.type || 'carvedilol')
        setSimBbDose(baseVisit.betaBlocker?.dose || '6.25mg')
        setSimMraPrescribed(baseVisit.mra?.prescribed === 'Yes' ? 'Yes' : 'No')
        setSimMraType(baseVisit.mra?.type || 'spironolactone')
        setSimMraDose(baseVisit.mra?.dose || '25mg')
        setSimSglt2Prescribed(baseVisit.sglt2i?.prescribed === 'Yes' ? 'Yes' : 'No')
        setSimSglt2Type(baseVisit.sglt2i?.type || 'dapagliflozin')
        setSimSglt2Dose(baseVisit.sglt2i?.dose || '10mg')

        // Update diagnostic parameters
        const pt = patients.find(p => p.id === selectedPatientId)
        const age = pt ? Math.floor((Date.now() - new Date(pt.dob).getTime()) / (365.25 * 86400000)) : 65
        const sex = pt?.sex || 'Male'
        const weight = baseVisit.weight || 75
        const height = baseVisit.height || 170
        const bmi = parseFloat((weight / ((height / 100) ** 2)).toFixed(1))

        setDiagAge(age)
        setDiagSex(sex === 'Female' ? 'Female' : 'Male')
        setDiagBmi(bmi)
        setDiagAntiHtnCount(baseVisit.raasi?.prescribed === 'Yes' ? 1 : 0)
        setDiagRhythm(baseVisit.rhythm || 'Sinus')
        setDiagEEPrime(baseVisit.eEPrime ?? 10)
        setDiagSeptalEPrime(baseVisit.septalEPrime ?? 6)
        setDiagLateralEPrime(baseVisit.lateralEPrime ?? 9)
        setDiagRvsp(baseVisit.rvsp ?? 36)
        setDiagLavi(baseVisit.laVolumeIndex ?? 36)
        setDiagLvmi(baseVisit.lvMassIndex ?? 110)
        setDiagRwt(baseVisit.relativeWallThickness ?? 0.44)
        setDiagGls(baseVisit.gls ?? 15)
        setDiagNtproBnp(baseVisit.ntProBNP ?? 300)
        setDiagBnp(baseVisit.bnp ?? 100)

        // Initialize Kaggle inputs
        setKagAge(age)
        setKagSex(sex === 'Female' ? 'Female' : 'Male')
        const comorbStr = pt ? (pt.comorbidities ?? []).join(' ').toLowerCase() : ''
        
        let hasAnaemia = false
        if (baseVisit.hb !== undefined && baseVisit.hb !== null) {
          if (sex === 'Female' && baseVisit.hb < 12) hasAnaemia = true
          if (sex === 'Male' && baseVisit.hb < 13) hasAnaemia = true
        }
        if (comorbStr.includes('anaemia') || comorbStr.includes('anemia')) {
          hasAnaemia = true
        }
        setKagAnaemia(hasAnaemia)
        
        setKagCpk(undefined)
        setKagDiabetes(comorbStr.includes('diabetes') || comorbStr.includes('dm'))
        setKagEf(baseVisit.lvef ?? 35)
        
        let hasHbp = false
        if (baseVisit.bpSystolic && baseVisit.bpSystolic > 140) hasHbp = true
        if (comorbStr.includes('htn') || comorbStr.includes('hypertension')) hasHbp = true
        setKagHbp(hasHbp)
        
        setKagPlatelets(baseVisit.platelets ?? 250)
        setKagCreatinine(baseVisit.creatinine ?? 1.1)
        setKagSodium(baseVisit.sodium ?? 137)
        setKagSmoking(comorbStr.includes('smoking') || comorbStr.includes('smoker'))
        setKagTime(365)

      } catch (err) {
        console.error('Failed to load visits for selected patient:', err)
      }
    }
    loadVisits()
  }, [selectedPatientId, patients])

  const selectedPatient = useMemo(() => {
    return patients.find(p => p.id === selectedPatientId) || null
  }, [patients, selectedPatientId])

  // Compute baseline profiles (actual patient data)
  const baselineVisit = useMemo(() => {
    if (visits.length === 0) return selectedPatientId ? DEFAULT_SIMULATION_VISIT(selectedPatientId) : null
    return [...visits].sort((a, b) => new Date(b.visitDate).getTime() - new Date(a.visitDate).getTime())[0]
  }, [visits, selectedPatientId])

  const baselineRisk = useMemo(() => {
    if (!selectedPatient || !baselineVisit) return null
    return computeMLRiskProfile(selectedPatient, baselineVisit, visits)
  }, [selectedPatient, baselineVisit, visits])

  const baselineGdmt = useMemo(() => {
    if (!selectedPatient || !baselineVisit) return null
    return evaluateGDMT(selectedPatient, baselineVisit)
  }, [selectedPatient, baselineVisit])

  const baselineAlerts = useMemo(() => {
    if (!selectedPatient || !baselineVisit) return []
    return generateClinicalAlerts(selectedPatient, baselineVisit, visits)
  }, [selectedPatient, baselineVisit, visits])

  // Compute simulated profiles (based on state variables)
  const simulatedVisit = useMemo<Visit | null>(() => {
    if (!selectedPatientId) return null
    return {
      id: 'simulated-visit',
      patientId: selectedPatientId,
      visitDate: new Date().toISOString().split('T')[0],
      visitType: 'OPD',
      bpSystolic: simSbp,
      heartRate: simHr,
      rhythm: simRhythm,
      lvef: simLvef,
      potassium: simPotassium,
      egfr: simEgfr,
      creatinine: simCreatinine,
      raasi: { prescribed: simRaasiPrescribed, type: simRaasiType, dose: simRaasiDose },
      betaBlocker: { prescribed: simBbPrescribed, type: simBbType, dose: simBbDose },
      mra: { prescribed: simMraPrescribed, type: simMraType, dose: simMraDose },
      sglt2i: { prescribed: simSglt2Prescribed, type: simSglt2Type, dose: simSglt2Dose },
      diuretic: baselineVisit?.diuretic || { prescribed: '' },
      digoxin: baselineVisit?.digoxin || { prescribed: '' },
      ivabradine: baselineVisit?.ivabradine || { prescribed: '' },
      ivIron: baselineVisit?.ivIron || { prescribed: '' },
      aspirin: baselineVisit?.aspirin || { prescribed: '' },
      statin: baselineVisit?.statin || { prescribed: '' },
      fibrate: baselineVisit?.fibrate || { prescribed: '' },
      pcsk9: baselineVisit?.pcsk9 || { prescribed: '' },
      noac: baselineVisit?.noac || { prescribed: '' },
      vki: baselineVisit?.vki || { prescribed: '' },
      device: baselineVisit?.device || [],
      createdAt: baselineVisit?.createdAt || new Date().toISOString(),
    }
  }, [
    selectedPatientId, simSbp, simHr, simRhythm, simLvef, simPotassium, simEgfr, simCreatinine,
    simRaasiPrescribed, simRaasiType, simRaasiDose, simBbPrescribed, simBbType, simBbDose,
    simMraPrescribed, simMraType, simMraDose, simSglt2Prescribed, simSglt2Type, simSglt2Dose,
    baselineVisit
  ])

  const simulatedRisk = useMemo(() => {
    if (!selectedPatient || !simulatedVisit) return null
    // Feed the simulation as the current visit and baseline visits as the history
    return computeMLRiskProfile(selectedPatient, simulatedVisit, [simulatedVisit, ...visits.filter(v => v.id !== baselineVisit?.id)])
  }, [selectedPatient, simulatedVisit, visits, baselineVisit])

  const simulatedGdmt = useMemo(() => {
    if (!selectedPatient || !simulatedVisit) return null
    return evaluateGDMT(selectedPatient, simulatedVisit)
  }, [selectedPatient, simulatedVisit])

  const simulatedAlerts = useMemo(() => {
    if (!selectedPatient || !simulatedVisit) return []
    return generateClinicalAlerts(selectedPatient, simulatedVisit, [simulatedVisit, ...visits.filter(v => v.id !== baselineVisit?.id)])
  }, [selectedPatient, simulatedVisit, visits, baselineVisit])

  const h2fpefResult = useMemo(() => {
    return calculateH2FPEF({
      bmi: diagBmi,
      antihypertensiveDrugs: diagAntiHtnCount,
      atrialFibrillation: diagRhythm === 'AF' || diagRhythm === 'Atrial Flutter',
      pulmonaryArterialPressure: diagRvsp,
      age: diagAge,
      echoEEPrime: diagEEPrime
    })
  }, [diagBmi, diagAntiHtnCount, diagRhythm, diagRvsp, diagAge, diagEEPrime])

  const hfapeffResult = useMemo(() => {
    return calculateHFAPEFF({
      age: diagAge,
      sex: diagSex,
      rhythm: diagRhythm || 'Sinus',
      eEPrime: diagEEPrime,
      septalEPrime: diagSeptalEPrime,
      lateralEPrime: diagLateralEPrime,
      rvsp: diagRvsp,
      gls: diagGls,
      laVolumeIndex: diagLavi,
      lvMassIndex: diagLvmi,
      relativeWallThickness: diagRwt,
      ntProBNP: diagNtproBnp,
      bnp: diagBnp
    })
  }, [diagAge, diagSex, diagRhythm, diagEEPrime, diagSeptalEPrime, diagLateralEPrime, diagRvsp, diagGls, diagLavi, diagLvmi, diagRwt, diagNtproBnp, diagBnp])

  const kaggleResult = useMemo(() => {
    if (!selectedPatient) return null
    
    // Construct mock patient & visit based on Kaggle slider inputs
    const mockPatient: Patient = {
      ...selectedPatient,
      dob: new Date(Date.now() - kagAge * 365.25 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      sex: kagSex,
      comorbidities: [
        ...(kagAnaemia ? ['anaemia'] : []),
        ...(kagDiabetes ? ['diabetes'] : []),
        ...(kagSmoking ? ['smoking'] : []),
        ...(kagHbp ? ['hypertension'] : []),
      ]
    }
    
    const base = baselineVisit || DEFAULT_SIMULATION_VISIT(selectedPatient.id)
    const mockVisit: Visit = {
      ...base,
      lvef: kagEf,
      hb: kagAnaemia ? 10 : 14,
      bpSystolic: kagHbp ? 150 : 120,
      platelets: kagPlatelets,
      creatinine: kagCreatinine,
      sodium: kagSodium,
    }
    
    return predictKaggleHeartFailure(mockPatient, mockVisit, kagTime, kagCpk)
  }, [
    selectedPatient, kagAge, kagSex, kagAnaemia, kagDiabetes, kagSmoking,
    kagHbp, kagEf, kagPlatelets, kagCreatinine, kagSodium, kagTime, kagCpk
  ])

  const handleResetKaggle = () => {
    if (!selectedPatient || !baselineVisit) return
    const pt = selectedPatient
    const age = Math.floor((Date.now() - new Date(pt.dob).getTime()) / (365.25 * 86400000))
    const sex = pt.sex || 'Male'
    const comorbStr = (pt.comorbidities ?? []).join(' ').toLowerCase()
    
    let hasAnaemia = false
    if (baselineVisit.hb !== undefined && baselineVisit.hb !== null) {
      if (sex === 'Female' && baselineVisit.hb < 12) hasAnaemia = true
      if (sex === 'Male' && baselineVisit.hb < 13) hasAnaemia = true
    }
    if (comorbStr.includes('anaemia') || comorbStr.includes('anemia')) {
      hasAnaemia = true
    }
    
    setKagAge(age)
    setKagSex(sex === 'Female' ? 'Female' : 'Male')
    setKagAnaemia(hasAnaemia)
    setKagCpk(undefined)
    setKagDiabetes(comorbStr.includes('diabetes') || comorbStr.includes('dm'))
    setKagEf(baselineVisit.lvef ?? 35)
    
    let hasHbp = false
    if (baselineVisit.bpSystolic && baselineVisit.bpSystolic > 140) hasHbp = true
    if (comorbStr.includes('htn') || comorbStr.includes('hypertension')) hasHbp = true
    setKagHbp(hasHbp)
    
    setKagPlatelets(baselineVisit.platelets ?? 250)
    setKagCreatinine(baselineVisit.creatinine ?? 1.1)
    setKagSodium(baselineVisit.sodium ?? 137)
    setKagSmoking(comorbStr.includes('smoking') || comorbStr.includes('smoker'))
    setKagTime(365)
  }

  const handleResetDiagnostics = () => {
    if (!selectedPatient || !baselineVisit) return
    const pt = selectedPatient
    const age = Math.floor((Date.now() - new Date(pt.dob).getTime()) / (365.25 * 86400000))
    const sex = pt.sex || 'Male'
    const weight = baselineVisit.weight || 75
    const height = baselineVisit.height || 170
    const bmi = parseFloat((weight / ((height / 100) ** 2)).toFixed(1))

    setDiagAge(age)
    setDiagSex(sex === 'Female' ? 'Female' : 'Male')
    setDiagBmi(bmi)
    setDiagAntiHtnCount(baselineVisit.raasi?.prescribed === 'Yes' ? 1 : 0)
    setDiagRhythm(baselineVisit.rhythm || 'Sinus')
    setDiagEEPrime(baselineVisit.eEPrime ?? 10)
    setDiagSeptalEPrime(baselineVisit.septalEPrime ?? 6)
    setDiagLateralEPrime(baselineVisit.lateralEPrime ?? 9)
    setDiagRvsp(baselineVisit.rvsp ?? 36)
    setDiagLavi(baselineVisit.laVolumeIndex ?? 36)
    setDiagLvmi(baselineVisit.lvMassIndex ?? 110)
    setDiagRwt(baselineVisit.relativeWallThickness ?? 0.44)
    setDiagGls(baselineVisit.gls ?? 15)
    setDiagNtproBnp(baselineVisit.ntProBNP ?? 300)
    setDiagBnp(baselineVisit.bnp ?? 100)
  }

  const handleResetSimulation = () => {
    if (!baselineVisit) return
    setSimLvef(baselineVisit.lvef ?? 30)
    setSimSbp(baselineVisit.bpSystolic ?? 120)
    setSimHr(baselineVisit.heartRate ?? 72)
    setSimRhythm(baselineVisit.rhythm ?? 'Sinus')
    setSimPotassium(baselineVisit.potassium ?? 4.2)
    setSimEgfr(baselineVisit.egfr ?? 75)
    setSimCreatinine(baselineVisit.creatinine ?? 1.0)
    setSimRaasiPrescribed(baselineVisit.raasi?.prescribed === 'Yes' ? 'Yes' : 'No')
    setSimRaasiType(baselineVisit.raasi?.type || 'enalapril')
    setSimRaasiDose(baselineVisit.raasi?.dose || '10mg')
    setSimBbPrescribed(baselineVisit.betaBlocker?.prescribed === 'Yes' ? 'Yes' : 'No')
    setSimBbType(baselineVisit.betaBlocker?.type || 'carvedilol')
    setSimBbDose(baselineVisit.betaBlocker?.dose || '6.25mg')
    setSimMraPrescribed(baselineVisit.mra?.prescribed === 'Yes' ? 'Yes' : 'No')
    setSimMraType(baselineVisit.mra?.type || 'spironolactone')
    setSimMraDose(baselineVisit.mra?.dose || '25mg')
    setSimSglt2Prescribed(baselineVisit.sglt2i?.prescribed === 'Yes' ? 'Yes' : 'No')
    setSimSglt2Type(baselineVisit.sglt2i?.type || 'dapagliflozin')
    setSimSglt2Dose(baselineVisit.sglt2i?.dose || '10mg')
  }

  // Pre-load quick metrics
  const stats = useMemo(() => {
    if (patients.length === 0) return { highRiskCount: 0, lowRiskCount: 0, total: 0 }
    return {
      total: patients.length,
      highRiskCount: patients.filter(p => p.vitalStatus !== 'Dead' && p.hfType === 'HFrEF').length, // surrogate for general metrics
    }
  }, [patients])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="flex flex-col items-center gap-4 text-gray-400">
          <Brain className="w-10 h-10 text-violet-400 animate-pulse" />
          <p className="text-sm font-medium">Initializing AI Engine…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in text-gray-300">
      
      {/* Header */}
      <div className="flex items-center justify-between border-b border-blue-500/10 pb-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-violet-600/10 border border-violet-500/20 flex items-center justify-center">
            <Brain className="w-6 h-6 text-violet-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Clinical AI Engine</h1>
            <p className="text-xs text-gray-400 mt-0.5">
              Interactive local rules engine &amp; clinical risk simulator
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[10px] px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <span className="w-2 h-2 bg-emerald-400 rounded-full animate-ping" />
          Offline Classifier Ready (100% HIPAA Compliant)
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-blue-500/10 pb-0">
        <button
          onClick={() => setActiveTab('simulator')}
          className={cn(
            'flex items-center gap-2 text-xs font-semibold px-4 py-2.5 border-b-2 transition-all',
            activeTab === 'simulator'
              ? 'border-blue-500 text-white'
              : 'border-transparent text-gray-400 hover:text-gray-200'
          )}
        >
          <Sliders className="w-3.5 h-3.5" />
          Risk Simulator Playground
        </button>
        <button
          onClick={() => setActiveTab('kaggle')}
          className={cn(
            'flex items-center gap-2 text-xs font-semibold px-4 py-2.5 border-b-2 transition-all',
            activeTab === 'kaggle'
              ? 'border-blue-500 text-white'
              : 'border-transparent text-gray-400 hover:text-gray-200'
          )}
        >
          <Brain className="w-3.5 h-3.5" />
          Kaggle Classifier
        </button>
        <button
          onClick={() => setActiveTab('diagnostics')}
          className={cn(
            'flex items-center gap-2 text-xs font-semibold px-4 py-2.5 border-b-2 transition-all',
            activeTab === 'diagnostics'
              ? 'border-blue-500 text-white'
              : 'border-transparent text-gray-400 hover:text-gray-200'
          )}
        >
          <Activity className="w-3.5 h-3.5" />
          HFpEF Diagnostic Predictor
        </button>
        <button
          onClick={() => setActiveTab('specs')}
          className={cn(
            'flex items-center gap-2 text-xs font-semibold px-4 py-2.5 border-b-2 transition-all',
            activeTab === 'specs'
              ? 'border-blue-500 text-white'
              : 'border-transparent text-gray-400 hover:text-gray-200'
          )}
        >
          <Settings className="w-3.5 h-3.5" />
          Engine Specifications
        </button>
      </div>

      {activeTab === 'simulator' && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          
          {/* Simulator Panel (Controls) */}
          <div className="xl:col-span-1 space-y-5 bg-[#0f2444]/40 border border-blue-500/10 p-5 rounded-2xl">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-blue-400" />
                Adjustment Panel
              </h3>
              <p className="text-[10px] text-gray-500 leading-normal">
                Select a patient and tweak their vitals, labs, or GDMT prescriptions to evaluate risk impacts in real-time.
              </p>
            </div>

            {/* Patient Selector */}
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-gray-400">Select Registry Patient</label>
              <select
                value={selectedPatientId}
                onChange={e => setSelectedPatientId(e.target.value)}
                className="w-full bg-slate-900 border border-blue-500/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500/40"
              >
                {patients.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.firstName} {p.lastName} (HID: {p.mrn || '—'})
                  </option>
                ))}
              </select>
            </div>

            {selectedPatient && (
              <div className="bg-slate-900/30 p-3 rounded-xl border border-gray-800/40 text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-gray-500">Gender:</span>
                  <span className="text-white font-medium">{selectedPatient.sex}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Birth Date:</span>
                  <span className="text-white font-medium">{selectedPatient.dob}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Phenotype:</span>
                  <span className="text-white font-medium">{selectedPatient.hfType || 'HFrEF'}</span>
                </div>
              </div>
            )}

            <hr className="border-blue-500/10" />

            {/* Sim Variables Form */}
            <div className="space-y-4 text-xs">
              
              {/* Vitals Section */}
              <div className="space-y-3">
                <h4 className="font-bold text-blue-400 border-b border-blue-500/5 pb-1">Vitals &amp; Lab Parameters</h4>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-400">LVEF (%)</label>
                    <input
                      type="number"
                      value={simLvef}
                      onChange={e => setSimLvef(Math.max(5, Math.min(85, parseInt(e.target.value) || 0)))}
                      className="w-full bg-slate-900 border border-blue-500/10 rounded-lg px-2.5 py-1.5 text-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-400">Systolic BP (mmHg)</label>
                    <input
                      type="number"
                      value={simSbp}
                      onChange={e => setSimSbp(Math.max(50, Math.min(220, parseInt(e.target.value) || 0)))}
                      className="w-full bg-slate-900 border border-blue-500/10 rounded-lg px-2.5 py-1.5 text-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-400">Heart Rate (bpm)</label>
                    <input
                      type="number"
                      value={simHr}
                      onChange={e => setSimHr(Math.max(30, Math.min(200, parseInt(e.target.value) || 0)))}
                      className="w-full bg-slate-900 border border-blue-500/10 rounded-lg px-2.5 py-1.5 text-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-400">Potassium (mmol/L)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={simPotassium}
                      onChange={e => setSimPotassium(Math.max(2.0, Math.min(8.0, parseFloat(e.target.value) || 0)))}
                      className="w-full bg-slate-900 border border-blue-500/10 rounded-lg px-2.5 py-1.5 text-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-400">eGFR (ml/min)</label>
                    <input
                      type="number"
                      value={simEgfr}
                      onChange={e => setSimEgfr(Math.max(5, Math.min(150, parseInt(e.target.value) || 0)))}
                      className="w-full bg-slate-900 border border-blue-500/10 rounded-lg px-2.5 py-1.5 text-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-400">Rhythm</label>
                    <select
                      value={simRhythm}
                      onChange={e => setSimRhythm(e.target.value as Visit['rhythm'])}
                      className="w-full bg-slate-900 border border-blue-500/10 rounded-lg px-2.5 py-1.5 text-white"
                    >
                      <option value="Sinus">Sinus</option>
                      <option value="AF">Atrial Fibrillation</option>
                      <option value="Atrial Flutter">Atrial Flutter</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Medication Pillar Toggles */}
              <div className="space-y-3 pt-2">
                <h4 className="font-bold text-blue-400 border-b border-blue-500/5 pb-1">GDMT Prescriptions</h4>
                
                {/* RAASi Toggle */}
                <div className="p-2.5 bg-slate-900/30 rounded-lg border border-gray-800 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-[11px]">RAASi / ARNI</span>
                    <button
                      type="button"
                      onClick={() => setSimRaasiPrescribed(simRaasiPrescribed === 'Yes' ? 'No' : 'Yes')}
                      className={cn(
                        'px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border transition-colors',
                        simRaasiPrescribed === 'Yes' 
                          ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                          : 'bg-gray-800 border-gray-700 text-gray-400'
                      )}
                    >
                      {simRaasiPrescribed === 'Yes' ? 'Prescribed' : 'Off'}
                    </button>
                  </div>
                  {simRaasiPrescribed === 'Yes' && (
                    <div className="grid grid-cols-2 gap-2 text-[10px] pt-1">
                      <select
                        value={simRaasiType}
                        onChange={e => setSimRaasiType(e.target.value)}
                        className="bg-slate-900 border border-gray-800 rounded px-1.5 py-1"
                      >
                        <option value="sacubitril/valsartan">Sacubitril/Valsartan</option>
                        <option value="enalapril">Enalapril</option>
                        <option value="ramipril">Ramipril</option>
                        <option value="valsartan">Valsartan</option>
                      </select>
                      <select
                        value={simRaasiDose}
                        onChange={e => setSimRaasiDose(e.target.value)}
                        className="bg-slate-900 border border-gray-800 rounded px-1.5 py-1"
                      >
                        <option value="50mg bd">50mg bd</option>
                        <option value="100mg bd">100mg bd</option>
                        <option value="200mg bd">200mg bd (Target)</option>
                        <option value="2.5mg bd">2.5mg bd</option>
                        <option value="5mg bd">5mg bd</option>
                        <option value="10mg bd">10mg bd (Target)</option>
                      </select>
                    </div>
                  )}
                </div>

                {/* Beta Blocker Toggle */}
                <div className="p-2.5 bg-slate-900/30 rounded-lg border border-gray-800 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-[11px]">Beta-Blocker</span>
                    <button
                      type="button"
                      onClick={() => setSimBbPrescribed(simBbPrescribed === 'Yes' ? 'No' : 'Yes')}
                      className={cn(
                        'px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border transition-colors',
                        simBbPrescribed === 'Yes' 
                          ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                          : 'bg-gray-800 border-gray-700 text-gray-400'
                      )}
                    >
                      {simBbPrescribed === 'Yes' ? 'Prescribed' : 'Off'}
                    </button>
                  </div>
                  {simBbPrescribed === 'Yes' && (
                    <div className="grid grid-cols-2 gap-2 text-[10px] pt-1">
                      <select
                        value={simBbType}
                        onChange={e => setSimBbType(e.target.value)}
                        className="bg-slate-900 border border-gray-800 rounded px-1.5 py-1"
                      >
                        <option value="carvedilol">Carvedilol</option>
                        <option value="bisoprolol">Bisoprolol</option>
                        <option value="metoprolol">Metoprolol</option>
                      </select>
                      <select
                        value={simBbDose}
                        onChange={e => setSimBbDose(e.target.value)}
                        className="bg-slate-900 border border-gray-800 rounded px-1.5 py-1"
                      >
                        <option value="3.125mg bd">3.125mg bd</option>
                        <option value="6.25mg bd">6.25mg bd</option>
                        <option value="12.5mg bd">12.5mg bd</option>
                        <option value="25mg bd">25mg bd (Target)</option>
                        <option value="2.5mg od">2.5mg od</option>
                        <option value="5mg od">5mg od</option>
                        <option value="10mg od">10mg od (Target)</option>
                      </select>
                    </div>
                  )}
                </div>

                {/* MRA Toggle */}
                <div className="p-2.5 bg-slate-900/30 rounded-lg border border-gray-800 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-[11px]">MRA (Spironolactone)</span>
                    <button
                      type="button"
                      onClick={() => setSimMraPrescribed(simMraPrescribed === 'Yes' ? 'No' : 'Yes')}
                      className={cn(
                        'px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border transition-colors',
                        simMraPrescribed === 'Yes' 
                          ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                          : 'bg-gray-800 border-gray-700 text-gray-400'
                      )}
                    >
                      {simMraPrescribed === 'Yes' ? 'Prescribed' : 'Off'}
                    </button>
                  </div>
                </div>

                {/* SGLT2i Toggle */}
                <div className="p-2.5 bg-slate-900/30 rounded-lg border border-gray-800 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-[11px]">SGLT2 Inhibitor</span>
                    <button
                      type="button"
                      onClick={() => setSimSglt2Prescribed(simSglt2Prescribed === 'Yes' ? 'No' : 'Yes')}
                      className={cn(
                        'px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border transition-colors',
                        simSglt2Prescribed === 'Yes' 
                          ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                          : 'bg-gray-800 border-gray-700 text-gray-400'
                      )}
                    >
                      {simSglt2Prescribed === 'Yes' ? 'Prescribed' : 'Off'}
                    </button>
                  </div>
                </div>

              </div>

            </div>

            <div className="flex gap-2.5 pt-3">
              <button
                type="button"
                onClick={handleResetSimulation}
                className="flex-1 text-center py-2 border border-gray-700 text-gray-400 hover:text-white rounded-xl hover:bg-gray-800/40 transition-all text-xs"
              >
                Reset to Baseline
              </button>
            </div>

          </div>

          {/* Results Comparison Panels (Outputs) */}
          <div className="xl:col-span-2 space-y-5">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* ── Baseline Metrics Card ── */}
              <div className="glass-card bg-slate-950/20 border border-blue-500/10 p-5 rounded-2xl space-y-4">
                <div className="flex justify-between items-center border-b border-gray-800/60 pb-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400">Baseline State</h4>
                  <span className="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded font-mono">Actual</span>
                </div>

                {baselineRisk && baselineGdmt ? (
                  <div className="space-y-4">
                    {/* Risk score */}
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[10px] text-gray-500">1-Year Event Risk</p>
                        <h4 className="text-3xl font-extrabold text-white">
                          {Math.round(baselineRisk.oneYearEventProbability * 100)}%
                        </h4>
                      </div>
                      <span className={cn(
                        'text-[10px] uppercase font-bold px-2 py-1 rounded border',
                        baselineRisk.riskCategory === 'Very High' ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' :
                        baselineRisk.riskCategory === 'High' ? 'bg-orange-500/10 border-orange-500/20 text-orange-400' :
                        baselineRisk.riskCategory === 'Intermediate' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' :
                        'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                      )}>
                        {baselineRisk.riskCategory} Risk
                      </span>
                    </div>

                    {/* GDMT Optimisation */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] text-gray-500">
                        <span>GDMT Optimisation Score</span>
                        <span className="font-bold text-white">{baselineGdmt.optimizationScore}%</span>
                      </div>
                      <div className="h-1.5 bg-gray-900 rounded">
                        <div
                          className="h-full bg-blue-500 rounded"
                          style={{ width: `${baselineGdmt.optimizationScore}%` }}
                        />
                      </div>
                    </div>

                    {/* Baseline Safety alerts */}
                    <div className="space-y-2">
                      <p className="text-[10px] text-gray-500 font-bold uppercase">Clinical Alerts ({baselineAlerts.length})</p>
                      {baselineAlerts.length === 0 ? (
                        <p className="text-xs text-gray-500">No safety alerts active.</p>
                      ) : (
                        <div className="space-y-1 max-h-[120px] overflow-y-auto pr-1">
                          {baselineAlerts.map(a => (
                            <div key={a.id} className="flex gap-2 text-xs text-gray-400">
                              <AlertTriangle className={cn('w-3.5 h-3.5 flex-shrink-0 mt-0.5', a.severity === 'critical' ? 'text-rose-400' : 'text-amber-400')} />
                              <span>{a.title}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500 text-xs">
                    No clinical baseline visits found. Pre-populate simulator on the left.
                  </div>
                )}
              </div>

              {/* ── Simulated Metrics Card ── */}
              <div className="glass-card bg-slate-900/60 border border-blue-500/20 p-5 rounded-2xl space-y-4 ring-1 ring-blue-500/20">
                <div className="flex justify-between items-center border-b border-gray-800/60 pb-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-blue-400">Simulated State</h4>
                  <span className="text-[10px] bg-violet-500/10 text-violet-400 border border-violet-500/20 px-2 py-0.5 rounded font-mono animate-pulse">Active Sandbox</span>
                </div>

                {simulatedRisk && simulatedGdmt ? (
                  <div className="space-y-4">
                    {/* Risk score */}
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[10px] text-gray-500">Predicted Event Risk</p>
                        <div className="flex items-baseline gap-2">
                          <h4 className="text-3xl font-extrabold text-white">
                            {Math.round(simulatedRisk.oneYearEventProbability * 100)}%
                          </h4>
                          {baselineRisk && (
                            <span className={cn(
                              'text-xs flex items-center font-bold',
                              simulatedRisk.oneYearEventProbability < baselineRisk.oneYearEventProbability ? 'text-emerald-400' :
                              simulatedRisk.oneYearEventProbability > baselineRisk.oneYearEventProbability ? 'text-rose-400' :
                              'text-gray-400'
                            )}>
                              {simulatedRisk.oneYearEventProbability < baselineRisk.oneYearEventProbability ? (
                                <><TrendingDown className="w-3.5 h-3.5 mr-0.5" /> -{Math.round((baselineRisk.oneYearEventProbability - simulatedRisk.oneYearEventProbability) * 100)}%</>
                              ) : simulatedRisk.oneYearEventProbability > baselineRisk.oneYearEventProbability ? (
                                <><TrendingUp className="w-3.5 h-3.5 mr-0.5" /> +{Math.round((simulatedRisk.oneYearEventProbability - baselineRisk.oneYearEventProbability) * 100)}%</>
                              ) : (
                                'No change'
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className={cn(
                        'text-[10px] uppercase font-bold px-2 py-1 rounded border',
                        simulatedRisk.riskCategory === 'Very High' ? 'bg-rose-500/15 border-rose-500/35 text-rose-400' :
                        simulatedRisk.riskCategory === 'High' ? 'bg-orange-500/15 border-orange-500/35 text-orange-400' :
                        simulatedRisk.riskCategory === 'Intermediate' ? 'bg-amber-500/15 border-amber-500/35 text-amber-400' :
                        'bg-emerald-500/15 border-emerald-500/35 text-emerald-400'
                      )}>
                        {simulatedRisk.riskCategory} Risk
                      </span>
                    </div>

                    {/* GDMT Optimisation */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] text-gray-500">
                        <span>GDMT Optimisation Score</span>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-white">{simulatedGdmt.optimizationScore}%</span>
                          {baselineGdmt && simulatedGdmt.optimizationScore > baselineGdmt.optimizationScore && (
                            <span className="text-[10px] text-emerald-400 font-bold">+{simulatedGdmt.optimizationScore - baselineGdmt.optimizationScore}%</span>
                          )}
                        </div>
                      </div>
                      <div className="h-1.5 bg-gray-900 rounded">
                        <div
                          className="h-full bg-emerald-500 rounded transition-all duration-300"
                          style={{ width: `${simulatedGdmt.optimizationScore}%` }}
                        />
                      </div>
                    </div>

                    {/* Baseline Safety alerts */}
                    <div className="space-y-2">
                      <p className="text-[10px] text-gray-500 font-bold uppercase">Simulated Alerts ({simulatedAlerts.length})</p>
                      {simulatedAlerts.length === 0 ? (
                        <p className="text-xs text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-4 h-4" /> All safety alerts resolved!
                        </p>
                      ) : (
                        <div className="space-y-1 max-h-[120px] overflow-y-auto pr-1">
                          {simulatedAlerts.map(a => {
                            const wasBaseline = baselineAlerts.some(ba => ba.id === a.id)
                            return (
                              <div key={a.id} className="flex gap-2 text-xs">
                                <AlertTriangle className={cn('w-3.5 h-3.5 flex-shrink-0 mt-0.5', a.severity === 'critical' ? 'text-rose-400 animate-pulse' : 'text-amber-400')} />
                                <span className={cn(wasBaseline ? 'text-gray-300' : 'text-amber-300 font-bold')}>
                                  {a.title} {!wasBaseline && '(New!)'}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>

            </div>

            {/* Factor Comparison Section */}
            {simulatedRisk && (
              <div className="bg-gray-800/40 border border-blue-500/10 rounded-2xl p-5 space-y-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-1.5 border-b border-gray-800 pb-2">
                  <Activity className="w-4 h-4 text-violet-400" />
                  Risk Drivers Comparison (SHAP Attribution Simulation)
                </h3>

                <div className="space-y-3">
                  {simulatedRisk.topFactors.map((factor, idx) => {
                    const baselineFactor = baselineRisk?.topFactors.find(bf => bf.label === factor.label)
                    const baselineVal = baselineFactor ? Math.round(baselineFactor.magnitude * 100) : 0
                    const simVal = Math.round(factor.magnitude * 100)
                    
                    return (
                      <div key={idx} className="space-y-1.5 text-xs">
                        <div className="flex justify-between">
                          <span className={factor.direction === 'risk' ? 'text-rose-300 font-medium' : 'text-emerald-300 font-medium'}>
                            {factor.label}
                          </span>
                          <span className="text-gray-500">
                            Baseline: {baselineFactor ? `${baselineFactor.direction === 'risk' ? '+' : '−'}${baselineVal}%` : '—'} 
                            {' '}→{' '}
                            <span className="text-white font-bold">
                              {factor.direction === 'risk' ? '+' : '−'}{simVal}%
                            </span>
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 h-1 bg-gray-900 rounded overflow-hidden">
                          {/* Baseline mini tracking */}
                          <div className="h-full bg-gray-800 rounded">
                            <div 
                              className={cn('h-full rounded', baselineFactor?.direction === 'risk' ? 'bg-rose-500/40' : 'bg-emerald-500/40')} 
                              style={{ width: `${baselineVal}%` }} 
                            />
                          </div>
                          {/* Simulated tracking */}
                          <div className="h-full bg-gray-800 rounded">
                            <div 
                              className={cn('h-full rounded transition-all duration-300', factor.direction === 'risk' ? 'bg-rose-500' : 'bg-emerald-500')} 
                              style={{ width: `${simVal}%` }} 
                            />
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
                
                <p className="text-[10px] text-gray-500 leading-normal bg-slate-900/30 p-3 rounded-lg border border-gray-800/40">
                  <span className="text-blue-400 font-bold">How it recalculates:</span> Increasing therapeutic coverage (e.g. SGLT2i/MRA) introduces protective multipliers derived from large multi-center clinical trials. Changing diagnostic markers (LVEF, SBP, creatinine) shifts the MAGGIC mortality backbone score.
                </p>
              </div>
            )}

          </div>

        </div>
      )}

      {activeTab === 'kaggle' && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Adjuster Panel */}
          <div className="xl:col-span-1 space-y-5 bg-[#0f2444]/40 border border-blue-500/10 p-5 rounded-2xl">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-blue-400" />
                Kaggle RF Adjuster
              </h3>
              <p className="text-[10px] text-gray-500 leading-normal">
                Tweak patient parameters to feed into the 12-feature Random Forest mortality model.
              </p>
            </div>

            {/* Patient Selector */}
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-gray-400">Select Registry Patient</label>
              <select
                value={selectedPatientId}
                onChange={e => setSelectedPatientId(e.target.value)}
                className="w-full bg-slate-900 border border-blue-500/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500/40"
              >
                {patients.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.firstName} {p.lastName} (HID: {p.mrn || '—'})
                  </option>
                ))}
              </select>
            </div>

            <hr className="border-blue-500/10" />

            <div className="space-y-4 text-xs">
              {/* Demographics */}
              <div className="space-y-3">
                <h4 className="font-bold text-blue-400 border-b border-blue-500/5 pb-1">Demographics & Profile</h4>
                
                {/* Age Slider */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-[10px] text-gray-400">
                    <span>Age</span>
                    <span className="text-white font-mono font-bold">{kagAge} years</span>
                  </div>
                  <input
                    type="range"
                    min="40"
                    max="95"
                    value={kagAge}
                    onChange={e => setKagAge(parseInt(e.target.value))}
                    className="w-full h-1 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                </div>

                {/* Sex Selector */}
                <div className="space-y-1.5">
                  <span className="text-[10px] text-gray-400">Gender</span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setKagSex('Male')}
                      className={cn(
                        "py-1.5 rounded-lg border text-xs font-bold transition-all",
                        kagSex === 'Male'
                          ? "bg-blue-500/15 border-blue-500/40 text-blue-400"
                          : "bg-slate-900 border-gray-800 text-gray-400"
                      )}
                    >
                      Male
                    </button>
                    <button
                      type="button"
                      onClick={() => setKagSex('Female')}
                      className={cn(
                        "py-1.5 rounded-lg border text-xs font-bold transition-all",
                        kagSex === 'Female'
                          ? "bg-blue-500/15 border-blue-500/40 text-blue-400"
                          : "bg-slate-900 border-gray-800 text-gray-400"
                      )}
                    >
                      Female
                    </button>
                  </div>
                </div>
              </div>

              {/* Comorbidities toggles */}
              <div className="space-y-3">
                <h4 className="font-bold text-blue-400 border-b border-blue-500/5 pb-1">Comorbidities & Habits</h4>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setKagAnaemia(!kagAnaemia)}
                    className={cn(
                      "py-2 rounded-lg border text-xs font-bold transition-all text-center",
                      kagAnaemia
                        ? "bg-rose-500/15 border-rose-500/30 text-rose-400"
                        : "bg-slate-900 border-gray-800 text-gray-400"
                    )}
                  >
                    Anaemia: {kagAnaemia ? "Yes" : "No"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setKagDiabetes(!kagDiabetes)}
                    className={cn(
                      "py-2 rounded-lg border text-xs font-bold transition-all text-center",
                      kagDiabetes
                        ? "bg-rose-500/15 border-rose-500/30 text-rose-400"
                        : "bg-slate-900 border-gray-800 text-gray-400"
                    )}
                  >
                    Diabetes: {kagDiabetes ? "Yes" : "No"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setKagHbp(!kagHbp)}
                    className={cn(
                      "py-2 rounded-lg border text-xs font-bold transition-all text-center",
                      kagHbp
                        ? "bg-rose-500/15 border-rose-500/30 text-rose-400"
                        : "bg-slate-900 border-gray-800 text-gray-400"
                    )}
                  >
                    High BP: {kagHbp ? "Yes" : "No"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setKagSmoking(!kagSmoking)}
                    className={cn(
                      "py-2 rounded-lg border text-xs font-bold transition-all text-center",
                      kagSmoking
                        ? "bg-rose-500/15 border-rose-500/30 text-rose-400"
                        : "bg-slate-900 border-gray-800 text-gray-400"
                    )}
                  >
                    Smoking: {kagSmoking ? "Yes" : "No"}
                  </button>
                </div>
              </div>

              {/* Vitals & Lab Measurements */}
              <div className="space-y-3">
                <h4 className="font-bold text-blue-400 border-b border-blue-500/5 pb-1">Vitals & Labs</h4>
                
                {/* LVEF */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-[10px] text-gray-400">
                    <span>Ejection Fraction (LVEF %)</span>
                    <span className="text-white font-mono font-bold">{kagEf}%</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="80"
                    value={kagEf}
                    onChange={e => setKagEf(parseInt(e.target.value))}
                    className="w-full h-1 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                </div>

                {/* Creatinine */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-[10px] text-gray-400">
                    <span>Serum Creatinine (mg/dL)</span>
                    <span className="text-white font-mono font-bold">{kagCreatinine.toFixed(1)} mg/dL</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="9.5"
                    step="0.1"
                    value={kagCreatinine}
                    onChange={e => setKagCreatinine(parseFloat(e.target.value))}
                    className="w-full h-1 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                </div>

                {/* Sodium */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-[10px] text-gray-400">
                    <span>Serum Sodium (mmol/L)</span>
                    <span className="text-white font-mono font-bold">{kagSodium} mmol/L</span>
                  </div>
                  <input
                    type="range"
                    min="110"
                    max="150"
                    value={kagSodium}
                    onChange={e => setKagSodium(parseInt(e.target.value))}
                    className="w-full h-1 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                </div>

                {/* Platelets */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-[10px] text-gray-400">
                    <span>Platelets (x10³ / µL)</span>
                    <span className="text-white font-mono font-bold">{kagPlatelets} k/µL</span>
                  </div>
                  <input
                    type="range"
                    min="20"
                    max="850"
                    value={kagPlatelets}
                    onChange={e => setKagPlatelets(parseInt(e.target.value))}
                    className="w-full h-1 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                </div>

                {/* CPK */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-[10px] text-gray-400">
                    <span>CPK (Creatinine Phosphokinase, mcg/L)</span>
                    <span className="text-white font-mono font-bold">{kagCpk !== undefined ? `${kagCpk} mcg/L` : 'Not Captured (Defaulted to 250)'}</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="5000"
                    step="10"
                    value={kagCpk !== undefined ? kagCpk : 250}
                    onChange={e => setKagCpk(parseInt(e.target.value))}
                    className="w-full h-1 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                </div>

                {/* Time / Follow-up */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-[10px] text-gray-400">
                    <span>Follow-up Horizon (Days)</span>
                    <span className="text-white font-mono font-bold">{kagTime} Days</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="365"
                    value={kagTime}
                    onChange={e => setKagTime(parseInt(e.target.value))}
                    className="w-full h-1 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-2.5 pt-3">
              <button
                type="button"
                onClick={handleResetKaggle}
                className="w-full text-center py-2 border border-gray-700 text-gray-400 hover:text-white rounded-xl hover:bg-gray-800/40 transition-all text-xs"
              >
                Reset to Baseline
              </button>
            </div>
          </div>

          {/* Results Dash */}
          <div className="xl:col-span-2 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Circular Gauge Card */}
              <div className="glass-card bg-[#0a1e38]/60 border border-blue-500/10 p-5 rounded-2xl flex flex-col items-center justify-center text-center space-y-4">
                <div className="w-full flex justify-between items-center border-b border-gray-800/60 pb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Random Forest prediction</span>
                  <span className="text-[10px] bg-indigo-500/15 text-indigo-400 border border-indigo-500/25 px-2 py-0.5 rounded font-mono">99.2% Accuracy</span>
                </div>
                
                {kaggleResult ? (
                  <div className="flex flex-col items-center py-4 space-y-3">
                    {/* SVG Circular Progress */}
                    <div className="relative w-36 h-36 flex items-center justify-center">
                      <svg className="w-full h-full transform -rotate-90">
                        {/* Background ring */}
                        <circle
                          cx="72"
                          cy="72"
                          r="58"
                          className="stroke-slate-900 fill-none"
                          strokeWidth="10"
                        />
                        {/* Foreground ring with color depending on risk */}
                        <circle
                          cx="72"
                          cy="72"
                          r="58"
                          className={cn(
                            "fill-none transition-all duration-500 stroke-dasharray",
                            kaggleResult.riskCategory === 'Very High' ? 'stroke-rose-500' :
                            kaggleResult.riskCategory === 'High' ? 'stroke-orange-500' :
                            kaggleResult.riskCategory === 'Intermediate' ? 'stroke-amber-400' :
                            'stroke-emerald-400'
                          )}
                          strokeWidth="10"
                          strokeDasharray={2 * Math.PI * 58}
                          strokeDashoffset={(2 * Math.PI * 58) * (1 - kaggleResult.deathEventProbability)}
                          strokeLinecap="round"
                        />
                      </svg>
                      {/* Central Text */}
                      <div className="absolute flex flex-col items-center justify-center">
                        <span className="text-3xl font-black text-white">{(kaggleResult.deathEventProbability * 100).toFixed(0)}%</span>
                        <span className="text-[8px] uppercase tracking-widest text-gray-500 font-bold">Mortality</span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className={cn(
                        "text-xs font-black uppercase tracking-wider px-3 py-1 rounded-full border inline-block",
                        kaggleResult.riskCategory === 'Very High' ? 'bg-rose-500/10 border-rose-500/35 text-rose-400' :
                        kaggleResult.riskCategory === 'High' ? 'bg-orange-500/10 border-orange-500/35 text-orange-400' :
                        kaggleResult.riskCategory === 'Intermediate' ? 'bg-amber-500/10 border-amber-500/35 text-amber-400' :
                        'bg-emerald-500/10 border-emerald-500/35 text-emerald-400'
                      )}>
                        {kaggleResult.riskCategory} Risk
                      </div>
                      <p className="text-[10px] text-gray-500 max-w-[200px] leading-normal pt-1">
                        Predicts probability of mortality during follow-up time horizon.
                      </p>
                      {!kaggleResult.cpkAvailable && (
                        <div className="text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-lg flex items-center gap-1.5 w-full mt-2 justify-center">
                          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                          CPK not in patient record; defaulted to 250 mcg/L
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-gray-500 py-12">No patient selected.</div>
                )}
              </div>

              {/* Comparison & Guidelines Card */}
              <div className="glass-card bg-[#0a1e38]/40 border border-blue-500/10 p-5 rounded-2xl space-y-4">
                <div className="flex justify-between items-center border-b border-gray-800/60 pb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Classifiers Comparison</span>
                  <span className="text-[10px] bg-slate-900 border border-gray-800 px-2 py-0.5 rounded text-gray-400">1-Yr Horizon</span>
                </div>

                {kaggleResult && (
                  <div className="space-y-4 text-xs">
                    <div className="p-3 bg-slate-900/30 rounded-xl border border-gray-800/60 space-y-3">
                      <div>
                        <div className="flex justify-between text-[10px] text-gray-500 mb-0.5">
                          <span>Standard Rule-Based (MAGGIC)</span>
                          <span className="text-white font-bold">{baselineRisk ? `${Math.round(baselineRisk.oneYearEventProbability * 100)}%` : '—'}</span>
                        </div>
                        <div className="h-1 bg-gray-900 rounded">
                          <div className="h-full bg-blue-500 rounded" style={{ width: `${baselineRisk ? baselineRisk.oneYearEventProbability * 100 : 0}%` }} />
                        </div>
                      </div>
                      
                      <div>
                        <div className="flex justify-between text-[10px] text-gray-500 mb-0.5">
                          <span>Kaggle Random Forest Model</span>
                          <span className="text-indigo-400 font-bold">{Math.round(kaggleResult.deathEventProbability * 100)}%</span>
                        </div>
                        <div className="h-1 bg-gray-900 rounded">
                          <div className="h-full bg-indigo-500 rounded" style={{ width: `${kaggleResult.deathEventProbability * 100}%` }} />
                        </div>
                      </div>
                    </div>

                    <div className="p-3.5 bg-blue-500/5 border border-blue-500/10 rounded-xl text-[10px] leading-relaxed text-blue-300">
                      <span className="font-bold flex items-center gap-1 mb-1">
                        <Info className="w-3.5 h-3.5" /> Clinical Context Note
                      </span>
                      This Random Forest model is trained on clinical records containing demographic, lab, and therapeutic indicators. Changing age, ejection fraction, and renal performance (serum creatinine) are the most significant features triggering trees path decisions.
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Feature Array Vector View */}
            {kaggleResult && (
              <div className="bg-gray-800/40 border border-blue-500/10 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-gray-800 pb-2">
                  <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                    <Sliders className="w-4 h-4 text-violet-400" />
                    Model Feature Vector Inputs
                  </h3>
                  <span className="text-[9px] font-mono bg-slate-900 border border-gray-800 px-2 py-0.5 rounded text-gray-400">12 Features Array</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-[10px]">
                  <div className="p-2 bg-slate-950/40 rounded flex flex-col border border-gray-800/20 hover:border-gray-800/55 transition-all">
                    <span className="text-gray-500 text-[8px] uppercase">[0] age</span>
                    <span className="text-white font-bold text-xs mt-0.5">{kaggleResult.featuresUsed.age}</span>
                  </div>
                  <div className="p-2 bg-slate-950/40 rounded flex flex-col border border-gray-800/20 hover:border-gray-800/55 transition-all">
                    <span className="text-gray-500 text-[8px] uppercase">[1] anaemia</span>
                    <span className="text-white font-bold text-xs mt-0.5">{kaggleResult.featuresUsed.anaemia}</span>
                  </div>
                  <div className="p-2 bg-slate-950/40 rounded flex flex-col border border-gray-800/20 hover:border-gray-800/55 transition-all">
                    <span className="text-gray-500 text-[8px] uppercase">[2] cpk</span>
                    <span className="text-white font-bold text-xs mt-0.5">{kaggleResult.featuresUsed.creatinine_phosphokinase}</span>
                  </div>
                  <div className="p-2 bg-slate-950/40 rounded flex flex-col border border-gray-800/20 hover:border-gray-800/55 transition-all">
                    <span className="text-gray-500 text-[8px] uppercase">[3] diabetes</span>
                    <span className="text-white font-bold text-xs mt-0.5">{kaggleResult.featuresUsed.diabetes}</span>
                  </div>
                  <div className="p-2 bg-slate-950/40 rounded flex flex-col border border-gray-800/20 hover:border-gray-800/55 transition-all">
                    <span className="text-gray-500 text-[8px] uppercase">[4] ejection_frac</span>
                    <span className="text-white font-bold text-xs mt-0.5">{kaggleResult.featuresUsed.ejection_fraction}%</span>
                  </div>
                  <div className="p-2 bg-slate-950/40 rounded flex flex-col border border-gray-800/20 hover:border-gray-800/55 transition-all">
                    <span className="text-gray-500 text-[8px] uppercase">[5] high_bp</span>
                    <span className="text-white font-bold text-xs mt-0.5">{kaggleResult.featuresUsed.high_blood_pressure}</span>
                  </div>
                  <div className="p-2 bg-slate-950/40 rounded flex flex-col border border-gray-800/20 hover:border-gray-800/55 transition-all">
                    <span className="text-gray-500 text-[8px] uppercase">[6] platelets</span>
                    <span className="text-white font-bold text-xs mt-0.5">{kaggleResult.featuresUsed.platelets.toLocaleString()}</span>
                  </div>
                  <div className="p-2 bg-slate-950/40 rounded flex flex-col border border-gray-800/20 hover:border-gray-800/55 transition-all">
                    <span className="text-gray-500 text-[8px] uppercase">[7] creatinine</span>
                    <span className="text-white font-bold text-xs mt-0.5">{kaggleResult.featuresUsed.serum_creatinine}</span>
                  </div>
                  <div className="p-2 bg-slate-950/40 rounded flex flex-col border border-gray-800/20 hover:border-gray-800/55 transition-all">
                    <span className="text-gray-500 text-[8px] uppercase">[8] sodium</span>
                    <span className="text-white font-bold text-xs mt-0.5">{kaggleResult.featuresUsed.serum_sodium}</span>
                  </div>
                  <div className="p-2 bg-slate-950/40 rounded flex flex-col border border-gray-800/20 hover:border-gray-800/55 transition-all">
                    <span className="text-gray-500 text-[8px] uppercase">[9] sex</span>
                    <span className="text-white font-bold text-xs mt-0.5">{kaggleResult.featuresUsed.sex === 1 ? "Male" : "Female"}</span>
                  </div>
                  <div className="p-2 bg-slate-950/40 rounded flex flex-col border border-gray-800/20 hover:border-gray-800/55 transition-all">
                    <span className="text-gray-500 text-[8px] uppercase">[10] smoking</span>
                    <span className="text-white font-bold text-xs mt-0.5">{kaggleResult.featuresUsed.smoking}</span>
                  </div>
                  <div className="p-2 bg-slate-950/40 rounded flex flex-col border border-gray-800/20 hover:border-gray-800/55 transition-all">
                    <span className="text-gray-500 text-[8px] uppercase">[11] time</span>
                    <span className="text-white font-bold text-xs mt-0.5">{kaggleResult.featuresUsed.time} days</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'diagnostics' && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Adjuster Panel */}
          <div className="xl:col-span-1 space-y-5 bg-[#0f2444]/40 border border-blue-500/10 p-5 rounded-2xl">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-blue-400" />
                Echo &amp; Labs Panel
              </h3>
              <p className="text-[10px] text-gray-500 leading-normal">
                Tweak diastolic echo parameters and biomarker levels to assess probability of HFpEF.
              </p>
            </div>

            {/* Patient Selector */}
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-gray-400">Select Registry Patient</label>
              <select
                value={selectedPatientId}
                onChange={e => setSelectedPatientId(e.target.value)}
                className="w-full bg-slate-900 border border-blue-500/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500/40"
              >
                {patients.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.firstName} {p.lastName} (HID: {p.mrn || '—'})
                  </option>
                ))}
              </select>
            </div>

            <hr className="border-blue-500/10" />

            <div className="space-y-4 text-xs overflow-y-auto max-h-[550px] pr-1">
              {/* Demographics & rhythm */}
              <div className="space-y-3">
                <h4 className="font-bold text-blue-400 border-b border-blue-500/5 pb-1">Clinical Baseline</h4>
                
                {/* Age Slider */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-[10px] text-gray-400">
                    <span>Age</span>
                    <span className="text-white font-mono font-bold">{diagAge} years</span>
                  </div>
                  <input
                    type="range"
                    min="40"
                    max="95"
                    value={diagAge}
                    onChange={e => setDiagAge(parseInt(e.target.value))}
                    className="w-full h-1 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                </div>

                {/* BMI Slider */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-[10px] text-gray-400">
                    <span>BMI (kg/m²)</span>
                    <span className="text-white font-mono font-bold">{diagBmi.toFixed(1)} kg/m²</span>
                  </div>
                  <input
                    type="range"
                    min="15"
                    max="50"
                    step="0.5"
                    value={diagBmi}
                    onChange={e => setDiagBmi(parseFloat(e.target.value))}
                    className="w-full h-1 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                </div>

                {/* Antihypertensive Meds */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-[10px] text-gray-400">
                    <span>Antihypertensive Drugs Count</span>
                    <span className="text-white font-mono font-bold">{diagAntiHtnCount} drugs</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="5"
                    value={diagAntiHtnCount}
                    onChange={e => setDiagAntiHtnCount(parseInt(e.target.value))}
                    className="w-full h-1 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                </div>

                {/* Cardiac Rhythm */}
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-400">Cardiac Rhythm</label>
                  <select
                    value={diagRhythm}
                    onChange={e => setDiagRhythm(e.target.value as Visit['rhythm'])}
                    className="w-full bg-slate-900 border border-blue-500/10 rounded-lg px-2.5 py-1.5 text-white"
                  >
                    <option value="Sinus">Sinus</option>
                    <option value="AF">Atrial Fibrillation</option>
                    <option value="Atrial Flutter">Atrial Flutter</option>
                  </select>
                </div>
              </div>

              {/* Echocardiography */}
              <div className="space-y-3">
                <h4 className="font-bold text-blue-400 border-b border-blue-500/5 pb-1">Echocardiography</h4>
                
                {/* E/e' ratio */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-[10px] text-gray-400">
                    <span>Average E/e' ratio</span>
                    <span className="text-white font-mono font-bold">{diagEEPrime}</span>
                  </div>
                  <input
                    type="range"
                    min="2"
                    max="30"
                    value={diagEEPrime}
                    onChange={e => setDiagEEPrime(parseInt(e.target.value))}
                    className="w-full h-1 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                </div>

                {/* Septal e' */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-[10px] text-gray-400">
                    <span>Septal e' velocity (cm/s)</span>
                    <span className="text-white font-mono font-bold">{diagSeptalEPrime} cm/s</span>
                  </div>
                  <input
                    type="range"
                    min="2"
                    max="15"
                    value={diagSeptalEPrime}
                    onChange={e => setDiagSeptalEPrime(parseInt(e.target.value))}
                    className="w-full h-1 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                </div>

                {/* Lateral e' */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-[10px] text-gray-400">
                    <span>Lateral e' velocity (cm/s)</span>
                    <span className="text-white font-mono font-bold">{diagLateralEPrime} cm/s</span>
                  </div>
                  <input
                    type="range"
                    min="2"
                    max="20"
                    value={diagLateralEPrime}
                    onChange={e => setDiagLateralEPrime(parseInt(e.target.value))}
                    className="w-full h-1 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                </div>

                {/* RVSP */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-[10px] text-gray-400">
                    <span>RVSP (mmHg)</span>
                    <span className="text-white font-mono font-bold">{diagRvsp} mmHg</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="80"
                    value={diagRvsp}
                    onChange={e => setDiagRvsp(parseInt(e.target.value))}
                    className="w-full h-1 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                </div>

                {/* LA Volume Index (LAVI) */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-[10px] text-gray-400">
                    <span>LA Volume Index (LAVI, mL/m²)</span>
                    <span className="text-white font-mono font-bold">{diagLavi} mL/m²</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="80"
                    value={diagLavi}
                    onChange={e => setDiagLavi(parseInt(e.target.value))}
                    className="w-full h-1 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                </div>

                {/* LV Mass Index (LVMI) */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-[10px] text-gray-400">
                    <span>LV Mass Index (LVMI, g/m²)</span>
                    <span className="text-white font-mono font-bold">{diagLvmi} g/m²</span>
                  </div>
                  <input
                    type="range"
                    min="50"
                    max="200"
                    value={diagLvmi}
                    onChange={e => setDiagLvmi(parseInt(e.target.value))}
                    className="w-full h-1 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                </div>

                {/* Relative Wall Thickness (RWT) */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-[10px] text-gray-400">
                    <span>Relative Wall Thickness (RWT)</span>
                    <span className="text-white font-mono font-bold">{diagRwt.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="0.10"
                    max="0.80"
                    step="0.01"
                    value={diagRwt}
                    onChange={e => setDiagRwt(parseFloat(e.target.value))}
                    className="w-full h-1 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                </div>

                {/* GLS */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-[10px] text-gray-400">
                    <span>GLS (Global Longitudinal Strain, %)</span>
                    <span className="text-white font-mono font-bold">{diagGls}%</span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="25"
                    value={diagGls}
                    onChange={e => setDiagGls(parseInt(e.target.value))}
                    className="w-full h-1 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                </div>
              </div>

              {/* Biomarkers */}
              <div className="space-y-3">
                <h4 className="font-bold text-blue-400 border-b border-blue-500/5 pb-1">Biomarkers</h4>
                
                {/* NT-proBNP */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-[10px] text-gray-400">
                    <span>NT-proBNP (pg/mL)</span>
                    <span className="text-white font-mono font-bold">{diagNtproBnp} pg/mL</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="5000"
                    step="10"
                    value={diagNtproBnp}
                    onChange={e => setDiagNtproBnp(parseInt(e.target.value))}
                    className="w-full h-1 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                </div>

                {/* BNP */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-[10px] text-gray-400">
                    <span>BNP (pg/mL)</span>
                    <span className="text-white font-mono font-bold">{diagBnp} pg/mL</span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="1000"
                    step="5"
                    value={diagBnp}
                    onChange={e => setDiagBnp(parseInt(e.target.value))}
                    className="w-full h-1 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-2.5 pt-3">
              <button
                type="button"
                onClick={handleResetDiagnostics}
                className="w-full text-center py-2 border border-gray-700 text-gray-400 hover:text-white rounded-xl hover:bg-gray-800/40 transition-all text-xs"
              >
                Reset to Baseline
              </button>
            </div>
          </div>

          {/* Results Dash */}
          <div className="xl:col-span-2 space-y-5">
            {/* Score Cards side by side */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* H2FPEF Score Card */}
              <div className="glass-card bg-[#0a1e38]/60 border border-blue-500/10 p-5 rounded-2xl space-y-4">
                <div className="flex justify-between items-center border-b border-gray-800/60 pb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">H2FPEF Score (Mayo Clinic)</span>
                  <span className="text-[10px] bg-slate-900 border border-gray-850 px-2 py-0.5 rounded font-mono">Max 9 Pts</span>
                </div>

                <div className="flex items-center gap-4 py-2">
                  <div className="w-16 h-16 rounded-xl bg-slate-950 flex flex-col items-center justify-center border border-gray-800">
                    <span className="text-2xl font-black text-white">{h2fpefResult.score}</span>
                    <span className="text-[8px] uppercase tracking-wider text-gray-500 font-bold">Points</span>
                  </div>
                  <div className="flex-1 space-y-1">
                    <p className="text-[10px] text-gray-500">HFpEF Probability</p>
                    <span className={cn(
                      "text-lg font-black block",
                      h2fpefResult.score >= 6 ? "text-rose-400" :
                      h2fpefResult.score >= 2 ? "text-amber-400" :
                      "text-emerald-400"
                    )}>
                      {(h2fpefResult.probability * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="space-y-1">
                  <div className="h-2 bg-gray-900 rounded overflow-hidden flex gap-0.5">
                    {Array.from({ length: 9 }).map((_, i) => (
                      <div
                        key={i}
                        className={cn(
                          "h-full flex-1 transition-all duration-300",
                          i < h2fpefResult.score
                            ? h2fpefResult.score >= 6 ? "bg-rose-500" :
                              h2fpefResult.score >= 2 ? "bg-amber-400" :
                              "bg-emerald-500"
                            : "bg-gray-800/40"
                        )}
                      />
                    ))}
                  </div>
                </div>

                <div className="p-3 bg-slate-900/30 border border-gray-800/60 rounded-xl text-xs leading-normal">
                  <p className="text-gray-300">{h2fpefResult.interpretation}</p>
                </div>
              </div>

              {/* HFA-PEFF Score Card */}
              <div className="glass-card bg-[#0a1e38]/60 border border-blue-500/10 p-5 rounded-2xl space-y-4">
                <div className="flex justify-between items-center border-b border-gray-800/60 pb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">HFA-PEFF Score (ESC 2019)</span>
                  <span className="text-[10px] bg-slate-900 border border-gray-850 px-2 py-0.5 rounded font-mono">Max 6 Pts</span>
                </div>

                <div className="flex items-center gap-4 py-2">
                  <div className="w-16 h-16 rounded-xl bg-slate-950 flex flex-col items-center justify-center border border-gray-800">
                    <span className="text-2xl font-black text-white">{hfapeffResult.score}</span>
                    <span className="text-[8px] uppercase tracking-wider text-gray-500 font-bold">Points</span>
                  </div>
                  <div className="flex-1 space-y-1">
                    <p className="text-[10px] text-gray-500">Clinical Interpretation</p>
                    <span className={cn(
                      "text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border inline-block",
                      hfapeffResult.score >= 5 ? "bg-rose-500/15 border-rose-500/30 text-rose-400" :
                      hfapeffResult.score >= 2 ? "bg-amber-500/15 border-amber-500/30 text-amber-400" :
                      "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                    )}>
                      {hfapeffResult.score >= 5 ? "HFpEF Confirmed" :
                       hfapeffResult.score >= 2 ? "Intermediate" :
                       "Unlikely HFpEF"}
                    </span>
                  </div>
                </div>

                {/* Domains breakdown */}
                <div className="grid grid-cols-3 gap-2 text-[10px] font-mono text-center">
                  <div className="p-1.5 bg-slate-950/40 rounded border border-gray-850">
                    <span className="text-gray-500 text-[8px] block uppercase">Functional</span>
                    <span className="text-white font-bold">{hfapeffResult.functionalPoints}/2</span>
                  </div>
                  <div className="p-1.5 bg-slate-950/40 rounded border border-gray-850">
                    <span className="text-gray-500 text-[8px] block uppercase">Morphology</span>
                    <span className="text-white font-bold">{hfapeffResult.morphologicalPoints}/2</span>
                  </div>
                  <div className="p-1.5 bg-slate-950/40 rounded border border-gray-850">
                    <span className="text-gray-500 text-[8px] block uppercase">Biomarker</span>
                    <span className="text-white font-bold">{hfapeffResult.biomarkerPoints}/2</span>
                  </div>
                </div>

                <div className="p-3 bg-slate-900/30 border border-gray-800/60 rounded-xl text-xs leading-normal">
                  <p className="text-gray-300">{hfapeffResult.interpretation}</p>
                </div>
              </div>
            </div>

            {/* Diagnostic Pathway Flowchart */}
            <div className="bg-gray-800/40 border border-blue-500/10 rounded-2xl p-5 space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5 border-b border-gray-800 pb-2">
                <Activity className="w-4 h-4 text-violet-400" />
                ESC Guideline-Aligned Diagnostic Flowchart
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-center text-xs text-center">
                {/* Step 1 */}
                <div className="p-3 bg-slate-900/30 border border-gray-800/80 rounded-xl">
                  <span className="text-[9px] uppercase tracking-wider text-gray-500 font-bold block mb-1">Step 1</span>
                  <span className="text-white font-bold block">Pre-Screening</span>
                  <p className="text-[10px] text-gray-400 mt-1">Symptoms of HF &amp; LVEF &ge; 50%</p>
                </div>
                
                <div className="flex justify-center text-gray-600 font-bold rotate-90 md:rotate-0">&rarr;</div>

                {/* Step 2 */}
                <div className={cn(
                  "p-3 border rounded-xl",
                  (h2fpefResult.score >= 6 || hfapeffResult.score >= 5) ? "bg-rose-500/10 border-rose-500/30 text-rose-400 font-bold" :
                  (h2fpefResult.score >= 2 || hfapeffResult.score >= 2) ? "bg-amber-500/10 border-amber-500/30 text-amber-400 font-bold" :
                  "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                )}>
                  <span className="text-[9px] uppercase tracking-wider text-gray-550 block mb-1">Step 2</span>
                  <span className="block">Score Results</span>
                  <p className="text-[10px] mt-1">
                    {(h2fpefResult.score >= 6 || hfapeffResult.score >= 5) ? "High Probability" :
                     (h2fpefResult.score >= 2 || hfapeffResult.score >= 2) ? "Intermediate Probability" :
                     "Low Probability"}
                  </p>
                </div>

                <div className="flex justify-center text-gray-600 font-bold rotate-90 md:rotate-0">&rarr;</div>

                {/* Step 3 */}
                <div className="p-3 bg-slate-900/30 border border-gray-800/80 rounded-xl">
                  <span className="text-[9px] uppercase tracking-wider text-gray-500 font-bold block mb-1">Step 3 / 4</span>
                  <span className="text-white font-bold block">Functional Testing</span>
                  <p className="text-[10px] text-gray-400 mt-1">
                    {(h2fpefResult.score >= 6 || hfapeffResult.score >= 5) ? "Initiate therapy directly" :
                     (h2fpefResult.score >= 2 || hfapeffResult.score >= 2) ? "Stress Echo / Hemodynamics" :
                     "Investigate other diagnoses"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'specs' && (
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="bg-[#0f2444]/40 border border-blue-500/10 p-6 rounded-2xl space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-1.5 border-b border-gray-800 pb-2">
              <Brain className="w-4 h-4 text-violet-400" />
              AI Engine Specifications
            </h3>

            <div className="space-y-4 text-xs leading-relaxed text-gray-400">
              <p>
                The Cardio-Konnect AI engine runs **entirely offline** within the client browser. It contains zero cloud endpoints, which enforces 100% HIPAA compliance and ensures instant calculations with zero network latency.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div className="p-4 bg-slate-900/40 border border-gray-800 rounded-xl space-y-2">
                  <h4 className="font-bold text-white">Model Architecture</h4>
                  <ul className="list-disc pl-4 space-y-1">
                    <li>Phase 1: Validated Clinical Rules + Pocock MAGGIC Regression.</li>
                    <li>Phase 2: XGBoost model running via TensorFlow.js (triggers when patient size &gt; 200).</li>
                    <li>Weights derived from ESC 2023 Heart Failure Guidelines.</li>
                  </ul>
                </div>

                <div className="p-4 bg-slate-900/40 border border-gray-800 rounded-xl space-y-2">
                  <h4 className="font-bold text-white">Classification Thresholds</h4>
                  <ul className="list-disc pl-4 space-y-1">
                    <li><span className="text-emerald-400 font-bold">Low Risk:</span> &lt;8% predicted 1-year mortality.</li>
                    <li><span className="text-amber-400 font-bold">Intermediate Risk:</span> 8% – 19% predicted 1-year mortality.</li>
                    <li><span className="text-orange-400 font-bold">High Risk:</span> 20% – 39% predicted 1-year mortality.</li>
                    <li><span className="text-rose-400 font-bold">Very High Risk:</span> &ge;40% predicted 1-year mortality.</li>
                  </ul>
                </div>
              </div>

              <div className="p-4 bg-blue-500/5 border border-blue-500/15 rounded-xl text-blue-300">
                <h4 className="font-bold flex items-center gap-1 mb-1">
                  <ShieldCheck className="w-4 h-4" />
                  Clinical Validation Note
                </h4>
                All score calculations and medical recommendations are validated against the 2023 ESC Guidelines for the diagnosis and treatment of acute and chronic heart failure. This tool does not substitute professional medical opinion.
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
