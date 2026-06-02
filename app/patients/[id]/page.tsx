'use client'
import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  getPatient, getVisits, deleteVisit, updatePatient,
} from '@/lib/firestore'
import { getPatientTrends } from '@/lib/firestore'
import type { Patient, Visit } from '@/lib/types'
import { getAge, formatDate, nyhaBadgeColor, hfTypeBadgeColor, lvefColor, initials, cn } from '@/lib/utils'
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import VisitTimeline from '@/components/patients/VisitTimeline'
import MetricTrendChart from '@/components/charts/MetricTrendChart'
import PatientForm from '@/components/forms/PatientForm'
import type { PatientTrends } from '@/lib/types'
import { toast } from 'sonner'
import { PlusCircle, Edit2, X, Activity } from 'lucide-react'

export default function PatientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const searchParams = useSearchParams()
  const tabParam = searchParams.get('tab')
  const [patient, setPatient] = useState<Patient | null>(null)
  const [visits, setVisits] = useState<Visit[]>([])
  const [trends, setTrends] = useState<PatientTrends | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'timeline' | 'trends'>('overview')

  useEffect(() => {
    if (tabParam === 'overview' || tabParam === 'timeline' || tabParam === 'trends') {
      setActiveTab(tabParam)
    }
  }, [tabParam])

  const load = useCallback(async () => {
    let p = await getPatient(id)
    let v = await getVisits(id)
    let t = await getPatientTrends(id)

    // Fallback Mock data for demo patients
    if (!p) {
      const mockDb: Record<string, Patient> = {
        '1': { id: '1', firstName: 'Arjun', lastName: 'Talpade', dob: '1978-05-19', sex: 'Male', mrn: 'MRN-784019', contact: '+91 9823019283', address: 'Kothrud, Pune, Maharashtra', comorbidities: 'HTN, Type 2 Diabetes', allergies: 'Penicillin', createdAt: '2026-05-19T10:00:00Z', updatedAt: '2026-05-19T10:00:00Z' },
        '2': { id: '2', firstName: 'Sunita', lastName: 'Deshmukh', dob: '1982-11-20', sex: 'Female', mrn: 'MRN-201948', contact: '+91 9123049182', address: 'Shivajinagar, Pune, Maharashtra', comorbidities: 'Dyslipidemia', allergies: 'None', createdAt: '2026-05-20T10:00:00Z', updatedAt: '2026-05-20T10:00:00Z' },
        '3': { id: '3', firstName: 'Ramesh', lastName: 'Kulkarni', dob: '1965-03-22', sex: 'Male', mrn: 'MRN-849102', contact: '+91 9422019283', address: 'Deccan Gymkhana, Pune, Maharashtra', comorbidities: 'CAD, Prior CABG', allergies: 'Aspirin (Mild GI)', createdAt: '2026-05-22T10:00:00Z', updatedAt: '2026-05-22T10:00:00Z' },
        '4': { id: '4', firstName: 'Priya', lastName: 'Sharma', dob: '1990-07-23', sex: 'Female', mrn: 'MRN-102948', contact: '+91 9011029481', address: 'Aundh, Pune, Maharashtra', comorbidities: 'None', allergies: 'Sulfa drugs', createdAt: '2026-05-23T10:00:00Z', updatedAt: '2026-05-23T10:00:00Z' },
        '5': { id: '5', firstName: 'Vijay', lastName: 'Mallya', dob: '1955-12-18', sex: 'Male', mrn: 'MRN-998822', contact: '+91 9890123456', address: 'Cuffe Parade, Mumbai, Maharashtra', comorbidities: 'Gout, HTN', allergies: 'None', createdAt: '2026-05-24T10:00:00Z', updatedAt: '2026-05-24T10:00:00Z' },
        '6': { id: '6', firstName: 'Ananya', lastName: 'Rao', dob: '1995-04-26', sex: 'Female', mrn: 'MRN-334455', contact: '+91 9881122334', address: 'Viman Nagar, Pune, Maharashtra', comorbidities: 'Asthma', allergies: 'None', createdAt: '2026-05-26T10:00:00Z', updatedAt: '2026-05-26T10:00:00Z' },
        '7': { id: '7', firstName: 'Amitabh', lastName: 'Bachchan', dob: '1942-10-11', sex: 'Male', mrn: 'MRN-000777', contact: '+91 9820098200', address: 'Juhu, Mumbai, Maharashtra', comorbidities: 'COPD, Prior Angioplasty', allergies: 'None', createdAt: '2026-05-28T10:00:00Z', updatedAt: '2026-05-28T10:00:00Z' },
        '8': { id: '8', firstName: 'Sanjay', lastName: 'More', dob: '1980-08-15', sex: 'Male', mrn: 'MRN-554432', contact: '+91 9869234857', address: 'Dadar, Mumbai, Maharashtra', comorbidities: 'CAD, STEMI post-PCI', allergies: 'None', createdAt: '2026-06-01T10:00:00Z', updatedAt: '2026-06-01T10:00:00Z' },
        '9': { id: '9', firstName: 'Lata', lastName: 'Patwardhan', dob: '1972-02-14', sex: 'Female', mrn: 'MRN-887766', contact: '+91 9371029485', address: 'Dhantoli, Nagpur, Maharashtra', comorbidities: 'HFrEF, Chronic Kidney Disease', allergies: 'Contrast (Mild)', createdAt: '2026-06-02T10:00:00Z', updatedAt: '2026-06-02T10:00:00Z' }
      }
      p = mockDb[id] || null
      if (p) {
        // Mock visit data to make profile complete
        const emptyMed = { prescribed: '' as const }
        const mockVisits: Visit[] = [
          {
            id: `v-${id}`,
            patientId: id,
            createdAt: '2026-06-02T10:00:00Z',
            visitDate: '2026-06-02',
            visitType: 'OPD',
            weight: 72,
            height: 170,
            bpSystolic: 128,
            bpDiastolic: 82,
            heartRate: 74,
            nyha: 'II',
            rhythm: 'Sinus',
            lvef: 35,
            ntProBNP: 1800,
            egfr: 58,
            potassium: 4.2,
            diuretic: { prescribed: 'Yes', type: 'Furosemide', dose: '40mg OD' },
            raasi: { prescribed: 'Yes', type: 'Sacubitril/Valsartan', dose: '50mg BD' },
            betaBlocker: { prescribed: 'Yes', type: 'Carvedilol', dose: '6.25mg BD' },
            mra: { prescribed: 'Yes', type: 'Spironolactone', dose: '25mg OD' },
            sglt2i: { prescribed: 'Yes', type: 'Dapagliflozin', dose: '10mg OD' },
            ivabradine: emptyMed, digoxin: emptyMed, ivIron: emptyMed,
            aspirin: { prescribed: 'Yes', dose: '75mg OD' },
            statin: { prescribed: 'Yes', type: 'Atorvastatin', dose: '40mg OD' },
            fibrate: { prescribed: '' }, pcsk9: { prescribed: '' },
            noac: { prescribed: '' }, vki: { prescribed: '' }
          }
        ]
        v = mockVisits
        t = {
          lvef: [{ date: '2026-06-02', value: 35, visitId: `v-${id}` }],
          ntProBNP: [{ date: '2026-06-02', value: 1800, visitId: `v-${id}` }],
          nyha: [{ date: '2026-06-02', value: 2, visitId: `v-${id}` }],
          egfr: [{ date: '2026-06-02', value: 58, visitId: `v-${id}` }],
          weight: [{ date: '2026-06-02', value: 72, visitId: `v-${id}` }],
          bpSystolic: [{ date: '2026-06-02', value: 128, visitId: `v-${id}` }],
          heartRate: [{ date: '2026-06-02', value: 74, visitId: `v-${id}` }],
          sixMWT: [{ date: '2026-06-02', value: 380, visitId: `v-${id}` }],
        }
      }
    }

    setPatient(p)
    setVisits(v)
    setTrends(t)
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
    try {
      await updatePatient(id, data)
      toast.success('Patient updated')
      setEditing(false)
      load()
    } catch { toast.error('Update failed') }
    finally { setSaving(false) }
  }

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

  return (
    <div className="space-y-6 text-gray-300">
      {/* Patient header */}
      <div className="accent-card p-6 flex flex-col md:flex-row items-center md:items-start justify-between gap-6">
        <div className="flex flex-col md:flex-row items-center gap-5 text-center md:text-left">
          <div className="w-16 h-16 rounded-2xl bg-blue-600/10 border border-blue-500/20 text-blue-400 text-2xl font-bold flex items-center justify-center flex-shrink-0">
            {initials(patient.firstName, patient.lastName)}
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white mb-1">
              {patient.firstName} {patient.lastName}
            </h2>
            <p className="text-xs text-gray-400">
              {patient.mrn} &bull; {age ? `${age} years` : '—'} &bull; {patient.sex} &bull; DOB: {formatDate(patient.dob)}
            </p>
            <p className="text-[10px] text-gray-500 mt-1 uppercase tracking-wider font-semibold">
              Region: Maharashtra, India
            </p>
            <div className="flex gap-2 mt-3 flex-wrap justify-center md:justify-start">
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
        <div className="flex gap-2">
          <Link href={`/patients/${id}/visits/new`}>
            <Button size="sm"><PlusCircle className="w-4 h-4" /> Record Visit</Button>
          </Link>
          <Button variant="outline" size="sm" onClick={() => setEditing(e => !e)}>
            {editing ? <><X className="w-4 h-4" /> Cancel</> : <><Edit2 className="w-4 h-4" /> Edit Profile</>}
          </Button>
        </div>
      </div>

      {/* Edit patient form */}
      {editing && (
        <Card className="mb-5">
          <CardHeader>
            <CardTitle>Edit Patient Demographics</CardTitle>
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
      {latest && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          {[
            { label: 'NT-proBNP', value: latest.ntProBNP, unit: 'pg/mL', warn: (v: number) => v > 2000 },
            { label: 'eGFR', value: latest.egfr, unit: 'ml/min', warn: (v: number) => v < 45 },
            { label: 'BP', value: latest.bpSystolic && latest.bpDiastolic ? `${latest.bpSystolic}/${latest.bpDiastolic}` : null, unit: 'mmHg', warn: (_v: number) => false },
            { label: 'HR', value: latest.heartRate, unit: 'bpm', warn: (_v: number) => false },
            { label: '6MWT', value: latest.sixMWT, unit: 'm', warn: (_v: number) => false },
            { label: 'Potassium', value: latest.potassium, unit: 'mmol/L', warn: (v: number) => v > 5.5 || v < 3.5 },
          ].map(m => (
            <div key={m.label} className="glass-card p-4 text-center hover:border-blue-500/30 transition-all">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-1">{m.label}</p>
              {m.value != null
                ? <p className={cn('text-xl font-extrabold', m.warn(Number(m.value)) ? 'text-rose-400' : 'text-white')}>
                    {m.value}
                  </p>
                : <p className="text-gray-600 text-xl font-bold">—</p>}
              <p className="text-[10px] text-gray-500 mt-0.5">{m.unit}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-5">
        {(['overview', 'timeline', 'trends'] as const).map(t => (
          <button
            key={t}
            className={cn('tab-btn capitalize', activeTab === t && 'active')}
            onClick={() => setActiveTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Overview tab */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Card>
            <CardHeader><CardTitle>Demographics</CardTitle></CardHeader>
            <CardBody className="space-y-2 text-sm">
              {[
                ['Full Name', `${patient.firstName} ${patient.lastName}`],
                ['HID', patient.mrn ?? '—'],
                ['Date of Birth', formatDate(patient.dob)],
                ['Age', age ? `${age} years` : '—'],
                ['Sex', patient.sex],
                ['Contact', patient.contact ?? '—'],
                ['Email', patient.email ?? '—'],
                ['Comorbidities', patient.comorbidities ?? '—'],
                ['Allergies', patient.allergies ?? '—'],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between py-1 border-b border-gray-50">
                  <span className="text-gray-500">{k}</span>
                  <span className="font-medium text-gray-700 text-right max-w-[55%]">{v}</span>
                </div>
              ))}
            </CardBody>
          </Card>

          {latest && (
            <Card>
              <CardHeader><CardTitle>Latest Clinical Data <span className="text-xs font-normal text-gray-400 ml-2">{formatDate(latest.visitDate)}</span></CardTitle></CardHeader>
              <CardBody className="space-y-2 text-sm">
                {[
                  ['HF Type', latest.hfType ?? '—'],
                  ['NYHA Class', latest.nyha ? `Class ${latest.nyha}` : '—'],
                  ['Rhythm', latest.rhythm ?? '—'],
                  ['LVEF', latest.lvef != null ? `${latest.lvef}%` : '—'],
                  ['Etiology', (latest.etiology ?? []).join(', ') || '—'],
                  ['NT-proBNP', latest.ntProBNP != null ? `${latest.ntProBNP} pg/mL` : '—'],
                  ['eGFR', latest.egfr != null ? `${latest.egfr} ml/min/1.73m²` : '—'],
                  ['Potassium', latest.potassium != null ? `${latest.potassium} mmol/L` : '—'],
                  ['TSH', latest.tft != null ? `${latest.tft} mIU/L` : '—'],
                  ['Next Follow-up', formatDate(latest.followupDate)],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between py-1 border-b border-gray-50">
                    <span className="text-gray-500">{k}</span>
                    <span className="font-medium text-gray-700 text-right max-w-[55%]">{v}</span>
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
                      'p-3 rounded-lg border text-xs',
                      med?.prescribed === 'Yes' ? 'bg-green-50 border-green-200' :
                      med?.prescribed === 'No' ? 'bg-gray-50 border-gray-200' : 'bg-gray-50 border-gray-100'
                    )}>
                      <p className="font-semibold text-gray-700">{label}</p>
                      {med?.prescribed === 'Yes' ? (
                        <>
                          {med.type && <p className="text-gray-600 mt-0.5">{med.type}</p>}
                          {med.dose && <p className="font-semibold text-green-700">{med.dose}</p>}
                        </>
                      ) : med?.prescribed === 'No' ? (
                        <p className="text-gray-400">Not prescribed</p>
                      ) : (
                        <p className="text-gray-300">Not recorded</p>
                      )}
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>
          )}
        </div>
      )}

      {/* Timeline tab */}
      {activeTab === 'timeline' && (
        <VisitTimeline visits={visits} patientId={id} onDelete={handleDeleteVisit} />
      )}

      {/* Trends tab */}
      {activeTab === 'trends' && trends && (
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
        </div>
      )}
    </div>
  )
}
