'use client'
import Link from 'next/link'
import { Users, TrendingUp, CheckCircle, ArrowRight, Clock, Activity } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useState, useEffect } from 'react'
import { getPatients, getVisits } from '@/lib/firestore'



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
  categories: { name: string; pct: number }[]
  quickStats: { label: string; value: string }[]
}

const REGISTRIES: RegistryCard[] = [
  {
    id: 'hf',
    name: 'Heart Failure Registry',
    shortDesc: 'HFrEF · HFmrEF · HFpEF · Advanced HF',
    gradient: 'linear-gradient(135deg, #1d4ed8 0%, #3b82f6 100%)',
    ringColor: '#60a5fa',
    borderColor: 'rgba(59,130,246,0.3)',
    patients: 312,
    newThisMonth: 18,
    lastEntryDaysAgo: 1,
    completion: 83,
    status: 'Active',
    categories: [
      { name: 'Demographics', pct: 98 },
      { name: 'Vitals & Exam', pct: 91 },
      { name: 'Echo / Imaging', pct: 76 },
      { name: 'Laboratory', pct: 84 },
      { name: 'Medications', pct: 88 },
      { name: 'QoL / Functional', pct: 62 },
    ],
    quickStats: [
      { label: 'Avg LVEF', value: '32%' },
      { label: 'GDMT Rate', value: '74%' },
      { label: 'NYHA III–IV', value: '58%' },
    ],
  },
  {
    id: 'acs',
    name: 'ACS & Coronary Registry',
    shortDesc: 'STEMI · NSTEMI · Unstable Angina · Stable CAD',
    gradient: 'linear-gradient(135deg, #b91c1c 0%, #ef4444 100%)',
    ringColor: '#f87171',
    borderColor: 'rgba(239,68,68,0.3)',
    patients: 248,
    newThisMonth: 14,
    lastEntryDaysAgo: 0,
    completion: 88,
    status: 'Active',
    categories: [
      { name: 'Demographics', pct: 97 },
      { name: 'Vitals & Exam', pct: 94 },
      { name: 'Cath / Angio', pct: 89 },
      { name: 'Laboratory', pct: 88 },
      { name: 'Medications', pct: 91 },
      { name: 'Outcomes', pct: 71 },
    ],
    quickStats: [
      { label: 'DTB < 90 min', value: '82%' },
      { label: 'TIMI 3 Flow', value: '91%' },
      { label: 'DAPT Rate', value: '96%' },
    ],
  },
  {
    id: 'arrhythmia',
    name: 'Arrhythmia & EP Registry',
    shortDesc: 'AF · VT · Bradyarrhythmia · Ablation · Devices',
    gradient: 'linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%)',
    ringColor: '#a78bfa',
    borderColor: 'rgba(139,92,246,0.3)',
    patients: 187,
    newThisMonth: 9,
    lastEntryDaysAgo: 2,
    completion: 81,
    status: 'Active',
    categories: [
      { name: 'Demographics', pct: 99 },
      { name: 'ECG / Holter', pct: 83 },
      { name: 'Echo', pct: 71 },
      { name: 'Laboratory', pct: 79 },
      { name: 'Medications', pct: 86 },
      { name: 'Device Data', pct: 68 },
    ],
    quickStats: [
      { label: 'AF Burden Tracked', value: '74%' },
      { label: 'Device Interrogation', value: '86%' },
      { label: 'OAC Rate', value: '78%' },
    ],
  },
  {
    id: 'structural',
    name: 'Structural Heart Disease',
    shortDesc: 'Valvular · Cardiomyopathy · Congenital · TAVI/TMVR',
    gradient: 'linear-gradient(135deg, #0e7490 0%, #06b6d4 100%)',
    ringColor: '#22d3ee',
    borderColor: 'rgba(6,182,212,0.3)',
    patients: 143,
    newThisMonth: 6,
    lastEntryDaysAgo: 3,
    completion: 80,
    status: 'Enrolling',
    categories: [
      { name: 'Demographics', pct: 96 },
      { name: 'Echo / Imaging', pct: 88 },
      { name: 'Advanced Imaging', pct: 72 },
      { name: 'Laboratory', pct: 81 },
      { name: 'Medications', pct: 79 },
      { name: 'Outcomes', pct: 64 },
    ],
    quickStats: [
      { label: 'Severe MR', value: '38%' },
      { label: 'Severe AS', value: '44%' },
      { label: 'Cardiomyopathy', value: '18%' },
    ],
  },
  {
    id: 'cathlab',
    name: 'Cath Lab & Interventional',
    shortDesc: 'PCI · CABG Referral · Structural Interventions',
    gradient: 'linear-gradient(135deg, #b45309 0%, #f59e0b 100%)',
    ringColor: '#fbbf24',
    borderColor: 'rgba(245,158,11,0.3)',
    patients: 201,
    newThisMonth: 11,
    lastEntryDaysAgo: 0,
    completion: 88,
    status: 'Active',
    categories: [
      { name: 'Demographics', pct: 98 },
      { name: 'Procedure Data', pct: 94 },
      { name: 'Angiography', pct: 91 },
      { name: 'PCI / Devices', pct: 88 },
      { name: 'Complications', pct: 83 },
      { name: 'Follow-up', pct: 72 },
    ],
    quickStats: [
      { label: 'PCI Success', value: '94%' },
      { label: 'Multi-vessel', value: '42%' },
      { label: 'SYNTAX > 22', value: '31%' },
    ],
  },
  {
    id: 'preventive',
    name: 'Preventive Cardiology',
    shortDesc: 'Risk Stratification · Lifestyle · Primary Prevention',
    gradient: 'linear-gradient(135deg, #065f46 0%, #10b981 100%)',
    ringColor: '#34d399',
    borderColor: 'rgba(16,185,129,0.3)',
    patients: 156,
    newThisMonth: 8,
    lastEntryDaysAgo: 2,
    completion: 85,
    status: 'Enrolling',
    categories: [
      { name: 'Demographics', pct: 99 },
      { name: 'Risk Factors', pct: 92 },
      { name: 'Laboratory', pct: 87 },
      { name: 'Lifestyle Data', pct: 78 },
      { name: 'Medications', pct: 83 },
      { name: 'Follow-up', pct: 69 },
    ],
    quickStats: [
      { label: 'Statin Rate', value: '88%' },
      { label: 'BP Control', value: '71%' },
      { label: 'DM Control (HbA1c)', value: '64%' },
    ],
  },
]

