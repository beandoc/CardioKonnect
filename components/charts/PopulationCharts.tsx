'use client'
import { useState } from 'react'
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'
import { ChevronDown, ChevronUp, Activity, HeartPulse } from 'lucide-react'
import type { PopulationStats } from '@/lib/types'

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#f97316', '#84cc16', '#ec4899']

// Dark mode tooltip styling helper
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function DarkTip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const p = payload[0]
  const isRate = p.payload.rate !== undefined
  return (
    <div
      className="bg-navy-900 border border-blue-500/20 rounded-xl px-3 py-2 text-xs backdrop-blur-md shadow-xl"
      style={{ background: 'rgba(10, 17, 40, 0.95)', color: '#e2e8f0' }}
    >
      <p className="font-semibold">{p.name || p.payload.name}</p>
      {isRate ? (
        <p className="text-blue-400 font-bold mt-0.5">{p.payload.rate}% ({p.payload.count} patients)</p>
      ) : (
        <p className="text-blue-400 font-bold mt-0.5">{p.value} patients</p>
      )}
    </div>
  )
}

const getTickColor = () => typeof document !== 'undefined' && document.body.classList.contains('light') ? '#475569' : '#cbd5e1'
const getTickLabelColor = () => typeof document !== 'undefined' && document.body.classList.contains('light') ? '#334155' : '#94a3b8'

/**
 * Standardizes raw ECG free-text into clinical electrophysiology categories.
 */
function classifyCardiacRhythm(raw: string): string {
  const norm = (raw || '').toUpperCase().trim()
  if (!norm || norm === 'NOT DOCUMENTED' || norm === 'UNKNOWN') return 'Not Documented'
  
  if (norm.includes('ATRIAL FIB') || norm.includes('AFIB') || norm === 'AF') {
    return 'Atrial Fibrillation'
  }
  if (norm.includes('FLUTTER') || norm === 'AFL') {
    return 'Atrial Flutter'
  }
  if (norm.includes('VT') || norm.includes('VENTRICULAR TACH')) {
    return 'Ventricular Arrhythmia (VT)'
  }
  if (norm.includes('PACED') || norm.includes('PACING')) {
    return 'Paced Rhythm'
  }
  if (norm.includes('LBBB')) {
    return 'Sinus Rhythm with LBBB'
  }
  if (norm.includes('RBBB') || norm.includes('IVCD') || norm.includes('CONDUCTION DELAY')) {
    return 'Sinus Rhythm with RBBB / IVCD'
  }
  if (norm.includes('QS') || norm.includes('Q WAVE') || norm.includes('T↓') || norm.includes('ST↑') || norm.includes('POOR R')) {
    return 'Sinus with Ischemic / ST-T / Q Changes'
  }
  if (norm.includes('VPC') || norm.includes('PVC')) {
    return 'Sinus with Ventricular Ectopy'
  }
  if (norm.includes('SINUS') || norm.includes('NSR') || norm.includes('WNL')) {
    return 'Normal Sinus Rhythm'
  }
  return 'Other ECG Morphology'
}

/**
 * Clean, modern Donut Chart with a center metric and structured side legend.
 * Eliminates overlapping floating SVG text labels entirely.
 */
