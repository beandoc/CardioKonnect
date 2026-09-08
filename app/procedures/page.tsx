'use client'
import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import {
  Activity, Users, CheckCircle, AlertTriangle, Clock,
  Search, TrendingUp, Zap, Shield, Heart, Stethoscope, Layers,
  PlusCircle, Database, ChevronRight, FileText
} from 'lucide-react'
import { getPatients, getAllLatestVisits } from '@/lib/firestore'
import type { Patient, Visit } from '@/lib/types'
import { cn, formatDate, initials } from '@/lib/utils'
import Button from '@/components/ui/Button'

// ─── Types ────────────────────────────────────────────────────────────────────
type CategoryId = 'all' | 'hf' | 'coronary' | 'ep' | 'device' | 'structural' | 'diagnostic'

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
  { id: 'hf',         label: 'Heart Failure & GDMT',           Icon: Heart,       color: 'text-rose-400',    accent: '#f43f5e', border: 'border-rose-500/20',   gradient: 'linear-gradient(135deg,#e11d48,#f43f5e)' },
  { id: 'coronary',   label: 'Coronary Interventions (PCI)',   Icon: Zap,         color: 'text-red-400',     accent: '#ef4444', border: 'border-red-500/20',    gradient: 'linear-gradient(135deg,#b91c1c,#ef4444)' },
  { id: 'device',     label: 'Device Therapy (ICD/CRT/PPM)',   Icon: Shield,      color: 'text-cyan-400',    accent: '#06b6d4', border: 'border-cyan-500/20',   gradient: 'linear-gradient(135deg,#0e7490,#06b6d4)' },
  { id: 'ep',         label: 'EP & Arrhythmia Ablation',       Icon: Activity,    color: 'text-violet-400',  accent: '#8b5cf6', border: 'border-violet-500/20', gradient: 'linear-gradient(135deg,#7c3aed,#a78bfa)' },
  { id: 'structural', label: 'Structural Heart (TAVI/BMV)',    Icon: Layers,      color: 'text-amber-400',   accent: '#f59e0b', border: 'border-amber-500/20',  gradient: 'linear-gradient(135deg,#b45309,#f59e0b)' },
  { id: 'diagnostic', label: 'Diagnostic Echo & Angio',        Icon: Stethoscope, color: 'text-emerald-400', accent: '#10b981', border: 'border-emerald-500/20', gradient: 'linear-gradient(135deg,#065f46,#10b981)' },
]

