'use client'
import { useState, useMemo, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { 
  Shield, ShieldAlert, Award, Calendar, Clock, Laptop, Compass, Heart, HelpCircle, 
  Globe, Search, PlusCircle, Trash2, Edit2, FileClock, Filter, FileSpreadsheet, UserCheck, Check
} from 'lucide-react'
import Button from '@/components/ui/Button'
import { cn } from '@/lib/utils'

// Types and data from Provider list
interface ProviderRow {
  id: string
  name: string
  email: string
  role: string
  status: 'Active' | 'Inactive'
  addedOn: string
}

const INITIAL_PROVIDERS: ProviderRow[] = [
  { id: '1', name: 'Dr. A. Jayachandra', email: 'jayachandra.a@aicts.in', role: 'RegistryOwner', status: 'Active', addedOn: '01/01/2026' },
  { id: '2', name: 'Dr. Srinivas Murthy', email: 's.murthy@aicts.in', role: 'Provider', status: 'Active', addedOn: '15/02/2026' },
  { id: '3', name: 'Dr. K. Raghavan', email: 'k.raghavan@aicts.in', role: 'Provider', status: 'Active', addedOn: '10/03/2026' }
]

// Types and data from Logs list
interface LogRow {
  id: string
  type: string
  logUser: string
  userRole: string
  ipAddress: string
  registryName: string
  patient: string
  provider: string
  facility: string
  timestamp: string
  reason: string
  remarks: string
}

const GENERATED_LOGS: LogRow[] = []

// Types and data from Language Master
interface LanguageRow {
  id: string
  name: string
  patientsCount: number
}

const INITIAL_LANGUAGES: LanguageRow[] = [
  { id: '8', name: 'Bengali', patientsCount: 0 },
  { id: '1', name: 'English', patientsCount: 0 },
  { id: '4', name: 'Gujarati', patientsCount: 0 },
  { id: '3', name: 'Hindi', patientsCount: 0 },
  { id: '9', name: 'Kannada', patientsCount: 0 },
  { id: '5', name: 'Marathi', patientsCount: 0 },
  { id: '6', name: 'Tamil', patientsCount: 0 },
  { id: '7', name: 'Telugu', patientsCount: 0 },
]

function SettingsContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const tabParam = searchParams.get('tab')
  const initialTab = (tabParam === 'admin' || tabParam === 'logs' || tabParam === 'languages') ? tabParam : 'profile'

  const [activeTab, setActiveTab] = useState<'profile' | 'admin' | 'logs' | 'languages'>(initialTab)

  useEffect(() => {
    const t = searchParams.get('tab')
    if (t === 'admin' || t === 'logs' || t === 'languages') {
      setActiveTab(t)
    } else {
      setActiveTab('profile')
    }
  }, [searchParams])

  const handleTabChange = (t: 'profile' | 'admin' | 'logs' | 'languages') => {
    setActiveTab(t)
    router.push(`/settings?tab=${t}`)
  }

  // Admin Tab State & Logic
  const [providers, setProviders] = useState<ProviderRow[]>(INITIAL_PROVIDERS)
  const [adminSearch, setAdminSearch] = useState('')
  const [adminStatusFilter, setAdminStatusFilter] = useState('All')

  const filteredProviders = useMemo(() => {
    return providers.filter(p => {
      const matchSearch = p.name.toLowerCase().includes(adminSearch.toLowerCase()) || p.email.toLowerCase().includes(adminSearch.toLowerCase())
      const matchStatus = adminStatusFilter === 'All' || p.status === adminStatusFilter
      return matchSearch && matchStatus
    })
  }, [providers, adminSearch, adminStatusFilter])

  const toggleProviderStatus = (id: string) => {
    setProviders(prev => prev.map(p => p.id === id ? { ...p, status: p.status === 'Active' ? 'Inactive' : 'Active' } : p))
  }

  // Logs Tab State & Logic
  const [logs, setLogs] = useState<LogRow[]>(GENERATED_LOGS)
  const [logsSearch, setLogsSearch] = useState('')
  const [logsTypeFilter, setLogsTypeFilter] = useState('All')
  const [logsStartDate, setLogsStartDate] = useState('')
  const [logsEndDate, setLogsEndDate] = useState('')
  const [logsRowsPerPage, setLogsRowsPerPage] = useState(10)
  const [logsCurrentPage, setLogsCurrentPage] = useState(1)

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const q = logsSearch.toLowerCase()
      const matchSearch =
        log.remarks.toLowerCase().includes(q) ||
        log.patient.toLowerCase().includes(q) ||
        log.provider.toLowerCase().includes(q) ||
        log.type.toLowerCase().includes(q)

      const matchType = logsTypeFilter === 'All' || log.type === logsTypeFilter

      let matchDate = true
      if (logsStartDate || logsEndDate) {
        const parts = log.timestamp.split(' ')[0].split('/')
        const logDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]))
        if (logsStartDate) {
          const start = new Date(logsStartDate)
          if (logDate < start) matchDate = false
        }
        if (logsEndDate) {
          const end = new Date(logsEndDate)
          if (logDate > end) matchDate = false
        }
      }

      return matchSearch && matchType && matchDate
    })
  }, [logs, logsSearch, logsTypeFilter, logsStartDate, logsEndDate])

  const paginatedLogs = useMemo(() => {
    const startIdx = (logsCurrentPage - 1) * logsRowsPerPage
    return filteredLogs.slice(startIdx, startIdx + logsRowsPerPage)
  }, [filteredLogs, logsCurrentPage, logsRowsPerPage])

  // Languages Tab State & Logic
  const [languages, setLanguages] = useState<LanguageRow[]>(INITIAL_LANGUAGES)
  const [langSearch, setLangSearch] = useState('')
  const [langRowsPerPage, setLangRowsPerPage] = useState(10)

  const filteredLanguages = useMemo(() => {
    return languages.filter(l => 
      l.name.toLowerCase().includes(langSearch.toLowerCase())
    )
  }, [languages, langSearch])

  return (
    <div className="space-y-6 animate-fade-in text-gray-300">
      
      {/* Settings Tab Switcher */}
      <div className="flex border-b border-blue-500/10 pb-1 gap-6">
        <button
          onClick={() => handleTabChange('profile')}
          className={cn("text-sm font-semibold pb-3 border-b-2 px-1 transition-all", 
            activeTab === 'profile' ? "border-blue-500 text-white" : "border-transparent text-gray-400 hover:text-gray-200"
          )}
        >
          Doctor Profile
        </button>
        <button
          onClick={() => handleTabChange('admin')}
          className={cn("text-sm font-semibold pb-3 border-b-2 px-1 transition-all", 
            activeTab === 'admin' ? "border-blue-500 text-white" : "border-transparent text-gray-400 hover:text-gray-200"
          )}
        >
          Healthcare Providers
        </button>
        <button
          onClick={() => handleTabChange('logs')}
          className={cn("text-sm font-semibold pb-3 border-b-2 px-1 transition-all", 
            activeTab === 'logs' ? "border-blue-500 text-white" : "border-transparent text-gray-400 hover:text-gray-200"
          )}
        >
          Event Logs
        </button>
        <button
          onClick={() => handleTabChange('languages')}
          className={cn("text-sm font-semibold pb-3 border-b-2 px-1 transition-all", 
            activeTab === 'languages' ? "border-blue-500 text-white" : "border-transparent text-gray-400 hover:text-gray-200"
          )}
        >
          Languages Master
        </button>
      </div>

      {/* Render active tab */}
      {activeTab === 'profile' && (
        <>
          {/* Header Profile Info Banner */}
          <div className="accent-card p-6 flex flex-col md:flex-row items-center md:items-start justify-between gap-6">
            <div className="flex flex-col md:flex-row items-center gap-5 text-center md:text-left">
              <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-3xl font-bold text-white flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6, #06b6d4)' }}>
                AJ
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white mb-1">Dr. A. Jayachandra</h2>
                <p className="text-sm text-gray-400">Attending Doctor &bull; AICTS Pune</p>
                <div className="flex flex-wrap justify-center md:justify-start gap-2 mt-3">
                  <span className="badge badge-green text-[10px] uppercase font-semibold">Active</span>
                  <span className="badge badge-blue text-[10px] uppercase font-semibold">Approved Account</span>
                  <span className="text-xs text-gray-500 flex items-center gap-1 ml-2">
                    <Calendar className="w-3.5 h-3.5" /> Member since: Nov 4, 2025
                  </span>
                </div>
              </div>
            </div>

            {/* Small stats in banner */}
            <div className="flex gap-4 border-t md:border-t-0 md:border-l border-blue-500/10 pt-4 md:pt-0 md:pl-6">
              <div className="text-center md:text-left">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider">Last Login</p>
                <p className="text-white font-semibold text-sm mt-0.5">Today, 07:27 PM</p>
              </div>
            </div>
          </div>

          {/* Main Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left column: Key Stats & Active Session */}
            <div className="space-y-6">
              
              {/* Key Stats */}
              <div className="grid grid-cols-2 gap-4">
                <div className="kpi-card blue">
                  <p className="text-[10px] uppercase tracking-wider text-gray-400">Active Roles</p>
                  <p className="text-2xl font-bold text-white mt-1">4</p>
                  <p className="text-[10px] text-gray-500 mt-1">Assigned roles</p>
                </div>
                <div className="kpi-card violet">
                  <p className="text-[10px] uppercase tracking-wider text-gray-400">Registries</p>
                  <p className="text-2xl font-bold text-white mt-1">1</p>
                  <p className="text-[10px] text-emerald-400 mt-1">0 pending</p>
                </div>
                <div className="kpi-card cyan">
                  <p className="text-[10px] uppercase tracking-wider text-gray-400">Appointments</p>
                  <p className="text-2xl font-bold text-white mt-1">0</p>
                  <p className="text-[10px] text-gray-500 mt-1">This month</p>
                </div>
                <div className="kpi-card amber">
                  <p className="text-[10px] uppercase tracking-wider text-gray-400">Account Age</p>
                  <p className="text-2xl font-bold text-white mt-1">210</p>
                  <p className="text-[10px] text-gray-500 mt-1">Days since signup</p>
                </div>
              </div>

              {/* Active Session info */}
              <div className="glass-card p-5 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-blue-500/10">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Laptop className="w-4 h-4 text-blue-400" /> Current Session
                  </h3>
                  <span className="badge badge-green text-[10px]">Active</span>
                </div>
                <div className="space-y-3 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Platform:</span>
                    <span className="text-white font-mono">web</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">IP:</span>
                    <span className="text-white font-mono">106.215.177.22</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Location:</span>
                    <span className="text-white">Unknown</span>
                  </div>
                </div>

                <div className="border-t border-blue-500/10 pt-3 space-y-2.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Started:</span>
                    <span className="text-gray-300">June 2, 2026 at 09:55 PM</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Last Active:</span>
                    <span className="text-gray-300">June 2, 2026 at 10:07 PM</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Expires:</span>
                    <span className="text-gray-300">June 2, 2026 at 10:22 PM</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Center column: Assigned Roles & Access */}
            <div className="space-y-6 lg:col-span-2">
              
              {/* Assigned Roles List */}
              <div className="glass-card p-5 space-y-4">
                <h3 className="text-sm font-semibold text-white pb-3 border-b border-blue-500/10 flex items-center gap-2">
                  <Award className="w-4 h-4 text-violet-400" /> Assigned Roles
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  
                  <div className="dark-card p-4 space-y-2 border border-blue-500/10 hover:border-blue-500/20 transition-all">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-sm text-white">Admin</p>
                      <span className="badge badge-blue text-[9px] uppercase">Active</span>
                    </div>
                    <p className="text-xs text-gray-400">Administrative access with user management</p>
                    <p className="text-[10px] text-gray-500 pt-1">Assigned by Admin &bull; Nov 4, 2025 at 03:04 PM</p>
                  </div>

                  <div className="dark-card p-4 space-y-2 border border-blue-500/10 hover:border-blue-500/20 transition-all">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-sm text-white">AttendingDoctor</p>
                      <span className="badge badge-blue text-[9px] uppercase">Active</span>
                    </div>
                    <p className="text-xs text-gray-400">Doctor with patient management access</p>
                    <p className="text-[10px] text-gray-500 pt-1">Assigned by Admin &bull; Nov 4, 2025 at 03:04 PM</p>
                  </div>

                  <div className="dark-card p-4 space-y-2 border border-blue-500/10 hover:border-blue-500/20 transition-all">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-sm text-white">RegistryManager</p>
                      <span className="badge badge-blue text-[9px] uppercase">Active</span>
                    </div>
                    <p className="text-xs text-gray-400">Registry manager with operational control</p>
                    <p className="text-[10px] text-gray-500 pt-1">Assigned by Admin &bull; Nov 4, 2025 at 03:04 PM</p>
                  </div>

                  <div className="dark-card p-4 space-y-2 border border-blue-500/10 hover:border-blue-500/20 transition-all">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-sm text-white">RegistryOwner</p>
                      <span className="badge badge-blue text-[9px] uppercase">Active</span>
                    </div>
                    <p className="text-xs text-gray-400">Registry owner with oversight capabilities</p>
                    <p className="text-[10px] text-gray-500 pt-1">Assigned by Admin &bull; Nov 4, 2025 at 03:04 PM</p>
                  </div>

                </div>
              </div>

              {/* Registry Access & Provider Info Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Registry Access */}
                <div className="glass-card p-5 space-y-4">
                  <h3 className="text-sm font-semibold text-white pb-3 border-b border-blue-500/10 flex items-center gap-2">
                    <Compass className="w-4 h-4 text-cyan-400" /> Registry Access
                  </h3>
                  <div className="dark-card p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-xs text-white">Cardiovascular Registry</p>
                      <span className="badge badge-green text-[9px] uppercase">Active</span>
                    </div>
                    <p className="text-[11px] text-gray-400">Main Heart Failure Registry Database</p>
                    <p className="text-[10px] text-gray-500 pt-1">Assigned Nov 4, 2025 at 03:12 PM</p>
                  </div>
                  <div className="pt-2 text-xs text-gray-500 text-center">No other registry accesses assigned</div>
                </div>

                {/* Provider Information */}
                <div className="glass-card p-5 space-y-4">
                  <h3 className="text-sm font-semibold text-white pb-3 border-b border-blue-500/10 flex items-center gap-2">
                    <Heart className="w-4 h-4 text-rose-400" /> Provider Information
                  </h3>
                  <div className="space-y-3 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-500">License Number:</span>
                      <span className="text-white font-mono">123454</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Experience:</span>
                      <span className="text-white">12 years</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Subspecialty:</span>
                      <span className="text-white">Cardiology / Research</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Primary Facility:</span>
                      <span className="text-white">AICTS, Pune</span>
                    </div>
                  </div>
                </div>

              </div>

              {/* Account Security & Quick Actions */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Account Details */}
                <div className="glass-card p-5 space-y-4">
                  <h3 className="text-sm font-semibold text-white pb-3 border-b border-blue-500/10 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-emerald-400" /> Account Security
                  </h3>
                  <div className="space-y-3 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Account ID:</span>
                      <span className="text-white font-mono">411fa971...</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Account Type:</span>
                      <span className="text-white">Healthcare Professional</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Verification:</span>
                      <span className="badge badge-green text-[9px] uppercase">Verified</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Two-Factor Auth:</span>
                      <span className="badge badge-blue text-[9px] uppercase">Active</span>
                    </div>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="glass-card p-5 space-y-4">
                  <h3 className="text-sm font-semibold text-white pb-3 border-b border-blue-500/10 flex items-center gap-2">
                    <Compass className="w-4 h-4 text-amber-400" /> Actions & Logs
                  </h3>
                  <div className="flex flex-col gap-2.5">
                    <Button className="w-full justify-center">Update Profile</Button>
                    <Button variant="outline" className="w-full justify-center" onClick={() => handleTabChange('logs')}>View Activity Log</Button>
                  </div>
                  <div className="pt-2 text-[10px] text-gray-500 text-center">
                    Last updated on Nov 4, 2025
                  </div>
                </div>

              </div>

            </div>

          </div>
        </>
      )}

      {activeTab === 'admin' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Shield className="w-5 h-5 text-blue-400" />
                <h2 className="text-xl font-bold text-white">Registry Healthcare Providers</h2>
              </div>
              <p className="text-sm text-gray-400">
                Showing <span className="text-white font-semibold">{filteredProviders.length}</span> of <span className="text-white font-semibold">{providers.length}</span> healthcare providers
              </p>
            </div>
          </div>

          {/* Filters */}
          <div className="glass-card p-4 flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                className="search-input w-full pl-9"
                placeholder="Search healthcare providers..."
                value={adminSearch}
                onChange={e => setAdminSearch(e.target.value)}
              />
            </div>
            <select
              className="form-input form-select w-40"
              value={adminStatusFilter}
              onChange={e => setAdminStatusFilter(e.target.value)}
            >
              <option value="All">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>

          {/* Table */}
          <div className="glass-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="registry-table">
                <thead>
                  <tr>
                    <th className="w-12">#</th>
                    <th>Healthcare Provider</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Added On</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProviders.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center">
                        <Shield className="w-10 h-10 text-gray-500 mx-auto mb-2" />
                        <p className="text-gray-400 text-sm font-semibold">No healthcare providers found</p>
                      </td>
                    </tr>
                  ) : (
                    filteredProviders.map((p, i) => (
                      <tr key={p.id} className={cn(p.status === 'Inactive' && 'opacity-50')}>
                        <td className="font-mono text-xs text-gray-500">{i + 1}</td>
                        <td>
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-violet-600/20 border border-violet-500/30 text-violet-300 flex items-center justify-center text-xs font-semibold">
                              {p.name.split(' ').map(n => n[0]).join('')}
                            </div>
                            <div>
                              <p className="font-medium text-white">{p.name}</p>
                              <p className="text-xs text-gray-400">{p.email}</p>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="badge badge-violet text-[10px]">{p.role}</span>
                        </td>
                        <td>
                          <span className={p.status === 'Active' ? 'status-active' : 'status-inactive'}>
                            {p.status}
                          </span>
                        </td>
                        <td className="text-gray-300 text-xs">{p.addedOn}</td>
                        <td>
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" size="sm" onClick={() => toggleProviderStatus(p.id)}>
                              Toggle Status
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'logs' && (
        <div className="space-y-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <FileClock className="w-5 h-5 text-blue-400" />
              <h2 className="text-xl font-bold text-white">Event Audit Logs</h2>
            </div>
            <p className="text-sm text-gray-400">Healthcare system event logs and activity monitoring</p>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="kpi-card blue">
              <p className="text-[10px] uppercase tracking-wider text-gray-400">Total Logs</p>
              <p className="text-2xl font-bold text-white mt-1">{filteredLogs.length}</p>
            </div>
            <div className="kpi-card emerald">
              <p className="text-[10px] uppercase tracking-wider text-gray-400">Active</p>
              <p className="text-2xl font-bold text-white mt-1">10</p>
            </div>
            <div className="kpi-card cyan">
              <p className="text-[10px] uppercase tracking-wider text-gray-400">Last 24h</p>
              <p className="text-2xl font-bold text-white mt-1">4</p>
            </div>
            <div className="kpi-card rose">
              <p className="text-[10px] uppercase tracking-wider text-gray-400">Inactive</p>
              <p className="text-2xl font-bold text-white mt-1">0</p>
            </div>
            <div className="kpi-card violet">
              <p className="text-[10px] uppercase tracking-wider text-gray-400">Last 7 days</p>
              <p className="text-2xl font-bold text-white mt-1">4</p>
            </div>
          </div>

          {/* Filter panel */}
          <div className="glass-card p-4 space-y-4">
            <div className="flex flex-wrap gap-4 items-center">
              <div className="relative flex-1 min-w-[240px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  className="search-input w-full pl-9"
                  placeholder="Search logs by remarks, patient, provider, or category..."
                  value={logsSearch}
                  onChange={e => setLogsSearch(e.target.value)}
                />
              </div>
              <div className="flex gap-2 flex-wrap items-center">
                <select
                  className="form-input form-select w-44"
                  value={logsTypeFilter}
                  onChange={e => setLogsTypeFilter(e.target.value)}
                >
                  <option value="All">Filter by Type</option>
                  <option value="Consent Granted">Consent Granted</option>
                  <option value="Consent Revoked">Consent Revoked</option>
                  <option value="Record Created">Record Created</option>
                  <option value="Record Updated">Record Updated</option>
                  <option value="Data Exported">Data Exported</option>
                </select>

                <div className="flex items-center gap-1.5">
                  <input
                    type="date"
                    className="form-input text-xs py-2 w-36"
                    value={logsStartDate}
                    onChange={e => setLogsStartDate(e.target.value)}
                  />
                  <span className="text-gray-500 text-xs">to</span>
                  <input
                    type="date"
                    className="form-input text-xs py-2 w-36"
                    value={logsEndDate}
                    onChange={e => setLogsEndDate(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="glass-card overflow-hidden">
            <div className="overflow-x-auto font-sans text-xs">
              <table className="registry-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Log User</th>
                    <th>User Role</th>
                    <th>IP Address</th>
                    <th>Registry Name</th>
                    <th>Patient</th>
                    <th>Provider</th>
                    <th>Facility</th>
                    <th>Timestamp</th>
                    <th>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedLogs.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-gray-400">
                        No matching logs found
                      </td>
                    </tr>
                  ) : (
                    paginatedLogs.map(log => (
                      <tr key={log.id}>
                        <td>
                          <span className={cn(
                            "badge text-[10px]",
                            log.type.includes('Consent') && 'badge-green',
                            log.type.includes('Revoked') && 'badge-red',
                            log.type.includes('Created') && 'badge-blue',
                            log.type.includes('Exported') && 'badge-violet',
                            log.type.includes('Updated') && 'badge-amber'
                          )}>
                            {log.type}
                          </span>
                        </td>
                        <td className="font-semibold text-white">{log.logUser}</td>
                        <td className="text-gray-400">{log.userRole}</td>
                        <td className="font-mono text-gray-400">{log.ipAddress}</td>
                        <td className="text-gray-300">{log.registryName}</td>
                        <td className="text-white font-medium">{log.patient}</td>
                        <td className="text-gray-300">{log.provider}</td>
                        <td className="text-gray-400">{log.facility}</td>
                        <td className="text-gray-400 font-mono">{log.timestamp}</td>
                        <td className="text-gray-300">{log.reason}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer pagination */}
            <div className="px-5 py-4 flex items-center justify-between" style={{ borderTop: '1px solid rgba(59, 130, 246, 0.08)' }}>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">Rows per page:</span>
                <select
                  className="form-input form-select text-xs py-1 px-2 w-16"
                  value={logsRowsPerPage}
                  onChange={e => {
                    setLogsRowsPerPage(parseInt(e.target.value))
                    setLogsCurrentPage(1)
                  }}
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                </select>
                <span className="text-xs text-gray-400">
                  {Math.min(filteredLogs.length, (logsCurrentPage - 1) * logsRowsPerPage + 1)}–
                  {Math.min(filteredLogs.length, logsCurrentPage * logsRowsPerPage)} of {filteredLogs.length}
                </span>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={logsCurrentPage === 1}
                  onClick={() => setLogsCurrentPage(prev => Math.max(prev - 1, 1))}
                >
                  Prev
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={logsCurrentPage * logsRowsPerPage >= filteredLogs.length}
                  onClick={() => setLogsCurrentPage(prev => prev + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'languages' && (
        <div className="space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Globe className="w-5 h-5 text-blue-400" />
                <h2 className="text-xl font-bold text-white">Language Master</h2>
              </div>
              <p className="text-sm text-gray-400">Manage patient interface and notification languages</p>
            </div>
            <Button>
              <PlusCircle className="w-4 h-4" /> Add Language
            </Button>
          </div>

          {/* Filters */}
          <div className="glass-card p-4 flex flex-wrap gap-4 items-center justify-between">
            <div className="relative flex-1 min-w-[280px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                className="search-input w-full pl-9"
                placeholder="Search languages..."
                value={langSearch}
                onChange={e => setLangSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Table */}
          <div className="glass-card overflow-hidden">
            <div className="overflow-x-auto text-xs">
              <table className="registry-table">
                <thead>
                  <tr>
                    <th className="w-12">ID</th>
                    <th>Language Name</th>
                    <th>Patients Count</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLanguages.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-12 text-center text-gray-500">
                        No languages found.
                      </td>
                    </tr>
                  ) : (
                    filteredLanguages.map(l => (
                      <tr key={l.id}>
                        <td className="font-mono text-gray-500">#{l.id}</td>
                        <td className="text-white font-medium">{l.name}</td>
                        <td className="text-gray-300 font-mono">{l.patientsCount}</td>
                        <td>
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" size="sm" className="btn-sm p-1.5">
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>
                            <Button variant="outline" size="sm" className="btn-sm p-1.5 text-rose-400 hover:text-rose-300">
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            <div className="px-4 py-3 flex items-center justify-end gap-4 text-xs text-gray-400 border-t border-blue-500/10">
              <div className="flex items-center gap-2">
                <span>Rows per page:</span>
                <select
                  value={langRowsPerPage}
                  onChange={e => setLangRowsPerPage(Number(e.target.value))}
                  className="form-select bg-transparent border border-blue-500/15 rounded px-2 py-1 text-xs"
                  style={{ width: 'auto', backgroundImage: 'none', paddingRight: '0.75rem' }}
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
              </div>
              <div>
                1–{filteredLanguages.length} of {filteredLanguages.length}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

export default function SettingsPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Laptop className="w-8 h-8 text-blue-500 animate-spin" />
        <p className="text-sm text-gray-400">Loading settings...</p>
      </div>
    }>
      <SettingsContent />
    </Suspense>
  )
}

