'use client'
import { useEffect, useState, useCallback, useMemo } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  getPatient, getVisits, deleteVisit, updatePatient, getPatientTrends,
  getOutcomeEvents, addOutcomeEvent, deleteOutcomeEvent, deletePatient
} from '@/lib/firestore'
import type { Patient, Visit, OutcomeEvent, OutcomeEventInput, EventType } from '@/lib/types'
import { getAge, formatDate, nyhaBadgeColor, hfTypeBadgeColor, lvefColor, initials, cn } from '@/lib/utils'
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card'
import { FieldWrap, Input, Select, Textarea } from '@/components/ui/FormField'
import Button from '@/components/ui/Button'
import VisitTimeline from '@/components/patients/VisitTimeline'
import MetricTrendChart from '@/components/charts/MetricTrendChart'
import PatientForm from '@/components/forms/PatientForm'
import GDMTDashboard from '@/components/patients/GDMTDashboard'
import type { PatientTrends } from '@/lib/types'
import { toast } from 'sonner'
import { PlusCircle, Edit2, Edit3, X, Activity, ShieldAlert, Award, Calendar, Trash2, CheckCircle2, Circle, ClipboardList, Sparkles } from 'lucide-react'
import MLRiskCard from '@/components/patients/MLRiskCard'
import DataCompletenessCard from '@/components/patients/DataCompletenessCard'
import QuickDataEntryModal from '@/components/patients/QuickDataEntryModal'
import ComorbiditiesMatrix from '@/components/patients/ComorbiditiesMatrix'

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
  const [activeTab, setActiveTab] = useState<'overview' | 'timeline' | 'trends' | 'outcomes' | 'gdmt'>('overview')
  const [showQuickModal, setShowQuickModal] = useState(false)

  // Outcome Event Form State
  const [eventDate, setEventDate] = useState(new Date().toISOString().split('T')[0])
  const [eventType, setEventType] = useState<EventType>('HF hospitalisation')
  const [eventDesc, setEventDesc] = useState('')
  const [eventHosp, setEventHosp] = useState('')
  const [eventAdjudicated, setEventAdjudicated] = useState(true)
  const [eventAdjudicator, setEventAdjudicator] = useState('Dr. A. Jayachandra')

  useEffect(() => {
    if (tabParam === 'overview' || tabParam === 'timeline' || tabParam === 'trends' || tabParam === 'outcomes' || tabParam === 'gdmt') {
      setActiveTab(tabParam)
    }
  }, [tabParam])

  const load = useCallback(async () => {
    let p = await getPatient(id)
    let v = await getVisits(id)
    let t = await getPatientTrends(id)
    let o = await getOutcomeEvents(id)

    setPatient(p)
    setVisits(v)
    setTrends(t)
    setOutcomeEvents(o)
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  const handleDeleteVisit = async (visitId: string) => {
    if (!confirm('Delete this visit record?')) return
    await deleteVisit(id, visitId)
    toast.success('Visit deleted')
    load()
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
    const toastId = toast.loading('Recording outcome event...')
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
        eventType,
        description: eventDesc,
        hospitalName: eventHosp,
        adjudicated: eventAdjudicated,
        adjudicatedBy: eventAdjudicator
      }
      await addOutcomeEvent(id, input)
      clearTimeout(timeoutId)
      toast.success('Outcome event recorded successfully', { id: toastId })
      setAddingEvent(false)
      setEventDesc('')
      setEventHosp('')
      load()
    } catch (err) {
      clearTimeout(timeoutId)
      console.error('Add event error:', err)
      toast.error('Failed to add outcome event. Please check database configuration/security rules.', { id: toastId })
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

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Activity className="w-6 h-6 text-blue-400 animate-pulse" />
    </div>
  )

  if (!patient) {
    router.push('/patients')
    return null
  }

  const latest = visits[0] ?? null
  const age = getAge(patient.dob)

  // Consent Status Check for Visit Gating
  const consentStatus = patient.consentStatus || 'Pending'
  const isConsentGated = consentStatus === 'Pending' || consentStatus === 'Declined'

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
              {patient.firstName} {patient.lastName}
            </h2>
            <p className="text-xs font-semibold text-slate-700 dark:text-gray-300">
              {(patient.mrn && patient.mrn !== '—') ? `HID: ${patient.mrn}` : (patient.srNo ? `Sr. No. ${patient.srNo}` : 'HID: —')} &bull; {age ? `${age} years` : '—'} &bull; {patient.sex} &bull; DOB: {formatDate(patient.dob)}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-gray-400 mt-1 uppercase tracking-wider font-bold">
              Region: Maharashtra, India
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
            </div>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            size="sm"
            onClick={() => setShowQuickModal(true)}
            className="btn-primary"
          >
            <Sparkles className="w-4 h-4" /> Enter Missing Data
          </Button>
          {isConsentGated ? (
            <button
              disabled
              title={`Cannot record visit while consent is ${consentStatus}`}
              className="btn-outline btn-sm opacity-40 cursor-not-allowed flex items-center gap-1.5"
            >
              <PlusCircle className="w-4 h-4" /> Record Visit
            </button>
          ) : (
            <Link href={`/patients/${id}/visits/new`}>
              <Button size="sm" className="btn-primary">
                <PlusCircle className="w-4 h-4" /> Record Visit
              </Button>
            </Link>
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
            className="btn-outline text-rose-600 dark:text-rose-400 hover:text-rose-700 hover:border-rose-400"
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
            <p className="text-slate-600 dark:text-gray-400 mt-1">
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

      {/* Latest key metrics */}
      {latest && (() => {
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
                className="glass-card p-4 text-center hover:border-blue-500/50 transition-all cursor-pointer group"
                title="Click to view or edit clinical data"
              >
                <p className="text-[10px] text-slate-600 dark:text-gray-400 uppercase tracking-wider font-bold mb-1 group-hover:text-blue-600 dark:group-hover:text-blue-300 transition-colors">{m.label}</p>
                {m.value != null
                  ? <p className={cn('text-xl font-extrabold', m.warn(Number(m.value)) ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white')}>
                      {m.value}
                    </p>
                  : <p className="text-slate-400 dark:text-gray-500 text-xl font-bold">—</p>}
                <p className="text-[10px] text-slate-500 dark:text-gray-400 font-medium mt-0.5">{m.unit}</p>
              </div>
            ))}
          </div>
        )
      })()}

      {/* Tabs */}
      <div className="flex border-b border-blue-500/10 mb-5 gap-4">
        {([
          { id: 'overview', label: 'Overview' },
          { id: 'gdmt', label: 'GDMT Checklist' },
          { id: 'timeline', label: 'Timeline' },
          { id: 'trends', label: 'Trends' },
          { id: 'outcomes', label: 'Outcome Events' }
        ] as const).map(t => (
          <button
            key={t.id}
            className={cn('tab-btn pb-3 border-b-2 font-semibold text-xs', activeTab === t.id ? 'border-blue-500 text-white' : 'border-transparent text-gray-400 hover:text-gray-200')}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Overview tab */}
      {activeTab === 'overview' && (
        <div className="space-y-5">
          {/* Data Completeness Audit & In-place quick entry */}
          <DataCompletenessCard
            patient={patient}
            latestVisit={latest}
            onRefresh={load}
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* AI Risk Card — shown when at least one visit exists */}
            {visits.length > 0 && (
              <div className="lg:col-span-2">
                <MLRiskCard
                  patient={patient}
                  visit={visits.sort((a, b) => new Date(b.visitDate).getTime() - new Date(a.visitDate).getTime())[0]}
                  allVisits={visits}
                />
              </div>
            )}
          <Card>
            <CardHeader><CardTitle>Demographics</CardTitle></CardHeader>
            <CardBody className="space-y-2 text-sm">
              {([
                ['Full Name', `${patient.firstName} ${patient.lastName}`.trim() || '—'],
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

                  {/* Step 4: Baseline Clinical Visit */}
                  <div className="flex items-start gap-3">
                    {visits.length > 0 ? (
                      <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                    ) : (
                      <Circle className="w-5 h-5 text-gray-500 flex-shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p className="font-semibold text-white">4. Baseline Clinical Visit</p>
                      {visits.length > 0 ? (
                        <p className="text-gray-500 mt-0.5">
                          Baseline visit recorded on <strong className="text-white">{formatDate(latest?.visitDate)}</strong>.
                        </p>
                      ) : (
                        <div className="space-y-1">
                          <p className="text-gray-500 mt-0.5">No clinical visits recorded yet for this patient.</p>
                          {consentStatus === 'Granted' && patient.registryId && (
                            <p className="text-blue-400 font-semibold mt-1">
                              Click "Record Visit" above to enter signs, symptoms, and echo parameters.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardBody>
            </Card>
          )}

          {latest && (
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
                  className="flex items-center gap-1.5 text-xs font-semibold text-blue-700 dark:text-blue-300 hover:text-blue-900 dark:hover:text-white bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-600/40 border border-blue-200 dark:border-blue-500/30 px-2.5 py-1 rounded-lg transition-all shadow-sm"
                >
                  <Edit3 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
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
                    className="flex justify-between py-1.5 border-b border-slate-100 dark:border-blue-500/5 hover:bg-slate-50 dark:hover:bg-white/[0.02] px-1 rounded cursor-pointer transition-colors group"
                    title="Click to edit clinical data"
                  >
                    <span className="text-slate-600 dark:text-gray-400 font-medium group-hover:text-slate-900 dark:group-hover:text-gray-300">{k}</span>
                    <span className="font-bold text-slate-900 dark:text-white text-right max-w-[55%] group-hover:text-blue-600 dark:group-hover:text-blue-300 transition-colors">{v}</span>
                  </div>
                ))}
              </CardBody>
            </Card>
          )}

          {latest && (
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
                      'p-3.5 rounded-xl border text-xs bg-slate-50 dark:bg-gray-800/40 border-slate-200 dark:border-blue-500/10 shadow-sm transition-all hover:border-blue-400/40'
                    )}>
                      <p className="font-bold text-slate-900 dark:text-white text-xs">{label}</p>
                      {med?.prescribed === 'Yes' ? (
                        <>
                          {med.type && <p className="text-slate-700 dark:text-gray-300 font-medium mt-1 text-[11px]">{med.type}</p>}
                          {med.dose && <p className="font-bold text-blue-700 dark:text-blue-400 mt-1 text-xs">{med.dose}</p>}
                          {med.startDate && <p className="text-[10px] text-slate-500 dark:text-gray-400 mt-1 font-medium">Start: {formatDate(med.startDate)}</p>}
                          {med.changeReason && <p className="text-[10px] text-amber-700 dark:text-amber-400 mt-0.5 italic">Note: {med.changeReason}</p>}
                        </>
                      ) : med?.prescribed === 'No' ? (
                        <>
                          <p className="text-slate-500 dark:text-gray-400 mt-1 font-medium">Not prescribed</p>
                          {med.reason && <p className="text-[10px] text-amber-700 dark:text-amber-500 mt-0.5">Reason: {med.reason}</p>}
                          {med.stopDate && <p className="text-[10px] text-slate-500 dark:text-gray-400 mt-1">Stop: {formatDate(med.stopDate)}</p>}
                          {med.changeReason && <p className="text-[10px] text-amber-700 dark:text-amber-400 mt-0.5 italic">Note: {med.changeReason}</p>}
                        </>
                      ) : (
                        <p className="text-slate-400 dark:text-gray-500 mt-1">Not recorded</p>
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

      {/* GDMT Checklist tab */}
      {activeTab === 'gdmt' && (
        <GDMTDashboard patient={patient} visits={visits} />
      )}

      {/* Timeline tab */}
      {activeTab === 'timeline' && (
        <VisitTimeline visits={visits} patientId={id} onDelete={handleDeleteVisit} />
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
              <CardHeader><CardTitle>Record Outcome Event</CardTitle></CardHeader>
              <CardBody>
                <form onSubmit={handleAddEventSubmit} className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FieldWrap label="Event Date" required>
                      <Input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} required />
                    </FieldWrap>
                    <FieldWrap label="Event Endpoint Type" required>
                      <Select value={eventType} onChange={e => setEventType(e.target.value as EventType)}>
                        {EVENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </Select>
                    </FieldWrap>
                    <FieldWrap label="Facility / Hospital">
                      <Input value={eventHosp} onChange={e => setEventHosp(e.target.value)} placeholder="e.g. AICTS Pune" />
                    </FieldWrap>
                    <FieldWrap label="Adjudicated By (Investigator)">
                      <Input value={eventAdjudicator} onChange={e => setEventAdjudicator(e.target.value)} placeholder="Dr. A. Jayachandra" />
                    </FieldWrap>
                    <FieldWrap label="Details / Description" className="md:col-span-2">
                      <Textarea value={eventDesc} onChange={e => setEventDesc(e.target.value)} placeholder="Clinical notes, clinical classification..." />
                    </FieldWrap>
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button type="submit" loading={savingEvent}>Save Endpoint</Button>
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
                    <th>Facility</th>
                    <th>Details</th>
                    <th>Adjudicated By</th>
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
                        <td className="font-mono text-white">{formatDate(ev.eventDate)}</td>
                        <td>
                          <span className={cn('badge text-[10px] font-bold',
                            ev.eventType.includes('death') ? 'badge-red' :
                            ev.eventType.includes('hospitalisation') ? 'badge-amber' : 'badge-blue'
                          )}>
                            {ev.eventType}
                          </span>
                        </td>
                        <td className="text-gray-300">{ev.hospitalName || '—'}</td>
                        <td className="text-gray-400 max-w-xs whitespace-normal">{ev.description || '—'}</td>
                        <td className="text-gray-300 font-semibold">{ev.adjudicatedBy || '—'}</td>
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
    </div>
  )
}
