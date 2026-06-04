'use client'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { Bell, Search, Moon, Sun, ChevronRight, Menu } from 'lucide-react'
import { cn } from '@/lib/utils'

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
}

interface TopBarProps {
  onToggleSidebar?: () => void
}

export default function TopBar({ onToggleSidebar }: TopBarProps) {
  const path = usePathname()
  const [time, setTime] = useState<Date | null>(null)

  useEffect(() => {
    setTime(new Date())
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

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

  return (
    <header className="topbar flex items-center justify-between px-4 md:px-6 gap-4">
      {/* Left — breadcrumb */}
      <div className="flex items-center gap-2 min-w-0">
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="p-2 -ml-2 rounded-xl flex items-center justify-center btn-ghost lg:hidden"
            aria-label="Open sidebar"
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

        {/* Avatar */}
        <div className="flex items-center gap-2 pl-2" style={{ borderLeft: '1px solid rgba(59,130,246,0.15)' }}>
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white cursor-pointer hover:opacity-90 transition-opacity"
            style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}>
            AJ
          </div>
          <div className="hidden lg:block">
            <p className="text-xs font-semibold text-white leading-tight">Dr. Jayachandra</p>
            <p className="text-[10px]" style={{ color: 'rgba(148,163,184,0.5)' }}>RegistryOwner</p>
          </div>
        </div>
      </div>
    </header>
  )
}
