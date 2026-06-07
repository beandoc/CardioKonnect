'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import {
  Users, Heart, Activity, AlertTriangle, AlertOctagon,
  CheckCircle, Zap, Shield, Search, Sliders, ArrowRight,
  Info, Bell, FileText, ChevronRight, HelpCircle, Pill, ShieldAlert
} from 'lucide-react'
import { getPatients, getVisits } from '@/lib/firestore'
import type { Patient, Visit } from '@/lib/types'
import {
  computeMLRiskProfile,
  evaluateGDMT,
  generateClinicalAlerts,
  scoreDataCompleteness
} from '@/lib/clinicalIntelligence'
import { getAge, initials } from '@/lib/utils'

interface TriagePatientRow {
  patient: Patient
  latestVisit: Visit | null
  allVisits: Visit[]
  riskScore: number
  riskCategory: 'Low' | 'Intermediate' | 'High' | 'Very High'
  primaryDriver: string
  dataCompletenessPct: number
  dataGrade: 'A' | 'B' | 'C' | 'D'
  missingDataPoints: string[]
  suggestedAction: string
  actionCategory: 'Safety' | 'Device' | 'Medication' | 'Optimal'
  criticalAlertCount: number
}

export default function TriagePage() {
  const [rows, setRows] = useState<TriagePatientRow[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [riskFilter, setRiskFilter] = useState<string>('All')
  const [gradeFilter, setGradeFilter] = useState<string>('All')
  const [actionFilter, setActionFilter] = useState<string>('All')
  const [sortBy, setSortBy] = useState<'risk' | 'completeness' | 'age' | 'name'>('risk')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [hoveredGradePatientId, setHoveredGradePatientId] = useState<string | null>(null)

  useEffect(() => {
    async function loadCohortData() {
      setLoading(true)
      try {
        const patients = await getPatients()
        const processedRows = await Promise.all(
          patients.map(async (patient) => {
            const allVisits = await getVisits(patient.id)
            const latestVisit = allVisits.length > 0 ? allVisits[0] : null

            if (!latestVisit) {
              return {
                patient,
                latestVisit: null,
                allVisits: [],
                riskScore: 0.0,
                riskCategory: 'Low' as const,
                primaryDriver: 'No visits recorded',
                dataCompletenessPct: 0,
                dataGrade: 'D' as const,
                missingDataPoints: ['Baseline Visit', 'Echocardiography', 'Basic Labs'],
                suggestedAction: 'Schedule baseline clinic visit and diagnostic workup',
                actionCategory: 'Safety' as const,
                criticalAlertCount: 0
              }
            }

            // Run Clinical Intelligence Computations
            const risk = computeMLRiskProfile(patient, latestVisit, allVisits)
            const gdmt = evaluateGDMT(patient, latestVisit)
            const alerts = generateClinicalAlerts(patient, latestVisit, allVisits)
            const completeness = scoreDataCompleteness(latestVisit)

            // Gather missing fields from all completeness domains
            const missingDataPoints: string[] = []
            completeness.domains.forEach(d => {
              d.missing.forEach(m => {
                if (missingDataPoints.length < 8) {
                  missingDataPoints.push(m)
                }
              })
            })

            // Determine primary clinical alert/action priority
            let suggestedAction = 'Patient on optimal GDMT — maintain current regimen'
            let actionCategory: 'Safety' | 'Device' | 'Medication' | 'Optimal' = 'Optimal'

            const criticalAlert = alerts.find(a => a.severity === 'critical')
            const highAlert = alerts.find(a => a.severity === 'high')
            const deviceAlert = alerts.find(a => a.category === 'Device')

            if (criticalAlert) {
              suggestedAction = `${criticalAlert.title}: ${criticalAlert.action || criticalAlert.detail}`
              actionCategory = 'Safety'
            } else if (highAlert) {
              suggestedAction = `${highAlert.title}: ${highAlert.action || highAlert.detail}`
              actionCategory = 'Safety'
            } else if (deviceAlert) {
              suggestedAction = `${deviceAlert.title}: ${deviceAlert.action || deviceAlert.detail}`
              actionCategory = 'Device'
            } else {
              const missingPillar = gdmt.pillars.find(p => p.status === 'missing')
              const belowTargetPillar = gdmt.pillars.find(p => p.status === 'below-target')

              if (missingPillar) {
                suggestedAction = `Initiate ${missingPillar.drug} (${missingPillar.evidence})`
                actionCategory = 'Medication'
              } else if (belowTargetPillar) {
                suggestedAction = `Uptitrate ${belowTargetPillar.drug} to target dose`
                actionCategory = 'Medication'
              }
            }

            const criticalAlertCount = alerts.filter(a => a.severity === 'critical' || a.severity === 'high').length

            return {
              patient,
              latestVisit,
              allVisits,
              riskScore: risk.oneYearEventProbability,
              riskCategory: risk.riskCategory,
              primaryDriver: risk.primaryDriver,
              dataCompletenessPct: completeness.overallPct,
              dataGrade: completeness.dataGrade,
              missingDataPoints,
              suggestedAction,
              actionCategory,
              criticalAlertCount
            }
          })
        )

        setRows(processedRows)
      } catch (err) {
        console.error('Failed to load cohort data for triage:', err)
      } finally {
        setLoading(false)
      }
    }

    loadCohortData()
  }, [])

  // Filtering Logic
  const filteredRows = useMemo(() => {
    return rows.filter(row => {
      // 1. Search Query
      const fullName = `${row.patient.firstName} ${row.patient.lastName}`.toLowerCase()
      const mrn = (row.patient.mrn || row.patient.id).toLowerCase()
      const matchesSearch = fullName.includes(searchQuery.toLowerCase()) || mrn.includes(searchQuery.toLowerCase())

      // 2. Risk Filter
      const matchesRisk = riskFilter === 'All' || row.riskCategory === riskFilter

      // 3. Care Grade Filter
      const matchesGrade = gradeFilter === 'All' || row.dataGrade === gradeFilter

      // 4. Action Filter
      const matchesAction = actionFilter === 'All' || row.actionCategory === actionFilter

      return matchesSearch && matchesRisk && matchesGrade && matchesAction
    })
  }, [rows, searchQuery, riskFilter, gradeFilter, actionFilter])

  // Sorting Logic
  const sortedRows = useMemo(() => {
    return [...filteredRows].sort((a, b) => {
      let comparison = 0

      if (sortBy === 'risk') {
        comparison = a.riskScore - b.riskScore
      } else if (sortBy === 'completeness') {
        comparison = a.dataCompletenessPct - b.dataCompletenessPct
      } else if (sortBy === 'age') {
        const ageA = getAge(a.patient.dob) || 0
        const ageB = getAge(b.patient.dob) || 0
        comparison = ageA - ageB
      } else if (sortBy === 'name') {
        const nameA = `${a.patient.firstName} ${a.patient.lastName}`.toLowerCase()
        const nameB = `${b.patient.firstName} ${b.patient.lastName}`.toLowerCase()
        comparison = nameA.localeCompare(nameB)
      }

      return sortOrder === 'desc' ? -comparison : comparison
    })
  }, [filteredRows, sortBy, sortOrder])

  // Cohort KPI computations
  const kpiStats = useMemo(() => {
    const total = rows.length
    if (total === 0) {
      return { total: 0, highRisk: 0, activeAlerts: 0, medGaps: 0, avgCompleteness: 0 }
    }

    const highRisk = rows.filter(r => r.riskCategory === 'High' || r.riskCategory === 'Very High').length
    const activeAlerts = rows.filter(r => r.criticalAlertCount > 0).length
    const medGaps = rows.filter(r => r.actionCategory === 'Medication').length
    const sumCompleteness = rows.reduce((acc, r) => acc + r.dataCompletenessPct, 0)
    const avgCompleteness = Math.round(sumCompleteness / total)

    return { total, highRisk, activeAlerts, medGaps, avgCompleteness }
  }, [rows])

  const toggleSort = (field: 'risk' | 'completeness' | 'age' | 'name') => {
    if (sortBy === field) {
      setSortOrder(prev => (prev === 'desc' ? 'asc' : 'desc'))
    } else {
      setSortBy(field)
      setSortOrder('desc')
    }
  }

  const getRiskColor = (prob: number) => {
    if (prob < 0.08) return '#10b981' // low -> green
    if (prob < 0.20) return '#f59e0b' // intermediate -> orange/amber
    if (prob < 0.40) return '#ef4444' // high -> red
    return '#ec4899' // very high -> pink/neon red
  }

  const getGradeBadgeStyle = (grade: 'A' | 'B' | 'C' | 'D') => {
    switch (grade) {
      case 'A': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[0_0_8px_rgba(16,185,129,0.15)]'
      case 'B': return 'bg-blue-500/10 text-blue-400 border-blue-500/20'
      case 'C': return 'bg-amber-500/10 text-amber-400 border-amber-500/20'
      case 'D': return 'bg-rose-500/10 text-rose-400 border-rose-500/20 shadow-[0_0_8px_rgba(244,63,94,0.15)]'
    }
  }

  const getActionIcon = (category: 'Safety' | 'Device' | 'Medication' | 'Optimal') => {
    switch (category) {
      case 'Safety': return <AlertOctagon className="w-4 h-4 text-red-400" />
      case 'Device': return <Shield className="w-4 h-4 text-purple-400" />
      case 'Medication': return <Pill className="w-4 h-4 text-amber-400" />
      case 'Optimal': return <CheckCircle className="w-4 h-4 text-emerald-400" />
    }
  }

  return (
    <div className="space-y-6 animate-fade-in relative pb-12">
      {/* ── Page Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">Live Cohort Triage</span>
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            AI-Driven Patient Triage
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Predictive 12-month decompensation risks and clinical safety alerts for prompt outpatient review.
          </p>
        </div>

        {/* Reset Filter Button */}
        <button
          onClick={() => {
            setSearchQuery('')
            setRiskFilter('All')
            setGradeFilter('All')
            setActionFilter('All')
            setSortBy('risk')
            setSortOrder('desc')
          }}
          className="btn-outline btn-sm self-start md:self-auto flex items-center gap-1.5"
        >
          Reset Filters
        </button>
      </div>

      {/* ── KPI Grid ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* KPI 1 */}
        <div className="glass-card p-4 flex items-center gap-4 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-16 h-16 rounded-full bg-blue-500/5 blur-xl group-hover:scale-150 transition-transform duration-500" />
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 flex-shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Triage Cohort</p>
            <p className="text-2xl font-bold text-white mt-0.5">{loading ? '—' : kpiStats.total}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Total patients registered</p>
          </div>
        </div>

        {/* KPI 2 */}
        <div className="glass-card p-4 flex items-center gap-4 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-16 h-16 rounded-full bg-pink-500/5 blur-xl group-hover:scale-150 transition-transform duration-500" />
          <div className="w-10 h-10 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400 flex-shrink-0">
            <Heart className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">High Risk Candidates</p>
            <p className="text-2xl font-bold text-pink-400 mt-0.5">{loading ? '—' : kpiStats.highRisk}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Risk Score &gt; 20% (MAGGIC+RF)</p>
          </div>
        </div>

        {/* KPI 3 */}
        <div className="glass-card p-4 flex items-center gap-4 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-16 h-16 rounded-full bg-rose-500/5 blur-xl group-hover:scale-150 transition-transform duration-500" />
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 flex-shrink-0">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Safety Warnings</p>
            <p className="text-2xl font-bold text-rose-400 mt-0.5">{loading ? '—' : kpiStats.activeAlerts}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Critical safety adjustments needed</p>
          </div>
        </div>

        {/* KPI 4 */}
        <div className="glass-card p-4 flex items-center gap-4 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-16 h-16 rounded-full bg-amber-500/5 blur-xl group-hover:scale-150 transition-transform duration-500" />
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 flex-shrink-0">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">GDMT Optimization Gaps</p>
            <p className="text-2xl font-bold text-amber-400 mt-0.5">{loading ? '—' : kpiStats.medGaps}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Patients missing pillars</p>
          </div>
        </div>

        {/* KPI 5 */}
        <div className="glass-card p-4 flex items-center gap-4 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-16 h-16 rounded-full bg-emerald-500/5 blur-xl group-hover:scale-150 transition-transform duration-500" />
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 flex-shrink-0">
            <CheckCircle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Cohort Data Trust</p>
            <p className="text-2xl font-bold text-emerald-400 mt-0.5">{loading ? '—' : `${kpiStats.avgCompleteness}%`}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Average data completeness</p>
          </div>
        </div>
      </div>

      {/* ── Filters and Controls Panel ── */}
      <div className="glass-card p-5 space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-blue-500/10">
          <Sliders className="w-4 h-4 text-blue-400" />
          <h3 className="text-sm font-semibold text-white">Cohort Search & Multi-Filters</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search Box */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search by name or Hospital ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input w-full pl-9 pr-4 py-2 text-sm bg-slate-900/60 border border-blue-500/15 focus:border-blue-500/35 focus:ring-1 focus:ring-blue-500/20 rounded-xl text-white outline-none"
            />
          </div>

          {/* Risk Filter */}
          <div>
            <select
              value={riskFilter}
              onChange={(e) => setRiskFilter(e.target.value)}
              className="w-full bg-slate-900/60 border border-blue-500/15 focus:border-blue-500/35 rounded-xl px-3 py-2 text-sm text-slate-300 outline-none cursor-pointer"
            >
              <option value="All">All Risk Categories</option>
              <option value="Very High">Very High Risk (&ge;40%)</option>
              <option value="High">High Risk (20–40%)</option>
              <option value="Intermediate">Intermediate Risk (8–20%)</option>
              <option value="Low">Low Risk (&lt;8%)</option>
            </select>
          </div>

          {/* Care Grade Filter */}
          <div>
            <select
              value={gradeFilter}
              onChange={(e) => setGradeFilter(e.target.value)}
              className="w-full bg-slate-900/60 border border-blue-500/15 focus:border-blue-500/35 rounded-xl px-3 py-2 text-sm text-slate-300 outline-none cursor-pointer"
            >
              <option value="All">All Data Grades</option>
              <option value="A">Grade A (Complete trust &ge;80%)</option>
              <option value="B">Grade B (Medium trust 60-80%)</option>
              <option value="C">Grade C (Low trust 40-60%)</option>
              <option value="D">Grade D (Incomplete &lt;40%)</option>
            </select>
          </div>

          {/* Suggested Action Category Filter */}
          <div>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="w-full bg-slate-900/60 border border-blue-500/15 focus:border-blue-500/35 rounded-xl px-3 py-2 text-sm text-slate-300 outline-none cursor-pointer"
            >
              <option value="All">All Suggested Actions</option>
              <option value="Safety">Safety Interventions First</option>
              <option value="Device">Device Suitability Assessments</option>
              <option value="Medication">GDMT Optimization Opportunities</option>
              <option value="Optimal">Optimal/Maintained Regimens</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── Main Triage Worklist ── */}
      <div className="glass-card p-0 overflow-hidden relative border border-blue-500/10">
        <div className="flex items-center justify-between px-5 py-4 bg-slate-900/40 border-b border-blue-500/10">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-400 animate-pulse" />
            <h3 className="text-sm font-semibold text-white">Prioritized Cohort Worklist</h3>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/25">
            Showing {sortedRows.length} of {rows.length} patients
          </span>
        </div>

        {loading ? (
          <div className="p-8 space-y-4">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="shimmer h-16 rounded-xl" />
            ))}
          </div>
        ) : sortedRows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-4">
            <AlertTriangle className="w-12 h-12 mb-3 text-amber-500/40 animate-pulse" />
            <p className="text-base font-bold text-white">No Matching Patients Found</p>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
              No registered patients match your selected query and filter combination. Modify your search term or selection parameters.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="registry-table w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-blue-500/10 text-[11px] uppercase tracking-wider text-slate-400 bg-slate-900/25">
                  <th className="py-3 px-4 font-semibold w-16">Rank</th>
                  <th className="py-3 px-4 font-semibold cursor-pointer select-none" onClick={() => toggleSort('name')}>
                    Patient Name {sortBy === 'name' ? (sortOrder === 'desc' ? '▼' : '▲') : ''}
                  </th>
                  <th className="py-3 px-4 font-semibold cursor-pointer select-none" onClick={() => toggleSort('risk')}>
                    Blended 12-Mo Risk {sortBy === 'risk' ? (sortOrder === 'desc' ? '▼' : '▲') : ''}
                  </th>
                  <th className="py-3 px-4 font-semibold cursor-pointer select-none" onClick={() => toggleSort('completeness')}>
                    Care Grade / Trust {sortBy === 'completeness' ? (sortOrder === 'desc' ? '▼' : '▲') : ''}
                  </th>
                  <th className="py-3 px-4 font-semibold">Primary Risk Driver</th>
                  <th className="py-3 px-4 font-semibold">Suggested Clinical Action Today</th>
                  <th className="py-3 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-blue-500/5">
                {sortedRows.map((row, index) => {
                  const patientId = row.patient.id
                  const rank = index + 1
                  const age = getAge(row.patient.dob)
                  const isLowConfidence = row.missingDataPoints.length > 0 && row.dataGrade === 'D'

                  return (
                    <tr
                      key={patientId}
                      className="hover:bg-blue-500/[0.02] transition-colors duration-150 group"
                    >
                      {/* Priority Rank */}
                      <td className="py-4 px-4 font-mono">
                        {rank <= 3 ? (
                          <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                            rank === 1 ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30' :
                            rank === 2 ? 'bg-slate-300/20 text-slate-200 border border-slate-300/30' :
                            'bg-amber-700/20 text-amber-600 border border-amber-700/30'
                          }`}>
                            {rank}
                          </span>
                        ) : (
                          <span className="text-slate-500 pl-2">#{rank}</span>
                        )}
                      </td>

                      {/* Patient Info */}
                      <td className="py-4 px-4">
                        <Link href={`/patients/${patientId}`} className="flex items-center gap-3">
                          <div
                            className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 transition-transform group-hover:scale-105 duration-200"
                            style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}
                          >
                            {initials(row.patient.firstName, row.patient.lastName)}
                          </div>
                          <div>
                            <p className="font-semibold text-white group-hover:text-blue-400 transition-colors leading-tight">
                              {row.patient.firstName} {row.patient.lastName}
                            </p>
                            <p className="text-[10px] text-slate-500 mt-0.5">
                              {row.patient.mrn || row.patient.id.slice(0, 8)} · {age ?? '—'} yrs · {row.patient.sex}
                            </p>
                          </div>
                        </Link>
                      </td>

                      {/* Blended Risk Score */}
                      <td className="py-4 px-4">
                        <div className="flex flex-col justify-center min-w-[120px]">
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="font-bold font-mono" style={{ color: getRiskColor(row.riskScore) }}>
                              {(row.riskScore * 100).toFixed(1)}%
                            </span>
                            <span className="text-[9px] px-1.5 py-0.2 rounded font-medium border"
                              style={{
                                color: getRiskColor(row.riskScore),
                                borderColor: `${getRiskColor(row.riskScore)}30`,
                                background: `${getRiskColor(row.riskScore)}08`
                              }}
                            >
                              {row.riskCategory}
                            </span>
                          </div>
                          <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden border border-blue-500/10">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${Math.min(100, row.riskScore * 100)}%`,
                                backgroundColor: getRiskColor(row.riskScore),
                                boxShadow: `0 0 8px ${getRiskColor(row.riskScore)}80`
                              }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Data Care Grade */}
                      <td className="py-4 px-4 relative">
                        <div
                          className="inline-flex items-center gap-2 cursor-help"
                          onMouseEnter={() => setHoveredGradePatientId(patientId)}
                          onMouseLeave={() => setHoveredGradePatientId(null)}
                        >
                          <span className={`px-2.5 py-1 rounded-lg border text-xs font-bold transition-all ${getGradeBadgeStyle(row.dataGrade)}`}>
                            Grade {row.dataGrade}
                          </span>
                          <span className="text-xs text-slate-500 font-mono">
                            {row.dataCompletenessPct}%
                          </span>
                        </div>

                        {/* Hover Overlay Tooltip showing missing fields */}
                        {hoveredGradePatientId === patientId && row.missingDataPoints.length > 0 && (
                          <div className="absolute left-4 top-10 z-50 w-56 p-3 bg-slate-950 border border-blue-500/20 rounded-xl shadow-2xl backdrop-blur-xl animate-fade-in text-xs space-y-1">
                            <div className="flex items-center gap-1.5 mb-1.5 pb-1 border-b border-blue-500/10">
                              <Info className="w-3.5 h-3.5 text-blue-400" />
                              <span className="font-semibold text-slate-300">Missing Variables</span>
                            </div>
                            {row.missingDataPoints.map((item, idx) => (
                              <div key={idx} className="flex items-center gap-1.5 text-slate-400">
                                <div className="w-1 h-1 rounded-full bg-red-400" />
                                <span>{item}</span>
                              </div>
                            ))}
                            <p className="text-[10px] text-slate-500 italic mt-1.5 pt-1 border-t border-blue-500/5">
                              Uncaptured in registry record
                            </p>
                          </div>
                        )}
                      </td>

                      {/* Primary Risk Driver */}
                      <td className="py-4 px-4">
                        <span className="inline-flex items-center text-xs text-slate-300 bg-slate-900 border border-blue-500/5 rounded-lg px-2.5 py-1">
                          {row.primaryDriver}
                        </span>
                      </td>

                      {/* Suggested Action Today */}
                      <td className="py-4 px-4">
                        <div className="flex items-start gap-2 max-w-sm">
                          <div className="mt-0.5 flex-shrink-0">
                            {getActionIcon(row.actionCategory)}
                          </div>
                          <div>
                            <p className={`text-xs font-medium ${
                              row.actionCategory === 'Safety' ? 'text-red-400 font-semibold' :
                              row.actionCategory === 'Device' ? 'text-purple-400' :
                              row.actionCategory === 'Medication' ? 'text-amber-400' :
                              'text-slate-400'
                            }`}>
                              {row.suggestedAction}
                            </p>
                            {isLowConfidence && (
                              <span className="text-[9px] text-red-500 font-medium tracking-tight">
                                Low confidence prediction — variables missing
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link href={`/patients/${patientId}`}>
                            <button className="btn-outline btn-sm py-1.5 flex items-center gap-1 hover:bg-blue-500/10 hover:border-blue-500/30">
                              Open Profile <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Clinical Guidelines Note ── */}
      <div className="glass-card p-5 relative border border-blue-500/5 bg-blue-500/[0.01]">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
          <div className="space-y-1">
            <h4 className="text-sm font-semibold text-white">Clinical Note on Triage Sorting</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Triage order is determined by combining the MAGGIC mortality backbone with a 100-tree Random Forest classifier (trained on age, comorbidities, ejection fraction, blood pressure, renal markers, and cellular counts). Safety alerts are compiled utilizing ESC 2023 Guidelines for Heart Failure and KDIGO safety thresholds. Ensure patient profiles are complete (Grade A) for maximum algorithmic confidence.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
