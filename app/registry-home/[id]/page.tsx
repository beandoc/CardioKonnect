'use client'
import { useParams, useRouter } from 'next/navigation'
import { useState, useEffect, useMemo } from 'react'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import Link from 'next/link'
import { ArrowLeft, Users, CheckCircle, TrendingUp, Clock, Activity, PlusCircle, FlaskConical, Microscope, Layers, Info, TrendingDown, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getPatients, getAllVisits, subscribePatients, subscribeVisits } from '@/lib/firestore'
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
  // HF-specific extended analytics (optional)
  comorbidityData?: ChartItem[]
  bbbData?: ChartItem[]
  qrsData?: ChartItem[]
  ntBnpData?: ChartItem[]
  egfrData?: ChartItem[]
  sixMwtData?: ChartItem[]
  deviceData?: ChartItem[]
  vaccinationData?: ChartItem[]
  ageData?: ChartItem[]
  sexData?: ChartItem[]
  researchBoard?: {
    n: number
    pearsonGrip: number
    pearsonSixMWT: number
    meanGrip: number
    meanSixMWT: number
    meanNtBnp: number
    gripVsBnp: { x: number; y: number; nyha: string }[]
    sixMwtVsBnp: { x: number; y: number; nyha: string }[]
    ntBnpQuartiles: { quartile: string; meanGrip: number | null; meanSixMWT: number | null; n: number; meanBnp: number }[]
    gripVs6MWT?: { x: number; y: number; nyha: string }[]
    pearsonGripSixMWT?: number
    spearmanGrip?: number
    spearmanSixMWT?: number
    spearmanDelta?: number
    consort?: {
      total: number
      excludedLvef: number
      excludedBnp: number
      excludedFunctional: number
      finalCohort: number
    }
    subgroups?: {
      all: { gripBnp: number; sixMwtBnp: number; gripSixMwt: number; n: number }
      male: { gripBnp: number; sixMwtBnp: number; gripSixMwt: number; n: number }
      female: { gripBnp: number; sixMwtBnp: number; gripSixMwt: number; n: number }
      ageYoung: { gripBnp: number; sixMwtBnp: number; gripSixMwt: number; n: number }
      ageOld: { gripBnp: number; sixMwtBnp: number; gripSixMwt: number; n: number }
      nyhaMild: { gripBnp: number; sixMwtBnp: number; gripSixMwt: number; n: number }
      nyhaSevere: { gripBnp: number; sixMwtBnp: number; gripSixMwt: number; n: number }
    }
    pairedGrip?: {
      nPaired: number
      baselineMean: number
      followupMean: number
      meanDelta: number
      improvedCount: number
      stableCount: number
      declinedCount: number
      list: { id: string; baseline: number; followup: number; delta: number; name: string }[]
    }
  }
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

// ─── Clinical Utility Helpers ─────────────────────────────────────────────────

// Pearson r — use for grip↔6MWT (both reasonably normal)
function pearsonR(xs: number[], ys: number[]): number {
  const n = xs.length
  if (n < 2) return 0
  const mx = xs.reduce((a, b) => a + b, 0) / n
  const my = ys.reduce((a, b) => a + b, 0) / n
  const num = xs.reduce((acc, x, i) => acc + (x - mx) * (ys[i] - my), 0)
  const dx = Math.sqrt(xs.reduce((acc, x) => acc + (x - mx) ** 2, 0))
  const dy = Math.sqrt(ys.reduce((acc, y) => acc + (y - my) ** 2, 0))
  return (dx && dy) ? +((num / (dx * dy)).toFixed(4)) : 0
}

// Spearman ρ — correct for log-skewed BNP distribution (rank-based, distribution-free)
function spearmanR(xs: number[], ys: number[]): number {
  const n = xs.length
  if (n < 2) return 0
  const rank = (arr: number[]) => {
    const sorted = [...arr].map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v)
    const ranks = new Array(n)
    sorted.forEach((item, ri) => { ranks[item.i] = ri + 1 })
    return ranks
  }
  const rx = rank(xs), ry = rank(ys)
  return pearsonR(rx, ry)
}