function CompletionRing({ pct, color }: { pct: number; color: string }) {
  const r = 36
  const circ = 2 * Math.PI * r
  const dash = (pct / 100) * circ
  return (
    <svg width="88" height="88" viewBox="0 0 88 88" className="flex-shrink-0">
      <circle cx="44" cy="44" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
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
      <text x="44" y="40" textAnchor="middle" fill="white" fontSize="14" fontWeight="bold">{pct}%</text>
      <text x="44" y="54" textAnchor="middle" fill="rgba(148,163,184,0.65)" fontSize="8">Complete</text>
    </svg>
  )
}

function StatusBadge({ status }: { status: RegistryCard['status'] }) {
  const styles: Record<string, string> = {
    Active:    'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
    Enrolling: 'bg-blue-500/15 text-blue-400 border-blue-500/25',
    Suspended: 'bg-red-500/15 text-red-400 border-red-500/25',
  }
  return (
    <span className={cn('text-[10px] px-2 py-0.5 rounded-full border font-medium', styles[status])}>
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
        const allPatients = await getPatients()
        const startOfMonth = new Date()
        startOfMonth.setDate(1)
        startOfMonth.setHours(0, 0, 0, 0)
        
        const getPatientsForRegistry = (id: string) => {
          if (id === 'hf') {
            return allPatients.filter(p => p.registryId === 'hf' || p.hfType === 'HFrEF' || p.hfType === 'HFmrEF' || p.hfType === 'HFpEF' || p.studyConsented)
          }
          return allPatients.filter(p => p.registryId === id)
        }

        const hfPatients = getPatientsForRegistry('hf')
        
        // Fetch visits for HF patients to calculate medications, labs, and QoL completeness
        const visitsPromises = hfPatients.map(async (p) => {
          try {
            return await getVisits(p.id)
          } catch (e) {
            console.warn(`Failed to fetch visits for patient ${p.id}`, e)
            return []
          }
        })
        const visitsResults = await Promise.all(visitsPromises)
        const hfVisits = visitsResults.flat()

        // 6 clinical category definitions matching the detail page
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
          const updatedCategories = r.categories.map(cat => {
            if (r.id === 'hf') {
              return { ...cat, pct: categoryAverages[cat.name] || 0 }
            }
            return { ...cat, pct: regPatients.length ? cat.pct : 0 }
          })
          
          const updatedCompletion = regPatients.length
            ? Math.round(updatedCategories.reduce((sum, c) => sum + c.pct, 0) / updatedCategories.length)
            : 0

          // Calculate average LVEF if it is HF registry
          let quickStats = r.quickStats
          if (r.id === 'hf') {
            const lvefVals = regPatients.map(p => p.lvef).filter(v => v !== undefined && v !== null && typeof v === 'number') as number[]
            const avgLvef = lvefVals.length ? Math.round(lvefVals.reduce((a, b) => a + b, 0) / lvefVals.length) : 32
            quickStats = r.quickStats.map(stat => {
              if (stat.label === 'Avg LVEF') {
                return { ...stat, value: `${avgLvef}%` }
              }
              return stat
            })
          } else {
            quickStats = r.quickStats.map(stat => ({
              ...stat,
              value: regPatients.length ? stat.value : '—'
            }))
          }

          return {
            ...r,
            patients: regPatients.length,
            newThisMonth: newThisMonth,
            categories: updatedCategories,
            completion: updatedCompletion,
            quickStats: quickStats
          }
        }))
      } catch (error) {
        console.error('Failed to load registry statistics:', error)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  const totalPatients = registries.reduce((s, r) => s + r.patients, 0)
  const avgCompletion = Math.round(registries.reduce((s, r) => s + r.completion, 0) / registries.length)
  const activeCount   = registries.filter(r => r.status === 'Active' && r.patients > 0).length
  const newThisMonth  = registries.reduce((s, r) => s + r.newThisMonth, 0)


  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3">
        <Activity className="w-8 h-8 text-blue-500 animate-spin" />
        <p className="text-sm text-gray-400">Loading registry dashboard...</p>
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
          <div key={s.label} className="glass-card p-4 flex items-center gap-3 border border-blue-500/10">
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
            <div className="px-5 py-4 flex items-center justify-between" style={{ background: reg.gradient }}>
              <div className="min-w-0">
                <p className="text-sm font-bold text-white truncate">{reg.name}</p>
                <p className="text-[11px] mt-0.5 truncate" style={{ color: 'rgba(255,255,255,0.75)' }}>{reg.shortDesc}</p>
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
                      <div className="h-1 rounded-full bg-white/[0.07] overflow-hidden">
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
              <div className="grid grid-cols-3 gap-2 pt-1 border-t border-white/[0.05]">
                {reg.quickStats.map(qs => (
                  <div key={qs.label} className="text-center">
                    <p className="text-sm font-bold text-white">{qs.value}</p>
                    <p className="text-[9px] text-gray-500 leading-tight mt-0.5">{qs.label}</p>
                  </div>
                ))}
              </div>

              {/* Footer row */}
              <div className="flex items-center justify-between pt-1 border-t border-white/[0.05]">
                <div className="flex items-center gap-3 text-[10px] text-gray-500">
                  <span className="flex items-center gap-1">
                    <Users size={11} /> {reg.patients.toLocaleString()} pts
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock size={11} /> {lastEntryLabel(reg.lastEntryDaysAgo)}
                  </span>
                  <span className="flex items-center gap-1 text-emerald-500/70">
                    <TrendingUp size={11} /> +{reg.newThisMonth} this month
                  </span>
                </div>
                <Link
                  href={`/registry-home/${reg.id}`}
                  className="flex items-center gap-1 text-[11px] font-medium px-3 py-1.5 rounded-lg transition-all"
                  style={{ background: `${reg.ringColor}20`, color: reg.ringColor, border: `1px solid ${reg.ringColor}30` }}
                >
                  Analytics <ArrowRight size={11} />
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
