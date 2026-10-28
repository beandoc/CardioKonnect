'use client'

import { useState, useMemo, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Calendar, Search, PlusCircle, CheckCircle, Clock, Check, RefreshCw,
  ShieldAlert, X, User, Building, Stethoscope, AlertCircle, FileText,
  Activity, ArrowUpRight
} from 'lucide-react'
import Button from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { useAppUser } from '@/context/AppUserContext'
import { filterPatientsByAccess } from '@/lib/accessControl'
import {
  getPatients, getAllLatestVisits, getAppointments, addAppointment,
  updateAppointmentStatus, updatePatient, type AppointmentDoc, type AppointmentInput
} from '@/lib/firestore'
import type { Patient, Visit } from '@/lib/types'
import { toast } from 'sonner'
import { notifyLoadError } from '@/lib/notify'

interface UnifiedAppointment {
  id: string
  appointmentId: string
  patientId: string
  patient: string
  dateAndTime: string
  registry: string
  facility: string
  doctor: string
  type: string
  status: 'Today' | 'Upcoming' | 'Completed' | 'Pending Acknowledgement' | 'Cancelled'
  isCustomAppointment: boolean
  notes?: string
}

interface UnifiedConsent {
  id: string
  patientId: string
  patient: string
  consent: string
  facility: string
  provider: string
  status: 'Granted' | 'Revoked' | 'Pending'
  created: string
  expiry: string
  rawPatient: Patient
}

