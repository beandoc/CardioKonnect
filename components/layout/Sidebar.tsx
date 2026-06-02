'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, Users, UserPlus, BarChart3, FileText,
  Heart, Database, Settings, FlaskConical, ShieldCheck,
  Layers, ChevronRight, Activity, Bell, Search, Calendar, UserCheck, TrendingUp, X, LogOut
} from 'lucide-react'
import { toast } from 'sonner'

const NAV = [
  {
    section: 'Main',
    items: [
      { href: '/home',       label: 'Registry Home', icon: Heart },
      { href: '/',           label: 'Dashboard',     icon: LayoutDashboard },
    ],
  },
  {
    section: 'Appointments',
    items: [
      { href: '/appointments', label: 'Appointments',  icon: Calendar },
      { href: '/consents',     label: 'Consents',      icon: UserCheck },
    ],
  },
  {
    section: 'Patients',
    items: [
      { href: '/patients',    label: 'Patient List',  icon: Users },
      { href: '/patients/new',label: 'Add Patient',   icon: UserPlus },
    ],
  },
  {
    section: 'Registry Tools',
    items: [
      { href: '/registry',    label: 'Registry Fields', icon: Database },
      { href: '/reports',     label: 'Registry Reports', icon: FileText },
      { href: '/cohort',      label: 'Cohort Builder',  icon: Layers },
      { href: '/alerts',      label: 'Clinical Alerts', icon: Bell },
    ],
  },
  {
    section: 'Research Tools',
    items: [
      { href: '/analytics-dashboard', label: 'Executive Intelligence', icon: TrendingUp },
      { href: '/analytics',   label: 'Population Analytics', icon: BarChart3 },
      { href: '/risk',        label: 'Risk Calculators',  icon: FlaskConical },
    ],
  },
  {
    section: 'Admin',
    items: [
      { href: '/admin',       label: 'Administration',   icon: ShieldCheck },
      { href: '/settings',    label: 'Settings',          icon: Settings },
      { href: '/logs',        label: 'My Logs',           icon: FileText },
      { href: '/log-categories', label: 'Log Categories', icon: Database },
      { href: '/languages',   label: 'Language Master',   icon: Heart },
    ],
  },
]

interface SidebarProps {
  isOpen?: boolean
  onClose?: () => void
}

export default function Sidebar({ isOpen = false, onClose }: SidebarProps) {
  const path = usePathname()
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      router.push(`/patients?search=${encodeURIComponent(searchQuery.trim())}`)
      setSearchQuery('')
      onClose?.()
    }
  }

  const handleLogout = () => {
    toast.success('Clinical session ended. Logged out successfully.')
    router.push('/home')
    onClose?.()
  }

  return (
    <aside className={cn(
      "sidebar fixed top-0 left-0 bottom-0 flex flex-col z-50 w-[260px] bg-[#0f2444] transition-transform duration-300 ease-in-out lg:translate-x-0",
      isOpen ? "translate-x-0" : "-translate-x-full"
    )}>
      {/* ── Logo / Branding ── */}
      <div className="px-5 pt-6 pb-5">
        <div className="flex items-center justify-between gap-2 mb-1">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 animate-gradient"
              style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}>
              <Heart className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white truncate">Dr. A. Jayachandra</p>
              <p className="text-[10px] truncate" style={{ color: 'rgba(148,163,184,0.6)' }}>AICTS, Pune</p>
            </div>
            <div className="flex-shrink-0">
              <div className="pulse-dot" />
            </div>
          </div>
          {onClose && (
            <button 
              onClick={onClose} 
              className="lg:hidden p-1.5 rounded-xl btn-ghost flex items-center justify-center text-gray-400 hover:text-white"
              aria-label="Close sidebar"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* ── Search ── */}
      <div className="px-3 pb-3">
        <form onSubmit={handleSearchSubmit} className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'rgba(148,163,184,0.4)' }} />
          <input
            type="text"
            placeholder="Search patients…"
            className="search-input text-xs py-2 w-full"
            style={{ paddingLeft: '2rem' }}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </form>
      </div>

      <hr className="divider mx-3 mb-2" />

      {/* ── Navigation ── */}
      <nav className="flex-1 overflow-y-auto py-1 px-1">
        {NAV.map(group => (
          <div key={group.section} className="mb-1">
            <p className="nav-section-label mt-3">{group.section}</p>
            {group.items.map(item => {
              const active = item.href === '/'
                ? path === '/'
                : path.startsWith(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn('nav-item group', active && 'active')}
                  onClick={() => onClose?.()}
                >
                  <item.icon className={cn('nav-icon', active ? 'text-blue-400' : '')} />
                  <span className="flex-1">{item.label}</span>
                  {active && (
                    <ChevronRight className="w-3 h-3 text-blue-400 opacity-70" />
                  )}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      {/* ── Logout ── */}
      <div className="px-2 py-2 border-t border-blue-500/10">
        <button
          type="button"
          onClick={handleLogout}
          className="nav-item group w-full text-red-400 hover:text-red-300 hover:bg-red-500/10"
        >
          <LogOut className="nav-icon text-red-400 group-hover:text-red-300" />
          <span className="flex-1 text-left">Logout</span>
        </button>
      </div>

      {/* ── Footer ── */}
      <div className="px-4 py-4" style={{ borderTop: '1px solid rgba(59,130,246,0.1)' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-3.5 h-3.5" style={{ color: '#10b981' }} />
            <span className="text-xs" style={{ color: 'rgba(148,163,184,0.5)' }}>System Online</span>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(16,185,129,0.12)', color: '#6ee7b7', border: '1px solid rgba(16,185,129,0.2)' }}>
            Live
          </span>
        </div>
      </div>
    </aside>
  )
}
