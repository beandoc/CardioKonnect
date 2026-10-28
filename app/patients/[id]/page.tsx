'use client'
import { complicationFlags, complicationLabels } from '@/lib/complications'
import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  getPatient, getVisits, deleteVisit, updatePatient, getPatientTrends,
  getOutcomeEvents, addOutcomeEvent, deleteOutcomeEvent, deletePatient,
  getCathProceduresByPatient, deleteProcedure, writeAudit
} from '@/lib/firestore'
import { notifyLoadError } from '@/lib/notify'
import type { Patient, Visit, OutcomeEvent, OutcomeEventInput, EventType, CathProcedure } from '@/lib/types'
import { getAge, formatDate, nyhaBadgeColor, hfTypeBadgeColor, lvefColor, initials, cn, fullName } from '@/lib/utils'
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card'
import { FieldWrap, Input, Select, Textarea } from '@/components/ui/FormField'
import Button from '@/components/ui/Button'
import VisitTimeline from '@/components/patients/VisitTimeline'
import MetricTrendChart from '@/components/charts/MetricTrendChart'
import PatientForm from '@/components/forms/PatientForm'
import GDMTDashboard from '@/components/patients/GDMTDashboard'
import type { PatientTrends } from '@/lib/types'
import { toast } from 'sonner'
import {
  PlusCircle, Edit2, Edit3, X, Activity, ShieldAlert, Award, Calendar, Trash2,
  CheckCircle2, Circle, ClipboardList, Sparkles, Heart, Pill, ShieldCheck, Gauge,
  AlertTriangle, Copy, Check, MapPin, User, Stethoscope, Droplets, Clock,
  TrendingUp, LayoutDashboard, FileText, ChevronRight, Phone, Mail
} from 'lucide-react'
import MLRiskCard from '@/components/patients/MLRiskCard'
import CathInterventionalRiskCard from '@/components/patients/CathInterventionalRiskCard'
import DataCompletenessCard from '@/components/patients/DataCompletenessCard'
import { calculateCathProcedureCompleteness } from '@/lib/dataCompleteness'
import QuickDataEntryModal from '@/components/patients/QuickDataEntryModal'
import ComorbiditiesMatrix from '@/components/patients/ComorbiditiesMatrix'
import CathProcedureModal from '@/components/procedures/CathProcedureModal'
import { useAppUser } from '@/context/AppUserContext'
import { canViewPatient, patientAccessDeniedReason } from '@/lib/accessControl'
import { SITES } from '@/lib/appConfig'

const EVENT_TYPES: EventType[] = [
  'All-cause death', 'CV death', 'HF hospitalisation', 'Urgent HF visit', 'LVAD implant',
  'Heart transplant', 'ICD appropriate shock', 'ICD inappropriate shock', 'Stroke / TIA',
  'Myocardial infarction', 'AKI requiring RRT', 'Worsening HF (outpatient)', 'Ventricular arrhythmia',
  'AF new-onset', 'Other CV event'
]

const REGISTRY_MAP: Record<string, string> = {
  hf: 'Heart Failure Registry',
  acs: 'ACS & Coronary Registry',
  arrhythmia: 'Arrhythmia & EP Registry',
  structural: 'Structural Heart Disease Registry',
  cathlab: 'Cath Lab & Interventional Registry',
  preventive: 'Preventive Cardiology Registry',
}

