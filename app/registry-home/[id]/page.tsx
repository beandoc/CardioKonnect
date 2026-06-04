'use client'
import { useParams, useRouter } from 'next/navigation'
import { useState, useEffect, useMemo } from 'react'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import Link from 'next/link'
import { ArrowLeft, Users, CheckCircle, TrendingUp, Clock, Activity, PlusCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getPatients, getVisits } from '@/lib/firestore'
import type { Patient, Visit } from '@/lib/types'

// ─── Types ────────────────────────────────────────────────────────────────────
interface ChartItem { name: string; value: number }

interface ClinicalChart {
  title: string
  type: 'pie' | 'bar-h' | 'bar-v'
  color?: string
  data: ChartItem[]
}

interface RegistryData {
  id: string
  name: string
  shortDesc: string
  gradient: string
  accentColor: string
  ringColor: string
  patients: number
  newThisMonth: number
  completion: number
  fieldsTotal: number
  fieldsCaptured: number
  status: 'Active' | 'Enrolling' | 'Suspended'
  kpis: { label: string; value: string; sub?: string }[]
  completionByCategory: { name: string; pct: number }[]
  enrollmentTrend: { month: string; count: number }[]
  clinicalCharts: ClinicalChart[]
}

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

  acs: {
    id: 'acs',
    name: 'ACS & Coronary Registry',
    shortDesc: 'STEMI · NSTEMI · Unstable Angina · Stable CAD',
    gradient: 'linear-gradient(135deg, #b91c1c 0%, #ef4444 100%)',
    accentColor: '#ef4444',
    ringColor: '#f87171',
    patients: 248,
    newThisMonth: 14,
    completion: 88,
    fieldsTotal: 48,
    fieldsCaptured: 42,
    status: 'Active',
    kpis: [
      { label: 'DTB < 90 min', value: '82%', sub: 'STEMI cases' },
      { label: 'TIMI 3 Flow', value: '91%', sub: 'post-PCI' },
      { label: 'DAPT Rate', value: '96%', sub: 'at discharge' },
      { label: '30-Day MACE', value: '4.8%', sub: 'observed rate' },
    ],
    completionByCategory: [
      { name: 'Demographics', pct: 97 },
      { name: 'Vitals & Exam', pct: 94 },
      { name: 'Cath / Angio', pct: 89 },
      { name: 'Laboratory', pct: 88 },
      { name: 'Medications', pct: 91 },
      { name: 'Outcomes', pct: 71 },
    ],
    enrollmentTrend: [
      { month: 'Jan', count: 189 }, { month: 'Feb', count: 201 }, { month: 'Mar', count: 211 },
      { month: 'Apr', count: 223 }, { month: 'May', count: 234 }, { month: 'Jun', count: 248 },
    ],
    clinicalCharts: [
      {
        title: 'Presentation Type',
        type: 'pie',
        data: [
          { name: 'STEMI', value: 89 },
          { name: 'NSTEMI', value: 112 },
          { name: 'Unstable Angina', value: 47 },
        ],
      },
      {
        title: 'Culprit Vessel',
        type: 'bar-h',
        color: '#f87171',
        data: [
          { name: 'LAD', value: 98 },
          { name: 'RCA', value: 84 },
          { name: 'LCx', value: 52 },
          { name: 'LM', value: 14 },
        ],
      },
      {
        title: 'Door-to-Balloon Time (min)',
        type: 'bar-v',
        color: '#ef4444',
        data: [
          { name: '< 60', value: 52 },
          { name: '60–90', value: 91 },
          { name: '90–120', value: 63 },
          { name: '> 120', value: 42 },
        ],
      },
      {
        title: 'Discharge Medications (%)',
        type: 'bar-h',
        color: '#fca5a5',
        data: [
          { name: 'Aspirin', value: 98 },
          { name: 'P2Y12 inhibitor', value: 96 },
          { name: 'High-dose Statin', value: 94 },
          { name: 'Beta-Blocker', value: 88 },
          { name: 'ACEi / ARB', value: 81 },
        ],
      },
    ],
  },

  arrhythmia: {
    id: 'arrhythmia',
    name: 'Arrhythmia & EP Registry',
    shortDesc: 'AF · VT · Bradyarrhythmia · Ablation · Devices',
    gradient: 'linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%)',
    accentColor: '#8b5cf6',
    ringColor: '#a78bfa',
    patients: 187,
    newThisMonth: 9,
    completion: 81,
    fieldsTotal: 44,
    fieldsCaptured: 36,
    status: 'Active',
    kpis: [
      { label: 'AF Burden Tracked', value: '74%', sub: 'Holter / device' },
      { label: 'Device Interrogation', value: '86%', sub: 'within 6 months' },
      { label: 'OAC Rate (AF)', value: '78%', sub: 'CHA₂DS₂-VASc ≥ 2' },
      { label: 'Ablation Success', value: '71%', sub: 'SR at 12 months' },
    ],
    completionByCategory: [
      { name: 'Demographics', pct: 99 },
      { name: 'ECG / Holter', pct: 83 },
      { name: 'Echo', pct: 71 },
      { name: 'Laboratory', pct: 79 },
      { name: 'Medications', pct: 86 },
      { name: 'Device Data', pct: 68 },
    ],
    enrollmentTrend: [
      { month: 'Jan', count: 142 }, { month: 'Feb', count: 151 }, { month: 'Mar', count: 159 },
      { month: 'Apr', count: 167 }, { month: 'May', count: 178 }, { month: 'Jun', count: 187 },
    ],
    clinicalCharts: [
      {
        title: 'Arrhythmia Type',
        type: 'pie',
        data: [
          { name: 'Paroxysmal AF', value: 52 },
          { name: 'Persistent AF', value: 37 },
          { name: 'VT / VF', value: 31 },
          { name: 'Bradyarrhythmia', value: 44 },
          { name: 'Other', value: 23 },
        ],
      },
      {
        title: 'Device Therapy',
        type: 'bar-h',
        color: '#a78bfa',
        data: [
          { name: 'No Device', value: 94 },
          { name: 'Pacemaker (PPM)', value: 38 },
          { name: 'ICD', value: 29 },
          { name: 'CRT-P', value: 14 },
          { name: 'CRT-D', value: 12 },
        ],
      },
      {
        title: 'OAC Prescribing (AF patients)',
        type: 'pie',
        data: [
          { name: 'NOAC', value: 101 },
          { name: 'Warfarin', value: 37 },
          { name: 'No OAC – low risk', value: 31 },
          { name: 'Contraindicated', value: 18 },
        ],
      },
      {
        title: 'AF Burden (Holter / Device)',
        type: 'bar-v',
        color: '#8b5cf6',
        data: [
          { name: '< 1%', value: 28 },
          { name: '1–10%', value: 34 },
          { name: '10–50%', value: 41 },
          { name: '> 50%', value: 36 },
        ],
      },
    ],
  },

  structural: {
    id: 'structural',
    name: 'Structural Heart Disease',
    shortDesc: 'Valvular · Cardiomyopathy · Congenital · TAVI/TMVR',
    gradient: 'linear-gradient(135deg, #0e7490 0%, #06b6d4 100%)',
    accentColor: '#06b6d4',
    ringColor: '#22d3ee',
    patients: 143,
    newThisMonth: 6,
    completion: 80,
    fieldsTotal: 46,
    fieldsCaptured: 37,
    status: 'Enrolling',
    kpis: [
      { label: 'Severe Valve Disease', value: '53%', sub: 'MR + AS combined' },
      { label: 'Intervention Rate', value: '38%', sub: 'surgical or transcath' },
      { label: 'LVEF ≥ 50%', value: '61%', sub: 'preserved function' },
      { label: 'Readmission 30d', value: '8.4%', sub: 'post-intervention' },
    ],
    completionByCategory: [
      { name: 'Demographics', pct: 96 },
      { name: 'Echo / Imaging', pct: 88 },
      { name: 'Advanced Imaging', pct: 72 },
      { name: 'Laboratory', pct: 81 },
      { name: 'Medications', pct: 79 },
      { name: 'Outcomes', pct: 64 },
    ],
    enrollmentTrend: [
      { month: 'Jan', count: 106 }, { month: 'Feb', count: 113 }, { month: 'Mar', count: 119 },
      { month: 'Apr', count: 127 }, { month: 'May', count: 137 }, { month: 'Jun', count: 143 },
    ],
    clinicalCharts: [
      {
        title: 'Primary Valve / Structural Lesion',
        type: 'pie',
        data: [
          { name: 'Mitral Regurgitation', value: 54 },
          { name: 'Aortic Stenosis', value: 63 },
          { name: 'Mitral Stenosis', value: 14 },
          { name: 'Aortic Regurgitation', value: 12 },
          { name: 'Cardiomyopathy', value: 26 },
        ],
      },
      {
        title: 'Disease Severity',
        type: 'bar-v',
        color: '#06b6d4',
        data: [
          { name: 'Mild', value: 38 },
          { name: 'Moderate', value: 52 },
          { name: 'Severe', value: 53 },
        ],
      },
      {
        title: 'Treatment Strategy',
        type: 'pie',
        data: [
          { name: 'Medical Management', value: 88 },
          { name: 'Surgical Valve', value: 29 },
          { name: 'TAVI', value: 18 },
          { name: 'TMVR / MitraClip', value: 8 },
        ],
      },
      {
        title: 'Echo Follow-up Compliance (%)',
        type: 'bar-h',
        color: '#22d3ee',
        data: [
          { name: 'Baseline Echo', value: 96 },
          { name: '3-Month Echo', value: 84 },
          { name: '12-Month Echo', value: 71 },
          { name: 'Stress Echo', value: 52 },
          { name: 'CMR', value: 38 },
        ],
      },
    ],
  },

  cathlab: {
    id: 'cathlab',
    name: 'Cath Lab & Interventional',
    shortDesc: 'PCI · CABG Referral · Structural Interventions',
    gradient: 'linear-gradient(135deg, #b45309 0%, #f59e0b 100%)',
    accentColor: '#f59e0b',
    ringColor: '#fbbf24',
    patients: 201,
    newThisMonth: 11,
    completion: 88,
    fieldsTotal: 50,
    fieldsCaptured: 44,
    status: 'Active',
    kpis: [
      { label: 'PCI Success Rate', value: '94%', sub: 'TIMI 3 post-PCI' },
      { label: 'Multi-vessel PCI', value: '42%', sub: 'of all PCI cases' },
      { label: 'SYNTAX > 22', value: '31%', sub: 'intermediate–high' },
      { label: 'Major Complications', value: '2.1%', sub: 'in-lab events' },
    ],
    completionByCategory: [
      { name: 'Demographics', pct: 98 },
      { name: 'Procedure Data', pct: 94 },
      { name: 'Angiography', pct: 91 },
      { name: 'PCI / Devices', pct: 88 },
      { name: 'Complications', pct: 83 },
      { name: 'Follow-up', pct: 72 },
    ],
    enrollmentTrend: [
      { month: 'Jan', count: 152 }, { month: 'Feb', count: 163 }, { month: 'Mar', count: 172 },
      { month: 'Apr', count: 182 }, { month: 'May', count: 190 }, { month: 'Jun', count: 201 },
    ],
    clinicalCharts: [
      {
        title: 'Procedure Type',
        type: 'pie',
        data: [
          { name: 'Diagnostic Angio', value: 68 },
          { name: 'PCI – Elective', value: 54 },
          { name: 'PCI – Urgent / Primary', value: 58 },
          { name: 'Structural Intervention', value: 21 },
        ],
      },
      {
        title: 'Coronary Disease Extent',
        type: 'bar-v',
        color: '#f59e0b',
        data: [
          { name: 'Normal / Non-obstructive', value: 29 },
          { name: '1-Vessel Disease', value: 78 },
          { name: '2-Vessel Disease', value: 55 },
          { name: '3-Vessel Disease', value: 39 },
        ],
      },
      {
        title: 'SYNTAX Score Distribution',
        type: 'pie',
        data: [
          { name: 'Low (< 22)', value: 89 },
          { name: 'Intermediate (22–32)', value: 73 },
          { name: 'High (> 32)', value: 39 },
        ],
      },
      {
        title: 'Contrast Volume (mL)',
        type: 'bar-v',
        color: '#fbbf24',
        data: [
          { name: '< 100', value: 64 },
          { name: '100–200', value: 93 },
          { name: '200–300', value: 34 },
          { name: '> 300', value: 10 },
        ],
      },
    ],
  },

  preventive: {
    id: 'preventive',
    name: 'Preventive Cardiology',
    shortDesc: 'Risk Stratification · Lifestyle · Primary Prevention',
    gradient: 'linear-gradient(135deg, #065f46 0%, #10b981 100%)',
    accentColor: '#10b981',
    ringColor: '#34d399',
    patients: 156,
    newThisMonth: 8,
    completion: 85,
    fieldsTotal: 42,
    fieldsCaptured: 36,
    status: 'Enrolling',
    kpis: [
      { label: 'High-Intensity Statin', value: '88%', sub: 'LDL ≥ 1.8 mmol/L target' },
      { label: 'BP Control', value: '71%', sub: '< 140/90 mmHg' },
      { label: 'DM Control', value: '64%', sub: 'HbA1c < 7%' },
      { label: 'MACE-Free at 2y', value: '91%', sub: 'event-free survival' },
    ],
    completionByCategory: [
      { name: 'Demographics', pct: 99 },
      { name: 'Risk Factors', pct: 92 },
      { name: 'Laboratory', pct: 87 },
      { name: 'Lifestyle Data', pct: 78 },
      { name: 'Medications', pct: 83 },
      { name: 'Follow-up', pct: 69 },
    ],
    enrollmentTrend: [
      { month: 'Jan', count: 112 }, { month: 'Feb', count: 120 }, { month: 'Mar', count: 128 },
      { month: 'Apr', count: 137 }, { month: 'May', count: 148 }, { month: 'Jun', count: 156 },
    ],
    clinicalCharts: [
      {
        title: 'CV Risk Category',
        type: 'pie',
        data: [
          { name: 'Low (< 5%)', value: 23 },
          { name: 'Intermediate (5–10%)', value: 67 },
          { name: 'High (10–20%)', value: 52 },
          { name: 'Very High (> 20%)', value: 14 },
        ],
      },
      {
        title: 'Risk Factor Prevalence (%)',
        type: 'bar-h',
        color: '#10b981',
        data: [
          { name: 'Hypertension', value: 72 },
          { name: 'Dyslipidemia', value: 68 },
          { name: 'Diabetes Mellitus', value: 41 },
          { name: 'Current Smoking', value: 29 },
          { name: 'Obesity (BMI > 30)', value: 38 },
          { name: 'CKD', value: 18 },
        ],
      },
      {
        title: 'Target Achievement Rate (%)',
        type: 'bar-h',
        color: '#34d399',
        data: [
          { name: 'BP < 140/90', value: 71 },
          { name: 'LDL < 1.8 mmol/L', value: 58 },
          { name: 'HbA1c < 7%', value: 64 },
          { name: 'BMI < 25', value: 34 },
          { name: 'Non-smoker', value: 83 },
        ],
      },
      {
        title: 'Lifestyle Intervention Uptake',
        type: 'bar-v',
        color: '#6ee7b7',
        data: [
          { name: 'Dietary counselling', value: 91 },
          { name: 'Exercise programme', value: 74 },
          { name: 'Smoking cessation', value: 62 },
          { name: 'Weight management', value: 55 },
          { name: 'Stress reduction', value: 43 },
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

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function RegistryDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router  = useRouter()
  const [patients, setPatients] = useState<Patient[]>([])
  const [visits, setVisits] = useState<Visit[]>([])
  const [loading, setLoading] = useState(true)

  // ── Helper: build cumulative enrollment trend from patient list ────────────
  function getEnrollmentTrend(hfPts: Patient[]) {
    const sorted = [...hfPts].sort((a, b) => {
      const dateA = a.indexDate || a.createdAt || ''
      const dateB = b.indexDate || b.createdAt || ''
      return dateA.localeCompare(dateB)
    })

    const countsByMonth: Record<string, number> = {}
    sorted.forEach(p => {
      const dateStr = p.indexDate || p.createdAt
      if (!dateStr) return
      const date = new Date(dateStr)
      if (isNaN(date.getTime())) return
      const monthStr = date.toLocaleString('default', { month: 'short' }) + ' ' + date.getFullYear().toString().slice(-2)
      countsByMonth[monthStr] = (countsByMonth[monthStr] || 0) + 1
    })

    let cumulative = 0
    const trend = Object.entries(countsByMonth).map(([month, count]) => {
      cumulative += count
      return { month, count: cumulative }
    })

    if (trend.length === 0) {
      return [
        { month: 'Jan', count: 1 },
        { month: 'Feb', count: 2 },
        { month: 'Mar', count: 3 }
      ]
    }
    return trend
  }

  useEffect(() => {
    async function loadData() {
      if (id !== 'hf') {
        setLoading(false)
        return
      }
      setLoading(true)
      try {
        const pts = await getPatients()
        // Fetch visits for each patient to construct a complete longitudinal dataset
        const visitsPromises = pts.map(async (p) => {
          try {
            return await getVisits(p.id)
          } catch (e) {
            console.warn(`Failed to fetch visits for patient ${p.id}`, e)
            return []
          }
        })
        const visitsResults = await Promise.all(visitsPromises)
        setPatients(pts)
        setVisits(visitsResults.flat())
      } catch (err) {
        console.error('Failed to load dynamic registry data:', err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [id])

  const reg = useMemo(() => {
    if (id !== 'hf') return REGISTRY_DATA[id as string]

    // 1. Filter to Heart Failure patients
    const hfPatients = patients.filter(p => p.registryId === 'hf' || p.hfType === 'HFrEF' || p.hfType === 'HFmrEF' || p.hfType === 'HFpEF' || p.studyConsented)
    const patientIds = new Set(hfPatients.map(p => p.id))
    const hfVisits = visits.filter(v => patientIds.has(v.patientId))

    // 2. Calculations
    const totalPatients = hfPatients.length

    // Enrolled this month (from patient registration date)
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)
    const newThisMonth = hfPatients.filter(p => p.createdAt && new Date(p.createdAt) >= startOfMonth).length

    // Avg LVEF
    const lvefVals = hfPatients.map(p => p.lvef).filter(v => v !== undefined && v !== null && typeof v === 'number') as number[]
    const avgLvef = lvefVals.length ? Math.round(lvefVals.reduce((a, b) => a + b, 0) / lvefVals.length) : 0

    // GDMT Rate (3+ of RAASi, Beta-Blocker, MRA, SGLT2i)
    let gdmt3PlusCount = 0
    let hfWithMedsCount = 0
    hfPatients.forEach(p => {
      const pVisits = hfVisits.filter(v => v.patientId === p.id)
      if (pVisits.length === 0) return
      const latest = pVisits.reduce((l, c) => new Date(c.visitDate) > new Date(l.visitDate) ? c : l, pVisits[0])
      let activePillars = 0
      if (latest.raasi?.prescribed === 'Yes') activePillars++
      if (latest.betaBlocker?.prescribed === 'Yes') activePillars++
      if (latest.mra?.prescribed === 'Yes') activePillars++
      if (latest.sglt2i?.prescribed === 'Yes') activePillars++
      if (activePillars >= 3) gdmt3PlusCount++
      hfWithMedsCount++
    })
    const gdmtRate = hfWithMedsCount ? Math.round((gdmt3PlusCount / hfWithMedsCount) * 100) : 0

    // NYHA III-IV rate
    let nyha34Count = 0
    let hasNyhaCount = 0
    hfPatients.forEach(p => {
      if (p.nyha) {
        hasNyhaCount++
        if (p.nyha === 'III' || p.nyha === 'IV') {
          nyha34Count++
        }
      }
    })
    const nyhaRate = hasNyhaCount ? Math.round((nyha34Count / hasNyhaCount) * 100) : 0

    // HF Hospitalisation rate
    let hospCount = 0
    let hasHospInfoCount = 0
    hfPatients.forEach(p => {
      const pVisits = hfVisits.filter(v => v.patientId === p.id)
      if (pVisits.length === 0) return
      const latest = pVisits.reduce((l, c) => new Date(c.visitDate) > new Date(l.visitDate) ? c : l, pVisits[0])
      if (latest.hospHistory) {
        hasHospInfoCount++
        if (latest.hospHistory === 'Yes') {
          hospCount++
        }
      }
    })
    const hospRate = hasHospInfoCount ? Math.round((hospCount / hasHospInfoCount) * 100) : 0

    // Phenotype Distribution
    const phenotypeCounts = { HFrEF: 0, HFmrEF: 0, HFpEF: 0 }
    hfPatients.forEach(p => {
      if (p.hfType === 'HFrEF') phenotypeCounts.HFrEF++
      else if (p.hfType === 'HFmrEF') phenotypeCounts.HFmrEF++
      else if (p.hfType === 'HFpEF') phenotypeCounts.HFpEF++
    })
    const phenotypeData = [
      { name: 'HFrEF (EF < 40%)', value: phenotypeCounts.HFrEF },
      { name: 'HFmrEF (EF 40–49%)', value: phenotypeCounts.HFmrEF },
      { name: 'HFpEF (EF ≥ 50%)', value: phenotypeCounts.HFpEF },
    ].filter(x => x.value > 0)

    // NYHA Distribution
    const nyhaCounts = { I: 0, II: 0, III: 0, IV: 0 }
    hfPatients.forEach(p => {
      if (p.nyha === 'I') nyhaCounts.I++
      else if (p.nyha === 'II') nyhaCounts.II++
      else if (p.nyha === 'III') nyhaCounts.III++
      else if (p.nyha === 'IV') nyhaCounts.IV++
    })
    const nyhaData = [
      { name: 'Class I', value: nyhaCounts.I },
      { name: 'Class II', value: nyhaCounts.II },
      { name: 'Class III', value: nyhaCounts.III },
      { name: 'Class IV', value: nyhaCounts.IV },
    ].filter(x => x.value > 0)

    // LVEF Bins
    const lvefBins = { '< 30%': 0, '30–39%': 0, '40–49%': 0, '≥ 50%': 0 }
    hfPatients.forEach(p => {
      if (typeof p.lvef === 'number') {
        if (p.lvef < 30) lvefBins['< 30%']++
        else if (p.lvef < 40) lvefBins['30–39%']++
        else if (p.lvef < 50) lvefBins['40–49%']++
        else lvefBins['≥ 50%']++
      }
    })
    const lvefData = Object.entries(lvefBins).map(([name, value]) => ({ name, value }))

    // GDMT Rates
    let activeVisitCount = 0
    const medCounts = { 'Beta-Blocker': 0, 'RAASi (ACEi/ARB/ARNI)': 0, MRA: 0, SGLT2i: 0, Diuretics: 0 }
    hfPatients.forEach(p => {
      const pVisits = hfVisits.filter(v => v.patientId === p.id)
      if (pVisits.length === 0) return
      const latest = pVisits.reduce((l, c) => new Date(c.visitDate) > new Date(l.visitDate) ? c : l, pVisits[0])
      activeVisitCount++
      if (latest.betaBlocker?.prescribed === 'Yes') medCounts['Beta-Blocker']++
      if (latest.raasi?.prescribed === 'Yes') medCounts['RAASi (ACEi/ARB/ARNI)']++
      if (latest.mra?.prescribed === 'Yes') medCounts['MRA']++
      if (latest.sglt2i?.prescribed === 'Yes') medCounts['SGLT2i']++
      if (latest.diuretic?.prescribed === 'Yes') medCounts['Diuretics']++
    })
    const gdmtChartData = Object.entries(medCounts).map(([name, count]) => ({
      name,
      value: activeVisitCount ? Math.round((count / activeVisitCount) * 100) : 0
    }))

    // Symptoms and signs prevalence
    const symptomsSignsCounts: Record<string, number> = {
      'Dyspnoea/PND': 0,
      'Fatigue': 0,
      'History of Edema': 0,
      'Palpitations': 0,
      'Angina': 0,
      'Ascites': 0,
      'Lung Rales': 0,
      'Pleural Effusion': 0,
      'Elevated JVP': 0,
      'S3 Gallop': 0,
      'Dependent Edema': 0,
      'Hepatomegaly': 0,
      'Cardiomegaly': 0
    }
    let totalClinicalVisits = 0
    hfPatients.forEach(p => {
      const pVisits = hfVisits.filter(v => v.patientId === p.id)
      if (pVisits.length === 0) return
      const latest = pVisits.reduce((l, c) => new Date(c.visitDate) > new Date(l.visitDate) ? c : l, pVisits[0])
      totalClinicalVisits++
      if (latest.symptomDyspnea) symptomsSignsCounts['Dyspnoea/PND']++
      if (latest.symptomFatigue) symptomsSignsCounts['Fatigue']++
      if (latest.symptomEdema) symptomsSignsCounts['History of Edema']++
      if (latest.symptomPalpitation) symptomsSignsCounts['Palpitations']++
      if (latest.symptomAngina) symptomsSignsCounts['Angina']++
      if (latest.symptomAscites) symptomsSignsCounts['Ascites']++
      if (latest.signLungRales) symptomsSignsCounts['Lung Rales']++
      if (latest.signPleuralEffusion) symptomsSignsCounts['Pleural Effusion']++
      if (latest.signElevatedJVP) symptomsSignsCounts['Elevated JVP']++
      if (latest.signS3) symptomsSignsCounts['S3 Gallop']++
      if (latest.signDependentEdema) symptomsSignsCounts['Dependent Edema']++
      if (latest.signHepatomegaly) symptomsSignsCounts['Hepatomegaly']++
      if (latest.signCardiomegaly) symptomsSignsCounts['Cardiomegaly']++
    })
    const symptomsSignsData = Object.entries(symptomsSignsCounts)
      .map(([name, count]) => ({
        name,
        value: totalClinicalVisits ? Math.round((count / totalClinicalVisits) * 100) : 0
      }))
      .sort((a, b) => b.value - a.value)

    // Completeness by category
    const categories = [
      { name: 'Demographics', fields: ['firstName', 'lastName', 'dob', 'sex', 'mrn', 'contact', 'address', 'indianCitizen', 'studyConsented', 'aadhaarNo', 'addressHouse', 'addressStreet', 'addressPost', 'addressDistrict', 'addressState', 'addressPin', 'secondaryContact', 'caregiverContact'] },
      { name: 'Vitals & Exam', fields: ['bpSystolic', 'bpDiastolic', 'heartRate', 'weight', 'height', 'o2Sat', 'oedema'] },
      { name: 'Echo / Imaging', fields: ['lvef', 'echoDate', 'lvdd', 'lvsd', 'eEPrime', 'ddGrade', 'rvsp', 'laStrain', 'rvFreeWallStrain', 'lvMassIndex', 'relativeWallThickness'] },
      { name: 'Laboratory', fields: ['ntProBNP', 'bnp', 'egfr', 'creatinine', 'potassium', 'sodium', 'hb', 'tft', 'hba1c', 'ferritin', 'transferrinSat', 'uricAcid', 'ldl', 'triglycerides', 'peakTropT', 'peakTropI', 'serumUrea', 'bun'] },
      { name: 'Medications', fields: ['diuretic', 'raasi', 'betaBlocker', 'digoxin', 'sglt2i', 'ivabradine', 'mra', 'aspirin', 'statin', 'noac', 'vki', 'ivIron'] },
      { name: 'QoL / Functional', fields: ['symptomTrajectory', 'eq5d', 'sixMWT', 'gripRight', 'gripLeft', 'education'] }
    ]

    const categoryAverages: Record<string, number> = {}
    categories.forEach(cat => {
      let totalScoreForCat = 0
      hfPatients.forEach(p => {
        const pVisits = hfVisits.filter(v => v.patientId === p.id)
        const latest = pVisits.length ? pVisits.reduce((l, c) => new Date(c.visitDate) > new Date(l.visitDate) ? c : l, pVisits[0]) : null
        
        let filled = 0
        cat.fields.forEach(f => {
          if (f in p) {
            const val = (p as any)[f]
            if (val !== undefined && val !== null && val !== '') filled++
          } else if (latest && f in latest) {
            const val = (latest as any)[f]
            if (val !== undefined && val !== null && val !== '') {
              if (typeof val === 'object') {
                if (val.prescribed !== undefined && val.prescribed !== '') filled++
                else if (Object.keys(val).length > 0) filled++
              } else {
                filled++
              }
            }
          }
        })
        totalScoreForCat += Math.round((filled / cat.fields.length) * 100)
      })
      categoryAverages[cat.name] = totalPatients ? Math.round(totalScoreForCat / totalPatients) : 0
    })

    const completionByCategory = Object.entries(categoryAverages).map(([name, pct]) => ({ name, pct }))
    const completionRate = completionByCategory.length 
      ? Math.round(completionByCategory.reduce((s, c) => s + c.pct, 0) / completionByCategory.length) 
      : 0

    // Enrollment Trend
    const enrollmentTrend = getEnrollmentTrend(hfPatients)

    return {
      id: 'hf',
      name: 'Heart Failure Registry',
      shortDesc: 'HFrEF · HFmrEF · HFpEF · Advanced HF',
      gradient: 'linear-gradient(135deg, #1d4ed8 0%, #3b82f6 100%)',
      accentColor: '#3b82f6',
      ringColor: '#60a5fa',
      patients: totalPatients,
      newThisMonth,
      completion: completionRate,
      fieldsTotal: 93,
      fieldsCaptured: Math.round((completionRate / 100) * 93),
      status: 'Active' as const,
      kpis: [
        { label: 'Avg LVEF', value: `${avgLvef}%`, sub: 'Active registry mean' },
        { label: 'GDMT Rate', value: `${gdmtRate}%`, sub: 'on 3+ core drugs' },
        { label: 'NYHA III–IV', value: `${nyhaRate}%`, sub: 'severe/mod symptoms' },
        { label: 'HF Hospitalisation', value: `${hospRate}%`, sub: 'history of admissions' },
      ],
      completionByCategory,
      enrollmentTrend,
      clinicalCharts: [
        {
          title: 'HF Phenotype Distribution',
          type: 'pie' as const,
          data: phenotypeData.length ? phenotypeData : [{ name: 'None Registered', value: 1 }],
        },
        {
          title: 'NYHA Functional Class',
          type: 'pie' as const,
          data: nyhaData.length ? nyhaData : [{ name: 'None Registered', value: 1 }],
        },
        {
          title: 'LVEF Distribution',
          type: 'bar-v' as const,
          color: '#3b82f6',
          data: lvefData,
        },
        {
          title: 'GDMT Prescribing Rates (%)',
          type: 'bar-h' as const,
          color: '#60a5fa',
          data: gdmtChartData,
        },
        {
          title: 'Symptoms & Signs Prevalence (%)',
          type: 'bar-h' as const,
          color: '#34d399',
          data: symptomsSignsData,
        }
      ]
    }
  }, [id, patients, visits])

  // getEnrollmentTrend is defined above useEffect to avoid hoisting issues

  if (loading && id === 'hf') {
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
        <p className="text-gray-400 text-sm">Registry not found.</p>
        <button onClick={() => router.push('/registry-home')} className="text-blue-400 text-sm underline">
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

  return (
    <div className="space-y-6 animate-fade-in">

      {/* ── Header ── */}
      <div className="glass-card overflow-hidden border border-blue-500/10">
        <div className="px-6 py-5 flex flex-col md:flex-row md:items-center gap-4" style={{ background: reg.gradient }}>
          <button
            onClick={() => router.push('/registry-home')}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg self-start md:self-auto"
            style={{ background: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.9)' }}
          >
            <ArrowLeft size={13} /> Registry Home
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-white">{reg.name}</h1>
            <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.75)' }}>{reg.shortDesc}</p>
          </div>
          <div className="flex items-center gap-3 self-start md:self-auto">
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

        {/* KPI row */}
        <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 divide-white/[0.06]">
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <CompletionBars categories={reg.completionByCategory} accentColor={reg.accentColor} />
        <EnrollmentTrend data={reg.enrollmentTrend} accentColor={reg.accentColor} />
      </div>

      {/* ── Clinical analytics ── */}
      <div>
        <h2 className="text-sm font-semibold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
          <span className="w-1 h-4 rounded-full inline-block" style={{ background: reg.accentColor }} />
          Clinical Analytics
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {reg.clinicalCharts.map(chart => {
            if (chart.type === 'pie')   return <PieChartCard key={chart.title} title={chart.title} data={chart.data} />
            if (chart.type === 'bar-h') return <BarHCard    key={chart.title} title={chart.title} data={chart.data} color={chart.color ?? reg.accentColor} />
            if (chart.type === 'bar-v') return <BarVCard    key={chart.title} title={chart.title} data={chart.data} color={chart.color ?? reg.accentColor} />
            return null
          })}
        </div>
      </div>
    </div>
  )
}
