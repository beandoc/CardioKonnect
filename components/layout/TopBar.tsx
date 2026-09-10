'use client'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import { format } from 'date-fns'
import { Bell, Search, Moon, Sun, ChevronRight, Menu, ChevronDown, Building2, Shield, Lock, ArrowLeft, LogOut, AlertCircle, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAppUser } from '@/context/AppUserContext'
import { SITES, type AppUser } from '@/lib/appConfig'
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
  onToggleSidebar?: () => void
}

export default function TopBar({ onToggleSidebar }: TopBarProps) {
  const path = usePathname()
  const router = useRouter()
  const [time, setTime] = useState<Date | null>(null)
  const [switcherOpen, setSwitcherOpen] = useState(false)
  const [selectedCandidate, setSelectedCandidate] = useState<AppUser | null>(null)
  const [switchPassword, setSwitchPassword] = useState('')
  const [switchError, setSwitchError] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)
  const switcherRef = useRef<HTMLDivElement>(null)
  const { user, setUser, logout, allUsers } = useAppUser()

  useEffect(() => {
    setTime(new Date())
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  // Close switcher on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (switcherRef.current && !switcherRef.current.contains(e.target as Node)) {
        setSwitcherOpen(false)
        setSelectedCandidate(null)
        setSwitchPassword('')
        setSwitchError('')
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const handleSelectUser = (u: AppUser) => {
    if (user?.id === u.id) {
      setSwitcherOpen(false)
      return
    }
    setSelectedCandidate(u)
    setSwitchPassword('')
    setSwitchError('')
  }

  const handleVerifyPassword = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedCandidate) return

    setIsVerifying(true)
    setSwitchError('')

    const entered = switchPassword.trim()
    if (entered === selectedCandidate.defaultPassword) {
      setUser(selectedCandidate)
      localStorage.setItem('cardio_active_user_id', selectedCandidate.id)
      localStorage.setItem('cardiokonnect_auth', 'true')
      localStorage.setItem('cardiokonnect_role', selectedCandidate.role === 'DEO' ? 'deo' : 'doctor')

      toast.success(`Authenticated — Switched to ${selectedCandidate.name}`, {
        description: `${selectedCandidate.role} · ${SITES[selectedCandidate.siteId]?.shortName || selectedCandidate.siteId}`,
      })

      setIsVerifying(false)
      setSelectedCandidate(null)
      setSwitchPassword('')
      setSwitcherOpen(false)
    } else {
      setIsVerifying(false)
      setSwitchError(`Incorrect password for ${selectedCandidate.name}. Please try again.`)
    }
  }

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

        {/* User Avatar + Switcher */}
        <div className="relative" ref={switcherRef}>
          <button
            onClick={() => {
              setSwitcherOpen(v => !v)
              setSelectedCandidate(null)
              setSwitchPassword('')
              setSwitchError('')
            }}
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

          {/* User switcher dropdown */}
          {switcherOpen && (
            <div
              className="absolute right-0 top-full mt-2 w-80 rounded-2xl border shadow-2xl z-50 overflow-hidden"
              style={{ background: 'rgba(15,26,61,0.98)', borderColor: 'rgba(59,130,246,0.25)', backdropFilter: 'blur(16px)' }}
            >
              {selectedCandidate ? (
                /* Password Verification Screen */
                <div className="p-4 animate-fade-in">
                  <div className="flex items-center gap-2 mb-3">
                    <button
                      type="button"
                      onClick={() => { setSelectedCandidate(null); setSwitchError(''); setSwitchPassword(''); }}
                      className="p-1 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                    <div>
                      <h4 className="text-xs font-bold text-white">Enter Clinical Password</h4>
                      <p className="text-[10px] text-gray-400">Authenticate user switch</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-2.5 mb-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                      style={{ background: selectedCandidate.siteId === 'KANPUR_APEX' ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}
                    >
                      {selectedCandidate.shortName}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-white truncate">{selectedCandidate.name}</p>
                      <p className="text-[10px] text-gray-400">{selectedCandidate.role} · {SITES[selectedCandidate.siteId]?.shortName}</p>
                    </div>
                  </div>

                  <form onSubmit={handleVerifyPassword} className="space-y-3">
                    <div className="space-y-1">
                      <div className="flex justify-between items-center text-[10px] text-gray-400 font-medium">
                        <span>Password Required</span>
                      </div>
                      <div className="relative">
                        <Lock className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                        <input
                          type="password"
                          autoFocus
                          required
                          value={switchPassword}
                          onChange={(e) => setSwitchPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950/80 border border-gray-700/60 text-white placeholder-gray-500 text-xs focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    {switchError && (
                      <div className="p-2.5 rounded-lg bg-rose-500/15 border border-rose-500/20 text-rose-300 text-[11px] flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>{switchError}</span>
                      </div>
                    )}

                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => { setSelectedCandidate(null); setSwitchError(''); setSwitchPassword(''); }}
                        className="flex-1 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 font-semibold text-xs transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isVerifying || !switchPassword}
                        className="flex-1 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-600/20 transition-all disabled:opacity-50"
                      >
                        {isVerifying ? 'Verifying...' : 'Authorize Switch'}
                      </button>
                    </div>
                  </form>
                </div>
              ) : (
                /* User Switcher List */
                <>
                  <div className="p-3 border-b border-white/[0.06] bg-slate-950/50">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Active Doctor Profile</p>
                    <div className="flex items-center gap-2.5 mt-2">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm flex-shrink-0"
                        style={{ background: user?.siteId === 'KANPUR_APEX' ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}
                      >
                        {user?.shortName || 'AJ'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-white truncate">{user?.name || 'Dr. A. Jayachandra'}</p>
                        <p className="text-[10px] text-gray-400 truncate">{user?.role} · {site?.name || 'AICTS Pune'}</p>
                      </div>
                    </div>
                  </div>

                  <div className="px-4 py-2 border-b flex justify-between items-center bg-white/[0.02]" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Switch Doctor Account</p>
                      <p className="text-[10px] text-gray-500">Requires password verification</p>
                    </div>
                    <Lock className="w-3.5 h-3.5 text-blue-400/60" />
                  </div>

                  <div className="p-2 space-y-1 max-h-64 overflow-y-auto">
                    {allUsers.map(u => {
                      const userSite = SITES[u.siteId]
                      const isActive = user?.id === u.id
                      return (
                        <button
                          key={u.id}
                          onClick={() => handleSelectUser(u)}
                          className={cn(
                            'w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition-colors',
                            isActive ? 'bg-blue-500/15 border border-blue-500/25' : 'hover:bg-white/5'
                          )}
                        >
                          <div
                            className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0"
                            style={{ background: isActive ? (u.siteId === 'KANPUR_APEX' ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'linear-gradient(135deg, #3b82f6, #8b5cf6)') : 'rgba(255,255,255,0.1)' }}
                          >
                            {u.shortName}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-white truncate">{u.name}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[10px] text-gray-400">{u.role}</span>
                              {userSite && (
                                <>
                                  <span className="text-[10px] text-gray-600">·</span>
                                  <span className="text-[10px] text-gray-400 truncate">{userSite.shortName}</span>
                                </>
                              )}
                            </div>
                          </div>
                          {isActive ? (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 font-semibold flex-shrink-0 flex items-center gap-1">
                              <CheckCircle2 className="w-2.5 h-2.5" /> Active
                            </span>
                          ) : (
                            <Lock className="w-3 h-3 text-gray-500 flex-shrink-0" />
                          )}
                        </button>
                      )
                    })}
                  </div>

                  {/* Log out option */}
                  <div className="p-2 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-rose-400 hover:bg-rose-500/10 transition-colors"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Log Out of Registry</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
