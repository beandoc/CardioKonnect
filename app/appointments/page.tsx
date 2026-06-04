'use client'
import { useState, useMemo, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Calendar, Search, PlusCircle, CheckCircle, Clock, Check, RefreshCw, ShieldAlert } from 'lucide-react'
import Button from '@/components/ui/Button'
import { cn } from '@/lib/utils'

interface Appointment {
  id: string
  appointmentId: string
  patient: string
  dateAndTime: string
  registry: string
  facility: string
  status: 'Today' | 'Upcoming' | 'Completed' | 'Pending Acknowledgement'
}

const INITIAL_APPOINTMENTS: Appointment[] = [
  {
    id: '1',
    appointmentId: 'APT-90412',
    patient: 'Arjun Talpade',
    dateAndTime: '02/06/2026 11:30 AM',
    registry: 'Heart Failure Registry',
    facility: 'AICTS Pune',
    status: 'Completed'
  }
]

interface Consent {
  id: string
  patient: string
  consent: string
  facility: string
  provider: string
  status: 'Granted' | 'Revoked' | 'Pending'
  created: string
  expiry: string
}

const INITIAL_CONSENTS: Consent[] = [
  {
    id: '35',
    patient: 'Daya Ghadge',
    consent: 'Consent to share Coronary interventions related data for Research Purposes',
    facility: 'AICTS Pune',
    provider: 'Dr. A. Jayachandra',
    status: 'Granted',
    created: 'Feb 04, 2026',
    expiry: 'Feb 04, 2029'
  }
]

function AppointmentsAndConsentsContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const initialTab = searchParams.get('tab') === 'consents' ? 'consents' : 'appointments'

  const [activeMainTab, setActiveMainTab] = useState<'appointments' | 'consents'>(initialTab)

  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab === 'consents') {
      setActiveMainTab('consents')
    } else {
      setActiveMainTab('appointments')
    }
  }, [searchParams])

  const setTab = (tab: 'appointments' | 'consents') => {
    setActiveMainTab(tab)
    router.push(`/appointments?tab=${tab}`)
  }

  // Appointments state & logic
  const [appointments, setAppointments] = useState<Appointment[]>(INITIAL_APPOINTMENTS)
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<'today' | 'upcoming' | 'completed' | 'all'>('completed')

  const filteredAppointments = useMemo(() => {
    return appointments.filter(apt => {
      const q = search.toLowerCase()
      const matchSearch = apt.patient.toLowerCase().includes(q) || apt.appointmentId.toLowerCase().includes(q)
      
      if (activeTab === 'today') return matchSearch && apt.status === 'Today'
      if (activeTab === 'upcoming') return matchSearch && apt.status === 'Upcoming'
      if (activeTab === 'completed') return matchSearch && apt.status === 'Completed'
      return matchSearch
    })
  }, [appointments, search, activeTab])

  // Consents state & logic
  const [consents, setConsents] = useState<Consent[]>(INITIAL_CONSENTS)
  const [consentSearch, setConsentSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [expiryFilter, setExpiryFilter] = useState('All')
  const [categoryFilter, setCategoryFilter] = useState('All')

  const filteredConsents = useMemo(() => {
    return consents.filter(c => {
      const q = consentSearch.toLowerCase()
      const matchSearch = c.patient.toLowerCase().includes(q) || c.consent.toLowerCase().includes(q)
      const matchStatus = statusFilter === 'All' || c.status === statusFilter
      return matchSearch && matchStatus
    })
  }, [consents, consentSearch, statusFilter])

  return (
    <div className="space-y-6 animate-fade-in text-gray-300">
      
      {/* Upper Navigation Tabs */}
      <div className="flex border-b border-blue-500/10 pb-1 gap-6">
        <button
          onClick={() => setTab('appointments')}
          className={cn("text-sm font-semibold pb-3 border-b-2 px-1 transition-all", 
            activeMainTab === 'appointments' ? "border-blue-500 text-white" : "border-transparent text-gray-400 hover:text-gray-200"
          )}
        >
          Appointments List
        </button>
        <button
          onClick={() => setTab('consents')}
          className={cn("text-sm font-semibold pb-3 border-b-2 px-1 transition-all", 
            activeMainTab === 'consents' ? "border-blue-500 text-white" : "border-transparent text-gray-400 hover:text-gray-200"
          )}
        >
          Registry Consents
        </button>
      </div>

      {activeMainTab === 'appointments' ? (
        <>
          {/* Header */}
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400 flex-shrink-0">
                <Calendar className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white leading-tight">Appointment Management</h2>
                <p className="text-xs text-gray-500 mt-1">Manage your patients and appointments efficiently</p>
                <p className="text-[10px] text-gray-500 mt-0.5">Welcome, Dr. A. Jayachandra</p>
              </div>
            </div>
            <Button><PlusCircle className="w-4 h-4" /> Schedule Appointment</Button>
          </div>

          {/* KPI stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="kpi-card blue">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-2xl font-bold text-white">0</p>
                  <p className="text-[10px] text-gray-400 mt-1">Today's Appointments</p>
                </div>
                <Calendar className="w-5 h-5 text-blue-500 opacity-60" />
              </div>
            </div>
            <div className="kpi-card emerald">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-2xl font-bold text-white">0</p>
                  <p className="text-[10px] text-gray-400 mt-1">Upcoming</p>
                </div>
                <Clock className="w-5 h-5 text-emerald-500 opacity-60" />
              </div>
            </div>
            <div className="kpi-card violet">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-2xl font-bold text-white">1</p>
                  <p className="text-[10px] text-gray-400 mt-1">Completed This month</p>
                </div>
                <CheckCircle className="w-5 h-5 text-violet-500 opacity-60" />
              </div>
            </div>
            <div className="kpi-card rose">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-2xl font-bold text-white">0</p>
                  <p className="text-[10px] text-gray-400 mt-1">Pending Acknowledgment</p>
                </div>
                <Clock className="w-5 h-5 text-rose-500 opacity-60" />
              </div>
            </div>
            <div className="kpi-card amber">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-2xl font-bold text-white">1</p>
                  <p className="text-[10px] text-gray-400 mt-1">Active Registries</p>
                </div>
                <PlusCircle className="w-5 h-5 text-amber-500 opacity-60" />
              </div>
            </div>
          </div>

          {/* Main Tab section and Search */}
          <div className="glass-card p-5 space-y-4">
            
            {/* Tabs */}
            <div className="flex border-b border-blue-500/10 pb-3 gap-6 flex-wrap">
              <button
                onClick={() => setActiveTab('today')}
                className={cn("text-xs font-semibold pb-2 border-b-2 px-1 transition-all", 
                  activeTab === 'today' ? "border-blue-500 text-white" : "border-transparent text-gray-400 hover:text-gray-200"
                )}
              >
                Today's Appointments
              </button>
              <button
                onClick={() => setActiveTab('upcoming')}
                className={cn("text-xs font-semibold pb-2 border-b-2 px-1 transition-all", 
                  activeTab === 'upcoming' ? "border-blue-500 text-white" : "border-transparent text-gray-400 hover:text-gray-200"
                )}
              >
                Upcoming
              </button>
              <button
                onClick={() => setActiveTab('completed')}
                className={cn("text-xs font-semibold pb-2 border-b-2 px-1 transition-all flex items-center gap-1.5", 
                  activeTab === 'completed' ? "border-blue-500 text-white" : "border-transparent text-gray-400 hover:text-gray-200"
                )}
              >
                Completed <span className="bg-emerald-500/20 text-emerald-400 text-[10px] px-1.5 py-0.5 rounded-full font-bold">1</span>
              </button>
              <button
                onClick={() => setActiveTab('all')}
                className={cn("text-xs font-semibold pb-2 border-b-2 px-1 transition-all flex items-center gap-1.5", 
                  activeTab === 'all' ? "border-blue-500 text-white" : "border-transparent text-gray-400 hover:text-gray-200"
                )}
              >
                All Appointments <span className="bg-blue-500/20 text-blue-400 text-[10px] px-1.5 py-0.5 rounded-full font-bold">1</span>
              </button>
            </div>

            {/* Filter bar */}
            <div className="flex gap-3 items-center flex-wrap">
              <div className="relative flex-1 min-w-[280px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by patient name, appointment ID..."
                  className="search-input w-full pl-9"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              <Button variant="outline">Search</Button>
              <Button variant="outline" className="p-2.5">
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>

            {/* Table */}
            <div className="overflow-hidden border border-blue-500/10 rounded-xl">
              <div className="overflow-x-auto">
                <table className="registry-table">
                  <thead>
                    <tr>
                      <th className="w-12">#</th>
                      <th>Appointment ID</th>
                      <th>Patient</th>
                      <th>Date & Time</th>
                      <th>Registry</th>
                      <th>Facility</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAppointments.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-gray-500">
                          No appointments found for the selected view.
                        </td>
                      </tr>
                    ) : (
                      filteredAppointments.map((apt, index) => (
                        <tr key={apt.id}>
                          <td className="font-mono text-xs text-gray-500">{index + 1}</td>
                          <td className="font-mono text-xs text-white font-semibold">{apt.appointmentId}</td>
                          <td className="font-medium text-white">{apt.patient}</td>
                          <td className="text-gray-300 font-mono">{apt.dateAndTime}</td>
                          <td className="text-gray-300">{apt.registry}</td>
                          <td className="text-gray-400">{apt.facility}</td>
                          <td>
                            <span className="badge badge-green text-[10px] font-semibold flex items-center gap-1 w-fit">
                              <Check className="w-3 h-3" /> Completed
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </>
      ) : (
        <>
          {/* Header */}
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <ShieldAlert className="w-5 h-5 text-blue-400" />
                <h2 className="text-xl font-bold text-white">Registry Consents</h2>
              </div>
              <p className="text-sm text-gray-400">
                Showing <span className="text-white font-semibold">{filteredConsents.length}</span> of <span className="text-white font-semibold">{consents.length}</span> patient consents
              </p>
            </div>
            <Button><PlusCircle className="w-4 h-4" /> Add Consent</Button>
          </div>

          {/* Filter panel */}
          <div className="glass-card p-4 flex flex-wrap gap-4 items-center">
            
            {/* Search */}
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                className="search-input w-full pl-9"
                placeholder="Search patient consents..."
                value={consentSearch}
                onChange={e => setConsentSearch(e.target.value)}
              />
            </div>

            {/* Filters */}
            <div className="flex gap-2 flex-wrap items-center">
              
              <select
                className="form-input form-select w-40 text-xs py-2"
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
              >
                <option value="All">Status: All</option>
                <option value="Granted">Granted</option>
                <option value="Revoked">Revoked</option>
                <option value="Pending">Pending</option>
              </select>

              <select
                className="form-input form-select w-40 text-xs py-2"
                value={expiryFilter}
                onChange={e => setExpiryFilter(e.target.value)}
              >
                <option value="All">Expiry Status</option>
                <option value="Active">Active</option>
                <option value="Expired">Expired</option>
              </select>

              <select
                className="form-input form-select w-44 text-xs py-2"
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value)}
              >
                <option value="All">Consent Category</option>
                <option value="Research">Research Purposes</option>
                <option value="Clinical">Clinical Treatment</option>
              </select>

            </div>
          </div>

          {/* Consents table */}
          <div className="glass-card overflow-hidden">
            <div className="overflow-x-auto text-xs font-sans">
              <table className="registry-table">
                <thead>
                  <tr>
                    <th className="w-12">ID</th>
                    <th>Patient</th>
                    <th>Consent</th>
                    <th>Facility</th>
                    <th>Provider</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th>Expiry</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredConsents.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-gray-500">
                        No consents found.
                      </td>
                    </tr>
                  ) : (
                    filteredConsents.map(c => (
                      <tr key={c.id}>
                        <td className="font-mono text-xs text-gray-500">{c.id}</td>
                        <td className="font-semibold text-white">{c.patient}</td>
                        <td className="text-gray-300 max-w-xs whitespace-normal">{c.consent}</td>
                        <td className="text-gray-400">{c.facility || '—'}</td>
                        <td className="text-gray-300 font-semibold">{c.provider}</td>
                        <td>
                          <span className={cn(
                            "badge text-[10px]",
                            c.status === 'Granted' && 'badge-green',
                            c.status === 'Revoked' && 'badge-red',
                            c.status === 'Pending' && 'badge-amber'
                          )}>
                            {c.status}
                          </span>
                        </td>
                        <td className="text-gray-400 font-mono">{c.created}</td>
                        <td className="text-gray-400 font-mono">{c.expiry}</td>
                        <td>
                          <div className="flex justify-end gap-1">
                            <Button variant="outline" size="sm" className="btn-sm">
                              Details
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
        </>
      )}

    </div>
  )
}

export default function AppointmentsPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Calendar className="w-8 h-8 text-blue-500 animate-spin" />
        <p className="text-sm text-gray-400">Loading Appointments & Consents...</p>
      </div>
    }>
      <AppointmentsAndConsentsContent />
    </Suspense>
  )
}

