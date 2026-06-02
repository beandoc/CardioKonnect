'use client'
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import type { PopulationStats } from '@/lib/types'

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#84cc16', '#ec4899']

// Dark mode tooltip styling helper
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function DarkTip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-navy-900 border border-blue-500/20 rounded-xl px-3 py-2 text-xs backdrop-blur-md"
      style={{ background: 'rgba(10, 17, 40, 0.95)', color: '#e2e8f0' }}>
      <p className="font-semibold">{payload[0].name || payload[0].payload.name}</p>
      <p className="text-blue-400 font-bold mt-0.5">{payload[0].value} patients</p>
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
  const rhythmData = Object.entries(stats.rhythmCounts) as [string, number][]
  const deviceData = Object.entries(stats.deviceCounts).filter(([, v]) => v > 0) as [string, number][]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <MiniPie data={hfData} title="HF Type Distribution" />
        <MiniPie data={nyhaData} title="NYHA Class Distribution" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <MiniBar data={etiologyData} title="Etiology Breakdown" color="#8b5cf6" />
        <MiniPie data={rhythmData} title="Rhythm Pattern" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <LvefHistogram bins={stats.lvefBins} />
        <MiniBar data={deviceData} title="Device Therapy Distribution" color="#06b6d4" />
      </div>
      <MedBar stats={stats} />
    </div>
  )
}
