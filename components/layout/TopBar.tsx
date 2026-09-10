'use client'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import { format } from 'date-fns'
import { Bell, Search, Moon, Sun, ChevronRight, Menu, ChevronDown, Building2, Shield, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAppUser } from '@/context/AppUserContext'
import { SITES } from '@/lib/appConfig'
import { toast } from 'sonner'

const TITLES: Record<string, string> = {
  '/':               'Home',
  '/patients':       'Patient Registry',
  '/patients/new':   'New Patient',
  '/analytics':      'Analytics',
  '/reports':        'Registry Reports',
  '/registry':       'Registry Fields',
  '/registry-home':  'Registry Home',
  '/procedures':          'Procedural Audit',
  '/complication-audit':  'Complication Audit',
  '/cohort':         'Cohort Builder',
  '/alerts':         'Clinical Alerts',
  '/risk':           'Risk Calculators',
  '/admin':          'Administration',
  '/settings':       'Settings',
  '/languages':      'Language Master',
  '/deo':            'DEO Data Entry Portal',
}

const BREADCRUMBS: Record<string, string[]> = {
  '/':               ['Home'],
  '/patients':       ['Home', 'Patients'],
  '/analytics':      ['Home', 'Research Tools', 'Analytics'],
  '/reports':        ['Home', 'Registry Tools', 'Reports'],
  '/registry':       ['Home', 'Registry', 'Fields Setup'],
  '/registry-home':  ['Home', 'Registry', 'Registry Home'],
  '/procedures':          ['Home', 'Registry', 'Procedural Audit'],
  '/complication-audit':  ['Home', 'Registry', 'Complication Audit'],
  '/alerts':         ['Home', 'Registry Tools', 'Clinical Alerts'],
  '/admin':          ['Home', 'Admin'],
  '/languages':      ['Home', 'Admin', 'Language Master'],
  '/deo':            ['Home', 'Operator', 'DEO Portal'],
}

interface TopBarProps {
  sidebarOpen?: boolean
  onToggleSidebar?: () => void
}

