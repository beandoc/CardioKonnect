'use client'
import { useState, useMemo, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { FlaskConical, Calculator, Heart, Info, ArrowRight, ShieldCheck, Activity, Save, User, Printer, Database, Layers, Sparkles, CheckCircle2, RotateCcw } from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import Button from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/utils'
import { calculateMAGGIC, calculateH2FPEF, calculateHFAPEFF, calculateCHARM, calculateCHADSVASc, calculateHASBLED, calculateMACERisk, calculateContrastNephropathyRisk, calculateReadmissionRisk, calculateASCVDRisk } from '@/lib/riskScores'
import type { KillipClass, TIMIFlow, CulpritVessel, ASCVDRace } from '@/lib/riskScores'
import { getPatient, getVisits, updateVisit, getPatients, getAllLatestVisits } from '@/lib/firestore'
import type { Patient, Visit } from '@/lib/types'
import { toast } from 'sonner'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomSurvivalTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg shadow-lg px-3 py-2 text-xs text-gray-300">
      <p className="font-semibold text-white mb-1">{payload[0].payload.year} Survival Rate</p>
      <p className="text-violet-400 font-medium">Current: <span className="font-extrabold">{payload[0].value}%</span></p>
      <p className="text-emerald-400 font-medium">Optimized GDMT: <span className="font-extrabold">{payload[1].value}%</span></p>
    </div>
  )
}

function RiskCalculatorContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  
  const patientId = searchParams.get('patientId')
  const visitId = searchParams.get('visitId')

  const [activeCalculator, setActiveCalculator] = useState<'maggic' | 'h2fpef' | 'hfapeff' | 'charm' | 'chads' | 'hasbled' | 'mace' | 'cin' | 'readmission' | 'ascvd'>('maggic')
  const [crUnit, setCrUnit] = useState<'mg/dL' | 'umol/L'>('mg/dL')

  const [connectedPatient, setConnectedPatient] = useState<Patient | null>(null)
  const [connectedVisit, setConnectedVisit] = useState<Visit | null>(null)

  // MAGGIC inputs state
  const [maggicAge, setMaggicAge] = useState(65)
  const [maggicLvef, setMaggicLvef] = useState(35)
  const [maggicSbp, setMaggicSbp] = useState(120)
  const [maggicBmi, setMaggicBmi] = useState(24)
  const [maggicCr, setMaggicCr] = useState(1.13)
  const [maggicNyha, setMaggicNyha] = useState<'I' | 'II' | 'III' | 'IV'>('II')
  const [maggicSex, setMaggicSex] = useState<'Male' | 'Female'>('Male')
  const [maggicDiabetes, setMaggicDiabetes] = useState(true)
  const [maggicSmoker, setMaggicSmoker] = useState(false)
  const [maggicCopd, setMaggicCopd] = useState(false)
  const [maggicHfYears, setMaggicHfYears] = useState(2)
  const [maggicBb, setMaggicBb] = useState(true)
  const [maggicAce, setMaggicAce] = useState(true)

  // H2FPEF inputs state
  const [h2Bmi, setH2Bmi] = useState(32)
  const [h2Meds, setH2Meds] = useState(2)
  const [h2Af, setH2Af] = useState(true)
  const [h2Pap, setH2Pap] = useState(40)
  const [h2Age, setH2Age] = useState(65)
  const [h2EEPrime, setH2EEPrime] = useState(11)

  // HFA-PEFF inputs state
  const [hfaSeptalEPrime, setHfaSeptalEPrime] = useState(8)
  const [hfaLateralEPrime, setHfaLateralEPrime] = useState(11)
  const [hfaGls, setHfaGls] = useState(-18)
  const [hfaLaVolumeIndex, setHfaLaVolumeIndex] = useState(32)
  const [hfaLvMassIndex, setHfaLvMassIndex] = useState(110)
  const [hfaRelativeWallThickness, setHfaRelativeWallThickness] = useState(0.38)
  const [hfaNtProBNP, setHfaNtProBNP] = useState(300)
  const [hfaBNP, setHfaBNP] = useState(100)

  // CHARM inputs state
  const [charmAge, setCharmAge] = useState(65)
  const [charmNyha, setCharmNyha] = useState<'I' | 'II' | 'III' | 'IV'>('III')
  const [charmLvef, setCharmLvef] = useState(30)
  const [charmCr, setCharmCr] = useState(1.24)
  const [charmSodium, setCharmSodium] = useState(136)
  const [charmDiabetes, setCharmDiabetes] = useState(true)
  const [charmCopd, setCharmCopd] = useState(false)
  const [charmSmoker, setCharmSmoker] = useState(true)

  // CHA2DS2-VASc inputs state
  const [chadsAge, setChadsAge] = useState(65)
  const [chadsSex, setChadsSex] = useState<'Male' | 'Female'>('Male')
  const [chadsCHF, setChadsCHF] = useState(true)
  const [chadsHTN, setChadsHTN] = useState(true)
  const [chadsDiabetes, setChadsDiabetes] = useState(true)
  const [chadsStroke, setChadsStroke] = useState(false)
  const [chadsVascular, setChadsVascular] = useState(false)

  // HAS-BLED inputs state
  const [hasbledAge, setHasbledAge] = useState(65)
  const [hasbledHTN, setHasbledHTN] = useState(false)
  const [hasbledRenal, setHasbledRenal] = useState(false)
  const [hasbledLiver, setHasbledLiver] = useState(false)
  const [hasbledStroke, setHasbledStroke] = useState(false)
  const [hasbledBleeding, setHasbledBleeding] = useState(false)
  const [hasbledLabileINR, setHasbledLabileINR] = useState(false)
  const [hasbledDrugs, setHasbledDrugs] = useState(false)
  const [hasbledAlcohol, setHasbledAlcohol] = useState(false)

  // MACE Risk inputs
  const [maceKillip, setMaceKillip] = useState<KillipClass>('I')
  const [maceSyntax, setMaceSyntax] = useState(12)
  const [maceCulprit, setMaceCulprit] = useState<CulpritVessel>('LAD')
  const [maceTimi, setMaceTimi] = useState<TIMIFlow>('3')
  const [maceLvef, setMaceLvef] = useState(50)
  const [maceAge, setMaceAge] = useState(60)
  const [maceDiabetes, setMaceDiabetes] = useState(false)
  const [macePriorMI, setMacePriorMI] = useState(false)
  const [maceStentLength, setMaceStentLength] = useState(28)

  // Contrast Nephropathy inputs
  const [cinEGFR, setCinEGFR] = useState(75)
  const [cinContrast, setCinContrast] = useState(150)
  const [cinDiabetes, setCinDiabetes] = useState(false)
  const [cinNSAID, setCinNSAID] = useState(false)
  const [cinHypotension, setCinHypotension] = useState(false)
  const [cinHF, setCinHF] = useState(false)
  const [cinAge, setCinAge] = useState(60)
  const [cinCreatinine, setCinCreatinine] = useState(1.0)
  const [cinIABP, setCinIABP] = useState(false)

  // Readmission Risk inputs
  const [readLvef, setReadLvef] = useState(45)
  const [readAge, setReadAge] = useState(65)
  const [readAlone, setReadAlone] = useState(false)
  const [readNoAddress, setReadNoAddress] = useState(false)
  const [readLowLiteracy, setReadLowLiteracy] = useState(false)
  const [readBetaBlocker, setReadBetaBlocker] = useState(true)
  const [readRaas, setReadRaas] = useState(true)
  const [readStatin, setReadStatin] = useState(true)
  const [readAntiplatelet, setReadAntiplatelet] = useState(true)
  const [readFollowUp, setReadFollowUp] = useState(true)
  const [readRehab, setReadRehab] = useState(false)
  const [readPriorHosp, setReadPriorHosp] = useState(false)
  const [readRenal, setReadRenal] = useState(false)
  const [readDiabetes, setReadDiabetes] = useState(false)
  const [readCopd, setReadCopd] = useState(false)

  // ASCVD Risk inputs
  const [ascvdAge, setAscvdAge] = useState(55)
  const [ascvdSex, setAscvdSex] = useState<'Male' | 'Female'>('Male')
  const [ascvdRace, setAscvdRace] = useState<ASCVDRace>('White')
  const [ascvdTotalChol, setAscvdTotalChol] = useState(200)
  const [ascvdHDL, setAscvdHDL] = useState(50)
  const [ascvdSBP, setAscvdSBP] = useState(125)
  const [ascvdHTNTx, setAscvdHTNTx] = useState(false)
  const [ascvdDiabetes, setAscvdDiabetes] = useState(false)
  const [ascvdSmoker, setAscvdSmoker] = useState(false)
  const [ascvdLDL, setAscvdLDL] = useState(130)

  const [allPatients, setAllPatients] = useState<Patient[]>([])
  const [allVisitsMap, setAllVisitsMap] = useState<Map<string, Visit>>(new Map())
  const [selectedRegistry, setSelectedRegistry] = useState<string>('hf')
  const [selectedPatientId, setSelectedPatientId] = useState<string>(patientId || '')

  const [saving, setSaving] = useState(false)

  // Derived filtered patients by selected registry track
  const selectablePatients = useMemo(() => {
    if (selectedRegistry === 'all') return allPatients
    return allPatients.filter(p => (p.registryId || 'hf').toLowerCase() === selectedRegistry.toLowerCase())
  }, [allPatients, selectedRegistry])

  // Populate all calculators from a given patient and visit
  const populateFromPatientAndVisit = (pt: Patient, vt?: Visit | null) => {
    setConnectedPatient(pt)
    if (vt) setConnectedVisit(vt)

    // Age calculation
    let age = 65
    if (pt.dob) {
      age = Math.floor((Date.now() - new Date(pt.dob).getTime()) / (365.25 * 86400000))
    } else if (pt.age) {
      age = pt.age
    }

    // BMI calculation
    let bmi = 24
    if (vt?.weight && vt?.height) {
      bmi = +(vt.weight / ((vt.height / 100) * (vt.height / 100))).toFixed(1)
    } else if (vt?.bmi) {
      bmi = vt.bmi
    }

    // Comorbidities check
    const ptComorbidities = (Array.isArray(pt.comorbidities) ? pt.comorbidities.join(' ') : (pt.comorbidities ?? '')).toLowerCase()
    const hasDiabetes = Boolean(pt.comorbidDiabetes || ptComorbidities.includes('diabetes') || ptComorbidities.includes('dm'))
    const hasHTN = Boolean(pt.comorbidHypertension || ptComorbidities.includes('hypertension') || ptComorbidities.includes('htn') || (vt?.bpSystolic != null && vt.bpSystolic > 140))
    const hasCKD = Boolean(pt.comorbidCKD || ptComorbidities.includes('ckd') || ptComorbidities.includes('renal'))
    const hasAF = Boolean(pt.comorbidAF || ptComorbidities.includes('af') || ptComorbidities.includes('fibrillation') || vt?.rhythm === 'AF' || vt?.rhythm === 'Atrial Flutter')
    const hasCOPD = Boolean(pt.comorbidCOPD || ptComorbidities.includes('copd') || ptComorbidities.includes('asthma'))
    const isSmoker = Boolean((pt as any).currentSmoker || ptComorbidities.includes('smok') || ptComorbidities.includes('tobacco'))
    const hasStroke = Boolean(ptComorbidities.includes('stroke') || ptComorbidities.includes('cva') || ptComorbidities.includes('tia') || vt?.eventStroke)
    const hasVascular = Boolean(ptComorbidities.includes('vascular') || ptComorbidities.includes('mi') || ptComorbidities.includes('cad') || ptComorbidities.includes('pci') || ptComorbidities.includes('cabg') || vt?.eventMI)

    // 1. MAGGIC
    setMaggicAge(age)
    if (vt?.lvef != null) setMaggicLvef(vt.lvef)
    else if (pt.lvef != null) setMaggicLvef(pt.lvef)
    if (vt?.bpSystolic != null) setMaggicSbp(vt.bpSystolic)
    setMaggicBmi(bmi)
    if (vt?.creatinine != null) setMaggicCr(vt.creatinine)
    if (vt?.nyha && ['I', 'II', 'III', 'IV'].includes(vt.nyha)) setMaggicNyha(vt.nyha as any)
    else if (pt.nyha && ['I', 'II', 'III', 'IV'].includes(pt.nyha)) setMaggicNyha(pt.nyha as any)
    setMaggicSex(pt.sex === 'Female' ? 'Female' : 'Male')
    setMaggicDiabetes(hasDiabetes)
    setMaggicSmoker(isSmoker)
    setMaggicCopd(hasCOPD)
    setMaggicBb(vt?.betaBlocker?.prescribed === 'Yes')
    setMaggicAce(vt?.raasi?.prescribed === 'Yes')

    // 2. H2FPEF
    setH2Bmi(bmi)
    setH2Af(hasAF)
    if (vt?.rvsp != null) setH2Pap(vt.rvsp)
    setH2Age(age)
    if (vt?.eEPrime != null) setH2EEPrime(vt.eEPrime)

    // 3. HFA-PEFF
    if (vt?.septalEPrime != null) setHfaSeptalEPrime(vt.septalEPrime)
    if (vt?.lateralEPrime != null) setHfaLateralEPrime(vt.lateralEPrime)
    if (vt?.gls != null) setHfaGls(vt.gls)
    if (vt?.laVolumeIndex != null) setHfaLaVolumeIndex(vt.laVolumeIndex)
    if (vt?.lvMassIndex != null) setHfaLvMassIndex(vt.lvMassIndex)
    if (vt?.relativeWallThickness != null) setHfaRelativeWallThickness(vt.relativeWallThickness)
    if (vt?.ntProBNP != null) setHfaNtProBNP(vt.ntProBNP)
    if (vt?.bnp != null) setHfaBNP(vt.bnp)

    // 4. CHARM
    setCharmAge(age)
    if (vt?.nyha && ['I', 'II', 'III', 'IV'].includes(vt.nyha)) setCharmNyha(vt.nyha as any)
    if (vt?.lvef != null) setCharmLvef(vt.lvef)
    if (vt?.creatinine != null) setCharmCr(vt.creatinine)
    if (vt?.sodium != null) setCharmSodium(vt.sodium)
    setCharmDiabetes(hasDiabetes)
    setCharmCopd(hasCOPD)
    setCharmSmoker(isSmoker)

    // 5. CHA2DS2-VASc
    setChadsAge(age)
    setChadsSex(pt.sex === 'Female' ? 'Female' : 'Male')
    setChadsCHF(true)
    setChadsHTN(hasHTN)
    setChadsDiabetes(hasDiabetes)
    setChadsStroke(hasStroke)
    setChadsVascular(hasVascular)

    // 6. HAS-BLED
    setHasbledAge(age)
    setHasbledHTN(vt?.bpSystolic != null && vt.bpSystolic > 160)
    setHasbledRenal(hasCKD || (vt?.creatinine != null && vt.creatinine > 2.26))
    setHasbledLiver(ptComorbidities.includes('cirrhosis') || ptComorbidities.includes('liver') || ptComorbidities.includes('hepatic'))
    setHasbledStroke(hasStroke)
    setHasbledBleeding(ptComorbidities.includes('bleeding') || (vt?.hb != null && vt.hb < 11))
    setHasbledDrugs(vt?.aspirin?.prescribed === 'Yes' || ptComorbidities.includes('aspirin') || ptComorbidities.includes('nsaid'))

    // 7. MACE Risk (ACS)
    setMaceAge(age)
    if (vt?.lvef != null) setMaceLvef(vt.lvef)
    setMaceDiabetes(hasDiabetes)
    setMacePriorMI(hasVascular)

    // 8. Contrast Nephropathy
    setCinAge(age)
    if (vt?.egfr != null) setCinEGFR(vt.egfr)
    if (vt?.creatinine != null) setCinCreatinine(vt.creatinine)
    setCinDiabetes(hasDiabetes)
    setCinHF(true)
    setCinHypotension(vt?.bpSystolic != null && vt.bpSystolic < 90)

    // 9. Readmission Risk
    if (vt?.lvef != null) setReadLvef(vt.lvef)
    setReadAge(age)
    setReadBetaBlocker(vt?.betaBlocker?.prescribed === 'Yes')
    setReadRaas(vt?.raasi?.prescribed === 'Yes')
    setReadDiabetes(hasDiabetes)
    setReadRenal(hasCKD)
    setReadCopd(hasCOPD)
    setReadPriorHosp(vt?.hospHistory === 'Yes')

    // 10. ASCVD Risk
    setAscvdAge(age)
    setAscvdSex(pt.sex === 'Female' ? 'Female' : 'Male')
    if (vt?.bpSystolic != null) setAscvdSBP(vt.bpSystolic)
    setAscvdHTNTx(hasHTN)
    setAscvdDiabetes(hasDiabetes)
    setAscvdSmoker(isSmoker)

    toast.success(`Loaded clinical registry data for ${pt.firstName} ${pt.lastName}`)
  }

  // Load patient list and map on mount
  useEffect(() => {
    async function loadAllRegistryData() {
      try {
        const [pts, vmap] = await Promise.all([getPatients(), getAllLatestVisits()])
        setAllPatients(pts)
        setAllVisitsMap(vmap)

        // If patientId is specified in URL query, load them immediately
        if (patientId) {
          const pt = pts.find(p => p.id === patientId)
          if (pt) {
            const vt = vmap.get(pt.id) || null
            populateFromPatientAndVisit(pt, vt)
            setSelectedPatientId(pt.id)
          }
        }
      } catch (err) {
        console.error('Failed to load registry patients:', err)
      }
    }
    loadAllRegistryData()
  }, [patientId])

  // Handle patient dropdown change
  const handleSelectPatient = (id: string) => {
    setSelectedPatientId(id)
    if (!id) {
      setConnectedPatient(null)
      setConnectedVisit(null)
      toast.info('Switched to manual simulation mode')
      return
    }
    const pt = allPatients.find(p => p.id === id)
    if (pt) {
      const vt = allVisitsMap.get(pt.id) || null
      populateFromPatientAndVisit(pt, vt)
    }
  }

  const handleCrUnitChange = (newUnit: 'mg/dL' | 'umol/L') => {
    if (crUnit === newUnit) return;
    setCrUnit(newUnit);
    if (newUnit === 'umol/L') {
      setMaggicCr(+(maggicCr * 88.4).toFixed(2));
      setCharmCr(+(charmCr * 88.4).toFixed(2));
    } else {
      setMaggicCr(+(maggicCr / 88.4).toFixed(2));
      setCharmCr(+(charmCr / 88.4).toFixed(2));
    }
  }

  // Compute values
  const maggicResult = useMemo(() => {
    const crMgDl = crUnit === 'umol/L' ? maggicCr / 88.4 : maggicCr;
    return calculateMAGGIC({
      age: maggicAge,
      lvef: maggicLvef,
      systolicBP: maggicSbp,
      bmi: maggicBmi,
      creatinine: crMgDl,
      nyha: maggicNyha,
      sex: maggicSex,
      diabetesMellitus: maggicDiabetes,
      currentSmoker: maggicSmoker,
      copd: maggicCopd,
      heartFailureDiagnosisYears: maggicHfYears,
      betaBlocker: maggicBb,
      aceInhibitorOrArb: maggicAce
    })
  }, [maggicAge, maggicLvef, maggicSbp, maggicBmi, maggicCr, crUnit, maggicNyha, maggicSex, maggicDiabetes, maggicSmoker, maggicCopd, maggicHfYears, maggicBb, maggicAce])

  const maggicResultOpt = useMemo(() => {
    const crMgDl = crUnit === 'umol/L' ? maggicCr / 88.4 : maggicCr;
    return calculateMAGGIC({
      age: maggicAge,
      lvef: maggicLvef,
      systolicBP: maggicSbp,
      bmi: maggicBmi,
      creatinine: crMgDl,
      nyha: maggicNyha,
      sex: maggicSex,
      diabetesMellitus: maggicDiabetes,
      currentSmoker: maggicSmoker,
      copd: maggicCopd,
      heartFailureDiagnosisYears: maggicHfYears,
      betaBlocker: true, // Fully optimized GDMT
      aceInhibitorOrArb: true // Fully optimized GDMT
    })
  }, [maggicAge, maggicLvef, maggicSbp, maggicBmi, maggicCr, crUnit, maggicNyha, maggicSex, maggicDiabetes, maggicSmoker, maggicCopd, maggicHfYears])

  // Validated MAGGIC published endpoints (Pocock 2013 Table 3: 1-year and 3-year mortality)
  // Mathematical 2, 4, 5-year interpolations and decay extrapolations are unvalidated and removed
  const survivalCurveData = useMemo(() => {
    return [
      {
        year: 'Baseline',
        current: 100,
        optimized: 100,
      },
      {
        year: '1-Year (Pub)',
        current: Math.round((1 - maggicResult.oneYearMortality) * 100),
        optimized: Math.round((1 - maggicResultOpt.oneYearMortality) * 100),
      },
      {
        year: '3-Year (Pub)',
        current: Math.round((1 - maggicResult.threeYearMortality) * 100),
        optimized: Math.round((1 - maggicResultOpt.threeYearMortality) * 100),
      },
    ]
  }, [maggicResult, maggicResultOpt])

  const h2fpefResult = useMemo(() => {
    return calculateH2FPEF({
      bmi: h2Bmi,
      antihypertensiveDrugs: h2Meds,
      atrialFibrillation: h2Af,
      pulmonaryArterialPressure: h2Pap,
      age: h2Age,
      echoEEPrime: h2EEPrime
    })
  }, [h2Bmi, h2Meds, h2Af, h2Pap, h2Age, h2EEPrime])

  const hfapeffResult = useMemo(() => {
    return calculateHFAPEFF({
      age: h2Age,
      sex: maggicSex,
      rhythm: connectedVisit?.rhythm || (h2Af ? 'AF' : ''),
      eEPrime: h2EEPrime,
      septalEPrime: hfaSeptalEPrime,
      lateralEPrime: hfaLateralEPrime,
      rvsp: h2Pap,
      gls: hfaGls,
      laVolumeIndex: hfaLaVolumeIndex,
      lvMassIndex: hfaLvMassIndex,
      relativeWallThickness: hfaRelativeWallThickness,
      ntProBNP: hfaNtProBNP,
      bnp: hfaBNP
    })
  }, [h2Age, maggicSex, connectedVisit, h2Af, h2EEPrime, hfaSeptalEPrime, hfaLateralEPrime, h2Pap, hfaGls, hfaLaVolumeIndex, hfaLvMassIndex, hfaRelativeWallThickness, hfaNtProBNP, hfaBNP])

  const charmResult = useMemo(() => {
    const crMgDl = crUnit === 'umol/L' ? charmCr / 88.4 : charmCr;
    return calculateCHARM({
      age: charmAge,
      nyha: charmNyha,
      lvef: charmLvef,
      creatinine: crMgDl,
      sodium: charmSodium,
      diabetes: charmDiabetes,
      copd: charmCopd,
      currentSmoker: charmSmoker
    })
  }, [charmAge, charmNyha, charmLvef, charmCr, crUnit, charmSodium, charmDiabetes, charmCopd, charmSmoker])

  const chadsResult = useMemo(() => {
    return calculateCHADSVASc({
      congestiveHF: chadsCHF,
      hypertension: chadsHTN,
      age: chadsAge,
      diabetes: chadsDiabetes,
      strokeHistory: chadsStroke,
      vascularDisease: chadsVascular,
      sex: chadsSex
    })
  }, [chadsCHF, chadsHTN, chadsAge, chadsDiabetes, chadsStroke, chadsVascular, chadsSex])

  const hasbledResult = useMemo(() => {
    return calculateHASBLED({
      hypertension: hasbledHTN,
      abnormalRenal: hasbledRenal,
      abnormalLiver: hasbledLiver,
      strokeHistory: hasbledStroke,
      bleedingHistory: hasbledBleeding,
      labileINR: hasbledLabileINR,
      age: hasbledAge,
      drugs: hasbledDrugs,
      alcohol: hasbledAlcohol
    })
  }, [hasbledHTN, hasbledRenal, hasbledLiver, hasbledStroke, hasbledBleeding, hasbledLabileINR, hasbledAge, hasbledDrugs, hasbledAlcohol])

  // MACE Risk
  const maceResult = useMemo(() => calculateMACERisk({
    killipClass: maceKillip,
    syntaxScore: maceSyntax,
    culpritVessel: maceCulprit,
    timiFlow: maceTimi,
    lvef: maceLvef,
    age: maceAge,
    diabetes: maceDiabetes,
    priorMI: macePriorMI,
    stentLength: maceStentLength,
  }), [maceKillip, maceSyntax, maceCulprit, maceTimi, maceLvef, maceAge, maceDiabetes, macePriorMI, maceStentLength])

  // Contrast Nephropathy Risk
  const cinResult = useMemo(() => calculateContrastNephropathyRisk({
    eGFR: cinEGFR,
    contrastVolumeMl: cinContrast,
    diabetes: cinDiabetes,
    nSAIDUse: cinNSAID,
    hypotension: cinHypotension,
    heartFailure: cinHF,
    age: cinAge,
    creatinine: cinCreatinine,
    iabpUse: cinIABP,
  }), [cinEGFR, cinContrast, cinDiabetes, cinNSAID, cinHypotension, cinHF, cinAge, cinCreatinine, cinIABP])

  // Readmission Risk
  const readmissionResult = useMemo(() => calculateReadmissionRisk({
    lvef: readLvef,
    age: readAge,
    liveAlone: readAlone,
    noFixedAddress: readNoAddress,
    lowHealthLiteracy: readLowLiteracy,
    betaBlockerPrescribed: readBetaBlocker,
    raasIPrescribed: readRaas,
    statinPrescribed: readStatin,
    antiplateletPrescribed: readAntiplatelet,
    followUpScheduled: readFollowUp,
    cardiacRehabilitation: readRehab,
    priorHospitalization: readPriorHosp,
    renalImpairment: readRenal,
    diabetes: readDiabetes,
    copd: readCopd,
  }), [readLvef, readAge, readAlone, readNoAddress, readLowLiteracy, readBetaBlocker, readRaas, readStatin, readAntiplatelet, readFollowUp, readRehab, readPriorHosp, readRenal, readDiabetes, readCopd])

  // ASCVD Risk
  const ascvdResult = useMemo(() => calculateASCVDRisk({
    age: ascvdAge,
    sex: ascvdSex,
    race: ascvdRace,
    totalCholesterol: ascvdTotalChol,
    hdlCholesterol: ascvdHDL,
    systolicBP: ascvdSBP,
    treatedForHTN: ascvdHTNTx,
    diabetes: ascvdDiabetes,
    currentSmoker: ascvdSmoker,
    ldlCholesterol: ascvdLDL,
  }), [ascvdAge, ascvdSex, ascvdRace, ascvdTotalChol, ascvdHDL, ascvdSBP, ascvdHTNTx, ascvdDiabetes, ascvdSmoker, ascvdLDL])

  // Save prognoses to Visit
  const handleSaveToVisit = async () => {
    if (!patientId || !visitId) return
    setSaving(true)
    try {
      await updateVisit(patientId, visitId, {
        maggicScore: maggicResult.score,
        maggicOneYearMortality: maggicResult.oneYearMortality,
        maggicThreeYearMortality: maggicResult.threeYearMortality,
        h2fpefScore: h2fpefResult.score,
        h2fpefProbability: h2fpefResult.probability,
        hfapeffScore: hfapeffResult.score,
        charmScore: charmResult.score,
        chadsvascScore: chadsResult.score,
        hasbledScore: hasbledResult.score,
      })
      toast.success('Successfully saved prognoses to visit record')
      router.push(`/patients/${patientId}?tab=overview`)
    } catch (e) {
      console.error(e)
      toast.error('Failed to save scores to visit')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 animate-fade-in text-gray-300">
      
      {/* Header */}
      <div className="flex justify-between items-start flex-wrap gap-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-violet-600/10 border border-violet-500/20 flex items-center justify-center text-violet-400 flex-shrink-0">
            <FlaskConical className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white leading-tight">Cardiovascular Risk Stratification</h2>
            <p className="text-xs text-gray-400 mt-1">
              Validated clinical calculators to estimate mortality, event rates, and diagnostic probabilities.
            </p>
          </div>
        </div>
      </div>

      {/* ── Registry & Patient Dynamic Auto-Population Console ── */}
      <div className="accent-card p-4 space-y-3 border border-blue-500/20 bg-slate-900/80 rounded-2xl shadow-xl">
        <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-blue-500/10">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Dynamic Registry & Patient Data Auto-Population
            </h3>
          </div>
          <span className="text-[11px] text-gray-400">
            Select a cohort and patient to auto-fill calculators with electronic visit records
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          {/* 1. Registry Track Selector */}
          <div className="md:col-span-4 space-y-1">
            <label className="text-[11px] font-semibold text-gray-300 flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-blue-400" /> 1. Select Registry Track
            </label>
            <div className="relative">
              <select
                value={selectedRegistry}
                onChange={(e) => {
                  setSelectedRegistry(e.target.value)
                  setSelectedPatientId('')
                  setConnectedPatient(null)
                  setConnectedVisit(null)
                }}
                className="w-full bg-slate-950 border border-blue-500/30 rounded-xl px-3 py-2 text-xs text-white font-medium focus:outline-none focus:border-blue-400 cursor-pointer shadow-inner"
              >
                <option value="hf">Heart Failure Registry (HF • {allPatients.filter(p => (p.registryId || 'hf') === 'hf').length} pts)</option>
                <option value="cad">Coronary Artery Disease & ACS (CAD)</option>
                <option value="af">Atrial Fibrillation & Arrhythmias (AF)</option>
                <option value="vhd">Valvular & Structural Heart (VHD)</option>
                <option value="all">All Registries & Cohorts ({allPatients.length} pts)</option>
              </select>
            </div>
          </div>

          {/* 2. Patient from Registry Selector */}
          <div className="md:col-span-5 space-y-1">
            <label className="text-[11px] font-semibold text-gray-300 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-cyan-400" /> 2. Select Patient from Registry
            </label>
            <div className="relative">
              <select
                value={selectedPatientId}
                onChange={(e) => handleSelectPatient(e.target.value)}
                className="w-full bg-slate-950 border border-blue-500/30 rounded-xl px-3 py-2 text-xs text-white font-medium focus:outline-none focus:border-cyan-400 cursor-pointer shadow-inner"
              >
                <option value="" className="text-gray-400">
                  — Manual Simulation Mode (Enter custom parameters) —
                </option>
                {selectablePatients.map((p) => {
                  const hidTxt = p.mrn && p.mrn !== '—' ? ` (HID: ${p.mrn})` : ' (HID: —)'
                  return (
                    <option key={p.id} value={p.id} className="text-white">
                      {p.firstName} {p.lastName}{hidTxt}
                    </option>
                  )
                })}
              </select>
            </div>
          </div>

          {/* 3. Action / Reset Controls */}
          <div className="md:col-span-3 flex items-end justify-end gap-2 pt-5 md:pt-0">
            {selectedPatientId && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleSelectPatient('')}
                className="btn-sm flex items-center gap-1 text-gray-400 hover:text-white"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Reset
              </Button>
            )}
            {connectedPatient && (
              <Button size="sm" onClick={handleSaveToVisit} loading={saving} className="btn-sm flex items-center gap-1.5">
                <Save className="w-3.5 h-3.5" /> Save to Visit
              </Button>
            )}
          </div>
        </div>

        {/* Dynamic Patient Baseline Summary Bar */}
        {connectedPatient ? (
          <div className="bg-blue-950/40 border border-blue-500/25 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="badge badge-blue text-[10px] uppercase font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Live Registry Data Loaded
                </span>
                <span className="font-bold text-white text-xs">
                  {connectedPatient.firstName} {connectedPatient.lastName}
                </span>
                <span className="text-gray-400 text-xs">
                  ({connectedPatient.sex || 'Male'}, {connectedPatient.dob ? `${Math.floor((Date.now() - new Date(connectedPatient.dob).getTime()) / (365.25 * 86400000))} yrs` : `${connectedPatient.age || '—'} yrs`})
                </span>
              </div>
              <p className="text-[11px] text-cyan-300">
                You can adjust parameters below or add missing data to compute customized risk projections.
              </p>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap text-[11px] font-mono pt-1 border-t border-blue-500/10">
              <span className="bg-slate-900/80 px-2 py-0.5 rounded border border-blue-500/15 text-gray-300">
                LVEF: <b className="text-blue-400">{maggicLvef}%</b>
              </span>
              <span className="bg-slate-900/80 px-2 py-0.5 rounded border border-blue-500/15 text-gray-300">
                SBP: <b className="text-emerald-400">{maggicSbp} mmHg</b>
              </span>
              <span className="bg-slate-900/80 px-2 py-0.5 rounded border border-blue-500/15 text-gray-300">
                Creatinine: <b className="text-amber-400">{maggicCr} {crUnit}</b>
              </span>
              <span className="bg-slate-900/80 px-2 py-0.5 rounded border border-blue-500/15 text-gray-300">
                NYHA: <b className="text-purple-400">{maggicNyha}</b>
              </span>
              <span className="bg-slate-900/80 px-2 py-0.5 rounded border border-blue-500/15 text-gray-300">
                4-Pillar GDMT: <b className="text-teal-400">{maggicBb && maggicAce ? 'Active' : 'Partial'}</b>
              </span>
              <span className="bg-slate-900/80 px-2 py-0.5 rounded border border-blue-500/15 text-gray-300">
                DM: <b className={maggicDiabetes ? 'text-rose-400' : 'text-gray-400'}>{maggicDiabetes ? 'Yes' : 'No'}</b>
              </span>
            </div>
          </div>
        ) : (
          <div className="p-2.5 rounded-xl bg-slate-950/40 border border-dashed border-gray-700/50 flex items-center justify-between text-xs text-gray-400">
            <span className="flex items-center gap-2">
              <Info className="w-4 h-4 text-blue-400 flex-shrink-0" />
              Manual Simulation Mode active: Select a patient above to pre-populate clinical variables from Firestore, or enter custom values manually.
            </span>
          </div>
        )}
      </div>

      {/* Calculator Selector Tabs */}
      <div className="flex border-b border-blue-500/10 pb-3 gap-6 flex-wrap">
        <button
          onClick={() => setActiveCalculator('maggic')}
          className={cn("text-xs font-semibold pb-2 border-b-2 px-1 transition-all",
            activeCalculator === 'maggic' ? "border-blue-500 text-white" : "border-transparent text-gray-400 hover:text-gray-200"
          )}
        >
          MAGGIC Mortality Risk
        </button>
        <button
          onClick={() => setActiveCalculator('h2fpef')}
          className={cn("text-xs font-semibold pb-2 border-b-2 px-1 transition-all",
            activeCalculator === 'h2fpef' ? "border-blue-500 text-white" : "border-transparent text-gray-400 hover:text-gray-200"
          )}
        >
          H2FPEF Diagnostic Score
        </button>
        <button
          onClick={() => setActiveCalculator('hfapeff')}
          className={cn("text-xs font-semibold pb-2 border-b-2 px-1 transition-all",
            activeCalculator === 'hfapeff' ? "border-blue-500 text-white" : "border-transparent text-gray-400 hover:text-gray-200"
          )}
        >
          HFA-PEFF Diagnostic Score
        </button>
        <button
          onClick={() => setActiveCalculator('charm')}
          className={cn("text-xs font-semibold pb-2 border-b-2 px-1 transition-all",
            activeCalculator === 'charm' ? "border-blue-500 text-white" : "border-transparent text-gray-400 hover:text-gray-200"
          )}
        >
          CHARM CV Event Rate
        </button>
        <button
          onClick={() => setActiveCalculator('chads')}
          className={cn("text-xs font-semibold pb-2 border-b-2 px-1 transition-all",
            activeCalculator === 'chads' ? "border-blue-500 text-white" : "border-transparent text-gray-400 hover:text-gray-200"
          )}
        >
          CHA₂DS₂-VASc Score
        </button>
        <button
          onClick={() => setActiveCalculator('hasbled')}
          className={cn("text-xs font-semibold pb-2 border-b-2 px-1 transition-all",
            activeCalculator === 'hasbled' ? "border-blue-500 text-white" : "border-transparent text-gray-400 hover:text-gray-200"
          )}
        >
          HAS-BLED Score
        </button>
        <button
          onClick={() => setActiveCalculator('mace')}
          className={cn("text-xs font-semibold pb-2 border-b-2 px-1 transition-all",
            activeCalculator === 'mace' ? "border-orange-500 text-white" : "border-transparent text-gray-400 hover:text-gray-200"
          )}
        >
          MACE Risk (ACS)
        </button>
        <button
          onClick={() => setActiveCalculator('cin')}
          className={cn("text-xs font-semibold pb-2 border-b-2 px-1 transition-all",
            activeCalculator === 'cin' ? "border-cyan-500 text-white" : "border-transparent text-gray-400 hover:text-gray-200"
          )}
        >
          Contrast Nephropathy
        </button>
        <button
          onClick={() => setActiveCalculator('readmission')}
          className={cn("text-xs font-semibold pb-2 border-b-2 px-1 transition-all",
            activeCalculator === 'readmission' ? "border-teal-500 text-white" : "border-transparent text-gray-400 hover:text-gray-200"
          )}
        >
          30-Day Readmission
        </button>
        <button
          onClick={() => setActiveCalculator('ascvd')}
          className={cn("text-xs font-semibold pb-2 border-b-2 px-1 transition-all",
            activeCalculator === 'ascvd' ? "border-emerald-500 text-white" : "border-transparent text-gray-400 hover:text-gray-200"
          )}
        >
          10-Yr ASCVD Risk
        </button>
      </div>

      {/* Calculator Body Split Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Side: Inputs Panel */}
        <div className="lg:col-span-7 space-y-6">
          <div className="glass-card p-5 space-y-4">
            <h3 className="text-sm font-semibold text-white pb-2 border-b border-blue-500/10 flex items-center gap-2">
              <Calculator className="w-4 h-4 text-blue-400" /> Calculator Parameters
            </h3>

            {/* MAGGIC Parameters */}
            {activeCalculator === 'maggic' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="form-label text-gray-400">Age (years)</label>
                  <input type="number" min={18} max={120} className="form-input bg-gray-900 border-blue-500/10 text-white" value={maggicAge} onChange={e => setMaggicAge(parseInt(e.target.value) || 0)} />
                </div>
                <div>
                  <label className="form-label text-gray-400">LVEF (%)</label>
                  <input type="number" min={5} max={85} className="form-input bg-gray-900 border-blue-500/10 text-white" value={maggicLvef} onChange={e => setMaggicLvef(parseInt(e.target.value) || 0)} />
                </div>
                <div>
                  <label className="form-label text-gray-400">Systolic BP (mmHg)</label>
                  <input type="number" min={50} max={250} className="form-input bg-gray-900 border-blue-500/10 text-white" value={maggicSbp} onChange={e => setMaggicSbp(parseInt(e.target.value) || 0)} />
                </div>
                <div>
                  <label className="form-label text-gray-400">BMI (kg/m²)</label>
                  <input type="number" min={10} max={60} step="0.1" className="form-input bg-gray-900 border-blue-500/10 text-white" value={maggicBmi} onChange={e => setMaggicBmi(parseFloat(e.target.value) || 0)} />
                </div>
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="form-label mb-0 text-gray-400">Creatinine</label>
                    <select value={crUnit} onChange={e => handleCrUnitChange(e.target.value as any)} className="bg-transparent text-[10px] text-blue-400 focus:outline-none cursor-pointer">
                      <option value="mg/dL">mg/dL</option>
                      <option value="umol/L">µmol/L</option>
                    </select>
                  </div>
                  <input type="number" min={crUnit === 'mg/dL' ? 0.1 : 8.8} max={crUnit === 'mg/dL' ? 20 : 1768} step={crUnit === 'mg/dL' ? '0.01' : '1'} className="form-input bg-gray-900 border-blue-500/10 text-white" value={maggicCr} onChange={e => setMaggicCr(parseFloat(e.target.value) || 0)} />
                </div>
                <div>
                  <label className="form-label text-gray-400">NYHA Class</label>
                  <select className="form-select bg-gray-900 border-blue-500/10 text-white" value={maggicNyha} onChange={e => setMaggicNyha(e.target.value as any)}>
                    <option>I</option>
                    <option>II</option>
                    <option>III</option>
                    <option>IV</option>
                  </select>
                </div>
                <div>
                  <label className="form-label text-gray-400">Sex</label>
                  <select className="form-select bg-gray-900 border-blue-500/10 text-white" value={maggicSex} onChange={e => setMaggicSex(e.target.value as any)}>
                    <option>Male</option>
                    <option>Female</option>
                  </select>
                </div>
                <div>
                  <label className="form-label text-gray-400">HF diagnosed &ge; 18 months ago?</label>
                  <select className="form-select bg-gray-900 border-blue-500/10 text-white" value={maggicHfYears} onChange={e => setMaggicHfYears(parseFloat(e.target.value) || 0)}>
                    <option value={2}>Yes (&ge; 18 months)</option>
                    <option value={0}>No (&lt; 18 months)</option>
                  </select>
                </div>
                <div className="md:col-span-2 pt-2 grid grid-cols-2 gap-3 text-white">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={maggicDiabetes} onChange={e => setMaggicDiabetes(e.target.checked)} className="w-4 h-4 rounded bg-gray-900 border-blue-500/10" />
                    <span>Diabetes Mellitus</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={maggicSmoker} onChange={e => setMaggicSmoker(e.target.checked)} className="w-4 h-4 rounded bg-gray-900 border-blue-500/10" />
                    <span>Current Smoker</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={maggicCopd} onChange={e => setMaggicCopd(e.target.checked)} className="w-4 h-4 rounded bg-gray-900 border-blue-500/10" />
                    <span>COPD</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={maggicBb} onChange={e => setMaggicBb(e.target.checked)} className="w-4 h-4 rounded bg-gray-900 border-blue-500/10" />
                    <span>Prescribed Beta-Blocker</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={maggicAce} onChange={e => setMaggicAce(e.target.checked)} className="w-4 h-4 rounded bg-gray-900 border-blue-500/10" />
                    <span>Prescribed ACEi/ARB</span>
                  </label>
                </div>
              </div>
            )}

            {/* H2FPEF Parameters */}
            {activeCalculator === 'h2fpef' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="form-label text-gray-400">Age (years)</label>
                  <input type="number" min={18} max={120} className="form-input bg-gray-900 border-blue-500/10 text-white" value={h2Age} onChange={e => setH2Age(parseInt(e.target.value) || 0)} />
                </div>
                <div>
                  <label className="form-label text-gray-400">BMI (kg/m²)</label>
                  <input type="number" min={10} max={60} step="0.1" className="form-input bg-gray-900 border-blue-500/10 text-white" value={h2Bmi} onChange={e => setH2Bmi(parseFloat(e.target.value) || 0)} />
                </div>
                <div>
                  <label className="form-label text-gray-400">Antihypertensive Drugs Count</label>
                  <input type="number" min={0} max={10} className="form-input bg-gray-900 border-blue-500/10 text-white" value={h2Meds} onChange={e => setH2Meds(parseInt(e.target.value) || 0)} />
                </div>
                <div>
                  <label className="form-label text-gray-400">Pulmonary Arterial Pressure (mmHg)</label>
                  <input type="number" min={10} max={120} className="form-input bg-gray-900 border-blue-500/10 text-white" value={h2Pap} onChange={e => setH2Pap(parseInt(e.target.value) || 0)} />
                </div>
                <div>
                  <label className="form-label text-gray-400">Echo E/e' Ratio</label>
                  <input type="number" min={1} max={40} step="0.1" className="form-input bg-gray-900 border-blue-500/10 text-white" value={h2EEPrime} onChange={e => setH2EEPrime(parseFloat(e.target.value) || 0)} />
                </div>
                <div>
                  <label className="form-label text-gray-400">Atrial Fibrillation Status</label>
                  <select className="form-select bg-gray-900 border-blue-500/10 text-white" value={h2Af ? 'Yes' : 'No'} onChange={e => setH2Af(e.target.value === 'Yes')}>
                    <option>Yes</option>
                    <option>No</option>
                  </select>
                </div>
              </div>
            )}

            {/* HFA-PEFF Parameters */}
            {activeCalculator === 'hfapeff' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="form-label text-gray-400">Age (years)</label>
                  <input type="number" min={18} max={120} className="form-input bg-gray-900 border-blue-500/10 text-white" value={h2Age} onChange={e => setH2Age(parseInt(e.target.value) || 0)} />
                </div>
                <div>
                  <label className="form-label text-gray-400">Sex</label>
                  <select className="form-select bg-gray-900 border-blue-500/10 text-white" value={maggicSex} onChange={e => setMaggicSex(e.target.value as any)}>
                    <option>Male</option>
                    <option>Female</option>
                  </select>
                </div>
                <div>
                  <label className="form-label text-gray-400">Atrial Fibrillation Status</label>
                  <select className="form-select bg-gray-900 border-blue-500/10 text-white" value={h2Af ? 'Yes' : 'No'} onChange={e => setH2Af(e.target.value === 'Yes')}>
                    <option>Yes</option>
                    <option>No</option>
                  </select>
                </div>
                <div>
                  <label className="form-label text-gray-400">Average Echo E/e' Ratio</label>
                  <input type="number" min={1} max={40} step="0.1" className="form-input bg-gray-900 border-blue-500/10 text-white" value={h2EEPrime} onChange={e => setH2EEPrime(parseFloat(e.target.value) || 0)} />
                </div>
                <div>
                  <label className="form-label text-gray-400">Septal E' Velocity (cm/s)</label>
                  <input type="number" min={1} max={25} step="0.1" className="form-input bg-gray-900 border-blue-500/10 text-white" value={hfaSeptalEPrime} onChange={e => setHfaSeptalEPrime(parseFloat(e.target.value) || 0)} />
                </div>
                <div>
                  <label className="form-label text-gray-400">Lateral E' Velocity (cm/s)</label>
                  <input type="number" min={1} max={25} step="0.1" className="form-input bg-gray-900 border-blue-500/10 text-white" value={hfaLateralEPrime} onChange={e => setHfaLateralEPrime(parseFloat(e.target.value) || 0)} />
                </div>
                <div>
                  <label className="form-label text-gray-400">Pulmonary Arterial Pressure (RVSP, mmHg)</label>
                  <input type="number" min={10} max={120} className="form-input bg-gray-900 border-blue-500/10 text-white" value={h2Pap} onChange={e => setH2Pap(parseInt(e.target.value) || 0)} />
                </div>
                <div>
                  <label className="form-label text-gray-400">Global Longitudinal Strain (GLS, %)</label>
                  <input type="number" min={-30} max={0} step="0.1" className="form-input bg-gray-900 border-blue-500/10 text-white" value={hfaGls} onChange={e => setHfaGls(parseFloat(e.target.value) || 0)} />
                </div>
                <div>
                  <label className="form-label text-gray-400">LA Volume Index (LAVI, ml/m²)</label>
                  <input type="number" min={10} max={80} step="0.1" className="form-input bg-gray-900 border-blue-500/10 text-white" value={hfaLaVolumeIndex} onChange={e => setHfaLaVolumeIndex(parseFloat(e.target.value) || 0)} />
                </div>
                <div>
                  <label className="form-label text-gray-400">LV Mass Index (LVMI, g/m²)</label>
                  <input type="number" min={30} max={250} step="0.1" className="form-input bg-gray-900 border-blue-500/10 text-white" value={hfaLvMassIndex} onChange={e => setHfaLvMassIndex(parseFloat(e.target.value) || 0)} />
                </div>
                <div>
                  <label className="form-label text-gray-400">Relative Wall Thickness (RWT)</label>
                  <input type="number" min={0.1} max={0.8} step="0.01" className="form-input bg-gray-900 border-blue-500/10 text-white" value={hfaRelativeWallThickness} onChange={e => setHfaRelativeWallThickness(parseFloat(e.target.value) || 0)} />
                </div>
                <div>
                  <label className="form-label text-gray-400">NT-proBNP (pg/mL)</label>
                  <input type="number" min={0} max={35000} className="form-input bg-gray-900 border-blue-500/10 text-white" value={hfaNtProBNP} onChange={e => setHfaNtProBNP(parseInt(e.target.value) || 0)} />
                </div>
                <div>
                  <label className="form-label text-gray-400">BNP (pg/mL)</label>
                  <input type="number" min={0} max={5000} className="form-input bg-gray-900 border-blue-500/10 text-white" value={hfaBNP} onChange={e => setHfaBNP(parseInt(e.target.value) || 0)} />
                </div>
              </div>
            )}

            {/* CHARM Parameters */}
            {activeCalculator === 'charm' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="form-label text-gray-400">Age (years)</label>
                  <input type="number" min={18} max={120} className="form-input bg-gray-900 border-blue-500/10 text-white" value={charmAge} onChange={e => setCharmAge(parseInt(e.target.value) || 0)} />
                </div>
                <div>
                  <label className="form-label text-gray-400">LVEF (%)</label>
                  <input type="number" min={5} max={85} className="form-input bg-gray-900 border-blue-500/10 text-white" value={charmLvef} onChange={e => setCharmLvef(parseInt(e.target.value) || 0)} />
                </div>
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="form-label mb-0 text-gray-400">Creatinine</label>
                    <select value={crUnit} onChange={e => handleCrUnitChange(e.target.value as any)} className="bg-transparent text-[10px] text-blue-400 focus:outline-none cursor-pointer">
                      <option value="mg/dL">mg/dL</option>
                      <option value="umol/L">µmol/L</option>
                    </select>
                  </div>
                  <input type="number" min={crUnit === 'mg/dL' ? 0.1 : 8.8} max={crUnit === 'mg/dL' ? 20 : 1768} step={crUnit === 'mg/dL' ? '0.01' : '1'} className="form-input bg-gray-900 border-blue-500/10 text-white" value={charmCr} onChange={e => setCharmCr(parseFloat(e.target.value) || 0)} />
                </div>
                <div>
                  <label className="form-label text-gray-400">Serum Sodium (mmol/L)</label>
                  <input type="number" min={100} max={170} className="form-input bg-gray-900 border-blue-500/10 text-white" value={charmSodium} onChange={e => setCharmSodium(parseInt(e.target.value) || 0)} />
                </div>
                <div>
                  <label className="form-label text-gray-400">NYHA Class</label>
                  <select className="form-select bg-gray-900 border-blue-500/10 text-white" value={charmNyha} onChange={e => setCharmNyha(e.target.value as any)}>
                    <option>I</option>
                    <option>II</option>
                    <option>III</option>
                    <option>IV</option>
                  </select>
                </div>
                <div className="md:col-span-2 pt-2 grid grid-cols-2 gap-3 text-white">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={charmDiabetes} onChange={e => setCharmDiabetes(e.target.checked)} className="w-4 h-4 rounded bg-gray-900 border-blue-500/10" />
                    <span>Diabetes Mellitus</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={charmSmoker} onChange={e => setCharmSmoker(e.target.checked)} className="w-4 h-4 rounded bg-gray-900 border-blue-500/10" />
                    <span>Current Smoker</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={charmCopd} onChange={e => setCharmCopd(e.target.checked)} className="w-4 h-4 rounded bg-gray-900 border-blue-500/10" />
                    <span>COPD</span>
                  </label>
                </div>
              </div>
            )}

            {/* CHA2DS2-VASc Parameters */}
            {activeCalculator === 'chads' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="form-label text-gray-400">Age (years)</label>
                  <input type="number" min={18} max={120} className="form-input bg-gray-900 border-blue-500/10 text-white" value={chadsAge} onChange={e => setChadsAge(parseInt(e.target.value) || 0)} />
                </div>
                <div>
                  <label className="form-label text-gray-400">Sex Category</label>
                  <select className="form-select bg-gray-900 border-blue-500/10 text-white" value={chadsSex} onChange={e => setChadsSex(e.target.value as any)}>
                    <option>Male</option>
                    <option>Female</option>
                  </select>
                </div>
                <div className="md:col-span-2 pt-2 space-y-2 text-white">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={chadsCHF} onChange={e => setChadsCHF(e.target.checked)} className="w-4 h-4 rounded bg-gray-900 border-blue-500/10" />
                    <span>Congestive Heart Failure / LV Dysfunction (+1)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={chadsHTN} onChange={e => setChadsHTN(e.target.checked)} className="w-4 h-4 rounded bg-gray-900 border-blue-500/10" />
                    <span>Hypertension (+1)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={chadsDiabetes} onChange={e => setChadsDiabetes(e.target.checked)} className="w-4 h-4 rounded bg-gray-900 border-blue-500/10" />
                    <span>Diabetes Mellitus (+1)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={chadsStroke} onChange={e => setChadsStroke(e.target.checked)} className="w-4 h-4 rounded bg-gray-900 border-blue-500/10" />
                    <span>Stroke / TIA / Thromboembolism history (+2)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={chadsVascular} onChange={e => setChadsVascular(e.target.checked)} className="w-4 h-4 rounded bg-gray-900 border-blue-500/10" />
                    <span>Vascular Disease (prior MI, PAD, aortic plaque) (+1)</span>
                  </label>
                </div>
              </div>
            )}

            {/* MACE Risk Parameters */}
            {activeCalculator === 'mace' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="form-label text-gray-400">Age (years)</label>
                  <input type="number" min={18} max={100} className="form-input bg-gray-900 border-blue-500/10 text-white" value={maceAge} onChange={e => setMaceAge(parseInt(e.target.value) || 0)} />
                </div>
                <div>
                  <label className="form-label text-gray-400">LVEF (%)</label>
                  <input type="number" min={5} max={85} className="form-input bg-gray-900 border-blue-500/10 text-white" value={maceLvef} onChange={e => setMaceLvef(parseInt(e.target.value) || 0)} />
                </div>
                <div>
                  <label className="form-label text-gray-400">Killip Class</label>
                  <select className="form-select bg-gray-900 border-blue-500/10 text-white" value={maceKillip} onChange={e => setMaceKillip(e.target.value as KillipClass)}>
                    <option value="I">Class I — No HF signs</option>
                    <option value="II">Class II — Rales/S3 gallop</option>
                    <option value="III">Class III — Pulmonary oedema</option>
                    <option value="IV">Class IV — Cardiogenic shock</option>
                  </select>
                </div>
                <div>
                  <label className="form-label text-gray-400">SYNTAX Score</label>
                  <input type="number" min={0} max={60} className="form-input bg-gray-900 border-blue-500/10 text-white" value={maceSyntax} onChange={e => setMaceSyntax(parseInt(e.target.value) || 0)} />
                </div>
                <div>
                  <label className="form-label text-gray-400">Culprit Vessel</label>
                  <select className="form-select bg-gray-900 border-blue-500/10 text-white" value={maceCulprit} onChange={e => setMaceCulprit(e.target.value as CulpritVessel)}>
                    <option value="LAD">LAD (Left Anterior Descending)</option>
                    <option value="LCX">LCX (Left Circumflex)</option>
                    <option value="RCA">RCA (Right Coronary Artery)</option>
                    <option value="LM">LM (Left Main)</option>
                    <option value="Graft">Bypass Graft</option>
                  </select>
                </div>
                <div>
                  <label className="form-label text-gray-400">Post-PCI TIMI Flow</label>
                  <select className="form-select bg-gray-900 border-blue-500/10 text-white" value={maceTimi} onChange={e => setMaceTimi(e.target.value as TIMIFlow)}>
                    <option value="3">TIMI 3 — Full perfusion</option>
                    <option value="2">TIMI 2 — Partial/slow</option>
                    <option value="1">TIMI 1 — Minimal</option>
                    <option value="0">TIMI 0 — No flow</option>
                  </select>
                </div>
                <div>
                  <label className="form-label text-gray-400">Total Stent Length (mm)</label>
                  <input type="number" min={0} max={200} className="form-input bg-gray-900 border-blue-500/10 text-white" value={maceStentLength} onChange={e => setMaceStentLength(parseInt(e.target.value) || 0)} />
                </div>
                <div className="md:col-span-2 pt-2 grid grid-cols-2 gap-3 text-white">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={maceDiabetes} onChange={e => setMaceDiabetes(e.target.checked)} className="w-4 h-4 rounded" />
                    <span>Diabetes Mellitus</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={macePriorMI} onChange={e => setMacePriorMI(e.target.checked)} className="w-4 h-4 rounded" />
                    <span>Prior MI</span>
                  </label>
                </div>
              </div>
            )}

            {/* Contrast Nephropathy Parameters */}
            {activeCalculator === 'cin' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="form-label text-gray-400">eGFR (mL/min/1.73m²)</label>
                  <input type="number" min={1} max={130} className="form-input bg-gray-900 border-blue-500/10 text-white" value={cinEGFR} onChange={e => setCinEGFR(parseInt(e.target.value) || 0)} />
                </div>
                <div>
                  <label className="form-label text-gray-400">Planned Contrast Volume (mL)</label>
                  <input type="number" min={10} max={600} className="form-input bg-gray-900 border-blue-500/10 text-white" value={cinContrast} onChange={e => setCinContrast(parseInt(e.target.value) || 0)} />
                </div>
                <div>
                  <label className="form-label text-gray-400">Age (years)</label>
                  <input type="number" min={18} max={100} className="form-input bg-gray-900 border-blue-500/10 text-white" value={cinAge} onChange={e => setCinAge(parseInt(e.target.value) || 0)} />
                </div>
                <div>
                  <label className="form-label text-gray-400">Serum Creatinine (mg/dL)</label>
                  <input type="number" min={0.1} max={20} step="0.1" className="form-input bg-gray-900 border-blue-500/10 text-white" value={cinCreatinine} onChange={e => setCinCreatinine(parseFloat(e.target.value) || 0)} />
                </div>
                <div className="md:col-span-2 pt-2 grid grid-cols-2 gap-3 text-white">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={cinDiabetes} onChange={e => setCinDiabetes(e.target.checked)} className="w-4 h-4 rounded" />
                    <span>Diabetes Mellitus</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={cinNSAID} onChange={e => setCinNSAID(e.target.checked)} className="w-4 h-4 rounded" />
                    <span>NSAID Use</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={cinHypotension} onChange={e => setCinHypotension(e.target.checked)} className="w-4 h-4 rounded" />
                    <span>Peri-procedural Hypotension (SBP &lt;80)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={cinHF} onChange={e => setCinHF(e.target.checked)} className="w-4 h-4 rounded" />
                    <span>Heart Failure (NYHA III-IV / LVEF &lt;40%)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={cinIABP} onChange={e => setCinIABP(e.target.checked)} className="w-4 h-4 rounded" />
                    <span>IABP Use</span>
                  </label>
                </div>
              </div>
            )}

            {/* Readmission Risk Parameters */}
            {activeCalculator === 'readmission' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="form-label text-gray-400">LVEF (%) post-MI</label>
                  <input type="number" min={5} max={85} className="form-input bg-gray-900 border-blue-500/10 text-white" value={readLvef} onChange={e => setReadLvef(parseInt(e.target.value) || 0)} />
                </div>
                <div>
                  <label className="form-label text-gray-400">Age (years)</label>
                  <input type="number" min={18} max={100} className="form-input bg-gray-900 border-blue-500/10 text-white" value={readAge} onChange={e => setReadAge(parseInt(e.target.value) || 0)} />
                </div>
                <div className="md:col-span-2 pt-1">
                  <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-2">Social Determinants</p>
                  <div className="grid grid-cols-2 gap-3 text-white">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={readAlone} onChange={e => setReadAlone(e.target.checked)} className="w-4 h-4 rounded" />
                      <span>Lives Alone (social isolation)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={readNoAddress} onChange={e => setReadNoAddress(e.target.checked)} className="w-4 h-4 rounded" />
                      <span>No Fixed Address</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={readLowLiteracy} onChange={e => setReadLowLiteracy(e.target.checked)} className="w-4 h-4 rounded" />
                      <span>Low Health Literacy</span>
                    </label>
                  </div>
                </div>
                <div className="md:col-span-2">
                  <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-2">Discharge Medications (tick if prescribed)</p>
                  <div className="grid grid-cols-2 gap-3 text-white">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={readBetaBlocker} onChange={e => setReadBetaBlocker(e.target.checked)} className="w-4 h-4 rounded" />
                      <span>Beta-Blocker prescribed</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={readRaas} onChange={e => setReadRaas(e.target.checked)} className="w-4 h-4 rounded" />
                      <span>ACEi/ARB/ARNI prescribed</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={readStatin} onChange={e => setReadStatin(e.target.checked)} className="w-4 h-4 rounded" />
                      <span>Statin prescribed</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={readAntiplatelet} onChange={e => setReadAntiplatelet(e.target.checked)} className="w-4 h-4 rounded" />
                      <span>Antiplatelet prescribed</span>
                    </label>
                  </div>
                </div>
                <div className="md:col-span-2">
                  <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-2">Follow-Up &amp; Comorbidities</p>
                  <div className="grid grid-cols-2 gap-3 text-white">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={readFollowUp} onChange={e => setReadFollowUp(e.target.checked)} className="w-4 h-4 rounded" />
                      <span>Follow-up appointment scheduled</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={readRehab} onChange={e => setReadRehab(e.target.checked)} className="w-4 h-4 rounded" />
                      <span>Cardiac Rehab referred</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={readPriorHosp} onChange={e => setReadPriorHosp(e.target.checked)} className="w-4 h-4 rounded" />
                      <span>Prior hospitalization (&lt;6 months)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={readRenal} onChange={e => setReadRenal(e.target.checked)} className="w-4 h-4 rounded" />
                      <span>Renal impairment (eGFR &lt;60)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={readDiabetes} onChange={e => setReadDiabetes(e.target.checked)} className="w-4 h-4 rounded" />
                      <span>Diabetes Mellitus</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={readCopd} onChange={e => setReadCopd(e.target.checked)} className="w-4 h-4 rounded" />
                      <span>COPD</span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* ASCVD Risk Parameters */}
            {activeCalculator === 'ascvd' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="form-label text-gray-400">Age (years)</label>
                  <input type="number" min={40} max={79} className="form-input bg-gray-900 border-blue-500/10 text-white" value={ascvdAge} onChange={e => setAscvdAge(parseInt(e.target.value) || 0)} />
                </div>
                <div>
                  <label className="form-label text-gray-400">Sex</label>
                  <select className="form-select bg-gray-900 border-blue-500/10 text-white" value={ascvdSex} onChange={e => setAscvdSex(e.target.value as 'Male' | 'Female')}>
                    <option>Male</option>
                    <option>Female</option>
                  </select>
                </div>
                <div>
                  <label className="form-label text-gray-400">Race</label>
                  <select className="form-select bg-gray-900 border-blue-500/10 text-white" value={ascvdRace} onChange={e => setAscvdRace(e.target.value as ASCVDRace)}>
                    <option value="White">White / Other</option>
                    <option value="African American">African American</option>
                  </select>
                </div>
                <div>
                  <label className="form-label text-gray-400">Total Cholesterol (mg/dL)</label>
                  <input type="number" min={100} max={400} className="form-input bg-gray-900 border-blue-500/10 text-white" value={ascvdTotalChol} onChange={e => setAscvdTotalChol(parseInt(e.target.value) || 0)} />
                </div>
                <div>
                  <label className="form-label text-gray-400">HDL Cholesterol (mg/dL)</label>
                  <input type="number" min={20} max={120} className="form-input bg-gray-900 border-blue-500/10 text-white" value={ascvdHDL} onChange={e => setAscvdHDL(parseInt(e.target.value) || 0)} />
                </div>
                <div>
                  <label className="form-label text-gray-400">LDL Cholesterol (mg/dL)</label>
                  <input type="number" min={30} max={300} className="form-input bg-gray-900 border-blue-500/10 text-white" value={ascvdLDL} onChange={e => setAscvdLDL(parseInt(e.target.value) || 0)} />
                </div>
                <div>
                  <label className="form-label text-gray-400">Systolic BP (mmHg)</label>
                  <input type="number" min={90} max={220} className="form-input bg-gray-900 border-blue-500/10 text-white" value={ascvdSBP} onChange={e => setAscvdSBP(parseInt(e.target.value) || 0)} />
                </div>
                <div className="md:col-span-2 pt-2 grid grid-cols-2 gap-3 text-white">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={ascvdHTNTx} onChange={e => setAscvdHTNTx(e.target.checked)} className="w-4 h-4 rounded" />
                    <span>On Blood Pressure Treatment</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={ascvdDiabetes} onChange={e => setAscvdDiabetes(e.target.checked)} className="w-4 h-4 rounded" />
                    <span>Diabetes Mellitus</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={ascvdSmoker} onChange={e => setAscvdSmoker(e.target.checked)} className="w-4 h-4 rounded" />
                    <span>Current Smoker</span>
                  </label>
                </div>
              </div>
            )}

            {/* HAS-BLED Parameters */}
            {activeCalculator === 'hasbled' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="form-label text-gray-400">Age (years)</label>
                  <input type="number" min={18} max={120} className="form-input bg-gray-900 border-blue-500/10 text-white" value={hasbledAge} onChange={e => setHasbledAge(parseInt(e.target.value) || 0)} />
                </div>
                <div className="md:col-span-2 pt-2 space-y-2 text-white">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={hasbledHTN} onChange={e => setHasbledHTN(e.target.checked)} className="w-4 h-4 rounded bg-gray-900 border-blue-500/10" />
                    <span>Hypertension (SBP &gt; 160 mmHg) (+1)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={hasbledRenal} onChange={e => setHasbledRenal(e.target.checked)} className="w-4 h-4 rounded bg-gray-900 border-blue-500/10" />
                    <span>Abnormal Renal Function (Cr &gt; 2.26 mg/dL, dialysis, transplant) (+1)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={hasbledLiver} onChange={e => setHasbledLiver(e.target.checked)} className="w-4 h-4 rounded bg-gray-900 border-blue-500/10" />
                    <span>Abnormal Liver Function (cirrhosis, LFTs &gt; 3x normal) (+1)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={hasbledStroke} onChange={e => setHasbledStroke(e.target.checked)} className="w-4 h-4 rounded bg-gray-900 border-blue-500/10" />
                    <span>Stroke / TIA History (+1)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={hasbledBleeding} onChange={e => setHasbledBleeding(e.target.checked)} className="w-4 h-4 rounded bg-gray-900 border-blue-500/10" />
                    <span>Prior Major Bleed or Bleeding Predisposition/Anemia (+1)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={hasbledLabileINR} onChange={e => setHasbledLabileINR(e.target.checked)} className="w-4 h-4 rounded bg-gray-900 border-blue-500/10" />
                    <span>Labile INRs / Unstable Time in Therapeutic Range &lt; 60% (+1)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={hasbledDrugs} onChange={e => setHasbledDrugs(e.target.checked)} className="w-4 h-4 rounded bg-gray-900 border-blue-500/10" />
                    <span>Antiplatelet drug use (e.g. Aspirin) or NSAIDs (+1)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={hasbledAlcohol} onChange={e => setHasbledAlcohol(e.target.checked)} className="w-4 h-4 rounded bg-gray-900 border-blue-500/10" />
                    <span>Excess Alcohol consumption (&ge; 8 drinks/week) (+1)</span>
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Right Side: Risk Visualization Charts / Result Panel */}
        <div className="lg:col-span-5 space-y-6">
          <div className="glass-card p-5 space-y-5 border border-blue-500/10 animate-fade-in">
            <h3 className="text-sm font-semibold text-white pb-2 border-b border-blue-500/10 flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" /> Stratification Results
            </h3>

            {/* MAGGIC Render Result */}
            {activeCalculator === 'maggic' && (
              <div className="space-y-5">
                <div className="flex justify-between items-center bg-blue-500/5 p-4 rounded-xl border border-blue-500/10">
                  <div>
                    <p className="text-[10px] uppercase text-gray-400">MAGGIC Point Score</p>
                    <p className="text-3xl font-extrabold text-white mt-1">{maggicResult.score}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] uppercase text-gray-400">Risk Class</p>
                    <span className={cn(
                      "badge mt-1 text-[11px]",
                      maggicResult.riskCategory === 'Low' && 'badge-green',
                      maggicResult.riskCategory === 'Intermediate' && 'badge-amber',
                      maggicResult.riskCategory === 'High' && 'badge-red'
                    )}>
                      {maggicResult.riskCategory} Risk
                    </span>
                  </div>
                </div>

                {/* Graph bars representation of mortality */}
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-semibold text-white">Estimated Survival Curve Projection (Kaplan-Meier)</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">Based on MAGGIC baseline score vs Guideline-Directed Target (GDMT)</p>
                  </div>

                  <div className="h-56 w-full bg-slate-950/20 p-2 rounded-lg border border-blue-500/5">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={survivalCurveData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis dataKey="year" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} width={40} unit="%" />
                        <Tooltip content={<CustomSurvivalTooltip />} />
                        <Legend wrapperStyle={{ fontSize: 10, paddingTop: 10 }} />
                        <Line type="monotone" dataKey="current" name="Current Regimen" stroke="#a78bfa" strokeWidth={2.5} dot={{ r: 3, strokeWidth: 0, fill: '#a78bfa' }} activeDot={{ r: 5 }} />
                        <Line type="monotone" dataKey="optimized" name="Optimized GDMT Regimen" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3, strokeWidth: 0, fill: '#10b981' }} activeDot={{ r: 5 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-center text-xs border-t border-blue-500/5 pt-3">
                    <div className="bg-slate-900/40 p-2 rounded border border-gray-800/40">
                      <p className="text-[10px] text-gray-400">Current 3-Yr Mortality</p>
                      <p className="text-sm font-bold text-violet-400">{(maggicResult.threeYearMortality * 100).toFixed(1)}%</p>
                    </div>
                    <div className="bg-slate-900/40 p-2 rounded border border-gray-800/40">
                      <p className="text-[10px] text-gray-400">Optimized 3-Yr Mortality</p>
                      <p className="text-sm font-bold text-emerald-400">{(maggicResultOpt.threeYearMortality * 100).toFixed(1)}%</p>
                    </div>
                  </div>

                  <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-[11px] text-amber-200 space-y-1">
                    <p className="font-bold flex items-center gap-1.5 text-amber-300">
                      <ShieldCheck className="w-3.5 h-3.5 text-amber-400" /> Research Reference (Uncalibrated in India)
                    </p>
                    <p className="text-gray-300 leading-normal">
                      The MAGGIC model reflects historic Western trial cohorts (Pocock et al. 2013). This model has not undergone external prospective calibration in Indian ADHF or chronic HF cohorts, and only validates 1-year and 3-year endpoints. Mathematical 5-year extrapolations are unvalidated and excluded.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* H2FPEF Render Result */}
            {activeCalculator === 'h2fpef' && (
              <div className="space-y-5">
                <div className="flex justify-between items-center bg-blue-500/5 p-4 rounded-xl border border-blue-500/10">
                  <div>
                    <p className="text-[10px] uppercase text-gray-400">H2FPEF Point Score</p>
                    <p className="text-3xl font-extrabold text-white mt-1">{h2fpefResult.score} <span className="text-sm font-normal text-gray-400">/ 9</span></p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] uppercase text-gray-400">Probability</p>
                    <span className="badge badge-violet mt-1 text-[11px]">
                      {(h2fpefResult.probability * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-xs font-semibold text-white">Diagnostic Probability Gauge</p>
                  <div className="progress-track">
                    <div className="progress-fill bg-gradient-to-r from-blue-500 to-violet-500" style={{ width: `${h2fpefResult.probability * 100}%` }} />
                  </div>
                </div>

                <div className="alert-strip info text-xs mt-3 leading-relaxed bg-blue-500/10 border-blue-500/20 text-blue-300">
                  {h2fpefResult.interpretation}
                </div>
              </div>
            )}

            {/* HFA-PEFF Render Result */}
            {activeCalculator === 'hfapeff' && (
              <div className="space-y-5 animate-fade-in">
                <div className="flex justify-between items-center bg-blue-500/5 p-4 rounded-xl border border-blue-500/10">
                  <div>
                    <p className="text-[10px] uppercase text-gray-400">HFA-PEFF Point Score</p>
                    <p className="text-3xl font-extrabold text-white mt-1">{hfapeffResult.score} <span className="text-sm font-normal text-gray-400">/ 6</span></p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] uppercase text-gray-400">Echocardiographic & Biomarker Domain</p>
                    <span className="badge badge-blue mt-1 text-[11px]">
                      {hfapeffResult.score >= 5 ? 'High (Rule In)' : hfapeffResult.score <= 1 ? 'Low (Rule Out)' : 'Intermediate (Step 3)'}
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-slate-900/60 rounded-xl border border-blue-500/10 text-xs space-y-1.5 text-gray-300">
                  <div className="flex justify-between py-0.5">
                    <span>Functional Domain (E/e', e', GLS, RVSP)</span>
                    <span className="font-bold text-white">{hfapeffResult.functionalPoints} / 2 pts</span>
                  </div>
                  <div className="flex justify-between py-0.5">
                    <span>Morphological Domain (LAVI, LVMI, RWT)</span>
                    <span className="font-bold text-white">{hfapeffResult.morphologicalPoints} / 2 pts</span>
                  </div>
                  <div className="flex justify-between py-0.5">
                    <span>Biomarker Domain (NT-proBNP / BNP)</span>
                    <span className="font-bold text-white">{hfapeffResult.biomarkerPoints} / 2 pts</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-xs font-semibold text-white">Diagnostic Probability Gauge</p>
                  <div className="progress-track">
                    <div className="progress-fill bg-gradient-to-r from-blue-500 to-violet-500" style={{ width: `${(hfapeffResult.score / 6) * 100}%` }} />
                  </div>
                </div>

                <div className="alert-strip info text-xs mt-3 leading-relaxed bg-blue-500/10 border-blue-500/20 text-blue-300">
                  {hfapeffResult.interpretation}
                </div>
              </div>
            )}

            {/* CHARM Render Result */}
            {activeCalculator === 'charm' && (
              <div className="space-y-5">
                <div className="flex justify-between items-center bg-blue-500/5 p-4 rounded-xl border border-blue-500/10">
                  <div>
                    <p className="text-[10px] uppercase text-gray-400">CHARM Score Points</p>
                    <p className="text-3xl font-extrabold text-white mt-1">{charmResult.score}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] uppercase text-gray-400">Risk Group</p>
                    <span className={cn(
                      "badge mt-1 text-[11px]",
                      charmResult.category === 'Low' && 'badge-green',
                      charmResult.category === 'Medium' && 'badge-amber',
                      charmResult.category === 'High' && 'badge-red'
                    )}>
                      {charmResult.category}
                    </span>
                  </div>
                </div>

                <div className="space-y-3.5">
                  <p className="text-xs font-semibold text-white">1-Year CV Death / HF Hospitalization</p>
                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>Estimated Event Rate</span>
                    <span className="font-semibold text-white">{(charmResult.estimatedOneYearEventRate * 100).toFixed(0)}%</span>
                  </div>
                  <div className="progress-track">
                    <div className="progress-fill bg-rose-500" style={{ width: `${charmResult.estimatedOneYearEventRate * 100}%` }} />
                  </div>
                </div>

                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-[11px] text-amber-200 space-y-1">
                  <p className="font-bold flex items-center gap-1.5 text-amber-300">
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-400" /> Research Reference (Uncalibrated in India)
                  </p>
                  <p className="text-gray-300 leading-normal">
                    {charmResult.validationDisclaimer}
                  </p>
                </div>
              </div>
            )}

            {/* CHA2DS2-VASc Render Result */}
            {activeCalculator === 'chads' && (
              <div className="space-y-5 animate-fade-in">
                <div className="flex justify-between items-center bg-blue-500/5 p-4 rounded-xl border border-blue-500/10">
                  <div>
                    <p className="text-[10px] uppercase text-gray-400">CHA₂DS₂-VASc Score</p>
                    <p className="text-3xl font-extrabold text-white mt-1">{chadsResult.score} <span className="text-sm font-normal text-gray-400">/ 9</span></p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] uppercase text-gray-400">Risk Category</p>
                    <span className={cn(
                      "badge mt-1 text-[11px]",
                      chadsResult.riskCategory === 'Low' && 'badge-green',
                      chadsResult.riskCategory === 'Moderate' && 'badge-amber',
                      chadsResult.riskCategory === 'High' && 'badge-red'
                    )}>
                      {chadsResult.riskCategory} Risk
                    </span>
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-xs font-semibold text-white">Score Point Gauge</p>
                  <div className="progress-track">
                    <div className="progress-fill bg-gradient-to-r from-blue-500 to-rose-500" style={{ width: `${(chadsResult.score / 9) * 100}%` }} />
                  </div>
                </div>

                <div className="alert-strip info text-xs mt-3 leading-relaxed bg-blue-500/10 border-blue-500/20 text-blue-300">
                  {chadsResult.recommendation}
                </div>
              </div>
            )}

            {/* HAS-BLED Render Result */}
            {activeCalculator === 'hasbled' && (
              <div className="space-y-5 animate-fade-in">
                <div className="flex justify-between items-center bg-blue-500/5 p-4 rounded-xl border border-blue-500/10">
                  <div>
                    <p className="text-[10px] uppercase text-gray-400">HAS-BLED Point Score</p>
                    <p className="text-3xl font-extrabold text-white mt-1">{hasbledResult.score} <span className="text-sm font-normal text-gray-400">/ 9</span></p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] uppercase text-gray-400">Bleeding Risk</p>
                    <span className={cn(
                      "badge mt-1 text-[11px]",
                      hasbledResult.riskCategory === 'Low-Moderate' && 'badge-green',
                      hasbledResult.riskCategory === 'High' && 'badge-red'
                    )}>
                      {hasbledResult.riskCategory} Risk
                    </span>
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-xs font-semibold text-white">Bleeding Risk Gauge</p>
                  <div className="progress-track">
                    <div className="progress-fill bg-gradient-to-r from-emerald-500 to-rose-500" style={{ width: `${(hasbledResult.score / 9) * 100}%` }} />
                  </div>
                </div>

                <div className="alert-strip info text-xs mt-3 leading-relaxed bg-blue-500/10 border-blue-500/20 text-blue-300">
                  {hasbledResult.recommendation}
                </div>
              </div>
            )}

            {/* MACE Risk Result */}
            {activeCalculator === 'mace' && (
              <div className="space-y-5 animate-fade-in">
                <div className="flex justify-between items-center bg-orange-500/5 p-4 rounded-xl border border-orange-500/10">
                  <div>
                    <p className="text-[10px] uppercase text-gray-400">30-Day MACE Risk</p>
                    <p className="text-3xl font-extrabold text-white mt-1">{(maceResult.maceRisk30Day * 100).toFixed(1)}<span className="text-sm font-normal text-gray-400">%</span></p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] uppercase text-gray-400">Risk Category</p>
                    <span className={cn(
                      "badge mt-1 text-[11px]",
                      maceResult.riskCategory === 'Low' && 'badge-green',
                      maceResult.riskCategory === 'Moderate' && 'badge-amber',
                      maceResult.riskCategory === 'High' && 'badge-red',
                      maceResult.riskCategory === 'Very High' && 'badge-red'
                    )}>
                      {maceResult.riskCategory} Risk
                    </span>
                  </div>
                </div>
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-white">MACE Risk Gauge</p>
                  <div className="progress-track">
                    <div className="progress-fill bg-gradient-to-r from-orange-400 to-rose-600" style={{ width: `${maceResult.maceRisk30Day * 100}%` }} />
                  </div>
                </div>
                {maceResult.keyDrivers.length > 0 && (
                  <div className="bg-slate-900/30 p-3 rounded-xl border border-orange-500/10 text-xs space-y-1">
                    <p className="font-semibold text-white text-[10px] uppercase tracking-wider mb-2">Key Risk Drivers</p>
                    {maceResult.keyDrivers.map((d, i) => (
                      <div key={i} className="flex items-center gap-2 text-amber-300">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                        {d}
                      </div>
                    ))}
                  </div>
                )}
                <div className="alert-strip info text-xs mt-3 leading-relaxed bg-orange-500/10 border-orange-500/20 text-orange-200">
                  {maceResult.recommendation}
                </div>
              </div>
            )}

            {/* Contrast Nephropathy Result */}
            {activeCalculator === 'cin' && (
              <div className="space-y-5 animate-fade-in">
                <div className="flex justify-between items-center bg-cyan-500/5 p-4 rounded-xl border border-cyan-500/10">
                  <div>
                    <p className="text-[10px] uppercase text-gray-400">Mehran Score</p>
                    <p className="text-3xl font-extrabold text-white mt-1">{cinResult.mehranScore}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] uppercase text-gray-400">CIN Risk</p>
                    <span className={cn(
                      "badge mt-1 text-[11px]",
                      cinResult.riskCategory === 'Low' && 'badge-green',
                      cinResult.riskCategory === 'Moderate' && 'badge-amber',
                      cinResult.riskCategory === 'High' && 'badge-red',
                      cinResult.riskCategory === 'Very High' && 'badge-red'
                    )}>
                      {cinResult.riskCategory}
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-center text-xs">
                  <div className="bg-slate-900/40 p-3 rounded border border-gray-800/40">
                    <p className="text-[10px] text-gray-500">AKI Risk</p>
                    <p className="text-lg font-bold text-cyan-400">{(cinResult.akiRisk * 100).toFixed(1)}%</p>
                  </div>
                  <div className="bg-slate-900/40 p-3 rounded border border-gray-800/40">
                    <p className="text-[10px] text-gray-500">Dialysis Risk</p>
                    <p className="text-lg font-bold text-rose-400">{(cinResult.dialysisRisk * 100).toFixed(2)}%</p>
                  </div>
                  <div className="bg-slate-900/40 p-3 rounded border border-gray-800/40 col-span-2">
                    <p className="text-[10px] text-gray-500">Suggested Contrast Cap</p>
                    <p className="text-lg font-bold text-emerald-400">{cinResult.suggestedContrastCap} mL</p>
                  </div>
                </div>
                <div className="bg-slate-900/30 p-3 rounded-xl border border-cyan-500/10 text-xs text-blue-200 leading-relaxed">
                  <p className="font-semibold text-white text-[10px] uppercase tracking-wider mb-1.5">Pre-Hydration Protocol</p>
                  {cinResult.preHydrationProtocol}
                </div>
                <div className="alert-strip info text-xs mt-1 leading-relaxed bg-cyan-500/10 border-cyan-500/20 text-cyan-200">
                  {cinResult.recommendation}
                </div>
              </div>
            )}

            {/* Readmission Risk Result */}
            {activeCalculator === 'readmission' && (
              <div className="space-y-5 animate-fade-in">
                <div className="flex justify-between items-center bg-teal-500/5 p-4 rounded-xl border border-teal-500/10">
                  <div>
                    <p className="text-[10px] uppercase text-gray-400">30-Day Readmission Risk</p>
                    <p className="text-3xl font-extrabold text-white mt-1">{(readmissionResult.readmissionRisk30Day * 100).toFixed(1)}<span className="text-sm font-normal text-gray-400">%</span></p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] uppercase text-gray-400">Risk Category</p>
                    <span className={cn(
                      "badge mt-1 text-[11px]",
                      readmissionResult.riskCategory === 'Low' && 'badge-green',
                      readmissionResult.riskCategory === 'Moderate' && 'badge-amber',
                      readmissionResult.riskCategory === 'High' && 'badge-red'
                    )}>
                      {readmissionResult.riskCategory} Risk
                    </span>
                  </div>
                </div>
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-white">Readmission Risk Gauge</p>
                  <div className="progress-track">
                    <div className="progress-fill bg-gradient-to-r from-teal-400 to-rose-500" style={{ width: `${readmissionResult.readmissionRisk30Day * 100}%` }} />
                  </div>
                </div>
                {readmissionResult.modifiableFactors.length > 0 && (
                  <div className="bg-slate-900/30 p-3 rounded-xl border border-teal-500/10 text-xs space-y-1.5">
                    <p className="font-semibold text-white text-[10px] uppercase tracking-wider mb-2">Modifiable Risk Factors ({readmissionResult.modifiableFactors.length})</p>
                    {readmissionResult.modifiableFactors.map((f, i) => (
                      <div key={i} className="flex items-start gap-2 text-amber-300">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0 mt-1" />
                        {f}
                      </div>
                    ))}
                  </div>
                )}
                <div className="alert-strip info text-xs mt-1 leading-relaxed bg-teal-500/10 border-teal-500/20 text-teal-200">
                  {readmissionResult.recommendation}
                </div>
              </div>
            )}

            {/* ASCVD Risk Result */}
            {activeCalculator === 'ascvd' && (
              <div className="space-y-5 animate-fade-in">
                <div className="flex justify-between items-center bg-emerald-500/5 p-4 rounded-xl border border-emerald-500/10">
                  <div>
                    <p className="text-[10px] uppercase text-gray-400">PCE 10-Year ASCVD Risk</p>
                    <p className="text-3xl font-extrabold text-white mt-1">{(ascvdResult.pceRisk10Year * 100).toFixed(1)}<span className="text-sm font-normal text-gray-400">%</span></p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] uppercase text-gray-400">Risk Tier</p>
                    <span className={cn(
                      "badge mt-1 text-[11px]",
                      ascvdResult.riskCategory === 'Low' && 'badge-green',
                      ascvdResult.riskCategory === 'Borderline' && 'badge-amber',
                      ascvdResult.riskCategory === 'Intermediate' && 'badge-amber',
                      ascvdResult.riskCategory === 'High' && 'badge-red'
                    )}>
                      {ascvdResult.riskCategory}
                    </span>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>PCE Risk</span>
                    <span className="font-semibold text-white">{(ascvdResult.pceRisk10Year * 100).toFixed(1)}%</span>
                  </div>
                  <div className="progress-track">
                    <div className="progress-fill bg-gradient-to-r from-emerald-400 to-rose-500" style={{ width: `${ascvdResult.pceRisk10Year * 100}%` }} />
                  </div>
                  {ascvdResult.score2Risk && (
                    <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                      <span>SCORE2 approximation</span>
                      <span className="text-gray-300">{(ascvdResult.score2Risk * 100).toFixed(1)}%</span>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="bg-slate-900/40 p-3 rounded border border-gray-800/40">
                    <p className="text-[10px] text-gray-500">Statin Recommendation</p>
                    <p className="font-semibold text-white text-[11px] mt-0.5">{ascvdResult.statin}</p>
                  </div>
                  <div className="bg-slate-900/40 p-3 rounded border border-gray-800/40">
                    <p className="text-[10px] text-gray-500">LDL Target</p>
                    <p className="font-semibold text-emerald-400 text-[11px] mt-0.5">{ascvdResult.ldlTarget}</p>
                  </div>
                </div>
                <div className="alert-strip info text-xs mt-1 leading-relaxed bg-emerald-500/10 border-emerald-500/20 text-emerald-200">
                  {ascvdResult.recommendation}
                </div>
              </div>
            )}

            <div className="pt-2 flex flex-col sm:flex-row gap-2 no-print">
              {connectedPatient && (
                <Button className="flex-1 justify-center gap-2" onClick={handleSaveToVisit} loading={saving}>
                  <Save className="w-4 h-4" /> Save to Patient Visit
                </Button>
              )}
              <Button variant="outline" className="flex-1 justify-center gap-2" onClick={() => typeof window !== 'undefined' && window.print()}>
                <Printer className="w-4 h-4" /> Print / Export Report
              </Button>
            </div>

            <div className="bg-blue-500/5 p-3 rounded-xl border border-blue-500/10 flex items-start gap-2.5 text-xs text-gray-400 leading-normal">
              <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
              <p>
                Calculations are derived from peer-reviewed evidence-based cardiovascular prognostic systems. Use for reference purposes to supplement patient examinations.
              </p>
            </div>

          </div>
        </div>

      </div>

    </div>
  )
}

export default function RiskCalculatorsPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-400">
        <FlaskConical className="w-8 h-8 text-blue-500 animate-spin" />
        <p>Loading prognostic risk calculator...</p>
      </div>
    }>
      <RiskCalculatorContent />
    </Suspense>
  )
}
