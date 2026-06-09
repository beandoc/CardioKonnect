'use client'
import { useState, useMemo } from 'react'
import {
  BarChart, Bar, PieChart, Pie, Cell,
  AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import {
  Activity, Users, CheckCircle, AlertTriangle, Clock,
  Search, TrendingUp, Zap, Shield, Heart, Stethoscope, Layers,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────
type CategoryId = 'all' | 'coronary' | 'ep' | 'device' | 'structural' | 'emergency' | 'diagnostic'
type Outcome = 'Success' | 'Partial Success' | 'Complicated' | 'Failed'

interface ProcedureRecord {
  id: string
  date: string
  mrn: string
  initials: string
  age: number
  sex: 'M' | 'F'
  category: Exclude<CategoryId, 'all'>
  procedure: string
  operator: string
  indication: string
  duration: number
  fluoro?: number
  outcome: Outcome
  complications: string
  notes?: string
}

interface CategoryMeta {
  id: CategoryId
  label: string
  Icon: React.ElementType
  color: string
  accent: string
  border: string
  gradient: string
}

interface QualityBenchmark {
  metric: string
  target: string
  actual: string
  met: boolean
}

// ─── Category definitions ─────────────────────────────────────────────────────
const CATEGORIES: CategoryMeta[] = [
  { id: 'all',        label: 'Overview',          Icon: Activity,    color: 'text-blue-400',    accent: '#3b82f6', border: 'border-blue-500/20',   gradient: 'linear-gradient(135deg,#1d4ed8,#3b82f6)' },
  { id: 'coronary',   label: 'Coronary',           Icon: Heart,       color: 'text-red-400',     accent: '#ef4444', border: 'border-red-500/20',    gradient: 'linear-gradient(135deg,#b91c1c,#ef4444)' },
  { id: 'ep',         label: 'EP & Ablation',      Icon: Zap,         color: 'text-violet-400',  accent: '#8b5cf6', border: 'border-violet-500/20', gradient: 'linear-gradient(135deg,#7c3aed,#a78bfa)' },
  { id: 'device',     label: 'Device Therapy',     Icon: Shield,      color: 'text-cyan-400',    accent: '#06b6d4', border: 'border-cyan-500/20',   gradient: 'linear-gradient(135deg,#0e7490,#06b6d4)' },
  { id: 'structural', label: 'Structural Heart',   Icon: Layers,      color: 'text-amber-400',   accent: '#f59e0b', border: 'border-amber-500/20',  gradient: 'linear-gradient(135deg,#b45309,#f59e0b)' },
  { id: 'emergency',  label: 'Emergency / Critical', Icon: AlertTriangle, color: 'text-orange-400', accent: '#f97316', border: 'border-orange-500/20', gradient: 'linear-gradient(135deg,#c2410c,#f97316)' },
  { id: 'diagnostic', label: 'Diagnostic',         Icon: Stethoscope, color: 'text-emerald-400', accent: '#10b981', border: 'border-emerald-500/20', gradient: 'linear-gradient(135deg,#065f46,#10b981)' },
]

// ─── Mock procedure records ───────────────────────────────────────────────────
const RECORDS: ProcedureRecord[] = [
  // Coronary
  { id: 'C001', date: '2026-05-28', mrn: 'MRN-4821', initials: 'R.K.', age: 62, sex: 'M', category: 'coronary', procedure: 'Primary PCI – LAD (STEMI)',          operator: 'Dr. Jayachandra', indication: 'Anterior STEMI',            duration: 68,  fluoro: 12, outcome: 'Success',         complications: 'None',                    notes: 'DES × 1, TIMI 3 achieved, DTB 72 min' },
  { id: 'C002', date: '2026-05-21', mrn: 'MRN-3917', initials: 'S.M.', age: 55, sex: 'M', category: 'coronary', procedure: 'Elective PCI – RCA',                   operator: 'Dr. Rao',         indication: 'Stable Angina / 90% RCA',   duration: 45,  fluoro: 9,  outcome: 'Success',         complications: 'None',                    notes: 'DES × 1, FFR-guided' },
  { id: 'C003', date: '2026-05-18', mrn: 'MRN-5034', initials: 'P.N.', age: 71, sex: 'F', category: 'coronary', procedure: 'Diagnostic Angiography',               operator: 'Dr. Jayachandra', indication: 'NSTEMI – 3VD, CABG Ref',    duration: 28,  fluoro: 6,  outcome: 'Success',         complications: 'None',                    notes: 'SYNTAX 32, surgical referral' },
  { id: 'C004', date: '2026-05-15', mrn: 'MRN-2288', initials: 'A.D.', age: 48, sex: 'M', category: 'coronary', procedure: 'Primary PCI – LCx (NSTEMI)',           operator: 'Dr. Rao',         indication: 'Inferior NSTEMI',           duration: 54,  fluoro: 10, outcome: 'Partial Success', complications: 'Slow flow, resolved with IC adenosine', notes: 'TIMI 2 → 3 after IC adenosine' },
  { id: 'C005', date: '2026-05-12', mrn: 'MRN-6631', initials: 'V.S.', age: 68, sex: 'M', category: 'coronary', procedure: 'Rotational Atherectomy + PCI – LM/LAD',operator: 'Dr. Jayachandra', indication: 'Complex LM disease',        duration: 112, fluoro: 21, outcome: 'Success',         complications: 'Minor access-site hematoma', notes: 'Rota 1.75mm + DES × 2, IVUS-guided' },
  { id: 'C006', date: '2026-05-09', mrn: 'MRN-7742', initials: 'L.T.', age: 59, sex: 'F', category: 'coronary', procedure: 'Angiography – Normal Coronaries',       operator: 'Dr. Rao',         indication: 'Atypical chest pain',       duration: 22,  fluoro: 4,  outcome: 'Success',         complications: 'None',                    notes: 'No obstructive CAD' },
  { id: 'C007', date: '2026-05-05', mrn: 'MRN-3300', initials: 'D.P.', age: 65, sex: 'M', category: 'coronary', procedure: 'Multi-vessel PCI – RCA + LAD (staged)',operator: 'Dr. Jayachandra', indication: '2VD, staged PCI strategy',  duration: 84,  fluoro: 16, outcome: 'Success',         complications: 'None',                    notes: 'Stage 1 of 2, RCA treated' },
  { id: 'C008', date: '2026-04-29', mrn: 'MRN-8812', initials: 'M.G.', age: 74, sex: 'F', category: 'coronary', procedure: 'OCT-guided PCI – LAD ISR',             operator: 'Dr. Rao',         indication: 'In-stent restenosis',       duration: 61,  fluoro: 11, outcome: 'Success',         complications: 'None',                    notes: 'Underexpansion identified on OCT, optimised' },

  // EP & Ablation
  { id: 'E001', date: '2026-05-27', mrn: 'MRN-5519', initials: 'H.V.', age: 58, sex: 'M', category: 'ep', procedure: 'PVI – Paroxysmal AF (Cryoablation)',      operator: 'Dr. Menon',       indication: 'Drug-refractory PAF',       duration: 148, fluoro: 18, outcome: 'Success',         complications: 'None',                    notes: 'All 4 PVs isolated, Entr. confirmed' },
  { id: 'E002', date: '2026-05-22', mrn: 'MRN-4027', initials: 'B.R.', age: 52, sex: 'M', category: 'ep', procedure: 'CTI Ablation – Typical Atrial Flutter',   operator: 'Dr. Menon',       indication: 'Isthmus-dependent flutter', duration: 62,  fluoro: 8,  outcome: 'Success',         complications: 'None',                    notes: 'Bidirectional block confirmed' },
  { id: 'E003', date: '2026-05-19', mrn: 'MRN-6823', initials: 'K.J.', age: 67, sex: 'M', category: 'ep', procedure: 'VT Ablation – Ischaemic Substrate (EAM)', operator: 'Dr. Jayachandra', indication: 'Recurrent ICD shocks',      duration: 218, fluoro: 34, outcome: 'Partial Success', complications: 'None',                    notes: '2/3 VT morphologies ablated; non-inducible post-procedure' },
  { id: 'E004', date: '2026-05-14', mrn: 'MRN-2211', initials: 'G.S.', age: 43, sex: 'F', category: 'ep', procedure: 'SVT Ablation – AVNRT (Slow Pathway)',     operator: 'Dr. Menon',       indication: 'Symptomatic AVNRT',         duration: 58,  fluoro: 6,  outcome: 'Success',         complications: 'None',                    notes: 'No AV block; patient in SR' },
  { id: 'E005', date: '2026-05-10', mrn: 'MRN-3398', initials: 'R.B.', age: 34, sex: 'M', category: 'ep', procedure: 'WPW Ablation – Left Free Wall AP',         operator: 'Dr. Menon',       indication: 'WPW with pre-excitation',  duration: 74,  fluoro: 10, outcome: 'Success',         complications: 'None',                    notes: 'Left free wall AP, retrograde trans-septal approach' },
  { id: 'E006', date: '2026-05-07', mrn: 'MRN-7791', initials: 'N.C.', age: 71, sex: 'F', category: 'ep', procedure: 'DCCV – Persistent AF',                     operator: 'Dr. Jayachandra', indication: 'Persistent AF > 3 months', duration: 12,  fluoro: 0,  outcome: 'Partial Success', complications: 'None',                    notes: 'Reverted to SR; AF recurred at 4 hours post DCCV' },
  { id: 'E007', date: '2026-04-30', mrn: 'MRN-5567', initials: 'T.M.', age: 49, sex: 'M', category: 'ep', procedure: 'EP Study – Syncope workup',                 operator: 'Dr. Menon',       indication: 'Recurrent unexplained syncope', duration: 82, fluoro: 9, outcome: 'Success',        complications: 'None',                    notes: 'AVNRT inducible; slow pathway ablation performed' },
  { id: 'E008', date: '2026-04-25', mrn: 'MRN-4498', initials: 'F.L.', age: 56, sex: 'F', category: 'ep', procedure: 'PVI + Linear Lines – Persistent AF',       operator: 'Dr. Menon',       indication: 'Long-standing persistent AF',duration: 198, fluoro: 28, outcome: 'Success',         complications: 'Minor groin hematoma',    notes: 'PVI + Roof + Mitral isthmus lines' },

  // Device Therapy
  { id: 'D001', date: '2026-05-26', mrn: 'MRN-3344', initials: 'A.S.', age: 78, sex: 'M', category: 'device', procedure: 'DDD Pacemaker (PPM) – Sick Sinus',       operator: 'Dr. Jayachandra', indication: 'Symptomatic SSS',           duration: 52,  fluoro: 11, outcome: 'Success',         complications: 'None',                    notes: 'Medtronic Advisa, active fixation leads, sensing/pacing thresholds optimal' },
  { id: 'D002', date: '2026-05-20', mrn: 'MRN-6612', initials: 'P.K.', age: 65, sex: 'M', category: 'device', procedure: 'Dual-Chamber ICD – Ischaemic CMP',        operator: 'Dr. Jayachandra', indication: 'EF 28%, LVSD post-MI',      duration: 68,  fluoro: 14, outcome: 'Success',         complications: 'None',                    notes: 'Abbott Gallant HF, shock coil tested, DFT < 25 J' },
  { id: 'D003', date: '2026-05-16', mrn: 'MRN-7723', initials: 'R.P.', age: 61, sex: 'M', category: 'device', procedure: 'CRT-D – LBBB, HFrEF (EF 25%)',           operator: 'Dr. Menon',       indication: 'GDMT-refractory HF + LBBB', duration: 94,  fluoro: 18, outcome: 'Success',         complications: 'None',                    notes: 'LV lead in lateral branch, BiV pacing achieved' },
  { id: 'D004', date: '2026-05-11', mrn: 'MRN-2819', initials: 'S.G.', age: 53, sex: 'F', category: 'device', procedure: 'Single-Chamber ICD – NSVT, EF 30%',       operator: 'Dr. Jayachandra', indication: 'Primary prevention ICD',    duration: 48,  fluoro: 10, outcome: 'Success',         complications: 'None',                    notes: 'Right ventricular ICD lead, active can, sensing excellent' },
  { id: 'D005', date: '2026-05-08', mrn: 'MRN-5581', initials: 'Y.T.', age: 29, sex: 'M', category: 'device', procedure: 'S-ICD (Subcutaneous) – Channelopathy',   operator: 'Dr. Menon',       indication: 'CPVT, no pacing needed',    duration: 61,  fluoro: 0,  outcome: 'Success',         complications: 'None',                    notes: 'No fluoroscopy; screening-eligible sensing vector' },
  { id: 'D006', date: '2026-05-04', mrn: 'MRN-8834', initials: 'I.N.', age: 72, sex: 'M', category: 'device', procedure: 'CRT-P – AF, BBB, EF 25%',                 operator: 'Dr. Jayachandra', indication: 'HFrEF, AF, LBBB, no VT',   duration: 87,  fluoro: 16, outcome: 'Success',         complications: 'None',                    notes: 'LV lead in posterolateral branch, 3rd attempt; good threshold' },
  { id: 'D007', date: '2026-04-28', mrn: 'MRN-1122', initials: 'O.B.', age: 81, sex: 'F', category: 'device', procedure: 'Generator Replacement – PPM EOL',         operator: 'Dr. Rao',         indication: 'Battery depletion (ERI)',   duration: 31,  fluoro: 4,  outcome: 'Success',         complications: 'None',                    notes: 'Leads retained, impedances stable' },
  { id: 'D008', date: '2026-04-22', mrn: 'MRN-3370', initials: 'C.W.', age: 66, sex: 'M', category: 'device', procedure: 'Lead Revision – ICD Lead Dislodgement',  operator: 'Dr. Jayachandra', indication: 'Inappropriate shocks × 3', duration: 73,  fluoro: 15, outcome: 'Success',         complications: 'Minor pocket haematoma',  notes: 'RV lead repositioned, sensing and pacing thresholds optimal' },

  // Structural Heart
  { id: 'S001', date: '2026-05-25', mrn: 'MRN-9910', initials: 'B.N.', age: 82, sex: 'F', category: 'structural', procedure: 'TAVI – Severe AS (SAPIEN 3, 26mm)',      operator: 'Dr. Jayachandra', indication: 'Severe AS, STS 8.2%, high-risk', duration: 78, fluoro: 14, outcome: 'Success',    complications: 'None',                    notes: 'TF approach, no PVL, no PPM needed, gradient 8 mmHg post' },
  { id: 'S002', date: '2026-05-17', mrn: 'MRN-4456', initials: 'E.R.', age: 76, sex: 'M', category: 'structural', procedure: 'MitraClip (2 clips) – Severe Secondary MR', operator: 'Dr. Jayachandra', indication: 'HFrEF + Severe 2° MR',  duration: 132, fluoro: 22, outcome: 'Success',    complications: 'None',                    notes: 'MR reduced to mild/moderate, clip separation 12 mm' },
  { id: 'S003', date: '2026-05-13', mrn: 'MRN-7745', initials: 'G.A.', age: 77, sex: 'M', category: 'structural', procedure: 'TAVI – Bicuspid AS, High-Risk Surgery',  operator: 'Dr. Jayachandra', indication: 'Severe bicuspid AS',         duration: 98,  fluoro: 18, outcome: 'Partial Success', complications: 'Mild PVL grade 1+',      notes: 'Bicuspid anatomy, Evolut FX 29mm, mild PVL on TEE' },
  { id: 'S004', date: '2026-05-08', mrn: 'MRN-6628', initials: 'W.L.', age: 73, sex: 'M', category: 'structural', procedure: 'Watchman FLX – AF, High Bleeding Risk',  operator: 'Dr. Menon',       indication: 'Non-valvular AF, HASBLED ≥ 3', duration: 62, fluoro: 11, outcome: 'Success',    complications: 'None',                    notes: 'Device 27mm, complete seal on post-procedure TEE' },
  { id: 'S005', date: '2026-05-02', mrn: 'MRN-2235', initials: 'Z.H.', age: 34, sex: 'F', category: 'structural', procedure: 'ASD Device Closure (Amplatzer 24mm)',    operator: 'Dr. Jayachandra', indication: 'Secundum ASD, Qp:Qs 1.9',   duration: 48,  fluoro: 8,  outcome: 'Success',         complications: 'None',                    notes: 'Complete occlusion on echo post procedure' },
  { id: 'S006', date: '2026-04-26', mrn: 'MRN-5543', initials: 'Q.P.', age: 41, sex: 'M', category: 'structural', procedure: 'PFO Closure – Cryptogenic Stroke',       operator: 'Dr. Menon',       indication: 'Large PFO + atrial septal aneurysm', duration: 38, fluoro: 6, outcome: 'Success',  complications: 'None',                    notes: 'Gore Cardioform 25mm, no residual shunt on echo' },
  { id: 'S007', date: '2026-04-20', mrn: 'MRN-8897', initials: 'U.V.', age: 58, sex: 'F', category: 'structural', procedure: 'Balloon Mitral Valvuloplasty (BMV)',      operator: 'Dr. Jayachandra', indication: 'Moderate-severe MS, MVA 1.1 cm²', duration: 54, fluoro: 9, outcome: 'Success', complications: 'None',                    notes: 'MVA 1.9 cm² post, no MR, no ASD' },
  { id: 'S008', date: '2026-04-14', mrn: 'MRN-3321', initials: 'X.T.', age: 80, sex: 'F', category: 'structural', procedure: 'TAVI-in-TAVI – Failed Bioprosthetic Valve', operator: 'Dr. Jayachandra', indication: 'Structural valve deterioration', duration: 86, fluoro: 16, outcome: 'Success', complications: 'None',                    notes: 'Sapien 3 in failed Epic 23mm, gradient 12 mmHg' },

  // Emergency / Critical Care
  { id: 'EM01', date: '2026-05-29', mrn: 'MRN-1198', initials: 'J.F.', age: 69, sex: 'M', category: 'emergency', procedure: 'Pericardiocentesis – Cardiac Tamponade',   operator: 'Dr. Jayachandra', indication: 'Malignant pericardial effusion', duration: 24, fluoro: 0, outcome: 'Success', complications: 'None',                    notes: '600 mL haemorrhagic fluid drained, drain left in situ' },
  { id: 'EM02', date: '2026-05-23', mrn: 'MRN-6674', initials: 'K.A.', age: 74, sex: 'M', category: 'emergency', procedure: 'IABP Insertion – Cardiogenic Shock',         operator: 'Dr. Rao',         indication: 'Post-MI cardiogenic shock', duration: 18, fluoro: 3,  outcome: 'Success',         complications: 'None',                    notes: '1:1 support, weaned after 72 h, haemodynamic improvement' },
  { id: 'EM03', date: '2026-05-18', mrn: 'MRN-4481', initials: 'O.C.', age: 55, sex: 'M', category: 'emergency', procedure: 'Pericardiocentesis – Post-PCI Perforation',  operator: 'Dr. Jayachandra', indication: 'Guidewire perforation (TIMI 2)', duration: 16, fluoro: 0, outcome: 'Success', complications: 'None',                    notes: 'Echo-guided, 150 mL, autologous blood transfusion approach' },
  { id: 'EM04', date: '2026-05-14', mrn: 'MRN-7709', initials: 'N.S.', age: 81, sex: 'F', category: 'emergency', procedure: 'Temporary Transvenous Pacing',                operator: 'Dr. Rao',         indication: 'Complete heart block (CHB)', duration: 22, fluoro: 4,  outcome: 'Success',         complications: 'None',                    notes: 'RV temporary lead, rate 60 bpm, bridge to permanent PPM' },
  { id: 'EM05', date: '2026-05-09', mrn: 'MRN-2267', initials: 'L.N.', age: 63, sex: 'M', category: 'emergency', procedure: 'VA-ECMO – Refractory Cardiogenic Shock',     operator: 'Dr. Jayachandra', indication: 'Fulminant myocarditis',      duration: 82, fluoro: 8,  outcome: 'Partial Success', complications: 'Limb ischaemia, distal perfusion catheter placed', notes: 'ECMO 5 L/min, bridged to LVAD evaluation' },
  { id: 'EM06', date: '2026-05-05', mrn: 'MRN-8856', initials: 'H.Q.', age: 58, sex: 'M', category: 'emergency', procedure: 'Emergency DCCV – Sustained VT',               operator: 'Dr. Menon',       indication: 'Haemodynamically unstable VT', duration: 5, fluoro: 0, outcome: 'Success',          complications: 'None',                    notes: 'Synchronised 200J, SR restored, amiodarone commenced' },
  { id: 'EM07', date: '2026-04-30', mrn: 'MRN-3345', initials: 'P.O.', age: 72, sex: 'M', category: 'emergency', procedure: 'IABP – Post-CABG Low Output Syndrome',      operator: 'Dr. Rao',         indication: 'Low CO post-cardiac surgery', duration: 20, fluoro: 3, outcome: 'Success',          complications: 'None',                    notes: 'Haemodynamic support initiated, weaned day 3 post-op' },
  { id: 'EM08', date: '2026-04-24', mrn: 'MRN-5523', initials: 'R.I.', age: 47, sex: 'F', category: 'emergency', procedure: 'Emergency Pericardiocentesis – Purulent PE', operator: 'Dr. Jayachandra', indication: 'Purulent pericarditis',      duration: 28, fluoro: 0,  outcome: 'Complicated',     complications: 'Drain blockage – flushed', notes: '300 mL purulent fluid, drain secured, IV antibiotics started' },

  // Diagnostic
  { id: 'DG01', date: '2026-05-26', mrn: 'MRN-4430', initials: 'C.B.', age: 61, sex: 'F', category: 'diagnostic', procedure: 'TEE – AF Cardioversion Planning',           operator: 'Dr. Menon',       indication: 'Rule out LA thrombus pre-DCCV', duration: 22, fluoro: 0, outcome: 'Success',    complications: 'None',                    notes: 'No LAA thrombus, DCCV proceeded same day' },
  { id: 'DG02', date: '2026-05-21', mrn: 'MRN-6638', initials: 'F.N.', age: 54, sex: 'M', category: 'diagnostic', procedure: 'Stress Echo – Suspected CAD',               operator: 'Dr. Rao',         indication: 'Atypical chest pain, FHRR 65%', duration: 45, fluoro: 0, outcome: 'Success',  complications: 'None',                    notes: 'Positive; RWMA anterolateral at peak stress; angio referral' },
  { id: 'DG03', date: '2026-05-17', mrn: 'MRN-7763', initials: 'I.D.', age: 67, sex: 'M', category: 'diagnostic', procedure: 'FFR – Intermediate LAD Lesion (55%)',       operator: 'Dr. Jayachandra', indication: 'Intermediate stenosis (FFR-guided)', duration: 28, fluoro: 5, outcome: 'Success', complications: 'None',                   notes: 'FFR 0.71 (<0.80), PCI deferred on basis of clinical context' },
  { id: 'DG04', date: '2026-05-13', mrn: 'MRN-2256', initials: 'T.A.', age: 72, sex: 'M', category: 'diagnostic', procedure: 'IVUS – LM Assessment',                      operator: 'Dr. Rao',         indication: 'LM ostial lesion severity',  duration: 24, fluoro: 4,  outcome: 'Success',         complications: 'None',                    notes: 'MLA 5.8 mm², PCI not indicated by criteria' },
  { id: 'DG05', date: '2026-05-09', mrn: 'MRN-5581', initials: 'A.N.', age: 58, sex: 'F', category: 'diagnostic', procedure: 'OCT – Post-PCI Stent Optimisation',         operator: 'Dr. Jayachandra', indication: 'Underexpansion suspected',    duration: 18, fluoro: 3,  outcome: 'Success',         complications: 'None',                    notes: 'MSA 6.9 mm², no malapposition; stent post-dilated' },
  { id: 'DG06', date: '2026-05-04', mrn: 'MRN-8811', initials: 'M.R.', age: 49, sex: 'M', category: 'diagnostic', procedure: 'Stress Echo – Follow-up Post-PCI',          operator: 'Dr. Rao',         indication: 'Post-PCI 12-month surveillance', duration: 42, fluoro: 0, outcome: 'Success', complications: 'None',                    notes: 'No inducible ischaemia; good wall motion throughout' },
  { id: 'DG07', date: '2026-04-28', mrn: 'MRN-3378', initials: 'L.S.', age: 79, sex: 'F', category: 'diagnostic', procedure: 'TEE – Structural Assessment Pre-TAVI',      operator: 'Dr. Menon',       indication: 'Aortic valve sizing for TAVI', duration: 32, fluoro: 0, outcome: 'Success',     complications: 'None',                    notes: 'Aortic annulus 24.1 mm, bicuspid, SAPIEN 26 selected' },
  { id: 'DG08', date: '2026-04-22', mrn: 'MRN-1145', initials: 'P.H.', age: 63, sex: 'M', category: 'diagnostic', procedure: 'iFR – Intermediate RCA Lesion',              operator: 'Dr. Jayachandra', indication: 'Intermediate stenosis (iFR)',  duration: 21, fluoro: 4,  outcome: 'Success',        complications: 'None',                    notes: 'iFR 0.91 (>0.89), PCI deferred; medical therapy optimised' },
]

// ─── Aggregate statistics ─────────────────────────────────────────────────────
const VOLUME_BY_CAT = [
  { name: 'Coronary',          value: 192 },
  { name: 'Diagnostic',        value: 192 },
  { name: 'EP & Ablation',     value: 134 },
  { name: 'Device Therapy',    value: 104 },
  { name: 'Structural Heart',  value:  51 },
  { name: 'Emergency',         value:  53 },
]

const MONTHLY_TREND = [
  { month: 'Jan', coronary: 28, ep: 19, device: 15, structural: 6,  emergency: 7,  diagnostic: 28 },
  { month: 'Feb', coronary: 31, ep: 21, device: 17, structural: 7,  emergency: 9,  diagnostic: 31 },
  { month: 'Mar', coronary: 33, ep: 23, device: 18, structural: 8,  emergency: 8,  diagnostic: 33 },
  { month: 'Apr', coronary: 35, ep: 24, device: 18, structural: 10, emergency: 9,  diagnostic: 34 },
  { month: 'May', coronary: 38, ep: 26, device: 19, structural: 11, emergency: 11, diagnostic: 37 },
  { month: 'Jun', coronary: 27, ep: 21, device: 17, structural: 9,  emergency: 9,  diagnostic: 29 },
]

const SUCCESS_BY_CAT = [
  { name: 'Coronary',         value: 94 },
  { name: 'Diagnostic',       value: 99 },
  { name: 'Device Therapy',   value: 98 },
  { name: 'EP & Ablation',    value: 87 },
  { name: 'Structural Heart', value: 91 },
  { name: 'Emergency',        value: 94 },
]

const COMPLICATION_BY_CAT = [
  { name: 'Structural Heart',  value: 8.4 },
  { name: 'Emergency',         value: 6.8 },
  { name: 'Device Therapy',    value: 3.4 },
  { name: 'EP & Ablation',     value: 1.8 },
  { name: 'Coronary',          value: 2.1 },
  { name: 'Diagnostic',        value: 0.4 },
]

const OPERATOR_VOLUME = [
  { name: 'Dr. Jayachandra', value: 394 },
  { name: 'Dr. Menon',       value: 198 },
  { name: 'Dr. Rao',         value: 134 },
]

// Quality benchmarks per category
const BENCHMARKS: Record<Exclude<CategoryId, 'all'>, QualityBenchmark[]> = {
  coronary: [
    { metric: 'Primary PCI: DTB < 90 min',           target: '>75%',  actual: '82%',  met: true  },
    { metric: 'TIMI 3 Flow post-PCI',                target: '>90%',  actual: '94%',  met: true  },
    { metric: 'Fluoroscopy time (median)',            target: '< 15 min', actual: '14 min', met: true  },
    { metric: 'Major complications (in-lab)',         target: '< 3%',  actual: '2.1%', met: true  },
    { metric: 'Contrast volume > 300 mL',            target: '< 10%', actual: '5%',   met: true  },
  ],
  ep: [
    { metric: 'AF ablation acute success',           target: '>85%',  actual: '88%',  met: true  },
    { metric: 'VT ablation: non-inducible post',     target: '>70%',  actual: '72%',  met: true  },
    { metric: 'Cardiac tamponade rate',              target: '< 1%',  actual: '0.7%', met: true  },
    { metric: 'Phrenic nerve palsy (PVI)',           target: '< 1%',  actual: '0%',   met: true  },
    { metric: 'Fluoroscopy median (ablation)',       target: '< 25 min', actual: '18 min', met: true  },
  ],
  device: [
    { metric: 'Implant procedural success',          target: '>98%',  actual: '98.1%',met: true  },
    { metric: 'Lead dislodgement rate (30d)',         target: '< 2%',  actual: '1.9%', met: true  },
    { metric: 'Pneumothorax rate',                   target: '< 1%',  actual: '0.9%', met: true  },
    { metric: 'Pocket infection rate (30d)',         target: '< 1%',  actual: '0.0%', met: true  },
    { metric: 'Fluoroscopy time (median)',           target: '< 20 min', actual: '14 min', met: true  },
  ],
  structural: [
    { metric: 'TAVI procedural success',             target: '>90%',  actual: '91%',  met: true  },
    { metric: 'TAVI: PPM need post-procedure',       target: '< 15%', actual: '14%',  met: true  },
    { metric: 'TAVI: PVL ≥ moderate',               target: '< 5%',  actual: '6.1%', met: false },
    { metric: 'MitraClip: MR ≤ 2+ post',            target: '>85%',  actual: '88%',  met: true  },
    { metric: '30-day mortality (structural)',       target: '< 5%',  actual: '3.2%', met: true  },
  ],
  emergency: [
    { metric: 'Pericardiocentesis success',          target: '>95%',  actual: '96%',  met: true  },
    { metric: 'IABP insertion success',              target: '>98%',  actual: '100%', met: true  },
    { metric: 'Emergency cardioversion success',     target: '>95%',  actual: '96%',  met: true  },
    { metric: 'ECMO 30-day weaning/bridge rate',    target: '>65%',  actual: '60%',  met: false },
    { metric: 'Major vascular complications',       target: '< 5%',  actual: '4.2%', met: true  },
  ],
  diagnostic: [
    { metric: 'TEE procedural success',             target: '>99%',  actual: '100%', met: true  },
    { metric: 'Stress Echo diagnostic yield',       target: '>95%',  actual: '97%',  met: true  },
    { metric: 'FFR/iFR guidance rate (intermed. lesions)', target: '>80%', actual: '84%', met: true },
    { metric: 'IVUS/OCT use in complex PCI',        target: '>30%',  actual: '38%',  met: true  },
    { metric: 'Serious adverse events (TEE)',       target: '< 0.1%', actual: '0%',  met: true  },
  ],
}

const PALETTE = ['#3b82f6', '#ef4444', '#8b5cf6', '#06b6d4', '#f59e0b', '#f97316', '#10b981', '#ec4899']

// ─── Tooltip helper ───────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function DarkTip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="text-xs rounded-xl px-3 py-2 border border-blue-500/20 backdrop-blur-md"
      style={{ background: 'rgba(10,17,40,0.96)', color: '#e2e8f0' }}>
      {label && <p className="font-semibold mb-1">{label}</p>}
      {payload.map((p: { name: string; value: number; color: string }, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span style={{ color: '#94a3b8' }}>{p.name}:</span>
          <span className="font-bold" style={{ color: p.color }}>{p.value}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Outcome badge ────────────────────────────────────────────────────────────
function OutcomeBadge({ outcome }: { outcome: Outcome }) {
  const map: Record<Outcome, string> = {
    'Success':         'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
    'Partial Success': 'bg-amber-500/15 text-amber-400 border-amber-500/25',
    'Complicated':     'bg-orange-500/15 text-orange-400 border-orange-500/25',
    'Failed':          'bg-red-500/15 text-red-400 border-red-500/25',
  }
  return (
    <span className={cn('text-[10px] px-2 py-0.5 rounded-full border font-medium whitespace-nowrap', map[outcome])}>
      {outcome}
    </span>
  )
}

// ─── Procedure table ──────────────────────────────────────────────────────────
function ProcedureTable({ records }: { records: ProcedureRecord[] }) {
  const [query, setQuery] = useState('')
  const filtered = useMemo(
    () => records.filter(r =>
      query === '' ||
      r.procedure.toLowerCase().includes(query.toLowerCase()) ||
      r.mrn.toLowerCase().includes(query.toLowerCase()) ||
      r.operator.toLowerCase().includes(query.toLowerCase()) ||
      r.indication.toLowerCase().includes(query.toLowerCase())
    ),
    [records, query]
  )

  return (
    <div className="glass-card border border-blue-500/10 overflow-hidden">
      <div className="px-4 py-3 border-b border-blue-500/10 flex items-center gap-3">
        <p className="text-sm font-semibold text-white flex-1">Procedure Records</p>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500" />
          <input
            type="text"
            placeholder="Search procedure, MRN, operator…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="text-xs py-1.5 rounded-lg border border-blue-500/15 bg-white/[0.04] text-gray-300 placeholder-gray-600 focus:outline-none focus:border-blue-500/40 w-64"
            style={{ paddingLeft: '1.75rem', paddingRight: '0.75rem' }}
          />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-blue-500/10">
              {['Date', 'MRN', 'Pt', 'Age/Sex', 'Procedure', 'Operator', 'Dur.', 'Fluoro', 'Outcome', 'Complications'].map(h => (
                <th key={h} className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={10} className="px-3 py-6 text-center text-gray-500 text-xs">No records match your search.</td></tr>
            )}
            {filtered.map((r, i) => (
              <tr key={r.id} className={cn('border-b border-blue-500/5 hover:bg-white/[0.02] transition-colors', i % 2 === 0 ? '' : 'bg-white/[0.01]')}>
                <td className="px-3 py-2.5 text-gray-400 whitespace-nowrap">{r.date}</td>
                <td className="px-3 py-2.5 text-blue-400 font-mono text-[10px]">{r.mrn}</td>
                <td className="px-3 py-2.5 text-gray-300 font-semibold">{r.initials}</td>
                <td className="px-3 py-2.5 text-gray-400 whitespace-nowrap">{r.age}y / {r.sex}</td>
                <td className="px-3 py-2.5 text-white max-w-[240px]">
                  <span className="line-clamp-1">{r.procedure}</span>
                  {r.notes && <span className="block text-[10px] text-gray-500 line-clamp-1 mt-0.5">{r.notes}</span>}
                </td>
                <td className="px-3 py-2.5 text-gray-400 whitespace-nowrap">{r.operator}</td>
                <td className="px-3 py-2.5 text-gray-400 whitespace-nowrap">{r.duration} min</td>
                <td className="px-3 py-2.5 text-gray-400 whitespace-nowrap">{r.fluoro != null ? `${r.fluoro} min` : '—'}</td>
                <td className="px-3 py-2.5"><OutcomeBadge outcome={r.outcome} /></td>
                <td className="px-3 py-2.5 text-gray-400 max-w-[160px]">
                  <span className={cn('line-clamp-1', r.complications !== 'None' ? 'text-amber-400' : '')}>
                    {r.complications}
                  </span>
                </td>
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

// ─── Quality benchmarks panel ─────────────────────────────────────────────────
function BenchmarkPanel({ benchmarks }: { benchmarks: QualityBenchmark[] }) {
  return (
    <div className="glass-card p-4 border border-blue-500/10">
      <p className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
        <CheckCircle size={14} className="text-emerald-400" /> Quality Benchmarks
      </p>
      <div className="space-y-2">
        {benchmarks.map(b => (
          <div key={b.metric} className="flex items-center justify-between gap-2 text-xs">
            <span className="text-gray-400 flex-1 truncate">{b.metric}</span>
            <span className="text-gray-600 text-[10px] whitespace-nowrap">Target: {b.target}</span>
            <span className={cn('font-bold text-[11px] whitespace-nowrap ml-2', b.met ? 'text-emerald-400' : 'text-red-400')}>
              {b.actual} {b.met ? '✓' : '✗'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Per-category charts ──────────────────────────────────────────────────────
const CAT_CHARTS: Record<Exclude<CategoryId, 'all'>, { pie?: { title: string; data: { name: string; value: number }[] }; bar?: { title: string; data: { name: string; value: number }[]; color: string } }> = {
  coronary: {
    pie: { title: 'Procedure Type', data: [{ name: 'Diagnostic Angio', value: 68 }, { name: 'PCI – Elective', value: 54 }, { name: 'Primary PCI', value: 58 }, { name: 'Complex / Rotational', value: 12 }] },
    bar: { title: 'DTB Time – Primary PCI (min)', color: '#ef4444', data: [{ name: '< 60', value: 52 }, { name: '60–90', value: 91 }, { name: '90–120', value: 63 }, { name: '> 120', value: 42 }] },
  },
  ep: {
    pie: { title: 'Arrhythmia / Procedure Type', data: [{ name: 'AF Ablation', value: 34 }, { name: 'VT Ablation', value: 18 }, { name: 'SVT Ablation', value: 22 }, { name: 'Flutter Ablation', value: 19 }, { name: 'DCCV', value: 41 }] },
    bar: { title: 'Acute Procedure Success Rate (%)', color: '#8b5cf6', data: [{ name: 'SVT Ablation', value: 98 }, { name: 'Flutter Ablation', value: 96 }, { name: 'DCCV', value: 82 }, { name: 'AF Ablation', value: 88 }, { name: 'VT Ablation', value: 72 }] },
  },
  device: {
    pie: { title: 'Device Implant Type', data: [{ name: 'PPM', value: 38 }, { name: 'Single-chamber ICD', value: 29 }, { name: 'CRT-D', value: 12 }, { name: 'CRT-P', value: 14 }, { name: 'S-ICD', value: 8 }, { name: 'Generator Change', value: 3 }] },
    bar: { title: 'Primary Indication (%)', color: '#06b6d4', data: [{ name: 'SSS / Brady', value: 38 }, { name: '1° Prevention ICD', value: 29 }, { name: 'CRT (HF + BBB)', value: 26 }, { name: 'Channelopathy', value: 8 }, { name: 'Battery EOL', value: 3 }] },
  },
  structural: {
    pie: { title: 'Structural Procedure Type', data: [{ name: 'TAVI / TAVI-in-TAVI', value: 18 }, { name: 'MitraClip', value: 8 }, { name: 'ASD / PFO Closure', value: 21 }, { name: 'LAA Closure', value: 9 }, { name: 'Valvuloplasty', value: 4 }] },
    bar: { title: 'TAVI Outcomes (%)', color: '#f59e0b', data: [{ name: 'Technical Success', value: 91 }, { name: 'No / Mild PVL', value: 86 }, { name: 'No PPM needed', value: 86 }, { name: 'No stroke', value: 94 }, { name: '30d Survival', value: 97 }] },
  },
  emergency: {
    pie: { title: 'Emergency Procedure Type', data: [{ name: 'Pericardiocentesis', value: 14 }, { name: 'IABP Insertion', value: 22 }, { name: 'Temp. Pacing', value: 11 }, { name: 'VA-ECMO', value: 6 }, { name: 'Emergency DCCV', value: 41 }] },
    bar: { title: 'Indication Category', color: '#f97316', data: [{ name: 'Cardiogenic Shock', value: 22 }, { name: 'Tamponade', value: 14 }, { name: 'Arrhythmia Emergency', value: 11 }, { name: 'Heart Block', value: 6 }, { name: 'Mechanical Complication', value: 4 }] },
  },
  diagnostic: {
    pie: { title: 'Diagnostic Modality', data: [{ name: 'TEE', value: 48 }, { name: 'Stress Echo', value: 63 }, { name: 'FFR / iFR', value: 34 }, { name: 'IVUS', value: 28 }, { name: 'OCT', value: 19 }] },
    bar: { title: 'Clinical Utility – Deferred PCI Rate (%)', color: '#10b981', data: [{ name: 'FFR-negative', value: 56 }, { name: 'iFR-negative', value: 64 }, { name: 'Normal stress echo', value: 78 }, { name: 'IVUS – MLA > 6 mm²', value: 43 }] },
  },
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ProceduralAuditPage() {
  const [activeTab, setActiveTab] = useState<CategoryId>('all')

  const filtered = activeTab === 'all' ? RECORDS : RECORDS.filter(r => r.category === activeTab)
  const cat = CATEGORIES.find(c => c.id === activeTab)!

  const successCount = filtered.filter(r => r.outcome === 'Success').length
  const compCount    = filtered.filter(r => r.outcome === 'Complicated' || r.outcome === 'Failed').length
  const successRate  = filtered.length ? Math.round((successCount / filtered.length) * 100) : 0
  const compRate     = filtered.length ? ((compCount / filtered.length) * 100).toFixed(1) : '0.0'

  const LINE_COLORS: Record<string, string> = {
    coronary: '#ef4444', ep: '#8b5cf6', device: '#06b6d4',
    structural: '#f59e0b', emergency: '#f97316', diagnostic: '#10b981',
  }

  return (
    <div className="space-y-5 animate-fade-in">

      {/* ── Page header ── */}
      <div className="glass-card p-5 border border-blue-500/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">Procedural Audit</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Quality monitoring for all major cardiology interventions — Coronary · EP · Device · Structural · Emergency · Diagnostic
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span className="px-2.5 py-1 rounded-lg border border-blue-500/15 bg-blue-500/5 text-blue-400">YTD 2026</span>
          <span className="text-gray-600">|</span>
          <span>726 total procedures</span>
          <span className="text-gray-600">·</span>
          <span className="text-emerald-400">94.2% overall success</span>
        </div>
      </div>

      {/* Reference data disclaimer */}
      <div className="flex items-start gap-3 rounded-xl border border-amber-500/25 bg-amber-500/8 p-3">
        <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
        <p className="text-xs">
          <span className="font-semibold text-amber-300">Sample / Reference Data — </span>
          <span className="text-gray-400">All procedure records shown are illustrative only. This module requires integration with the Cath Lab or procedure-entry workflow to display real interventional data.</span>
        </p>
      </div>

      {/* ── Tab navigation ── */}
      <div className="flex gap-1.5 flex-wrap">
        {CATEGORIES.map(c => (
          <button
            key={c.id}
            onClick={() => setActiveTab(c.id)}
            className={cn(
              'flex items-center gap-1.5 text-xs px-3.5 py-2 rounded-xl border transition-all font-medium',
              activeTab === c.id
                ? 'text-white border-transparent'
                : 'text-gray-400 border-blue-500/10 bg-white/[0.03] hover:text-white hover:bg-white/[0.05]'
            )}
            style={activeTab === c.id ? { background: c.gradient, borderColor: 'transparent' } : {}}
          >
            <c.Icon size={13} />
            {c.label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════
          OVERVIEW TAB
      ══════════════════════════════════════════ */}
      {activeTab === 'all' && (
        <>
          {/* Summary KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Total Procedures (YTD)',  value: '726',   icon: Activity,       color: 'text-blue-400',    bg: 'bg-blue-500/10' },
              { label: 'Overall Success Rate',    value: '94.2%', icon: CheckCircle,    color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
              { label: 'Complication Rate',       value: '3.2%',  icon: AlertTriangle,  color: 'text-amber-400',   bg: 'bg-amber-500/10' },
              { label: 'Active Operators',        value: '3',     icon: Users,          color: 'text-violet-400',  bg: 'bg-violet-500/10' },
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

          {/* Charts row 1 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Volume by category */}
            <div className="glass-card p-5 border border-blue-500/10">
              <p className="text-sm font-semibold text-white mb-4">Procedure Volume by Category (YTD)</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={VOLUME_BY_CAT} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(59,130,246,0.07)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#cbd5e1' }} tickLine={false} axisLine={false} width={120} />
                  <Tooltip content={<DarkTip />} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={16}>
                    {VOLUME_BY_CAT.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Monthly trend (multi-line) */}
            <div className="glass-card p-5 border border-blue-500/10">
              <p className="text-sm font-semibold text-white mb-4">Monthly Procedure Trend</p>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={MONTHLY_TREND}>
                  <defs>
                    {Object.entries(LINE_COLORS).map(([k, c]) => (
                      <linearGradient key={k} id={`g_${k}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={c} stopOpacity={0.25} />
                        <stop offset="95%" stopColor={c} stopOpacity={0} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(59,130,246,0.07)" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#cbd5e1' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip content={<DarkTip />} />
                  {Object.entries(LINE_COLORS).map(([k, c]) => (
                    <Area key={k} type="monotone" dataKey={k} name={k.charAt(0).toUpperCase() + k.slice(1)}
                      stroke={c} strokeWidth={1.5} fill={`url(#g_${k})`} dot={false} />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Charts row 2 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Success rate by category */}
            <div className="glass-card p-5 border border-blue-500/10">
              <p className="text-sm font-semibold text-white mb-4">Success Rate by Category (%)</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={SUCCESS_BY_CAT} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(59,130,246,0.07)" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} unit="%" />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#cbd5e1' }} tickLine={false} axisLine={false} width={110} />
                  <Tooltip content={<DarkTip />} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={14}>
                    {SUCCESS_BY_CAT.map((d, i) => <Cell key={i} fill={d.value >= 95 ? '#10b981' : d.value >= 88 ? '#3b82f6' : '#f59e0b'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Complication rate */}
            <div className="glass-card p-5 border border-blue-500/10">
              <p className="text-sm font-semibold text-white mb-4">Complication Rate by Category (%)</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={COMPLICATION_BY_CAT} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(59,130,246,0.07)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} unit="%" />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#cbd5e1' }} tickLine={false} axisLine={false} width={110} />
                  <Tooltip content={<DarkTip />} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={14}>
                    {COMPLICATION_BY_CAT.map((d, i) => <Cell key={i} fill={d.value > 6 ? '#ef4444' : d.value > 3 ? '#f59e0b' : '#10b981'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Operator volume */}
            <div className="glass-card p-5 border border-blue-500/10">
              <p className="text-sm font-semibold text-white mb-4">Operator Procedure Volume (YTD)</p>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={OPERATOR_VOLUME} cx="50%" cy="50%" outerRadius={75}
                    dataKey="value"
                    label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                    stroke="rgba(10,17,40,0.7)" strokeWidth={2}
                  >
                    {OPERATOR_VOLUME.map((_, i) => <Cell key={i} fill={['#3b82f6', '#8b5cf6', '#10b981'][i]} />)}
                  </Pie>
                  <Tooltip content={<DarkTip />} />
                  <Legend formatter={(v: string) => <span style={{ fontSize: 10, color: '#94a3b8' }}>{v}</span>} iconSize={8} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* All procedure records */}
          <ProcedureTable records={RECORDS} />
        </>
      )}

      {/* ══════════════════════════════════════════
          CATEGORY-SPECIFIC TAB
      ══════════════════════════════════════════ */}
      {activeTab !== 'all' && (
        <>
          {/* Category KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Procedures (records)',  value: filtered.length.toString(),  icon: Activity,      color: cat.color,          bg: `bg-[${cat.accent}]/10` },
              { label: 'Procedure Success Rate', value: `${successRate}%`,           icon: CheckCircle,   color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
              { label: 'Complication Rate',     value: `${compRate}%`,               icon: AlertTriangle, color: 'text-amber-400',   bg: 'bg-amber-500/10' },
              { label: 'Avg Duration',          value: `${Math.round(filtered.reduce((s, r) => s + r.duration, 0) / (filtered.length || 1))} min`, icon: Clock, color: 'text-violet-400', bg: 'bg-violet-500/10' },
            ].map(s => (
              <div key={s.label} className="glass-card p-4 flex items-center gap-3 border border-blue-500/10">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-white/[0.06]">
                  <s.icon className={s.color} size={18} />
                </div>
                <div>
                  <p className="text-xs text-gray-400">{s.label}</p>
                  <p className="text-xl font-bold text-white">{s.value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Category charts + benchmarks */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Pie chart */}
            {CAT_CHARTS[activeTab as Exclude<CategoryId, 'all'>].pie && (() => {
              const { title, data } = CAT_CHARTS[activeTab as Exclude<CategoryId, 'all'>].pie!
              return (
                <div className="glass-card p-5 border border-blue-500/10">
                  <p className="text-sm font-semibold text-white mb-3">{title}</p>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={data} cx="50%" cy="50%" outerRadius={72}
                        dataKey="value"
                        label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                        labelLine={false}
                        stroke="rgba(10,17,40,0.7)" strokeWidth={2}
                      >
                        {data.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                      </Pie>
                      <Tooltip content={<DarkTip />} />
                      <Legend formatter={(v: string) => <span style={{ fontSize: 9, color: '#94a3b8' }}>{v}</span>} iconSize={7} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )
            })()}

            {/* Bar chart */}
            {CAT_CHARTS[activeTab as Exclude<CategoryId, 'all'>].bar && (() => {
              const { title, data, color } = CAT_CHARTS[activeTab as Exclude<CategoryId, 'all'>].bar!
              return (
                <div className="glass-card p-5 border border-blue-500/10">
                  <p className="text-sm font-semibold text-white mb-3">{title}</p>
                  <ResponsiveContainer width="100%" height={220}>
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
            })()}

            {/* Benchmarks */}
            <BenchmarkPanel benchmarks={BENCHMARKS[activeTab as Exclude<CategoryId, 'all'>]} />
          </div>

          {/* Filtered procedure table */}
          <ProcedureTable records={filtered} />
        </>
      )}
    </div>
  )
}
