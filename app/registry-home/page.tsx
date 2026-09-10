'use client'
import Link from 'next/link'
import { Users, TrendingUp, CheckCircle, ArrowRight, Clock, Activity } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useState, useEffect } from 'react'
import { getPatients, getAllLatestVisits, getAllCathProcedures } from '@/lib/firestore'
import type { CathProcedure, Patient } from '@/lib/types'



interface RegistryCard {
  id: string
  name: string
  shortDesc: string
  gradient: string
  ringColor: string
  borderColor: string
  patients: number
  newThisMonth: number
  lastEntryDaysAgo: number
  completion: number
  status: 'Active' | 'Enrolling' | 'Suspended'
  registryOwner?: string   // Principal Investigator / Registry Owner
  categories: { name: string; pct: number }[]
  quickStats: { label: string; value: string; tooltip?: string }[]
}


const REGISTRIES: RegistryCard[] = [
  {
    id: 'hf',
    name: 'Heart Failure Registry',
    shortDesc: 'HFrEF · HFmrEF · HFpEF · Advanced HF',
    gradient: 'linear-gradient(135deg, #1d4ed8 0%, #3b82f6 100%)',
    ringColor: '#60a5fa',
    borderColor: 'rgba(59,130,246,0.3)',
    patients: 0,  // Will be overwritten with real data from Firebase
    newThisMonth: 0,
    lastEntryDaysAgo: 0,
    completion: 0,
    status: 'Active',
    registryOwner: 'Dr. A. Jayachandra',
    categories: [
      { name: 'Demographics', pct: 0 },
      { name: 'Vitals & Exam', pct: 0 },
      { name: 'Echo / Imaging', pct: 0 },
      { name: 'Laboratory', pct: 0 },
      { name: 'Medications', pct: 0 },
      { name: 'QoL / Functional', pct: 0 },
    ],
    quickStats: [
      { label: 'Avg LVEF', value: '—' },
      { label: 'GDMT Rate', value: '—' },
      { label: 'NYHA III–IV', value: '—' },
    ],
  },
  {
    id: 'acs',
    name: 'ACS & Coronary Registry',
    shortDesc: 'STEMI · NSTEMI · Unstable Angina · Stable CAD',
    gradient: 'linear-gradient(135deg, #b91c1c 0%, #ef4444 100%)',
    ringColor: '#f87171',
    borderColor: 'rgba(239,68,68,0.3)',
    patients: 0,
    newThisMonth: 0,
    lastEntryDaysAgo: 0,
    completion: 0,
    status: 'Suspended',  // Mark as suspended until real data integration
    registryOwner: 'Dr. A. Jayachandra',
    categories: [
      { name: 'Demographics', pct: 0 },
      { name: 'Vitals & Exam', pct: 0 },
      { name: 'Cath / Angio', pct: 0 },
      { name: 'Laboratory', pct: 0 },
      { name: 'Medications', pct: 0 },
      { name: 'Outcomes', pct: 0 },
    ],
    quickStats: [
      { label: 'DTB < 90 min', value: '—' },
      { label: 'TIMI 3 Flow', value: '—' },
      { label: 'DAPT Rate', value: '—' },
    ],
  },
  {
    id: 'arrhythmia',
    name: 'Arrhythmia & EP Registry',
    shortDesc: 'AF · VT · Bradyarrhythmia · Ablation · Devices',
    gradient: 'linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%)',
    ringColor: '#a78bfa',
    borderColor: 'rgba(139,92,246,0.3)',
    patients: 0,
    newThisMonth: 0,
    lastEntryDaysAgo: 0,
    completion: 0,
    status: 'Suspended',
    categories: [
      { name: 'Demographics', pct: 0 },
      { name: 'ECG / Holter', pct: 0 },
      { name: 'Echo', pct: 0 },
      { name: 'Laboratory', pct: 0 },
      { name: 'Medications', pct: 0 },
      { name: 'Device Data', pct: 0 },
    ],
    quickStats: [
      { label: 'AF Burden Tracked', value: '—' },
      { label: 'Device Interrogation', value: '—' },
      { label: 'OAC Rate', value: '—' },
    ],
  },
  {
    id: 'structural',
    name: 'Structural Heart Disease',
    shortDesc: 'Valvular · Cardiomyopathy · Congenital · TAVI/TMVR',
    gradient: 'linear-gradient(135deg, #0e7490 0%, #06b6d4 100%)',
    ringColor: '#22d3ee',
    borderColor: 'rgba(6,182,212,0.3)',
    patients: 0,
    newThisMonth: 0,
    lastEntryDaysAgo: 0,
    completion: 0,
    status: 'Suspended',
    categories: [
      { name: 'Demographics', pct: 0 },
      { name: 'Echo / Imaging', pct: 0 },
      { name: 'Advanced Imaging', pct: 0 },
      { name: 'Laboratory', pct: 0 },
      { name: 'Medications', pct: 0 },
      { name: 'Outcomes', pct: 0 },
    ],
    quickStats: [
      { label: 'Severe MR', value: '—' },
      { label: 'Severe AS', value: '—' },
      { label: 'Cardiomyopathy', value: '—' },
    ],
  },
  {
    id: 'cathlab',
    name: 'Cath Lab & Interventional',
    shortDesc: 'PCI · STEMI Networks · Coronary Interventions',
    gradient: 'linear-gradient(135deg, #b45309 0%, #f59e0b 100%)',
    ringColor: '#fbbf24',
    borderColor: 'rgba(245,158,11,0.3)',
    patients: 0,
    newThisMonth: 0,
    lastEntryDaysAgo: 0,
    completion: 0,
    status: 'Suspended',
    registryOwner: 'Dr. Rajeev Chauhan',
    categories: [
      { name: 'Indication & Urgency', pct: 0 },
      { name: 'Vascular Access', pct: 0 },
      { name: 'Lesions & Anatomy', pct: 0 },
      { name: 'Devices & Stents', pct: 0 },
      { name: 'Hemodynamics & Rad', pct: 0 },
      { name: 'Complications & Safety', pct: 0 },
    ],
    quickStats: [
      { label: 'PCI Success', value: '—' },
      { label: 'Radial First', value: '—' },
      { label: 'DTB ≤ 90m', value: '—' },
    ],
  },
  {
    id: 'preventive',
    name: 'Preventive Cardiology',
    shortDesc: 'Risk Stratification · Lifestyle · Primary Prevention',
    gradient: 'linear-gradient(135deg, #065f46 0%, #10b981 100%)',
    ringColor: '#34d399',
    borderColor: 'rgba(16,185,129,0.3)',
    patients: 0,
    newThisMonth: 0,
    lastEntryDaysAgo: 0,
    completion: 0,
    status: 'Suspended',
    registryOwner: 'Dr. A. Jayachandra',
    categories: [
      { name: 'Demographics', pct: 0 },
      { name: 'Risk Factors', pct: 0 },
      { name: 'Laboratory', pct: 0 },
      { name: 'Lifestyle Data', pct: 0 },
      { name: 'Medications', pct: 0 },
      { name: 'Follow-up', pct: 0 },
    ],
    quickStats: [
      { label: 'Statin Rate', value: '—' },
      { label: 'BP Control', value: '—' },
      { label: 'DM Control (HbA1c)', value: '—' },
    ],
  },
]