function CleanDonutCard({
  title,
  subtitle,
  data,
  centerLabel = 'Patients',
  colorPalette = COLORS,
}: {
  title: string
  subtitle?: string
  data: [string, number][]
  centerLabel?: string
  colorPalette?: string[]
}) {
  const validData = data.filter(([, v]) => v > 0)
  const total = validData.reduce((sum, [, v]) => sum + v, 0)
  const chartData = validData.map(([name, value]) => ({ name, value }))

  return (
    <div className="glass-card p-5 border border-blue-500/10 flex flex-col justify-between">
      <div className="mb-3">
        <p className="text-sm font-semibold text-white">{title}</p>
        {subtitle && <p className="text-[11px] text-gray-400 mt-0.5">{subtitle}</p>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-12 items-center gap-4">
        {/* Donut Chart with Center Total */}
        <div className="sm:col-span-5 relative flex items-center justify-center">
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={72}
                paddingAngle={chartData.length > 1 ? 3 : 0}
                cornerRadius={3}
                dataKey="value"
                stroke="rgba(10, 17, 40, 0.9)"
                strokeWidth={2}
              >
                {chartData.map((_, i) => (
                  <Cell key={i} fill={colorPalette[i % colorPalette.length]} />
                ))}
              </Pie>
              <Tooltip content={<DarkTip />} />
            </PieChart>
          </ResponsiveContainer>

          {/* Centered Total Callout */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span
              className="text-xl font-black text-white tracking-tight leading-none"
              style={{ fontFamily: 'Space Grotesk, sans-serif' }}
            >
              {total}
            </span>
            <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider mt-1">
              {centerLabel}
            </span>
          </div>
        </div>

        {/* Structured Side Legend Table */}
        <div className="sm:col-span-7 space-y-2 py-1 max-h-48 overflow-y-auto pr-1">
          {chartData.map((item, idx) => {
            const pct = total > 0 ? Math.round((item.value / total) * 100) : 0
            const clr = colorPalette[idx % colorPalette.length]
            return (
              <div key={item.name} className="flex items-center justify-between text-xs group">
                <div className="flex items-center gap-2 min-w-0 pr-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0 shadow-sm"
                    style={{ backgroundColor: clr }}
                  />
                  <span className="text-gray-300 group-hover:text-white truncate font-medium text-[11px]" title={item.name}>
                    {item.name}
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-gray-400 text-[11px] font-mono">{item.value} pts</span>
                  <span
                    className="px-1.5 py-0.5 rounded text-[10px] font-extrabold"
                    style={{ backgroundColor: `${clr}22`, color: clr }}
                  >
                    {pct}%
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function MiniBar({ data, title, color = '#3b82f6' }: { data: [string, number][]; title: string; color?: string }) {
  const chartData = data.map(([name, value]) => ({ name, value }))
  return (
    <div className="glass-card p-5 border border-blue-500/10">
      <p className="text-sm font-semibold text-white mb-4">{title}</p>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(59, 130, 246, 0.08)" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 10, fill: getTickLabelColor() }} tickLine={false} axisLine={false} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: getTickColor() }} tickLine={false} axisLine={false} width={110} />
          <Tooltip content={<DarkTip />} />
          <Bar dataKey="value" fill={color} radius={[0, 4, 4, 0]} maxBarSize={16} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function MedBar({ stats }: { stats: PopulationStats }) {
  const total = stats.totalPatients || 1
  const data = Object.entries(stats.medPrescribingRates).map(([name, count]) => ({
    name,
    rate: Math.round((count / total) * 100),
    count,
  }))
  return (
    <div className="glass-card p-5 border border-blue-500/10">
      <p className="text-sm font-semibold text-white mb-4">Medication Prescribing Rates (%)</p>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(59, 130, 246, 0.08)" horizontal={false} />
          <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: getTickLabelColor() }} tickLine={false} axisLine={false} unit="%" />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: getTickColor() }} tickLine={false} axisLine={false} width={100} />
          <Tooltip content={<DarkTip />} />
          <Bar dataKey="rate" radius={[0, 4, 4, 0]} maxBarSize={14}>
            {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function LvefHistogram({ bins }: { bins: Record<string, number> }) {
  const data = Object.entries(bins).map(([name, value]) => ({ name, value }))
  return (
    <div className="glass-card p-5 border border-blue-500/10">
      <p className="text-sm font-semibold text-white mb-4">LVEF Distribution (%)</p>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(59, 130, 246, 0.08)" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 10, fill: getTickColor() }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 10, fill: getTickLabelColor() }} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip content={<DarkTip />} />
          <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={32}>
            {data.map((d, i) => {
              const colors = ['#ef4444', '#f97316', '#f59e0b', '#10b981', '#3b82f6']
              return <Cell key={i} fill={colors[i] ?? COLORS[i % COLORS.length]} />
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export default function PopulationCharts({ stats }: { stats: PopulationStats }) {
  const [showRhythmDetails, setShowRhythmDetails] = useState(false)

  const hfData = Object.entries(stats.hfTypeBreakdown) as [string, number][]
  const nyhaData: [string, number][] = [
    ['Class I', stats.nyhaCounts.I ?? 0],
    ['Class II', stats.nyhaCounts.II ?? 0],
    ['Class III', stats.nyhaCounts.III ?? 0],
    ['Class IV', stats.nyhaCounts.IV ?? 0],
  ]
  const etiologyData = Object.entries(stats.etiologyCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8) as [string, number][]

  // Group raw telemetry rhythms into clinical canonical rhythm patterns for the Donut Chart
  const canonicalRhythms: Record<string, number> = {}
  Object.entries(stats.rhythmCounts).forEach(([rhythm, count]) => {
    const category = classifyCardiacRhythm(rhythm)
    if (category !== 'Not Documented') {
      canonicalRhythms[category] = (canonicalRhythms[category] || 0) + count
    }
  })
  const rhythmPieData = Object.entries(canonicalRhythms)
    .filter(([, v]) => v > 0)
    .sort(([, a], [, b]) => b - a) as [string, number][]

  const totalRhythmDocumented = rhythmPieData.reduce((acc, [, v]) => acc + v, 0)
  const deviceData = Object.entries(stats.deviceCounts).filter(([, v]) => v > 0) as [string, number][]
  const rawRhythmFindingsCount = Object.keys(stats.rhythmCounts).filter(r => r !== 'Not Documented').length

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <CleanDonutCard
          data={hfData}
          title="HF Type Distribution"
          subtitle="Classification by ejection fraction (ESC 2023 Guidelines)"
          centerLabel="Cohort"
          colorPalette={['#3b82f6', '#10b981', '#f59e0b']}
        />
        <CleanDonutCard
          data={nyhaData}
          title="NYHA Functional Class"
          subtitle="Functional symptomatic severity grading at latest visit"
          centerLabel="Assessed"
          colorPalette={['#10b981', '#3b82f6', '#f59e0b', '#ef4444']}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <MiniBar data={etiologyData} title="Etiology Breakdown" color="#8b5cf6" />
        
        {/* Cardiac Rhythm Pattern Card with Donut Chart and Granular Morphology Drawer */}
        <div className="glass-card p-5 border border-blue-500/10 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-sm font-semibold text-white flex items-center gap-2">
                  <HeartPulse className="w-4 h-4 text-rose-400" />
                  Cardiac Rhythm Pattern
                </p>
                <p className="text-[11px] text-gray-400">Clinical rhythm and conduction classification</p>
              </div>
              <button
                type="button"
                onClick={() => setShowRhythmDetails(!showRhythmDetails)}
                className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 cursor-pointer bg-blue-950/40 border border-blue-500/20 px-2 py-1 rounded-lg transition-colors"
              >
                <span>{showRhythmDetails ? 'Hide ECG Lead Findings' : 'Inspect Lead Details'}</span>
                {showRhythmDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* Donut Chart with Centered Total and Side Legend */}
            <div className="grid grid-cols-1 sm:grid-cols-12 items-center gap-4 mt-2">
              <div className="sm:col-span-5 relative flex items-center justify-center">
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={rhythmPieData.map(([name, value]) => ({ name, value }))}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={72}
                      paddingAngle={rhythmPieData.length > 1 ? 3 : 0}
                      cornerRadius={3}
                      dataKey="value"
                      stroke="rgba(10, 17, 40, 0.9)"
                      strokeWidth={2}
                    >
                      {rhythmPieData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<DarkTip />} />
                  </PieChart>
                </ResponsiveContainer>

                {/* Center Callout */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span
                    className="text-xl font-black text-white tracking-tight leading-none"
                    style={{ fontFamily: 'Space Grotesk, sans-serif' }}
                  >
                    {totalRhythmDocumented}
                  </span>
                  <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider mt-1">
                    Documented
                  </span>
                </div>
              </div>

              {/* Side Breakdown Table */}
              <div className="sm:col-span-7 space-y-2 py-1 max-h-48 overflow-y-auto pr-1">
                {rhythmPieData.map(([name, value], idx) => {
                  const pct = totalRhythmDocumented > 0 ? Math.round((value / totalRhythmDocumented) * 100) : 0
                  const clr = COLORS[idx % COLORS.length]
                  return (
                    <div key={name} className="flex items-center justify-between text-xs group">
                      <div className="flex items-center gap-2 min-w-0 pr-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0 shadow-sm"
                          style={{ backgroundColor: clr }}
                        />
                        <span className="text-gray-300 group-hover:text-white truncate font-medium text-[11px]" title={name}>
                          {name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-gray-400 text-[11px] font-mono">{value} pts</span>
                        <span
                          className="px-1.5 py-0.5 rounded text-[10px] font-extrabold"
                          style={{ backgroundColor: `${clr}22`, color: clr }}
                        >
                          {pct}%
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Granular Morphology Findings Inspection Drawer */}
          {showRhythmDetails && (
            <div className="mt-4 pt-3 border-t border-blue-500/15 max-h-52 overflow-y-auto space-y-1.5 animate-fade-in">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] uppercase tracking-wider text-cyan-400 font-bold">
                  Documented EMR Lead Morphology & Telemetry Notes ({rawRhythmFindingsCount})
                </p>
                <span className="text-[10px] text-gray-400">Raw Registry Telemetry</span>
              </div>
              {Object.entries(stats.rhythmCounts)
                .filter(([r]) => r !== 'Not Documented')
                .map(([r, cnt]) => (
                  <div key={r} className="flex justify-between items-center text-xs py-1 px-2 rounded bg-slate-900/60 border border-white/5 hover:border-blue-500/20 transition-colors">
                    <span className="text-gray-300 font-mono text-[11px] truncate pr-2">{r}</span>
                    <span className="badge badge-blue text-[10px] font-bold flex-shrink-0">{cnt} pt{cnt > 1 ? 's' : ''}</span>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <LvefHistogram bins={stats.lvefBins} />
        <MiniBar data={deviceData} title="Device Therapy Distribution" color="#06b6d4" />
      </div>

      <MedBar stats={stats} />
    </div>
  )
}