// Log10-transform BNP for scatter axes (reduces right-skew)
const log10BNP = (bnp: number) => +(Math.log10(Math.max(bnp, 1))).toFixed(3)

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
              <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
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
                    <tr key={idx} className={row.bold ? 'font-semibold text-white bg-white/[0.02]' : 'text-gray-300'}>
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
  const [patients, setPatients] = useState<Patient[]>([])
  const [visits, setVisits] = useState<Visit[]>([])
  const [loading, setLoading] = useState(true)

  // ── Helper: build cumulative enrollment trend using real DOA dates ─────────
  function getEnrollmentTrend(hfPts: Patient[]) {
    const sorted = [...hfPts].sort((a, b) => {
      // Use hfConfirmationDate (DOA from Excel) for real historical ordering
      const dateA = a.hfConfirmationDate || a.indexDate || a.createdAt || ''
      const dateB = b.hfConfirmationDate || b.indexDate || b.createdAt || ''
      return dateA.localeCompare(dateB)
    })

    const countsByMonth: Record<string, number> = {}
    sorted.forEach(p => {
      const dateStr = p.hfConfirmationDate || p.indexDate || p.createdAt
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
      return [{ month: 'Jan', count: 1 }, { month: 'Feb', count: 2 }, { month: 'Mar', count: 3 }]
    }
    return trend
  }

  useEffect(() => {
    if (id !== 'hf') {
      setLoading(false)
      return
    }
    setLoading(true)
    let unsubPatients: (() => void) | null = null
    let unsubVisits: (() => void) | null = null

    try {
      unsubPatients = subscribePatients((pts) => {
        setPatients(pts)
        setLoading(false)
      })
      unsubVisits = subscribeVisits((vts) => {
        setVisits(vts)
      })
    } catch (err) {
      console.error('Failed to load dynamic registry data:', err)
      setLoading(false)
    }

    return () => {
      if (unsubPatients) unsubPatients()
      if (unsubVisits) unsubVisits()
    }
  }, [id])

  // Safe date parse helper — returns 0 for empty/invalid strings
  function safeTime(dateStr: string | undefined): number {
    if (!dateStr) return 0
    const t = new Date(dateStr).getTime()
    return isNaN(t) ? 0 : t
  }

  const reg = useMemo(() => {
    if (id !== 'hf') return REGISTRY_DATA[id as string]

    try {

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
      const latest = pVisits.reduce((l, c) => safeTime(c.visitDate) > safeTime(l.visitDate) ? c : l, pVisits[0])
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
      const latest = pVisits.reduce((l, c) => safeTime(c.visitDate) > safeTime(l.visitDate) ? c : l, pVisits[0])
      if (latest.hospHistory) {
        hasHospInfoCount++
        if (latest.hospHistory === 'Yes') {
          hospCount++
        }
      }
    })
    const hospRate = hasHospInfoCount ? Math.round((hospCount / hasHospInfoCount) * 100) : 0

    // KCCQ Good/Excellent QoL rate (KCCQ Overall Summary Score >= 75)
    let goodQolCount = 0
    let hasKccqCount = 0
    const kccqDistribution = { Poor: 0, FairGood: 0, Excellent: 0 }
    hfPatients.forEach(p => {
      const pVisits = hfVisits.filter(v => v.patientId === p.id)
      if (pVisits.length === 0) return
      const latest = pVisits.reduce((l, c) => safeTime(c.visitDate) > safeTime(l.visitDate) ? c : l, pVisits[0])
      if (latest.kccq?.overallSummaryScore !== undefined && latest.kccq?.overallSummaryScore !== null) {
        const score = latest.kccq.overallSummaryScore
        hasKccqCount++
        if (score >= 75) {
          goodQolCount++
          kccqDistribution.Excellent++
        } else if (score >= 50) {
          kccqDistribution.FairGood++
        } else {
          kccqDistribution.Poor++
        }
      }
    })
    const goodQolRate = hasKccqCount ? Math.round((goodQolCount / hasKccqCount) * 100) : 0
    const kccqChartData = [
      { name: 'Poor QoL (< 50)', value: kccqDistribution.Poor },
      { name: 'Fair/Good QoL (50–74)', value: kccqDistribution.FairGood },
      { name: 'Excellent QoL (≥ 75)', value: kccqDistribution.Excellent },
    ].filter(x => x.value > 0)

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
      const latest = pVisits.reduce((l, c) => safeTime(c.visitDate) > safeTime(l.visitDate) ? c : l, pVisits[0])
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
      const latest = pVisits.reduce((l, c) => safeTime(c.visitDate) > safeTime(l.visitDate) ? c : l, pVisits[0])
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
      { name: 'Demographics', fields: ['firstName', 'lastName', 'dob', 'sex', 'mrn', 'contact', 'address', 'indianCitizen', 'studyConsented', 'abhaId', 'occupation', 'addressHouse', 'addressStreet', 'addressPost', 'addressDistrict', 'addressState', 'addressPin', 'secondaryContact', 'caregiverContact'] },
      { name: 'Vitals & Exam', fields: ['bpSystolic', 'bpDiastolic', 'heartRate', 'weight', 'height', 'o2Sat', 'oedema'] },
      { name: 'Echo / Imaging', fields: ['lvef', 'echoDate', 'lvdd', 'lvsd', 'eEPrime', 'ddGrade', 'rvsp', 'laStrain', 'rvFreeWallStrain', 'lvMassIndex', 'relativeWallThickness'] },
      { name: 'Laboratory', fields: ['ntProBNP', 'bnp', 'egfr', 'creatinine', 'potassium', 'sodium', 'hb', 'tft', 'hba1c', 'ferritin', 'transferrinSat', 'uricAcid', 'ldl', 'triglycerides', 'peakTropT', 'peakTropI', 'serumUrea', 'bun'] },
      { name: 'Medications', fields: ['diuretic', 'raasi', 'betaBlocker', 'digoxin', 'sglt2i', 'ivabradine', 'mra', 'aspirin', 'statin', 'noac', 'vki', 'ivIron'] },
      { name: 'QoL / Functional', fields: ['symptomTrajectory', 'eq5d', 'sixMWT', 'gripRight', 'gripLeft', 'education', 'kccq'] }
    ]

    const categoryAverages: Record<string, number> = {}
    categories.forEach(cat => {
      let totalScoreForCat = 0
      hfPatients.forEach(p => {
        const pVisits = hfVisits.filter(v => v.patientId === p.id)
        const latest = pVisits.length ? pVisits.reduce((l, c) => safeTime(c.visitDate) > safeTime(l.visitDate) ? c : l, pVisits[0]) : null
        
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
        { label: 'Good/Excellent QoL', value: `${goodQolRate}%`, sub: 'KCCQ overall score ≥ 75' },
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
        },
        {
          title: 'KCCQ Quality of Life Status',
          type: 'pie' as const,
          data: kccqChartData.length ? kccqChartData : [{ name: 'No QoL Data', value: 1 }],
        }
      ],

      // ─── Additional real-data computed sections ───

      // Comorbidity prevalence
      comorbidityData: (() => {
        if (!totalPatients) return []
        const pct = (n: number) => Math.round((n / totalPatients) * 100)
        const counts = {
          Hypertension: hfPatients.filter(p => p.comorbidHypertension).length,
          'Diabetes Mellitus': hfPatients.filter(p => p.comorbidDiabetes).length,
          'Coronary Artery Disease': hfPatients.filter(p => p.comorbidCAD).length,
          'Prior MI': hfPatients.filter(p => p.comorbidPriorMI).length,
          'Prior PCI': hfPatients.filter(p => p.comorbidPriorPCI).length,
          'Prior CABG': hfPatients.filter(p => p.comorbidPriorCABG).length,
          'Atrial Fibrillation': hfPatients.filter(p => p.comorbidAF).length,
          'CKD': hfPatients.filter(p => p.comorbidCKD).length,
          'COPD / Asthma': hfPatients.filter(p => p.comorbidCOPD).length,
          'Dyslipidemia': hfPatients.filter(p => p.comorbidDyslipidemia).length,
        }
        return Object.entries(counts)
          .map(([name, count]) => ({ name, value: pct(count) }))
          .sort((a, b) => b.value - a.value)
      })(),

      // ECG profile
      bbbData: (() => {
        const counts: Record<string, number> = { None: 0, LBBB: 0, RBBB: 0, IVCD: 0 }
        hfVisits.forEach(v => {
          if (!v.bbb) counts.None++
          else counts[v.bbb] = (counts[v.bbb] || 0) + 1
        })
        return Object.entries(counts).map(([name, value]) => ({ name, value })).filter(x => x.value > 0)
      })(),

      qrsData: (() => {
        const bins = { '<120 ms': 0, '120–149 ms': 0, '≥150 ms (CRT eligible)': 0 }
        hfVisits.forEach(v => {
          if (!v.qrsDuration) return
          if (v.qrsDuration < 120) bins['<120 ms']++
          else if (v.qrsDuration < 150) bins['120–149 ms']++
          else bins['≥150 ms (CRT eligible)']++
        })
        return Object.entries(bins).map(([name, value]) => ({ name, value }))
      })(),

      // NT-proBNP distribution
      ntBnpData: (() => {
        const bins = { '<300 pg/mL': 0, '300–1000': 0, '1000–5000': 0, '>5000 pg/mL': 0 }
        hfVisits.forEach(v => {
          if (!v.ntProBNP) return
          if (v.ntProBNP < 300) bins['<300 pg/mL']++
          else if (v.ntProBNP < 1000) bins['300–1000']++
          else if (v.ntProBNP < 5000) bins['1000–5000']++
          else bins['>5000 pg/mL']++
        })
        return Object.entries(bins).map(([name, value]) => ({ name, value }))
      })(),

      // eGFR / CKD staging
      egfrData: (() => {
        const bins = { 'G5 (<15)': 0, 'G4 (15–29)': 0, 'G3b (30–44)': 0, 'G3a (45–59)': 0, 'G2 (60–89)': 0, 'G1 (≥90)': 0 }
        hfVisits.forEach(v => {
          if (!v.egfr) return
          if (v.egfr < 15) bins['G5 (<15)']++
          else if (v.egfr < 30) bins['G4 (15–29)']++
          else if (v.egfr < 45) bins['G3b (30–44)']++
          else if (v.egfr < 60) bins['G3a (45–59)']++
          else if (v.egfr < 90) bins['G2 (60–89)']++
          else bins['G1 (≥90)']++
        })
        return Object.entries(bins).map(([name, value]) => ({ name, value }))
      })(),

      // 6MWT distribution
      sixMwtData: (() => {
        const bins = { '<150 m': 0, '150–299 m': 0, '300–449 m': 0, '≥450 m': 0 }
        hfVisits.forEach(v => {
          if (!v.sixMWT) return
          if (v.sixMWT < 150) bins['<150 m']++
          else if (v.sixMWT < 300) bins['150–299 m']++
          else if (v.sixMWT < 450) bins['300–449 m']++
          else bins['≥450 m']++
        })
        return Object.entries(bins).map(([name, value]) => ({ name, value }))
      })(),

      // Device therapy
      deviceData: (() => {
        const counts = { 'No Device': 0, 'ICD': 0, 'CRT-D': 0, 'ICD + CRT-D': 0 }
        hfPatients.forEach(p => {
          if (p.icdPresence && p.crtPresence) counts['ICD + CRT-D']++
          else if (p.icdPresence) counts['ICD']++
          else if (p.crtPresence) counts['CRT-D']++
          else counts['No Device']++
        })
        return Object.entries(counts).map(([name, value]) => ({ name, value })).filter(x => x.value > 0)
      })(),

      // Vaccination
      vaccinationData: (() => {
        const flu = hfVisits.filter(v => v.vaccInfluenza === 'Yes').length
        const pneumo = hfVisits.filter(v => v.vaccPneumo === 'Yes').length
        const total = activeVisitCount || 1
        return [
          { name: 'Influenza Vaccine', value: Math.round((flu / total) * 100) },
          { name: 'Pneumococcal Vaccine', value: Math.round((pneumo / total) * 100) },
        ]
      })(),

      // Age distribution
      ageData: (() => {
        const bins = { '<45': 0, '45–54': 0, '55–64': 0, '65–74': 0, '≥75': 0 }
        hfPatients.forEach(p => {
          if (!p.age && !p.dob) return
          const age = p.age ?? Math.floor((Date.now() - new Date(p.dob!).getTime()) / (365.25 * 86400000))
          if (age < 45) bins['<45']++
          else if (age < 55) bins['45–54']++
          else if (age < 65) bins['55–64']++
          else if (age < 75) bins['65–74']++
          else bins['≥75']++
        })
        return Object.entries(bins).map(([name, value]) => ({ name, value }))
      })(),

      sexData: [
        { name: 'Male', value: hfPatients.filter(p => p.sex === 'Male').length },
        { name: 'Female', value: hfPatients.filter(p => p.sex === 'Female').length },
      ].filter(x => x.value > 0),

      // ─── Research Board: Grip / 6MWT ↔ NT-proBNP in LVEF <40% ─────────────
      researchBoard: (() => {
        const meanArr = (arr: number[]) => arr.length
          ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length)
          : 0
        const meanF = (arr: number[]) => arr.length
          ? +(arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(2)
          : 0

        // 1. CONSORT counts
        const total = hfPatients.length

        // Exclude: LVEF >= 40% (or missing LVEF)
        const lvefExcluded = hfPatients.filter(p => {
          const pVisits = hfVisits.filter(v => v.patientId === p.id)
          const latest = pVisits.reduce((l, c) => safeTime(c.visitDate) > safeTime(l.visitDate) ? c : l, pVisits[0])
          const lvef = latest?.lvef ?? p.lvef
          return !lvef || lvef >= 40
        })
        const excludedLvef = lvefExcluded.length

        const hfRefCohort = hfPatients.filter(p => {
          const pVisits = hfVisits.filter(v => v.patientId === p.id)
          const latest = pVisits.reduce((l, c) => safeTime(c.visitDate) > safeTime(l.visitDate) ? c : l, pVisits[0])
          const lvef = latest?.lvef ?? p.lvef
          return lvef && lvef < 40
        })

        // Exclude: missing NT-proBNP
        const bnpExcluded = hfRefCohort.filter(p => {
          const pVisits = hfVisits.filter(v => v.patientId === p.id)
          const latest = pVisits.reduce((l, c) => safeTime(c.visitDate) > safeTime(l.visitDate) ? c : l, pVisits[0])
          const bnp = latest?.ntProBNP
          return !bnp || bnp <= 0
        })
        const excludedBnp = bnpExcluded.length

        const hfRefBnpCohort = hfRefCohort.filter(p => {
          const pVisits = hfVisits.filter(v => v.patientId === p.id)
          const latest = pVisits.reduce((l, c) => safeTime(c.visitDate) > safeTime(l.visitDate) ? c : l, pVisits[0])
          const bnp = latest?.ntProBNP
          return bnp && bnp > 0
        })

        // Exclude: missing BOTH grip and 6MWT
        const functionalExcluded = hfRefBnpCohort.filter(p => {
          const pVisits = hfVisits.filter(v => v.patientId === p.id)
          const latest = pVisits.reduce((l, c) => safeTime(c.visitDate) > safeTime(l.visitDate) ? c : l, pVisits[0])
          const hasGrip = latest?.gripRight !== undefined && latest.gripRight > 0
          const hasSixMwt = latest?.sixMWT !== undefined && latest.sixMWT > 0
          return !hasGrip && !hasSixMwt
        })
        const excludedFunctional = functionalExcluded.length

        const consort = {
          total,
          excludedLvef,
          excludedBnp,
          excludedFunctional,
          finalCohort: hfRefBnpCohort.length - excludedFunctional,
        }

        // Filter: LVEF <40% AND NT-proBNP recorded
        const eligible = hfPatients.flatMap(p => {
          const pVisits = hfVisits.filter(v => v.patientId === p.id)
          if (!pVisits.length) return []
          const latest = pVisits.reduce((l, c) => safeTime(c.visitDate) > safeTime(l.visitDate) ? c : l, pVisits[0])
          const lvef = latest.lvef ?? p.lvef
          if (!lvef || lvef >= 40) return []
          const ntProBNP = latest.ntProBNP
          if (!ntProBNP || ntProBNP <= 0) return []
          return [{ p, latest, lvef, ntProBNP, nyha: latest.nyha || p.nyha || 'II' }]
        })

        // ── Scatter 1: Grip vs log10(BNP) — Spearman ρ (correct for BNP skew)
        const gripVsBnp = eligible
          .filter(d => d.latest.gripRight !== undefined && d.latest.gripRight > 0)
          .map(d => ({
            x: Math.round(d.latest.gripRight!),
            y: log10BNP(d.ntProBNP),          // log10 scale reduces right-skew
            yRaw: Math.round(d.ntProBNP),
            nyha: d.nyha as string,
          }))
        // Spearman on raw grip vs raw BNP (rank-based, distribution-free)
        const spearmanGripVal = spearmanR(
          gripVsBnp.map(d => d.x),
          gripVsBnp.map(d => d.yRaw),
        )

        // ── Scatter 2: 6MWT vs log10(BNP) — Spearman ρ
        const sixMwtVsBnp = eligible
          .filter(d => d.latest.sixMWT !== undefined && d.latest.sixMWT > 0)
          .map(d => ({
            x: Math.round(d.latest.sixMWT!),
            y: log10BNP(d.ntProBNP),
            yRaw: Math.round(d.ntProBNP),
            nyha: d.nyha as string,
          }))
        const spearmanSixMWTVal = spearmanR(
          sixMwtVsBnp.map(d => d.x),
          sixMwtVsBnp.map(d => d.yRaw),
        )

        // ── Scatter 3: Grip vs 6MWT — Pearson r (both reasonably normal)
        const gripVs6MWT = eligible
          .filter(d =>
            d.latest.gripRight !== undefined && d.latest.gripRight > 0 &&
            d.latest.sixMWT !== undefined && d.latest.sixMWT > 0)
          .map(d => ({
            x: Math.round(d.latest.gripRight!),
            y: Math.round(d.latest.sixMWT!),
            nyha: d.nyha as string,
          }))
        const pearsonGripSixMWT = pearsonR(gripVs6MWT.map(d => d.x), gripVs6MWT.map(d => d.y))

        // ── Follow-up delta analysis (3-month grip vs BNP change)
        const followUpDelta = eligible.flatMap(d => {
          const fu = hfVisits
            .filter(v => v.patientId === d.p.id && v.visitDate !== d.latest.visitDate)
            .sort((a, b) => safeTime(b.visitDate) - safeTime(a.visitDate))[0]
          if (!fu || !fu.gripRight || !fu.ntProBNP) return []
          return [{
            id: d.p.id,
            deltaGrip: Math.round(fu.gripRight - (d.latest.gripRight ?? fu.gripRight)),
            deltaBnp: Math.round(fu.ntProBNP - d.ntProBNP),
            baselineGrip: Math.round(d.latest.gripRight ?? 0),
            followupGrip: Math.round(fu.gripRight),
            baselineBnp: Math.round(d.ntProBNP),
            followupBnp: Math.round(fu.ntProBNP),
            nyha: d.nyha as string,
          }]
        })
        const spearmanDelta = followUpDelta.length >= 2
          ? spearmanR(followUpDelta.map(d => d.deltaGrip), followUpDelta.map(d => d.deltaBnp))
          : 0

        // ── NT-proBNP quartile stratification
        const sortedByBnp = [...eligible].sort((a, b) => a.ntProBNP - b.ntProBNP)
        const qLen = sortedByBnp.length
        const qGroups = [
          { quartile: 'Q1 — Lowest BNP', data: sortedByBnp.slice(0, Math.floor(qLen * 0.25)) },
          { quartile: 'Q2', data: sortedByBnp.slice(Math.floor(qLen * 0.25), Math.floor(qLen * 0.5)) },
          { quartile: 'Q3', data: sortedByBnp.slice(Math.floor(qLen * 0.5), Math.floor(qLen * 0.75)) },
          { quartile: 'Q4 — Highest BNP', data: sortedByBnp.slice(Math.floor(qLen * 0.75)) },
        ]
        const ntBnpQuartiles = qGroups.map(g => ({
          quartile: g.quartile,
          meanGrip: g.data.filter(d => d.latest.gripRight).length
            ? meanArr(g.data.filter(d => d.latest.gripRight).map(d => d.latest.gripRight!)) : null,
          meanSixMWT: g.data.filter(d => d.latest.sixMWT).length
            ? meanArr(g.data.filter(d => d.latest.sixMWT).map(d => d.latest.sixMWT!)) : null,
          n: g.data.length,
          meanBnp: g.data.length ? meanArr(g.data.map(d => d.ntProBNP)) : 0,
        }))

        const gripVals = eligible.filter(d => d.latest.gripRight).map(d => d.latest.gripRight!)
        const sixMwtVals = eligible.filter(d => d.latest.sixMWT).map(d => d.latest.sixMWT!)

        // ── Subgroups analysis
        const getAge = (d: any) => {
          if (typeof d.p.age === 'number') return d.p.age
          if (d.p.dob) {
            const y = new Date(d.p.dob).getFullYear()
            if (!isNaN(y)) return new Date().getFullYear() - y
          }
          return 55
        }
        const getSubgroupCorrelations = (subgroupData: typeof eligible) => {
          const gripBnpData = subgroupData.filter(d => d.latest.gripRight !== undefined && d.latest.gripRight > 0)
          const sixMwtBnpData = subgroupData.filter(d => d.latest.sixMWT !== undefined && d.latest.sixMWT > 0)
          const gripSixMwtData = subgroupData.filter(d => d.latest.gripRight !== undefined && d.latest.gripRight > 0 && d.latest.sixMWT !== undefined && d.latest.sixMWT > 0)

          const gripBnpCorr = spearmanR(
            gripBnpData.map(d => d.latest.gripRight!),
            gripBnpData.map(d => d.ntProBNP)
          )
          const sixMwtBnpCorr = spearmanR(
            sixMwtBnpData.map(d => d.latest.sixMWT!),
            sixMwtBnpData.map(d => d.ntProBNP)
          )
          const gripSixMwtCorr = pearsonR(
            gripSixMwtData.map(d => d.latest.gripRight!),
            gripSixMwtData.map(d => d.latest.sixMWT!)
          )

          return {
            gripBnp: gripBnpCorr,
            sixMwtBnp: sixMwtBnpCorr,
            gripSixMwt: gripSixMwtCorr,
            n: subgroupData.length
          }
        }

        const subgroups = {
          all: getSubgroupCorrelations(eligible),
          male: getSubgroupCorrelations(eligible.filter(d => d.p.sex === 'Male')),
          female: getSubgroupCorrelations(eligible.filter(d => d.p.sex === 'Female')),
          ageYoung: getSubgroupCorrelations(eligible.filter(d => getAge(d) < 60)),
          ageOld: getSubgroupCorrelations(eligible.filter(d => getAge(d) >= 60)),
          nyhaMild: getSubgroupCorrelations(eligible.filter(d => d.nyha === 'I' || d.nyha === 'II')),
          nyhaSevere: getSubgroupCorrelations(eligible.filter(d => d.nyha === 'III' || d.nyha === 'IV')),
        }

        // ── Paired functional trajectory (baseline vs 3-month grip strength)
        const pairedGripList = eligible.flatMap(d => {
          const fu = hfVisits
            .filter(v => v.patientId === d.p.id && v.visitType === 'OPD')
            .sort((a, b) => safeTime(b.visitDate) - safeTime(a.visitDate))[0]
          if (!fu || fu.gripRight === undefined || fu.gripRight <= 0) return []
          
          const baselineGrip = d.latest.gripRight ?? 0
          if (baselineGrip <= 0) return []
          
          const delta = fu.gripRight - baselineGrip
          const name = `${d.p.firstName} ${d.p.lastName}`
          return [{
            id: d.p.id,
            name,
            baseline: Math.round(baselineGrip),
            followup: Math.round(fu.gripRight),
            delta: +delta.toFixed(1)
          }]
        })

        const nPaired = pairedGripList.length
        const baselineMean = nPaired ? meanArr(pairedGripList.map(d => d.baseline)) : 0
        const followupMean = nPaired ? meanArr(pairedGripList.map(d => d.followup)) : 0
        const meanDelta = nPaired ? +(pairedGripList.reduce((acc, d) => acc + d.delta, 0) / nPaired).toFixed(1) : 0
        const improvedCount = pairedGripList.filter(d => d.delta >= 2).length
        const stableCount = pairedGripList.filter(d => d.delta > -2 && d.delta < 2).length
        const declinedCount = pairedGripList.filter(d => d.delta <= -2).length

        const pairedGrip = {
          nPaired,
          baselineMean,
          followupMean,
          meanDelta,
          improvedCount,
          stableCount,
          declinedCount,
          list: pairedGripList
        }

        return {
          n: eligible.length,
          nGrip: gripVsBnp.length,
          nSixMWT: sixMwtVsBnp.length,
          nGripSixMWT: gripVs6MWT.length,
          nFollowUp: followUpDelta.length,
          // Correlations — Spearman ρ for BNP (non-normal), Pearson for grip↔6MWT
          spearmanGrip: spearmanGripVal,
          spearmanSixMWT: spearmanSixMWTVal,
          pearsonGripSixMWT,
          spearmanDelta,
          // Legacy fields used by KPI strip
          pearsonGrip: spearmanGripVal,
          pearsonSixMWT: spearmanSixMWTVal,
          meanGrip: meanArr(gripVals),
          meanSixMWT: meanArr(sixMwtVals),
          meanNtBnp: meanArr(eligible.map(d => d.ntProBNP)),
          meanLogBnp: meanF(eligible.map(d => log10BNP(d.ntProBNP))),
          // Scatter data (log-BNP Y-axis)
          gripVsBnp: gripVsBnp.map(d => ({ x: d.x, y: d.y, nyha: d.nyha })),
          sixMwtVsBnp: sixMwtVsBnp.map(d => ({ x: d.x, y: d.y, nyha: d.nyha })),
          gripVs6MWT,
          followUpDelta,
          ntBnpQuartiles,
          // New fields
          consort,
          subgroups,
          pairedGrip
        }
      })(),

    }
    } catch (err) {
      console.error('HF analytics calculation error — falling back to static data:', err)
      return REGISTRY_DATA['hf']
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

    </div>
  )
}