function CompletionRing({ pct, color }: { pct: number; color: string }) {
  const r = 36
  const circ = 2 * Math.PI * r
  const dash = (pct / 100) * circ
  return (
    <svg width="88" height="88" viewBox="0 0 88 88" className="flex-shrink-0">
      <circle cx="44" cy="44" r={r} fill="none" stroke="currentColor" className="text-white/15" strokeWidth="6" />
      <circle
        cx="44" cy="44" r={r}
        fill="none"
        stroke={color}
        strokeWidth="6"
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeLinecap="round"
        transform="rotate(-90 44 44)"
        style={{ filter: `drop-shadow(0 0 4px ${color}88)` }}
      />
      <text x="44" y="40" textAnchor="middle" className="fill-white font-extrabold text-[15px]">{pct}%</text>
      <text x="44" y="54" textAnchor="middle" className="fill-gray-400 text-[9px] font-bold">Complete</text>
    </svg>
  )
}

function StatusBadge({ status }: { status: RegistryCard['status'] }) {
  const styles: Record<string, string> = {
    Active:    'bg-emerald-500/20 text-emerald-100 border-emerald-400/40 font-bold',
    Enrolling: 'bg-blue-500/20 text-blue-100 border-blue-400/40 font-bold',
    Suspended: 'bg-slate-900/40 text-white/90 border-white/20 font-bold',
  }
  return (
    <span className={cn('text-[10px] px-2 py-0.5 rounded-full border shadow-sm backdrop-blur-sm', styles[status])}>
      {status}
    </span>
  )
}

