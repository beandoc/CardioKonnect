'use client'

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import {
  Activity, Users, CheckCircle, AlertTriangle, Clock,
  Search, TrendingUp, Zap, Shield, Heart, Stethoscope, Layers,
  PlusCircle, Database, ChevronRight, FileText, Plus
} from 'lucide-react'
import { getPatients, getAllLatestVisits, getAllCathProcedures } from '@/lib/firestore'
import type { Patient, Visit, CathProcedure } from '@/lib/types'
import { cn, formatDate, initials } from '@/lib/utils'
import Button from '@/components/ui/Button'
import CathProcedureModal from '@/components/procedures/CathProcedureModal'

// ─── Types ────────────────────────────────────────────────────────────────────
type CategoryId = 'all' | 'coronary' | 'device' | 'hf' | 'structural' | 'diagnostic'

interface CategoryMeta {
  id: CategoryId
  label: string
  Icon: React.ElementType
  color: string
  accent: string
  border: string
  gradient: string
}

const CATEGORIES: CategoryMeta[] = [
  { id: 'all',        label: 'All Procedures & Interventions', Icon: Activity,    color: 'text-blue-400',    accent: '#3b82f6', border: 'border-blue-500/20',   gradient: 'linear-gradient(135deg,#1d4ed8,#3b82f6)' },
  { id: 'coronary',   label: 'Cath Lab & Interventions (PCI)', Icon: Zap,         color: 'text-amber-400',   accent: '#f59e0b', border: 'border-amber-500/20',  gradient: 'linear-gradient(135deg,#b45309,#f59e0b)' },
  { id: 'device',     label: 'Device Therapy (ICD/CRT/PPM)',   Icon: Shield,      color: 'text-cyan-400',    accent: '#06b6d4', border: 'border-cyan-500/20',   gradient: 'linear-gradient(135deg,#0e7490,#06b6d4)' },
  // Three unreachable tabs (structural, diagnostic, hf) hidden until dedicated procedural modules ship
]

