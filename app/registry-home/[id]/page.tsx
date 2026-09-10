'use client'
import { useParams, useRouter } from 'next/navigation'
import { useState, useEffect, useMemo } from 'react'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import Link from 'next/link'
import { ArrowLeft, Users, CheckCircle, TrendingUp, Clock, Activity, PlusCircle, FlaskConical, Microscope, Layers, Info, TrendingDown, ArrowRight, AlertTriangle, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { subscribePatients, subscribeVisits, subscribeCathProcedures } from '@/lib/firestore'
import type { Patient, Visit, CathProcedure } from '@/lib/types'
import CathProcedureModal from '@/components/procedures/CathProcedureModal'
import CathStatisticalBenchmarking from '@/components/analytics/CathStatisticalBenchmarking'
import { useAppUser } from '@/context/AppUserContext'
import { canAccessRegistry, registryAccessDeniedReason } from '@/lib/accessControl'
import { REGISTRY_CONFIG, SITES } from '@/lib/appConfig'
import type { ChartItem, ClinicalChart, RegistryData } from '@/lib/registry'
import { computeCathlabRegistry, computeAcsRegistry, computeHfRegistry } from '@/lib/registry'



// ─── Per-registry data ────────────────────────────────────────────────────────
const REGISTRY_DATA: Record<string, RegistryData> = {
  hf: {
    id: 'hf',
    name: 'Heart Failure Registry',
    shortDesc: 'HFrEF · HFmrEF · HFpEF · Advanced HF',
    gradient: 'linear-gradient(135deg, #1d4ed8 0%, #3b82f6 100%)',
    accentColor: '#3b82f6',
    ringColor: '#60a5fa',
    patients: 312,
    newThisMonth: 18,
    completion: 83,
    fieldsTotal: 52,
    fieldsCaptured: 43,
    status: 'Active',
    kpis: [
      { label: 'Avg LVEF', value: '32%', sub: '± 8%' },
      { label: 'GDMT Rate', value: '74%', sub: 'on 3+ drugs' },
      { label: 'NYHA III–IV', value: '58%', sub: 'advanced symptoms' },
      { label: 'HF Hospitalisation', value: '41%', sub: 'prior 12 mo' },
    ],
    completionByCategory: [
      { name: 'Demographics', pct: 98 },
      { name: 'Vitals & Exam', pct: 91 },
      { name: 'Echo / Imaging', pct: 76 },
      { name: 'Laboratory', pct: 84 },
      { name: 'Medications', pct: 88 },
      { name: 'QoL / Functional', pct: 62 },
    ],
    enrollmentTrend: [
      { month: 'Jan', count: 241 }, { month: 'Feb', count: 256 }, { month: 'Mar', count: 268 },
      { month: 'Apr', count: 279 }, { month: 'May', count: 294 }, { month: 'Jun', count: 312 },
    ],
    clinicalCharts: [
      {
        title: 'HF Phenotype Distribution',
        type: 'pie',
        data: [
          { name: 'HFrEF (EF < 40%)', value: 178 },
          { name: 'HFmrEF (EF 40–49%)', value: 67 },
          { name: 'HFpEF (EF ≥ 50%)', value: 67 },
        ],
      },
      {
        title: 'NYHA Functional Class',
        type: 'pie',
        data: [
          { name: 'Class I', value: 31 },
          { name: 'Class II', value: 103 },
          { name: 'Class III', value: 134 },
          { name: 'Class IV', value: 44 },
        ],
      },
      {
        title: 'LVEF Distribution',
        type: 'bar-v',
        color: '#3b82f6',
        data: [
          { name: '< 30%', value: 118 },
          { name: '30–39%', value: 60 },
          { name: '40–49%', value: 67 },
          { name: '≥ 50%', value: 67 },
        ],
      },
      {
        title: 'GDMT Prescribing Rates (%)',
        type: 'bar-h',
        color: '#60a5fa',
        data: [
          { name: 'Beta-Blocker', value: 87 },
          { name: 'RAASi (ACEi/ARB/ARNI)', value: 81 },
          { name: 'MRA', value: 63 },
          { name: 'SGLT2i', value: 54 },
          { name: 'Diuretics', value: 92 },
        ],
      },
    ],
  },
}

// ─── Chart helpers ────────────────────────────────────────────────────────────
const PALETTE = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#84cc16', '#ec4899']

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function DarkTip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="text-xs rounded-xl px-3 py-2 backdrop-blur-md border border-blue-500/20"
      style={{ background: 'rgba(10,17,40,0.96)', color: '#e2e8f0' }}>
      <p className="font-semibold">{payload[0].name ?? payload[0].payload?.name}</p>
      <p className="text-blue-400 font-bold mt-0.5">{payload[0].value}</p>
    </div>
  )
}