function lastEntryLabel(days: number) {
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  return `${days}d ago`
}

export default function RegistryHomePage() {
  const [registries, setRegistries] = useState<RegistryCard[]>(REGISTRIES)
  const [loading, setLoading] = useState(true)

  function safeTime(dateStr: string | undefined): number {
    if (!dateStr) return 0
    const t = new Date(dateStr).getTime()
    return isNaN(t) ? 0 : t
  }

  useEffect(() => {
    async function loadData() {
      try {
        const [allPatients, allProcedures] = await Promise.all([
          getPatients(),
          getAllCathProcedures()
        ])
        const startOfMonth = new Date()
        startOfMonth.setDate(1)
        startOfMonth.setHours(0, 0, 0, 0)
        
        /**
         * Strict explicit-enrollment filter.
         * A patient is a member of a registry ONLY if they were explicitly enrolled:
         *   - registryIds[].includes(id)   (new multi-enrollment model)
         *   - registryId === id            (legacy single-registry field)
         *
         * Clinical field inference has been intentionally removed to prevent
         * cross-registry contamination (e.g., cath-lab patients with comorbidCAD
         * showing up in ACS counts, or studyConsented patients leaking into HF).
         */
        const getPatientsForRegistry = (id: string): Patient[] =>
          allPatients.filter(p =>
            p.registryIds?.includes(id) || p.registryId === id
          )

        const hfPatients = getPatientsForRegistry('hf')
        const hfPatientIds = new Set(hfPatients.map(p => p.id))

        // Fetch latest visits for all patients (single query, not N+1)
        const latestVisitsMap = await getAllLatestVisits()
        const allVisits = Array.from(latestVisitsMap.values())
        const hfVisits = allVisits.filter(v => hfPatientIds.has(v.patientId))

        // 6 clinical category definitions matching the detail page for HF
        const hfCategories = [
          { name: 'Demographics', fields: ['firstName', 'lastName', 'dob', 'sex', 'mrn', 'contact', 'address', 'indianCitizen', 'studyConsented', 'abhaId', 'occupation', 'addressHouse', 'addressStreet', 'addressPost', 'addressDistrict', 'addressState', 'addressPin', 'secondaryContact', 'caregiverContact'] },
          { name: 'Vitals & Exam', fields: ['bpSystolic', 'bpDiastolic', 'heartRate', 'weight', 'height', 'o2Sat', 'oedema'] },
          { name: 'Echo / Imaging', fields: ['lvef', 'echoDate', 'lvdd', 'lvsd', 'eEPrime', 'ddGrade', 'rvsp', 'laStrain', 'rvFreeWallStrain', 'lvMassIndex', 'relativeWallThickness'] },
          { name: 'Laboratory', fields: ['ntProBNP', 'bnp', 'egfr', 'creatinine', 'potassium', 'sodium', 'hb', 'tft', 'hba1c', 'ferritin', 'transferrinSat', 'uricAcid', 'ldl', 'triglycerides', 'peakTropT', 'peakTropI', 'serumUrea', 'bun'] },
          { name: 'Medications', fields: ['diuretic', 'raasi', 'betaBlocker', 'digoxin', 'sglt2i', 'ivabradine', 'mra', 'aspirin', 'statin', 'noac', 'vki', 'ivIron'] },
          { name: 'QoL / Functional', fields: ['symptomTrajectory', 'eq5d', 'sixMWT', 'gripRight', 'gripLeft', 'education', 'kccq'] }
        ]

        const categoryAverages: Record<string, number> = {}
        hfCategories.forEach(cat => {
          let totalScoreForCat = 0
          hfPatients.forEach(p => {
            const pVisits = hfVisits.filter(v => v.patientId === p.id)
            const latest = pVisits.length ? pVisits.reduce((l, c) => safeTime(c.visitDate) > safeTime(l.visitDate) ? c : l, pVisits[0]) : null
            
            let filled = 0
            cat.fields.forEach(f => {
              if (f in p) {
                const val = (p as any)[f]
                if (val !== undefined && val !== null && val !== '') filled++
              } else if (latest && f in latest) {
                const val = (latest as any)[f]
                if (val !== undefined && val !== null && val !== '') {
                  if (typeof val === 'object') {
                    if (val.prescribed !== undefined && val.prescribed !== '') filled++
                    else if (Object.keys(val).length > 0) filled++
                  } else {
                    filled++
                  }
                }
              }
            })
            totalScoreForCat += Math.round((filled / cat.fields.length) * 100)
          })
          categoryAverages[cat.name] = hfPatients.length ? Math.round(totalScoreForCat / hfPatients.length) : 0
        })

        // Set the state dynamically
        setRegistries(prev => prev.map(r => {
          const regPatients = getPatientsForRegistry(r.id)
          const newThisMonth = regPatients.filter(p => p.createdAt && new Date(p.createdAt) >= startOfMonth).length

          // Calculate updated categories completeness
          let updatedCategories = r.categories.map(cat => {
            if (r.id === 'hf') {
              return { ...cat, pct: categoryAverages[cat.name] || 0 }
            }
            return { ...cat, pct: regPatients.length ? cat.pct : 0 }
          })
          
          let updatedCompletion = regPatients.length
            ? Math.round(updatedCategories.reduce((sum, c) => sum + c.pct, 0) / updatedCategories.length)
            : 0

          // Calculate registry metrics
          let quickStats = r.quickStats
          if (r.id === 'hf') {
            // 1. Avg LVEF from latest visits (not stale patient.lvef)
            const lvefVals = hfVisits.map(v => v.lvef).filter(v => v !== undefined && v !== null && typeof v === 'number') as number[]
            const avgLvef = lvefVals.length ? Math.round(lvefVals.reduce((a, b) => a + b, 0) / lvefVals.length) : 0

            // 2. GDMT Rate: % of patients on all 4 pillars (RAASi, BB, MRA, SGLT2i)
            const gdmtCount = hfVisits.filter(v => {
              const hasRaasi = v.raasi?.prescribed === 'Yes'
              const hasBB = v.betaBlocker?.prescribed === 'Yes'
              const hasMRA = v.mra?.prescribed === 'Yes'
              const hasSGLT2i = v.sglt2i?.prescribed === 'Yes'
              return hasRaasi && hasBB && hasMRA && hasSGLT2i
            }).length
            const gdmtRate = hfVisits.length ? Math.round((gdmtCount / hfVisits.length) * 100) : 0

            // 3. NYHA III–IV: % of patients with NYHA class III or IV
            const nyha34Count = hfVisits.filter(v => v.nyha === 'III' || v.nyha === 'IV').length
            const nyha34Rate = hfVisits.length ? Math.round((nyha34Count / hfVisits.length) * 100) : 0

            quickStats = r.quickStats.map(stat => {
              if (stat.label === 'Avg LVEF') return { ...stat, value: `${avgLvef}%` }
              if (stat.label === 'GDMT Rate') return { ...stat, value: `${gdmtRate}%` }
              if (stat.label === 'NYHA III–IV') return { ...stat, value: `${nyha34Rate}%` }
              return stat
            })
          } else if (r.id === 'cathlab') {
            const pciProcedures = allProcedures.filter(p => p.procedureType !== 'Diagnostic Coronary Angiography')
            const allTreatedLesions = pciProcedures.flatMap(p => (p.lesions || []).filter(l => l.treatmentStrategy !== 'Medical Therapy'))
            
            // True Angiographic Success: TIMI 3 flow + residual stenosis < 20% with NO in-lab MACE
            const successfulLesions = pciProcedures.flatMap(p => {
              const hasInLabMace = !!(
                p.complications?.inLabDeath ||
                p.complications?.emergencyCabg ||
                p.complications?.acuteStentThrombosis ||
                p.complications?.periproceduralMi
              )
              if (hasInLabMace) return []
              return (p.lesions || []).filter(
                l => l.treatmentStrategy !== 'Medical Therapy' &&
                     l.postTimiFlow === 3 &&
                     l.postStenosisPct != null &&
                     l.postStenosisPct < 20
              )
            })
            const pciSuccessRate = allTreatedLesions.length > 0
              ? Math.round((successfulLesions.length / allTreatedLesions.length) * 100)
              : null

            const radialAccessCount = allProcedures.filter(p => p.accessSite && p.accessSite.includes('Radial')).length
            const radialRate = allProcedures.length ? Math.round((radialAccessCount / allProcedures.length) * 100) : null

            const stemiCases = allProcedures.filter(p => p.clinicalIndication === 'STEMI' && p.stemiTimelines?.dtbMinutes != null)
            const dtbMet = stemiCases.filter(p => (p.stemiTimelines?.dtbMinutes ?? 999) <= 90).length
            const dtbRate = stemiCases.length > 0 ? Math.round((dtbMet / stemiCases.length) * 100) : null

            // True Multi-vessel CAD from anatomy (LM ≥ 50% or ≥ 2 vessels with stenosis ≥ 70%)
            let mvdDocumentedCount = 0
            let mvdPositiveCount = 0
            allVisits.forEach(v => {
              if (v.coronaryAnatomy) {
                const ca = v.coronaryAnatomy
                const hasData = (ca.lmStenosis != null || ca.ladStenosis != null || ca.lcxStenosis != null || ca.rcaStenosis != null)
                if (hasData) {
                  mvdDocumentedCount++
                  let diseasedCount = 0
                  if ((ca.ladStenosis ?? 0) >= 70) diseasedCount++
                  if ((ca.lcxStenosis ?? 0) >= 70) diseasedCount++
                  if ((ca.rcaStenosis ?? 0) >= 70) diseasedCount++
                  const hasLM = (ca.lmStenosis ?? 0) >= 50
                  if (hasLM || diseasedCount >= 2) mvdPositiveCount++
                }
              }
            })
            const multiVesselRate = mvdDocumentedCount > 0 ? Math.round((mvdPositiveCount / mvdDocumentedCount) * 100) : null

            // True SYNTAX > 22 from documented syntaxScore
            let syntaxDocumentedCount = 0
            let syntaxOver22Count = 0
            allVisits.forEach(v => {
              const score = v.coronaryAnatomy?.syntaxScore
              if (typeof score === 'number' && score > 0) {
                syntaxDocumentedCount++
                if (score > 22) syntaxOver22Count++
              }
            })
            allProcedures.forEach(p => {
              if (typeof p.syntaxScore === 'number' && p.syntaxScore > 0) {
                syntaxDocumentedCount++
                if (p.syntaxScore > 22) syntaxOver22Count++
              }
            })
            const syntaxHighRate = syntaxDocumentedCount > 0 ? Math.round((syntaxOver22Count / syntaxDocumentedCount) * 100) : null

            quickStats = r.quickStats.map(stat => {
              if (stat.label === 'PCI Success') return { ...stat, value: '—', tooltip: 'not yet captured' }
              if (stat.label === 'Radial First') return { ...stat, value: radialRate !== null ? `${radialRate}%` : '—' }
              if (stat.label === 'DTB ≤ 90m') return { ...stat, value: dtbRate !== null ? `${dtbRate}%` : '—' }
              if (stat.label === 'Multi-vessel') return { ...stat, value: '—', tooltip: 'not yet captured' }
              if (stat.label === 'SYNTAX > 22') return { ...stat, value: '—', tooltip: 'not yet captured' }
              return stat
            })

            const procCategories = [
              { name: 'Indication & Urgency', test: (p: CathProcedure) => !!(p.procedureType && p.clinicalIndication) },
              { name: 'Vascular Access', test: (p: CathProcedure) => !!(p.accessSite && p.sheathSize && p.closureDevice) },
              { name: 'Lesions & Anatomy', test: (p: CathProcedure) => Array.isArray(p.lesions) && p.lesions.length > 0 },
              { name: 'Devices & Stents', test: (p: CathProcedure) => Array.isArray(p.lesions) && p.lesions.some(l => l.devices && l.devices.length > 0) },
              { name: 'Hemodynamics & Rad', test: (p: CathProcedure) => (p.contrastVolumeMl || 0) > 0 || (p.fluoroscopyTimeMinutes || 0) > 0 },
              { name: 'Complications & Safety', test: (p: CathProcedure) => p.complications != null },
            ]

            updatedCategories = procCategories.map(cat => {
              if (allProcedures.length === 0) return { name: cat.name, pct: 0 }
              const filledCount = allProcedures.filter(cat.test).length
              return { name: cat.name, pct: Math.round((filledCount / allProcedures.length) * 100) }
            })
            updatedCompletion = updatedCategories.length ? Math.round(updatedCategories.reduce((acc, c) => acc + c.pct, 0) / updatedCategories.length) : 0

            const uniqueCathPatientIds = new Set(allProcedures.map(p => p.patientId))
            let cathLastDaysAgo = 0
            if (allProcedures.length > 0) {
              const latestProcTime = allProcedures.reduce((max, p) => {
                const t = safeTime(p.procedureDate) || safeTime(p.createdAt)
                return t > max ? t : max
              }, 0)
              if (latestProcTime > 0) {
                cathLastDaysAgo = Math.max(0, Math.floor((Date.now() - latestProcTime) / (1000 * 60 * 60 * 24)))
              }
            }

            const cathPatientCount = uniqueCathPatientIds.size
            return {
              ...r,
              patients: cathPatientCount,
              status: cathPatientCount > 0 ? 'Active' : 'Suspended',
              newThisMonth: allProcedures.filter(p => p.createdAt && new Date(p.createdAt) >= startOfMonth).length,
              lastEntryDaysAgo: cathLastDaysAgo,
              categories: updatedCategories,
              completion: updatedCompletion,
              quickStats: quickStats
            }
          } else if (r.id === 'acs') {
            const acsProcedures = allProcedures.filter(p => p.clinicalIndication === 'STEMI' || p.clinicalIndication === 'NSTEMI' || p.clinicalIndication === 'Unstable Angina')
            const stemiCases = acsProcedures.filter(p => p.clinicalIndication === 'STEMI' && p.stemiTimelines?.dtbMinutes != null)
            const dtbMet = stemiCases.filter(p => (p.stemiTimelines?.dtbMinutes ?? 999) < 90).length
            const dtbRate = stemiCases.length > 0 ? Math.round((dtbMet / stemiCases.length) * 100) : null

            const acsTreatedLesions = acsProcedures.flatMap(p => p.lesions || []).filter(l => l.treatmentStrategy !== 'Medical Therapy')
            const timi3Lesions = acsTreatedLesions.filter(l => l.postTimiFlow === 3)
            const timi3Rate = acsTreatedLesions.length > 0 ? Math.round((timi3Lesions.length / acsTreatedLesions.length) * 100) : null

            // True DAPT = Aspirin AND P2Y12 inhibitor
            const acsWithMeds = allVisits.filter(v => v.aspirin?.prescribed === 'Yes' && v.p2y12Inhibitor?.prescribed === 'Yes').length
            const totalAcsEvaluated = allVisits.filter(v => v.aspirin?.prescribed != null || v.p2y12Inhibitor?.prescribed != null).length
            const daptRate = totalAcsEvaluated > 0 ? Math.round((acsWithMeds / totalAcsEvaluated) * 100) : null

            quickStats = r.quickStats.map(stat => {
              if (stat.label === 'DTB < 90 min') return { ...stat, value: dtbRate !== null ? `${dtbRate}%` : '—' }
              if (stat.label === 'TIMI 3 Flow') return { ...stat, value: timi3Rate !== null ? `${timi3Rate}%` : '—' }
              if (stat.label === 'DAPT Rate') return { ...stat, value: daptRate !== null ? `${daptRate}%` : '—' }
              return stat
            })

            const acsPatientIds = new Set(acsProcedures.map(p => p.patientId))
            allPatients.forEach(p => {
              // Strict: only explicit ACS enrollment, never inferred from comorbidities
              if (p.registryIds?.includes('acs') || p.registryId === 'acs') {
                acsPatientIds.add(p.id)
              }
            })

            return {
              ...r,
              patients: acsPatientIds.size,
              newThisMonth: regPatients.filter(p => p.createdAt && new Date(p.createdAt) >= startOfMonth).length,
              lastEntryDaysAgo: r.lastEntryDaysAgo,
              categories: updatedCategories,
              completion: updatedCompletion,
              quickStats: quickStats
            }
          } else {
            quickStats = r.quickStats.map(stat => ({
              ...stat,
              value: regPatients.length ? stat.value : '—'
            }))
          }

          let lastEntryDaysAgo = r.lastEntryDaysAgo
          if (regPatients.length > 0) {
            const latestTime = regPatients.reduce((max, p) => {
              const v = latestVisitsMap.get(p.id)
              const vt = safeTime(v?.visitDate)
              const pt = safeTime(p.updatedAt || p.createdAt || p.hfConfirmationDate)
              return Math.max(max, vt, pt)
            }, 0)
            if (latestTime > 0) {
              lastEntryDaysAgo = Math.max(0, Math.floor((Date.now() - latestTime) / (1000 * 60 * 60 * 24)))
            }
          }

          return {
            ...r,
            patients: regPatients.length,
            newThisMonth: newThisMonth,
            lastEntryDaysAgo: lastEntryDaysAgo,
            categories: updatedCategories,
            completion: updatedCompletion,
            quickStats: quickStats
          }
        }))
      } catch (err) {
        console.error('Failed to calculate registry live data:', err)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  const totalPatients = registries.reduce((sum, r) => sum + r.patients, 0)
  const activeCount   = registries.filter(r => r.status === 'Active' || r.status === 'Enrolling').length
  const newThisMonth  = registries.reduce((sum, r) => sum + r.newThisMonth, 0)
  const activeRegs    = registries.filter(r => r.patients > 0)
  const avgCompletion = activeRegs.length > 0
    ? Math.round(activeRegs.reduce((sum, r) => sum + r.completion, 0) / activeRegs.length)
    : 0

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">

      {/* ── Summary Stats ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Enrolled Patients', value: totalPatients.toLocaleString(), icon: Users,        color: 'text-blue-400',    bg: 'bg-blue-500/10' },
          { label: 'Active Registries',        value: `${activeCount} / ${REGISTRIES.length}`,   icon: Activity,     color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
          { label: 'Avg Data Completion',      value: `${avgCompletion}%`,                        icon: CheckCircle,  color: 'text-violet-400',  bg: 'bg-violet-500/10' },
          { label: 'New Enrollments (Month)',  value: `+${newThisMonth}`,                         icon: TrendingUp,   color: 'text-amber-400',   bg: 'bg-amber-500/10' },
        ].map(s => (
          <div key={s.label} className="glass-card p-4 flex items-center gap-3 border border-white/[0.05]">
            <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0', s.bg)}>
              <s.icon className={cn('w-4.5 h-4.5', s.color)} size={18} />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-400 truncate">{s.label}</p>
              <p className="text-xl font-bold text-white">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Registry Cards Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
        {registries.map(reg => (
          <div
            key={reg.id}
            className="glass-card flex flex-col overflow-hidden transition-all duration-200 hover:scale-[1.01]"
            style={{ border: `1px solid ${reg.borderColor}` }}
          >
            {/* Card header gradient strip */}
            <div className="px-5 py-4 flex items-center justify-between preserve-dark shadow-sm" style={{ background: reg.gradient }}>
              <div className="min-w-0">
                <p className="text-sm font-bold text-white truncate drop-shadow-sm">{reg.name}</p>
                <p className="text-[11px] mt-0.5 truncate text-white/90 font-medium">{reg.shortDesc}</p>
              </div>
              <StatusBadge status={reg.status} />
            </div>

            {/* Card body */}
            <div className="p-5 flex-1 space-y-4">
              {/* Ring + category bars */}
              <div className="flex gap-4">
                <CompletionRing pct={reg.completion} color={reg.ringColor} />
                <div className="flex-1 space-y-1.5 min-w-0">
                  {reg.categories.map(cat => (
                    <div key={cat.name} className="space-y-0.5">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] text-gray-400 truncate">{cat.name}</span>
                        <span className="text-[10px] font-medium text-white ml-2">{cat.pct}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/[0.07] overflow-hidden registry-track">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${cat.pct}%`, background: reg.ringColor, opacity: cat.pct < 70 ? 0.7 : 1 }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick stats row */}
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/[0.05] card-divider">
                {reg.quickStats.map(qs => (
                  <div key={qs.label} className="text-center" title={qs.tooltip || (qs.value === '—' ? 'not yet captured' : undefined)}>
                    <p className="text-sm font-bold text-white">{qs.value}</p>
                    <p className="text-[9px] text-gray-400 leading-tight mt-0.5">{qs.label}</p>
                  </div>
                ))}
              </div>

              {/* Footer row */}
              <div className="flex flex-col gap-2 pt-2 border-t border-white/[0.05] card-divider">
                {/* PI badge — shown only when registryOwner is set */}
                {reg.registryOwner && (
                  <div className="flex items-center gap-1.5 text-[10px]">
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full border font-semibold"
                      style={{ background: `${reg.ringColor}18`, color: reg.ringColor, borderColor: `${reg.ringColor}40` }}>
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                      PI
                    </span>
                    <span className="text-gray-300 truncate font-medium">{reg.registryOwner}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 text-[10px] text-gray-400">
                    <span className="flex items-center gap-1">
                      <Users size={11} className="text-gray-400" /> {reg.patients.toLocaleString()} pts
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock size={11} className="text-gray-400" /> {lastEntryLabel(reg.lastEntryDaysAgo)}
                    </span>
                    <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                      <TrendingUp size={11} /> +{reg.newThisMonth}
                    </span>
                  </div>
                  <Link
                    href={`/registry-home/${reg.id}`}
                    className="flex items-center gap-1 text-[11px] font-bold px-3 py-1.5 rounded-lg transition-all shadow-sm"
                    style={{ background: `${reg.ringColor}20`, color: reg.ringColor, border: `1px solid ${reg.ringColor}40` }}
                  >
                    Analytics <ArrowRight size={11} />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
