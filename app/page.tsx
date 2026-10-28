'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { getPatients, getAllLatestVisits, getAllCathProcedures, getResolvedAlertIds } from '@/lib/firestore'
import { complicationFlags } from '@/lib/complications'
import type { Patient, Visit, CathProcedure } from '@/lib/types'
import { getAge, formatDate, initials, lvefColor, hfTypeBadgeColor, nyhaBadgeColor, cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  Users, Heart, Activity, Hospital, PlusCircle, TrendingUp,
  FileText, ChevronRight, Moon, Sun, Calendar, Clock,
  CheckCircle, Zap, BarChart3, AlertTriangle, Database,
  FlaskConical, Bell, Shield,
} from 'lucide-react'

interface PatientRow { patient: Patient; latest: Visit | null }

function getGreeting(h: number) {
  if (h < 12) return { text: 'Good Morning', icon: Sun, sub: 'Start the day strong ☀️' }
  if (h < 17) return { text: 'Good Afternoon', icon: Sun, sub: 'Hope the clinic is going well 🩺' }
  return { text: 'Good Evening', icon: Moon, sub: 'Keep pushing forward 💪' }
}

function LiveClock() {
  const [time, setTime] = useState<Date | null>(null)
  useEffect(() => {
    setTime(new Date())
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  if (!time) return null
  return <>{format(time, 'hh:mm:ss aa')}</>
}

function RingGauge({ value, max = 100, color, size = 56 }: { value: number; max?: number; color: string; size?: number }) {
  const r = (size - 8) / 2
  const circ = 2 * Math.PI * r
  const pct = Math.min(value / max, 1)
  return (
    <svg width={size} height={size}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(59,130,246,0.1)" strokeWidth={5} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={5}
        strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 1s ease', transformOrigin: 'center', transform: 'rotate(-90deg)' }}
      />
    </svg>
  )
}

function PatientCard({ patient, latest }: { patient: Patient; latest: Visit | null }) {
  return (
    <Link href={`/patients/${patient.id}`}>
      <div className="glass-card p-4 cursor-pointer group" style={{ minWidth: '220px' }}>
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}>
            {initials(patient.firstName, patient.lastName)}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate group-hover:text-blue-300 transition-colors">
              {patient.firstName} {patient.lastName}
            </p>
            <p className="text-[10px]" style={{ color: 'rgba(148,163,184,0.5)' }}>
              {patient.mrn || patient.id.slice(0, 8)} · {getAge(patient.dob) ?? '—'} yrs
            </p>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex gap-1.5 flex-wrap">
            {latest?.hfType && (
              <span className="badge badge-blue text-[10px]">{latest.hfType}</span>
            )}
            {latest?.nyha && (
              <span className="badge badge-violet text-[10px]">NYHA {latest.nyha}</span>
            )}
          </div>
          {latest?.lvef != null && (
            <div className="text-right">
              <p className="text-xs font-bold" style={{ color: latest.lvef < 40 ? '#f43f5e' : latest.lvef < 50 ? '#f59e0b' : '#10b981' }}>
                {latest.lvef}%
              </p>
              <p className="text-[9px]" style={{ color: 'rgba(148,163,184,0.4)' }}>LVEF</p>
            </div>
          )}
        </div>
        {latest && (
          <p className="text-[10px] mt-2 pt-2" style={{ color: 'rgba(148,163,184,0.4)', borderTop: '1px solid rgba(59,130,246,0.08)' }}>
            Last visit {formatDate(latest.visitDate)}
          </p>
        )}
      </div>
    </Link>
  )
}

import { useAppUser } from '@/context/AppUserContext'
import { SITES } from '@/lib/appConfig'
import { filterPatientsByAccess } from '@/lib/accessControl'

export default function DashboardPage() {
  const { currentUser } = useAppUser()
  const [rows, setRows] = useState<PatientRow[]>([])
  const [procedures, setProcedures] = useState<CathProcedure[]>([])
  const [activeAlertsCount, setActiveAlertsCount] = useState<number>(0)
  const [ironDefCount, setIronDefCount] = useState<number>(0)
  const [afNoOacCount, setAfNoOacCount] = useState<number>(0)
  const [uncontrolledDmCount, setUncontrolledDmCount] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)
  const [dbError, setDbError] = useState<string | null>(null)

  const greeting = getGreeting(mounted ? new Date().getHours() : 9)
  const GreetIcon = greeting.icon

  const loadData = async () => {
    setLoading(true)
    setDbError(null)
    try {
      const [allPts, latestVisitMap, allProcs, resolvedAlertIds] = await Promise.all([
        getPatients(),
        getAllLatestVisits(),
        getAllCathProcedures(),
        getResolvedAlertIds(),
      ])

      const accessiblePts = filterPatientsByAccess(currentUser, allPts)
      const accessiblePatientIds = new Set(accessiblePts.map(p => p.id))
      const accessibleProcs = allProcs.filter(p => p.patientId && accessiblePatientIds.has(p.patientId))
      setProcedures(accessibleProcs)

      const withVisits: PatientRow[] = accessiblePts.map(p => ({
        patient: p,
        latest: latestVisitMap.get(p.id) || null,
      }))

      // Sort rows chronologically descending by latest clinical activity or enrollment
      withVisits.sort((a, b) => {
        const timeA = new Date(a.latest?.visitDate || a.patient.indexDate || a.patient.createdAt || 0).getTime()
        const timeB = new Date(b.latest?.visitDate || b.patient.indexDate || b.patient.createdAt || 0).getTime()
        return timeB - timeA
      })
      setRows(withVisits)

      // ── Live Active Alerts Calculation (Matching /alerts audit logic) ───
      const dynamicAlerts: { id: string }[] = []
      accessiblePts.forEach(p => {
        const latest = latestVisitMap.get(p.id)
        if (latest) {
          if (latest.ntProBNP && latest.ntProBNP > 2000) {
            dynamicAlerts.push({ id: `ntprobnp-${p.id}-${latest.id}` })
          }
          if (latest.egfr && latest.egfr < 45) {
            dynamicAlerts.push({ id: `egfr-${p.id}-${latest.id}` })
          }
          if (latest.potassium && latest.potassium > 5.5) {
            dynamicAlerts.push({ id: `potassium-high-${p.id}-${latest.id}` })
          }
          if (latest.potassium && latest.potassium < 3.5) {
            dynamicAlerts.push({ id: `potassium-low-${p.id}-${latest.id}` })
          }
        }
      })
      accessibleProcs.forEach(proc => {
        if (complicationFlags(proc).hasComplication) {
          dynamicAlerts.push({ id: `proc-comp-${proc.id}` })
        }
      })
      const openAlerts = dynamicAlerts.filter(a => !resolvedAlertIds.has(a.id)).length
      setActiveAlertsCount(openAlerts)

      // ── Research Cohorts Calculation ───
      // 1. Iron Deficiency: Ferritin < 100 or Ferritin <= 299 with TSAT < 20%
      const ironCount = withVisits.filter(r => {
        const ferritin = r.latest?.ferritin
        const tsat = r.latest?.transferrinSat
        return (
          (ferritin != null && ferritin < 100) ||
          (ferritin != null && ferritin <= 299 && tsat != null && tsat < 20) ||
          r.patient.comorbidities?.some(c => c.toLowerCase().includes('iron')) ||
          (r.patient as any).comorbidIronDeficiency === true
        )
      }).length
      setIronDefCount(ironCount)

      // 2. AF without Anticoagulation: AF rhythm or comorbidity without NOAC / VKI
      const afCount = withVisits.filter(r => {
        const hasAF = r.latest?.rhythm === 'AF' || r.patient.comorbidities?.some(c => c.toLowerCase().includes('atrial fib') || c.toLowerCase() === 'af')
        const onOAC = r.latest?.noac?.prescribed === 'Yes' || r.latest?.vki?.prescribed === 'Yes' || (r.patient as any).anticoagulation === 'Yes'
        return hasAF && !onOAC
      }).length
      setAfNoOacCount(afCount)

      // 3. Uncontrolled Diabetes: DM comorbidity or diagnosed, with HbA1c > 8.0%
      const dmCount = withVisits.filter(r => {
        const hasDM = r.patient.comorbidities?.some(c => c.toLowerCase().includes('diabet') || c.toLowerCase().includes('dm') || c.toLowerCase().includes('t2dm')) || (r.latest?.hba1c != null)
        const hba1c = r.latest?.hba1c ?? r.latest?.dmManagement?.hba1c
        return hasDM && hba1c != null && hba1c > 8.0
      }).length
      setUncontrolledDmCount(dmCount)

    } catch (e) {
      console.error('Dashboard data load error:', e)
      setDbError(`Failed to load patient data from database: ${e instanceof Error ? e.message : 'unknown error'}`)
      setRows([])
      setProcedures([])
      setActiveAlertsCount(0)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setMounted(true)
    loadData()
  }, [currentUser])

  const total     = rows.length
  const hfrEF     = rows.filter(r => (r.latest?.hfType || r.patient.hfType) === 'HFrEF').length
  const nyha34    = rows.filter(r => {
    const nyha = r.latest?.nyha || r.patient.nyha
    return nyha === 'III' || nyha === 'IV'
  }).length
  const withHosp  = rows.filter(r => (r.latest?.hospHistory || (r.patient as any).hospHistory) === 'Yes' || ((r.latest?.hospCount ?? 0) > 0)).length
  
  // 4-pillar GDMT adherence
  const raasiCount = rows.filter(r => (r.latest?.hfType || r.patient.hfType) === 'HFrEF' && (r.latest?.raasi?.prescribed === 'Yes' || (r.patient as any)?.raasi?.prescribed === 'Yes')).length
  const bbCount = rows.filter(r => (r.latest?.hfType || r.patient.hfType) === 'HFrEF' && (r.latest?.betaBlocker?.prescribed === 'Yes' || (r.patient as any)?.betaBlocker?.prescribed === 'Yes')).length
  const mraCount = rows.filter(r => (r.latest?.hfType || r.patient.hfType) === 'HFrEF' && (r.latest?.mra?.prescribed === 'Yes' || (r.patient as any)?.mra?.prescribed === 'Yes')).length
  const sglt2iCount = rows.filter(r => (r.latest?.hfType || r.patient.hfType) === 'HFrEF' && (r.latest?.sglt2i?.prescribed === 'Yes' || (r.patient as any)?.sglt2i?.prescribed === 'Yes')).length

  const raasiPct = hfrEF > 0 ? Math.round((raasiCount / hfrEF) * 100) : 0
  const bbPct = hfrEF > 0 ? Math.round((bbCount / hfrEF) * 100) : 0
  const mraPct = hfrEF > 0 ? Math.round((mraCount / hfrEF) * 100) : 0
  const sglt2iPct = hfrEF > 0 ? Math.round((sglt2iCount / hfrEF) * 100) : 0
  const adherenceScore = hfrEF > 0 ? Math.round((raasiPct + bbPct + mraPct + sglt2iPct) / 4) : 0

  const crtCandidates = rows.filter(r => {
    const ef = r.latest?.lvef ?? r.patient?.lvef
    const qrs = r.latest?.qrsDuration
    const bbb = r.latest?.bbb || (r.patient as any)?.bbb
    const dev = (r.latest?.device || (r.patient as any)?.device || [])
    const hasCRT = dev.includes('CRT-D') || dev.includes('CRT-P')
    // Criterion: (LBBB OR QRS in ECG >= 130ms) AND Ejection Fraction on 2D Echo < 35%
    return (ef != null && ef < 35) && (bbb === 'LBBB' || (qrs != null && qrs >= 130)) && !hasCRT
  }).length

  const activeSiteName = currentUser?.siteId && SITES[currentUser.siteId]
    ? SITES[currentUser.siteId].shortName
    : 'AICTS Pune'

  const isCathLabPI = currentUser?.id === 'DR_RAJEEV_CHAUHAN' || (currentUser?.registryAccess?.length === 1 && currentUser?.registryAccess[0] === 'cathlab')

  // Cath Lab Procedure metrics (Dr. Rajeev Chauhan)
  const radialCount = procedures.filter(p => p.accessSite && p.accessSite.toLowerCase().includes('radial')).length
  const radialRate = procedures.length > 0 ? Math.round((radialCount / procedures.length) * 100) : 0
  const timi3Count = procedures.filter(p => (p as any).postTimiFlow === 'TIMI 3' || (p as any).postTimiFlow === 3 || p.lesions?.some(l => l.postTimiFlow === 3) || p.overallSuccess === true).length
  const timi3Rate = procedures.length > 0 ? Math.round((timi3Count / procedures.length) * 100) : 0

  interface KpiItem {
    label: string
    value: string | number
    sub: string
    color: string
    colorKey: string
    icon: any
    href?: string
  }

  const kpis: KpiItem[] = isCathLabPI
    ? [
        {
          label: 'Total Patients',
          value: total,
          sub: 'Registered at Kanpur Apex',
          color: '#3b82f6',
          colorKey: 'blue',
          icon: Users,
          href: '/patients',
        },
        {
          label: 'Target Registry',
          value: 'Cath Lab',
          sub: 'Interventional Cardiology',
          color: '#f59e0b',
          colorKey: 'amber',
          icon: Activity,
          href: '/registry-home/cathlab',
        },
        {
          label: 'Radial Access',
          value: procedures.length > 0 ? `${radialRate}%` : '—',
          sub: procedures.length > 0 ? `${radialCount}/${procedures.length} Radial-First` : 'No procedures yet',
          color: '#10b981',
          colorKey: 'emerald',
          icon: CheckCircle,
          href: '/procedures',
        },
        {
          label: 'Angio Success',
          value: timi3Rate > 0 ? `${timi3Rate}%` : (procedures.length > 0 ? `${procedures.length} done` : '—'),
          sub: 'Post-PCI Procedural Flow',
          color: '#8b5cf6',
          colorKey: 'violet',
          icon: Zap,
          href: '/procedures',
        },
        {
          label: 'Primary Hospital',
          value: 'Apex Kanpur',
          sub: 'Kanpur Cardiac Apex Hospital',
          color: '#06b6d4',
          colorKey: 'cyan',
          icon: Hospital,
        },
        {
          label: 'Active Alerts',
          value: activeAlertsCount,
          sub: activeAlertsCount > 0 ? `${activeAlertsCount} alerts require review` : 'All audits clean',
          color: '#ec4899',
          colorKey: 'rose',
          icon: Bell,
          href: '/alerts',
        },
      ]
    : [
        {
          label: 'Total Patients',
          value: total,
          sub: 'Registered in registry',
          color: '#3b82f6',
          colorKey: 'blue',
          icon: Users,
          href: '/patients',
        },
        {
          label: 'HFrEF',
          value: hfrEF,
          sub: total ? `${Math.round(hfrEF / Math.max(total, 1) * 100)}% of cohort` : 'No data',
          color: '#f43f5e',
          colorKey: 'rose',
          icon: Heart,
          href: '/patients',
        },
        {
          label: 'NYHA III / IV',
          value: nyha34,
          sub: 'Advanced symptoms',
          color: '#f59e0b',
          colorKey: 'amber',
          icon: Activity,
          href: '/patients',
        },
        {
          label: 'Guideline Adherence',
          value: `${adherenceScore}%`,
          sub: '4-pillar therapy (HFrEF)',
          color: '#10b981',
          colorKey: 'emerald',
          icon: CheckCircle,
          href: '/analytics',
        },
        {
          label: 'Hospitalisations',
          value: withHosp,
          sub: 'H/O prior admission',
          color: '#8b5cf6',
          colorKey: 'violet',
          icon: Hospital,
          href: '/patients',
        },
        {
          label: 'Active Alerts',
          value: activeAlertsCount,
          sub: activeAlertsCount > 0 ? `${activeAlertsCount} patients need review` : 'All clinical audits clean',
          color: '#06b6d4',
          colorKey: 'cyan',
          icon: Bell,
          href: '/alerts',
        },
      ]

  return (
    <div className="space-y-6 animate-fade-in">

      {/* ── Database Error Banner ────────────────────────────────── */}
      {dbError && (
        <div className="p-4 bg-red-950/30 border border-red-500/40 rounded-lg flex items-start gap-3 text-red-300 text-sm animate-fade-in">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-400" />
          <div className="flex-1">
            <p className="font-semibold">Database Connection Error</p>
            <p className="text-red-300/80 mt-1">{dbError}</p>
          </div>
          <button
            onClick={loadData}
            className="ml-2 px-3 py-1.5 rounded bg-red-500/20 hover:bg-red-500/30 text-red-300 text-xs font-semibold whitespace-nowrap transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── Hero Banner ──────────────────────────────────────────── */}
      <div className="relative rounded-2xl overflow-hidden p-6 hero-gradient"
        style={{
          border: '1px solid rgba(59,130,246,0.2)',
        }}>
        {/* Decorative glow */}
        <div className="absolute top-0 right-0 w-72 h-72 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)', transform: 'translate(30%, -30%)' }} />
        <div className="absolute bottom-0 left-1/3 w-48 h-48 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%)' }} />

        <div className="relative flex items-start justify-between flex-wrap gap-4">
          {/* Left — generic institutional greeting */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <GreetIcon className="w-5 h-5" style={{ color: '#fcd34d' }} />
              <span className="text-sm font-medium" style={{ color: 'rgba(148,163,184,0.7)' }}>
                {mounted ? format(new Date(), 'EEEE, MMMM d, yyyy') : 'Loading date...'}
              </span>
            </div>
            <h1 className="text-4xl font-semibold text-white mb-2 leading-tight" style={{ fontFamily: 'Playfair Display, serif' }}>
              {greeting.text}, <br />
              <span className="text-white block font-extrabold" style={{ fontSize: '2.3rem', letterSpacing: '-0.02em', textShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                CardioKonnect Registry Suite
              </span>
            </h1>
            <p className="text-base" style={{ color: 'rgba(148,163,184,0.7)' }}>
              Multi-Center Cardiovascular Clinical & Interventional Registry Network
            </p>
            {/* Active User Badges */}
            <div className="flex gap-2 mt-3 flex-wrap items-center">
              <span className="badge badge-blue text-[11px] font-semibold">
                <Shield className="w-3 h-3" /> Logged in: {currentUser?.name || 'Dr. A. Jayachandra'}
              </span>
              <span className="badge badge-violet text-[10px]">
                {currentUser?.role || 'RegistryOwner'}
              </span>
              <span className="badge badge-gray text-[10px]">
                {activeSiteName}
              </span>
            </div>
          </div>

          {/* Right — status cards */}
          <div className="flex gap-3 flex-wrap">
            {[
              { icon: Calendar, label: 'Day', value: mounted ? format(new Date(), 'EEEE') : '...' },
              { icon: CheckCircle, label: 'Status', value: 'Active', green: true },
              { icon: Clock, label: 'Time', value: mounted ? <LiveClock /> : '...', mono: true },
            ].map(item => (
              <div key={item.label} className="dark-card px-4 py-3 min-w-[120px]">
                <div className="flex items-center gap-1.5 mb-1">
                  <item.icon className="w-3 h-3" style={{ color: 'rgba(148,163,184,0.5)' }} />
                  <span className="text-[10px] uppercase tracking-wider" style={{ color: 'rgba(148,163,184,0.5)' }}>
                    {item.label}
                  </span>
                </div>
                <p className={`text-sm font-semibold ${item.green ? 'text-emerald-400' : 'text-white'} ${item.mono ? 'font-mono' : ''}`}>
                  {item.value}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Today's Note */}
        <div className="mt-4 pt-4" style={{ borderTop: '1px solid rgba(59,130,246,0.12)' }}>
          <div className="flex items-start gap-2">
            <FileText className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: 'rgba(148,163,184,0.4)' }} />
            <div>
              <p className="text-xs font-semibold mb-0.5" style={{ color: 'rgba(148,163,184,0.5)' }}>Today&apos;s Note</p>
              <p className="text-sm" style={{ color: 'rgba(148,163,184,0.75)' }}>
                {isCathLabPI
                  ? `Welcome, Dr. Rajeev Chauhan! You have ${total} patients registered in the Cath Lab & Interventional Registry at Kanpur Cardiac Apex Hospital.`
                  : `Hope you're having a fantastic day! You have ${total} patients in the registry.${nyha34 > 0 ? ` ${nyha34} patients are in NYHA Class III/IV — consider reviewing their management.` : ''}`}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── KPI Grid ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {kpis.map(kpi => {
          const cardContent = (
            <div className={`kpi-card ${kpi.colorKey} ${kpi.href ? 'hover:border-opacity-80 transition cursor-pointer' : ''}`}>
              <div className="flex items-start justify-between mb-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: `${kpi.color}20`, border: `1px solid ${kpi.color}30` }}>
                  <kpi.icon className="w-4 h-4" style={{ color: kpi.color }} />
                </div>
                {typeof kpi.value === 'number' && kpi.value > 0 && (
                  <div style={{ position: 'absolute', top: 16, right: 16, opacity: 0.15 }}>
                    <RingGauge value={kpi.value} max={Math.max(total, kpi.value, 1)} color={kpi.color} size={44} />
                  </div>
                )}
              </div>
              <p className="text-2xl font-bold text-white mb-0.5" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                {loading ? '—' : kpi.value}
              </p>
              <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: kpi.color }}>
                {kpi.label}
              </p>
              <p className="text-[10px] mt-1 text-gray-400 font-medium">{kpi.sub}</p>
            </div>
          )

          return kpi.href ? (
            <Link key={kpi.label} href={kpi.href} className="block group">
              {cardContent}
            </Link>
          ) : (
            <div key={kpi.label}>
              {cardContent}
            </div>
          )
        })}
      </div>

      {/* ── Main content grid: Patient Table + Side Panels ──────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left 2-cols: Recent Patients Table */}
        <div className="lg:col-span-2 glass-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-400" />
              <h3 className="text-sm font-semibold text-white">Recent Enrolled Patients</h3>
              <span className="text-xs text-gray-400 font-mono">({rows.length} total)</span>
            </div>
            <Link href="/patients">
              <button className="btn-ghost btn-sm text-xs flex items-center gap-1">
                View all <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </Link>
          </div>

          {loading ? (
            <div className="space-y-2 py-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-12 rounded-lg bg-slate-800/50 animate-pulse" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-8 h-8 text-gray-400 mx-auto mb-2 opacity-50" />
              <p className="text-sm text-gray-400">No patients enrolled yet</p>
              <Link href="/patients/new">
                <button className="mt-3 btn-primary btn-sm px-4 py-2 rounded-xl text-xs font-semibold">Add first patient</button>
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="registry-table w-full text-xs">
                <thead>
                  <tr>
                    <th>Patient</th>
                    <th>{isCathLabPI ? 'Hospital Site' : 'HF Type'}</th>
                    <th>{isCathLabPI ? 'Registry' : 'NYHA'}</th>
                    <th>{isCathLabPI ? 'Key Comorbidities' : 'LVEF'}</th>
                    <th>{isCathLabPI ? 'Enrolled Status' : 'Last Visit'}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 8).map(({ patient: p, latest }) => (
                    <tr key={p.id}>
                      <td>
                        <Link href={`/patients/${p.id}`} className="flex items-center gap-3 group">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                            style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}>
                            {initials(p.firstName, p.lastName)}
                          </div>
                          <div>
                            <p className="font-medium text-white group-hover:text-blue-300 transition-colors">
                              {p.firstName} {p.lastName}
                            </p>
                            <p className="text-[11px] font-mono text-gray-400">
                              {p.mrn || p.id.slice(0,8)}
                            </p>
                          </div>
                        </Link>
                      </td>
                      {isCathLabPI ? (
                        <>
                          <td>
                            <span className="text-xs text-gray-300 font-medium">
                              {p.siteId === 'KANPUR_APEX' ? 'Apex Hospital Kanpur' : (p.hospitalName || 'Kanpur Apex')}
                            </span>
                          </td>
                          <td>
                            <span className="badge badge-amber text-[10px]">Cath Lab</span>
                          </td>
                          <td>
                            <span className="text-xs text-gray-400">
                              {p.comorbidities && p.comorbidities.length > 0 ? p.comorbidities.slice(0, 2).join(', ') : 'CAD / PCI'}
                            </span>
                          </td>
                          <td>
                            <span className="badge badge-green text-[10px]">
                              {p.status || 'Active'}
                            </span>
                          </td>
                        </>
                      ) : (
                        <>
                          <td>
                            {latest?.hfType
                              ? <span className={`badge ${latest.hfType === 'HFrEF' ? 'badge-red' : latest.hfType === 'HFpEF' ? 'badge-blue' : 'badge-amber'}`}>{latest.hfType}</span>
                              : <span className="text-gray-500">—</span>}
                          </td>
                          <td>
                            {latest?.nyha
                              ? <span className={`badge ${latest.nyha === 'III' || latest.nyha === 'IV' ? 'badge-red' : 'badge-gray'}`}>Class {latest.nyha}</span>
                              : <span className="text-gray-500">—</span>}
                          </td>
                          <td>
                            {latest?.lvef != null
                              ? <span className="font-bold text-sm" style={{ color: latest.lvef < 40 ? '#f43f5e' : latest.lvef < 50 ? '#f59e0b' : '#10b981' }}>
                                  {latest.lvef}%
                                </span>
                              : <span className="text-gray-500">—</span>}
                          </td>
                          <td>
                            <span className="text-xs font-medium text-gray-300">
                              {latest ? formatDate(latest.visitDate) : 'No visits'}
                            </span>
                          </td>
                        </>
                      )}
                      <td>
                        <Link href={`/patients/${p.id}`}>
                          <button className="btn-ghost btn-sm">
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right 1-col: GDMT & Quick Actions */}
        <div className="space-y-6">

          {/* GDMT 4-Pillar Adherence Card */}
          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Heart className="w-4 h-4 text-rose-400" />
                <h3 className="text-sm font-semibold text-white">GDMT 4-Pillar</h3>
              </div>
              <span className="text-xs font-bold text-emerald-400 font-mono">
                {adherenceScore}% Overall
              </span>
            </div>

            <div className="space-y-3">
              {[
                { label: 'RAASi / ARNI',  key: 'raasi',       color: '#3b82f6' },
                { label: 'Beta Blocker',  key: 'betaBlocker', color: '#8b5cf6' },
                { label: 'MRA',           key: 'mra',         color: '#10b981' },
                { label: 'SGLT2i',        key: 'sglt2i',      color: '#f59e0b' },
              ].map(item => {
                const prescribed = rows.filter(r => r.latest?.hfType === 'HFrEF' && (r.latest?.[item.key as keyof Visit] as { prescribed?: string })?.prescribed === 'Yes').length
                const pct = hfrEF > 0 ? Math.round((prescribed / hfrEF) * 100) : 0
                return (
                  <div key={item.key}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium text-gray-300">{item.label}</span>
                      <span className="font-bold" style={{ color: item.color }}>{pct}%</span>
                    </div>
                    <div className="progress-track">
                      <div className="progress-fill" style={{ width: `${pct}%`, background: item.color }} />
                    </div>
                  </div>
                )
              })}
            </div>
            <p className="text-[11px] mt-3 text-gray-400">Among HFrEF patients only</p>
          </div>

          {/* Quick Actions */}
          <div className="glass-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-semibold text-white">Quick Actions</h3>
            </div>
            <div className="space-y-2">
              {[
                { href: '/patients/new', icon: PlusCircle,  label: 'Add New Patient',     color: '#3b82f6' },
                { href: '/analytics',    icon: BarChart3,    label: 'View Analytics',       color: '#10b981' },
                { href: '/risk',         icon: FlaskConical, label: 'Risk Calculators',     color: '#8b5cf6' },
                { href: '/reports',      icon: FileText,     label: 'Export Registry Data', color: '#f59e0b' },
                { href: '/registry',     icon: Database,     label: 'Registry Fields Setup',color: '#06b6d4' },
              ].map(a => (
                <Link key={a.href} href={a.href} className="block">
                  <div className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm transition-all duration-200 text-left group dark-card hover:border-blue-500/30 hover:bg-blue-900/20 cursor-pointer">
                    <a.icon className="w-4 h-4 flex-shrink-0" style={{ color: a.color }} />
                    <span className="font-medium text-gray-200 group-hover:text-blue-300 text-xs">{a.label}</span>
                    <ChevronRight className="w-3.5 h-3.5 ml-auto text-gray-400 group-hover:text-blue-400 opacity-60 group-hover:opacity-100 transition-all" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Research Cohort Profiles ───────────────────────────────── */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <FlaskConical className="w-4 h-4" style={{ color: '#8b5cf6' }} />
            <h3 className="text-sm font-semibold text-white">Research Cohort Profiles</h3>
          </div>
          <span className="text-[10px] px-2 py-1 rounded-lg font-semibold badge-violet">
            Auto-computed from latest visit data
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { title: '4-Pillar Candidates',    desc: 'HFrEF eligible for full GDMT', value: hfrEF, color: '#3b82f6' },
            { title: 'CRT Candidates',         desc: 'LBBB / QRS ≥130ms + LVEF <35%', value: crtCandidates, color: '#8b5cf6' },
            { title: 'Iron Deficiency',        desc: 'Ferritin <100 µg/L documented',  value: ironDefCount,   color: '#10b981' },
            { title: 'NYHA III/IV High Risk',  desc: 'Advanced symptoms — urgent review', value: nyha34, color: '#f43f5e' },
            { title: 'AF + No Anticoagulation',desc: 'AF not on NOAC/VKI',             value: afNoOacCount,   color: '#f59e0b' },
            { title: 'Uncontrolled DM',        desc: 'HbA1c >8% in DM patients',       value: uncontrolledDmCount, color: '#06b6d4' },
          ].map(c => (
            <div key={c.title} className="rounded-xl p-4 transition-all duration-200 hover:transform hover:-translate-y-1 dark-card border"
              style={{ borderColor: `${c.color}35` }}>
              <p className="text-2xl font-bold mb-1" style={{ color: c.color, fontFamily: 'Space Grotesk, sans-serif' }}>
                {loading ? '—' : c.value}
              </p>
              <p className="text-xs font-semibold text-white mb-1 leading-tight">{c.title}</p>
              <p className="text-[10px] text-gray-400">{c.desc}</p>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