function AppointmentsAndConsentsContent() {
  const { currentUser } = useAppUser()
  const searchParams = useSearchParams()
  const router = useRouter()
  const initialTab = searchParams.get('tab') === 'consents' ? 'consents' : 'appointments'

  const [activeMainTab, setActiveMainTab] = useState<'appointments' | 'consents'>(initialTab)

  // Data state
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [patients, setPatients] = useState<Patient[]>([])
  const [latestVisits, setLatestVisits] = useState<Map<string, Visit>>(new Map())
  const [firestoreAppointments, setFirestoreAppointments] = useState<AppointmentDoc[]>([])

  // Appointments filter state
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<'today' | 'upcoming' | 'completed' | 'all'>('all')

  // Consents filter state
  const [consentSearch, setConsentSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [categoryFilter, setCategoryFilter] = useState('All')

  // Schedule Appointment Modal State
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false)
  const [isSubmittingApt, setIsSubmittingApt] = useState(false)
  const [scheduleForm, setScheduleForm] = useState({
    patientId: '',
    date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    time: '10:00',
    type: 'Routine Follow-up (OPD)',
    doctor: currentUser?.name || 'Dr. A. Jayachandra',
    facility: currentUser?.siteId === 'KANPUR_APEX' ? 'Kanpur Cardiac Apex Hospital' : 'AICTS Pune',
    registry: 'Heart Failure Registry',
    notes: '',
  })

  // Consent Update Modal State
  const [selectedConsentPatient, setSelectedConsentPatient] = useState<Patient | null>(null)
  const [isConsentModalOpen, setIsConsentModalOpen] = useState(false)
  const [isUpdatingConsent, setIsUpdatingConsent] = useState(false)
  const [targetConsentStatus, setTargetConsentStatus] = useState<'Granted' | 'Revoked' | 'Pending'>('Granted')

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

  // Load live data from Firestore
  const loadData = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true)
    else setLoading(true)

    try {
      const [rawPatients, visitMap, rawAppointments] = await Promise.all([
        getPatients(),
        getAllLatestVisits(),
        getAppointments().catch(() => [] as AppointmentDoc[]),
      ])

      const accessiblePatients = filterPatientsByAccess(currentUser, rawPatients)
      setPatients(accessiblePatients)
      setLatestVisits(visitMap)
      setFirestoreAppointments(rawAppointments)
      if (isManualRefresh) {
        toast.success('Registry appointments refreshed from Firestore')
      }
    } catch (err) {
      notifyLoadError(err, 'Appointments & Consents')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [currentUser])

  // Merge Appointments: Firestore booked appointments + scheduled follow-up dates + real completed encounters
  const mergedAppointments = useMemo(() => {
    const list: UnifiedAppointment[] = []
    const todayStr = new Date().toISOString().slice(0, 10)

    // 1. Explicit appointments booked in Firestore
    firestoreAppointments.forEach(apt => {
      const aptDateStr = apt.dateAndTime ? apt.dateAndTime.slice(0, 10) : ''
      let status = apt.status
      if (status !== 'Cancelled' && status !== 'Pending Acknowledgement') {
        if (aptDateStr === todayStr) status = 'Today'
        else if (aptDateStr > todayStr) status = 'Upcoming'
        else status = 'Completed'
      }

      list.push({
        id: apt.id,
        appointmentId: apt.appointmentId,
        patientId: apt.patientId,
        patient: apt.patientName,
        dateAndTime: apt.dateAndTime,
        registry: apt.registry,
        facility: apt.facility,
        doctor: apt.doctor,
        type: apt.type,
        status,
        isCustomAppointment: true,
        notes: apt.notes,
      })
    })

    // 2. Scheduled follow-ups & documented visits from patient records
    patients.forEach(p => {
      const v = latestVisits.get(p.id)
      
      // Follow-up appointment if documented on visit
      if (v && v.followupDate) {
        const fDate = v.followupDate.slice(0, 10)
        const alreadyBooked = list.some(a => a.patientId === p.id && a.dateAndTime.slice(0, 10) === fDate)
        if (!alreadyBooked) {
          let status: 'Today' | 'Upcoming' | 'Completed' = 'Upcoming'
          if (fDate === todayStr) status = 'Today'
          else if (fDate < todayStr) status = 'Completed'

          list.push({
            id: `fup-${p.id}`,
            appointmentId: `FUP-${p.mrn || p.id.slice(0, 8)}`,
            patientId: p.id,
            patient: `${p.firstName} ${p.lastName}`,
            dateAndTime: `${fDate} 10:00 AM`,
            registry: p.registryId === 'cathlab' ? 'Cath Lab & Intervention' : 'Heart Failure Registry',
            facility: p.hospitalName || (p.siteId === 'KANPUR_APEX' ? 'Kanpur Cardiac Apex Hospital' : 'AICTS Pune'),
            doctor: p.primaryDoctor || (p.siteId === 'KANPUR_APEX' ? 'Dr. Rajeev Chauhan' : 'Dr. A. Jayachandra'),
            type: v.followupType ? `${v.followupType} Follow-up` : 'Clinical Follow-up',
            status,
            isCustomAppointment: false,
          })
        }
      }

      // Documented completed encounters
      if (v && v.visitDate) {
        const vDate = v.visitDate.slice(0, 10)
        list.push({
          id: `enc-${v.id || p.id}`,
          appointmentId: `ENC-${p.mrn || p.id.slice(0, 8)}`,
          patientId: p.id,
          patient: `${p.firstName} ${p.lastName}`,
          dateAndTime: `${vDate} 09:30 AM`,
          registry: p.registryId === 'cathlab' ? 'Cath Lab & Intervention' : 'Heart Failure Registry',
          facility: p.hospitalName || (p.siteId === 'KANPUR_APEX' ? 'Kanpur Cardiac Apex Hospital' : 'AICTS Pune'),
          doctor: p.primaryDoctor || (p.siteId === 'KANPUR_APEX' ? 'Dr. Rajeev Chauhan' : 'Dr. A. Jayachandra'),
          type: v.visitType ? `${v.visitType} Consultation` : 'OPD Consultation',
          status: 'Completed',
          isCustomAppointment: false,
        })
      }
    })

    // Sort descending by date
    return list.sort((a, b) => (b.dateAndTime || '').localeCompare(a.dateAndTime || ''))
  }, [firestoreAppointments, patients, latestVisits])

  // Filtered Appointments
  const filteredAppointments = useMemo(() => {
    return mergedAppointments.filter(apt => {
      const q = search.toLowerCase()
      const matchSearch =
        apt.patient.toLowerCase().includes(q) ||
        apt.appointmentId.toLowerCase().includes(q) ||
        apt.doctor.toLowerCase().includes(q) ||
        apt.facility.toLowerCase().includes(q) ||
        apt.type.toLowerCase().includes(q)

      if (activeTab === 'today') return matchSearch && apt.status === 'Today'
      if (activeTab === 'upcoming') return matchSearch && apt.status === 'Upcoming'
      if (activeTab === 'completed') return matchSearch && apt.status === 'Completed'
      return matchSearch
    })
  }, [mergedAppointments, search, activeTab])

  // Dynamic Statistics
  const stats = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10)
    const currentMonthStr = todayStr.slice(0, 7)

    const todayCount = mergedAppointments.filter(a => a.status === 'Today').length
    const upcomingCount = mergedAppointments.filter(a => a.status === 'Upcoming').length
    const completedMonthCount = mergedAppointments.filter(
      a => a.status === 'Completed' && (a.dateAndTime || '').startsWith(currentMonthStr)
    ).length
    const pendingCount = mergedAppointments.filter(a => a.status === 'Pending Acknowledgement').length
    const activeRegistries = new Set(mergedAppointments.map(a => a.registry)).size || 1

    return {
      today: todayCount,
      upcoming: upcomingCount,
      completedMonth: completedMonthCount,
      pending: pendingCount,
      activeRegistries,
      total: mergedAppointments.length,
      completedTotal: mergedAppointments.filter(a => a.status === 'Completed').length,
    }
  }, [mergedAppointments])

  // Unified Consents from real Firestore Patients
  const consents = useMemo(() => {
    return patients.map(p => {
      const status: 'Granted' | 'Revoked' | 'Pending' =
        p.consentStatus === 'Revoked' ? 'Revoked' :
        p.consentStatus === 'Pending' ? 'Pending' :
        'Granted'

      const created = p.consentDate || p.createdAt?.slice(0, 10) || '2026-01-01'
      const year = Number(created.slice(0, 4)) || 2026
      const expiry = `${year + 2}-12-31`

      return {
        id: `CNS-${p.mrn || p.id.slice(0, 8)}`,
        patientId: p.id,
        patient: `${p.firstName} ${p.lastName}`,
        consent: 'Multi-Center Cardiac Registry Clinical & Research Protocol (v2.1)',
        facility: p.hospitalName || (p.siteId === 'KANPUR_APEX' ? 'Kanpur Cardiac Apex Hospital' : 'AICTS Pune'),
        provider: p.primaryDoctor || (p.siteId === 'KANPUR_APEX' ? 'Dr. Rajeev Chauhan' : 'Dr. A. Jayachandra'),
        status,
        created,
        expiry,
        rawPatient: p,
      } as UnifiedConsent
    })
  }, [patients])

  const filteredConsents = useMemo(() => {
    return consents.filter(c => {
      const q = consentSearch.toLowerCase()
      const matchSearch =
        c.patient.toLowerCase().includes(q) ||
        c.consent.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q)
      const matchStatus = statusFilter === 'All' || c.status === statusFilter
      return matchSearch && matchStatus
    })
  }, [consents, consentSearch, statusFilter])

  // Handle Schedule Appointment Submission
  const handleScheduleAppointment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!scheduleForm.patientId) {
      toast.error('Please select a patient.')
      return
    }

    const selectedPt = patients.find(p => p.id === scheduleForm.patientId)
    if (!selectedPt) {
      toast.error('Selected patient not found.')
      return
    }

    setIsSubmittingApt(true)
    const toastId = toast.loading('Booking appointment in Firestore...')

    try {
      const appointmentId = `APT-${Date.now().toString().slice(-6)}`
      const combinedDateTime = `${scheduleForm.date}T${scheduleForm.time}`
      const todayStr = new Date().toISOString().slice(0, 10)
      let initialStatus: AppointmentDoc['status'] = 'Upcoming'
      if (scheduleForm.date === todayStr) initialStatus = 'Today'
      else if (scheduleForm.date < todayStr) initialStatus = 'Completed'

      const newAptInput: AppointmentInput = {
        appointmentId,
        patientId: selectedPt.id,
        patientName: `${selectedPt.firstName} ${selectedPt.lastName}`,
        mrn: selectedPt.mrn || selectedPt.id.slice(0, 8),
        dateAndTime: combinedDateTime,
        type: scheduleForm.type,
        registry: scheduleForm.registry,
        facility: scheduleForm.facility,
        doctor: scheduleForm.doctor,
        status: initialStatus,
        notes: scheduleForm.notes.trim(),
        siteId: selectedPt.siteId || currentUser?.siteId || 'AICTS_PUNE',
      }

      await addAppointment(newAptInput)
      toast.success(`Appointment ${appointmentId} booked for ${selectedPt.firstName} ${selectedPt.lastName}`, { id: toastId })
      setIsScheduleModalOpen(false)
      
      // Reset form
      setScheduleForm({
        patientId: '',
        date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
        time: '10:00',
        type: 'Routine Follow-up (OPD)',
        doctor: currentUser?.name || 'Dr. A. Jayachandra',
        facility: currentUser?.siteId === 'KANPUR_APEX' ? 'Kanpur Cardiac Apex Hospital' : 'AICTS Pune',
        registry: 'Heart Failure Registry',
        notes: '',
      })

      await loadData()
    } catch (err) {
      console.error('Failed to book appointment:', err)
      toast.error('Failed to save appointment in database.', { id: toastId })
    } finally {
      setIsSubmittingApt(false)
    }
  }

  // Handle Consent Update Submission
  const handleUpdateConsent = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedConsentPatient) return

    setIsUpdatingConsent(true)
    const toastId = toast.loading('Updating patient consent status in Firestore...')

    try {
      await updatePatient(selectedConsentPatient.id, {
        consentStatus: targetConsentStatus,
        consentDate: new Date().toISOString().split('T')[0],
      })
      toast.success(`Consent for ${selectedConsentPatient.firstName} ${selectedConsentPatient.lastName} updated to ${targetConsentStatus}`, { id: toastId })
      setIsConsentModalOpen(false)
      setSelectedConsentPatient(null)
      await loadData()
    } catch (err) {
      console.error('Failed to update consent:', err)
      toast.error('Failed to update consent status in database.', { id: toastId })
    } finally {
      setIsUpdatingConsent(false)
    }
  }

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
                <p className="text-xs text-gray-400 mt-1">Manage scheduled clinical encounters, follow-up dates, and consultation records</p>
                <p className="text-[10px] text-gray-500 mt-0.5">
                  Logged in: <span className="text-blue-400 font-semibold">{currentUser?.name || 'Registry Investigator'}</span> ({currentUser?.siteId === 'KANPUR_APEX' ? 'Kanpur Cardiac Apex' : 'AICTS Pune'})
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => loadData(true)}
                disabled={refreshing || loading}
                className="text-xs"
              >
                <RefreshCw className={cn("w-3.5 h-3.5", (refreshing || loading) && "animate-spin text-blue-400")} />
                Sync Firestore
              </Button>
              <Button onClick={() => setIsScheduleModalOpen(true)}>
                <PlusCircle className="w-4 h-4" /> Schedule Appointment
              </Button>
            </div>
          </div>

          {/* Dynamic KPI Stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="kpi-card blue p-4 rounded-xl">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-2xl font-bold text-white">{stats.today}</p>
                  <p className="text-[10px] text-gray-400 mt-1">Today's Appointments</p>
                </div>
                <Calendar className="w-5 h-5 text-blue-400 opacity-80" />
              </div>
            </div>
            <div className="kpi-card emerald p-4 rounded-xl">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-2xl font-bold text-emerald-400">{stats.upcoming}</p>
                  <p className="text-[10px] text-gray-400 mt-1">Upcoming Follow-ups</p>
                </div>
                <Clock className="w-5 h-5 text-emerald-400 opacity-80" />
              </div>
            </div>
            <div className="kpi-card violet p-4 rounded-xl">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-2xl font-bold text-violet-300">{stats.completedMonth}</p>
                  <p className="text-[10px] text-gray-400 mt-1">Completed This Month</p>
                </div>
                <CheckCircle className="w-5 h-5 text-violet-400 opacity-80" />
              </div>
            </div>
            <div className="kpi-card rose p-4 rounded-xl">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-2xl font-bold text-white">{stats.pending}</p>
                  <p className="text-[10px] text-gray-400 mt-1">Pending Review</p>
                </div>
                <Clock className="w-5 h-5 text-rose-400 opacity-80" />
              </div>
            </div>
            <div className="kpi-card amber p-4 rounded-xl">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-2xl font-bold text-amber-400">{stats.activeRegistries}</p>
                  <p className="text-[10px] text-gray-400 mt-1">Active Registries</p>
                </div>
                <Activity className="w-5 h-5 text-amber-400 opacity-80" />
              </div>
            </div>
          </div>

          {/* Main Tab section and Search */}
          <div className="glass-card p-5 space-y-4 rounded-2xl">
            
            {/* Tabs */}
            <div className="flex border-b border-blue-500/10 pb-3 gap-6 flex-wrap">
              <button
                onClick={() => setActiveTab('all')}
                className={cn("text-xs font-semibold pb-2 border-b-2 px-1 transition-all flex items-center gap-1.5", 
                  activeTab === 'all' ? "border-blue-500 text-white" : "border-transparent text-gray-400 hover:text-gray-200"
                )}
              >
                All Appointments <span className="bg-blue-500/20 text-blue-400 text-[10px] px-1.5 py-0.5 rounded-full font-bold">{stats.total}</span>
              </button>
              <button
                onClick={() => setActiveTab('today')}
                className={cn("text-xs font-semibold pb-2 border-b-2 px-1 transition-all flex items-center gap-1.5", 
                  activeTab === 'today' ? "border-blue-500 text-white" : "border-transparent text-gray-400 hover:text-gray-200"
                )}
              >
                Today's Appointments <span className="bg-amber-500/20 text-amber-400 text-[10px] px-1.5 py-0.5 rounded-full font-bold">{stats.today}</span>
              </button>
              <button
                onClick={() => setActiveTab('upcoming')}
                className={cn("text-xs font-semibold pb-2 border-b-2 px-1 transition-all flex items-center gap-1.5", 
                  activeTab === 'upcoming' ? "border-blue-500 text-white" : "border-transparent text-gray-400 hover:text-gray-200"
                )}
              >
                Upcoming <span className="bg-emerald-500/20 text-emerald-400 text-[10px] px-1.5 py-0.5 rounded-full font-bold">{stats.upcoming}</span>
              </button>
              <button
                onClick={() => setActiveTab('completed')}
                className={cn("text-xs font-semibold pb-2 border-b-2 px-1 transition-all flex items-center gap-1.5", 
                  activeTab === 'completed' ? "border-blue-500 text-white" : "border-transparent text-gray-400 hover:text-gray-200"
                )}
              >
                Completed Encounters <span className="bg-emerald-500/20 text-emerald-400 text-[10px] px-1.5 py-0.5 rounded-full font-bold">{stats.completedTotal}</span>
              </button>
            </div>

            {/* Filter bar */}
            <div className="flex gap-3 items-center flex-wrap">
              <div className="relative flex-1 min-w-[280px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Filter by patient name, Hospital ID / MRN, doctor, or appointment ID..."
                  className="search-input w-full pl-9 pr-4 py-2 text-xs"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              {search && (
                <Button variant="outline" size="sm" onClick={() => setSearch('')}>
                  Clear
                </Button>
              )}
            </div>

            {/* Table */}
            <div className="overflow-hidden border border-blue-500/10 rounded-xl">
              <div className="overflow-x-auto">
                <table className="registry-table w-full text-left">
                  <thead>
                    <tr className="border-b border-gray-700/20 text-[11px] font-semibold uppercase tracking-wider">
                      <th className="w-12 py-3 px-4">#</th>
                      <th className="py-3 px-4">Appointment ID</th>
                      <th className="py-3 px-4">Patient</th>
                      <th className="py-3 px-4">Date & Time</th>
                      <th className="py-3 px-4">Type</th>
                      <th className="py-3 px-4">Registry</th>
                      <th className="py-3 px-4">Facility & Doctor</th>
                      <th className="py-3 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="text-xs">
                    {loading ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-gray-400">
                          <Activity className="w-6 h-6 text-blue-500 animate-spin mx-auto mb-2" />
                          Loading appointments from Firestore...
                        </td>
                      </tr>
                    ) : filteredAppointments.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-gray-400">
                          <Clock className="w-8 h-8 text-gray-500 mx-auto mb-2 opacity-50" />
                          <p className="text-sm font-semibold text-white">No appointments found</p>
                          <p className="text-xs text-gray-500 mt-1">Use the "Schedule Appointment" button above to book clinical follow-ups.</p>
                        </td>
                      </tr>
                    ) : (
                      filteredAppointments.map((apt, index) => (
                        <tr key={apt.id} className="transition-colors border-b border-gray-800/40 hover:bg-white/[0.02]">
                          <td className="font-mono text-xs text-gray-500 py-3.5 px-4">{index + 1}</td>
                          <td className="font-mono text-xs text-blue-400 font-semibold py-3.5 px-4">
                            {apt.appointmentId}
                          </td>
                          <td className="py-3.5 px-4">
                            <Link
                              href={`/patients/${apt.patientId}`}
                              className="font-medium text-white hover:text-blue-400 inline-flex items-center gap-1 group"
                            >
                              <span>{apt.patient}</span>
                              <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 text-blue-400 transition-opacity" />
                            </Link>
                          </td>
                          <td className="text-gray-300 font-mono py-3.5 px-4">{apt.dateAndTime}</td>
                          <td className="text-gray-300 py-3.5 px-4 font-medium">{apt.type}</td>
                          <td className="text-gray-400 py-3.5 px-4">{apt.registry}</td>
                          <td className="py-3.5 px-4">
                            <div className="text-white font-medium">{apt.facility}</div>
                            <div className="text-[11px] text-gray-400">{apt.doctor}</div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className={cn(
                              "badge text-[10px] font-semibold flex items-center gap-1 w-fit",
                              apt.status === 'Completed' && "badge-green",
                              apt.status === 'Upcoming' && "badge-blue",
                              apt.status === 'Today' && "badge-amber",
                              apt.status === 'Pending Acknowledgement' && "badge-red"
                            )}>
                              {apt.status === 'Completed' && <Check className="w-3 h-3" />}
                              {apt.status === 'Upcoming' && <Clock className="w-3 h-3" />}
                              {apt.status === 'Today' && <AlertCircle className="w-3 h-3" />}
                              {apt.status}
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
          <div className="flex items-center justify-between mb-2 flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <ShieldAlert className="w-5 h-5 text-blue-400" />
                <h2 className="text-xl font-bold text-white">Registry Consents</h2>
              </div>
              <p className="text-xs text-gray-400">
                Audited <span className="text-white font-semibold">{filteredConsents.length}</span> of <span className="text-white font-semibold">{consents.length}</span> registry patient consent protocols
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => loadData(true)}
                disabled={refreshing || loading}
                className="text-xs"
              >
                <RefreshCw className={cn("w-3.5 h-3.5", (refreshing || loading) && "animate-spin text-blue-400")} />
                Sync Consents
              </Button>
            </div>
          </div>

          {/* Filter panel */}
          <div className="glass-card p-4 rounded-xl flex flex-wrap gap-4 items-center">
            
            {/* Search */}
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                className="search-input w-full pl-9 pr-4 py-2 text-xs"
                placeholder="Search patient consents by name, consent ID, or MRN..."
                value={consentSearch}
                onChange={e => setConsentSearch(e.target.value)}
              />
            </div>

            {/* Filters */}
            <div className="flex gap-2 flex-wrap items-center">
              <select
                className="form-select w-40 text-xs py-2 bg-slate-900 border border-gray-700/40 rounded-xl"
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
              >
                <option value="All">Status: All</option>
                <option value="Granted">Granted</option>
                <option value="Revoked">Revoked</option>
                <option value="Pending">Pending</option>
              </select>

              <select
                className="form-select w-44 text-xs py-2 bg-slate-900 border border-gray-700/40 rounded-xl"
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value)}
              >
                <option value="All">Category: All</option>
                <option value="Research">Research & Multi-center</option>
                <option value="Clinical">Clinical Care Protocol</option>
              </select>
            </div>
          </div>

          {/* Consents table */}
          <div className="glass-card overflow-hidden rounded-2xl">
            <div className="overflow-x-auto text-xs font-sans">
              <table className="registry-table w-full text-left">
                <thead>
                  <tr className="border-b border-gray-700/20 text-[11px] font-semibold uppercase tracking-wider">
                    <th className="w-12 py-3 px-4">Consent ID</th>
                    <th className="py-3 px-4">Patient</th>
                    <th className="py-3 px-4">Protocol</th>
                    <th className="py-3 px-4">Facility</th>
                    <th className="py-3 px-4">Lead Investigator</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Consent Date</th>
                    <th className="py-3 px-4">Expiry Date</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="text-xs">
                  {loading ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-gray-400">
                        <Activity className="w-6 h-6 text-blue-500 animate-spin mx-auto mb-2" />
                        Loading consents from Firestore...
                      </td>
                    </tr>
                  ) : filteredConsents.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-gray-500">
                        No consents match search criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredConsents.map(c => (
                      <tr key={c.id} className="border-b border-gray-800/40 hover:bg-white/[0.02] transition-colors">
                        <td className="font-mono text-xs text-blue-400 py-3.5 px-4">{c.id}</td>
                        <td className="font-semibold text-white py-3.5 px-4">
                          <Link href={`/patients/${c.patientId}`} className="hover:text-blue-400 transition-colors">
                            {c.patient}
                          </Link>
                        </td>
                        <td className="text-gray-300 max-w-xs whitespace-normal py-3.5 px-4">{c.consent}</td>
                        <td className="text-gray-400 py-3.5 px-4">{c.facility || '—'}</td>
                        <td className="text-gray-300 font-semibold py-3.5 px-4">{c.provider}</td>
                        <td className="py-3.5 px-4">
                          <span className={cn(
                            "badge text-[10px] font-semibold",
                            c.status === 'Granted' && 'badge-green',
                            c.status === 'Revoked' && 'badge-red',
                            c.status === 'Pending' && 'badge-amber'
                          )}>
                            {c.status}
                          </span>
                        </td>
                        <td className="text-gray-400 font-mono py-3.5 px-4">{c.created}</td>
                        <td className="text-gray-400 font-mono py-3.5 px-4">{c.expiry}</td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={() => {
                              setSelectedConsentPatient(c.rawPatient)
                              setTargetConsentStatus(c.status)
                              setIsConsentModalOpen(true)
                            }}
                            className="btn-outline px-2.5 py-1 rounded-lg text-xs font-semibold"
                          >
                            Update
                          </button>
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

      {/* ─────────────────────────────────────────────────────────────
          SCHEDULE APPOINTMENT MODAL
      ───────────────────────────────────────────────────────────── */}
      {isScheduleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className="glass-card relative w-full max-w-lg my-8 rounded-2xl shadow-2xl overflow-hidden">
            
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700/20">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Schedule Patient Appointment</h3>
                  <p className="text-[11px] text-gray-400">Book follow-up consultation or diagnostic review in Firestore</p>
                </div>
              </div>
              <button
                onClick={() => setIsScheduleModalOpen(false)}
                className="btn-ghost p-1.5 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleScheduleAppointment} className="p-6 space-y-4">
              <div>
                <label className="form-label block text-[11px] font-semibold text-blue-400 mb-1">Select Patient *</label>
                <select
                  required
                  value={scheduleForm.patientId}
                  onChange={e => setScheduleForm({ ...scheduleForm, patientId: e.target.value })}
                  className="form-select w-full px-3 py-2 text-xs font-medium"
                >
                  <option value="">-- Choose Registered Patient --</option>
                  {patients.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.firstName} {p.lastName} (HID: {p.mrn || p.id.slice(0, 8)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label block text-[10px] mb-1">Appointment Date *</label>
                  <input
                    type="date"
                    required
                    value={scheduleForm.date}
                    onChange={e => setScheduleForm({ ...scheduleForm, date: e.target.value })}
                    className="form-input w-full px-2.5 py-1.5 text-xs"
                  />
                </div>
                <div>
                  <label className="form-label block text-[10px] mb-1">Appointment Time</label>
                  <input
                    type="time"
                    value={scheduleForm.time}
                    onChange={e => setScheduleForm({ ...scheduleForm, time: e.target.value })}
                    className="form-input w-full px-2.5 py-1.5 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="form-label block text-[10px] mb-1">Appointment Type</label>
                <select
                  value={scheduleForm.type}
                  onChange={e => setScheduleForm({ ...scheduleForm, type: e.target.value })}
                  className="form-select w-full px-2.5 py-1.5 text-xs"
                >
                  <option value="Routine Follow-up (OPD)">Routine Follow-up (OPD)</option>
                  <option value="2D Echocardiogram Review">2D Echocardiogram Review</option>
                  <option value="GDMT Titration Visit">GDMT Titration Visit</option>
                  <option value="Post-PCI Review">Post-PCI Follow-up</option>
                  <option value="Lab Workup Review">Lab Workup Review</option>
                  <option value="Telemedicine Consultation">Telemedicine Consultation</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label block text-[10px] mb-1">Attending Clinician</label>
                  <input
                    type="text"
                    value={scheduleForm.doctor}
                    onChange={e => setScheduleForm({ ...scheduleForm, doctor: e.target.value })}
                    className="form-input w-full px-2.5 py-1.5 text-xs"
                  />
                </div>
                <div>
                  <label className="form-label block text-[10px] mb-1">Clinic / Facility</label>
                  <input
                    type="text"
                    value={scheduleForm.facility}
                    onChange={e => setScheduleForm({ ...scheduleForm, facility: e.target.value })}
                    className="form-input w-full px-2.5 py-1.5 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="form-label block text-[10px] mb-1">Clinical Notes / Indication</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Follow-up post discharge; assess NT-proBNP response and titrate ARNI."
                  value={scheduleForm.notes}
                  onChange={e => setScheduleForm({ ...scheduleForm, notes: e.target.value })}
                  className="form-input w-full px-2.5 py-1.5 text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-700/20">
                <button
                  type="button"
                  onClick={() => setIsScheduleModalOpen(false)}
                  className="btn-ghost px-4 py-2 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingApt}
                  className="btn-primary flex items-center gap-2 px-5 py-2 text-xs font-bold"
                >
                  <Calendar className="w-4 h-4" />
                  {isSubmittingApt ? 'Saving to Firestore...' : 'Book Appointment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          UPDATE CONSENT MODAL
      ───────────────────────────────────────────────────────────── */}
      {isConsentModalOpen && selectedConsentPatient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="glass-card relative w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700/20">
              <div className="flex items-center gap-3">
                <ShieldAlert className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="text-sm font-bold text-white">Update Patient Consent Status</h3>
                  <p className="text-[11px] text-gray-400">
                    {selectedConsentPatient.firstName} {selectedConsentPatient.lastName} (HID: {selectedConsentPatient.mrn || selectedConsentPatient.id.slice(0, 8)})
                  </p>
                </div>
              </div>
              <button onClick={() => setIsConsentModalOpen(false)} className="btn-ghost p-1.5 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateConsent} className="p-6 space-y-4">
              <div>
                <label className="form-label block text-[11px] font-semibold text-gray-300 mb-1">Consent Status</label>
                <select
                  value={targetConsentStatus}
                  onChange={e => setTargetConsentStatus(e.target.value as any)}
                  className="form-select w-full px-3 py-2 text-xs font-semibold"
                >
                  <option value="Granted">Granted (Full Registry Participation)</option>
                  <option value="Revoked">Revoked (Participant Withdrew)</option>
                  <option value="Pending">Pending (Consent Form Awaiting Signature)</option>
                </select>
              </div>

              <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300 space-y-1">
                <div className="font-semibold text-white">Regulatory Audit Notice</div>
                <p className="text-[11px] text-gray-400">
                  Changing consent status is recorded in the immutable audit trail. Patients with "Revoked" consent are automatically masked in exploratory cohorts.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-700/20">
                <button
                  type="button"
                  onClick={() => setIsConsentModalOpen(false)}
                  className="btn-ghost px-4 py-2 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingConsent}
                  className="btn-primary flex items-center gap-2 px-5 py-2 text-xs font-bold"
                >
                  {isUpdatingConsent ? 'Updating...' : 'Save Consent Status'}
                </button>
              </div>
            </form>
          </div>
        </div>
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
