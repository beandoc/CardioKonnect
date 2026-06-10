'use client'
import { useEffect, useState } from 'react'
import { getPopulationStats } from '@/lib/firestore'
import type { PopulationStats } from '@/lib/types'
import PopulationCharts from '@/components/charts/PopulationCharts'
import { Users, TrendingUp, Activity, Heart, ShieldAlert } from 'lucide-react'

const EMPTY_STATS: PopulationStats = {
  totalPatients: 0, hfTypeBreakdown: {}, nyhaCounts: { I: 0, II: 0, III: 0, IV: 0 },
  etiologyCounts: {}, rhythmCounts: {}, avgLvef: null, avgAge: null,
  avgNtProBnp: null, avgEgfr: null, medPrescribingRates: {},
  deviceCounts: {}, lvefBins: {},
}

export default function AnalyticsPage() {
  const [stats, setStats] = useState<PopulationStats>(EMPTY_STATS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadStats = async () => {
    setLoading(true)
    setError(null)
    try {
      const s = await getPopulationStats()
      setStats(s)
    } catch (e) {
      console.error('Failed to load analytics:', e)
      setError('Failed to load population analytics. Please refresh the page.')
      setStats(EMPTY_STATS)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStats()
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Activity className="w-6 h-6 text-blue-400 animate-pulse" />
    </div>
  )

  const nyha34 = (stats.nyhaCounts['III'] ?? 0) + (stats.nyhaCounts['IV'] ?? 0)
  const hfrEF = stats.hfTypeBreakdown['HFrEF'] ?? 0

  return (
    <div className="space-y-6 animate-fade-in text-gray-300">

      {/* Error Banner */}
      {error && (
        <div className="p-4 bg-red-950/30 border border-red-500/40 rounded-lg flex items-start gap-3 text-red-300 text-sm">
          <ShieldAlert className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-400" />
          <div className="flex-1">
            <p className="font-semibold">Analytics Error</p>
            <p className="text-red-300/80 mt-1">{error}</p>
          </div>
          <button
            onClick={loadStats}
            className="ml-2 px-3 py-1.5 rounded bg-red-500/20 hover:bg-red-500/30 text-red-300 text-xs font-semibold whitespace-nowrap transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400 flex-shrink-0">
          <Activity className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white leading-tight">Population Analytics</h2>
          <p className="text-xs text-gray-500 mt-1">Aggregated insights across all registered cardiology patients (latest clinical visits)</p>
        </div>
      </div>

      {/* KPI Stats Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="kpi-card blue">
          <p className="text-[10px] uppercase tracking-wider text-gray-400">Total Patients</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.totalPatients}</p>
          <p className="text-[10px] text-gray-500 mt-1">Registered participants</p>
        </div>
        
        <div className="kpi-card rose">
          <p className="text-[10px] uppercase tracking-wider text-gray-400">Avg LVEF</p>
          <p className="text-2xl font-bold text-white mt-1">
            {stats.avgLvef != null ? `${stats.avgLvef.toFixed(1)}%` : '—'}
          </p>
          <p className="text-[10px] text-gray-500 mt-1">Mean ejection fraction</p>
        </div>

        <div className="kpi-card emerald">
          <p className="text-[10px] uppercase tracking-wider text-gray-400">Avg Age</p>
          <p className="text-2xl font-bold text-white mt-1">
            {stats.avgAge != null ? `${stats.avgAge.toFixed(0)} yrs` : '—'}
          </p>
          <p className="text-[10px] text-gray-500 mt-1">Cohort mean age</p>
        </div>

        <div className="kpi-card amber">
          <p className="text-[10px] uppercase tracking-wider text-gray-400">NYHA III/IV Burden</p>
          <p className="text-2xl font-bold text-white mt-1">
            {stats.totalPatients ? `${Math.round((nyha34 / stats.totalPatients) * 100)}%` : '—'}
          </p>
          <p className="text-[10px] text-gray-500 mt-1">{nyha34} symptomatic patients</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="kpi-card violet">
          <p className="text-[10px] uppercase tracking-wider text-gray-400">Avg NT-proBNP</p>
          <p className="text-2xl font-bold text-white mt-1">
            {stats.avgNtProBnp != null ? `${stats.avgNtProBnp.toFixed(0)} pg/mL` : '—'}
          </p>
          <p className="text-[10px] text-gray-500 mt-1">Vascular biomarker mean</p>
        </div>

        <div className="kpi-card cyan">
          <p className="text-[10px] uppercase tracking-wider text-gray-400">Avg eGFR</p>
          <p className="text-2xl font-bold text-white mt-1">
            {stats.avgEgfr != null ? `${stats.avgEgfr.toFixed(0)} ml/min/1.73m²` : '—'}
          </p>
          <p className="text-[10px] text-gray-500 mt-1">Renal filtration mean</p>
        </div>
      </div>

      {/* Cohort Profile Analysis Grid */}
      <div className="glass-card p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-blue-500/10 pb-3">
          <h3 className="text-sm font-semibold text-white">Research Cohort Profiles</h3>
          <span className="text-[10px] text-gray-500">Auto-computed from latest clinical telemetry</span>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          
          <div className="dark-card p-4 space-y-2 border border-blue-500/10">
            <p className="font-semibold text-xs text-white">GDMT Four-Pillar Candidates</p>
            <p className="text-[11px] text-gray-400 leading-relaxed">
              HFrEF patients eligible for target combination RAASi + Beta-Blocker + MRA + SGLT2i treatment.
            </p>
            <div className="pt-2 flex items-center justify-between">
              <span className="text-xs text-gray-500">Active cohort size:</span>
              <span className="badge badge-blue font-bold">{hfrEF} pts</span>
            </div>
          </div>

          <div className="dark-card p-4 space-y-2 border border-blue-500/10">
            <p className="font-semibold text-xs text-white">CRT / Device Resynchronization</p>
            <p className="text-[11px] text-gray-400 leading-relaxed">
              Patients exhibiting documented LBBB or QRS &ge;130ms and severe LVEF impairment &lt;35%.
            </p>
            <div className="pt-2 flex items-center justify-between">
              <span className="text-xs text-gray-500">Active cohort size:</span>
              <span className="badge badge-violet font-bold">1 pts</span>
            </div>
          </div>

          <div className="dark-card p-4 space-y-2 border border-blue-500/10">
            <p className="font-semibold text-xs text-white">Iron Deficiency Anemia Screen</p>
            <p className="text-[11px] text-gray-400 leading-relaxed">
              Heart failure patients exhibiting documented serum ferritin &lt;100 &micro;g/L requiring intravenous iron.
            </p>
            <div className="pt-2 flex items-center justify-between">
              <span className="text-xs text-gray-500">Active cohort size:</span>
              <span className="badge badge-green font-bold">2 pts</span>
            </div>
          </div>

          <div className="dark-card p-4 space-y-2 border border-blue-500/10">
            <p className="font-semibold text-xs text-white">Advanced Symptomatic Class</p>
            <p className="text-[11px] text-gray-400 leading-relaxed">
              Registry patients diagnosed under severe functional impairment NYHA Class III/IV.
            </p>
            <div className="pt-2 flex items-center justify-between">
              <span className="text-xs text-gray-500">Active cohort size:</span>
              <span className="badge badge-amber font-bold">{nyha34} pts</span>
            </div>
          </div>

        </div>
      </div>

      {/* Visual Analytics Charts Section */}
      <PopulationCharts stats={stats} />

    </div>
  )
}
