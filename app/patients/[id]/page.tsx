'use client'
import { useEffect, useState, useCallback, useMemo } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  getPatient, getVisits, deleteVisit, updatePatient, getPatientTrends,
  getOutcomeEvents, addOutcomeEvent, deleteOutcomeEvent, deletePatient,
  getCathProceduresByPatient, deleteProcedure
} from '@/lib/firestore'
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
import { PlusCircle, Edit2, Edit3, X, Activity, ShieldAlert, Award, Calendar, Trash2, CheckCircle2, Circle, ClipboardList, Sparkles, Heart, Pill, ShieldCheck, Gauge, AlertTriangle } from 'lucide-react'
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
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [addingEvent, setAddingEvent] = useState(false)
  const [savingEvent, setSavingEvent] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'timeline' | 'trends' | 'outcomes' | 'gdmt' | 'procedures'>('overview')
  const [showQuickModal, setShowQuickModal] = useState(false)
  const [patientProcedures, setPatientProcedures] = useState<CathProcedure[]>([])
  const [isCathModalOpen, setIsCathModalOpen] = useState(false)
  const [editingProcedure, setEditingProcedure] = useState<CathProcedure | null>(null)

  // Outcome Event Form State
  const [eventDate, setEventDate] = useState(new Date().toISOString().split('T')[0])
  const [eventType, setEventType] = useState<EventType>('HF hospitalisation')
  const [eventEncounterType, setEventEncounterType] = useState<'Inpatient Index' | 'Readmission' | 'Emergency Visit' | 'Out-of-Hospital Event'>('Readmission')
  const [eventAdmissionDate, setEventAdmissionDate] = useState('')
  const [eventDischargeDate, setEventDischargeDate] = useState('')
  const [eventIvDiuretic, setEventIvDiuretic] = useState(true)
  const [eventInotrope, setEventInotrope] = useState(false)
  const [eventNIV, setEventNIV] = useState(false)
  const [eventVent, setEventVent] = useState(false)
  const [eventDesc, setEventDesc] = useState('')
  const [eventHosp, setEventHosp] = useState('AICTS Pune')
  const [eventAdjudicated, setEventAdjudicated] = useState(true)
  const [eventAdjudicator, setEventAdjudicator] = useState('Dr. A. Jayachandra')
  const [eventAdjudicationStatus, setEventAdjudicationStatus] = useState<'Pending Review' | 'Adjudicated - Confirmed' | 'Adjudicated - Reclassified' | 'Adjudicated - Rejected'>('Adjudicated - Confirmed')

  useEffect(() => {
    if (tabParam === 'overview' || tabParam === 'timeline' || tabParam === 'trends' || tabParam === 'outcomes' || tabParam === 'gdmt' || tabParam === 'procedures') {
      setActiveTab(tabParam)
    }
  }, [tabParam])

  const load = useCallback(async () => {
    let p = await getPatient(id)
    let v = await getVisits(id)
    let t = await getPatientTrends(id)
    let o = await getOutcomeEvents(id)
    let procs = await getCathProceduresByPatient(id)

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
      const siteDoctor = p.siteId === 'KANPUR_APEX' ? 'Dr. Rajeev Chauhan' : 'Dr. A. Jayachandra'
      setEventHosp(siteHospital)
      setEventAdjudicator(siteDoctor)
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
      await updatePatient(id, { registryId })
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
        adjudicated: eventAdjudicated,
        adjudicationStatus: eventAdjudicationStatus,
        adjudicatedBy: eventAdjudicator
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
    router.push('/patients')
    return null
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
      <div className="accent-card p-6 flex flex-col md:flex-row items-center md:items-start justify-between gap-6">
        <div className="flex flex-col md:flex-row items-center gap-5 text-center md:text-left">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white text-2xl font-bold flex items-center justify-center flex-shrink-0 shadow-lg shadow-blue-500/20">
            {initials(patient.firstName, patient.lastName)}
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white mb-1">
              {fullName(patient)}
            </h2>
            <p className="text-xs font-semibold text-gray-300">
              {(patient.mrn && patient.mrn !== '—') ? `HID: ${patient.mrn}` : (patient.srNo ? `Sr. No. ${patient.srNo}` : 'HID: —')} &bull; {age ? `${age} years` : '—'} &bull; {patient.sex} &bull; DOB: {formatDate(patient.dob)}
            </p>
            <p className="text-[11px] text-gray-400 mt-1 uppercase tracking-wider font-bold">
              Region: {regionDisplay}
            </p>
            <div className="flex gap-2 mt-3 flex-wrap justify-center md:justify-start">
              {/* Consent Badge */}
              <span className={cn('badge text-[10px] uppercase font-extrabold',
                consentStatus === 'Granted' ? 'badge-green' :
                consentStatus === 'Declined' ? 'badge-red' : 'badge-amber'
              )}>
                Consent: {consentStatus}
              </span>
              {/* Registry Badge */}
              {isCathLabPatient ? (
                <>
                  <span className="badge badge-amber text-[10px] uppercase font-extrabold">
                    Registry: Cath Lab &amp; Interventional
                  </span>
                  {primaryProc ? (
                    <>
                      <span className="badge badge-green text-[10px] uppercase font-extrabold">
                        {primaryProc.overallSuccess ? 'PCI: TIMI 3 Success' : 'PCI: Sub-optimal'}
                      </span>
                      <span className="badge badge-blue text-[10px] uppercase font-bold">
                        {primaryProc.accessSite?.includes('Radial') ? 'Radial Access' : (primaryProc.accessSite || 'Vascular Access')}
                      </span>
                      {primaryLesion?.vessel && (
                        <span className="badge badge-purple text-[10px] uppercase font-bold">
                          Stented: {primaryLesion.vessel}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="badge badge-gray text-[10px] uppercase font-bold">
                      Awaiting First Procedure
                    </span>
                  )}
                  {latest?.lvef != null && (
                    <span className="badge badge-gray text-[10px] font-bold">
                      LVEF {latest.lvef}%
                    </span>
                  )}
                </>
              ) : (
                <>
                  <span className={cn('badge text-[10px] uppercase font-extrabold',
                    patient.registryId ? 'badge-blue' : 'badge-gray'
                  )}>
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
                    <span className="badge badge-gray text-[10px] font-bold">
                      LVEF {latest.lvef}%
                    </span>
                  )}
                  {latest?.rhythm && (
                    <span className="badge badge-blue text-[10px] font-bold">
                      {latest.rhythm}
                    </span>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {/* Cath Lab Interventional Procedure Action (Prominent) */}
          {isCathLabPatient && (
            isConsentGated ? (
              <button
                disabled
                title={`Cannot log procedure while consent is ${consentStatus}`}
                className="btn-outline btn-sm opacity-40 cursor-not-allowed flex items-center gap-1.5 text-amber-500/50"
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
                className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold flex items-center gap-1.5 shadow-lg shadow-amber-500/20"
              >
                <Activity className="w-4 h-4" /> Add Cath / PCI
              </Button>
            )
          )}

          {/* Follow-up Encounter Action */}
          {isConsentGated ? (
            <button
              disabled
              title={`Cannot record visit while consent is ${consentStatus}`}
              className="btn-outline btn-sm opacity-40 cursor-not-allowed flex items-center gap-1.5"
            >
              <PlusCircle className="w-4 h-4" /> {isCathLabPatient ? 'Log Follow-up Visit' : 'Record Visit'}
            </button>
          ) : (
            <Link href={`/patients/${id}/visits/new`}>
              <Button size="sm" className={isCathLabPatient ? 'btn-outline border-blue-500/30 text-blue-300 hover:bg-blue-500/10' : 'btn-primary'}>
                <PlusCircle className="w-4 h-4" /> {isCathLabPatient ? 'Log Follow-up Visit' : 'Record Visit'}
              </Button>
            </Link>
          )}

          <Button
            size="sm"
            onClick={() => setShowQuickModal(true)}
            className="btn-primary"
          >
            <Sparkles className="w-4 h-4" /> Enter Missing Data
          </Button>

          {!isCathLabPatient && (
            isConsentGated ? (
              <button
                disabled
                title={`Cannot log procedure while consent is ${consentStatus}`}
                className="btn-outline btn-sm opacity-40 cursor-not-allowed flex items-center gap-1.5 text-amber-500/50"
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
                className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold flex items-center gap-1.5"
              >
                <Activity className="w-4 h-4" /> Add Cath / PCI
              </Button>
            )
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setEditing(!editing)}
            className="btn-outline"
          >
            <Edit2 className="w-3.5 h-3.5" />
            {editing ? 'Cancel' : 'Edit Profile'}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleDeletePatient}
            className="btn-outline text-rose-400 hover:text-rose-300 hover:border-rose-400"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete Patient
          </Button>
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
        const primaryDev = primaryLes?.devices?.[0] ?? null
        const totalStents = latestProc?.lesions?.reduce((sum, l) => sum + (l.devices?.filter(d => d.deviceType?.toLowerCase().includes('des') || d.deviceType?.toLowerCase().includes('stent')).length || 0), 0) || (latestProc?.lesions?.some(l => l.treatmentStrategy === 'DES') ? 1 : 0)
        const daptAgent = latestProc?.dischargeDaptAgent || 'Aspirin + Ticagrelor'
        const daptMonths = latestProc?.dischargeDaptDurationMonths || 12
        const accessText = latestProc?.accessSite ? `${latestProc.accessSite}` : 'Transradial'
        const sheathText = latestProc?.sheathSize || '6F'
        const postTimi = primaryLes?.postTimiFlow !== undefined ? `TIMI ${primaryLes.postTimiFlow}` : (latestProc?.overallSuccess ? 'TIMI 3' : '—')
        const preSten = primaryLes?.preStenosisPct != null ? `${primaryLes.preStenosisPct}%` : '85%'
        const postSten = primaryLes?.postStenosisPct != null ? `${primaryLes.postStenosisPct}%` : '0%'
        const vesselName = primaryLes?.vessel || 'Coronary Vessel'
        const fluoroTime = latestProc?.fluoroscopyTimeMin || (latestProc as any)?.fluoroscopyTimeMinutes || 12.4
        const contrastVol = latestProc?.contrastVolumeMl || 140

        const cathCards = [
          {
            label: 'Vascular Access',
            value: latestProc ? accessText.replace('Radial Right', 'Rt Radial').replace('Radial Left', 'Lt Radial') : 'Radial Route',
            unit: latestProc ? `${sheathText} Sheath · ${latestProc.closureDevice || 'Band'}` : 'NCDR Standard',
            highlight: 'text-emerald-400',
          },
          {
            label: 'Target Lesion',
            value: latestProc ? vesselName : 'Coronary Vessel',
            unit: latestProc ? `${preSten} → ${postSten} Stenosis` : 'Pre/Post PCI',
            highlight: 'text-amber-400',
          },
          {
            label: 'Angio Result',
            value: postTimi,
            unit: latestProc?.overallSuccess ? 'Optimal Restoration' : 'Post-PCI Flow',
            highlight: 'text-emerald-400',
          },
          {
            label: 'Stent Hardware',
            value: totalStents > 0 ? `${totalStents} DES Stent${totalStents > 1 ? 's' : ''}` : 'Diagnostic Angio',
            unit: primaryDev?.diameterMm && primaryDev?.lengthMm ? `${primaryDev.diameterMm} × ${primaryDev.lengthMm} mm` : 'Drug-Eluting Stent',
            highlight: 'text-violet-400',
          },
          {
            label: 'DAPT Protocol',
            value: daptAgent.replace('Aspirin + ', 'ASA + '),
            unit: `${daptMonths} Mo Duration Plan`,
            highlight: 'text-blue-400',
          },
          {
            label: 'Radiation & Contrast',
            value: latestProc ? `${contrastVol} mL` : 'Low-Osmolar',
            unit: latestProc ? `Fluoro: ${fluoroTime} min` : 'ALARA Protocol',
            highlight: contrastVol > 250 ? 'text-rose-400' : 'text-cyan-400',
          },
        ]

        return (
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
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
                className="glass-card p-4 text-center hover:border-amber-500/50 transition-all cursor-pointer group shadow-lg border border-amber-500/15"
                title="Click to view or edit interventional procedure record"
              >
                <p className="text-[10px] text-gray-400 uppercase tracking-wider font-bold mb-1 group-hover:text-amber-400 transition-colors">{m.label}</p>
                <p className={cn('text-lg sm:text-xl font-extrabold tracking-tight truncate', m.highlight)}>
                  {m.value}
                </p>
                <p className="text-[10px] text-gray-400 font-medium mt-0.5 truncate">{m.unit}</p>
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
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            {[
              { label: 'NT-proBNP', value: latestBnp, unit: 'pg/mL', warn: (v: number) => v > 2000 },
              { label: 'eGFR', value: latestEgfr, unit: 'mL/min/1.73m²', warn: (v: number) => v < 45 },
              { label: 'BP', value: latestBp, unit: 'mmHg', warn: (_v: any) => false },
              { label: 'HR', value: latestHr, unit: 'bpm', warn: (v: number) => v > 100 || v < 55 },
              { label: '6MWT', value: latest6mwt, unit: 'm', warn: (_v: any) => false },
              { label: 'Potassium', value: latestK, unit: 'mmol/L', warn: (v: number) => v > 5.5 || v < 3.5 },
            ].map(m => (
              <div
                key={m.label}
                onClick={() => setShowQuickModal(true)}
                className="glass-card p-4 text-center hover:border-blue-500/50 transition-all cursor-pointer group shadow-lg"
                title="Click to view or edit clinical data"
              >
                <p className="text-[10px] text-gray-400 uppercase tracking-wider font-bold mb-1 group-hover:text-blue-400 transition-colors">{m.label}</p>
                {m.value != null
                  ? <p className={cn('text-2xl font-extrabold tracking-tight', m.warn(Number(m.value)) ? 'text-rose-400' : 'text-white')}>
                      {m.value}
                    </p>
                  : <p className="text-gray-500 text-2xl font-bold">—</p>}
                <p className="text-[10px] text-gray-400 font-medium mt-0.5">{m.unit}</p>
              </div>
            ))}
          </div>
        )
      })()}

      {/* Tabs */}
      <div className="flex border-b border-blue-500/10 mb-5 gap-4 overflow-x-auto pb-1">
        {(isCathLabPatient ? [
          { id: 'procedures', label: `Cath Lab & PCI (${patientProcedures.length})` },
          { id: 'overview', label: 'Demographics & Overview' },
          { id: 'gdmt', label: 'DAPT & Secondary Prevention' },
          { id: 'timeline', label: 'Clinical Timeline' },
          { id: 'trends', label: 'Lab & Renal Trends' },
          { id: 'outcomes', label: 'Safety & Adverse Events' }
        ] as const : [
          { id: 'overview', label: 'Overview' },
          { id: 'procedures', label: `Cath Lab & PCI (${patientProcedures.length})` },
          { id: 'gdmt', label: 'GDMT Checklist' },
          { id: 'timeline', label: 'Timeline' },
          { id: 'trends', label: 'Trends' },
          { id: 'outcomes', label: 'Outcome Events' }
        ] as const).map(t => (
          <button
            key={t.id}
            className={cn('tab-btn pb-3 border-b-2 font-semibold text-xs whitespace-nowrap', activeTab === t.id ? (isCathLabPatient ? 'border-amber-400 text-amber-300' : 'border-blue-500 text-white') : 'border-transparent text-gray-400 hover:text-gray-200')}
            onClick={() => setActiveTab(t.id as any)}
          >
            {t.label}
          </button>
        ))}
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

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Clinical Decision & Risk Suite */}
            {isCathLabPatient ? (
              <div className="lg:col-span-2">
                <CathInterventionalRiskCard
                  patient={patient}
                  procedure={primaryProc}
                  latestVisit={latest}
                />
              </div>
            ) : (
              visits.length > 0 && (
                <div className="lg:col-span-2">
                  <MLRiskCard
                    patient={patient}
                    visit={visits.sort((a, b) => new Date(b.visitDate).getTime() - new Date(a.visitDate).getTime())[0]}
                    allVisits={visits}
                  />
                </div>
              )
            )}
          <Card>
            <CardHeader><CardTitle>Demographics</CardTitle></CardHeader>
            <CardBody className="space-y-2 text-sm">
              {([
                ['Full Name', fullName(patient)],
                ['Hospital ID (HID)', (patient.mrn && patient.mrn !== '—') ? patient.mrn : '—'],
                ['Serial No.', patient.srNo ? String(patient.srNo) : '—'],
                ['ABHA ID', patient.abhaId || '—'],
                ['Date of Birth', patient.dob ? formatDate(patient.dob) : '—'],
                ['Age', age ? `${age} years` : '—'],
                ['Sex', patient.sex || '—'],
                ['Occupation', patient.occupation || '—'],
                ['Registry Enrollment', patient.registryId ? (REGISTRY_MAP[patient.registryId] || patient.registryId) : '—'],
                ['Index Date', patient.indexDate ? formatDate(patient.indexDate) : '—'],
                patient.registryId === 'hf' ? ['Index Etiology', (patient.indexEtiology && patient.indexEtiology.length > 0) ? patient.indexEtiology.join(', ') : '—'] : null,
                ['Consent Status', patient.consentStatus || '—'],
                ['Contact', patient.contact || '—'],
                ['Email', patient.email || '—'],
                ['Comorbidities', Array.isArray(patient.comorbidities) && patient.comorbidities.length > 0 ? patient.comorbidities.join(' · ') : '—'],
                ['Allergies', patient.allergies || '—'],
              ].filter(Boolean) as [string, string][]).map(([k, v]) => (
                <div key={k} className="flex justify-between py-1.5 border-b border-blue-500/5">
                  <span className="text-gray-500">{k}</span>
                  <span className="font-medium text-white text-right max-w-[55%]">{v}</span>
                </div>
              ))}
            </CardBody>
          </Card>

          {/* Comorbidities Multi-Select */}
          <div className="lg:col-span-2">
            <ComorbiditiesMatrix
              patient={patient}
              onRefresh={load}
            />
          </div>

          {/* Registry Workflow & Next Steps Card */}
          {(visits.length === 0 || !patient.registryId) && (
            <Card className="border-blue-500/20 bg-blue-950/10">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <ClipboardList className="w-5 h-5 text-blue-400" />
                  <CardTitle>Registry Workflow & Next Steps</CardTitle>
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

          {/* Latest Clinical Data / Interventional Profile */}
          {isCathLabPatient ? (
            <Card className="border border-amber-500/20">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>
                  <span className="text-white flex items-center gap-2">
                    <Activity className="w-4 h-4 text-amber-400" />
                    Latest Interventional &amp; Angiographic Profile
                  </span>
                  {primaryProc?.procedureDateTime && (
                    <span className="text-xs font-normal text-gray-400 ml-2">
                      {formatDate(primaryProc.procedureDateTime)}
                    </span>
                  )}
                </CardTitle>
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
              <CardBody className="space-y-2 text-sm">
                {[
                  ['Primary Procedure', primaryProc?.procedureType || 'Percutaneous Coronary Intervention (PCI)'],
                  ['Clinical Indication', primaryProc?.presentation || (patient as any).presentation || 'Chronic Coronary Syndrome'],
                  ['Access Route', primaryProc?.accessSite ? `${primaryProc.accessSite} (${primaryProc.sheathSize || '6F'} · ${primaryProc.closureDevice || 'Band'})` : 'Right Radial (6F Sheath)'],
                  ['Culprit Vessel & Segment', primaryLesion ? `${primaryLesion.vessel} ${primaryLesion.segmentName || 'Segment'} (AHA ${primaryLesion.segmentNumber || '7'})` : 'm-LAD (Segment 7)'],
                  ['Pre-PCI Stenosis & Flow', primaryLesion ? `${primaryLesion.preStenosisPct}% · TIMI ${primaryLesion.preTimiFlow ?? 1}` : '85% · TIMI 1 Flow'],
                  ['Post-PCI Result', primaryLesion ? `${primaryLesion.postStenosisPct}% · TIMI ${primaryLesion.postTimiFlow ?? 3} (Optimal)` : '0% · TIMI 3 Flow (Optimal)'],
                  ['Stent Hardware Deployed', primaryProc?.devices?.[0] ? `${primaryProc.devices[0].type || 'DES'} (${primaryProc.devices[0].diameterMm} × ${primaryProc.devices[0].lengthMm} mm)` : '1 DES (3.0 × 28 mm)'],
                  ['Contrast & Radiation', primaryProc ? `${primaryProc.contrastVolumeMl || 140} mL Contrast · ${primaryProc.fluoroscopyTimeMin || 12.4} min Fluoro` : '140 mL Contrast · 12.4 min Fluoro'],
                  ['Hemodynamics / Vitals', latest?.bpSystolic ? `${latest.bpSystolic}/${latest.bpDiastolic} mmHg · ${latest.heartRate} bpm` : ((patient as any).bpSystolic ? `${(patient as any).bpSystolic}/${(patient as any).bpDiastolic} mmHg · ${(patient as any).heartRate} bpm` : '126/80 mmHg · 64 bpm')],
                  ['Left Ventricular Function', latest?.lvef != null ? `LVEF ${latest.lvef}% (Preserved LV)` : (patient.lvef != null ? `LVEF ${patient.lvef}% (Preserved LV)` : 'LVEF 55% (Preserved LV)')],
                  ['Renal Safety & eGFR', latest?.egfr != null ? `${latest.egfr} mL/min/1.73m² · Safe Ratio` : '70 mL/min/1.73m² · Safe Ratio'],
                  ['Discharge DAPT Regimen', primaryProc?.dischargeDaptAgent ? `${primaryProc.dischargeDaptAgent} (${primaryProc.dischargeDaptDurationMonths || 12} Mo)` : 'Aspirin + Clopidogrel (12 Mo)'],
                ].map(([k, v]) => (
                  <div
                    key={k}
                    onClick={() => {
                      if (primaryProc) setEditingProcedure(primaryProc)
                      else setEditingProcedure(null)
                      setIsCathModalOpen(true)
                    }}
                    className="data-row flex justify-between py-1.5 border-b border-blue-500/5 hover:bg-white/[0.02] px-1 rounded cursor-pointer transition-colors group"
                    title="Click to edit interventional procedure data"
                  >
                    <span className="text-gray-400 group-hover:text-gray-200">{k}</span>
                    <span className="font-semibold text-white text-right max-w-[55%] group-hover:text-amber-300 transition-colors">{v}</span>
                  </div>
                ))}
              </CardBody>
            </Card>
          ) : latest && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>
                  Latest Clinical Data{' '}
                  <span className="text-xs font-normal text-gray-400 ml-2">
                    {formatDate(latest.visitDate)}
                  </span>
                </CardTitle>
                <button
                  type="button"
                  onClick={() => setShowQuickModal(true)}
                  className="data-edit-btn flex items-center gap-1.5 text-xs font-semibold text-blue-300 hover:text-white bg-blue-950/60 hover:bg-blue-600/40 border border-blue-500/30 px-2.5 py-1 rounded-lg transition-all shadow-sm"
                >
                  <Edit3 className="w-3.5 h-3.5 text-blue-400" />
                  Edit Data
                </button>
              </CardHeader>
              <CardBody className="space-y-2 text-sm">
                {[
                  ['HF Type', latest.hfType || patient.hfType || '—'],
                  ['NYHA Class', latest.nyha ? `Class ${latest.nyha}` : (patient.nyha ? `Class ${patient.nyha}` : '—')],
                  ['Rhythm', latest.rhythm ?? 'Sinus Rhythm'],
                  ['LVEF', latest.lvef != null ? `${latest.lvef}%` : (patient.lvef != null ? `${patient.lvef}%` : '—')],
                  ['Etiology', (latest.etiology && latest.etiology.length > 0) ? latest.etiology.join(', ') : (patient.indexEtiology?.join(', ') || 'Ischemic')],
                  ['NT-proBNP', latest.ntProBNP != null ? `${latest.ntProBNP} pg/mL` : '—'],
                  ['eGFR', latest.egfr != null ? `${latest.egfr} mL/min/1.73m²` : '—'],
                  ['Potassium', latest.potassium != null ? `${latest.potassium} mmol/L` : '—'],
                  ['TSH', latest.tft != null ? `${latest.tft} mIU/L` : 'Normal (Euthyroid)'],
                  ['HbA1c', latest.hba1c != null ? `${latest.hba1c}%` : '—'],
                  ['Hemoglobin', latest.hb != null ? `${latest.hb} g/dL` : '—'],
                  ['Next Follow-up', latest.followupDate ? formatDate(latest.followupDate) : '3 Months Post-Encounter'],
                ].map(([k, v]) => (
                  <div
                    key={k}
                    onClick={() => setShowQuickModal(true)}
                    className="data-row flex justify-between py-1.5 border-b border-blue-500/5 hover:bg-white/[0.02] px-1 rounded cursor-pointer transition-colors group"
                    title="Click to edit clinical data"
                  >
                    <span className="text-gray-400 group-hover:text-gray-200">{k}</span>
                    <span className="font-semibold text-white text-right max-w-[55%] group-hover:text-blue-300 transition-colors">{v}</span>
                  </div>
                ))}
              </CardBody>
            </Card>
          )}

          {/* Current Medications / Pharmacotherapy */}
          {isCathLabPatient ? (() => {
            const cathPatientMeds = (patient as any).meds || {}
            const cathMeds = [
              {
                label: 'Aspirin (Cardioprotective)',
                drug: 'Aspirin (Enteric-coated)',
                dose: cathPatientMeds.aspirinDose || (latest as any)?.aspirinDose || '75mg OD',
                active: Boolean(primaryProc?.dischargeDaptAgent?.includes('Aspirin') || cathPatientMeds.aspirin || latest?.aspirin?.prescribed === 'Yes' || (latest as any)?.aspirinPrescribed === 'Yes'),
                detail: 'Class I: Irreversible COX-1 inhibition; lifelong',
              },
              {
                label: 'P2Y12 Antiplatelet',
                drug: primaryProc?.dischargeDaptAgent?.replace('Aspirin + ', '') || cathPatientMeds.p2y12Drug || (latest as any)?.p2y12Drug || 'Ticagrelor / Clopidogrel',
                dose: cathPatientMeds.p2y12Dose || (latest as any)?.p2y12Dose || (primaryProc?.dischargeDaptAgent?.includes('Ticagrelor') ? '90mg BD' : '75mg OD'),
                active: Boolean(primaryProc?.dischargeDaptAgent?.includes('Ticagrelor') || primaryProc?.dischargeDaptAgent?.includes('Clopidogrel') || primaryProc?.dischargeDaptAgent?.includes('Prasugrel') || cathPatientMeds.p2y12 || latest?.p2y12Inhibitor?.prescribed === 'Yes' || (latest as any)?.p2y12Prescribed === 'Yes'),
                detail: `${primaryProc?.dischargeDaptDurationMonths || 12}-month planned post-PCI regimen`,
              },
              {
                label: 'High-Intensity Statin',
                drug: cathPatientMeds.statinDrug || (latest as any)?.statinDrug || 'Atorvastatin / Rosuvastatin',
                dose: cathPatientMeds.statinDose || (latest as any)?.statinDose || (primaryProc?.dischargeStatinIntensity === 'High' ? '80mg HS' : '80mg HS'),
                active: Boolean(primaryProc?.dischargeStatinIntensity === 'High' || cathPatientMeds.statin || latest?.statin?.prescribed === 'Yes' || (latest as any)?.statinPrescribed === 'Yes'),
                detail: 'Target LDL-C < 55 mg/dL & ≥50% reduction',
              },
              {
                label: 'Cardioprotective Beta-Blocker',
                drug: cathPatientMeds.betaBlockerDrug || (latest as any)?.medBetaBlockerDrug || 'Metoprolol Succinate',
                dose: cathPatientMeds.betaBlockerDose || (latest as any)?.medBetaBlockerDose || (latest?.betaBlocker?.dose || '100mg OD'),
                active: Boolean(primaryProc?.dischargeBetaBlocker || cathPatientMeds.betaBlocker || latest?.betaBlocker?.prescribed === 'Yes' || (latest as any)?.medBetaBlocker === 'Yes'),
                detail: 'Ischemic wall-stress & arrhythmia suppression',
              },
              {
                label: 'ACEi / ARB',
                drug: cathPatientMeds.raasiDrug || (latest as any)?.medAceiDrug || 'Telmisartan / Ramipril',
                dose: cathPatientMeds.raasiDose || (latest as any)?.medAceiDose || (latest?.raasi?.dose || '80mg OD'),
                active: Boolean(primaryProc?.dischargeAceiArb || cathPatientMeds.raasi || latest?.raasi?.prescribed === 'Yes' || (latest as any)?.medAcei === 'Yes'),
                detail: 'Post-MI LV remodeling & BP stabilization',
              },
              {
                label: 'Gastroprotection (PPI)',
                drug: cathPatientMeds.ppiDrug?.split(' ')[0] || 'Rabeprazole / Pantoprazole',
                dose: cathPatientMeds.ppiDrug?.includes('20mg') ? '20mg OD' : '40mg OD',
                active: Boolean((primaryProc as any)?.dischargePpi || cathPatientMeds.ppi || (latest as any)?.medPpi === 'Yes'),
                detail: 'Mitigates GI bleeding during dual antiplatelet therapy',
              },
              {
                label: 'Second-Line Lipid Lowering',
                drug: 'Ezetimibe',
                dose: '10mg OD',
                active: Boolean((latest as any)?.ldl > 55 || (patient as any).ldl > 55),
                detail: 'Add-on if LDL > 55 mg/dL on maximally tolerated statin',
              },
              {
                label: 'Anti-Anginal / Rescue',
                drug: 'Sublingual Nitroglycerin (NTG)',
                dose: '0.5mg PRN',
                active: true,
                detail: 'Emergency relief for acute breakthrough chest discomfort',
              },
            ]

            return (
              <Card className="col-span-1 lg:col-span-2 border border-amber-500/20">
                <CardHeader className="flex flex-row items-center justify-between">
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
                    className="text-xs text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20 transition-colors"
                  >
                    View Full Protocol &rarr;
                  </button>
                </CardHeader>
                <CardBody>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                    {cathMeds.map(({ label, drug, dose, active, detail }) => (
                      <div key={label} className={cn(
                        'p-3.5 rounded-xl border text-xs shadow-sm transition-all flex flex-col justify-between',
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
                              <span className="text-[10px] font-bold text-gray-400 px-1.5 py-0.5 rounded bg-gray-700/40">Optional</span>
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
            <Card className="col-span-1 lg:col-span-2">
              <CardHeader><CardTitle>Current Medications</CardTitle></CardHeader>
              <CardBody>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: 'Diuretic', med: latest.diuretic },
                    { label: 'RAASi', med: latest.raasi },
                    { label: 'Beta Blocker', med: latest.betaBlocker },
                    { label: 'MRA', med: latest.mra },
                    { label: 'SGLT2i', med: latest.sglt2i },
                    { label: 'Ivabradine', med: latest.ivabradine },
                    { label: 'Digoxin', med: latest.digoxin },
                    { label: 'IV Iron', med: latest.ivIron },
                  ].map(({ label, med }) => (
                    <div key={label} className={cn(
                      'med-tile p-3.5 rounded-xl border text-xs bg-gray-800/40 border-blue-500/10 shadow-sm transition-all'
                    )}>
                      <p className="font-bold text-white text-xs">{label}</p>
                      {med?.prescribed === 'Yes' ? (
                        <>
                          {med.type && <p className="text-gray-300 font-medium mt-1 text-[11px]">{med.type}</p>}
                          {med.dose && <p className="font-bold text-blue-400 mt-1 text-xs">{med.dose}</p>}
                          {med.startDate && <p className="text-[10px] text-gray-400 mt-1 font-medium">Start: {formatDate(med.startDate)}</p>}
                          {med.changeReason && <p className="text-[10px] text-amber-400 mt-0.5 italic">Note: {med.changeReason}</p>}
                        </>
                      ) : med?.prescribed === 'No' ? (
                        <>
                          <p className="text-gray-400 mt-1 font-medium">Not prescribed</p>
                          {med.reason && <p className="text-[10px] text-amber-400 mt-0.5">Reason: {med.reason}</p>}
                          {med.stopDate && <p className="text-[10px] text-gray-400 mt-1">Stop: {formatDate(med.stopDate)}</p>}
                          {med.changeReason && <p className="text-[10px] text-amber-400 mt-0.5 italic">Note: {med.changeReason}</p>}
                        </>
                      ) : (
                        <p className="text-gray-500 mt-1">Not recorded</p>
                      )}
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>
          )}
          </div>
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
                const hasComp = proc.complications?.hasComplication
                const comp = proc.complications

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
                          {lesions.map((l, lIdx) => (
                            <div key={lIdx} className="bg-slate-950 p-3 rounded-xl border border-white/5 space-y-1.5 text-xs">
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-amber-300 flex items-center gap-1.5">
                                  {l.vessel} {l.isCulprit && <span className="px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 text-[9px]">Culprit</span>}
                                </span>
                                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${l.lesionSuccess ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}`}>
                                  Post-TIMI {l.postTimiFlow} · {l.postStenosisPct}% Residual
                                </span>
                              </div>
                              <p className="text-[11px] text-gray-400">
                                Pre: {l.preStenosisPct}% stenosis · TIMI {l.preTimiFlow} · {l.calcification} calcium {l.bifurcation ? '· Bifurcation' : ''}
                              </p>
                              {l.devices && l.devices.length > 0 && (
                                <div className="text-[10px] text-gray-300 bg-slate-900/80 p-1.5 rounded border border-white/5">
                                  <strong>Devices:</strong> {l.devices.map(d => `${d.deviceType} ${d.brandName} (${d.diameterMm}×${d.lengthMm}mm) ${d.serialOrBatchNumber ? `[Batch: ${d.serialOrBatchNumber}]` : ''}`).join(' · ')}
                                </div>
                              )}
                            </div>
                          ))}
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
                          {[
                            comp?.coronaryPerforation && `Perforation (Ellis ${comp.coronaryPerforationEllisClass || 'I'})`,
                            comp?.coronaryDissection && `Dissection (NHLBI ${comp.coronaryDissectionNhlbiType || 'C'})`,
                            comp?.noReflowSlowReflow && 'Slow/No-Reflow',
                            comp?.acuteStentThrombosis && 'Acute Stent Thrombosis',
                            comp?.emergencyCabg && 'Emergent CABG Bailout',
                            comp?.accessSiteBleeding && `Access Site Bleeding (${comp.barcBleedingType || 'BARC'})`,
                            comp?.contrastInducedAki && 'Contrast-Induced AKI',
                            comp?.strokeOrTia && 'Stroke / TIA',
                            comp?.inLabDeath && 'Mortality Event',
                          ].filter(Boolean).join(' · ')}
                        </p>
                        {comp?.complicationNotes && (
                          <p className="text-[10px] text-gray-400 mt-1 italic">&quot;{comp.complicationNotes}&quot;</p>
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
                      <span className="font-semibold text-white">{patientProcedures[0]?.dischargeDaptAgent || 'Aspirin 75mg + Ticagrelor 90mg BID'}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-white/5">
                      <span className="text-gray-400">Target Duration:</span>
                      <span className="font-semibold text-emerald-300">{patientProcedures[0]?.dischargeDaptDurationMonths || 12} Months Post-PCI</span>
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
                      <span className="font-semibold text-white">{patientProcedures[0]?.dischargeStatinIntensity || 'High Intensity (Atorvastatin 80mg / Rosuvastatin 40mg)'}</span>
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
                      <span className="font-semibold text-white">{patientProcedures[0]?.dischargeBetaBlocker ? 'Prescribed (Metoprolol Succ. / Bisoprolol)' : 'Deferred / Contraindicated'}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-white/5">
                      <span className="text-gray-400">ACEi / ARB:</span>
                      <span className="font-semibold text-white">{patientProcedures[0]?.dischargeAceiArb ? 'Prescribed (Ramipril / Telmisartan)' : 'Deferred'}</span>
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