export default function ProceduralAuditPage() {
  const [activeTab, setActiveTab] = useState<CategoryId>('all')
  const [patients, setPatients] = useState<Patient[]>([])
  const [visitsMap, setVisitsMap] = useState<Map<string, Visit>>(new Map())
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const [pts, vMap] = await Promise.all([getPatients(), getAllLatestVisits()])
        setPatients(pts)
        setVisitsMap(vMap)
      } catch (err) {
        console.error('Failed to load procedure registry:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // Derived real clinical items from patient cohort
  const realProcedureRecords = useMemo(() => {
    return patients.map(p => {
      const v = visitsMap.get(p.id)
      const hasDevice = (p.icdPresence || p.crtPresence || (v?.device && v.device.length > 0))
      const hasPriorPCI = p.comorbidPriorPCI || p.comorbidCAD
      const isHFrEF = v?.hfType === 'HFrEF' || p.hfType === 'HFrEF'

      let category: CategoryId = 'hf'
      let procedureName = 'HF Clinical Assessment & Optimization'
      let indication = `HFrEF (LVEF ${v?.lvef ?? p.lvef ?? '—'}%), NYHA ${v?.nyha ?? p.nyha ?? 'II'}`

      if (hasDevice) {
        category = 'device'
        procedureName = p.crtPresence ? 'CRT-D Implantation & Optimization' : 'ICD Device Management'
        indication = 'Primary Prevention / HFrEF'
      } else if (hasPriorPCI) {
        category = 'coronary'
        procedureName = 'Coronary Revascularization / PCI Follow-up'
        indication = 'Ischemic Cardiomyopathy / CAD'
      }

      return {
        id: p.id,
        patientId: p.id,
        mrn: p.mrn || '—',
        patientName: `${p.firstName} ${p.lastName}`,
        age: p.age || 60,
        sex: p.sex || 'Male',
        category,
        procedureName,
        indication,
        date: v?.visitDate || p.createdAt?.split('T')[0] || '—',
        lvef: v?.lvef ?? p.lvef,
        nyha: v?.nyha ?? p.nyha,
        outcome: 'Active in Registry',
        gdmtPillars: ([
          v?.raasi?.prescribed === 'Yes' ? 'RAASi' : '',
          v?.betaBlocker?.prescribed === 'Yes' ? 'BB' : '',
          v?.mra?.prescribed === 'Yes' ? 'MRA' : '',
          v?.sglt2i?.prescribed === 'Yes' ? 'SGLT2i' : '',
        ] as string[]).filter(Boolean),
      }
    })
  }, [patients, visitsMap])

  const filteredRecords = useMemo(() => {
    return realProcedureRecords.filter(r => {
      const matchesTab = activeTab === 'all' || r.category === activeTab
      const matchesSearch =
        searchQuery === '' ||
        r.patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.mrn.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.procedureName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.indication.toLowerCase().includes(searchQuery.toLowerCase())
      return matchesTab && matchesSearch
    })
  }, [realProcedureRecords, activeTab, searchQuery])

  // Real KPI stats
  const totalEnrolled = patients.length
  const deviceCount = patients.filter(p => p.icdPresence || p.crtPresence).length
  const cadCount = patients.filter(p => p.comorbidCAD || p.comorbidPriorPCI || p.comorbidPriorCABG).length
  const hfCount = patients.filter(p => p.registryId === 'hf' || p.hfType === 'HFrEF').length

  return (
    <div className="space-y-6 animate-fade-in text-gray-300">
      {/* Header */}
      <div className="glass-card p-6 border border-blue-500/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-600/15 border border-blue-500/30 flex items-center justify-center text-blue-400 flex-shrink-0">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Procedural & Interventional Audit</h1>
            <p className="text-xs text-gray-400 mt-1">
              Live registry tracking: {totalEnrolled} verified patients across clinical, device, and revascularization pathways.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/patients/new">
            <Button size="sm" className="btn-primary">
              <PlusCircle className="w-4 h-4" /> Add Patient
            </Button>
          </Link>
        </div>
      </div>

      {/* Real Clinical KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="kpi-card blue">
          <p className="text-[10px] uppercase tracking-wider text-gray-400">Total Enrolled Cohort</p>
          <p className="text-2xl font-bold text-white mt-1">{totalEnrolled}</p>
          <p className="text-[10px] text-blue-400 mt-1">Verified patient records</p>
        </div>
        <div className="kpi-card rose">
          <p className="text-[10px] uppercase tracking-wider text-gray-400">Heart Failure Track</p>
          <p className="text-2xl font-bold text-white mt-1">{hfCount}</p>
          <p className="text-[10px] text-rose-400 mt-1">HFrEF / GDMT optimization</p>
        </div>
        <div className="kpi-card cyan">
          <p className="text-[10px] uppercase tracking-wider text-gray-400">Device Candidates</p>
          <p className="text-2xl font-bold text-white mt-1">{deviceCount}</p>
          <p className="text-[10px] text-cyan-400 mt-1">ICD / CRT-D evaluations</p>
        </div>
        <div className="kpi-card amber">
          <p className="text-[10px] uppercase tracking-wider text-gray-400">CAD / Prior PCI</p>
          <p className="text-2xl font-bold text-white mt-1">{cadCount}</p>
          <p className="text-[10px] text-amber-400 mt-1">Ischemic etiology</p>
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
            <p className="text-xs text-gray-400">Showing {filteredRecords.length} of {realProcedureRecords.length} records</p>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              placeholder="Search patient, MRN, procedure..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 pr-3 py-1.5 text-xs rounded-lg bg-slate-900 border border-blue-500/20 text-white focus:outline-none focus:border-blue-400 w-64"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-gray-400">Loading live registry records...</div>
        ) : filteredRecords.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Database className="w-10 h-10 text-gray-500 mx-auto" />
            <p className="text-sm font-bold text-white">No records found for this category</p>
            <p className="text-xs text-gray-400 max-w-sm mx-auto">
              You have {totalEnrolled} active patients in your registry. Record interventional procedures on individual patient profiles.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-blue-500/10 text-[10px] text-gray-400 uppercase tracking-wider">
                  <th className="px-4 py-3 text-left">Patient & HID</th>
                  <th className="px-4 py-3 text-left">Age / Sex</th>
                  <th className="px-4 py-3 text-left">Procedure / Management Track</th>
                  <th className="px-4 py-3 text-left">Indication / Echo</th>
                  <th className="px-4 py-3 text-left">4-Pillar GDMT</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-blue-500/5">
                {filteredRecords.map(r => (
                  <tr key={r.id} className="hover:bg-blue-500/5 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/patients/${r.patientId}`} className="font-semibold text-white hover:text-blue-300">
                        {r.patientName}
                      </Link>
                      <p className="text-[10px] font-mono text-gray-500">{r.mrn}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-300">
                      {r.age} yrs / {r.sex}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-blue-300">{r.procedureName}</span>
                      <p className="text-[10px] text-gray-500">Date: {r.date}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-300">
                      <span>{r.indication}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 flex-wrap">
                        {r.gdmtPillars.map(p => (
                          <span key={p} className="badge badge-green text-[9px] font-bold">
                            {p}
                          </span>
                        ))}
                        {r.gdmtPillars.length === 0 && (
                          <span className="text-[10px] text-gray-500">Pending GDMT</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="badge badge-blue text-[10px] font-bold">
                        {r.outcome}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/patients/${r.patientId}`}>
                        <button className="btn-outline btn-sm text-[11px] py-1 px-2.5">
                          View Patient <ChevronRight className="w-3 h-3 ml-1 inline" />
                        </button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