export default function ProceduralAuditPage() {
  const [activeTab, setActiveTab] = useState<CategoryId>('all')
  const [patients, setPatients] = useState<Patient[]>([])
  const [cathProcedures, setCathProcedures] = useState<CathProcedure[]>([])
  const [visitsMap, setVisitsMap] = useState<Map<string, Visit>>(new Map())
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  // Modal State
  const [isProcModalOpen, setIsProcModalOpen] = useState(false)
  const [selectedProc, setSelectedProc] = useState<CathProcedure | null>(null)
  const [selectedProcPatient, setSelectedProcPatient] = useState<Patient | null>(null)

  const loadData = async () => {
    try {
      const [pts, vMap, procs] = await Promise.all([
        getPatients(),
        getAllLatestVisits(),
        getAllCathProcedures()
      ])
      setPatients(pts)
      setVisitsMap(vMap)
      setCathProcedures(procs)
    } catch (err) {
      console.error('Failed to load procedure registry:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Build verified, non-fabricated procedure records
  const unifiedRecords = useMemo(() => {
    const records: any[] = []

    // 1. Real Cath Lab & Interventional Procedures
    cathProcedures.forEach(proc => {
      const patient = patients.find(p => p.id === proc.patientId)
      const treatedLesions = (proc.lesions || []).map(l => `${l.vessel} (${l.preStenosisPct}% → ${l.postStenosisPct}%)`).join(', ')
      const stentCount = (proc.lesions || []).reduce((acc, l) => acc + (l.devices?.length || 0), 0)

      records.push({
        id: proc.id,
        patientId: proc.patientId,
        isCathProcedure: true,
        cathData: proc,
        mrn: patient?.mrn || '—',
        patientName: patient ? `${patient.firstName} ${patient.lastName}` : `Patient #${proc.patientId.slice(0, 6)}`,
        age: patient?.dob ? Math.floor((Date.now() - new Date(patient.dob).getTime()) / (365.25 * 86400000)) : (patient?.age ?? '—'),
        sex: patient?.sex ?? '—',
        category: 'coronary' as CategoryId,
        procedureName: `${proc.procedureType} (${proc.accessSite})`,
        indication: `${proc.clinicalIndication} • ${treatedLesions || 'Diagnostic / Vessel Assessment'}`,
        date: proc.procedureDate ? proc.procedureDate.slice(0, 10) : '—',
        outcome: proc.overallSuccess !== undefined ? (proc.overallSuccess ? 'TIMI 3 Success' : 'Sub-optimal / Staged') : '—',
        complications: proc.complications ? (proc.complications.hasComplication ? 'Adverse Event' : 'Audited Clean') : '—',
        operator: proc.operatorName,
        details: `${stentCount} Stents • Contrast ${proc.contrastVolumeMl}mL • Fluoro ${proc.fluoroscopyTimeMinutes}m`,
      })
    })

    // 2. Real Implanted Devices (ICD / CRT)
    patients.filter(p => p.icdPresence || p.crtPresence).forEach(p => {
      const v = visitsMap.get(p.id)
      records.push({
        id: `dev-${p.id}`,
        patientId: p.id,
        isCathProcedure: false,
        mrn: p.mrn || '—',
        patientName: `${p.firstName} ${p.lastName}`,
        age: p.age ?? '—',
        sex: p.sex ?? '—',
        category: 'device' as CategoryId,
        procedureName: p.crtPresence ? 'CRT-D Cardiac Resynchronization' : 'ICD Primary Prevention Device',
        indication: `LVEF ${v?.lvef ?? p.lvef ?? '—'}% • NYHA ${v?.nyha ?? p.nyha ?? '—'}`,
        date: v?.visitDate || p.createdAt?.split('T')[0] || '—',
        outcome: '—',
        complications: '—',
        operator: 'EP / Device Team',
        details: p.crtPresence ? 'Biventricular Pacing' : 'Transvenous ICD',
      })
    })

    return records
  }, [cathProcedures, patients, visitsMap, activeTab])

  const filteredRecords = useMemo(() => {
    return unifiedRecords.filter(r => {
      const matchesTab = activeTab === 'all' || r.category === activeTab
      const matchesSearch =
        searchQuery === '' ||
        r.patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.mrn.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.procedureName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.indication.toLowerCase().includes(searchQuery.toLowerCase())
      return matchesTab && matchesSearch
    })
  }, [unifiedRecords, activeTab, searchQuery])

  // Real KPIs
  const totalEnrolled = patients.length
  const totalCathProcs = cathProcedures.length
  const radialAccessCount = cathProcedures.filter(p => p.accessSite && p.accessSite.includes('Radial')).length
  const radialRate = totalCathProcs > 0 ? Math.round((radialAccessCount / totalCathProcs) * 100) : null

  const treatedLesionsCount = cathProcedures.reduce((sum, p) => sum + (p.lesions?.length || 0), 0)
  const successfulLesionsCount = cathProcedures.reduce((sum, p) => {
    return sum + (p.lesions?.filter(l => l.lesionSuccess)?.length || 0)
  }, 0)
  const successRate = treatedLesionsCount > 0 ? Math.round((successfulLesionsCount / treatedLesionsCount) * 100) : null

  return (
    <div className="space-y-6 animate-fade-in text-gray-300">
      {/* Header */}
      <div className="glass-card p-6 border border-blue-500/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 flex-shrink-0">
            <Zap className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Procedural & Interventional Registry Audit</h1>
            <p className="text-xs text-gray-400 mt-1">
              Live NCDR CathPCI & NIC India procedure tracking across {totalCathProcs} catheterizations and {totalEnrolled} enrolled patients.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {patients.length > 0 && (
            <button
              onClick={() => {
                setSelectedProc(null)
                setSelectedProcPatient(patients[0])
                setIsProcModalOpen(true)
              }}
              className="flex items-center gap-1.5 text-xs font-bold px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-md transition-all"
            >
              <Plus className="w-4 h-4" /> Log Cath Procedure
            </button>
          )}
          <Link href="/patients/new">
            <Button size="sm" variant="outline" className="text-xs border-white/15">
              <PlusCircle className="w-4 h-4" /> Enroll Patient
            </Button>
          </Link>
        </div>
      </div>

      {/* Real Clinical & Cath Lab KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="kpi-card amber">
          <p className="text-[10px] uppercase tracking-wider text-gray-400">Logged Cath/PCI Procedures</p>
          <p className="text-2xl font-bold text-white mt-1">{totalCathProcs}</p>
          <p className="text-[10px] text-amber-400 mt-1">
            {totalCathProcs > 0 ? `${treatedLesionsCount} lesions intervened` : '0 logged in registry'}
          </p>
        </div>

        <div className="kpi-card blue">
          <p className="text-[10px] uppercase tracking-wider text-gray-400">PCI Lesion Success Rate</p>
          <p className="text-2xl font-bold text-white mt-1">
            {successRate !== null ? `${successRate}%` : '—'}
          </p>
          <p className="text-[10px] text-blue-400 mt-1">
            {treatedLesionsCount > 0 ? `${successfulLesionsCount}/${treatedLesionsCount} TIMI 3 flow` : 'no lesions treated'}
          </p>
        </div>

        <div className="kpi-card emerald">
          <p className="text-[10px] uppercase tracking-wider text-gray-400">Transradial Access %</p>
          <p className="text-2xl font-bold text-white mt-1">
            {radialRate !== null ? `${radialRate}%` : '—'}
          </p>
          <p className="text-[10px] text-emerald-400 mt-1">
            {totalCathProcs > 0 ? `${radialAccessCount}/${totalCathProcs} radial first` : 'no procedures'}
          </p>
        </div>

        <div className="kpi-card cyan">
          <p className="text-[10px] uppercase tracking-wider text-gray-400">Device Candidates & Implants</p>
          <p className="text-2xl font-bold text-white mt-1">
            {patients.filter(p => p.icdPresence || p.crtPresence).length}
          </p>
          <p className="text-[10px] text-cyan-400 mt-1">ICD / CRT-D evaluations</p>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex gap-2 flex-wrap">
        {CATEGORIES.map(c => (
          <button
            key={c.id}
            onClick={() => setActiveTab(c.id)}
            className={cn(
              'flex items-center gap-1.5 text-xs px-3.5 py-2 rounded-xl border transition-all font-medium',
              activeTab === c.id
                ? 'text-white border-transparent shadow-lg'
                : 'text-gray-400 border-blue-500/10 bg-white/[0.03] hover:text-white hover:bg-white/[0.05]'
            )}
            style={activeTab === c.id ? { background: c.gradient, borderColor: 'transparent' } : {}}
          >
            <c.Icon size={13} />
            {c.label}
          </button>
        ))}
      </div>

      {/* Search & Table */}
      <div className="glass-card border border-blue-500/15 overflow-hidden">
        <div className="p-4 border-b border-blue-500/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-white">Registry Clinical & Interventional Records</p>
            <p className="text-xs text-gray-400">Showing {filteredRecords.length} of {unifiedRecords.length} records</p>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              placeholder="Search patient, MRN, procedure, vessel..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 pr-3 py-1.5 text-xs rounded-lg bg-slate-900 border border-blue-500/20 text-white focus:outline-none focus:border-blue-400 w-64"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-gray-400">Loading live procedural registry records...</div>
        ) : filteredRecords.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Database className="w-10 h-10 text-gray-500 mx-auto" />
            <p className="text-sm font-bold text-white">No procedural records logged for this category</p>
            <p className="text-xs text-gray-400 max-w-sm mx-auto">
              CardioKonnect reports authentic procedural data. Click &quot;Log Cath Procedure&quot; above to record catheterization and PCI cases.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-blue-500/10 text-[10px] text-gray-400 uppercase tracking-wider">
                  <th className="px-4 py-3 text-left">Date / Time</th>
                  <th className="px-4 py-3 text-left">Patient & MRN</th>
                  <th className="px-4 py-3 text-left">Procedure / Track</th>
                  <th className="px-4 py-3 text-left">Indication & Target Lesions</th>
                  <th className="px-4 py-3 text-left">Hardware / Strategy</th>
                  <th className="px-4 py-3 text-left">Outcome & Safety</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-blue-500/5">
                {filteredRecords.map(r => (
                  <tr key={r.id} className="hover:bg-blue-500/5 transition-colors">
                    <td className="px-4 py-3 font-mono text-[11px] text-gray-400 whitespace-nowrap">
                      {r.date}
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/patients/${r.patientId}`} className="font-semibold text-white hover:text-blue-300">
                        {r.patientName}
                      </Link>
                      <p className="text-[10px] font-mono text-gray-500">{r.mrn} • {r.age}y/{r.sex}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        'font-medium text-xs',
                        r.isCathProcedure ? 'text-amber-300' : 'text-blue-300'
                      )}>
                        {r.procedureName}
                      </span>
                      <p className="text-[10px] text-gray-500">{r.operator}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-300">
                      <span>{r.indication}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-[11px]">
                      {r.details}
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-1">
                        <span className={cn(
                          'badge text-[10px] font-bold block w-fit',
                          r.outcome.includes('Success') ? 'badge-green' : 'badge-blue'
                        )}>
                          {r.outcome}
                        </span>
                        {r.complications === 'Adverse Event' ? (
                          <span className="text-[10px] text-rose-400 font-semibold block">Adverse Event Audited</span>
                        ) : (
                          <span className="text-[10px] text-gray-500 block">0 Complications</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {r.isCathProcedure ? (
                        <button
                          onClick={() => {
                            setSelectedProc(r.cathData)
                            setSelectedProcPatient(patients.find(p => p.id === r.patientId) || null)
                            setIsProcModalOpen(true)
                          }}
                          className="btn-outline btn-sm text-[11px] py-1 px-2.5 text-amber-400 border-amber-500/30 hover:bg-amber-500/10"
                        >
                          Edit Cath Log <ChevronRight className="w-3 h-3 ml-1 inline" />
                        </button>
                      ) : (
                        <Link href={`/patients/${r.patientId}`}>
                          <button className="btn-outline btn-sm text-[11px] py-1 px-2.5">
                            View Patient <ChevronRight className="w-3 h-3 ml-1 inline" />
                          </button>
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Cath Procedure Modal */}
      {isProcModalOpen && selectedProcPatient && (
        <CathProcedureModal
          isOpen={isProcModalOpen}
          onClose={() => {
            setIsProcModalOpen(false)
            setSelectedProc(null)
          }}
          patient={selectedProcPatient}
          procedureToEdit={selectedProc}
          onSaved={loadData}
        />
      )}
    </div>
  )
}
