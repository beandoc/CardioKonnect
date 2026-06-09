'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { getPatients, getAllLatestVisits } from '@/lib/firestore'
import type { Patient, Visit } from '@/lib/types'
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

export default function DashboardPage() {
  const [rows, setRows] = useState<PatientRow[]>([])
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)

  const greeting = getGreeting(mounted ? new Date().getHours() : 9)
  const GreetIcon = greeting.icon

  const loadData = async () => {
    setLoading(true)
    try {
      const [pts, latestVisitMap] = await Promise.all([
        getPatients(),
        getAllLatestVisits(),
      ])
      const withVisits: PatientRow[] = pts.map(p => ({
        patient: p,
        latest: latestVisitMap.get(p.id) || null,
      }))
      setRows(withVisits)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setMounted(true)
    loadData()
  }, [])

  const total     = rows.length
  const hfrEF     = rows.filter(r => r.latest?.hfType === 'HFrEF').length
  const nyha34    = rows.filter(r => r.latest?.nyha === 'III' || r.latest?.nyha === 'IV').length
  const withHosp  = rows.filter(r => r.latest?.hospHistory === 'Yes').length
  const adherenceScore = rows.length > 0
    ? Math.round(['raasi','betaBlocker','mra','sglt2i'].reduce((acc, key) => {
        const prescribed = rows.filter(r => r.latest?.hfType === 'HFrEF' && (r.latest?.[key as keyof Visit] as { prescribed?: string })?.prescribed === 'Yes').length
        return acc + (prescribed / Math.max(hfrEF, 1)) * 25
      }, 0))
    : 0

  const kpis = [
    {
      label: 'Total Patients',
      value: total,
      sub: 'Registered in registry',
      color: '#3b82f6',
      colorKey: 'blue',
      icon: Users,
    },
    {
      label: 'HFrEF',
      value: hfrEF,
      sub: total ? `${Math.round(hfrEF/total*100)}% of cohort` : 'No data',
      color: '#f43f5e',
      colorKey: 'rose',
      icon: Heart,
    },
    {
      label: 'NYHA III / IV',
      value: nyha34,
      sub: 'Advanced symptoms',
      color: '#f59e0b',
      colorKey: 'amber',
      icon: Activity,
    },
    {
      label: 'Guideline Adherence',
      value: `${adherenceScore}%`,
      sub: '4-pillar therapy (HFrEF)',
      color: '#10b981',
      colorKey: 'emerald',
      icon: CheckCircle,
    },
    {
      label: 'Hospitalisations',
      value: withHosp,
      sub: 'H/O prior admission',
      color: '#8b5cf6',
      colorKey: 'violet',
      icon: Hospital,
    },
    {
      label: 'Active Alerts',
      value: '—',
      sub: 'Patients needing review',
      color: '#06b6d4',
      colorKey: 'cyan',
      icon: Bell,
    },
  ]

  return (
    <div className="space-y-6 animate-fade-in">

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
          {/* Left — greeting */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <GreetIcon className="w-5 h-5" style={{ color: '#fcd34d' }} />
              <span className="text-sm font-medium" style={{ color: 'rgba(148,163,184,0.7)' }}>
                {mounted ? format(new Date(), 'EEEE, MMMM d, yyyy') : 'Loading date...'}
              </span>
            </div>
            <h1 className="text-4xl font-semibold text-white mb-2 leading-tight" style={{ fontFamily: 'Playfair Display, serif' }}>
              {greeting.text}, <br />
              <span className="text-white block font-extrabold" style={{ fontSize: '2.5rem', letterSpacing: '-0.02em', textShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                Dr. A. Jayachandra
              </span>
            </h1>
            <p className="text-base" style={{ color: 'rgba(148,163,184,0.7)' }}>{greeting.sub}</p>
            {/* Roles */}
            <div className="flex gap-2 mt-3 flex-wrap">
              {['RegistryOwner', 'Cardiologist', 'AICTS Pune'].map(role => (
                <span key={role} className="badge badge-blue text-[10px]">
                  <Shield className="w-2.5 h-2.5" /> {role}
                </span>
              ))}
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
                Hope you&apos;re having a fantastic day! You have {total} patients in the registry.
                {nyha34 > 0 && ` ${nyha34} patients are in NYHA Class III/IV — consider reviewing their management.`}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── KPI Grid ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {kpis.map(kpi => (
          <div key={kpi.label} className={`kpi-card ${kpi.colorKey}`}>
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
            <p className="text-[10px] mt-1" style={{ color: 'rgba(148,163,184,0.45)' }}>{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Main Content Grid ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Recent Patients — spans 2 cols */}
        <div className="lg:col-span-2 glass-card p-0 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(59,130,246,0.1)' }}>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4" style={{ color: '#3b82f6' }} />
              <h3 className="text-sm font-semibold text-white">Recent Registry Entries</h3>
              {!loading && (
                <span className="badge badge-blue text-[10px]">{total} total</span>
              )}
            </div>
            <Link href="/patients">
              <button className="btn-outline btn-sm flex items-center gap-1">
                View all <ChevronRight className="w-3 h-3" />
              </button>
            </Link>
          </div>

          {loading ? (
            <div className="p-5 space-y-3">
              {[1,2,3,4].map(i => (
                <div key={i} className="shimmer h-14 rounded-xl" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-4">
              <Database className="w-12 h-12 mb-3 text-blue-500/40 animate-pulse" />
              <p className="text-sm font-bold text-white">No Patients in Registry Yet</p>
              <p className="text-xs text-gray-400 mt-1 max-w-md mx-auto">
                Upload your HF.xlsx spreadsheet to import patient records, or add a patient manually.
              </p>
              <div className="flex gap-3 justify-center mt-5 flex-wrap">
                <Link href="/seed">
                  <button className="btn-primary btn-sm flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5" /> Import from Excel
                  </button>
                </Link>
                <Link href="/patients/new">
                  <button className="btn-outline btn-sm flex items-center gap-1.5">
                    <PlusCircle className="w-3.5 h-3.5" /> Add Patient
                  </button>
                </Link>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="registry-table">
                <thead>
                  <tr>
                    <th>Patient</th>
                    <th>HF Phenotype</th>
                    <th>NYHA</th>
                    <th>LVEF</th>
                    <th>Last Visit</th>
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
                            <p className="text-[10px]" style={{ color: 'rgba(148,163,184,0.4)' }}>
                              {p.mrn || p.id.slice(0,8)}
                            </p>
                          </div>
                        </Link>
                      </td>
                      <td>
                        {latest?.hfType
                          ? <span className={`badge ${latest.hfType === 'HFrEF' ? 'badge-red' : latest.hfType === 'HFpEF' ? 'badge-blue' : 'badge-amber'}`}>{latest.hfType}</span>
                          : <span style={{ color: 'rgba(148,163,184,0.25)' }}>—</span>}
                      </td>
                      <td>
                        {latest?.nyha
                          ? <span className={`badge ${latest.nyha === 'III' || latest.nyha === 'IV' ? 'badge-red' : 'badge-gray'}`}>Class {latest.nyha}</span>
                          : <span style={{ color: 'rgba(148,163,184,0.25)' }}>—</span>}
                      </td>
                      <td>
                        {latest?.lvef != null
                          ? <span className="font-bold text-sm" style={{ color: latest.lvef < 40 ? '#f43f5e' : latest.lvef < 50 ? '#f59e0b' : '#10b981' }}>
                              {latest.lvef}%
                            </span>
                          : <span style={{ color: 'rgba(148,163,184,0.25)' }}>—</span>}
                      </td>
                      <td>
                        <span className="text-xs" style={{ color: 'rgba(148,163,184,0.5)' }}>
                          {latest ? formatDate(latest.visitDate) : 'No visits'}
                        </span>
                      </td>
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

        {/* Right Panel */}
        <div className="space-y-4">

          {/* Guideline Adherence */}
          <div className="glass-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle className="w-4 h-4" style={{ color: '#10b981' }} />
              <h3 className="text-sm font-semibold text-white">Guideline Adherence</h3>
            </div>
            <div className="space-y-3">
              {[
                { label: 'RAASi',        key: 'raasi',       color: '#3b82f6' },
                { label: 'Beta Blocker', key: 'betaBlocker', color: '#10b981' },
                { label: 'MRA',          key: 'mra',         color: '#8b5cf6' },
                { label: 'SGLT2i',       key: 'sglt2i',      color: '#f59e0b' },
              ].map(item => {
                const prescribed = rows.filter(r => {
                  const med = r.latest?.[item.key as keyof Visit] as { prescribed?: string } | undefined
                  return med?.prescribed === 'Yes'
                }).length
                const pct = hfrEF > 0 ? Math.round((prescribed / hfrEF) * 100) : 0
                return (
                  <div key={item.key}>
                    <div className="flex justify-between text-xs mb-1">
                      <span style={{ color: 'rgba(148,163,184,0.7)' }}>{item.label}</span>
                      <span className="font-bold" style={{ color: item.color }}>{pct}%</span>
                    </div>
                    <div className="progress-track">
                      <div className="progress-fill" style={{ width: `${pct}%`, background: item.color }} />
                    </div>
                  </div>
                )
              })}
            </div>
            <p className="text-[10px] mt-3" style={{ color: 'rgba(148,163,184,0.35)' }}>Among HFrEF patients only</p>
          </div>

          {/* Quick Actions */}
          <div className="glass-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="w-4 h-4" style={{ color: '#f59e0b' }} />
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
                  <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 text-left group"
                    style={{ background: 'rgba(15,26,61,0.6)', border: '1px solid rgba(59,130,246,0.1)' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = `${a.color}40`; (e.currentTarget as HTMLElement).style.background = `${a.color}0d`; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(59,130,246,0.1)'; (e.currentTarget as HTMLElement).style.background = 'rgba(15,26,61,0.6)'; }}
                  >
                    <a.icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: a.color }} />
                    <span style={{ color: 'rgba(148,163,184,0.8)' }}>{a.label}</span>
                    <ChevronRight className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: a.color }} />
                  </button>
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
          <span className="text-[10px] px-2 py-1 rounded-lg" style={{ background: 'rgba(139,92,246,0.1)', color: '#c4b5fd', border: '1px solid rgba(139,92,246,0.2)' }}>
            Auto-computed from latest visit data
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { title: '4-Pillar Candidates',    desc: 'HFrEF eligible for full GDMT', value: hfrEF, color: '#3b82f6' },
            { title: 'CRT Candidates',         desc: 'LBBB / QRS ≥130ms + LVEF <35%', value: '—',   color: '#8b5cf6' },
            { title: 'Iron Deficiency',        desc: 'Ferritin <100 µg/L documented',  value: '—',   color: '#10b981' },
            { title: 'NYHA III/IV High Risk',  desc: 'Advanced symptoms — urgent review', value: nyha34, color: '#f43f5e' },
            { title: 'AF + No Anticoagulation',desc: 'AF not on NOAC/VKI',             value: '—',   color: '#f59e0b' },
            { title: 'Uncontrolled DM',        desc: 'HbA1c >8% in DM patients',       value: '—',   color: '#06b6d4' },
          ].map(c => (
            <div key={c.title} className="rounded-xl p-4 transition-all duration-200 hover:transform hover:-translate-y-1"
              style={{ background: `${c.color}0d`, border: `1px solid ${c.color}25` }}>
              <p className="text-2xl font-bold mb-1" style={{ color: c.color, fontFamily: 'Space Grotesk, sans-serif' }}>
                {loading ? '—' : c.value}
              </p>
              <p className="text-xs font-semibold text-white mb-1 leading-tight">{c.title}</p>
              <p className="text-[10px]" style={{ color: 'rgba(148,163,184,0.45)' }}>{c.desc}</p>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
