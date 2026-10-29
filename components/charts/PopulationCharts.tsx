'use client'
import { useState } from 'react'
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'
import type { PopulationStats } from '@/lib/types'

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#84cc16', '#ec4899']

// Dark mode tooltip styling helper
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function DarkTip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const p = payload[0]
  const isRate = p.payload.rate !== undefined
  return (
    <div className="bg-navy-900 border border-blue-500/20 rounded-xl px-3 py-2 text-xs backdrop-blur-md shadow-xl"
      style={{ background: 'rgba(10, 17, 40, 0.95)', color: '#e2e8f0' }}>
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

function MiniPie({ data, title }: { data: [string, number][]; title: string }) {
  const chartData = data.filter(([, v]) => v > 0).map(([name, value]) => ({ name, value }))
  return (
    <div className="glass-card p-5 border border-blue-500/10">
      <p className="text-sm font-semibold text-white mb-4">{title}</p>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            outerRadius={75}
            dataKey="value"
            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
            labelLine={false}
            stroke="rgba(10, 17, 40, 0.8)"
            strokeWidth={2}
          >
            {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Pie>
          <Tooltip content={<DarkTip />} />
        </PieChart>
      </ResponsiveContainer>
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

  // Group raw telemetry rhythms into clinical canonical rhythm patterns for the Pie Chart
  const canonicalRhythms: Record<string, number> = {}
  Object.entries(stats.rhythmCounts).forEach(([rhythm, count]) => {
    const norm = rhythm.toUpperCase()
    let category = 'Sinus Rhythm'
    if (norm.includes('ATRIAL FIB') || norm.includes('AFIB')) {
      category = 'Atrial Fibrillation'
    } else if (norm.includes('FLUTTER')) {
      category = 'Atrial Flutter'
    } else if (norm.includes('VT') || norm.includes('VENTRICULAR TACH')) {
      category = 'Ventricular Arrhythmia'
    } else if (norm.includes('PACED') || norm.includes('PACING')) {
      category = 'Paced Rhythm'
    }
    canonicalRhythms[category] = (canonicalRhythms[category] || 0) + count
  })
  const rhythmPieData = Object.entries(canonicalRhythms).filter(([, v]) => v > 0) as [string, number][]

  const deviceData = Object.entries(stats.deviceCounts).filter(([, v]) => v > 0) as [string, number][]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <MiniPie data={hfData} title="HF Type Distribution" />
        <MiniPie data={nyhaData} title="NYHA Class Distribution" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <MiniBar data={etiologyData} title="Etiology Breakdown" color="#8b5cf6" />
        
        {/* Rhythm Pattern with Clean Pie & Granular Conduction Morphology Inspection */}
        <div className="glass-card p-5 border border-blue-500/10 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-sm font-semibold text-white">Cardiac Rhythm Pattern</p>
                <p className="text-[11px] text-gray-400">Telemetry classification and conduction status</p>
              </div>
              <button
                type="button"
                onClick={() => setShowRhythmDetails(!showRhythmDetails)}
                className="text-xs text-blue-400 hover:text-blue-300 underline cursor-pointer"
              >
                {showRhythmDetails ? 'Hide ECG Details' : 'Inspect ECG Details'}
              </button>
            </div>

            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={rhythmPieData.map(([name, value]) => ({ name, value }))}
                  cx="50%"
                  cy="50%"
                  outerRadius={75}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                  stroke="rgba(10, 17, 40, 0.8)"
                  strokeWidth={2}
                >
                  {rhythmPieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip content={<DarkTip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {showRhythmDetails && (
            <div className="mt-3 pt-3 border-t border-blue-500/10 max-h-48 overflow-y-auto space-y-1">
              <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-1">
                Documented ECG Morphology & Conduction Findings ({Object.keys(stats.rhythmCounts).length})
              </p>
              {Object.entries(stats.rhythmCounts).map(([r, cnt]) => (
                <div key={r} className="flex justify-between items-center text-xs py-1 border-b border-white/5">
                  <span className="text-gray-300 font-mono text-[11px]">{r}</span>
                  <span className="badge badge-blue text-[10px] font-bold">{cnt} pt{cnt > 1 ? 's' : ''}</span>
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