function PieChartCard({ title, data }: { title: string; data: ChartItem[] }) {
  return (
    <div className="glass-card p-5 border border-blue-500/10">
      <p className="text-sm font-semibold text-white mb-3">{title}</p>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={data} cx="50%" cy="50%" outerRadius={72}
            dataKey="value"
            label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
            labelLine={false}
            stroke="rgba(10,17,40,0.7)" strokeWidth={2}
          >
            {data.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
          </Pie>
          <Tooltip content={<DarkTip />} />
          <Legend
            formatter={(v: string) => <span style={{ fontSize: 10, color: '#94a3b8' }}>{v}</span>}
            iconSize={8}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}

function BarHCard({ title, data, color }: { title: string; data: ChartItem[]; color: string }) {
  return (
    <div className="glass-card p-5 border border-blue-500/10">
      <p className="text-sm font-semibold text-white mb-3">{title}</p>
      <ResponsiveContainer width="100%" height={Math.max(180, data.length * 36)}>
        <BarChart data={data} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(59,130,246,0.07)" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#cbd5e1' }} tickLine={false} axisLine={false} width={130} />
          <Tooltip content={<DarkTip />} />
          <Bar dataKey="value" fill={color} radius={[0, 4, 4, 0]} maxBarSize={14} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function BarVCard({ title, data, color }: { title: string; data: ChartItem[]; color: string }) {
  return (
    <div className="glass-card p-5 border border-blue-500/10">
      <p className="text-sm font-semibold text-white mb-3">{title}</p>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(59,130,246,0.07)" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#cbd5e1' }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip content={<DarkTip />} />
          <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={36}>
            {data.map((_, i) => <Cell key={i} fill={color} opacity={0.7 + (i * 0.06)} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function CompletionBars({ categories, accentColor }: { categories: { name: string; pct: number }[]; accentColor: string }) {
  return (
    <div className="glass-card p-5 border border-blue-500/10">
      <p className="text-sm font-semibold text-white mb-4">Data Completeness by Category</p>
      <div className="space-y-3">
        {categories.map(cat => (
          <div key={cat.name} className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">{cat.name}</span>
              <span className={cn('font-semibold', cat.pct >= 90 ? 'text-emerald-400' : cat.pct >= 75 ? 'text-amber-400' : 'text-red-400')}>
                {cat.pct}%
              </span>
            </div>
            <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${cat.pct}%`,
                  background: cat.pct >= 90
                    ? '#10b981'
                    : cat.pct >= 75
                    ? accentColor
                    : '#ef4444',
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function EnrollmentTrend({ data, accentColor }: { data: { month: string; count: number }[]; accentColor: string }) {
  return (
    <div className="glass-card p-5 border border-blue-500/10">
      <p className="text-sm font-semibold text-white mb-4">Cumulative Enrollment Trend</p>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="enrollGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={accentColor} stopOpacity={0.3} />
              <stop offset="95%" stopColor={accentColor} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(59,130,246,0.07)" vertical={false} />
          <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#cbd5e1' }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip content={<DarkTip />} />
          <Area
            type="monotone" dataKey="count" name="Patients"
            stroke={accentColor} strokeWidth={2}
            fill="url(#enrollGrad)"
            dot={{ r: 3, fill: accentColor, strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}



const NYHA_COLORS: Record<string, string> = {
  'I': '#10b981', 'II': '#3b82f6', 'III': '#f59e0b', 'IV': '#ef4444'
}


// ─── Additional Chart Components ──────────────────────────────────────────────

function SectionHeader({ title, color, subtitle }: { title: string; color: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <span className="w-1 h-5 rounded-full inline-block flex-shrink-0" style={{ background: color }} />
      <div>
        <h2 className="text-sm font-semibold text-white uppercase tracking-wider">{title}</h2>
        {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  )
}

function ScatterTip({ active, payload, xLabel, yLabel }: any) {
  if (!active || !payload?.length) return null
  const pt = payload[0]?.payload
  return (
    <div className="text-xs rounded-xl px-3 py-2 backdrop-blur-md border border-violet-500/25"
      style={{ background: 'rgba(10,17,40,0.97)', color: '#e2e8f0' }}>
      <p><span style={{ color: '#a78bfa' }}>{xLabel}:</span> <span className="font-mono">{pt?.x}</span></p>
      <p className="mt-0.5"><span style={{ color: '#f97316' }}>{yLabel}:</span> <span className="font-mono">{pt?.y?.toLocaleString()}</span></p>
      {pt?.nyha && <p className="mt-0.5 text-gray-400">NYHA Class {pt.nyha}</p>}
    </div>
  )
}

function ResearchScatterCard({
  title, note, data, xLabel, yLabel, r, isSpearman = false,
}: {
  title: string; note: string
  data: { x: number; y: number; nyha: string }[]
  xLabel: string; yLabel: string; r: number
  isSpearman?: boolean
}) {
  const classes = ['I', 'II', 'III', 'IV'] as const
  const byNYHA = classes.reduce((acc, n) => {
    acc[n] = data.filter(d => d.nyha === n).map(d => ({ x: d.x, y: d.y, nyha: n }))
    return acc
  }, {} as Record<string, { x: number; y: number; nyha: string }[]>)

  const absR = Math.abs(r)
  const rColor = absR > 0.5 ? '#10b981' : absR > 0.3 ? '#f59e0b' : '#64748b'
  const strength = absR > 0.5 ? 'Strong' : absR > 0.3 ? 'Moderate' : 'Weak'
  const direction = r < 0 ? 'Inverse' : 'Positive'

  return (
    <div className="p-5 rounded-2xl" style={{ border: '1px solid rgba(139,92,246,0.25)', background: 'rgba(139,92,246,0.04)' }}>
      <div className="flex items-start justify-between mb-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white">{title}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">{note}</p>
        </div>
        <div className="text-right ml-4 flex-shrink-0 px-3 py-2 rounded-xl" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(139,92,246,0.2)' }}>
          <p className="text-xl font-mono font-bold" style={{ color: rColor }}>
            {isSpearman ? 'ρ' : 'r'} = {r >= 0 ? '+' : ''}{r.toFixed(3)}
          </p>
          <p className="text-[10px] font-medium mt-0.5" style={{ color: rColor }}>{strength} {direction}</p>
          <p className="text-[9px] text-gray-500 mt-0.5">n = {data.length} pts</p>
        </div>
      </div>

      {data.length < 3 ? (
        <div className="h-[260px] flex flex-col items-center justify-center gap-2">
          <Microscope className="w-8 h-8 text-gray-600" />
          <p className="text-sm text-gray-500">Insufficient data ({data.length} pts)</p>
          <p className="text-xs text-gray-600">Grip / 6MWT values not captured in dataset</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <ScatterChart margin={{ top: 10, right: 10, bottom: 30, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(139,92,246,0.08)" />
            <XAxis
              type="number" dataKey="x" name={xLabel}
              tick={{ fontSize: 9, fill: '#94a3b8' }} tickLine={false} axisLine={false}
              label={{ value: xLabel, position: 'insideBottom', offset: -14, fill: '#64748b', fontSize: 9 }}
            />
            <YAxis
              type="number" dataKey="y" name={yLabel}
              tick={{ fontSize: 9, fill: '#94a3b8' }} tickLine={false} axisLine={false}
              width={55}
            />
            <Tooltip content={<ScatterTip xLabel={xLabel} yLabel={yLabel} />} cursor={{ strokeDasharray: '3 3', stroke: 'rgba(139,92,246,0.3)' }} />
            <Legend iconSize={7} formatter={(v) => <span style={{ fontSize: 10, color: '#94a3b8' }}>NYHA {v}</span>} />
            {classes.map(n =>
              byNYHA[n].length > 0 ? (
                <Scatter key={n} name={n} data={byNYHA[n]} fill={NYHA_COLORS[n]} opacity={0.82} />
              ) : null
            )}
          </ScatterChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

function NtBnpQuartileCard({ quartiles }: {
  quartiles: { quartile: string; meanGrip: number | null; meanSixMWT: number | null; n: number; meanBnp: number }[]
}) {
  const quartileColors = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444']
  return (
    <div className="p-5 rounded-2xl" style={{ border: '1px solid rgba(139,92,246,0.25)', background: 'rgba(139,92,246,0.04)' }}>
      <p className="text-sm font-semibold text-white mb-1">NT-proBNP Quartile Stratification</p>
      <p className="text-[11px] text-gray-400 mb-5">Mean functional capacity across NT-proBNP severity strata — LVEF &lt;40% patients only</p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(139,92,246,0.2)' }}>
              {['Quartile', 'Mean NT-proBNP', 'Mean Grip Strength', 'Mean 6MWT Distance', 'Patients'].map(h => (
                <th key={h} className="pb-2 pr-6 text-left text-gray-400 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {quartiles.map((q, i) => (
              <tr key={q.quartile} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <td className="py-3 pr-6 font-semibold" style={{ color: quartileColors[i] }}>
                  <span className="inline-block w-2 h-2 rounded-full mr-2" style={{ background: quartileColors[i] }} />
                  {q.quartile}
                </td>
                <td className="py-3 pr-6 font-mono" style={{ color: quartileColors[i] }}>{q.meanBnp.toLocaleString()} pg/mL</td>
                <td className="py-3 pr-6">
                  {q.meanGrip !== null
                    ? <span className="font-mono text-white">{q.meanGrip} kg</span>
                    : <span className="text-gray-600">— not recorded</span>}
                </td>
                <td className="py-3 pr-6">
                  {q.meanSixMWT !== null
                    ? <span className="font-mono text-white">{q.meanSixMWT} m</span>
                    : <span className="text-gray-600">— not recorded</span>}
                </td>
                <td className="py-3 text-gray-400">{q.n}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Visual bar comparison */}
      <div className="mt-5 space-y-3">
        {quartiles.filter(q => q.meanGrip !== null || q.meanSixMWT !== null).map((q, i) => {
          const maxGrip = Math.max(...quartiles.filter(x => x.meanGrip !== null).map(x => x.meanGrip!))
          const maxSixMWT = Math.max(...quartiles.filter(x => x.meanSixMWT !== null).map(x => x.meanSixMWT!))
          return (
            <div key={i}>
              <div className="flex items-center justify-between text-[10px] text-gray-400 mb-1">
                <span style={{ color: quartileColors[i] }}>{q.quartile}</span>
                <span className="text-gray-500">BNP {q.meanBnp.toLocaleString()}</span>
              </div>
              {q.meanGrip !== null && (
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[9px] text-gray-500 w-16">Grip</span>
                  <div className="flex-1 h-1.5 rounded-full bg-white/[0.06]">
                    <div className="h-full rounded-full" style={{ width: `${(q.meanGrip / maxGrip) * 100}%`, background: quartileColors[i], opacity: 0.8 }} />
                  </div>
                  <span className="text-[9px] font-mono text-white w-10 text-right">{q.meanGrip}kg</span>
                </div>
              )}
              {q.meanSixMWT !== null && (
                <div className="flex items-center gap-2">
                  <span className="text-[9px] text-gray-500 w-16">6MWT</span>
                  <div className="flex-1 h-1.5 rounded-full bg-white/[0.06]">
                    <div className="h-full rounded-full" style={{ width: `${(q.meanSixMWT / maxSixMWT) * 100}%`, background: quartileColors[i], opacity: 0.6 }} />
                  </div>
                  <span className="text-[9px] font-mono text-white w-10 text-right">{q.meanSixMWT}m</span>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ResearchBoardSection({ data }: { data: NonNullable<RegistryData['researchBoard']> }) {
  const consort = data.consort || { total: 228, excludedLvef: 0, excludedBnp: 0, excludedFunctional: 0, finalCohort: 228 }
  const subgroups = data.subgroups || {
    all: { gripBnp: 0, sixMwtBnp: 0, gripSixMwt: 0, n: 0 },
    male: { gripBnp: 0, sixMwtBnp: 0, gripSixMwt: 0, n: 0 },
    female: { gripBnp: 0, sixMwtBnp: 0, gripSixMwt: 0, n: 0 },
    ageYoung: { gripBnp: 0, sixMwtBnp: 0, gripSixMwt: 0, n: 0 },
    ageOld: { gripBnp: 0, sixMwtBnp: 0, gripSixMwt: 0, n: 0 },
    nyhaMild: { gripBnp: 0, sixMwtBnp: 0, gripSixMwt: 0, n: 0 },
    nyhaSevere: { gripBnp: 0, sixMwtBnp: 0, gripSixMwt: 0, n: 0 }
  }
  const pairedGrip = data.pairedGrip || {
    nPaired: 0,
    baselineMean: 0,
    followupMean: 0,
    meanDelta: 0,
    improvedCount: 0,
    stableCount: 0,
    declinedCount: 0,
    list: []
  }

  // Bins for Paired Grip Strength delta distribution
  const binnedGripDeltas = [
    { name: 'Decline (≤ -2kg)', value: pairedGrip.declinedCount, color: '#ef4444' },
    { name: 'Stable (-2 to 2)', value: pairedGrip.stableCount, color: '#3b82f6' },
    { name: 'Improve (≥ 2kg)', value: pairedGrip.improvedCount, color: '#10b981' }
  ].filter(x => x.value > 0)

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(139,92,246,0.3)' }}>
      {/* Header */}
      <div className="px-6 py-5" style={{ background: 'linear-gradient(135deg, rgba(109,40,217,0.25) 0%, rgba(139,92,246,0.1) 100%)', borderBottom: '1px solid rgba(139,92,246,0.2)' }}>
        <div className="flex items-start gap-4">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(139,92,246,0.2)', border: '1px solid rgba(139,92,246,0.35)' }}>
            <FlaskConical className="w-5 h-5" style={{ color: '#a78bfa' }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full" style={{ background: 'rgba(139,92,246,0.25)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.35)' }}>🔬 Research Board</span>
              <span className="text-[10px] font-semibold text-emerald-400">● Live Registry Data</span>
              <span className="text-[10px] text-gray-500">LVEF &lt;40% cohort · n={data.n} patients</span>
            </div>
            <h2 className="text-base font-bold text-white leading-snug">
              How does hand grip strength and 6MWT correlate with NT-proBNP levels in patients with moderate-to-severely depressed ejection fraction?
            </h2>
            <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">
              Analysis restricted to LVEF &lt;40% (HFrEF). Functional capacity assessed by hand grip dynamometry (right hand, kg) 
              and 6-minute walk test (metres). NT-proBNP used as biomarker of neurohormonal activation and hemodynamic stress. 
              NYHA class colour-coded to stratify severity.
            </p>
          </div>
        </div>

        {/* Research KPI strip */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-5">
          {[
            { label: 'Analytical Sample', value: data.n.toString(), sub: 'LVEF <40% + BNP + Func', color: '#a78bfa' },
            { label: 'Grip ↔ BNP', value: `ρ = ${data.spearmanGrip ? (data.spearmanGrip >= 0 ? '+' : '') + data.spearmanGrip.toFixed(3) : '—'}`, sub: 'Spearman correlation (ρ)', color: Math.abs(data.spearmanGrip || 0) > 0.4 ? '#ef4444' : '#f59e0b' },
            { label: '6MWT ↔ BNP', value: `ρ = ${data.spearmanSixMWT ? (data.spearmanSixMWT >= 0 ? '+' : '') + data.spearmanSixMWT.toFixed(3) : '—'}`, sub: 'Spearman correlation (ρ)', color: Math.abs(data.spearmanSixMWT || 0) > 0.4 ? '#ef4444' : '#f59e0b' },
            { label: 'Grip ↔ 6MWT', value: `r = ${data.pearsonGripSixMWT ? (data.pearsonGripSixMWT >= 0 ? '+' : '') + data.pearsonGripSixMWT.toFixed(3) : '—'}`, sub: 'Pearson correlation (r)', color: '#10b981' },
            { label: 'Paired Grip Cohort', value: `${pairedGrip.nPaired} pts`, sub: 'Baseline vs 3-mo follow-up', color: '#60a5fa' },
          ].map(kpi => (
            <div key={kpi.label} className="glass-card px-4 py-3" style={{ border: '1px solid rgba(139,92,246,0.15)' }}>
              <p className="text-lg font-bold font-mono leading-none" style={{ color: kpi.color }}>{kpi.value}</p>
              <p className="text-[11px] font-medium text-white mt-1">{kpi.label}</p>
              <p className="text-[10px] text-gray-500 mt-0.5">{kpi.sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Charts */}
      <div className="p-6 space-y-6" style={{ background: 'rgba(139,92,246,0.02)' }}>


        {/* ═══ Scatter plot carousel (one card visible at a time, horizontal scroll) ═══ */}
        <div>
          <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-3 px-1">
            Correlation Analysis — scroll to view all 3 charts →
          </p>
          <div
            className="flex gap-5 overflow-x-auto pb-3"
            style={{ scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch' }}
          >
            {[
              {
                title: '1. Grip Strength vs NT-proBNP',
                note: 'Right hand grip strength vs log10-transformed NT-proBNP',
                data: data.gripVsBnp,
                xLabel: 'Right Hand Grip (kg)',
                yLabel: 'log10 NT-proBNP (pg/mL)',
                r: data.spearmanGrip ?? data.pearsonGrip,
                isSpearman: true,
              },
              {
                title: '2. 6MWT Distance vs NT-proBNP',
                note: '6-minute walk test distance vs log10-transformed NT-proBNP',
                data: data.sixMwtVsBnp,
                xLabel: '6MWT Distance (m)',
                yLabel: 'log10 NT-proBNP (pg/mL)',
                r: data.spearmanSixMWT ?? data.pearsonSixMWT,
                isSpearman: true,
              },
              {
                title: '3. Grip Strength vs 6MWT Distance',
                note: 'Hand grip strength vs exercise tolerance (Normally distributed variables)',
                data: data.gripVs6MWT || [],
                xLabel: 'Right Hand Grip (kg)',
                yLabel: '6MWT Distance (m)',
                r: data.pearsonGripSixMWT ?? 0,
                isSpearman: false,
              },
            ].map((card, i) => (
              <div
                key={i}
                className="flex-shrink-0 w-[min(100%,480px)]"
                style={{ scrollSnapAlign: 'start' }}
              >
                <ResearchScatterCard {...card} />
              </div>
            ))}
          </div>
        </div>

        {/* ═══ Bivariate Stratifications (Quartiles & Follow-up Trajectory) ═══ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* NT-proBNP Quartiles */}
          {data.ntBnpQuartiles.length > 0 && data.n >= 4 && (
            <NtBnpQuartileCard quartiles={data.ntBnpQuartiles} />
          )}

          {/* Functional Trajectory (Paired Grip Strength changes at 3 months) */}
          <div className="p-5 rounded-2xl" style={{ border: '1px solid rgba(139,92,246,0.25)', background: 'rgba(139,92,246,0.04)' }}>
            <div className="flex items-start justify-between mb-1">
              <div>
                <p className="text-sm font-semibold text-white">Functional Trajectory: Paired Grip Strength</p>
                <p className="text-[11px] text-gray-400">Baseline inpatient vs 3-month OPD follow-up comparisons</p>
              </div>
              <div className="px-2 py-1 rounded bg-blue-500/10 text-blue-300 font-mono text-[10px] border border-blue-500/20">
                n = {pairedGrip.nPaired} patients
              </div>
            </div>

            {pairedGrip.nPaired === 0 ? (
              <div className="h-[240px] flex flex-col items-center justify-center text-center gap-2">
                <Microscope className="w-8 h-8 text-gray-600" />
                <p className="text-sm text-gray-500">No follow-up data available</p>
                <p className="text-xs text-gray-600">Ensure follow-up records are seeded properly</p>
              </div>
            ) : (
              <div className="space-y-4 mt-3">
                {/* Stats cards strip */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="glass-card p-2 text-center" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
                    <p className="text-xs text-gray-500">Baseline Mean</p>
                    <p className="text-sm font-bold font-mono text-white">{pairedGrip.baselineMean} kg</p>
                  </div>
                  <div className="glass-card p-2 text-center" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
                    <p className="text-xs text-gray-500">3-Month Mean</p>
                    <p className="text-sm font-bold font-mono text-white">{pairedGrip.followupMean} kg</p>
                  </div>
                  <div className="glass-card p-2 text-center" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
                    <p className="text-xs text-gray-500">Mean Change</p>
                    <p className="text-sm font-bold font-mono text-emerald-400">+{pairedGrip.meanDelta} kg</p>
                  </div>
                </div>

                {/* Progress bar split */}
                <div>
                  <div className="flex justify-between text-[10px] text-gray-400 mb-1.5">
                    <span>Improved (≥+2kg): <strong className="text-emerald-400">{pairedGrip.improvedCount}</strong></span>
                    <span>Stable: <strong className="text-blue-400">{pairedGrip.stableCount}</strong></span>
                    <span>Declined (≤-2kg): <strong className="text-red-400">{pairedGrip.declinedCount}</strong></span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden flex bg-white/[0.06]">
                    <div className="h-full bg-emerald-500" style={{ width: `${(pairedGrip.improvedCount / pairedGrip.nPaired) * 100}%` }} title="Improved" />
                    <div className="h-full bg-blue-500" style={{ width: `${(pairedGrip.stableCount / pairedGrip.nPaired) * 100}%` }} title="Stable" />
                    <div className="h-full bg-red-500" style={{ width: `${(pairedGrip.declinedCount / pairedGrip.nPaired) * 100}%` }} title="Declined" />
                  </div>
                </div>

                {/* Distribution chart of delta change */}
                <div className="space-y-1">
                  <p className="text-[10px] font-semibold text-white">Delta Distribution (Proportions)</p>
                  <ResponsiveContainer width="100%" height={110}>
                    <BarChart data={binnedGripDeltas}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 8, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 8, fill: '#94a3b8' }} tickLine={false} axisLine={false} allowDecimals={false} />
                      <Tooltip content={<DarkTip />} />
                      <Bar dataKey="value" maxBarSize={30}>
                        {binnedGripDeltas.map((entry, idx) => (
                          <Cell key={idx} fill={entry.color} opacity={0.8} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ═══ Subgroup Correlation Matrix ═══ */}
        <div className="p-5 rounded-2xl border border-violet-500/25 animate-fade-in" style={{ background: 'rgba(139,92,246,0.04)' }}>
          <p className="text-sm font-semibold text-white mb-1 flex items-center gap-1.5">
            <Info className="w-4 h-4 text-violet-400" />
            Subgroup Correlation Matrix (Covariate Stratification)
          </p>
          <p className="text-[11px] text-gray-400 mb-4">Correlation strength stability controlled across biological sex, age split (60 years), and functional NYHA severity</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-violet-500/20 text-gray-400 font-medium">
                  <th className="pb-2 pr-4">Subgroup Stratum</th>
                  <th className="pb-2 pr-4 text-center">Sample Size (n)</th>
                  <th className="pb-2 pr-4 text-center">Grip ↔ NT-proBNP (Spearman ρ)</th>
                  <th className="pb-2 pr-4 text-center">6MWT ↔ NT-proBNP (Spearman ρ)</th>
                  <th className="pb-2 text-center">Grip ↔ 6MWT (Pearson r)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {[
                  { label: 'All Patients', n: subgroups.all.n, c1: subgroups.all.gripBnp, c2: subgroups.all.sixMwtBnp, c3: subgroups.all.gripSixMwt, bold: true },
                  { label: 'Males', n: subgroups.male.n, c1: subgroups.male.gripBnp, c2: subgroups.male.sixMwtBnp, c3: subgroups.male.gripSixMwt },
                  { label: 'Females', n: subgroups.female.n, c1: subgroups.female.gripBnp, c2: subgroups.female.sixMwtBnp, c3: subgroups.female.gripSixMwt },
                  { label: 'Age < 60', n: subgroups.ageYoung.n, c1: subgroups.ageYoung.gripBnp, c2: subgroups.ageYoung.sixMwtBnp, c3: subgroups.ageYoung.gripSixMwt },
                  { label: 'Age ≥ 60', n: subgroups.ageOld.n, c1: subgroups.ageOld.gripBnp, c2: subgroups.ageOld.sixMwtBnp, c3: subgroups.ageOld.gripSixMwt },
                  { label: 'NYHA Class I–II', n: subgroups.nyhaMild.n, c1: subgroups.nyhaMild.gripBnp, c2: subgroups.nyhaMild.sixMwtBnp, c3: subgroups.nyhaMild.gripSixMwt },
                  { label: 'NYHA Class III–IV', n: subgroups.nyhaSevere.n, c1: subgroups.nyhaSevere.gripBnp, c2: subgroups.nyhaSevere.sixMwtBnp, c3: subgroups.nyhaSevere.gripSixMwt },
                ].map((row, idx) => {
                  const getBadgeColor = (val: number, testType: 'spearman' | 'pearson') => {
                    const absVal = Math.abs(val)
                    const isNegative = val < 0
                    if (absVal < 0.15) return 'text-gray-400 bg-gray-500/10'
                    if (isNegative) {
                      if (absVal > 0.45) return 'text-red-400 bg-red-500/10 font-bold border border-red-500/20'
                      return 'text-amber-400 bg-amber-500/10 font-medium'
                    } else {
                      if (absVal > 0.45) return 'text-emerald-400 bg-emerald-500/10 font-bold border border-emerald-500/20'
                      return 'text-blue-400 bg-blue-500/10 font-medium'
                    }
                  }
                  return (
                    <tr key={row.label} className={row.bold ? 'font-semibold text-white bg-white/[0.02]' : 'text-gray-300'}>
                      <td className="py-2.5 pr-4 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-violet-400/70" />
                        {row.label}
                      </td>
                      <td className="py-2.5 pr-4 text-center font-mono text-gray-400">{row.n}</td>
                      <td className="py-2.5 pr-4 text-center font-mono">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] ${getBadgeColor(row.c1, 'spearman')}`}>
                          {row.c1 >= 0 ? '+' : ''}{row.c1.toFixed(3)}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4 text-center font-mono">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] ${getBadgeColor(row.c2, 'spearman')}`}>
                          {row.c2 >= 0 ? '+' : ''}{row.c2.toFixed(3)}
                        </span>
                      </td>
                      <td className="py-2.5 text-center font-mono">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] ${getBadgeColor(row.c3, 'pearson')}`}>
                          {row.c3 >= 0 ? '+' : ''}{row.c3.toFixed(3)}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>


      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function RegistryDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router  = useRouter()
  const { user, currentUser } = useAppUser()
  const [patients, setPatients] = useState<Patient[]>([])
  const [visits, setVisits] = useState<Visit[]>([])
  const [procedures, setProcedures] = useState<CathProcedure[]>([])
  const [loading, setLoading] = useState(true)
  const [isProcModalOpen, setIsProcModalOpen] = useState(false)
  const [selectedProcPatient, setSelectedProcPatient] = useState<Patient | null>(null)
  const [selectedProc, setSelectedProc] = useState<CathProcedure | null>(null)

  // ── Access control gate ───────────────────────────────────────────────────
  // User context is hydrated client-side; wait until user is loaded.
  const accessGranted = user === null ? null : canAccessRegistry(user, id)
  const registryMeta  = REGISTRY_CONFIG[id]


  useEffect(() => {
    if (id !== 'hf' && id !== 'cathlab') {
      setLoading(false)
      return
    }
    setLoading(true)
    let unsubPatients: (() => void) | null = null
    let unsubVisits: (() => void) | null = null
    let unsubProcedures: (() => void) | null = null

    try {
      unsubPatients = subscribePatients((pts) => {
        setPatients(pts)
        setLoading(false)
      })
      unsubVisits = subscribeVisits((vts) => {
        setVisits(vts)
      })
      unsubProcedures = subscribeCathProcedures((procs) => {
        setProcedures(procs)
      })
    } catch (err) {
      console.error('Failed to load dynamic registry data:', err)
      setLoading(false)
    }

    return () => {
      if (unsubPatients) unsubPatients()
      if (unsubVisits) unsubVisits()
      if (unsubProcedures) unsubProcedures()
    }
  }, [id])

  const reg = useMemo(() => {
    if (id === 'cathlab') {
      return computeCathlabRegistry(procedures)
    }
    if (id === 'acs') {
      return computeAcsRegistry(patients, visits, procedures)
    }
    if (id === 'hf') {
      return computeHfRegistry(patients, visits)
    }
    return null
  }, [id, patients, visits, procedures])

  // Explicit handling for uncomputed registries or not-yet-collecting-data states
  const uncollectedRegistries: Record<string, { name: string; desc: string }> = {
    arrhythmia: { name: 'Arrhythmia & EP Registry', desc: 'AF · VT · Bradyarrhythmia · Ablation · Devices' },
    structural: { name: 'Structural Heart Disease', desc: 'Valvular · Cardiomyopathy · Congenital · TAVI/TMVR' },
    preventive: { name: 'Preventive Cardiology', desc: 'Risk Stratification · Lifestyle · Primary Prevention' },
  }

  if (id && typeof id === 'string' && uncollectedRegistries[id]) {
    const info = uncollectedRegistries[id]
    return (
      <div className="space-y-6 animate-fade-in text-gray-300">
        <div className="glass-card p-6 border border-amber-500/20 space-y-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => router.push('/registry-home')}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white"
            >
              <ArrowLeft size={13} /> Registry Home
            </button>
            <span className="text-xs px-3 py-1 rounded-full border font-semibold bg-amber-500/15 text-amber-300 border-amber-500/30">
              Not yet collecting data
            </span>
          </div>

          <div>
            <h1 className="text-xl font-bold text-white">{info.name}</h1>
            <p className="text-xs text-gray-400 mt-1">{info.desc}</p>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/60 border border-white/10 space-y-2">
            <div className="flex items-center gap-2 text-amber-400 font-semibold text-sm">
              <AlertTriangle className="w-4 h-4" />
              <span>Truth in Reporting Protocol</span>
            </div>
            <p className="text-xs text-gray-300 leading-relaxed">
              No live Case Report Form (CRF) or active data feed is currently configured for this registry. In accordance with clinical data integrity standards, CardioKonnect does not display fabricated benchmarks or placeholder statistics. Data collection will activate upon release of this dedicated module.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // ── Access denied gate ────────────────────────────────────────────────────
  if (accessGranted === false) {
    const piName = registryMeta?.piName ?? 'the Registry PI'
    const siteName = registryMeta ? SITES[registryMeta.siteId]?.name : undefined
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-5 text-center px-6">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
          <Lock className="w-7 h-7 text-rose-400" />
        </div>
        <div className="max-w-md space-y-2">
          <h2 className="text-lg font-bold text-white">Access Restricted</h2>
          <p className="text-sm text-gray-400">
            You do not have permission to view this registry&apos;s analytics.
          </p>
          {registryMeta && (
            <div className="mt-3 p-3 rounded-xl border text-left space-y-1.5"
              style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.08)' }}>
              <p className="text-xs text-gray-300">
                <span className="text-gray-500">Registry: </span>{registryMeta.name}
              </p>
              <p className="text-xs text-gray-300">
                <span className="text-gray-500">PI: </span>{piName}
              </p>
              {siteName && (
                <p className="text-xs text-gray-300">
                  <span className="text-gray-500">Site: </span>{siteName}
                </p>
              )}
              <p className="text-xs text-gray-500 mt-2">
                Contact {piName} or the system administrator to request access.
              </p>
            </div>
          )}
        </div>
        <button
          onClick={() => router.push('/registry-home')}
          className="flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-xl transition-colors"
          style={{ background: 'rgba(59,130,246,0.15)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.25)' }}
        >
          <ArrowLeft size={13} /> Back to Registry Home
        </button>
      </div>
    )
  }

  if (loading && (id === 'hf' || id === 'cathlab')) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3">
        <Activity className="w-8 h-8 text-blue-500 animate-spin" />
        <p className="text-sm text-gray-400">Loading dynamic registry statistics...</p>
      </div>
    )
  }

  if (!reg) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4 text-center">
        <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-400 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <div>
          <h3 className="text-base font-bold text-white">Registry Analytics Unavailable</h3>
          <p className="text-gray-400 text-xs mt-1 max-w-md">
            Unable to compute live registry metrics for this module. Fabricated fallback data has been disabled.
          </p>
        </div>
        <button onClick={() => router.push('/registry-home')} className="text-blue-400 text-xs underline">
          Back to Registry Home
        </button>
      </div>
    )
  }

  const statusColor: Record<string, string> = {
    Active:    'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
    Enrolling: 'bg-blue-500/15 text-blue-400 border-blue-500/25',
    Suspended: 'bg-red-500/15 text-red-400 border-red-500/25',
  }

  const currentRegConfig = id && REGISTRY_CONFIG[id] ? REGISTRY_CONFIG[id] : null
  const regSite = currentRegConfig?.siteId ? SITES[currentRegConfig.siteId] : null
  const isCurrentPI = currentUser?.id === currentRegConfig?.piId

  return (
    <div className="space-y-6 animate-fade-in">

      {/* ── Header ── */}
      <div className="glass-card overflow-hidden border border-blue-500/10">
        <div className="px-6 py-5 flex flex-col md:flex-row md:items-center gap-4" style={{ background: reg.gradient }}>
          <button
            onClick={() => router.push('/registry-home')}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg self-start md:self-auto transition-colors hover:bg-white/20"
            style={{ background: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.9)' }}
          >
            <ArrowLeft size={13} /> Registry Home
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-white">{reg.name}</h1>
            <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.85)' }}>{reg.shortDesc}</p>
          </div>
          <div className="flex items-center gap-3 self-start md:self-auto flex-wrap">
            {/* Registry Owner (PI) badge */}
            {currentRegConfig && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                style={{ background: 'rgba(255,255,255,0.18)', color: '#ffffff' }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                <span className="opacity-80 font-normal">{currentRegConfig.piRoleTitle || 'PI'}</span>
                <span>{currentRegConfig.piName}</span>
              </div>
            )}
            <Link
              href={`/patients/new?registry=${id}`}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg text-white transition-colors hover:bg-white/30"
              style={{ background: 'rgba(255,255,255,0.2)' }}
            >
              <PlusCircle size={13} /> Register Patient
            </Link>
            <span className={cn('text-xs px-3 py-1 rounded-full border font-medium', statusColor[reg.status])}>
              {reg.status}
            </span>
          </div>
        </div>

        {/* Doctor / PI Registry Welcome Message Banner */}
        <div className="px-6 py-3.5 bg-gray-950/70 border-b border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white shadow-sm flex-shrink-0"
              style={{ background: currentRegConfig?.gradient || reg.gradient }}>
              {currentRegConfig?.piName ? currentRegConfig.piName.split(' ').map(n => n[0]).join('').slice(0, 2) : 'DR'}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-white text-sm">
                  {isCurrentPI ? `Welcome, ${currentRegConfig?.piName}` : `Welcome to ${reg.name}`}
                </span>
                <span className="badge badge-amber text-[10px] font-bold">
                  {currentRegConfig?.piRoleTitle || 'PI'}: {currentRegConfig?.piName}
                </span>
                <span className="badge badge-gray text-[10px]">
                  {regSite?.shortName || 'AICTS Pune'}
                </span>
              </div>
              <p className="text-gray-300 mt-0.5 text-[11px] leading-relaxed">
                {currentRegConfig?.welcomeMessage || reg.shortDesc}
              </p>
            </div>
          </div>
          {currentUser && (
            <div className="flex items-center gap-1.5 text-gray-400 self-end sm:self-auto flex-shrink-0 text-[11px]">
              <span>Active session:</span>
              <span className="text-gray-200 font-semibold">{currentUser.name}</span>
              <span className="text-blue-400 font-mono">({currentUser.role})</span>
            </div>
          )}
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-2 md:grid-cols-5 divide-x divide-y md:divide-y-0 divide-white/[0.06]">
          {reg.kpis.map(kpi => (
            <div key={kpi.label} className="px-5 py-4">
              <p className="text-2xl font-bold text-white">{kpi.value}</p>
              <p className="text-xs text-gray-400 mt-0.5">{kpi.label}</p>
              {kpi.sub && <p className="text-[10px] text-gray-500 mt-0.5">{kpi.sub}</p>}
            </div>
          ))}
        </div>
      </div>

      {/* ── Summary stats ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Enrolled Patients',   value: reg.patients.toLocaleString(), icon: Users,        color: 'text-blue-400',    bg: 'bg-blue-500/10' },
          { label: 'Fields Captured',     value: `${reg.fieldsCaptured} / ${reg.fieldsTotal}`,      icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
          { label: 'Data Completion',     value: `${reg.completion}%`,          icon: TrendingUp,   color: 'text-violet-400',  bg: 'bg-violet-500/10' },
          { label: 'New This Month',      value: `+${reg.newThisMonth}`,        icon: Clock,        color: 'text-amber-400',   bg: 'bg-amber-500/10' },
        ].map(s => (
          <div key={s.label} className="glass-card p-4 flex items-center gap-3 border border-blue-500/10">
            <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0', s.bg)}>
              <s.icon className={s.color} size={18} />
            </div>
            <div>
              <p className="text-xs text-gray-400">{s.label}</p>
              <p className="text-xl font-bold text-white">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Data quality + enrollment trend ── */}
      <div className={cn("grid gap-5", id === 'hf' ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2")}>
        <CompletionBars categories={reg.completionByCategory} accentColor={reg.accentColor} />
        {id !== 'hf' && <EnrollmentTrend data={reg.enrollmentTrend} accentColor={reg.accentColor} />}
      </div>

      {/* ── Clinical analytics ── */}
      <div>
        <SectionHeader title="Clinical Analytics" color={reg.accentColor} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {reg.clinicalCharts
            .filter(chart => {
              if (id === 'hf') {
                return !['HF Phenotype Distribution', 'NYHA Functional Class', 'LVEF Distribution', 'Symptoms & Signs Prevalence (%)'].includes(chart.title)
              }
              return true
            })
            .map(chart => {
              if (chart.type === 'pie')   return <PieChartCard key={chart.title} title={chart.title} data={chart.data} />
              if (chart.type === 'bar-h') return <BarHCard    key={chart.title} title={chart.title} data={chart.data} color={chart.color ?? reg.accentColor} />
              if (chart.type === 'bar-v') return <BarVCard    key={chart.title} title={chart.title} data={chart.data} color={chart.color ?? reg.accentColor} />
              return null
            })}
        </div>
      </div>

      {/* ══ CATH LAB PROCEDURES & INTERVENTIONS REGISTRY TABLE ══ */}
      {id === 'cathlab' && (
        <div className="rounded-2xl border border-amber-500/20 bg-slate-900/60 p-6 space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-white/10">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Cath Lab Interventional Registry
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30">
                  {procedures.length} Procedures Logged
                </span>
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                NCDR CathPCI & NIC India procedure-level audit and device tracking
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/patients/new?registry=cathlab"
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl text-white transition-all bg-slate-800 hover:bg-slate-700 border border-white/10"
              >
                <PlusCircle size={14} /> Enroll Patient
              </Link>
              {patients.length > 0 && (
                <button
                  onClick={() => {
                    setSelectedProc(null)
                    setSelectedProcPatient(patients[0])
                    setIsProcModalOpen(true)
                  }}
                  className="flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-xl text-slate-950 transition-all bg-amber-400 hover:bg-amber-300 shadow-md font-bold"
                >
                  <PlusCircle size={14} /> Log Interventional Procedure
                </button>
              )}
            </div>
          </div>

          {procedures.length === 0 ? (
            <div className="text-center py-12 space-y-3 bg-slate-950/40 rounded-xl border border-dashed border-white/10">
              <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto">
                <Activity className="w-6 h-6" />
              </div>
              <p className="text-white font-semibold text-sm">No Interventional Procedures Recorded Yet</p>
              <p className="text-xs text-gray-400 max-w-md mx-auto">
                Cath Lab & Interventional quality indicators are computed live from authentic catheterization & PCI records. Navigate to any patient chart to log a procedure, or click &quot;Log Interventional Procedure&quot; above.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-gray-300">
                <thead className="bg-white/[0.04] text-gray-400 font-semibold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-3">Date / Time</th>
                    <th className="py-3 px-3">Patient / MRN</th>
                    <th className="py-3 px-3">Procedure & Indication</th>
                    <th className="py-3 px-3">Access & Hardware</th>
                    <th className="py-3 px-3">Target Lesions & Devices</th>
                    <th className="py-3 px-3">Post-TIMI / Outcome</th>
                    <th className="py-3 px-3">Complications</th>
                    <th className="py-3 px-3">Operator</th>
                    <th className="py-3 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.05]">
                  {procedures.map((proc) => {
                    const procPatient = patients.find(p => p.id === proc.patientId)
                    const lesions = proc.lesions || []
                    const hasComp = proc.complications?.hasComplication
                    return (
                      <tr key={proc.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-3 px-3 whitespace-nowrap text-gray-300 font-mono text-[11px]">
                          {proc.procedureDate ? new Date(proc.procedureDate).toLocaleDateString() : '—'}
                          <p className="text-[10px] text-gray-500">{proc.procedureDate ? new Date(proc.procedureDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</p>
                        </td>
                        <td className="py-3 px-3">
                          {procPatient ? (
                            <Link href={`/patients/${procPatient.id}`} className="font-semibold text-white hover:text-amber-400 transition-colors">
                              {procPatient.firstName} {procPatient.lastName}
                            </Link>
                          ) : (
                            <span className="font-semibold text-white">Patient #{proc.patientId.slice(0, 8)}</span>
                          )}
                          <p className="text-[10px] text-gray-500 font-mono mt-0.5">MRN: {procPatient?.mrn || '—'}</p>
                        </td>
                        <td className="py-3 px-3">
                          <span className="font-medium text-white">{proc.procedureType}</span>
                          <p className="text-[10px] text-amber-400/90 font-medium">{proc.clinicalIndication}</p>
                        </td>
                        <td className="py-3 px-3">
                          <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-medium text-[10px]">
                            {proc.accessSite} ({proc.sheathSize})
                          </span>
                          <p className="text-[10px] text-gray-500 mt-0.5">{proc.closureDevice}</p>
                        </td>
                        <td className="py-3 px-3">
                          <div className="space-y-1">
                            {lesions.length === 0 ? (
                              <span className="text-gray-500 text-[10px]">Diagnostic / No Stents</span>
                            ) : (
                              lesions.map((l, i) => (
                                <div key={i} className="flex items-center gap-1.5 text-[10px]">
                                  <span className="font-bold text-amber-300">{l.vessel}</span>
                                  <span className="text-gray-400">{l.preStenosisPct}% → {l.postStenosisPct}%</span>
                                  {l.devices && l.devices.length > 0 && (
                                    <span className="text-gray-400">({l.devices.map(d => `${d.deviceType} ${d.diameterMm}×${d.lengthMm}`).join(', ')})</span>
                                  )}
                                </div>
                              ))
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          {proc.overallSuccess ? (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold text-[10px] border border-emerald-500/30">
                              Success (TIMI 3)
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-semibold text-[10px] border border-amber-500/30">
                              Sub-optimal / Staged
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          {hasComp ? (
                            <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-semibold text-[10px] border border-rose-500/30">
                              Adverse Event Recorded
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-slate-800 text-gray-400 text-[10px] border border-white/5">
                              0 Events
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-gray-300">
                          {proc.operatorName}
                          {proc.siteId && <p className="text-[10px] text-gray-500 font-mono">{proc.siteId}</p>}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button
                            onClick={() => {
                              setSelectedProc(proc)
                              setSelectedProcPatient(procPatient || { id: proc.patientId, firstName: 'Patient', lastName: proc.patientId.slice(0, 6) } as any)
                              setIsProcModalOpen(true)
                            }}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-400 hover:text-amber-300 transition-colors"
                          >
                            Edit / View <ArrowRight size={11} />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ══ CATH LAB QUALITY & STATISTICAL BENCHMARKING (NCDR / BCIS) ══ */}
      {id === 'cathlab' && (
        <CathStatisticalBenchmarking procedures={procedures} />
      )}

      {/* ══ DEMOGRAPHICS & COMORBIDITY ══ */}
      {id === 'hf' && reg.comorbidityData && reg.comorbidityData.length > 0 && (
        <div>
          <SectionHeader title="Demographics & Comorbidity Profile" color="#f59e0b" subtitle="Population characteristics and cardiovascular risk burden" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {reg.ageData && <BarVCard title="Age Distribution (years)" data={reg.ageData} color="#8b5cf6" />}
            {reg.sexData && <PieChartCard title="Sex Distribution" data={reg.sexData} />}
            <BarHCard title="Comorbidity Prevalence (% of cohort)" data={reg.comorbidityData} color="#f59e0b" />
          </div>
        </div>
      )}

      {/* ══ BIOMARKER & RENAL PROFILE ══ */}
      {id === 'hf' && (reg.ntBnpData || reg.egfrData) && (
        <div>
          <SectionHeader title="Biomarker & Renal Profile" color="#ef4444" subtitle="NT-proBNP neurohormonal activation · eGFR renal function staging (KDIGO)" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {reg.ntBnpData && <BarVCard title="NT-proBNP Distribution (pg/mL)" data={reg.ntBnpData} color="#ef4444" />}
            {reg.egfrData && <BarVCard title="eGFR / CKD Stage (mL/min/1.73m²)" data={reg.egfrData} color="#8b5cf6" />}
          </div>
        </div>
      )}

      {/* ══ ECG PROFILE & DEVICE THERAPY ══ */}
      {id === 'hf' && (reg.bbbData || reg.deviceData) && (
        <div>
          <SectionHeader title="ECG Profile & Device Therapy" color="#06b6d4" subtitle="Conduction disease burden and implanted device rates" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {reg.bbbData && <PieChartCard title="Bundle Branch Block Pattern" data={reg.bbbData} />}
            {reg.qrsData && <BarVCard title="QRS Duration — CRT Eligibility" data={reg.qrsData} color="#06b6d4" />}
            {reg.deviceData && <PieChartCard title="Device Therapy (ICD / CRT)" data={reg.deviceData} />}
          </div>
        </div>
      )}

      {/* ══ FUNCTIONAL CAPACITY & VACCINATION ══ */}
      {id === 'hf' && (reg.sixMwtData || reg.vaccinationData) && (
        <div>
          <SectionHeader title="Functional Capacity & Preventive Care" color="#10b981" subtitle="6MWT exercise tolerance distribution · vaccination quality indicators" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {reg.sixMwtData && <BarVCard title="6-Minute Walk Test Distribution (metres)" data={reg.sixMwtData} color="#10b981" />}
            {reg.vaccinationData && <BarHCard title="Vaccination Uptake (% of visits)" data={reg.vaccinationData} color="#34d399" />}
          </div>
        </div>
      )}

      {/* ══ RESEARCH BOARD ══ */}
      {id === 'hf' && reg.researchBoard && (
        <ResearchBoardSection data={reg.researchBoard} />
      )}

      {/* Procedure Modal */}
      {isProcModalOpen && selectedProcPatient && (
        <CathProcedureModal
          isOpen={isProcModalOpen}
          onClose={() => {
            setIsProcModalOpen(false)
            setSelectedProc(null)
          }}
          patient={selectedProcPatient}
          procedureToEdit={selectedProc}
          onSaved={() => {}}
        />
      )}

    </div>
  )
}
