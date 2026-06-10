'use client'
import { useState, useMemo } from 'react'
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  ReferenceLine,
} from 'recharts'
import {
  AlertTriangle, CheckCircle, TrendingUp, Activity,
  Clock, Users, Search, ShieldAlert, Zap, Target,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────
type AuditTab =
  | 'complications'
  | 'reperfusion'
  | 'device'
  | 'lesion'
  | 'procedural'
  | 'postprocedure'

type Severity = 'Mild' | 'Moderate' | 'Severe' | 'Life-threatening'
type Resolution = 'Resolved' | 'Partial Resolution' | 'Ongoing' | 'Fatal'

interface ComplicationRecord {
  id: string
  date: string
  mrn: string
  initials: string
  age: number
  sex: 'M' | 'F'
  procedure: string
  compType: string
  severity: Severity
  barcGrade?: string
  timing: 'Intra-procedural' | '< 24 h' | '24–48 h' | '> 48 h'
  management: string
  resolution: Resolution
  notes?: string
}

interface Benchmark {
  metric: string
  target: string
  actual: string
  met: boolean
}

// ─── Complication Case Records ────────────────────────────────────────────────
const COMP_RECORDS: ComplicationRecord[] = [
  {
    id: 'CX-001', date: '2026-05-28', mrn: 'MRN-4821', initials: 'R.K.', age: 62, sex: 'M',
    procedure: 'Primary PCI – LAD (STEMI)',
    compType: 'No-reflow', severity: 'Moderate', timing: 'Intra-procedural',
    management: 'IC adenosine 200 mcg × 2; IC verapamil 200 mcg',
    resolution: 'Resolved',
    notes: 'TIMI flow restored 2→3 within 4 min; MBG 2 at end of case',
  },
  {
    id: 'CX-002', date: '2026-05-21', mrn: 'MRN-3917', initials: 'S.M.', age: 55, sex: 'M',
    procedure: 'Elective PCI – RCA',
    compType: 'Dissection (Type B)', severity: 'Mild', timing: 'Intra-procedural',
    management: 'Bail-out stenting – 1 additional DES deployed distally',
    resolution: 'Resolved',
    notes: 'TIMI 3 achieved; no haemodynamic compromise at any stage',
  },
  {
    id: 'CX-003', date: '2026-05-18', mrn: 'MRN-5034', initials: 'P.N.', age: 71, sex: 'F',
    procedure: 'Elective PCI – Femoral approach',
    compType: 'Bleeding – Access site hematoma', severity: 'Mild', barcGrade: 'BARC 2',
    timing: '< 24 h',
    management: 'Manual compression 20 min; pressure dressing 6 h; IV fluids',
    resolution: 'Resolved',
    notes: 'Haemoglobin drop 1.2 g/dL; no transfusion required; discharged D+1',
  },
  {
    id: 'CX-004', date: '2026-05-15', mrn: 'MRN-2288', initials: 'A.D.', age: 48, sex: 'M',
    procedure: 'Primary PCI – LCx (NSTEMI)',
    compType: 'Arrhythmia – Sustained VT', severity: 'Severe', timing: 'Intra-procedural',
    management: 'Synchronised DCCV 200J × 1; IV amiodarone 150 mg loading',
    resolution: 'Resolved',
    notes: 'Haemodynamically unstable VT at reperfusion; SR restored immediately post-DCCV',
  },
  {
    id: 'CX-005', date: '2026-05-12', mrn: 'MRN-6631', initials: 'V.S.', age: 68, sex: 'M',
    procedure: 'Rotational atherectomy + PCI – LM/LAD',
    compType: 'No-reflow', severity: 'Severe', timing: 'Intra-procedural',
    management: 'GP IIb/IIIa (tirofiban bolus + infusion); IC nitroprusside 200 mcg',
    resolution: 'Partial Resolution',
    notes: 'TIMI 2 flow persisted; MBG 1; patient transferred to ICU for monitoring',
  },
  {
    id: 'CX-006', date: '2026-05-10', mrn: 'MRN-7193', initials: 'T.R.', age: 59, sex: 'M',
    procedure: 'Elective PCI – LCx complex',
    compType: 'Dissection (Type C)', severity: 'Moderate', timing: 'Intra-procedural',
    management: 'Immediate bail-out stenting with 2 × DES; covered stent on standby',
    resolution: 'Resolved',
    notes: 'Angiographic sealing confirmed; no haemodynamic instability',
  },
  {
    id: 'CX-007', date: '2026-05-07', mrn: 'MRN-4482', initials: 'G.L.', age: 73, sex: 'M',
    procedure: 'Elective PCI – Femoral approach (complex)',
    compType: 'Bleeding – Femoral pseudoaneurysm', severity: 'Severe', barcGrade: 'BARC 3a',
    timing: '24–48 h',
    management: 'Ultrasound-guided thrombin injection 500 IU; compression 30 min',
    resolution: 'Resolved',
    notes: 'Pseudoaneurysm 2.8 cm detected on D+1 duplex; sealed after single injection',
  },
  {
    id: 'CX-008', date: '2026-05-04', mrn: 'MRN-8812', initials: 'B.V.', age: 79, sex: 'F',
    procedure: 'Primary PCI – RCA (inferior STEMI)',
    compType: 'Arrhythmia – Complete heart block', severity: 'Moderate', timing: 'Intra-procedural',
    management: 'Transvenous temporary pacing wire, rate 60 bpm; AV node recovery awaited',
    resolution: 'Resolved',
    notes: 'CHB resolved spontaneously at 18 h; temp wire removed; sinus rhythm at discharge',
  },
  {
    id: 'CX-009', date: '2026-04-29', mrn: 'MRN-3345', initials: 'W.K.', age: 66, sex: 'M',
    procedure: 'Primary PCI – LAD diagonal branch',
    compType: 'Coronary perforation (Type I)', severity: 'Moderate', timing: 'Intra-procedural',
    management: 'Prolonged balloon inflation × 8 min; reversal of UFH; echo monitoring',
    resolution: 'Resolved',
    notes: 'Ellis Type I (extraluminal crater only); no pericardial effusion on echo; TIMI 3 maintained',
  },
  {
    id: 'CX-010', date: '2026-04-24', mrn: 'MRN-5561', initials: 'D.O.', age: 52, sex: 'F',
    procedure: 'Rotational atherectomy + PCI – LAD (severe calcification)',
    compType: 'No-reflow', severity: 'Moderate', timing: 'Intra-procedural',
    management: 'IC adenosine 400 mcg; IC verapamil 200 mcg; aspiration catheter',
    resolution: 'Partial Resolution',
    notes: 'TIMI flow 2 at end; MBG 1; patient remained haemodynamically stable in CCU',
  },
  {
    id: 'CX-011', date: '2026-04-18', mrn: 'MRN-2267', initials: 'N.P.', age: 64, sex: 'M',
    procedure: 'Complex LM + LAD PCI (radial)',
    compType: 'Vascular injury – Radial artery spasm', severity: 'Mild', timing: 'Intra-procedural',
    management: 'IA cocktail (GTN 200 mcg + verapamil 2.5 mg); time: 8 min; 6Fr sheath maintained',
    resolution: 'Resolved',
    notes: 'Full sheath removal without resistance after antispasm protocol; radial pulse preserved',
  },
  {
    id: 'CX-012', date: '2026-04-14', mrn: 'MRN-7709', initials: 'C.S.', age: 77, sex: 'F',
    procedure: 'Elective PCI – Radial approach',
    compType: 'Vascular injury – Radial AV fistula', severity: 'Mild', timing: '> 48 h',
    management: 'Conservative observation; duplex Doppler monitoring every 4 weeks',
    resolution: 'Ongoing',
    notes: 'Asymptomatic AV fistula identified at 6-week follow-up; scheduled for vascular review',
  },
  {
    id: 'CX-013', date: '2026-04-09', mrn: 'MRN-9910', initials: 'H.T.', age: 71, sex: 'M',
    procedure: 'Complex LM bifurcation PCI (provisional)',
    compType: 'Stroke / TIA', severity: 'Severe', timing: '< 24 h',
    management: 'Neurology consult; CT angiography; IV heparin bridge; antiplatelet optimisation',
    resolution: 'Resolved',
    notes: 'Right-sided hemisensory TIA; symptoms fully resolved at 12 h; MRI: no new infarct',
  },
  {
    id: 'CX-014', date: '2026-04-03', mrn: 'MRN-6628', initials: 'O.F.', age: 58, sex: 'M',
    procedure: 'Primary PCI – LAD (anterior STEMI)',
    compType: 'Cardiac arrest (VF)', severity: 'Life-threatening', timing: 'Intra-procedural',
    management: 'CPR 2 min; unsynchronised defibrillation 360J × 1; ROSC achieved; PCI completed',
    resolution: 'Resolved',
    notes: 'VF at reperfusion (reperfusion arrhythmia); PCI proceeded; TIMI 3 achieved; discharged D+5',
  },
]

// ─── Chart data ───────────────────────────────────────────────────────────────

// Tab 1 – Immediate Complications
const COMP_TYPE_RATES = [
  { name: 'No-reflow',               rate: 3.5, n: 7  },
  { name: 'Arrhythmia',              rate: 4.5, n: 9  },
  { name: 'Dissection',              rate: 2.5, n: 5  },
  { name: 'Vascular injury',         rate: 1.5, n: 3  },
  { name: 'Bleeding (BARC ≥ 2)',     rate: 2.0, n: 4  },
  { name: 'Coronary perforation',    rate: 0.5, n: 1  },
  { name: 'Stroke / TIA',            rate: 0.5, n: 1  },
  { name: 'Cardiac arrest',          rate: 0.5, n: 1  },
]

const SEVERITY_DIST = [
  { name: 'Mild',             value: 5 },
  { name: 'Moderate',         value: 6 },
  { name: 'Severe',           value: 4 },
  { name: 'Life-threatening', value: 1 },
]

const COMP_MANAGEMENT = [
  { name: 'Pharmacological only',     value: 7 },
  { name: 'Additional stenting',      value: 3 },
  { name: 'Mechanical / Procedural',  value: 4 },
  { name: 'Surgical / Referral',      value: 1 },
  { name: 'Conservative',             value: 1 },
]

const COMP_TIMING = [
  { name: 'Intra-procedural', value: 10 },
  { name: '< 24 h',           value: 2  },
  { name: '24–48 h',          value: 1  },
  { name: '> 48 h',           value: 1  },
]

// Tab 2 – Reperfusion Quality
const DTB_DIST = [
  { name: '< 60 min',  value: 52, benchmark: true  },
  { name: '60–90 min', value: 91                   },
  { name: '90–120 min',value: 63                   },
  { name: '> 120 min', value: 42, alert: true       },
]

const FMC_DIST = [
  { name: '< 90 min',  value: 41, benchmark: true  },
  { name: '90–120 min',value: 68                   },
  { name: '120–180 min',value: 48                  },
  { name: '> 180 min', value: 30, alert: true       },
]

const TIMI_FLOW = [
  { name: 'TIMI 0', value: 3  },
  { name: 'TIMI 1', value: 5  },
  { name: 'TIMI 2', value: 13 },
  { name: 'TIMI 3', value: 157},
]

const MBG_DIST = [
  { name: 'MBG 0', value: 8  },
  { name: 'MBG 1', value: 17 },
  { name: 'MBG 2', value: 42 },
  { name: 'MBG 3', value: 111},
]

// Tab 3 – Device & Technique
const STENT_TYPE = [
  { name: 'DES (drug-eluting)',      value: 169 },
  { name: 'BMS (bare-metal)',        value: 9   },
  { name: 'BVS (bioresorbable)',     value: 2   },
  { name: 'Covered stent',           value: 2   },
]

const STENT_DIAMETER = [
  { name: '2.25 mm', value: 8  },
  { name: '2.50 mm', value: 24 },
  { name: '2.75 mm', value: 36 },
  { name: '3.00 mm', value: 68 },
  { name: '3.50 mm', value: 48 },
  { name: '4.00 mm', value: 24 },
  { name: '≥ 4.50 mm', value: 6 },
]

const STENT_LENGTH = [
  { name: '≤ 14 mm', value: 32  },
  { name: '15–24 mm', value: 78 },
  { name: '25–33 mm', value: 56 },
  { name: '34–44 mm', value: 26 },
  { name: '≥ 45 mm', value: 12  },
]

const IMAGING_GUIDANCE = [
  { name: 'No intravascular imaging', value: 116 },
  { name: 'IVUS',                     value: 37  },
  { name: 'OCT',                      value: 21  },
  { name: 'Both IVUS + OCT',          value: 4   },
]

// Tab 4 – Lesion Complexity
const LESION_FEATURES = [
  { name: 'Calcification (mod/severe)', value: 31 },
  { name: 'Bifurcation involvement',    value: 24 },
  { name: 'High thrombus burden',       value: 18 },
  { name: 'CTO',                        value: 12 },
  { name: 'Left main disease',          value: 8  },
  { name: 'Multi-vessel PCI (same sit.)', value: 16 },
]

const CALCIFICATION_SEVERITY = [
  { name: 'None',     value: 64 },
  { name: 'Mild',     value: 74 },
  { name: 'Moderate', value: 42 },
  { name: 'Severe',   value: 21 },
]

const THROMBUS_GRADE = [
  { name: 'Grade 0 (None)',         value: 89 },
  { name: 'Grade 1 (Possible)',     value: 24 },
  { name: 'Grade 2 (Definite < ½)',  value: 28 },
  { name: 'Grade 3 (Definite > ½)', value: 24 },
  { name: 'Grade 4 (Total occlusion < 3 vessel diam.)', value: 21 },
  { name: 'Grade 5 (Total occlusion)',value: 15 },
]

const CTO_OUTCOMES = [
  { name: 'Technical success', value: 18 },
  { name: 'Failed – deferred', value: 4  },
  { name: 'Failed – referred CABG', value: 2 },
]

// Tab 5 – Procedural Quality
const ACCESS_ROUTE = [
  { name: 'Radial (right)',  value: 141 },
  { name: 'Radial (left)',   value: 32  },
  { name: 'Femoral',         value: 28  },
]

const CONTRAST_VOL = [
  { name: '< 75 mL',   value: 24 },
  { name: '75–150 mL', value: 69 },
  { name: '150–200 mL', value: 61},
  { name: '200–300 mL', value: 34},
  { name: '> 300 mL',  value: 13 },
]

const FLUORO_TIME = [
  { name: '< 7 min',   value: 34 },
  { name: '7–14 min',  value: 84 },
  { name: '14–21 min', value: 48 },
  { name: '21–30 min', value: 24 },
  { name: '> 30 min',  value: 11 },
]

const RADIATION_DOSE = [
  { name: '< 0.5 Gy',  value: 22 },
  { name: '0.5–1 Gy',  value: 54 },
  { name: '1–2 Gy',    value: 84 },
  { name: '2–3 Gy',    value: 32 },
  { name: '> 3 Gy',    value: 9  },
]

// Tab 6 – Post-Procedure
const SUCCESS_METRICS = [
  { name: 'Technical PCI success',   actual: 94, target: 95 },
  { name: 'Final TIMI 3 flow',        actual: 91, target: 90 },
  { name: 'Residual stenosis < 20%',  actual: 88, target: 85 },
  { name: 'Haemodynamic stability',   actual: 94, target: 95 },
  { name: 'No in-hospital MACE',      actual: 96, target: 96 },
]

const RESIDUAL_STENOSIS = [
  { name: '< 10%',   value: 127 },
  { name: '10–20%',  value: 49  },
  { name: '20–30%',  value: 16  },
  { name: '> 30%',   value: 9   },
]

const ICU_REASONS = [
  { name: 'Haemodynamic support (IABP/ECMO)', value: 22 },
  { name: 'Cardiogenic shock monitoring',      value: 18 },
  { name: 'Complex arrhythmia management',     value: 14 },
  { name: 'Post-arrest observation',           value: 9  },
  { name: 'Haemorrhagic complication',         value: 4  },
]

const HAEMO_STATUS = [
  { name: 'Stable throughout',             value: 168 },
  { name: 'Transient instability – resolved', value: 24 },
  { name: 'Required vasopressors / inotropes', value: 9 },
]

// ─── Benchmarks ───────────────────────────────────────────────────────────────
const BENCHMARKS: Record<AuditTab, Benchmark[]> = {
  complications: [
    { metric: 'Overall complication rate',        target: '< 7%',   actual: '6.5%',  met: true  },
    { metric: 'No-reflow rate',                   target: '< 4%',   actual: '3.5%',  met: true  },
    { metric: 'Coronary perforation rate',        target: '< 0.5%', actual: '0.5%',  met: true  },
    { metric: 'Major bleeding (BARC ≥ 3)',        target: '< 1%',   actual: '0.5%',  met: true  },
    { metric: 'Stroke / TIA rate',                target: '< 1%',   actual: '0.5%',  met: true  },
  ],
  reperfusion: [
    { metric: 'STEMI: DTB < 90 min',              target: '> 75%',  actual: '82%',   met: true  },
    { metric: 'STEMI: FMC-to-device < 120 min',   target: '> 70%',  actual: '74%',   met: true  },
    { metric: 'Final TIMI 3 flow (primary PCI)',   target: '> 90%',  actual: '91%',   met: true  },
    { metric: 'Myocardial blush grade 2–3',        target: '> 75%',  actual: '78%',   met: true  },
    { metric: 'STEMI in-hospital mortality',       target: '< 5%',   actual: '3.4%',  met: true  },
  ],
  device: [
    { metric: 'DES utilisation rate',              target: '> 95%',  actual: '94%',   met: false },
    { metric: 'Post-dilatation performed',         target: '> 60%',  actual: '68%',   met: true  },
    { metric: 'Intravascular imaging in complex PCI', target: '> 30%', actual: '38%', met: true  },
    { metric: 'Stent expansion assessed (IVUS/OCT)', target: '> 25%', actual: '31%', met: true  },
    { metric: 'Optimal stent result (MSA ≥ reference)', target: '> 85%', actual: '82%', met: false },
  ],
  lesion: [
    { metric: 'CTO PCI technical success',         target: '> 75%',  actual: '75%',   met: true  },
    { metric: 'Bifurcation: main vessel TIMI 3',   target: '> 95%',  actual: '96%',   met: true  },
    { metric: 'Heavily calcified: post-dilatation', target: '> 80%', actual: '83%',   met: true  },
    { metric: 'LM PCI: imaging-guided',            target: '> 70%',  actual: '69%',   met: false },
    { metric: 'High thrombus: aspiration thrombectomy', target: '> 60%', actual: '64%', met: true },
  ],
  procedural: [
    { metric: 'Radial access rate',                target: '> 80%',  actual: '86%',   met: true  },
    { metric: 'Median contrast volume ≤ 200 mL',   target: '≤ 200 mL', actual: '168 mL', met: true },
    { metric: 'Median fluoroscopy time ≤ 15 min',  target: '≤ 15 min', actual: '14 min', met: true },
    { metric: 'Radiation > 3 Gy (high dose) rate', target: '< 5%',  actual: '4.5%',  met: true  },
    { metric: 'Procedure duration > 90 min rate',  target: '< 15%', actual: '13%',   met: true  },
  ],
  postprocedure: [
    { metric: 'PCI technical success rate',        target: '> 95%',  actual: '94%',   met: false },
    { metric: 'TIMI 3 flow at end of procedure',   target: '> 90%',  actual: '91%',   met: true  },
    { metric: 'Residual stenosis < 20%',           target: '> 85%',  actual: '88%',   met: true  },
    { metric: 'ICU transfer rate',                 target: '< 25%',  actual: '22%',   met: true  },
    { metric: 'Haemodynamic stability at case end', target: '> 92%', actual: '94%',   met: true  },
  ],
}

// ─── Constants ────────────────────────────────────────────────────────────────
const PALETTE = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#84cc16', '#ec4899']
const SEV_COLORS: Record<Severity, string> = {
  'Mild':             '#10b981',
  'Moderate':         '#f59e0b',
  'Severe':           '#f97316',
  'Life-threatening': '#ef4444',
}
const RES_COLORS: Record<Resolution, string> = {
  'Resolved':           '#10b981',
  'Partial Resolution': '#f59e0b',
  'Ongoing':            '#f97316',
  'Fatal':              '#ef4444',
}

const TABS: { id: AuditTab; label: string; shortLabel: string }[] = [
  { id: 'complications',  label: 'Immediate Complications',    shortLabel: 'Complications'  },
  { id: 'reperfusion',    label: 'Reperfusion Quality',        shortLabel: 'Reperfusion'    },
  { id: 'device',         label: 'Device & Technique',         shortLabel: 'Device/Tech'    },
  { id: 'lesion',         label: 'Lesion Complexity',          shortLabel: 'Lesion'         },
  { id: 'procedural',     label: 'Procedural Quality',         shortLabel: 'Procedural'     },
  { id: 'postprocedure',  label: 'Post-Procedure Outcomes',    shortLabel: 'Post-Procedure' },
]

// ─── Shared chart tooltip ─────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function DarkTip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="text-xs rounded-xl px-3 py-2 border border-blue-500/20 backdrop-blur-md"
      style={{ background: 'rgba(10,17,40,0.97)', color: '#e2e8f0' }}>
      {label && <p className="font-semibold mb-1">{label}</p>}
      {payload.map((p: { name: string; value: number; color: string }, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
          <span style={{ color: '#94a3b8' }}>{p.name}:</span>
          <span className="font-bold" style={{ color: p.color }}>{p.value}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Severity badge ───────────────────────────────────────────────────────────
function SevBadge({ sev }: { sev: Severity }) {
  const map: Record<Severity, string> = {
    'Mild':             'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
    'Moderate':         'bg-amber-500/15 text-amber-400 border-amber-500/25',
    'Severe':           'bg-orange-500/15 text-orange-400 border-orange-500/25',
    'Life-threatening': 'bg-red-500/15 text-red-400 border-red-500/25',
  }
  return <span className={cn('text-[10px] px-2 py-0.5 rounded-full border font-medium whitespace-nowrap', map[sev])}>{sev}</span>
}

function ResBadge({ res }: { res: Resolution }) {
  const map: Record<Resolution, string> = {
    'Resolved':           'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
    'Partial Resolution': 'bg-amber-500/15 text-amber-400 border-amber-500/25',
    'Ongoing':            'bg-orange-500/15 text-orange-400 border-orange-500/25',
    'Fatal':              'bg-red-500/15 text-red-400 border-red-500/25',
  }
  return <span className={cn('text-[10px] px-2 py-0.5 rounded-full border font-medium whitespace-nowrap', map[res])}>{res}</span>
}

// ─── Benchmark panel ──────────────────────────────────────────────────────────
function BenchmarkPanel({ items }: { items: Benchmark[] }) {
  return (
    <div className="glass-card p-4 border border-blue-500/10">
      <p className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
        <Target size={13} className="text-blue-400" /> Quality Benchmarks
      </p>
      <div className="space-y-2.5">
        {items.map(b => (
          <div key={b.metric} className="text-xs">
            <div className="flex items-start justify-between gap-2 mb-1">
              <span className="text-gray-400 leading-tight flex-1">{b.metric}</span>
              <span className={cn('font-bold text-[11px] whitespace-nowrap ml-2', b.met ? 'text-emerald-400' : 'text-red-400')}>
                {b.actual} {b.met ? '✓' : '✗'}
              </span>
            </div>
            <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden">
              <div className="h-full rounded-full" style={{ width: '100%', background: b.met ? '#10b981' : '#ef4444', opacity: 0.5 }} />
            </div>
            <p className="text-[9px] text-gray-600 mt-0.5">Target: {b.target}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Complication records table ───────────────────────────────────────────────
function CompTable({ records }: { records: ComplicationRecord[] }) {
  const [q, setQ] = useState('')
  const filtered = useMemo(() =>
    records.filter(r =>
      !q ||
      r.compType.toLowerCase().includes(q.toLowerCase()) ||
      r.procedure.toLowerCase().includes(q.toLowerCase()) ||
      r.mrn.toLowerCase().includes(q.toLowerCase()) ||
      r.management.toLowerCase().includes(q.toLowerCase())
    ), [records, q])

  return (
    <div className="glass-card border border-blue-500/10 overflow-hidden">
      <div className="px-4 py-3 border-b border-blue-500/10 flex items-center gap-3">
        <p className="text-sm font-semibold text-white flex-1 flex items-center gap-2">
          <ShieldAlert size={14} className="text-red-400" /> Complication Case Log
          <span className="text-[10px] text-gray-500 font-normal">{records.length} events · {((records.length / 201) * 100).toFixed(1)}% of procedures</span>
        </p>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500" />
          <input
            type="text" placeholder="Search complication, MRN, procedure…"
            value={q} onChange={e => setQ(e.target.value)}
            className="text-xs py-1.5 rounded-lg border border-blue-500/15 bg-white/[0.04] text-gray-300 placeholder-gray-600 focus:outline-none focus:border-blue-500/40 w-60"
            style={{ paddingLeft: '1.75rem', paddingRight: '0.75rem' }}
          />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-blue-500/10">
              {['ID', 'Date', 'MRN', 'Age/Sex', 'Procedure', 'Complication', 'Severity', 'Timing', 'Management', 'Resolution', 'Notes'].map(h => (
                <th key={h} className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={11} className="px-4 py-8 text-center text-gray-500 text-xs">No matching records.</td></tr>
            )}
            {filtered.map((r, i) => (
              <tr key={r.id} className={cn('border-b border-blue-500/5 hover:bg-white/[0.02] transition-colors', i % 2 ? 'bg-white/[0.01]' : '')}>
                <td className="px-3 py-2.5 font-mono text-[10px] text-blue-400">{r.id}</td>
                <td className="px-3 py-2.5 text-gray-400 whitespace-nowrap">{r.date}</td>
                <td className="px-3 py-2.5 font-mono text-[10px] text-gray-500">{r.mrn}</td>
                <td className="px-3 py-2.5 text-gray-400 whitespace-nowrap">{r.age}y/{r.sex}</td>
                <td className="px-3 py-2.5 text-white max-w-[180px]"><span className="line-clamp-1">{r.procedure}</span></td>
                <td className="px-3 py-2.5 max-w-[160px]">
                  <span className="text-red-300 font-medium line-clamp-1">{r.compType}</span>
                  {r.barcGrade && <span className="block text-[9px] text-orange-400 mt-0.5">{r.barcGrade}</span>}
                </td>
                <td className="px-3 py-2.5"><SevBadge sev={r.severity} /></td>
                <td className="px-3 py-2.5 text-gray-400 whitespace-nowrap text-[10px]">{r.timing}</td>
                <td className="px-3 py-2.5 text-gray-400 max-w-[200px]"><span className="line-clamp-2">{r.management}</span></td>
                <td className="px-3 py-2.5"><ResBadge res={r.resolution} /></td>
                <td className="px-3 py-2.5 text-gray-500 max-w-[180px] text-[10px]"><span className="line-clamp-2">{r.notes}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-2 border-t border-blue-500/10">
        <p className="text-[10px] text-gray-600">{filtered.length} of {records.length} records shown</p>
      </div>
    </div>
  )
}

// ─── Reusable chart cards ─────────────────────────────────────────────────────
function PieCard({ title, data, height = 220 }: { title: string; data: { name: string; value: number }[]; height?: number }) {
  return (
    <div className="glass-card p-5 border border-blue-500/10">
      <p className="text-sm font-semibold text-white mb-3">{title}</p>
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" outerRadius={height * 0.31}
            dataKey="value"
            label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
            labelLine={false} stroke="rgba(10,17,40,0.7)" strokeWidth={2}>
            {data.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
          </Pie>
          <Tooltip content={<DarkTip />} />
          <Legend formatter={(v: string) => <span style={{ fontSize: 9, color: '#94a3b8' }}>{v}</span>} iconSize={7} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}

function BarVCard({ title, data, color = '#3b82f6', refLine }: { title: string; data: { name: string; value: number; benchmark?: boolean; alert?: boolean }[]; color?: string; refLine?: number }) {
  return (
    <div className="glass-card p-5 border border-blue-500/10">
      <p className="text-sm font-semibold text-white mb-3">{title}</p>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(59,130,246,0.07)" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip content={<DarkTip />} />
          {refLine !== undefined && <ReferenceLine y={refLine} stroke="#f59e0b" strokeDasharray="4 2" label={{ value: 'Target', position: 'right', fontSize: 9, fill: '#f59e0b' }} />}
          <Bar dataKey="value" radius={[3, 3, 0, 0]} maxBarSize={40}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.alert ? '#ef4444' : d.benchmark ? '#10b981' : color} opacity={0.75 + i * 0.03} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function BarHCard({ title, data, color = '#3b82f6', unit = '' }: { title: string; data: { name: string; value: number | string; actual?: number }[]; color?: string; unit?: string }) {
  return (
    <div className="glass-card p-5 border border-blue-500/10">
      <p className="text-sm font-semibold text-white mb-3">{title}</p>
      <ResponsiveContainer width="100%" height={Math.max(180, data.length * 38)}>
        <BarChart data={data} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(59,130,246,0.07)" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} unit={unit} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#cbd5e1' }} tickLine={false} axisLine={false} width={160} />
          <Tooltip content={<DarkTip />} />
          <Bar dataKey="value" fill={color} radius={[0, 4, 4, 0]} maxBarSize={16} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// Success vs target bar chart
function SuccessVsTargetCard({ data }: { data: { name: string; actual: number; target: number }[] }) {
  return (
    <div className="glass-card p-5 border border-blue-500/10">
      <p className="text-sm font-semibold text-white mb-3">Outcome Metrics vs Benchmark (%)</p>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(59,130,246,0.07)" horizontal={false} />
          <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} unit="%" />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#cbd5e1' }} tickLine={false} axisLine={false} width={150} />
          <Tooltip content={<DarkTip />} />
          <Legend formatter={(v: string) => <span style={{ fontSize: 10, color: '#94a3b8' }}>{v}</span>} iconSize={8} />
          <Bar dataKey="actual" name="Actual" radius={[0, 4, 4, 0]} maxBarSize={12}>
            {data.map((d, i) => <Cell key={i} fill={d.actual >= d.target ? '#10b981' : '#ef4444'} />)}
          </Bar>
          <Bar dataKey="target" name="Target" fill="rgba(148,163,184,0.2)" radius={[0, 4, 4, 0]} maxBarSize={12} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ─── KPI strip ────────────────────────────────────────────────────────────────
function KpiStrip({ items }: { items: { label: string; value: string; sub?: string; icon: React.ElementType; colorClass: string; bgClass: string }[] }) {
  return (
    <div className={cn('grid gap-4', `grid-cols-2 lg:grid-cols-${items.length}`)}>
      {items.map(s => (
        <div key={s.label} className="glass-card p-4 flex items-center gap-3 border border-blue-500/10">
          <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0', s.bgClass)}>
            <s.icon className={s.colorClass} size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-gray-400 truncate">{s.label}</p>
            <p className="text-xl font-bold text-white">{s.value}</p>
            {s.sub && <p className="text-[9px] text-gray-500 mt-0.5">{s.sub}</p>}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ComplicationAuditPage() {
  const [activeTab, setActiveTab] = useState<AuditTab>('complications')

  return (
    <div className="space-y-5 animate-fade-in">

      {/* ⚠️ DEMO DATA WARNING */}
      <div className="p-4 bg-amber-950/50 border-2 border-amber-500/60 rounded-lg flex items-start gap-3 text-amber-100">
        <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5 animate-pulse" />
        <div>
          <p className="text-sm font-bold text-amber-100">⚠️ DEMO DATA — Complication records are fictional</p>
          <p className="text-xs text-amber-100/80 mt-1">All complication statistics shown are illustrative sample data only. Do NOT use these numbers for clinical quality reporting or safety monitoring. Requires integration with your Cath Lab workflow to display real complications.</p>
        </div>
      </div>

      {/* ── Critical header ── */}
      <div className="glass-card overflow-hidden border border-red-500/20">
        <div className="px-6 py-4" style={{ background: 'linear-gradient(135deg, #7f1d1d 0%, #b91c1c 50%, #dc2626 100%)' }}>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                <ShieldAlert size={20} className="text-red-200" /> Complication Audit Dashboard
              </h1>
              <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.75)' }}>
                Coronary & Interventional Cardiology · Quality & Safety Monitoring · 201 PCI/Angio Procedures (YTD 2026)
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.15)' }}>
                <span className="text-red-200 font-medium">Total complications:</span>
                <span className="text-white font-bold">14 events</span>
                <span className="text-red-200">(6.97%)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Global KPI strip */}
        <div className="grid grid-cols-2 md:grid-cols-5 divide-x divide-y md:divide-y-0 divide-white/[0.06]">
          {[
            { label: 'Any Complication',         value: '14',    sub: '6.97% of procedures', color: '#f87171' },
            { label: 'Life-threatening Events',   value: '1',     sub: '0.5% rate',           color: '#ef4444' },
            { label: 'Resolved Intra-op',         value: '10',    sub: '71.4% of events',     color: '#10b981' },
            { label: 'Required Escalation',       value: '4',     sub: 'ICU / additional Rx',  color: '#f59e0b' },
            { label: 'Procedure-related Mortality', value: '0',   sub: '0% in-lab mortality', color: '#10b981' },
          ].map(k => (
            <div key={k.label} className="px-5 py-3">
              <p className="text-2xl font-bold" style={{ color: k.color }}>{k.value}</p>
              <p className="text-xs text-gray-400 mt-0.5">{k.label}</p>
              <p className="text-[10px] text-gray-600 mt-0.5">{k.sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1.5 flex-wrap">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={cn(
              'text-xs px-3.5 py-2 rounded-xl border transition-all font-medium',
              activeTab === t.id
                ? 'bg-red-600/80 border-red-500/50 text-white'
                : 'text-gray-400 border-blue-500/10 bg-white/[0.03] hover:text-white hover:bg-white/[0.05]'
            )}
          >
            {t.shortLabel}
          </button>
        ))}
      </div>

      {/* ══════════════════ TAB 1: Immediate Complications ══════════════════ */}
      {activeTab === 'complications' && (
        <>
          <KpiStrip items={[
            { label: 'Total Complication Events',   value: '14',   icon: ShieldAlert,    colorClass: 'text-red-400',     bgClass: 'bg-red-500/10'     },
            { label: 'No-reflow Events',            value: '3',    icon: Activity,       colorClass: 'text-orange-400',  bgClass: 'bg-orange-500/10'  },
            { label: 'Arrhythmia Events',           value: '2',    icon: Zap,            colorClass: 'text-amber-400',   bgClass: 'bg-amber-500/10'   },
            { label: 'Major Bleeding (BARC ≥ 3)',   value: '1',    icon: AlertTriangle,  colorClass: 'text-red-400',     bgClass: 'bg-red-500/10'     },
          ]} />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Complication rates */}
            <div className="glass-card p-5 border border-blue-500/10 md:col-span-2">
              <p className="text-sm font-semibold text-white mb-3">Complication Rate by Type (% of 201 procedures)</p>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={COMP_TYPE_RATES} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(59,130,246,0.07)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} unit="%" domain={[0, 6]} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#cbd5e1' }} tickLine={false} axisLine={false} width={165} />
                  <Tooltip content={<DarkTip />} />
                  <ReferenceLine x={1} stroke="rgba(239,68,68,0.4)" strokeDasharray="4 2" />
                  <Bar dataKey="rate" name="Rate (%)" radius={[0, 4, 4, 0]} maxBarSize={16}>
                    {COMP_TYPE_RATES.map((d, i) => (
                      <Cell key={i} fill={d.rate >= 3 ? '#ef4444' : d.rate >= 1.5 ? '#f59e0b' : '#10b981'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-4">
              <PieCard title="Severity Distribution" data={SEVERITY_DIST.map(d => ({ ...d }))} height={180} />
              <BenchmarkPanel items={BENCHMARKS.complications} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <BarHCard title="Management Strategy" data={COMP_MANAGEMENT.map(d => ({ name: d.name, value: d.value }))} color="#f97316" />
            <BarVCard title="Complication Occurrence Timing" data={COMP_TIMING} color="#ef4444" />
          </div>

          <CompTable records={COMP_RECORDS} />
        </>
      )}

      {/* ══════════════════ TAB 2: Reperfusion Quality ══════════════════ */}
      {activeTab === 'reperfusion' && (
        <>
          <KpiStrip items={[
            { label: 'STEMI Cases (YTD)',         value: '187',  icon: Activity,      colorClass: 'text-blue-400',    bgClass: 'bg-blue-500/10'    },
            { label: 'DTB < 90 min',              value: '82%',  icon: Clock,         colorClass: 'text-emerald-400', bgClass: 'bg-emerald-500/10' },
            { label: 'FMC-to-Device < 120 min',   value: '74%',  icon: TrendingUp,    colorClass: 'text-amber-400',   bgClass: 'bg-amber-500/10'   },
            { label: 'Final TIMI 3 Flow',          value: '91%',  icon: CheckCircle,   colorClass: 'text-emerald-400', bgClass: 'bg-emerald-500/10' },
          ]} />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <BarVCard
              title="Door-to-Balloon Time Distribution (Primary PCI)"
              data={DTB_DIST}
              color="#ef4444"
            />
            <BarVCard
              title="FMC-to-Device Time Distribution (min)"
              data={FMC_DIST}
              color="#f97316"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="glass-card p-5 border border-blue-500/10">
              <p className="text-sm font-semibold text-white mb-3">Final TIMI Flow Grade</p>
              <ResponsiveContainer width="100%" height={210}>
                <PieChart>
                  <Pie data={TIMI_FLOW} cx="50%" cy="50%" outerRadius={65}
                    dataKey="value"
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    labelLine={false} stroke="rgba(10,17,40,0.7)" strokeWidth={2}>
                    {TIMI_FLOW.map((_, i) => <Cell key={i} fill={['#ef4444', '#f97316', '#f59e0b', '#10b981'][i]} />)}
                  </Pie>
                  <Tooltip content={<DarkTip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-2 space-y-1">
                {TIMI_FLOW.map((t, i) => (
                  <div key={t.name} className="flex justify-between text-xs">
                    <span style={{ color: ['#ef4444', '#f97316', '#f59e0b', '#10b981'][i] }}>{t.name}</span>
                    <span className="text-gray-400">{t.value} pts ({((t.value / 178) * 100).toFixed(0)}%)</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-card p-5 border border-blue-500/10">
              <p className="text-sm font-semibold text-white mb-3">Myocardial Blush Grade (MBG)</p>
              <ResponsiveContainer width="100%" height={210}>
                <PieChart>
                  <Pie data={MBG_DIST} cx="50%" cy="50%" outerRadius={65}
                    dataKey="value"
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    labelLine={false} stroke="rgba(10,17,40,0.7)" strokeWidth={2}>
                    {MBG_DIST.map((_, i) => <Cell key={i} fill={['#ef4444', '#f59e0b', '#3b82f6', '#10b981'][i]} />)}
                  </Pie>
                  <Tooltip content={<DarkTip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-2 space-y-1">
                {MBG_DIST.map((m, i) => (
                  <div key={m.name} className="flex justify-between text-xs">
                    <span style={{ color: ['#ef4444', '#f59e0b', '#3b82f6', '#10b981'][i] }}>{m.name}</span>
                    <span className="text-gray-400">{m.value} pts ({((m.value / 178) * 100).toFixed(0)}%)</span>
                  </div>
                ))}
              </div>
            </div>

            <BenchmarkPanel items={BENCHMARKS.reperfusion} />
          </div>
        </>
      )}

      {/* ══════════════════ TAB 3: Device & Technique ══════════════════ */}
      {activeTab === 'device' && (
        <>
          <KpiStrip items={[
            { label: 'Total Stents Deployed',     value: '214',   icon: Activity,     colorClass: 'text-blue-400',    bgClass: 'bg-blue-500/10'    },
            { label: 'DES Utilisation Rate',      value: '94%',   icon: CheckCircle,  colorClass: 'text-emerald-400', bgClass: 'bg-emerald-500/10' },
            { label: 'Post-dilatation Rate',      value: '68%',   icon: TrendingUp,   colorClass: 'text-amber-400',   bgClass: 'bg-amber-500/10'   },
            { label: 'Intravascular Imaging Used','value': '31%', icon: Target,       colorClass: 'text-violet-400',  bgClass: 'bg-violet-500/10'  },
          ]} />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <PieCard title="Stent Type" data={STENT_TYPE} />
            <PieCard title="Imaging Guidance" data={IMAGING_GUIDANCE} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <BarVCard title="Stent Diameter Distribution (mm)" data={STENT_DIAMETER} color="#3b82f6" />
            <BarVCard title="Stent Length Distribution (mm)" data={STENT_LENGTH} color="#8b5cf6" />
            <BenchmarkPanel items={BENCHMARKS.device} />
          </div>

          {/* Post-dilatation + imaging details panel */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="glass-card p-5 border border-blue-500/10">
              <p className="text-sm font-semibold text-white mb-4">Post-dilatation & Imaging Guidance Summary</p>
              <div className="space-y-3">
                {[
                  { label: 'Post-dilatation performed',              value: 68,  sub: '137/201 procedures'           },
                  { label: 'Non-compliant balloon used',             value: 54,  sub: '109/201 procedures'           },
                  { label: 'IVUS guidance',                          value: 18,  sub: '37/201 – LM, complex cases'   },
                  { label: 'OCT guidance',                           value: 10,  sub: '21/201 – ISR, optimisation'   },
                  { label: 'Both IVUS + OCT',                        value: 2,   sub: '4/201 – highly complex PCI'   },
                  { label: 'Rotational atherectomy performed',       value: 7,   sub: '14/201 – severe calcification' },
                ].map(item => (
                  <div key={item.label}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-400">{item.label}</span>
                      <span className="text-white font-semibold">{item.value}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                      <div className="h-full rounded-full bg-blue-500/70" style={{ width: `${item.value}%` }} />
                    </div>
                    <p className="text-[9px] text-gray-600 mt-0.5">{item.sub}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="glass-card p-5 border border-blue-500/10">
              <p className="text-sm font-semibold text-white mb-4">Stent Brand & Platform Distribution</p>
              <div className="space-y-2">
                {[
                  { brand: 'Xience Sierra (Abbott)',          n: 64,  pct: 30 },
                  { brand: 'Resolute Onyx (Medtronic)',       n: 48,  pct: 22 },
                  { brand: 'Synergy (Boston Scientific)',     n: 42,  pct: 20 },
                  { brand: 'Orsiro Mission (Biotronik)',      n: 32,  pct: 15 },
                  { brand: 'COMBO (OrbusNeich)',              n: 14,  pct: 7  },
                  { brand: 'Other / BMS / Covered',          n: 14,  pct: 7  },
                ].map(b => (
                  <div key={b.brand} className="flex items-center gap-3 text-xs">
                    <span className="text-gray-400 flex-1 truncate">{b.brand}</span>
                    <div className="w-24 h-1.5 rounded-full bg-white/[0.06] overflow-hidden flex-shrink-0">
                      <div className="h-full rounded-full bg-violet-500/70" style={{ width: `${b.pct}%` }} />
                    </div>
                    <span className="text-gray-300 w-8 text-right text-[10px]">{b.n}</span>
                    <span className="text-gray-500 w-7 text-right text-[10px]">{b.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ══════════════════ TAB 4: Lesion Complexity ══════════════════ */}
      {activeTab === 'lesion' && (
        <>
          <KpiStrip items={[
            { label: 'Bifurcation Lesions',       value: '24%',  icon: Activity,     colorClass: 'text-amber-400',   bgClass: 'bg-amber-500/10'   },
            { label: 'CTO Attempted',             value: '12%',  icon: Target,       colorClass: 'text-red-400',     bgClass: 'bg-red-500/10'     },
            { label: 'Left Main Involvement',     value: '8%',   icon: ShieldAlert,  colorClass: 'text-orange-400',  bgClass: 'bg-orange-500/10'  },
            { label: 'High Thrombus Burden',      value: '18%',  icon: AlertTriangle,colorClass: 'text-violet-400',  bgClass: 'bg-violet-500/10'  },
          ]} />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <BarHCard
              title="Lesion Feature Prevalence (% of procedures)"
              data={LESION_FEATURES.map(d => ({ name: d.name, value: d.value }))}
              color="#f97316"
              unit="%"
            />
            <PieCard title="Calcification Severity" data={CALCIFICATION_SEVERITY} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <BarVCard title="TIMI Thrombus Grade Distribution" data={THROMBUS_GRADE} color="#ef4444" />
            <div className="glass-card p-5 border border-blue-500/10">
              <p className="text-sm font-semibold text-white mb-4">CTO PCI Outcomes</p>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={CTO_OUTCOMES} cx="50%" cy="50%" outerRadius={60}
                    dataKey="value" label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                    labelLine={false} stroke="rgba(10,17,40,0.7)" strokeWidth={2}>
                    {CTO_OUTCOMES.map((_, i) => <Cell key={i} fill={['#10b981', '#f59e0b', '#ef4444'][i]} />)}
                  </Pie>
                  <Tooltip content={<DarkTip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-2 space-y-1">
                {CTO_OUTCOMES.map((c, i) => (
                  <div key={c.name} className="flex justify-between text-xs">
                    <span style={{ color: ['#10b981', '#f59e0b', '#ef4444'][i] }}>{c.name}</span>
                    <span className="text-gray-400">{c.value} cases</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t border-blue-500/10">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">CTO Technical Success</span>
                  <span className="text-emerald-400 font-bold">75%</span>
                </div>
                <div className="flex justify-between text-xs mt-1">
                  <span className="text-gray-400">Median procedure time</span>
                  <span className="text-white">168 min</span>
                </div>
              </div>
            </div>
            <BenchmarkPanel items={BENCHMARKS.lesion} />
          </div>

          {/* Lesion complexity score distribution */}
          <div className="glass-card p-5 border border-blue-500/10">
            <p className="text-sm font-semibold text-white mb-4">ACC/AHA Lesion Classification & SYNTAX Score</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'ACC/AHA Type A',       value: '28%', n: 56,  color: '#10b981', desc: 'Low complexity, high success' },
                { label: 'ACC/AHA Type B1',      value: '34%', n: 68,  color: '#3b82f6', desc: 'Moderately complex' },
                { label: 'ACC/AHA Type B2',      value: '26%', n: 52,  color: '#f59e0b', desc: 'Complex, moderate risk' },
                { label: 'ACC/AHA Type C',       value: '13%', n: 26,  color: '#ef4444', desc: 'High complexity, surgical risk' },
              ].map(item => (
                <div key={item.label} className="p-3 rounded-xl border" style={{ background: 'rgba(255,255,255,0.02)', borderColor: `${item.color}30` }}>
                  <p className="text-lg font-bold" style={{ color: item.color }}>{item.value}</p>
                  <p className="text-xs text-white font-medium mt-0.5">{item.label}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">{item.desc}</p>
                  <p className="text-[10px] text-gray-600 mt-1">n = {item.n}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ══════════════════ TAB 5: Procedural Quality ══════════════════ */}
      {activeTab === 'procedural' && (
        <>
          <KpiStrip items={[
            { label: 'Radial Access Rate',        value: '86%',     icon: Users,         colorClass: 'text-blue-400',    bgClass: 'bg-blue-500/10'    },
            { label: 'Median Contrast Volume',    value: '168 mL',  icon: Activity,      colorClass: 'text-cyan-400',    bgClass: 'bg-cyan-500/10'    },
            { label: 'Median Fluoroscopy Time',   value: '14 min',  icon: Clock,         colorClass: 'text-amber-400',   bgClass: 'bg-amber-500/10'   },
            { label: 'Median Radiation (AK)',     value: '1.3 Gy',  icon: ShieldAlert,   colorClass: 'text-orange-400',  bgClass: 'bg-orange-500/10'  },
          ]} />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <PieCard title="Vascular Access Route" data={ACCESS_ROUTE} />
            <BarVCard title="Contrast Volume Distribution (mL)" data={CONTRAST_VOL} color="#06b6d4" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <BarVCard title="Fluoroscopy Time Distribution (min)" data={FLUORO_TIME} color="#f59e0b" />
            <BarVCard title="Air Kerma Radiation Dose (Gy)" data={RADIATION_DOSE} color="#f97316" />
            <BenchmarkPanel items={BENCHMARKS.procedural} />
          </div>

          {/* Procedure duration + operator table */}
          <div className="glass-card p-5 border border-blue-500/10">
            <p className="text-sm font-semibold text-white mb-4">Operator-Level Procedural Metrics</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-blue-500/10">
                    {['Operator', 'Cases (YTD)', 'Radial Rate', 'Median Contrast', 'Median Fluoro', 'Median Duration', 'Radiation > 2 Gy', 'DTB Median (STEMI)'].map(h => (
                      <th key={h} className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { op: 'Dr. Jayachandra', n: 112, radial: '88%', contrast: '174 mL', fluoro: '15 min', dur: '52 min', highRad: '6%',  dtb: '71 min' },
                    { op: 'Dr. Rao',         n:  56, radial: '82%', contrast: '158 mL', fluoro: '12 min', dur: '44 min', highRad: '4%',  dtb: '74 min' },
                    { op: 'Dr. Menon',       n:  33, radial: '84%', contrast: '163 mL', fluoro: '13 min', dur: '48 min', highRad: '3%',  dtb: '78 min' },
                  ].map((row, i) => (
                    <tr key={row.op} className={cn('border-b border-blue-500/5', i % 2 ? 'bg-white/[0.01]' : '')}>
                      <td className="px-3 py-2.5 text-white font-semibold">{row.op}</td>
                      <td className="px-3 py-2.5 text-gray-400">{row.n}</td>
                      <td className="px-3 py-2.5 text-emerald-400 font-medium">{row.radial}</td>
                      <td className="px-3 py-2.5 text-gray-300">{row.contrast}</td>
                      <td className="px-3 py-2.5 text-gray-300">{row.fluoro}</td>
                      <td className="px-3 py-2.5 text-gray-300">{row.dur}</td>
                      <td className="px-3 py-2.5 text-amber-400">{row.highRad}</td>
                      <td className="px-3 py-2.5 text-gray-300">{row.dtb}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ══════════════════ TAB 6: Post-Procedure Outcomes ══════════════════ */}
      {activeTab === 'postprocedure' && (
        <>
          <KpiStrip items={[
            { label: 'PCI Technical Success',     value: '94%',  icon: CheckCircle,   colorClass: 'text-emerald-400', bgClass: 'bg-emerald-500/10' },
            { label: 'Final TIMI 3 Achieved',     value: '91%',  icon: Activity,      colorClass: 'text-blue-400',    bgClass: 'bg-blue-500/10'    },
            { label: 'ICU Transfer Rate',         value: '22%',  icon: AlertTriangle, colorClass: 'text-amber-400',   bgClass: 'bg-amber-500/10'   },
            { label: 'Haemodynamic Stability',    value: '94%',  icon: TrendingUp,    colorClass: 'text-emerald-400', bgClass: 'bg-emerald-500/10' },
          ]} />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <SuccessVsTargetCard data={SUCCESS_METRICS} />
            <div className="space-y-4">
              <PieCard title="Residual Stenosis at End of Procedure" data={RESIDUAL_STENOSIS} height={200} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <BarHCard
              title="ICU Transfer — Primary Reason"
              data={ICU_REASONS.map(d => ({ name: d.name, value: d.value }))}
              color="#f59e0b"
            />
            <div className="glass-card p-5 border border-blue-500/10">
              <p className="text-sm font-semibold text-white mb-3">Haemodynamic Status at Case End</p>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={HAEMO_STATUS} cx="50%" cy="50%" outerRadius={65}
                    dataKey="value"
                    label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                    labelLine={false} stroke="rgba(10,17,40,0.7)" strokeWidth={2}>
                    {HAEMO_STATUS.map((_, i) => <Cell key={i} fill={['#10b981', '#f59e0b', '#ef4444'][i]} />)}
                  </Pie>
                  <Tooltip content={<DarkTip />} />
                  <Legend formatter={(v: string) => <span style={{ fontSize: 9, color: '#94a3b8' }}>{v}</span>} iconSize={7} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <BenchmarkPanel items={BENCHMARKS.postprocedure} />
          </div>

          {/* In-hospital outcomes summary */}
          <div className="glass-card p-5 border border-blue-500/10">
            <p className="text-sm font-semibold text-white mb-4">In-Hospital Clinical Outcomes Summary</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'In-hospital mortality',           value: '0%',   n: 0,   color: '#10b981', target: '< 2%',   met: true  },
                { label: 'Emergency CABG',                  value: '0.5%', n: 1,   color: '#10b981', target: '< 1%',   met: true  },
                { label: 'Stroke / TIA (in-hospital)',      value: '0.5%', n: 1,   color: '#f59e0b', target: '< 1%',   met: true  },
                { label: 'Major bleeding (BARC ≥ 3b)',      value: '0.5%', n: 1,   color: '#10b981', target: '< 1%',   met: true  },
                { label: 'Stent thrombosis (definite)',     value: '0.0%', n: 0,   color: '#10b981', target: '< 0.5%', met: true  },
                { label: 'AKI requiring dialysis',          value: '1.0%', n: 2,   color: '#f59e0b', target: '< 2%',   met: true  },
                { label: 'Length of stay > 3 days',        value: '18%',  n: 36,  color: '#3b82f6', target: '< 25%',  met: true  },
                { label: '30-day readmission rate',         value: '5.5%', n: 11,  color: '#10b981', target: '< 8%',   met: true  },
              ].map(item => (
                <div key={item.label} className="p-3 rounded-xl border" style={{ background: 'rgba(255,255,255,0.02)', borderColor: `${item.color}30` }}>
                  <div className="flex items-start justify-between">
                    <p className="text-lg font-bold" style={{ color: item.color }}>{item.value}</p>
                    <span className={cn('text-[10px] font-bold', item.met ? 'text-emerald-400' : 'text-red-400')}>{item.met ? '✓' : '✗'}</span>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-0.5 leading-tight">{item.label}</p>
                  <p className="text-[9px] text-gray-600 mt-1">Target: {item.target} · n={item.n}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