export default function PatientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const searchParams = useSearchParams()
  const tabParam = searchParams.get('tab')
  const [patient, setPatient] = useState<Patient | null>(null)
  const [visits, setVisits] = useState<Visit[]>([])
  const [trends, setTrends] = useState<PatientTrends | null>(null)
  const [outcomeEvents, setOutcomeEvents] = useState<OutcomeEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [addingEvent, setAddingEvent] = useState(false)
  const [savingEvent, setSavingEvent] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'timeline' | 'trends' | 'outcomes' | 'gdmt' | 'procedures'>('overview')
  const [showQuickModal, setShowQuickModal] = useState(false)
  const [patientProcedures, setPatientProcedures] = useState<CathProcedure[]>([])
  const [isCathModalOpen, setIsCathModalOpen] = useState(false)
  const [editingProcedure, setEditingProcedure] = useState<CathProcedure | null>(null)
  const [copiedMrn, setCopiedMrn] = useState(false)

  // Outcome Event Form State
  const [eventDate, setEventDate] = useState(new Date().toISOString().split('T')[0])
  const [eventType, setEventType] = useState<EventType>('HF hospitalisation')
  const [eventEncounterType, setEventEncounterType] = useState<'Inpatient Index' | 'Readmission' | 'Emergency Visit' | 'Out-of-Hospital Event'>('Readmission')
  const [eventAdmissionDate, setEventAdmissionDate] = useState('')
  const [eventDischargeDate, setEventDischargeDate] = useState('')
  const [eventIvDiuretic, setEventIvDiuretic] = useState(false)
  const [eventInotrope, setEventInotrope] = useState(false)
  const [eventNIV, setEventNIV] = useState(false)
  const [eventVent, setEventVent] = useState(false)
  const [eventDesc, setEventDesc] = useState('')
  const [eventHosp, setEventHosp] = useState('AICTS Pune')
  // New events start unadjudicated; adjudication must be recorded explicitly by the adjudicator.
  const [eventAdjudicated, setEventAdjudicated] = useState(false)
  const [eventAdjudicator, setEventAdjudicator] = useState('')
  const [eventAdjudicationStatus, setEventAdjudicationStatus] = useState<'Pending Review' | 'Adjudicated - Confirmed' | 'Adjudicated - Reclassified' | 'Adjudicated - Rejected'>('Pending Review')

  useEffect(() => {
    if (tabParam === 'overview' || tabParam === 'timeline' || tabParam === 'trends' || tabParam === 'outcomes' || tabParam === 'gdmt' || tabParam === 'procedures') {
      setActiveTab(tabParam)
    }
  }, [tabParam])

  const viewAudited = useRef<string | null>(null)

  const load = useCallback(async () => {
    let p: Patient | null, v: Visit[], t: PatientTrends, o: OutcomeEvent[], procs: CathProcedure[]
    try {
      ;[p, v, t, o, procs] = await Promise.all([
        getPatient(id),
        getVisits(id),
        getPatientTrends(id),
        getOutcomeEvents(id),
        getCathProceduresByPatient(id),
      ])
    } catch (err) {
      notifyLoadError(err, 'Patient record')
      setLoadError(err instanceof Error ? err.message : String(err))
      setPatient(null)
      setLoading(false)
      return
    }
    setLoadError(null)

    if (p && viewAudited.current !== id) {
      viewAudited.current = id
      writeAudit('VIEW', 'patient', id, id).catch(() => {})
    }

    setPatient(p)
    setVisits(v)
    setTrends(t)
    setOutcomeEvents(o)
    setPatientProcedures(procs)
    if (p) {
      const isCath = p.registryId === 'cathlab' || p.registryIds?.includes('cathlab') || p.siteId === 'KANPUR_APEX'
      if (!tabParam && isCath) {
        setActiveTab('procedures')
      }
      const siteHospital = p.hospitalName || (p.siteId === 'KANPUR_APEX' ? 'Kanpur Cardiac Apex Hospital' : 'AICTS Pune')
      setEventHosp(siteHospital)
    }
    setLoading(false)
  }, [id, tabParam])

  useEffect(() => { load() }, [load])

  const handleDeleteVisit = async (visitId: string) => {
    if (!confirm('Delete this visit record?')) return
    await deleteVisit(id, visitId)
    toast.success('Visit deleted')
    load()
  }

  const handleDeleteProcedure = async (procedureId: string) => {
    if (!confirm('Are you sure you want to delete this interventional procedure record? This action cannot be undone.')) return
    try {
      await deleteProcedure(id, procedureId)
      toast.success('Procedure deleted')
      load()
    } catch (err: any) {
      toast.error('Failed to delete procedure: ' + (err?.message || 'Unknown error'))
    }
  }

  const handleUpdatePatient = async (data: Partial<Patient>) => {
    setSaving(true)
    const toastId = toast.loading('Updating patient profile...')
    const timeoutId = setTimeout(() => {
      toast.warning('Database response is taking longer than expected. Please check your internet or security rules.', {
        id: toastId,
        duration: 8000,
      })
    }, 5000)

    try {
      await updatePatient(id, data)
      clearTimeout(timeoutId)
      toast.success('Patient updated successfully', { id: toastId })
      setEditing(false)
      load()
    } catch (e) {
      clearTimeout(timeoutId)
      console.error('Patient update error:', e)
      toast.error('Update failed. Please check database configuration/security rules.', { id: toastId })
    } finally {
      setSaving(false)
    }
  }

  const handleQuickEnroll = async (registryId: string) => {
    setSaving(true)
    const toastId = toast.loading(`Enrolling in ${REGISTRY_MAP[registryId] || registryId}...`)
    try {
      const updatedRegistryIds = Array.from(new Set([...(patient?.registryIds || []), registryId]))
      const now = new Date().toISOString()
      const updatedEnrollments = {
        ...(patient?.registryEnrollments || {}),
        [registryId]: {
          enrolledAt: now,
          enrolledBy: currentUser?.id || 'quick_enroll',
          siteId: patient?.siteId || currentUser?.siteId || 'AICTS_PUNE',
          status: 'Active' as const,
        }
      }
      await updatePatient(id, {
        registryId,
        registryIds: updatedRegistryIds,
        registryEnrollments: updatedEnrollments,
      })
      toast.success('Patient enrolled successfully', { id: toastId })
      load()
    } catch (e) {
      console.error('Quick enroll error:', e)
      toast.error('Enrollment failed. Please check connection or database rules.', { id: toastId })
    } finally {
      setSaving(false)
    }
  }

  const handleAddEventSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingEvent(true)
    const toastId = toast.loading('Recording structured endpoint...')

    const timeoutId = setTimeout(() => {
      toast.warning('Database response is taking longer than expected. Please check your connection.', {
        id: toastId,
        duration: 8000,
      })
    }, 5000)

    try {
      const input: OutcomeEventInput = {
        patientId: id,
        eventDate,
        encounterType: eventEncounterType,
        admissionDate: eventAdmissionDate || undefined,
        dischargeDate: eventDischargeDate || undefined,
        eventType,
        description: eventDesc,
        hospitalName: eventHosp,
        interventions: {
          ivLoopDiuretics: eventIvDiuretic,
          ivInotropesOrVasopressors: eventInotrope,
          nonInvasiveVentilation: eventNIV,
          invasiveMechanicalVentilation: eventVent,
        },
        adjudicated: eventAdjudicated && eventAdjudicationStatus !== 'Pending Review',
        adjudicationStatus: eventAdjudicationStatus,
        adjudicatedBy: eventAdjudicator || undefined
      }
      await addOutcomeEvent(id, input)
      clearTimeout(timeoutId)
      toast.success('Structured endpoint recorded successfully', { id: toastId })
      setAddingEvent(false)
      setEventDesc('')
      setEventAdmissionDate('')
      setEventDischargeDate('')
      load()
    } catch (err) {
      clearTimeout(timeoutId)
      console.error('Add event error:', err)
      toast.error('Failed to add outcome event.', { id: toastId })
    } finally {
      setSavingEvent(false)
    }
  }

  const handleDeleteEvent = async (eventId: string) => {
    if (!confirm('Delete this outcome event?')) return
    const toastId = toast.loading('Deleting outcome event...')
    const timeoutId = setTimeout(() => {
      toast.warning('Database response is taking longer than expected. Please check your connection.', {
        id: toastId,
        duration: 8000,
      })
    }, 5000)

    try {
      await deleteOutcomeEvent(id, eventId)
      clearTimeout(timeoutId)
      toast.success('Outcome event deleted successfully', { id: toastId })
      load()
    } catch (e) {
      clearTimeout(timeoutId)
      console.error('Delete event error:', e)
      toast.error('Failed to delete event. Please check database configuration/security rules.', { id: toastId })
    }
  }

  const handleDeletePatient = async () => {
    if (typeof window === 'undefined') return
    const ok = window.confirm("WARNING: Are you sure you want to delete this patient? This action is permanent and will cascade to delete all visits, events, and outcomes.")
    if (!ok) return

    const toastId = toast.loading('Deleting patient record...')
    const timeoutId = setTimeout(() => {
      toast.warning('Database response is taking longer than expected. Please check your connection.', {
        id: toastId,
        duration: 8000,
      })
    }, 5000)

    try {
      await deletePatient(id)
      clearTimeout(timeoutId)
      toast.success('Patient record deleted successfully', { id: toastId })
      router.push('/patients')
    } catch (e) {
      clearTimeout(timeoutId)
      console.error('Delete patient error:', e)
      toast.error('Failed to delete patient. Please check database configuration/security rules.', { id: toastId })
    }
  }

  // Analyze KCCQ drops >10 points (clinically meaningful change)
  const kccqDropAlert = useMemo(() => {
    if (visits.length < 2) return null
    const kccqVisits = visits
      .filter(v => v.kccq?.overallSummaryScore !== undefined && v.kccq?.overallSummaryScore !== null)
      .sort((a, b) => new Date(a.visitDate).getTime() - new Date(b.visitDate).getTime())

    if (kccqVisits.length < 2) return null

    // Look for latest drop
    for (let i = kccqVisits.length - 1; i >= 1; i--) {
      const prev = kccqVisits[i - 1].kccq!.overallSummaryScore!
      const curr = kccqVisits[i].kccq!.overallSummaryScore!
      const diff = prev - curr
      if (diff > 10) {
        return {
          dropPoints: diff,
          prevScore: prev,
          currScore: curr,
          prevDate: kccqVisits[i - 1].visitDate,
          currDate: kccqVisits[i].visitDate,
        }
      }
    }
    return null
  }, [visits])

  const { currentUser } = useAppUser()

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Activity className="w-6 h-6 text-blue-400 animate-pulse" />
    </div>
  )

  if (!patient) {
    return (
      <div className="max-w-xl mx-auto mt-16 p-8 bg-gray-900/90 border border-amber-500/30 rounded-2xl shadow-2xl backdrop-blur-sm text-center">
        <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto mb-5 text-amber-400">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">
          {loadError ? 'Could not load this patient record' : 'Patient not found'}
        </h2>
        <p className="text-sm text-gray-300 mb-6">
          {loadError
            ? 'The registry could not be reached or refused the request. Check your connection and try again.'
            : 'No patient record exists with this ID. It may have been deleted.'}
        </p>
        {loadError && (
          <p className="p-3 mb-6 bg-gray-950/60 border border-gray-800 rounded-xl text-left text-xs text-gray-400 font-mono break-words">
            {loadError}
          </p>
        )}
        <div className="flex gap-3 justify-center">
          {loadError && (
            <Button size="sm" onClick={() => { setLoading(true); load() }}>Retry</Button>
          )}
          <Link href="/patients">
            <Button variant="outline" size="sm">Back to Patient List</Button>
          </Link>
        </div>
      </div>
    )
  }

  // Access Control Check: Ensure active user can view this patient's registry data
  const accessGranted = canViewPatient(currentUser, patient)
  if (!accessGranted) {
    const patientSiteName = patient.siteId ? (SITES[patient.siteId]?.name || patient.siteId) : 'AICTS Pune'
    const enrolledRegistries = (patient.registryIds && patient.registryIds.length > 0)
      ? patient.registryIds.map(id => REGISTRY_MAP[id] || id).join(', ')
      : (patient.registryId ? REGISTRY_MAP[patient.registryId] || patient.registryId : 'Unassigned')

    return (
      <div className="max-w-xl mx-auto mt-16 p-8 bg-gray-900/90 border border-rose-500/30 rounded-2xl shadow-2xl backdrop-blur-sm text-center">
        <div className="w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mx-auto mb-5 text-rose-400">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Access Restricted</h2>
        <p className="text-sm text-gray-300 mb-6">
          {patientAccessDeniedReason(currentUser)}
        </p>

        <div className="p-4 bg-gray-950/60 border border-gray-800 rounded-xl text-left text-xs space-y-2 mb-6">
          <div className="flex justify-between">
            <span className="text-gray-400">Patient Hospital / Site:</span>
            <span className="font-semibold text-gray-200">{patientSiteName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Enrolled Registry:</span>
            <span className="font-semibold text-amber-300">{enrolledRegistries}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Logged in as:</span>
            <span className="font-semibold text-gray-200">{currentUser?.name} ({currentUser?.role})</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Your Registry Access:</span>
            <span className="font-semibold text-blue-300">
              {currentUser?.registryAccess.map((r: string) => REGISTRY_MAP[r] || r).join(', ') || 'None'}
            </span>
          </div>
        </div>

        <div className="flex gap-3 justify-center">
          <Link href="/patients">
            <Button variant="outline" size="sm">Back to Patient List</Button>
          </Link>
          <Link href="/registry-home">
            <Button size="sm">Registry Home</Button>
          </Link>
        </div>
      </div>
    )
  }

  const latest = visits[0] ?? null
  const age = getAge(patient.dob)

  // Consent Status Check for Visit Gating
  const consentStatus = patient.consentStatus || 'Pending'
  const isConsentGated = consentStatus === 'Pending' || consentStatus === 'Declined'

  const isCathLabPatient = patient.registryId === 'cathlab' || patient.registryIds?.includes('cathlab') || patient.siteId === 'KANPUR_APEX'
  const primaryProc = patientProcedures[0] ?? null
  const primaryLesion = primaryProc?.lesions?.[0] ?? null

  const regionDisplay = patient.addressDistrict
    ? `${patient.addressDistrict}, ${patient.addressState || 'India'}`
    : (patient.addressState ? `${patient.addressState}, India` : (patient.siteId === 'KANPUR_APEX' ? 'Kanpur, Uttar Pradesh, India' : 'Maharashtra, India'))

  return (
    <div className="space-y-6 text-gray-300">
      {/* Patient header */}
      <div className="relative overflow-hidden rounded-2xl border border-blue-500/20 bg-gradient-to-br from-slate-900/95 via-[#0c1527] to-[#070e1b] p-5 sm:p-6 shadow-2xl backdrop-blur-md">
        {/* Subtle background ambient glow */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row items-start justify-between gap-6">
          {/* Identity & Badges */}
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-5 w-full lg:w-auto text-center sm:text-left">
            <div className="relative flex-shrink-0">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-600 text-white text-2xl sm:text-3xl font-black flex items-center justify-center shadow-xl shadow-blue-500/20 border border-white/15">
                {initials(patient.firstName, patient.lastName)}
              </div>
              <span
                className={cn(
                  'absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-slate-900 shadow-sm',
                  consentStatus === 'Granted' ? 'bg-emerald-400' : 'bg-amber-400'
                )}
                title={`Consent: ${consentStatus}`}
              />
            </div>

            <div className="space-y-2 flex-1 min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-baseline gap-2 justify-center sm:justify-start">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                  {fullName(patient)}
                </h1>
                {/* HID Copy Pill */}
                {patient.mrn && patient.mrn !== '—' && (
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(patient.mrn || '')
                      setCopiedMrn(true)
                      setTimeout(() => setCopiedMrn(false), 2000)
                      toast.success('Hospital ID copied to clipboard')
                    }}
                    className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-mono font-semibold bg-blue-500/10 text-blue-300 border border-blue-500/25 hover:bg-blue-500/20 hover:border-blue-400/50 transition-colors self-center sm:self-auto cursor-pointer"
                    title="Click to copy Hospital ID"
                  >
                    {copiedMrn ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-blue-400" />}
                    <span>HID: {patient.mrn}</span>
                  </button>
                )}
              </div>

              {/* Bio & Demographics Row */}
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-2.5 gap-y-1 text-xs text-gray-300 font-medium">
                {patient.srNo && <span className="text-gray-400">Sr. No. {patient.srNo}</span>}
                {patient.srNo && <span className="text-gray-600 hidden sm:inline">&bull;</span>}
                <span className="text-white font-semibold">{age ? `${age} yrs` : 'Age —'}</span>
                <span className="text-gray-600">&bull;</span>
                <span>{patient.sex || '—'}</span>
                <span className="text-gray-600">&bull;</span>
                <span>DOB: {formatDate(patient.dob)}</span>
                <span className="text-gray-600 hidden sm:inline">&bull;</span>
                <span className="inline-flex items-center gap-1 text-gray-400">
                  <MapPin className="w-3 h-3 text-gray-400 shrink-0" />
                  {regionDisplay}
                </span>
              </div>

              {/* Dynamic Badges Row */}
              <div className="flex gap-1.5 sm:gap-2 pt-1 flex-wrap justify-center sm:justify-start items-center">
                {/* Consent Badge */}
                <span className={cn('inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider border shadow-sm',
                  consentStatus === 'Granted' ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' :
                  consentStatus === 'Declined' ? 'bg-rose-500/15 text-rose-300 border-rose-500/30' :
                  'bg-amber-500/15 text-amber-300 border-amber-500/30'
                )}>
                  {consentStatus === 'Granted' ? <ShieldCheck className="w-3 h-3 text-emerald-400" /> : <ShieldAlert className="w-3 h-3 text-amber-400" />}
                  Consent: {consentStatus}
                </span>

                {/* Registry Badge */}
                {isCathLabPatient ? (
                  <>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[10px] uppercase font-extrabold">
                      <Activity className="w-3 h-3 text-amber-400" />
                      Registry: Cath Lab &amp; Interventional
                    </span>
                    {primaryProc ? (
                      <>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[10px] uppercase font-extrabold">
                          {primaryProc.overallSuccess ? 'PCI: TIMI 3 Success' : 'PCI: Sub-optimal'}
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-500/15 text-blue-300 border border-blue-500/30 text-[10px] uppercase font-bold">
                          {primaryProc.accessSite?.includes('Radial') ? 'Radial Access' : (primaryProc.accessSite || 'Vascular Access')}
                        </span>
                        {primaryLesion?.vessel && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-500/15 text-purple-300 border border-purple-500/30 text-[10px] uppercase font-bold">
                            Stented: {primaryLesion.vessel}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-gray-800 text-gray-400 border border-gray-700 text-[10px] uppercase font-bold">
                        Awaiting First Procedure
                      </span>
                    )}
                    {latest?.lvef != null && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-800 text-gray-300 border border-slate-700 text-[10px] font-bold">
                        LVEF {latest.lvef}%
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    <span className={cn('inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] uppercase font-extrabold border',
                      patient.registryId ? 'bg-blue-500/15 text-blue-300 border-blue-500/30' : 'bg-gray-800 text-gray-400 border-gray-700'
                    )}>
                      <Heart className="w-3 h-3 text-blue-400" />
                      {patient.registryId ? `Registry: ${REGISTRY_MAP[patient.registryId] || patient.registryId}` : 'Unassigned'}
                    </span>
                    {latest?.hfType && (
                      <span className={cn('badge text-[10px] uppercase font-bold', hfTypeBadgeColor(latest.hfType))}>
                        {latest.hfType}
                      </span>
                    )}
                    {latest?.nyha && (
                      <span className={cn('badge text-[10px] uppercase font-bold', nyhaBadgeColor(latest.nyha))}>
                        NYHA {latest.nyha}
                      </span>
                    )}
                    {latest?.lvef != null && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-800 text-gray-300 border border-slate-700 text-[10px] font-bold">
                        LVEF {latest.lvef}%
                      </span>
                    )}
                    {latest?.rhythm && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-500/15 text-blue-300 border border-blue-500/30 text-[10px] font-bold">
                        {latest.rhythm}
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="flex flex-col sm:flex-row lg:flex-col gap-2.5 w-full lg:w-auto lg:min-w-[240px] flex-shrink-0 pt-2 lg:pt-0">
            {/* Primary Encounter CTAs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2 w-full">
              {isCathLabPatient ? (
                isConsentGated ? (
                  <button
                    disabled
                    title={`Cannot log procedure while consent is ${consentStatus}`}
                    className="btn-outline btn-sm opacity-40 cursor-not-allowed flex items-center justify-center gap-1.5 text-amber-500/50 w-full py-2 text-xs"
                  >
                    <Activity className="w-4 h-4" /> Add Cath / PCI
                  </button>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => {
                      setEditingProcedure(null)
                      setIsCathModalOpen(true)
                    }}
                    className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold flex items-center justify-center gap-1.5 shadow-lg shadow-amber-500/20 w-full py-2 text-xs"
                  >
                    <Activity className="w-4 h-4" /> Add Cath / PCI
                  </Button>
                )
              ) : (
                isConsentGated ? (
                  <button
                    disabled
                    title={`Cannot record visit while consent is ${consentStatus}`}
                    className="btn-outline btn-sm opacity-40 cursor-not-allowed flex items-center justify-center gap-1.5 w-full py-2 text-xs"
                  >
                    <PlusCircle className="w-4 h-4" /> Record Visit
                  </button>
                ) : (
                  <Link href={`/patients/${id}/visits/new`} className="w-full">
                    <Button size="sm" className="btn-primary w-full flex items-center justify-center gap-1.5 py-2 text-xs shadow-md">
                      <PlusCircle className="w-4 h-4" /> Record Visit
                    </Button>
                  </Link>
                )
              )}

              <Button
                size="sm"
                onClick={() => setShowQuickModal(true)}
                className="btn-primary w-full flex items-center justify-center gap-1.5 py-2 text-xs shadow-md"
              >
                <Sparkles className="w-4 h-4 text-cyan-300" /> Enter Missing Data
              </Button>
            </div>

            {/* Secondary Utility Actions */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 gap-2 w-full">
              {!isCathLabPatient && (
                isConsentGated ? (
                  <button
                    disabled
                    title={`Cannot log procedure while consent is ${consentStatus}`}
                    className="btn-outline btn-sm opacity-40 cursor-not-allowed flex items-center justify-center gap-1 text-amber-500/50 py-1.5 text-xs"
                  >
                    <Activity className="w-3.5 h-3.5" /> Cath/PCI
                  </button>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => {
                      setEditingProcedure(null)
                      setIsCathModalOpen(true)
                    }}
                    className="bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 font-semibold flex items-center justify-center gap-1 py-1.5 text-xs"
                  >
                    <Activity className="w-3.5 h-3.5" /> Cath/PCI
                  </Button>
                )
              )}

              {isCathLabPatient && (
                isConsentGated ? (
                  <button
                    disabled
                    title={`Cannot record visit while consent is ${consentStatus}`}
                    className="btn-outline btn-sm opacity-40 cursor-not-allowed flex items-center justify-center gap-1 py-1.5 text-xs"
                  >
                    <PlusCircle className="w-3.5 h-3.5" /> Follow-up
                  </button>
                ) : (
                  <Link href={`/patients/${id}/visits/new`} className="w-full">
                    <Button size="sm" className="btn-outline border-blue-500/30 text-blue-300 hover:bg-blue-500/10 w-full flex items-center justify-center gap-1 py-1.5 text-xs">
                      <PlusCircle className="w-3.5 h-3.5" /> Follow-up
                    </Button>
                  </Link>
                )
              )}

              <Button
                size="sm"
                variant="outline"
                onClick={() => setEditing(!editing)}
                className="btn-outline flex items-center justify-center gap-1 py-1.5 text-xs text-gray-300 hover:text-white"
              >
                <Edit2 className="w-3.5 h-3.5" />
                {editing ? 'Cancel' : 'Edit Profile'}
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={handleDeletePatient}
                className="btn-outline text-rose-400/80 hover:text-rose-300 hover:border-rose-400/50 flex items-center justify-center gap-1 py-1.5 text-xs"
                title="Permanently delete patient record"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Consent Gating Warning Banner */}
      {isConsentGated && (
        <div className="alert-strip warn flex items-start gap-3 p-4 rounded-xl">
          <ShieldAlert className="w-5 h-5 flex-shrink-0 text-amber-500 mt-0.5" />
          <div>
            <p className="font-bold">Regulatory Consent Required</p>
            <p className="text-gray-300 mt-1">
              Data capture is disabled because this patient's consent status is currently <strong>{consentStatus}</strong>.
              Go to "Edit Profile" or register patient consent status as "Granted" to record clinical visits.
            </p>
          </div>
        </div>
      )}

      {/* Edit patient form */}
      {editing && (
        <Card className="mb-5">
          <CardHeader>
            <CardTitle>Edit Patient Demographics & Consent</CardTitle>
          </CardHeader>
          <CardBody>
            <PatientForm
              defaultValues={patient}
              onSubmit={handleUpdatePatient}
              loading={saving}
              submitLabel="Update Patient"
            />
          </CardBody>
        </Card>
      )}

      {/* Latest key metrics — dynamically tailored for Cath Lab vs Heart Failure */}
      {isCathLabPatient ? (() => {
        const latestProc = patientProcedures[0] ?? null
        const primaryLes = latestProc?.lesions?.[0] ?? null
        const primaryDev = primaryLes?.devices?.[0] ?? latestProc?.devices?.[0] ?? null
        const totalStents = (latestProc?.devices?.length ?? 0) ||
          (latestProc?.lesions?.reduce((sum, l) => sum + (l.devices?.filter(d => d.deviceType?.toLowerCase().includes('des') || d.deviceType?.toLowerCase().includes('stent')).length || 0), 0) ?? 0)
        const fluoroTime = latestProc?.fluoroscopyTimeMin ?? latestProc?.fluoroscopyTimeMinutes
        const contrastVol = latestProc?.contrastVolumeMl
        const NR = 'Not recorded'

        const cathCards = [
          {
            label: 'Vascular Access',
            value: latestProc?.accessSite ? latestProc.accessSite.replace('Radial Right', 'Rt Radial').replace('Radial Left', 'Lt Radial') : '—',
            unit: latestProc ? [latestProc.sheathSize && `${latestProc.sheathSize} Sheath`, latestProc.closureDevice].filter(Boolean).join(' · ') || NR : 'No procedure',
            highlight: 'text-emerald-400',
          },
          {
            label: 'Target Lesion',
            value: primaryLes?.vessel || '—',
            unit: primaryLes?.preStenosisPct != null && primaryLes?.postStenosisPct != null
              ? `${primaryLes.preStenosisPct}% → ${primaryLes.postStenosisPct}% Stenosis`
              : (latestProc ? NR : 'No procedure'),
            highlight: 'text-amber-400',
          },
          {
            label: 'Angio Result',
            value: primaryLes?.postTimiFlow != null ? `TIMI ${primaryLes.postTimiFlow}` : '—',
            unit: primaryLes?.postTimiFlow != null ? 'Post-PCI Flow' : (latestProc ? NR : 'No procedure'),
            highlight: 'text-emerald-400',
          },
          {
            label: 'Stent Hardware',
            value: latestProc ? (totalStents > 0 ? `${totalStents} Device${totalStents > 1 ? 's' : ''}` : 'None recorded') : '—',
            unit: primaryDev?.diameterMm && primaryDev?.lengthMm ? `${primaryDev.diameterMm} × ${primaryDev.lengthMm} mm` : (latestProc ? NR : 'No procedure'),
            highlight: 'text-violet-400',
          },
          {
            label: 'DAPT Protocol',
            value: latestProc?.dischargeDaptAgent ? latestProc.dischargeDaptAgent.replace('Aspirin + ', 'ASA + ') : '—',
            unit: latestProc?.dischargeDaptDurationMonths ? `${latestProc.dischargeDaptDurationMonths} Mo Duration Plan` : (latestProc ? NR : 'No procedure'),
            highlight: 'text-blue-400',
          },
          {
            label: 'Radiation & Contrast',
            value: contrastVol != null ? `${contrastVol} mL` : '—',
            unit: fluoroTime != null ? `Fluoro: ${fluoroTime} min` : (latestProc ? NR : 'No procedure'),
            highlight: (contrastVol ?? 0) > 250 ? 'text-rose-400' : 'text-cyan-400',
          },
        ]

        return (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
            {cathCards.map(m => (
              <div
                key={m.label}
                onClick={() => {
                  if (patientProcedures.length > 0) {
                    setEditingProcedure(patientProcedures[0])
                    setIsCathModalOpen(true)
                  } else {
                    setEditingProcedure(null)
                    setIsCathModalOpen(true)
                  }
                }}
                className="rounded-2xl p-3.5 sm:p-4 text-center bg-slate-900/80 border border-amber-500/20 hover:border-amber-400/60 hover:bg-slate-900 transition-all cursor-pointer group shadow-lg flex flex-col justify-between"
                title="Click to view or edit interventional procedure record"
              >
                <p className="text-[10px] text-gray-400 uppercase tracking-wider font-bold mb-1 group-hover:text-amber-400 transition-colors">{m.label}</p>
                <p className={cn('text-lg sm:text-xl font-extrabold tracking-tight truncate my-0.5', m.highlight)}>
                  {m.value}
                </p>
                <p className="text-[10px] text-gray-400 font-medium truncate">{m.unit}</p>
              </div>
            ))}
          </div>
        )
      })() : latest && (() => {
        const latestBnp = visits.find(v => v.ntProBNP != null)?.ntProBNP ?? latest.ntProBNP
        const latestEgfr = visits.find(v => v.egfr != null)?.egfr ?? latest.egfr
        const latestBpVisit = visits.find(v => v.bpSystolic != null && v.bpDiastolic != null)
        const latestBp = latestBpVisit ? `${latestBpVisit.bpSystolic}/${latestBpVisit.bpDiastolic}` : (latest.bpSystolic && latest.bpDiastolic ? `${latest.bpSystolic}/${latest.bpDiastolic}` : null)
        const latestHr = visits.find(v => v.heartRate != null)?.heartRate ?? latest.heartRate
        const latest6mwt = visits.find(v => v.sixMWT != null)?.sixMWT ?? latest.sixMWT
        const latestK = visits.find(v => v.potassium != null)?.potassium ?? latest.potassium

        return (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
            {[
              { label: 'NT-proBNP', value: latestBnp, unit: 'pg/mL', warn: (v: number) => v > 2000 },
              { label: 'eGFR', value: latestEgfr, unit: 'mL/min/1.73m²', warn: (v: number) => v < 45 },
              { label: 'Blood Pressure', value: latestBp, unit: 'mmHg', warn: (_v: any) => false },
              { label: 'Heart Rate', value: latestHr, unit: 'bpm', warn: (v: number) => v > 100 || v < 55 },
              { label: '6-Min Walk (6MWT)', value: latest6mwt, unit: 'metres', warn: (_v: any) => false },
              { label: 'Potassium (K+)', value: latestK, unit: 'mmol/L', warn: (v: number) => v > 5.5 || v < 3.5 },
            ].map(m => (
              <div
                key={m.label}
                onClick={() => setShowQuickModal(true)}
                className="rounded-2xl p-3.5 sm:p-4 text-center bg-slate-900/80 border border-blue-500/15 hover:border-blue-400/50 hover:bg-slate-900 transition-all cursor-pointer group shadow-lg flex flex-col justify-between"
                title="Click to view or edit clinical data"
              >
                <p className="text-[10px] text-gray-400 uppercase tracking-wider font-bold mb-1 group-hover:text-blue-400 transition-colors">{m.label}</p>
                <div className="my-0.5">
                  {m.value != null
                    ? <p className={cn('text-xl sm:text-2xl font-black tracking-tight', m.warn(Number(m.value)) ? 'text-rose-400' : 'text-white')}>
                        {m.value}
                      </p>
                    : <p className="text-gray-500 text-xl font-bold">—</p>}
                </div>
                <p className="text-[10px] text-gray-400 font-medium">{m.unit}</p>
              </div>
            ))}
          </div>
        )
      })()}

      {/* Segmented Navigation Tabs */}
      <div className="w-full overflow-x-auto scrollbar-none pb-1">
        <div className="inline-flex sm:flex items-center gap-1.5 p-1.5 rounded-2xl bg-slate-900/90 border border-white/10 backdrop-blur-md shadow-lg min-w-full sm:min-w-0">
          {((isCathLabPatient ? [
            { id: 'procedures', label: 'Cath Lab & PCI', icon: Activity, count: patientProcedures.length },
            { id: 'overview', label: 'Demographics & Overview', icon: LayoutDashboard },
            { id: 'gdmt', label: 'DAPT & Secondary Prevention', icon: Pill },
            { id: 'timeline', label: 'Clinical Timeline', icon: Clock },
            { id: 'trends', label: 'Lab & Renal Trends', icon: TrendingUp },
            { id: 'outcomes', label: 'Safety & Outcomes', icon: ShieldAlert, count: outcomeEvents.length }
          ] : [
            { id: 'overview', label: 'Overview & Profile', icon: LayoutDashboard },
            { id: 'procedures', label: 'Cath Lab & PCI', icon: Activity, count: patientProcedures.length },
            { id: 'gdmt', label: 'GDMT Checklist', icon: ShieldCheck },
            { id: 'timeline', label: 'Clinical Timeline', icon: Clock, count: visits.length },
            { id: 'trends', label: 'Lab Trends', icon: TrendingUp },
            { id: 'outcomes', label: 'Outcome Events', icon: ShieldAlert, count: outcomeEvents.length }
          ]) as Array<{ id: any; label: string; icon: any; count?: number }>).map(t => {
            const Icon = t.icon
            const isActive = activeTab === t.id
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as any)}
                className={cn(
                  'flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-200 shrink-0 select-none cursor-pointer',
                  isActive
                    ? (isCathLabPatient
                        ? 'bg-amber-500 text-slate-950 font-extrabold shadow-md shadow-amber-500/20'
                        : 'bg-blue-600 text-white font-extrabold shadow-md shadow-blue-600/25')
                    : 'text-gray-400 hover:text-white hover:bg-white/[0.04]'
                )}
              >
                <Icon className={cn('w-3.5 h-3.5', isActive ? (isCathLabPatient ? 'text-slate-950' : 'text-white') : 'text-gray-400')} />
                <span>{t.label}</span>
                {t.count !== undefined && (
                  <span className={cn(
                    'text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold',
                    isActive
                      ? (isCathLabPatient ? 'bg-slate-950/20 text-slate-950' : 'bg-white/20 text-white')
                      : 'bg-slate-800 text-gray-400'
                  )}>
                    {t.count}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Overview tab */}
      {activeTab === 'overview' && (
        <div className="space-y-5">
          {/* Data Completeness Audit — Tailored for Cath Lab vs Heart Failure */}
          {isCathLabPatient ? (
            patientProcedures.length > 0 ? (() => {
              const cathReport = calculateCathProcedureCompleteness(patientProcedures[0])
              return (
                <div className="glass-card p-5 border border-amber-500/20 shadow-xl space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xl flex-shrink-0 shadow-lg"
                        style={{
                          backgroundColor: `${cathReport.color}20`,
                          color: cathReport.color,
                          border: `1.5px solid ${cathReport.color}50`,
                        }}
                      >
                        {cathReport.score}%
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-bold text-white">NCDR CathPCI Interventional CRF Completeness</h3>
                          <span
                            className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider"
                            style={{
                              backgroundColor: `${cathReport.color}20`,
                              color: cathReport.color,
                              border: `1px solid ${cathReport.color}40`,
                            }}
                          >
                            Grade {cathReport.grade}
                          </span>
                          <span className="text-[10px] bg-amber-500/10 text-amber-300 border border-amber-500/20 px-2 py-0.5 rounded font-mono">
                            Mandatory Elements: {cathReport.completedItems} / {cathReport.totalItems}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">
                          NCDR CathPCI v5.0 &amp; NIC India mandatory audit quality standard
                        </p>
                      </div>
                    </div>

                    <Button
                      size="sm"
                      onClick={() => {
                        setEditingProcedure(patientProcedures[0])
                        setIsCathModalOpen(true)
                      }}
                      className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-1.5 self-start sm:self-auto"
                    >
                      <Edit3 className="w-3.5 h-3.5" /> Edit Procedure CRF
                    </Button>
                  </div>

                  {/* 6 Category Progress Bars */}
                  <div className="grid grid-cols-2 md:grid-cols-6 gap-3 pt-2">
                    {[
                      { label: 'Demographics', pct: 100, color: 'bg-emerald-500' },
                      { label: 'Vascular Access', pct: patientProcedures[0].accessSite ? 100 : 0, color: 'bg-emerald-500' },
                      { label: 'Lesion Anatomy', pct: (patientProcedures[0].lesions && patientProcedures[0].lesions.length > 0) ? 100 : 0, color: 'bg-emerald-500' },
                      { label: 'Stent Hardware', pct: (patientProcedures[0].lesions?.some(l => l.devices && l.devices.length > 0) || patientProcedures[0].procedureType === 'Diagnostic Coronary Angiography') ? 100 : 0, color: 'bg-amber-500' },
                      { label: 'Radiation / Rad', pct: (patientProcedures[0].contrastVolumeMl || 0) > 0 ? 100 : 0, color: 'bg-blue-500' },
                      { label: 'Safety Audit', pct: patientProcedures[0].complications ? 100 : 0, color: 'bg-violet-500' },
                    ].map(cat => (
                      <div key={cat.label} className="p-2.5 rounded-xl bg-slate-900/60 border border-white/5 space-y-1 text-center">
                        <p className="text-[10px] text-gray-400 font-medium truncate">{cat.label}</p>
                        <p className="text-sm font-bold text-white">{cat.pct}%</p>
                        <div className="progress-track h-1 mt-1">
                          <div className={`progress-fill ${cat.color}`} style={{ width: `${cat.pct}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>

                  {cathReport.missingCritical.length > 0 && (
                    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
                      <p className="font-semibold mb-1 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5" /> Missing Recommended Elements:
                      </p>
                      <p className="text-gray-300">{cathReport.missingCritical.join(' · ')}</p>
                    </div>
                  )}
                </div>
              )
            })() : (
              <div className="glass-card p-5 border border-amber-500/20 text-center space-y-3">
                <p className="text-sm font-semibold text-white">Cath Lab Interventional Record Awaiting Procedure Log</p>
                <p className="text-xs text-gray-400">This patient is enrolled in the Cath Lab &amp; Interventional Registry. Log their first coronary procedure to activate full quality indicators.</p>
                <Button
                  size="sm"
                  onClick={() => {
                    setEditingProcedure(null)
                    setIsCathModalOpen(true)
                  }}
                  className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs"
                >
                  <PlusCircle className="w-4 h-4" /> Log Cath / PCI Procedure
                </Button>
              </div>
            )
          ) : (
            <DataCompletenessCard
              patient={patient}
              latestVisit={latest}
              onRefresh={load}
            />
          )}

          {/* Clinical Decision & Risk Suite */}
          {isCathLabPatient ? (
            <CathInterventionalRiskCard
              patient={patient}
              procedure={primaryProc}
              latestVisit={latest}
            />
          ) : (
            visits.length > 0 && (
              <MLRiskCard
                patient={patient}
                visit={visits.sort((a, b) => new Date(b.visitDate).getTime() - new Date(a.visitDate).getTime())[0]}
                allVisits={visits}
              />
            )
          )}

          {/* Symmetrical 2-Column Clinical Profile Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
            {/* Column 1: Demographics & Registration Profile */}
            <Card className="h-full border border-blue-500/15 shadow-xl flex flex-col justify-between">
              <div>
                <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-white/5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                      <User className="w-4 h-4" />
                    </div>
                    <div>
                      <CardTitle className="text-sm font-bold text-white">Demographics &amp; Study Profile</CardTitle>
                      <p className="text-[11px] text-gray-400">Baseline registration &amp; patient identifiers</p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEditing(true)}
                    className="text-xs py-1 px-2.5 border-white/10 text-gray-300 hover:text-white flex items-center gap-1"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-blue-400" />
                    Edit
                  </Button>
                </CardHeader>

                <CardBody className="p-4 sm:p-5 space-y-4">
                  {/* Category 1: Patient Identification */}
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-blue-400/90 mb-2">Patient Identification</p>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between items-center py-1 border-b border-white/[0.04]">
                        <span className="text-gray-400">Full Name</span>
                        <span className="font-semibold text-white">{fullName(patient)}</span>
                      </div>
                      <div className="flex justify-between items-center py-1 border-b border-white/[0.04]">
                        <span className="text-gray-400">Hospital ID (HID)</span>
                        <span className="font-mono font-bold text-blue-300">
                          {(patient.mrn && patient.mrn !== '—') ? patient.mrn : '—'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-1 border-b border-white/[0.04]">
                        <span className="text-gray-400">Serial No.</span>
                        <span className="font-mono text-gray-200">{patient.srNo ? String(patient.srNo) : '—'}</span>
                      </div>
                      <div className="flex justify-between items-center py-1 border-b border-white/[0.04]">
                        <span className="text-gray-400">ABHA ID</span>
                        <span className="font-mono text-gray-200">{patient.abhaId || '—'}</span>
                      </div>
                      <div className="flex justify-between items-center py-1 border-b border-white/[0.04]">
                        <span className="text-gray-400">Date of Birth &amp; Age</span>
                        <span className="font-medium text-white">{patient.dob ? formatDate(patient.dob) : '—'}{age ? ` (${age} yrs)` : ''}</span>
                      </div>
                      <div className="flex justify-between items-center py-1">
                        <span className="text-gray-400">Sex &amp; Occupation</span>
                        <span className="font-medium text-white">{patient.sex || '—'}{patient.occupation ? ` · ${patient.occupation}` : ''}</span>
                      </div>
                    </div>
                  </div>

                  {/* Category 2: Study & Clinical Registry */}
                  <div className="pt-2 border-t border-white/5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-400/90 mb-2">Registry &amp; Study Status</p>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between items-center py-1 border-b border-white/[0.04]">
                        <span className="text-gray-400">Assigned Registry</span>
                        <span className="font-semibold text-blue-300">{patient.registryId ? (REGISTRY_MAP[patient.registryId] || patient.registryId) : '—'}</span>
                      </div>
                      <div className="flex justify-between items-center py-1 border-b border-white/[0.04]">
                        <span className="text-gray-400">Index Enrollment Date</span>
                        <span className="font-medium text-gray-200">{patient.indexDate ? formatDate(patient.indexDate) : '—'}</span>
                      </div>
                      {patient.registryId === 'hf' && (
                        <div className="flex justify-between items-center py-1 border-b border-white/[0.04]">
                          <span className="text-gray-400">Index Etiology</span>
                          <span className="font-medium text-amber-300 text-right max-w-[60%]">
                            {(patient.indexEtiology && patient.indexEtiology.length > 0) ? patient.indexEtiology.join(', ') : '—'}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between items-center py-1">
                        <span className="text-gray-400">Regulatory Consent</span>
                        <span className={cn('text-[10px] font-extrabold uppercase px-2 py-0.5 rounded border',
                          consentStatus === 'Granted' ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                        )}>
                          {consentStatus}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Category 3: Contact & Safety */}
                  <div className="pt-2 border-t border-white/5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-400/90 mb-2">Contact &amp; Safety</p>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between items-center py-1 border-b border-white/[0.04]">
                        <span className="text-gray-400">Contact Number</span>
                        <span className="font-mono text-gray-200">{patient.contact || '—'}</span>
                      </div>
                      <div className="flex justify-between items-center py-1 border-b border-white/[0.04]">
                        <span className="text-gray-400">Email Address</span>
                        <span className="text-gray-200">{patient.email || '—'}</span>
                      </div>
                      <div className="flex justify-between items-center py-1">
                        <span className="text-gray-400">Known Allergies</span>
                        <span className={cn('font-medium', patient.allergies ? 'text-rose-300' : 'text-gray-400')}>
                          {patient.allergies || 'No known allergies'}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardBody>
              </div>
            </Card>

            {/* Column 2: Latest Clinical Data / Interventional Profile */}
            {isCathLabPatient ? (
              <Card className="h-full border border-amber-500/20 shadow-xl flex flex-col justify-between">
                <div>
                  <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-white/5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                        <Activity className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-sm font-bold text-white">Latest Interventional Profile</CardTitle>
                          {primaryProc?.procedureDateTime && (
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/25">
                              {formatDate(primaryProc.procedureDateTime)}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-gray-400">Coronary angiography &amp; stenting parameters</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (primaryProc) setEditingProcedure(primaryProc)
                        else setEditingProcedure(null)
                        setIsCathModalOpen(true)
                      }}
                      className="data-edit-btn flex items-center gap-1.5 text-xs font-semibold text-amber-300 hover:text-white bg-amber-950/60 hover:bg-amber-600/40 border border-amber-500/30 px-2.5 py-1 rounded-lg transition-all shadow-sm"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                      Edit Procedure CRF
                    </button>
                  </CardHeader>
                  <CardBody className="p-4 sm:p-5 space-y-4">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-amber-400/90 mb-2">Angiography &amp; Vessel Details</p>
                      <div className="space-y-1.5 text-xs">
                        {[
                          ['Primary Procedure', primaryProc?.procedureType || '—'],
                          ['Clinical Indication', primaryProc?.presentation || (patient as any).presentation || '—'],
                          ['Access Route', primaryProc?.accessSite ? `${primaryProc.accessSite}${[primaryProc.sheathSize, primaryProc.closureDevice].filter(Boolean).length ? ` (${[primaryProc.sheathSize, primaryProc.closureDevice].filter(Boolean).join(' · ')})` : ''}` : '—'],
                          ['Culprit Vessel & Segment', primaryLesion ? [primaryLesion.vessel, primaryLesion.segmentName, primaryLesion.segmentNumber != null && `(AHA ${primaryLesion.segmentNumber})`].filter(Boolean).join(' ') || '—' : '—'],
                          ['Pre-PCI Stenosis & Flow', primaryLesion ? [primaryLesion.preStenosisPct != null && `${primaryLesion.preStenosisPct}%`, primaryLesion.preTimiFlow != null && `TIMI ${primaryLesion.preTimiFlow}`].filter(Boolean).join(' · ') || '—' : '—'],
                          ['Post-PCI Result', primaryLesion ? [primaryLesion.postStenosisPct != null && `${primaryLesion.postStenosisPct}%`, primaryLesion.postTimiFlow != null && `TIMI ${primaryLesion.postTimiFlow}`].filter(Boolean).join(' · ') || '—' : '—'],
                        ].map(([k, v]) => (
                          <div key={k} className="flex justify-between items-center py-1 border-b border-white/[0.04]">
                            <span className="text-gray-400">{k}</span>
                            <span className="font-semibold text-white text-right max-w-[60%]">{v}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-white/5">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-violet-400/90 mb-2">Hardware &amp; Secondary Protocol</p>
                      <div className="space-y-1.5 text-xs">
                        {[
                          ['Stent Hardware Deployed', primaryProc?.devices?.[0] ? `${primaryProc.devices[0].type || 'Device'}${primaryProc.devices[0].diameterMm && primaryProc.devices[0].lengthMm ? ` (${primaryProc.devices[0].diameterMm} × ${primaryProc.devices[0].lengthMm} mm)` : ''}` : '—'],
                          ['Contrast & Radiation', primaryProc ? [primaryProc.contrastVolumeMl != null && `${primaryProc.contrastVolumeMl} mL Contrast`, (primaryProc.fluoroscopyTimeMin ?? primaryProc.fluoroscopyTimeMinutes) != null && `${primaryProc.fluoroscopyTimeMin ?? primaryProc.fluoroscopyTimeMinutes} min Fluoro`].filter(Boolean).join(' · ') || '—' : '—'],
                          ['Left Ventricular Function', latest?.lvef != null ? `LVEF ${latest.lvef}%` : (patient.lvef != null ? `LVEF ${patient.lvef}%` : '—')],
                          ['Discharge DAPT Regimen', primaryProc?.dischargeDaptAgent ? `${primaryProc.dischargeDaptAgent}${primaryProc.dischargeDaptDurationMonths ? ` (${primaryProc.dischargeDaptDurationMonths} Mo)` : ''}` : '—'],
                        ].map(([k, v]) => (
                          <div key={k} className="flex justify-between items-center py-1 border-b border-white/[0.04]">
                            <span className="text-gray-400">{k}</span>
                            <span className="font-semibold text-white text-right max-w-[60%]">{v}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardBody>
                </div>
              </Card>
            ) : latest && (
              <Card className="h-full border border-blue-500/15 shadow-xl flex flex-col justify-between">
                <div>
                  <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-white/5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                        <Activity className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-sm font-bold text-white">Latest Clinical Assessment</CardTitle>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/15 text-blue-300 border border-blue-500/25">
                            {formatDate(latest.visitDate)}
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-400">Hemodynamics, echo, and lab biomarkers</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowQuickModal(true)}
                      className="data-edit-btn flex items-center gap-1.5 text-xs font-semibold text-blue-300 hover:text-white bg-blue-950/60 hover:bg-blue-600/40 border border-blue-500/30 px-2.5 py-1 rounded-lg transition-all shadow-sm"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-blue-400" />
                      Edit Data
                    </button>
                  </CardHeader>
                  <CardBody className="p-4 sm:p-5 space-y-4">
                    {/* Category 1: Cardiac Phenotype & Hemodynamics */}
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-blue-400/90 mb-2">Cardiac Phenotype &amp; Hemodynamics</p>
                      <div className="space-y-1.5 text-xs">
                        <div className="flex justify-between items-center py-1 border-b border-white/[0.04]">
                          <span className="text-gray-400">Heart Failure Type</span>
                          <span className={cn('font-bold', hfTypeBadgeColor(latest.hfType || patient.hfType))}>
                            {latest.hfType || patient.hfType || '—'}
                          </span>
                        </div>
                        <div className="flex justify-between items-center py-1 border-b border-white/[0.04]">
                          <span className="text-gray-400">NYHA Functional Class</span>
                          <span className={cn('font-bold', nyhaBadgeColor(latest.nyha || patient.nyha))}>
                            {latest.nyha ? `Class ${latest.nyha}` : (patient.nyha ? `Class ${patient.nyha}` : '—')}
                          </span>
                        </div>
                        <div className="flex justify-between items-center py-1 border-b border-white/[0.04]">
                          <span className="text-gray-400">Left Ventricular EF</span>
                          <div className="flex items-center gap-2">
                            <span className={cn('font-black text-sm', lvefColor(latest.lvef ?? patient.lvef))}>
                              {latest.lvef != null ? `${latest.lvef}%` : (patient.lvef != null ? `${patient.lvef}%` : '—')}
                            </span>
                            {latest.lvef != null && (
                              <span className="text-[10px] text-gray-500 font-mono">
                                ({latest.lvef < 40 ? 'Severely Reduced' : latest.lvef < 50 ? 'Mildly Reduced' : 'Preserved'})
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex justify-between items-center py-1 border-b border-white/[0.04]">
                          <span className="text-gray-400">Blood Pressure &amp; Heart Rate</span>
                          <span className="font-semibold text-white">
                            {latest.bpSystolic ? `${latest.bpSystolic}/${latest.bpDiastolic ?? '—'} mmHg` : '—'}
                            {latest.heartRate != null ? ` · ${latest.heartRate} bpm` : ''}
                          </span>
                        </div>
                        <div className="flex justify-between items-center py-1 border-b border-white/[0.04]">
                          <span className="text-gray-400">Cardiac Rhythm</span>
                          <span className="font-semibold text-blue-300">{latest.rhythm ?? '—'}</span>
                        </div>
                        <div className="flex justify-between items-center py-1">
                          <span className="text-gray-400">Clinical Etiology</span>
                          <span className="font-medium text-gray-200 text-right max-w-[60%]">
                            {(latest.etiology && latest.etiology.length > 0) ? latest.etiology.join(', ') : (patient.indexEtiology?.join(', ') || '—')}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Category 2: Laboratory Panels */}
                    <div className="pt-2 border-t border-white/5">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-purple-400/90 mb-2">Laboratory Panels</p>
                      <div className="space-y-1.5 text-xs">
                        <div className="flex justify-between items-center py-1 border-b border-white/[0.04]">
                          <span className="text-gray-400">NT-proBNP</span>
                          <span className={cn('font-bold font-mono', (latest.ntProBNP ?? 0) > 2000 ? 'text-rose-400' : 'text-emerald-400')}>
                            {latest.ntProBNP != null ? `${latest.ntProBNP} pg/mL` : <span className="text-gray-500 font-normal">Not recorded</span>}
                          </span>
                        </div>
                        <div className="flex justify-between items-center py-1 border-b border-white/[0.04]">
                          <span className="text-gray-400">eGFR (Renal Function)</span>
                          <span className={cn('font-bold font-mono', (latest.egfr ?? 100) < 45 ? 'text-amber-400' : 'text-emerald-400')}>
                            {latest.egfr != null ? `${latest.egfr} mL/min/1.73m²` : <span className="text-gray-500 font-normal">Not recorded</span>}
                          </span>
                        </div>
                        <div className="flex justify-between items-center py-1 border-b border-white/[0.04]">
                          <span className="text-gray-400">Serum Potassium (K+)</span>
                          <span className="font-mono font-semibold text-white">
                            {latest.potassium != null ? `${latest.potassium} mmol/L` : <span className="text-amber-400/90 font-semibold bg-amber-500/10 px-1.5 py-0.2 rounded border border-amber-500/20">Missing (Critical)</span>}
                          </span>
                        </div>
                        <div className="flex justify-between items-center py-1 border-b border-white/[0.04]">
                          <span className="text-gray-400">Hemoglobin</span>
                          <span className="font-mono font-semibold text-white">
                            {latest.hb != null ? `${latest.hb} g/dL` : <span className="text-gray-500 font-normal">Not recorded</span>}
                          </span>
                        </div>
                        <div className="flex justify-between items-center py-1 border-b border-white/[0.04]">
                          <span className="text-gray-400">HbA1c</span>
                          <span className="font-mono font-semibold text-white">
                            {latest.hba1c != null ? `${latest.hba1c}%` : <span className="text-gray-500 font-normal">Not recorded</span>}
                          </span>
                        </div>
                        <div className="flex justify-between items-center py-1">
                          <span className="text-gray-400">TSH</span>
                          <span className="font-mono font-semibold text-white">
                            {latest.tft != null ? `${latest.tft} mIU/L` : <span className="text-gray-500 font-normal">Not recorded</span>}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Category 3: Follow-up Scheduling */}
                    <div className="pt-2 border-t border-white/5">
                      <div className="flex justify-between items-center py-1 text-xs">
                        <span className="text-gray-400">Next Scheduled Follow-up</span>
                        <span className={cn('font-semibold', latest.followupDate ? 'text-blue-300 font-mono' : 'text-gray-500')}>
                          {latest.followupDate ? formatDate(latest.followupDate) : 'Not scheduled'}
                        </span>
                      </div>
                    </div>
                  </CardBody>
                </div>
              </Card>
            )}
          </div>

          {/* Full Width: Comorbidities Multi-Select */}
          <ComorbiditiesMatrix
            patient={patient}
            onRefresh={load}
          />

          {/* Full Width: Current Medications / Pharmacotherapy */}
          {isCathLabPatient ? (() => {
            const cathPatientMeds = (patient as any).meds || {}
            const daptAgent = primaryProc?.dischargeDaptAgent
            const p2y12FromDapt = daptAgent && daptAgent.startsWith('Aspirin + ') ? daptAgent.replace('Aspirin + ', '') : undefined
            const lx = latest as any
            const cathMeds = [
              {
                label: 'Aspirin',
                drug: 'Aspirin',
                dose: cathPatientMeds.aspirinDose || lx?.aspirinDose || latest?.aspirin?.dose,
                active: Boolean(daptAgent?.includes('Aspirin') || cathPatientMeds.aspirin || latest?.aspirin?.prescribed === 'Yes' || lx?.aspirinPrescribed === 'Yes'),
                detail: 'Antiplatelet',
              },
              {
                label: 'P2Y12 Inhibitor',
                drug: p2y12FromDapt || cathPatientMeds.p2y12Drug || lx?.p2y12Drug,
                dose: cathPatientMeds.p2y12Dose || lx?.p2y12Dose,
                active: Boolean(p2y12FromDapt || cathPatientMeds.p2y12 || latest?.p2y12Inhibitor?.prescribed === 'Yes' || lx?.p2y12Prescribed === 'Yes'),
                detail: primaryProc?.dischargeDaptDurationMonths ? `${primaryProc.dischargeDaptDurationMonths}-month planned DAPT` : 'DAPT duration not recorded',
              },
              {
                label: 'Statin',
                drug: cathPatientMeds.statinDrug || lx?.statinDrug || latest?.statin?.type,
                dose: cathPatientMeds.statinDose || lx?.statinDose || latest?.statin?.dose,
                active: Boolean((primaryProc?.dischargeStatinIntensity && primaryProc.dischargeStatinIntensity !== 'None') || cathPatientMeds.statin || latest?.statin?.prescribed === 'Yes' || lx?.statinPrescribed === 'Yes'),
                detail: primaryProc?.dischargeStatinIntensity && primaryProc.dischargeStatinIntensity !== 'None' ? `${primaryProc.dischargeStatinIntensity}-intensity at discharge` : 'Lipid lowering',
              },
              {
                label: 'Beta-Blocker',
                drug: cathPatientMeds.betaBlockerDrug || lx?.medBetaBlockerDrug || latest?.betaBlocker?.type,
                dose: cathPatientMeds.betaBlockerDose || lx?.medBetaBlockerDose || latest?.betaBlocker?.dose,
                active: Boolean(primaryProc?.dischargeBetaBlocker || cathPatientMeds.betaBlocker || latest?.betaBlocker?.prescribed === 'Yes' || lx?.medBetaBlocker === 'Yes'),
                detail: 'Secondary prevention',
              },
              {
                label: 'ACEi / ARB',
                drug: cathPatientMeds.raasiDrug || lx?.medAceiDrug || latest?.raasi?.type,
                dose: cathPatientMeds.raasiDose || lx?.medAceiDose || latest?.raasi?.dose,
                active: Boolean(primaryProc?.dischargeAceiArb || cathPatientMeds.raasi || latest?.raasi?.prescribed === 'Yes' || lx?.medAcei === 'Yes'),
                detail: 'RAAS inhibition',
              },
              {
                label: 'Gastroprotection (PPI)',
                drug: cathPatientMeds.ppiDrug,
                dose: undefined,
                active: Boolean((primaryProc as any)?.dischargePpi || cathPatientMeds.ppi || lx?.medPpi === 'Yes'),
                detail: 'GI protection during DAPT',
              },
            ].map(m => ({ ...m, drug: m.drug || (m.active ? 'Agent not recorded' : '—'), dose: m.dose || (m.active ? 'Dose not recorded' : '') }))

            return (
              <Card className="border border-amber-500/20 shadow-xl">
                <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-white/5">
                  <div>
                    <CardTitle>
                      <span className="flex items-center gap-2 text-white">
                        <Pill className="w-4 h-4 text-amber-400" />
                        Current Post-PCI Secondary Prevention Pharmacotherapy
                      </span>
                    </CardTitle>
                    <p className="text-xs text-gray-400 mt-0.5">
                      AHA/ACC &amp; ESC Guideline-Directed Post-PCI Antiplatelet &amp; Cardioprotective Regimen
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('gdmt')}
                    className="text-xs text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20 transition-colors self-start sm:self-auto"
                  >
                    View Full Protocol &rarr;
                  </button>
                </CardHeader>
                <CardBody className="p-4 sm:p-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    {cathMeds.map(({ label, drug, dose, active, detail }) => (
                      <div key={label} className={cn(
                        'p-3.5 rounded-2xl border text-xs shadow-sm transition-all flex flex-col justify-between',
                        active
                          ? 'bg-emerald-500/10 border-emerald-500/25'
                          : 'bg-slate-900/60 border-white/10 opacity-70'
                      )}>
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <p className="font-bold text-white text-xs">{label}</p>
                            {active ? (
                              <span className="text-[10px] font-bold text-emerald-400 px-1.5 py-0.5 rounded bg-emerald-500/20">Active</span>
                            ) : (
                              <span className="text-[10px] font-bold text-gray-400 px-1.5 py-0.5 rounded bg-gray-700/40">Not recorded</span>
                            )}
                          </div>
                          <p className="text-sm font-semibold text-white mt-1">{drug}</p>
                          <p className="text-[11px] text-gray-300 mt-0.5 font-mono">{dose}</p>
                        </div>
                        <p className="text-[10px] text-gray-400 mt-2 border-t border-white/5 pt-1.5 leading-tight">{detail}</p>
                      </div>
                    ))}
                  </div>
                </CardBody>
              </Card>
            )
          })() : latest && (
            <Card className="border border-blue-500/15 shadow-xl">
              <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-white/5">
                <div className="flex items-center gap-2">
                  <Pill className="w-4 h-4 text-blue-400" />
                  <CardTitle>Current Pharmacotherapy &amp; Regimen</CardTitle>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('gdmt')}
                  className="text-xs text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1 bg-blue-500/10 px-2.5 py-1 rounded-lg border border-blue-500/20 transition-colors"
                >
                  View GDMT Checklist &rarr;
                </button>
              </CardHeader>
              <CardBody className="p-4 sm:p-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: 'Diuretic', med: latest.diuretic },
                    { label: 'RAASi (ARNI / ACEi / ARB)', med: latest.raasi },
                    { label: 'Beta Blocker', med: latest.betaBlocker },
                    { label: 'MRA', med: latest.mra },
                    { label: 'SGLT2i', med: latest.sglt2i },
                    { label: 'Ivabradine', med: latest.ivabradine },
                    { label: 'Digoxin', med: latest.digoxin },
                    { label: 'IV Iron', med: latest.ivIron },
                  ].map(({ label, med }) => {
                    const isPrescribed = med?.prescribed === 'Yes'
                    const isNotPrescribed = med?.prescribed === 'No'
                    const showDose = med?.dose && (!med?.type || med.dose.toLowerCase().trim() !== med.type.toLowerCase().trim())

                    return (
                      <div key={label} className={cn(
                        'p-3.5 rounded-2xl border text-xs shadow-sm transition-all flex flex-col justify-between',
                        isPrescribed
                          ? 'bg-blue-500/10 border-blue-500/30'
                          : isNotPrescribed
                          ? 'bg-slate-900/60 border-white/10 opacity-75'
                          : 'bg-slate-900/40 border-white/5 opacity-50'
                      )}>
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <p className="font-bold text-white text-xs">{label}</p>
                            {isPrescribed ? (
                              <span className="text-[10px] font-bold text-emerald-400 px-1.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/30">Active</span>
                            ) : isNotPrescribed ? (
                              <span className="text-[10px] font-bold text-gray-400 px-1.5 py-0.5 rounded bg-gray-800 border border-gray-700">Not prescribed</span>
                            ) : (
                              <span className="text-[10px] font-medium text-gray-500">Not recorded</span>
                            )}
                          </div>

                          {isPrescribed ? (
                            <div className="space-y-1">
                              {med.type && <p className="text-white font-bold text-xs">{med.type}</p>}
                              {showDose && <p className="font-semibold text-blue-300 font-mono text-[11px]">{med.dose}</p>}
                              {med.startDate && <p className="text-[10px] text-gray-400 font-medium">Started: {formatDate(med.startDate)}</p>}
                              {med.changeReason && <p className="text-[10px] text-amber-300/90 italic">Note: {med.changeReason}</p>}
                            </div>
                          ) : isNotPrescribed ? (
                            <div className="space-y-1">
                              <p className="text-gray-400 font-medium">Not on regimen</p>
                              {med.reason && <p className="text-[10px] text-amber-400/90">Reason: {med.reason}</p>}
                              {med.stopDate && <p className="text-[10px] text-gray-400">Stopped: {formatDate(med.stopDate)}</p>}
                              {med.changeReason && <p className="text-[10px] text-amber-400/80 italic">Note: {med.changeReason}</p>}
                            </div>
                          ) : (
                            <p className="text-gray-500 text-[11px]">No status documented</p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardBody>
            </Card>
          )}

          {/* Registry Workflow & Next Steps Card (shown when visits === 0 or unassigned) */}
          {(visits.length === 0 || !patient.registryId) && (
            <Card className="border-blue-500/20 bg-blue-950/10 shadow-lg">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <ClipboardList className="w-5 h-5 text-blue-400" />
                  <CardTitle>Registry Workflow &amp; Next Steps</CardTitle>
                </div>
              </CardHeader>
              <CardBody className="space-y-4">
                <p className="text-xs text-gray-400 leading-relaxed">
                  Follow these steps to complete the patient's enrollment and record clinical metrics for active registry analytics.
                </p>

                <div className="space-y-4 text-xs">
                  {/* Step 1: Registration */}
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-white">1. Demographic Profile Registered</p>
                      <p className="text-gray-500 mt-0.5">Demographics successfully recorded in registry database.</p>
                    </div>
                  </div>

                  {/* Step 2: Informed Consent */}
                  <div className="flex items-start gap-3">
                    {consentStatus === 'Granted' ? (
                      <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                    ) : (
                      <Circle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p className="font-semibold text-white">2. Regulatory Study Consent</p>
                      {consentStatus === 'Granted' ? (
                        <p className="text-gray-500 mt-0.5">Informed Consent has been Granted. Clinical data entry is enabled.</p>
                      ) : (
                        <div className="space-y-1">
                          <p className="text-amber-400 mt-0.5">Consent status is currently <strong>{consentStatus}</strong>.</p>
                          <p className="text-gray-500">Visit logging is restricted. Click "Edit Profile" to change consent to Granted.</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Step 3: Registry Assignment */}
                  <div className="flex items-start gap-3">
                    {patient.registryId ? (
                      <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                    ) : (
                      <Circle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5 animate-pulse" />
                    )}
                    <div className="w-full">
                      <p className="font-semibold text-white">3. Registry Assignment</p>
                      {patient.registryId ? (
                        <p className="text-gray-500 mt-0.5">
                          Assigned to: <strong className="text-blue-400">{REGISTRY_MAP[patient.registryId] || patient.registryId}</strong>
                        </p>
                      ) : (
                        <div className="space-y-2 w-full mt-1">
                          <p className="text-blue-400">Status: Unassigned / General Patient Profile</p>
                          <p className="text-gray-500">Select a target registry below to enroll this patient and enable registry-specific clinical tracking:</p>
                          <div className="flex flex-col sm:flex-row gap-2 pt-1">
                            <Button
                              size="sm"
                              onClick={() => handleQuickEnroll('hf')}
                              className="bg-blue-600 hover:bg-blue-700 text-white font-bold"
                            >
                              Enroll in Heart Failure Registry
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setEditing(true)}
                              className="border-gray-600 text-gray-300 hover:bg-gray-800"
                            >
                              Assign Other Registry...
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Step 4: Baseline Clinical Encounter / Interventional Procedure */}
                  <div className="flex items-start gap-3">
                    {isCathLabPatient ? (
                      patientProcedures.length > 0 ? (
                        <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                      ) : (
                        <Circle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5 animate-pulse" />
                      )
                    ) : (
                      visits.length > 0 ? (
                        <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                      ) : (
                        <Circle className="w-5 h-5 text-gray-500 flex-shrink-0 mt-0.5" />
                      )
                    )}
                    <div>
                      <p className="font-semibold text-white">
                        {isCathLabPatient ? '4. Index Cath / PCI Procedure' : '4. Baseline Clinical Visit'}
                      </p>
                      {isCathLabPatient ? (
                        patientProcedures.length > 0 ? (
                          <p className="text-gray-500 mt-0.5">
                            Index procedure recorded on <strong className="text-white">{formatDate(patientProcedures[0].procedureDateTime || patientProcedures[0].procedureDate)}</strong>: {patientProcedures[0].procedureType || 'PCI'} ({patientProcedures[0].overallSuccess ? 'TIMI 3 Restoration' : 'Logged'}).
                          </p>
                        ) : (
                          <div className="space-y-1">
                            <p className="text-gray-500 mt-0.5">No catheterisation or PCI procedure recorded yet for this patient.</p>
                            {consentStatus === 'Granted' && (
                              <p className="text-amber-400 font-semibold mt-1">
                                Click &quot;Add Cath / PCI&quot; above to document coronary angiography and stent intervention.
                              </p>
                            )}
                          </div>
                        )
                      ) : (
                        visits.length > 0 ? (
                          <p className="text-gray-500 mt-0.5">
                            Baseline visit recorded on <strong className="text-white">{formatDate(latest?.visitDate)}</strong>.
                          </p>
                        ) : (
                          <div className="space-y-1">
                            <p className="text-gray-500 mt-0.5">No clinical visits recorded yet for this patient.</p>
                            {consentStatus === 'Granted' && patient.registryId && (
                              <p className="text-blue-400 font-semibold mt-1">
                                Click &quot;Record Visit&quot; above to enter signs, symptoms, and echo parameters.
                              </p>
                            )}
                          </div>
                        )
                      )}
                    </div>
                  </div>
                </div>
              </CardBody>
            </Card>
          )}
        </div>
      )}

      {/* Cath Lab & PCI Procedures tab */}
      {activeTab === 'procedures' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Cath Lab Interventional Procedures
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30">
                  {patientProcedures.length} Logged
                </span>
              </h3>
              <p className="text-xs text-gray-400 mt-1">
                NCDR CathPCI & NIC India compliant procedure logs, lesion-specific interventions, and complication surveillance.
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => {
                setEditingProcedure(null)
                setIsCathModalOpen(true)
              }}
              className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-1.5 self-start sm:self-auto"
            >
              <PlusCircle className="w-4 h-4" /> Log Cath / PCI Procedure
            </Button>
          </div>

          {patientProcedures.length === 0 ? (
            <div className="text-center py-12 space-y-3 bg-slate-950/40 rounded-2xl border border-dashed border-white/10 p-8">
              <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto">
                <Heart className="w-6 h-6" />
              </div>
              <h4 className="text-base font-bold text-white">No Catheterization or PCI Procedures Recorded</h4>
              <p className="text-xs text-gray-400 max-w-md mx-auto">
                No procedure records exist for this patient in the Cath Lab registry. Click &quot;Log Cath / PCI Procedure&quot; to record diagnostic angiography, ad-hoc, elective, or primary PCI with lesion-level stent details.
              </p>
              <div className="pt-2">
                <Button
                  size="sm"
                  onClick={() => {
                    setEditingProcedure(null)
                    setIsCathModalOpen(true)
                  }}
                  className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs"
                >
                  <PlusCircle className="w-4 h-4" /> Log First Procedure
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {patientProcedures.map((proc, idx) => {
                const lesions = proc.lesions || []
                const comp = complicationFlags(proc)
                const hasComp = comp.hasComplication

                return (
                  <div key={proc.id || idx} className="rounded-2xl border border-amber-500/20 bg-slate-900/70 p-5 space-y-4">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-3">
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-300 font-bold flex items-center justify-center text-xs border border-amber-500/30">
                          #{patientProcedures.length - idx}
                        </span>
                        <div>
                          <h4 className="text-sm font-bold text-white flex items-center gap-2">
                            {proc.procedureType}
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold">
                              {proc.clinicalIndication}
                            </span>
                            {proc.overallSuccess ? (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold">
                                Overall Success (TIMI 3)
                              </span>
                            ) : (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 font-semibold">
                                Incomplete / Sub-optimal
                              </span>
                            )}
                          </h4>
                          <p className="text-[11px] text-gray-400 mt-0.5 font-mono">
                            {formatDate(proc.procedureDate)} · Operator: <strong className="text-gray-200">{proc.operatorName}</strong>
                            {proc.assistantOperatorName && ` · Assistant: ${proc.assistantOperatorName}`}
                            {proc.siteId && ` · Center: ${proc.siteId}`}
                          </p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditingProcedure(proc)
                          setIsCathModalOpen(true)
                        }}
                        className="text-xs border-white/15 text-gray-300 hover:text-white self-start sm:self-auto"
                      >
                        <Edit2 className="w-3.5 h-3.5" /> Edit Procedure
                      </Button>
                    </div>

                    {/* Metadata Badges */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div className="bg-slate-950/60 p-2.5 rounded-xl border border-white/5 space-y-0.5">
                        <span className="text-gray-500 text-[10px] uppercase font-semibold">Vascular Access</span>
                        <p className="font-semibold text-white">{proc.accessSite} ({proc.sheathSize})</p>
                        <p className="text-[10px] text-gray-400">{proc.closureDevice}</p>
                      </div>

                      <div className="bg-slate-950/60 p-2.5 rounded-xl border border-white/5 space-y-0.5">
                        <span className="text-gray-500 text-[10px] uppercase font-semibold">Contrast & Fluoro</span>
                        <p className="font-semibold text-white">{proc.contrastVolumeMl} mL ({proc.contrastType})</p>
                        <p className="text-[10px] text-gray-400">{proc.fluoroscopyTimeMinutes} mins fluoro</p>
                      </div>

                      <div className="bg-slate-950/60 p-2.5 rounded-xl border border-white/5 space-y-0.5">
                        <span className="text-gray-500 text-[10px] uppercase font-semibold">Radiation Exposure</span>
                        <p className="font-semibold text-white">{proc.radiationAirKermaGy ?? '—'} Gy Air Kerma</p>
                        <p className="text-[10px] text-gray-400">{proc.doseAreaProductGyCm2 ?? '—'} Gy·cm² DAP</p>
                      </div>

                      <div className="bg-slate-950/60 p-2.5 rounded-xl border border-white/5 space-y-0.5">
                        <span className="text-gray-500 text-[10px] uppercase font-semibold">STEMI DTB Metric</span>
                        {proc.stemiTimelines?.dtbMinutes != null ? (
                          <p className={`font-bold ${proc.stemiTimelines.dtbMinutes <= 90 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            DTB: {proc.stemiTimelines.dtbMinutes} mins {proc.stemiTimelines.dtbMinutes <= 90 ? '(≤90m Met)' : '(Delayed)'}
                          </p>
                        ) : (
                          <p className="text-gray-400">Non-STEMI / Elective</p>
                        )}
                        <p className="text-[10px] text-gray-500">{proc.stemiTimelines?.presentationType || 'Standard'}</p>
                      </div>
                    </div>

                    {/* Lesions Treated */}
                    <div className="space-y-2">
                      <span className="text-[11px] font-bold text-gray-300 uppercase tracking-wider">
                        Treated Lesions & Stenting ({lesions.length})
                      </span>
                      {lesions.length === 0 ? (
                        <p className="text-xs text-gray-500">No coronary lesions treated (Diagnostic angiogram).</p>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {lesions.map((l, lIdx) => {
                            const isCulprit = l.isCulprit || l.culprit
                            const isSuccess = l.lesionSuccess !== undefined ? l.lesionSuccess : (l.postTimiFlow === 3 && (l.postStenosisPct ?? 0) < 20)
                            const lesionDevices = (l.devices && l.devices.length > 0)
                              ? l.devices
                              : (proc.devices || []).filter(d => (l.deviceIds || []).includes(d.id))

                            return (
                              <div key={lIdx} className="bg-slate-950 p-3 rounded-xl border border-white/5 space-y-1.5 text-xs">
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-amber-300 flex items-center gap-1.5">
                                    {l.vessel} {isCulprit && <span className="px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 text-[9px]">Culprit</span>}
                                  </span>
                                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${isSuccess ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}`}>
                                    Post-TIMI {l.postTimiFlow ?? 3} · {l.postStenosisPct ?? 0}% Residual
                                  </span>
                                </div>
                                <p className="text-[11px] text-gray-400">
                                  Pre: {l.preStenosisPct ?? 0}% stenosis · TIMI {l.preTimiFlow ?? 0} · {l.calcification || 'None'} calcium {l.bifurcation ? '· Bifurcation' : ''}
                                </p>
                                {lesionDevices.length > 0 && (
                                  <div className="text-[10px] text-gray-300 bg-slate-900/80 p-1.5 rounded border border-white/5">
                                    <strong>Devices:</strong> {lesionDevices.map(d => `${d.type || (d as any).deviceType || 'DES'} ${(d as any).make || ''} ${(d as any).model || (d as any).brandName || ''} (${d.diameterMm}×${d.lengthMm}mm)${(d as any).serialOrLotNumber || (d as any).serialOrBatchNumber ? ` [Lot: ${(d as any).serialOrLotNumber || (d as any).serialOrBatchNumber}]` : ''}`).join(' · ')}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>

                    {/* Complications */}
                    {hasComp && (
                      <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl space-y-1 text-xs text-rose-300">
                        <div className="flex items-center gap-2 font-bold text-rose-400">
                          <ShieldAlert className="w-4 h-4" />
                          <span>Procedural Adverse Event Recorded</span>
                        </div>
                        <p className="text-[11px] text-gray-300">
                          {complicationLabels(comp).join(' · ')}
                        </p>
                        {(proc.complications as any)?.complicationNotes && (
                          <p className="text-[10px] text-gray-400 mt-1 italic">&quot;{(proc.complications as any).complicationNotes}&quot;</p>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* GDMT / Secondary Prevention tab */}
      {activeTab === 'gdmt' && (
        isCathLabPatient ? (
          <div className="space-y-6">
            <div className="glass-card p-6 border border-amber-500/20 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Pill className="w-5 h-5 text-amber-400" />
                    Coronary Secondary Prevention &amp; DAPT Regimen
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    AHA/ACC 2023 &amp; ESC 2024 Post-PCI Antiplatelet and Guideline-Directed Secondary Prevention
                  </p>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 self-start sm:self-auto">
                  Active Secondary Prevention
                </span>
              </div>

              {/* DAPT 4-Pillar Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* 1. Dual Antiplatelet Therapy */}
                <div className="p-4 rounded-xl bg-slate-900/80 border border-amber-500/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-white flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" /> 1. Dual Antiplatelet Therapy (DAPT)
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">Class I-A</span>
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between py-1 border-b border-white/5">
                      <span className="text-gray-400">Prescribed Regimen:</span>
                      <span className="font-semibold text-white">{patientProcedures[0]?.dischargeDaptAgent || 'Not recorded'}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-white/5">
                      <span className="text-gray-400">Target Duration:</span>
                      <span className="font-semibold text-emerald-300">{patientProcedures[0]?.dischargeDaptDurationMonths ? `${patientProcedures[0].dischargeDaptDurationMonths} Months Post-PCI` : 'Not recorded'}</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-gray-400">Premature Discontinuation Risk:</span>
                      <span className="text-rose-400 font-medium">Stent Thrombosis Risk — High</span>
                    </div>
                  </div>
                </div>

                {/* 2. High-Intensity Statin */}
                <div className="p-4 rounded-xl bg-slate-900/80 border border-blue-500/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-white flex items-center gap-2">
                      <Award className="w-4 h-4 text-blue-400" /> 2. High-Intensity Lipid Lowering
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-bold">Class I-A</span>
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between py-1 border-b border-white/5">
                      <span className="text-gray-400">Prescribed Intensity:</span>
                      <span className="font-semibold text-white">{patientProcedures[0]?.dischargeStatinIntensity || 'Not recorded'}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-white/5">
                      <span className="text-gray-400">Target LDL-C:</span>
                      <span className="font-semibold text-blue-300">&lt; 55 mg/dL (&gt;50% baseline reduction)</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-gray-400">Adjunctive Ezetimibe:</span>
                      <span className="text-gray-300 font-medium">Indicated if LDL &gt; 55 mg/dL</span>
                    </div>
                  </div>
                </div>

                {/* 3. Neurohormonal & Blood Pressure */}
                <div className="p-4 rounded-xl bg-slate-900/80 border border-white/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-white flex items-center gap-2">
                      <Heart className="w-4 h-4 text-rose-400" /> 3. Neurohormonal &amp; Anti-Ischemic
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-bold">Class I</span>
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between py-1 border-b border-white/5">
                      <span className="text-gray-400">Beta-Blocker:</span>
                      <span className="font-semibold text-white">{patientProcedures[0] == null ? 'Not recorded' : patientProcedures[0].dischargeBetaBlocker ? 'Prescribed at discharge' : 'Not prescribed at discharge'}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-white/5">
                      <span className="text-gray-400">ACEi / ARB:</span>
                      <span className="font-semibold text-white">{patientProcedures[0] == null ? 'Not recorded' : patientProcedures[0].dischargeAceiArb ? 'Prescribed at discharge' : 'Not prescribed at discharge'}</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-gray-400">Target Blood Pressure:</span>
                      <span className="text-emerald-400 font-medium">&lt; 130/80 mmHg</span>
                    </div>
                  </div>
                </div>

                {/* 4. Gastroprotection & Lifestyle */}
                <div className="p-4 rounded-xl bg-slate-900/80 border border-white/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-white flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-400" /> 4. Gastroprotection &amp; Lifestyle
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold">Class I-B</span>
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between py-1 border-b border-white/5">
                      <span className="text-gray-400">Proton Pump Inhibitor (PPI):</span>
                      <span className="font-semibold text-emerald-400">Recommended with DAPT (Pantoprazole 40mg)</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-white/5">
                      <span className="text-gray-400">Cardiac Rehabilitation:</span>
                      <span className="font-semibold text-blue-300">Phase II Outpatient Program</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-gray-400">Tobacco Abstinence:</span>
                      <span className="text-emerald-400 font-medium">100% Smoke-Free Protocol</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <GDMTDashboard patient={patient} visits={visits} />
        )
      )}

      {/* Timeline tab */}
      {activeTab === 'timeline' && (
        <VisitTimeline
          visits={visits}
          procedures={patientProcedures}
          patientId={id}
          onDelete={handleDeleteVisit}
          onDeleteProcedure={handleDeleteProcedure}
          onEditProcedure={(proc) => {
            setEditingProcedure(proc)
            setIsCathModalOpen(true)
          }}
          onAddProcedure={() => {
            setEditingProcedure(null)
            setIsCathModalOpen(true)
          }}
          isConsentGated={isConsentGated}
        />
      )}

      {/* Trends tab */}
      {activeTab === 'trends' && trends && (
        <div className="space-y-6">
          {kccqDropAlert && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl flex gap-3 items-start text-xs text-rose-300">
              <ShieldAlert className="w-5 h-5 flex-shrink-0 mt-0.5 text-rose-400 animate-pulse" />
              <div>
                <p className="font-bold">Clinically Meaningful QoL Decline</p>
                <p className="text-gray-400 mt-1">
                  KCCQ Overall Summary Score dropped by <strong>{kccqDropAlert.dropPoints} points</strong> (from {kccqDropAlert.prevScore} to {kccqDropAlert.currScore}) on <strong>{formatDate(kccqDropAlert.currDate)}</strong> compared to the previous visit on <strong>{formatDate(kccqDropAlert.prevDate)}</strong>.
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Card>
              <CardBody>
                <MetricTrendChart
                  data={trends.lvef}
                  label="LVEF"
                  unit="%"
                  color="#3b82f6"
                  referenceLines={[{ value: 40, label: 'HFrEF threshold', color: '#ef4444' }]}
                />
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <MetricTrendChart
                  data={trends.ntProBNP}
                  label="NT-proBNP"
                  unit="pg/mL"
                  color="#ef4444"
                  referenceLines={[{ value: 2000, label: 'High risk', color: '#dc2626' }]}
                />
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <MetricTrendChart
                  data={trends.egfr}
                  label="eGFR"
                  unit="ml/min/1.73m²"
                  color="#10b981"
                  referenceLines={[{ value: 45, label: 'CKD 3b', color: '#f59e0b' }]}
                />
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <MetricTrendChart
                  data={trends.weight}
                  label="Weight"
                  unit="kg"
                  color="#8b5cf6"
                />
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <MetricTrendChart
                  data={trends.bpSystolic}
                  label="Systolic BP"
                  unit="mmHg"
                  color="#f59e0b"
                  referenceLines={[{ value: 130, label: 'Target', color: '#10b981' }]}
                />
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <MetricTrendChart
                  data={trends.sixMWT}
                  label="6-Minute Walk Test"
                  unit="metres"
                  color="#06b6d4"
                />
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <MetricTrendChart
                  data={trends.heartRate}
                  label="Heart Rate"
                  unit="bpm"
                  color="#f97316"
                  referenceLines={[
                    { value: 70, label: 'Target HR', color: '#10b981' },
                    { value: 100, label: 'Tachycardia', color: '#ef4444' },
                  ]}
                />
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <MetricTrendChart
                  data={trends.nyha}
                  label="NYHA Class (1–4)"
                  unit=""
                  color="#8b5cf6"
                  yDomain={[1, 4]}
                  fillArea={false}
                />
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <MetricTrendChart
                  data={trends.kccq || []}
                  label="KCCQ Overall Summary Score"
                  unit=""
                  color="#f59e0b"
                  yDomain={[0, 100]}
                  referenceLines={[
                    { value: 75, label: 'Good/Excellent QoL', color: '#10b981' },
                    { value: 50, label: 'Fair/Good QoL', color: '#f59e0b' },
                    { value: 25, label: 'Very Poor QoL', color: '#ef4444' },
                  ]}
                />
              </CardBody>
            </Card>
          </div>
        </div>
      )}

      {/* Outcome Events Tab */}
      {activeTab === 'outcomes' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-base font-bold text-white">Registry Adjudicated Endpoints</h3>
              <p className="text-xs text-gray-500 mt-1">Track MACE, mortality, and heart failure outcomes for research analysis.</p>
            </div>
            <Button size="sm" onClick={() => setAddingEvent(a => !a)}>
              {addingEvent ? 'Cancel' : <><PlusCircle className="w-4 h-4" /> Add Outcome Event</>}
            </Button>
          </div>

          {addingEvent && (
            <Card>
              <CardHeader><CardTitle>Record Structured Endpoint / Outcome Event</CardTitle></CardHeader>
              <CardBody>
                <form onSubmit={handleAddEventSubmit} className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FieldWrap label="Event Date" required>
                      <Input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} required />
                    </FieldWrap>
                    <FieldWrap label="Encounter Type" required>
                      <Select value={eventEncounterType} onChange={e => setEventEncounterType(e.target.value as any)}>
                        <option value="Readmission">Hospital Readmission</option>
                        <option value="Emergency Visit">Emergency HF Visit</option>
                        <option value="Inpatient Index">Inpatient Index Episode</option>
                        <option value="Out-of-Hospital Event">Out-of-Hospital Event / Mortality</option>
                      </Select>
                    </FieldWrap>
                    <FieldWrap label="Endpoint Classification" required>
                      <Select value={eventType} onChange={e => setEventType(e.target.value as EventType)}>
                        {EVENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </Select>
                    </FieldWrap>
                    <FieldWrap label="Admission Date (if hospitalized)">
                      <Input type="date" value={eventAdmissionDate} onChange={e => setEventAdmissionDate(e.target.value)} />
                    </FieldWrap>
                    <FieldWrap label="Discharge Date (if applicable)">
                      <Input type="date" value={eventDischargeDate} onChange={e => setEventDischargeDate(e.target.value)} />
                    </FieldWrap>
                    <FieldWrap label="Facility / Hospital">
                      <Input value={eventHosp} onChange={e => setEventHosp(e.target.value)} placeholder="e.g. AICTS Pune" />
                    </FieldWrap>
                  </div>

                  {/* Acute Inpatient Interventions Checklist */}
                  <div className="p-3.5 rounded-xl bg-slate-900/60 border border-blue-500/15 space-y-2">
                    <p className="text-[11px] font-bold text-gray-300 uppercase tracking-wider">Acute Inpatient Interventions Used During Event</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <label className="flex items-center gap-2 cursor-pointer text-gray-300">
                        <input type="checkbox" checked={eventIvDiuretic} onChange={e => setEventIvDiuretic(e.target.checked)} className="rounded text-blue-500" />
                        <span>IV Loop Diuretics</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer text-gray-300">
                        <input type="checkbox" checked={eventInotrope} onChange={e => setEventInotrope(e.target.checked)} className="rounded text-blue-500" />
                        <span>IV Inotropes / Pressors</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer text-gray-300">
                        <input type="checkbox" checked={eventNIV} onChange={e => setEventNIV(e.target.checked)} className="rounded text-blue-500" />
                        <span>NIV (CPAP/BiPAP)</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer text-gray-300">
                        <input type="checkbox" checked={eventVent} onChange={e => setEventVent(e.target.checked)} className="rounded text-blue-500" />
                        <span>Invasive Ventilation</span>
                      </label>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FieldWrap label="Adjudication Status">
                      <Select value={eventAdjudicationStatus} onChange={e => setEventAdjudicationStatus(e.target.value as any)}>
                        <option value="Adjudicated - Confirmed">Adjudicated - Confirmed</option>
                        <option value="Pending Review">Pending Central Review</option>
                        <option value="Adjudicated - Reclassified">Adjudicated - Reclassified</option>
                        <option value="Adjudicated - Rejected">Adjudicated - Rejected</option>
                      </Select>
                    </FieldWrap>
                    <FieldWrap label="Adjudicated By (Principal Investigator)">
                      <Input value={eventAdjudicator} onChange={e => setEventAdjudicator(e.target.value)} placeholder="Dr. A. Jayachandra" />
                    </FieldWrap>
                    <FieldWrap label="Clinical Notes / Supporting Record Details" className="md:col-span-2">
                      <Textarea value={eventDesc} onChange={e => setEventDesc(e.target.value)} placeholder="Primary clinical reason, ICD-10 code, discharge summary reference..." />
                    </FieldWrap>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <Button type="submit" loading={savingEvent}>Save Structured Endpoint</Button>
                  </div>
                </form>
              </CardBody>
            </Card>
          )}

          <div className="glass-card overflow-hidden">
            <div className="overflow-x-auto text-xs">
              <table className="registry-table">
                <thead>
                  <tr>
                    <th>Event Date</th>
                    <th>Endpoint Type</th>
                    <th>Encounter &amp; Facility</th>
                    <th>Interventions &amp; Details</th>
                    <th>Adjudication</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {outcomeEvents.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-gray-500">
                        No outcome events recorded for this patient.
                      </td>
                    </tr>
                  ) : (
                    outcomeEvents.map(ev => (
                      <tr key={ev.id}>
                        <td className="font-mono text-white whitespace-nowrap">{formatDate(ev.eventDate)}</td>
                        <td>
                          <span className={cn('badge text-[10px] font-bold',
                            ev.eventType.includes('death') ? 'badge-red' :
                            ev.eventType.includes('hospitalisation') ? 'badge-amber' : 'badge-blue'
                          )}>
                            {ev.eventType}
                          </span>
                        </td>
                        <td className="text-gray-300">
                          <p className="font-semibold text-white">{ev.hospitalName || 'AICTS Pune'}</p>
                          <p className="text-[10px] text-gray-400">{ev.encounterType || 'Readmission'}</p>
                        </td>
                        <td className="text-gray-400 max-w-xs whitespace-normal">
                          <p className="text-gray-300">{ev.description || '—'}</p>
                          {ev.interventions && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {ev.interventions.ivLoopDiuretics && <span className="badge badge-blue text-[8px]">IV Diuretics</span>}
                              {ev.interventions.ivInotropesOrVasopressors && <span className="badge badge-amber text-[8px]">Inotropes</span>}
                              {ev.interventions.nonInvasiveVentilation && <span className="badge badge-gray text-[8px]">NIV</span>}
                              {ev.interventions.invasiveMechanicalVentilation && <span className="badge badge-red text-[8px]">Invasive Vent</span>}
                            </div>
                          )}
                        </td>
                        <td>
                          <span className={cn(
                            "badge text-[9px] font-bold",
                            ev.adjudicationStatus?.includes('Confirmed') ? 'badge-green' : 'badge-amber'
                          )}>
                            {ev.adjudicationStatus || (ev.adjudicated ? 'Confirmed' : 'Pending')}
                          </span>
                          <p className="text-[10px] text-gray-400 mt-0.5">{ev.adjudicatedBy || '—'}</p>
                        </td>
                        <td>
                          <div className="flex justify-end">
                            <button
                              onClick={() => handleDeleteEvent(ev.id)}
                              className="text-rose-400 hover:text-rose-300 p-1.5 rounded hover:bg-rose-500/10"
                              title="Delete event"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
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
      {/* Quick Data Entry Modal */}
      <QuickDataEntryModal
        isOpen={showQuickModal}
        onClose={() => setShowQuickModal(false)}
        patient={patient}
        latestVisit={latest}
        onSaved={load}
      />

      {/* Cath Lab & Interventional Procedure Modal */}
      {isCathModalOpen && (
        <CathProcedureModal
          isOpen={isCathModalOpen}
          onClose={() => {
            setIsCathModalOpen(false)
            setEditingProcedure(null)
          }}
          patient={patient}
          procedureToEdit={editingProcedure}
          onSaved={load}
        />
      )}
    </div>
  )
}