export default function TopBar({ sidebarOpen = true, onToggleSidebar }: TopBarProps) {
  const path = usePathname()
  const router = useRouter()
  const [time, setTime] = useState<Date | null>(null)
  const [switcherOpen, setSwitcherOpen] = useState(false)
  const switcherRef = useRef<HTMLDivElement>(null)
  const { user, logout } = useAppUser()

  useEffect(() => {
    setTime(new Date())
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (switcherRef.current && !switcherRef.current.contains(e.target as Node)) {
        setSwitcherOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const handleLogout = () => {
    setSwitcherOpen(false)
    toast.info('Logged out of session')
    logout()
  }

  const isPatientDetail   = path.startsWith('/patients/') && path !== '/patients/new' && !path.includes('/visits/')
  const isVisitRecord     = path.includes('/visits/')
  const isRegistryDetail  = path.startsWith('/registry-home/') && path !== '/registry-home'
  const title = isVisitRecord ? 'Record Visit'
    : isPatientDetail ? 'Patient Profile'
    : isRegistryDetail ? 'Registry Analytics'
    : TITLES[path] ?? 'Cardio-Konnect'

  const crumbs = isPatientDetail ? ['Home', 'Patients', 'Profile']
    : isVisitRecord ? ['Home', 'Patients', 'Profile', 'Visit']
    : isRegistryDetail ? ['Home', 'Registry', 'Registry Home', 'Analytics']
    : BREADCRUMBS[path] ?? ['Home']

  const site = user ? SITES[user.siteId] : null

  return (
    <header className="topbar flex items-center justify-between px-4 md:px-6 gap-4">
      {/* Left — breadcrumb & sidebar toggle */}
      <div className="flex items-center gap-2.5 min-w-0">
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="p-2 -ml-2 rounded-xl flex items-center justify-center btn-ghost text-gray-300 hover:text-white transition-colors"
            title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
            aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
          >
            <Menu className="w-5 h-5 text-gray-300" />
          </button>
        )}

        <div className="flex items-center gap-2 min-w-0">
          {crumbs.map((c, i) => (
            <span key={c} className={cn("flex items-center gap-2 min-w-0", i !== crumbs.length - 1 && "hidden sm:flex")}>
              {i > 0 && <ChevronRight className="w-3 h-3 flex-shrink-0 hidden sm:block" style={{ color: 'rgba(148,163,184,0.3)' }} />}
              <span
                className={`text-sm truncate ${i === crumbs.length - 1 ? 'font-semibold text-white' : ''}`}
                style={{ color: i === crumbs.length - 1 ? '#e2e8f0' : 'rgba(148,163,184,0.5)', fontFamily: i === crumbs.length - 1 ? 'Space Grotesk, sans-serif' : 'Inter, sans-serif' }}
              >
                {c}
              </span>
            </span>
          ))}
        </div>
      </div>

      {/* Centre — search */}
      <div className="relative flex-1 max-w-xs hidden md:block">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'rgba(148,163,184,0.4)' }} />
        <input
          placeholder="Search patients, MRN…"
          className="search-input text-xs"
          style={{ width: '100%' }}
        />
      </div>

      {/* Right — actions */}
      <div className="flex items-center gap-3">
        {time && (
          <span className="text-xs hidden lg:block" style={{ color: 'rgba(148,163,184,0.5)' }}>
            {format(time, 'EEE, dd MMM yyyy')} &nbsp;·&nbsp; {format(time, 'HH:mm:ss')}
          </span>
        )}

        {/* Theme Toggle */}
        <button
          onClick={() => {
            const isLight = document.body.classList.toggle('light')
            localStorage.setItem('theme', isLight ? 'light' : 'dark')
          }}
          className="w-9 h-9 rounded-xl flex items-center justify-center btn-ghost"
          title="Toggle Theme"
        >
          <Sun className="w-4 h-4 hidden body.light:block text-amber-400" />
          <Moon className="w-4 h-4 block body.light:hidden" />
        </button>

        {/* Notifications */}
        <button className="relative w-9 h-9 rounded-xl flex items-center justify-center btn-ghost">
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full" style={{ background: '#f43f5e' }} />
        </button>

        {/* User Avatar + Profile Menu */}
        <div className="relative" ref={switcherRef}>
          <button
            onClick={() => setSwitcherOpen(v => !v)}
            className="flex items-center gap-2 pl-2 pr-1 py-1 rounded-xl hover:bg-white/5 transition-colors"
            style={{ borderLeft: '1px solid rgba(59,130,246,0.15)' }}
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm"
              style={{ background: user?.siteId === 'KANPUR_APEX' ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}
            >
              {user?.shortName ?? 'AJ'}
            </div>
            <div className="hidden lg:block text-left">
              <p className="text-xs font-semibold text-white leading-tight">{user?.name ?? 'Dr. A. Jayachandra'}</p>
              <p className="text-[10px]" style={{ color: 'rgba(148,163,184,0.5)' }}>
                {user?.role || 'RegistryOwner'}
                {site ? ` · ${site.shortName}` : ' · AICTS Pune'}
              </p>
            </div>
            <ChevronDown className="w-3.5 h-3.5 hidden lg:block text-gray-500" />
          </button>

          {/* User profile dropdown - Discrete single-doctor session */}
          {switcherOpen && (
            <div
              className="absolute right-0 top-full mt-2 w-80 rounded-2xl border shadow-2xl z-50 overflow-hidden"
              style={{ background: 'rgba(15,26,61,0.98)', borderColor: 'rgba(59,130,246,0.25)', backdropFilter: 'blur(16px)' }}
            >
              {/* Active Doctor Profile Header */}
              <div className="p-4 border-b border-white/[0.08] bg-slate-950/60">
                <div className="flex items-center gap-3">
                  <div
                    className="w-11 h-11 rounded-2xl flex items-center justify-center text-sm font-bold text-white shadow-md flex-shrink-0"
                    style={{ background: user?.siteId === 'KANPUR_APEX' ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}
                  >
                    {user?.shortName || 'AJ'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-bold text-white truncate">{user?.name || 'Dr. A. Jayachandra'}</p>
                    </div>
                    <p className="text-[11px] text-blue-400 font-medium">{user?.role || 'Registry Principal Investigator'}</p>
                    <p className="text-[10px] text-gray-400 truncate">{user?.email || 'doctor@cardiokonnect.in'}</p>
                  </div>
                </div>
              </div>

              {/* Hospital & Registry Scope Details */}
              <div className="p-3.5 space-y-2.5 bg-white/[0.01]">
                <div className="p-3 rounded-xl bg-slate-900/80 border border-white/[0.06] space-y-2 text-xs">
                  <div className="flex items-start gap-2">
                    <Building2 className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">Hospital / Institution</p>
                      <p className="font-semibold text-white leading-snug">{site?.name || 'All India Institute of Cardiothoracic Sciences (AICTS), Pune'}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-white/[0.06] text-[11px]">
                    <span className="text-gray-400">Assigned Registry:</span>
                    <span className="font-medium text-blue-300">
                      {user?.siteId === 'KANPUR_APEX' ? 'Cath Lab & Interventional PCI' : 'Heart Failure & Cardiology'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-gray-400">Site Identifier:</span>
                    <span className="font-mono text-gray-300">{user?.siteId || 'AICTS_PUNE'}</span>
                  </div>
                </div>

                {/* Discrete Data Isolation Notice */}
                <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[11px] flex items-center gap-2">
                  <Shield className="w-4 h-4 flex-shrink-0 text-emerald-400" />
                  <span className="leading-tight">Discrete Hospital Registry: Patient data strictly isolated per institutional governance.</span>
                </div>
              </div>

              {/* Navigation & Logout actions */}
              <div className="p-2 border-t border-white/[0.08] space-y-1 bg-slate-950/40">
                <button
                  onClick={() => {
                    setSwitcherOpen(false)
                    router.push('/settings?tab=profile')
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <Shield className="w-3.5 h-3.5 text-blue-400" />
                    <span>My Profile & Settings</span>
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-gray-500" />
                </button>

                <button
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-rose-400 hover:bg-rose-500/15 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Log Out of Registry</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
