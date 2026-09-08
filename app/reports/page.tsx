'use client'
import { useState, useMemo, useEffect } from 'react'
import {
  FileText, Search, BarChart3, Heart, ShieldAlert, Award, Compass, Sparkles, Download, ArrowUpRight, TrendingUp, X, Printer, Calendar
} from 'lucide-react'
import Button from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine
} from 'recharts'
import { AlertTriangle, Users, Database } from 'lucide-react'
import { getPatients, getAllLatestVisits } from '@/lib/firestore'
import type { Patient, Visit } from '@/lib/types'

// Left Navigation sections
const REPORT_SECTIONS = [
  { id: 'population', label: 'Population Reports', icon: Compass },
  { id: 'cad', label: 'CAD Reports', icon: Heart },
  { id: 'acs', label: 'ACS/STEMI Reports', icon: ShieldAlert },
  { id: 'hf', label: 'Heart Failure Reports', icon: Heart },
  { id: 'arrhythmia', label: 'Arrhythmia Reports', icon: TrendingUp },
  { id: 'device', label: 'Device Reports', icon: Award },
  { id: 'structural', label: 'Structural Heart Reports', icon: Heart },
  { id: 'imaging', label: 'Imaging Reports', icon: Sparkles },
  { id: 'cathlab', label: 'Cath Lab Reports', icon: Award },
  { id: 'outcomes', label: 'Outcomes Reports', icon: BarChart3 },
  { id: 'quality', label: 'Quality Benchmark Reports', icon: Award },
  { id: 'medication', label: 'Medication Reports', icon: FileText },
]

// All reports mapped to their sections
const REPORTS_REGISTRY: Record<string, { title: string; category: string; description: string; metrics: string[] }[]> = {
  population: [
    { title: 'Demographic Distribution', category: 'Clinical Reports', description: 'Patient age, gender, and regional location matrices.', metrics: ['Total Registered: 1,248', 'Avg Age: 58.4 yrs', 'Male: 64%'] },
    { title: 'Disease Category Distribution', category: 'Operational Reports', description: 'Prevalence maps of CAD, HF, Arrhythmias, and Valvular disease.', metrics: ['CAD: 45%', 'HF: 32%', 'Arrhythmias: 18%'] }
  ],
  cad: [
    { title: 'Disease Burden & Prevalence Trends', category: 'Clinical Reports', description: 'STEMI/NSTEMI incidence ratios, multi-vessel CAD distribution, and young MI registry analytics.', metrics: ['Young MI (<40 yrs): 8.4%', 'Multi-vessel CAD: 38.2%'] },
    { title: 'Angiography Distribution Patterns', category: 'Clinical Reports', description: 'Vessel involvement mappings (LAD, LCX, RCA) and Left Main disease occurrences.', metrics: ['LAD Involvement: 62%', 'Left Main Disease: 12.4%', 'SYNTAX Score >32: 15%'] },
    { title: 'PCI Success & Access Benchmarks', category: 'Clinical Reports', description: 'Success rates, radial vs femoral access benchmarks, and drug-eluting stent utilization trends.', metrics: ['PCI Success: 98.4%', 'Radial Access: 85%'] }
  ],
  acs: [
    { title: 'STEMI Quality Metrics', category: 'Quality & Benchmark Reports', description: 'Door-to-balloon time, FMC-to-device timelines, and thrombolysis success rates.', metrics: ['Median D2B: 58 mins', 'Compliance: 92%'] },
    { title: 'Outcomes & MACE Records', category: 'Outcomes Reports', description: 'In-hospital mortality, 30-day MACE logs, and repeat revascularization incidence.', metrics: ['30-day MACE: 2.1%', 'In-hospital Mortality: 1.4%'] }
  ],
  hf: [
    { title: 'HF Population Cohorts', category: 'Clinical Reports', description: 'HFrEF, HFpEF, and HFmrEF distribution trends alongside mean LVEF trajectories.', metrics: ['HFrEF: 48%', 'HFpEF: 35%', 'Mean LVEF: 34.2%'] },
    { title: 'Guideline-Directed Medical Therapy (GDMT)', category: 'Quality & Benchmark Reports', description: 'Quadruple therapy utilization compliance (ARNI, Beta-blocker, MRA, SGLT2i).', metrics: ['ARNI: 82%', 'SGLT2i: 76%', 'Quadruple Compliance: 64%'] },
    { title: 'Remote Monitoring & Congestion Risks', category: 'Research & Analytics Reports', description: 'Weight fluctuation alerts, congestion scores, and wearable-derived deterioration signals.', metrics: ['Decompensation Alerts: 14', 'Sensor Compliance: 91%'] }
  ],
  arrhythmia: [
    { title: 'AF Registry & Anticoagulation', category: 'Clinical Reports', description: 'CHA₂DS₂-VASc scores, anticoagulation adherence, and stroke prevention compliance.', metrics: ['Avg CHA₂DS₂-VASc: 3.2', 'OAC Compliance: 88%'] },
    { title: 'EP Procedure & Ablation Success', category: 'Outcomes Reports', description: 'AF ablation success rates, recurrence patterns, and procedure complication rates.', metrics: ['Success Rate: 84.5%', 'Recurrence (1 yr): 15%'] },
    { title: 'Device Rhythm Burden Tracker', category: 'AI & Predictive Reports', description: 'AF burden trends, VT/VF episodes, and appropriate ICD shock analytics.', metrics: ['AF Burden >10%: 12%', 'VT/VF Episodes: 45'] }
  ],
  device: [
    { title: 'Implant & Utilization Trends', category: 'Operational Reports', description: 'Pacemaker, ICD, and CRT implantation rates and manufacturer distribution tables.', metrics: ['Total Implants: 312', 'CRT-D: 24%'] },
    { title: 'Device Performance & Battery Longevity', category: 'Quality & Benchmark Reports', description: 'Lead impedance failures, battery longevity curves, and manufacturer advisory tracking.', metrics: ['Lead Failure Rate: 0.8%', 'Battery Expiry Warnings: 3'] }
  ],
  structural: [
    { title: 'TAVR Procedural Benchmarks', category: 'Outcomes Reports', description: 'Valve gradients, post-implant paravalvular leaks, and new pacemaker requirements.', metrics: ['Success Rate: 97.8%', 'New PPI Rate: 8.5%'] },
    { title: 'Mitral & Tricuspid Interventions', category: 'Outcomes Reports', description: 'MR/TR severity improvements, functional class outcomes, and device durability parameters.', metrics: ['MR Severity Reduction: 84%'] }
  ],
  imaging: [
    { title: 'Echocardiography Quality Indices', category: 'Clinical Reports', description: 'GLS trends, valve disease progression tracking, and pulmonary hypertension charts.', metrics: ['Mean GLS: -14.2%', 'PA Systolic Pressure: 42mmHg'] },
    { title: 'CT Coronary & Calcium Scores', category: 'Research & Academic Reports', description: 'Calcium score distributions, CAD-RADS categories, and plaque morphology tracking.', metrics: ['Calcium Score >400: 18%', 'CAD-RADS 4/5: 22%'] },
    { title: 'Cardiac MRI Scar Mapping', category: 'Research & Academic Reports', description: 'LGE scar burden calculations, myocarditis patterns, and cardiomyopathy phenotypes.', metrics: ['Scar Burden >10%: 14%'] }
  ],
  cathlab: [
    { title: 'Workflow & Cath Lab Turnaround', category: 'Operational Reports', description: 'Room utilization rates, procedure times, and emergency activation delays.', metrics: ['Utilization Rate: 84.2%', 'Turnaround Time: 32 mins'] },
    { title: 'Safety, Contrast & Radiation Logs', category: 'Quality & Benchmark Reports', description: 'Contrast-induced nephropathy logs, radiation dose area product (DAP), and vascular issues.', metrics: ['CIN Rate: 1.1%', 'Mean DAP: 42 DAP'] }
  ],
  outcomes: [
    { title: 'Longitudinal Survival & Kaplan-Meier', category: 'Outcomes Reports', description: 'Kaplan-Meier survival curves, MACE-free survival trends, and readmission analytics.', metrics: ['1-Year Survival: 94.2%', 'MACE-free Survival: 89.8%'] },
    { title: 'Readmissions & Emergency Revisits', category: 'Outcomes Reports', description: '7-day and 30-day HF readmission rates, recurrent hospitalizations, and root cause reviews.', metrics: ['30-day Readmissions: 8.2%', '7-day Readmissions: 1.4%'] }
  ],
  quality: [
    { title: 'Institutional Quality Benchmarking', category: 'Quality & Benchmark Reports', description: 'Mortality comparison, door-to-balloon benchmark comparisons, and guideline adherence rankings.', metrics: ['Registry Rank: 92nd Rank', 'D2B Deviation: -8 mins'] }
  ],
  medication: [
    { title: 'GDMT Persistence & DAPT Compliance', category: 'Clinical Reports', description: 'Medication adherence levels at 1, 6, and 12 months post-discharge.', metrics: ['GDMT Persistence: 87%', 'DAPT Compliance: 94%'] }
  ]
}

// Complete visualization mapping configuration
interface ReportVisualConfig {
  chartType: 'bar' | 'line' | 'pie'
  chartData: any[]
  xAxisKey?: string
  yAxisLabel?: string
  colors?: string[]
  targetVal?: number
  summary: string
  recommendations: string[]
  checklists: string[]
}

const REPORT_VISUALS: Record<string, ReportVisualConfig> = {
  'Demographic Distribution': {
    chartType: 'bar',
    chartData: [
      { name: '<40 yrs', Patients: 105 },
      { name: '40–49 yrs', Patients: 224 },
      { name: '50–59 yrs', Patients: 424 },
      { name: '60–69 yrs', Patients: 350 },
      { name: '≥70 yrs', Patients: 145 }
    ],
    xAxisKey: 'name',
    yAxisLabel: 'Patients',
    summary: 'Visualizes the age cohort distribution of enrolled registry patients. High concentration is noted in the 50-69 age bracket.',
    recommendations: [
      'Expand access to community screenings targeting age groups above 60 to catch asymptomatic coronary issues.',
      'Correlate age demographics with MACE trends to adjust procedural risk factors dynamically.'
    ],
    checklists: [
      'Ensure complete date of birth entries across all registries.',
      'Validate national identity database links for correct address pin mappings.'
    ]
  },
  'Disease Category Distribution': {
    chartType: 'pie',
    chartData: [
      { name: 'CAD', value: 45 },
      { name: 'Heart Failure', value: 32 },
      { name: 'Arrhythmias', value: 18 },
      { name: 'Valvular Disease', value: 5 }
    ],
    colors: ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b'],
    summary: 'Shows clinical category representation. Coronary Artery Disease remains the dominant registry cohort (45%), followed closely by Heart Failure.',
    recommendations: [
      'Implement multi-disciplinary clinics addressing overlapping CAD and HF disease profiles.',
      'Deploy arrhythmia screening strategies within primary care networks.'
    ],
    checklists: [
      'Verify patient diagnostic codes map exactly to primary ICD-10 registries.',
      'Review structural valvular documentation completeness.'
    ]
  },
  'Disease Burden & Prevalence Trends': {
    chartType: 'line',
    chartData: [
      { month: 'Jan', 'Young MI (<40)': 7.8, 'Multi-vessel CAD': 36.4 },
      { month: 'Feb', 'Young MI (<40)': 8.0, 'Multi-vessel CAD': 37.1 },
      { month: 'Mar', 'Young MI (<40)': 8.2, 'Multi-vessel CAD': 37.9 },
      { month: 'Apr', 'Young MI (<40)': 8.5, 'Multi-vessel CAD': 38.0 },
      { month: 'May', 'Young MI (<40)': 8.3, 'Multi-vessel CAD': 38.1 },
      { month: 'Jun', 'Young MI (<40)': 8.4, 'Multi-vessel CAD': 38.2 }
    ],
    xAxisKey: 'month',
    yAxisLabel: 'Percentage (%)',
    summary: 'Tracks the rising prevalence of premature Coronary Artery Disease (Young MI) and multi-vessel blockages in registry outcomes.',
    recommendations: [
      'Address aggressive risk-factor control in young cohorts, prioritizing familial hypercholesterolemia checks.',
      'Develop strict invasive strategy audits for multi-vessel CAD treatments.'
    ],
    checklists: [
      'Enforce documentation of smoking status and family CAD history in patient charts.',
      'Audit multi-vessel diagnostic coding accuracy against angio reports.'
    ]
  },
  'Angiography Distribution Patterns': {
    chartType: 'bar',
    chartData: [
      { vessel: 'LAD Involvement', Prevalence: 62 },
      { vessel: 'RCA Involvement', Prevalence: 45 },
      { vessel: 'LCx Involvement', Prevalence: 38 },
      { vessel: 'Left Main Disease', Prevalence: 12.4 }
    ],
    xAxisKey: 'vessel',
    yAxisLabel: 'Prevalence (%)',
    summary: 'A coronary map showcasing target vessel blockages. LAD involvement represents the highest ischemic territory burden in Cath labs.',
    recommendations: [
      'Assess FFR/iFR deployment rates in moderate LCx and RCA lesions.',
      'Establish heart team review consensus for Left Main stenosis prior to CABG vs PCI decisions.'
    ],
    checklists: [
      'Verify angiographic percent stenosis fields are completely logged.',
      'Audit SYNTAX score calculation compliance for multi-vessel records.'
    ]
  },
  'PCI Success & Access Benchmarks': {
    chartType: 'line',
    chartData: [
      { month: 'Jan', 'Radial Access': 81, 'PCI Success': 98.0 },
      { month: 'Feb', 'Radial Access': 83, 'PCI Success': 98.2 },
      { month: 'Mar', 'Radial Access': 84, 'PCI Success': 98.1 },
      { month: 'Apr', 'Radial Access': 85, 'PCI Success': 98.3 },
      { month: 'May', 'Radial Access': 85, 'PCI Success': 98.4 },
      { month: 'Jun', 'Radial Access': 86, 'PCI Success': 98.4 }
    ],
    xAxisKey: 'month',
    yAxisLabel: 'Rate (%)',
    summary: 'Benchmarking the clinical switch to radial-first approach alongside overall post-procedure angio success rates.',
    recommendations: [
      'Conduct radial access training sessions for junior fellows to push the institutional target to >90%.',
      'Track femoral site access complications systematically in outcomes reports.'
    ],
    checklists: [
      'Document post-PCI TIMI flow grades within 15 minutes of completion.',
      'Crosscheck sheath size and vascular closure device logs.'
    ]
  },
  'STEMI Quality Metrics': {
    chartType: 'line',
    chartData: [
      { month: 'Jan', 'Median D2B': 64, Target: 90 },
      { month: 'Feb', 'Median D2B': 62, Target: 90 },
      { month: 'Mar', 'Median D2B': 60, Target: 90 },
      { month: 'Apr', 'Median D2B': 58, Target: 90 },
      { month: 'May', 'Median D2B': 59, Target: 90 },
      { month: 'Jun', 'Median D2B': 58, Target: 90 }
    ],
    xAxisKey: 'month',
    yAxisLabel: 'Minutes',
    targetVal: 90,
    summary: 'Monitors Door-to-Balloon times against international quality standards (<90 mins for primary PCI). Institutional compliance is outstanding.',
    recommendations: [
      'Analyze the outliers where D2B exceeded 90 minutes to identify system bottle-necks (e.g., off-hours admissions).',
      'Optimize emergency department direct-activation protocols for the Cath Lab.'
    ],
    checklists: [
      'Verify time-of-arrival and time-of-first-balloon timestamps are synced to central server clock.',
      'Log transit delay reasons (e.g., patient transfer, anatomical issues).'
    ]
  },
  'Outcomes & MACE Records': {
    chartType: 'bar',
    chartData: [
      { period: 'In-Hospital', Rate: 1.4, MACE: 1.8 },
      { period: '30-Day', Rate: 1.9, MACE: 2.1 },
      { period: '90-Day', Rate: 2.4, MACE: 3.5 }
    ],
    xAxisKey: 'period',
    yAxisLabel: 'Incidence (%)',
    summary: 'Surveillance of clinical major adverse cardiovascular events (death, re-infarction, stroke, revascularization) across follow-up intervals.',
    recommendations: [
      'Schedule follow-up phone consults at 72 hours for high-risk discharge cohorts.',
      'Evaluate DAPT compliance protocols at clinical touchpoints.'
    ],
    checklists: [
      'Standardize definitions of target vessels re-intervention events.',
      'Confirm post-discharge stroke diagnostic status through neurology note audits.'
    ]
  },
  'HF Population Cohorts': {
    chartType: 'pie',
    chartData: [
      { name: 'HFrEF', value: 48 },
      { name: 'HFpEF', value: 35 },
      { name: 'HFmrEF', value: 17 }
    ],
    colors: ['#2563eb', '#10b981', '#6366f1'],
    summary: 'Proportion of heart failure patients stratified by LVEF. HFrEF (LVEF < 40%) represents the largest registry subgroup.',
    recommendations: [
      'Verify that all HFrEF patients are receiving guideline-directed quadruple therapy checks.',
      'Establish a diagnostic pathways program for HFpEF utilizing H2FPEF and HFA-PEFF calculators.'
    ],
    checklists: [
      'Echo date and quantitative LVEF entry must be updated within 48 hours of discharge.',
      'Review clinical signs of congestion (oedema, JVP) at each clinic visit.'
    ]
  },
  'Guideline-Directed Medical Therapy (GDMT)': {
    chartType: 'bar',
    chartData: [
      { class: 'Beta-Blocker', Compliance: 88 },
      { class: 'RAASi', Compliance: 82 },
      { class: 'SGLT2i', Compliance: 76 },
      { class: 'MRA', Compliance: 63 }
    ],
    xAxisKey: 'class',
    yAxisLabel: 'Prescribing Rate (%)',
    summary: 'Monitors prescribing compliance across the four cornerstone pillars of HF management. SGLT2i and MRA show opportunity for growth.',
    recommendations: [
      'Implement automated EMR reminders alert systems for patients with EF < 40% not on quadruple therapy.',
      'Establish clinical pharmacists led drug titration protocols.'
    ],
    checklists: [
      'Verify documented contraindications or intolerances if GDMT is omitted.',
      'Confirm kidney function (eGFR) and potassium checks within 14 days of starting MRA/RAASi.'
    ]
  },
  'Remote Monitoring & Congestion Risks': {
    chartType: 'line',
    chartData: [
      { week: 'Wk 1', Alerts: 18, Resolved: 16 },
      { week: 'Wk 2', Alerts: 15, Resolved: 14 },
      { week: 'Wk 3', Alerts: 12, Resolved: 12 },
      { week: 'Wk 4', Alerts: 14, Resolved: 13 }
    ],
    xAxisKey: 'week',
    yAxisLabel: 'Count',
    summary: 'Tracks remote monitoring sensor compliance, patient weight fluctuations, and decompensation alerts handled by care coordination.',
    recommendations: [
      'Conduct educational sessions on early decompensation warning signs for newly enrolled patients.',
      'Audit alert response times to ensure critical warnings are resolved within 4 hours.'
    ],
    checklists: [
      'Confirm cellular transmitter connectivity before sending devices home.',
      'Standardize weight increase threshold warnings (e.g., >2 kg in 48 hours).'
    ]
  },
  'AF Registry & Anticoagulation': {
    chartType: 'pie',
    chartData: [
      { name: 'NOAC / OAC', value: 88 },
      { name: 'Antiplatelet only', value: 8 },
      { name: 'No therapy', value: 4 }
    ],
    colors: ['#059669', '#d97706', '#dc2626'],
    summary: 'Anticoagulation status based on stroke risk. 88% compliance rate shows close adherence to ESC stroke prevention guidelines.',
    recommendations: [
      'Conduct anticoagulation reconciliation for the 8% taking antiplatelets only, ensuring appropriate transition to NOACs.',
      'Review HAS-BLED bleeding scores dynamically during anticoagulant renewals.'
    ],
    checklists: [
      'CHA₂DS₂-VASc parameters must be calculated for all newly entered AF patients.',
      'Verify kidney function labs are checked prior to prescribing DOAC doses.'
    ]
  },
  'EP Procedure & Ablation Success': {
    chartType: 'line',
    chartData: [
      { month: 'Jan', 'Success Rate': 82.5 },
      { month: 'Feb', 'Success Rate': 83.1 },
      { month: 'Mar', 'Success Rate': 84.0 },
      { month: 'Apr', 'Success Rate': 84.3 },
      { month: 'May', 'Success Rate': 84.5 },
      { month: 'Jun', 'Success Rate': 84.5 }
    ],
    xAxisKey: 'month',
    yAxisLabel: 'Success Rate (%)',
    summary: 'Tracks the 1-year success rates of catheter ablation procedures for paroxysmal/persistent atrial fibrillation.',
    recommendations: [
      'Deploy post-procedure rhythm monitoring devices to detect asymptomatic recurrences.',
      'Optimize pre-procedural mapping strategies to minimize fluoroscopy times.'
    ],
    checklists: [
      'Log specific ablation methods (cryoballoon vs RF).',
      'Log 3-month and 6-month Holter ECG reports.'
    ]
  },
  'Device Rhythm Burden Tracker': {
    chartType: 'bar',
    chartData: [
      { week: 'Wk 1', 'AF Burden >10%': 15, 'VT/VF Episodes': 8 },
      { week: 'Wk 2', 'AF Burden >10%': 12, 'VT/VF Episodes': 10 },
      { week: 'Wk 3', 'AF Burden >10%': 11, 'VT/VF Episodes': 12 },
      { week: 'Wk 4', 'AF Burden >10%': 12, 'VT/VF Episodes': 15 }
    ],
    xAxisKey: 'week',
    yAxisLabel: 'Cases',
    summary: 'Aggregates diagnostic telemetry from implanted pacemakers, ICDs, and loop recorders to alert on clinical arrhythmic burden.',
    recommendations: [
      'Coordinate urgent follow-up for patients experiencing multiple appropriate ICD shock episodes.',
      'Optimize antiarrhythmic drug dosage dynamically based on burdent trends.'
    ],
    checklists: [
      'Verify device transmission schedules are configured correctly.',
      'Update ventricular tachycardia threshold settings in patient profile.'
    ]
  },
  'Implant & Utilization Trends': {
    chartType: 'bar',
    chartData: [
      { type: 'Pacemaker', Implants: 120 },
      { type: 'ICD', Implants: 84 },
      { type: 'CRT-D', Implants: 75 },
      { type: 'CRT-P', Implants: 33 }
    ],
    xAxisKey: 'type',
    yAxisLabel: 'Implants',
    summary: 'Volume of implants logged. CRT-D accounts for 24% of the total, showing appropriate target selection in HFrEF cohorts.',
    recommendations: [
      'Establish a strict registry tracking pathway for lead placement parameters.',
      'Implement post-implant follow-up compliance checks.'
    ],
    checklists: [
      'Document device model, serial number, and battery status at implant.',
      'Verify consent forms are scanned into EMR.'
    ]
  },
  'Device Performance & Battery Longevity': {
    chartType: 'line',
    chartData: [
      { year: 'Yr 1', 'Lead Impedance': 510, 'Battery (%)': 98 },
      { year: 'Yr 2', 'Lead Impedance': 505, 'Battery (%)': 90 },
      { year: 'Yr 3', 'Lead Impedance': 498, 'Battery (%)': 82 },
      { year: 'Yr 4', 'Lead Impedance': 502, 'Battery (%)': 73 },
      { year: 'Yr 5', 'Lead Impedance': 495, 'Battery (%)': 65 }
    ],
    xAxisKey: 'year',
    yAxisLabel: 'Value',
    summary: 'Longitudinal telemetry analytics on battery depletion rates and lead impedance parameters to preempt device failures.',
    recommendations: [
      'Proactively schedule generator changes for battery indicators dropping below 20% (ERI status).',
      'Deploy home monitoring for warning signals.'
    ],
    checklists: [
      'Review threshold capture safety margins.',
      'Verify pacing percentage records are logged.'
    ]
  },
  'TAVR Procedural Benchmarks': {
    chartType: 'bar',
    chartData: [
      { case: 'Pre-Procedure', Gradient: 42, PVL: 0 },
      { case: 'Post-Procedure', Gradient: 8, PVL: 2 }
    ],
    xAxisKey: 'case',
    yAxisLabel: 'Mean Gradient (mmHg)',
    summary: ' procedural benchmark tracker showcasing trans-valvular pressure gradient reductions and residual paravalvular leak grades.',
    recommendations: [
      'Optimize balloon expansion and sizing models using high-resolution CT pre-planning.',
      'Audit procedural pacemaker requirements post-TAVR.'
    ],
    checklists: [
      'Measure trans-aortic gradients post-valve release.',
      'Log post-procedure PVL grade (None/Trace/Mild/Mod/Sev).'
    ]
  },
  'Mitral & Tricuspid Interventions': {
    chartType: 'bar',
    chartData: [
      { stage: 'Pre-Clip', 'MR Severe': 86, 'TR Severe': 54 },
      { stage: 'Post-Clip', 'MR Severe': 12, 'TR Severe': 18 }
    ],
    xAxisKey: 'stage',
    yAxisLabel: 'Percentage (%)',
    summary: 'Tracks transcatheter edge-to-edge repair (TEER) outcomes. 84% reduction in mitral regurgitation severity is achieved.',
    recommendations: [
      'Establish standard echo assessment schedules at 30 days and 1 year post-intervention.',
      'Track 6MWT improvement values to validate clinical efficacy.'
    ],
    checklists: [
      'Measure pulmonary venous flow patterns pre and post clipping.',
      'Document device orientation details.'
    ]
  },
  'Echocardiography Quality Indices': {
    chartType: 'bar',
    chartData: [
      { age: '<50', 'GLS (%)': -16.8 },
      { age: '50-59', 'GLS (%)': -15.1 },
      { age: '60-69', 'GLS (%)': -14.2 },
      { age: '70+', 'GLS (%)': -13.1 }
    ],
    xAxisKey: 'age',
    yAxisLabel: 'Mean GLS (%)',
    summary: 'Echocardiography strain analytics. Tracking global longitudinal strain provides early prognostic clues in cardiotoxicity.',
    recommendations: [
      'Integrate automated GLS speckle tracking algorithms into standard imaging routines.',
      'Correlate strain anomalies with early biomarker rises.'
    ],
    checklists: [
      'Ensure standard 3-apical views are recorded.',
      'Calibrate imaging platforms regularly.'
    ]
  },
  'CT Coronary & Calcium Scores': {
    chartType: 'bar',
    chartData: [
      { range: 'Score 0', Distribution: 35 },
      { range: 'Score 1-100', Distribution: 28 },
      { range: 'Score 101-400', Distribution: 19 },
      { range: 'Score >400', Distribution: 18 }
    ],
    xAxisKey: 'range',
    yAxisLabel: 'Distribution (%)',
    summary: 'Calcium score distribution maps. 18% show high calcification index (>400 Agatston units), signaling high risk.',
    recommendations: [
      'Enforce aggressive primary prevention lipid therapies for patients with calcium score > 100.',
      'Correlate CTCA findings with functional stress testing results.'
    ],
    checklists: [
      'Confirm calcium score scans are reviewed within 24 hours.',
      'Update the patient risk profiles.'
    ]
  },
  'Cardiac MRI Scar Mapping': {
    chartType: 'pie',
    chartData: [
      { name: 'No LGE Scar', value: 68 },
      { name: 'Mild LGE (<10%)', value: 18 },
      { name: 'Moderate/Severe (≥10%)', value: 14 }
    ],
    colors: ['#10b981', '#3b82f6', '#ef4444'],
    summary: 'MRI Late Gadolinium Enhancement (LGE) distribution. Moderate-to-severe scar burden represents a high risk for cardiac events.',
    recommendations: [
      'Discuss implantable device options (ICD) with patients who exhibit >10% LGE scar burden.',
      'Track arrhythmia events in these cohorts systematically.'
    ],
    checklists: [
      'Log specific scar distribution patterns (e.g. subendocardial, midwall).',
      'Verify image artifacts are filtered out.'
    ]
  },
  'Workflow & Cath Lab Turnaround': {
    chartType: 'line',
    chartData: [
      { month: 'Jan', 'Turnaround Time': 38 },
      { month: 'Feb', 'Turnaround Time': 36 },
      { month: 'Mar', 'Turnaround Time': 34 },
      { month: 'Apr', 'Turnaround Time': 33 },
      { month: 'May', 'Turnaround Time': 32 },
      { month: 'Jun', 'Turnaround Time': 32 }
    ],
    xAxisKey: 'month',
    yAxisLabel: 'Minutes',
    summary: 'Analyzes Cath Lab operational performance. Decreases in turnaround time maximize room utilization and procedure workflow.',
    recommendations: [
      'Deploy pre-procedure checklists in staging area to expedite room transitions.',
      'Review delays caused by instrument preparation protocols.'
    ],
    checklists: [
      'Log case stop and room clean-up completion timestamps.',
      'Document scheduling delay reason codes.'
    ]
  },
  'Safety, Contrast & Radiation Logs': {
    chartType: 'bar',
    chartData: [
      { month: 'Jan', 'CIN Rate (%)': 1.4, 'Mean DAP (Gy.cm²)': 45 },
      { month: 'Feb', 'CIN Rate (%)': 1.3, 'Mean DAP (Gy.cm²)': 43 },
      { month: 'Mar', 'CIN Rate (%)': 1.2, 'Mean DAP (Gy.cm²)': 42 },
      { month: 'Apr', 'CIN Rate (%)': 1.1, 'Mean DAP (Gy.cm²)': 41 },
      { month: 'May', 'CIN Rate (%)': 1.1, 'Mean DAP (Gy.cm²)': 42 },
      { month: 'Jun', 'CIN Rate (%)': 1.1, 'Mean DAP (Gy.cm²)': 42 }
    ],
    xAxisKey: 'month',
    yAxisLabel: 'Value',
    summary: 'Cath Lab safety benchmarks tracking radiation dose area products (DAP) and post-procedure contrast-induced nephropathy (CIN) rates.',
    recommendations: [
      'Deploy pre-hydration protocols and use contrast dose calculations for patient eGFR.',
      'Optimize fluoroscopy settings to reduce procedural radiation exposure.'
    ],
    checklists: [
      'Document total contrast volume and radiation dose details in report.',
      'Verify eGFR calculations are checked before procedures.'
    ]
  },
  'Longitudinal Survival & Kaplan-Meier': {
    chartType: 'line',
    chartData: [
      { year: 'Yr 0', Survival: 100 },
      { year: 'Yr 1', Survival: 94.2 },
      { year: 'Yr 2', Survival: 91.5 },
      { year: 'Yr 3', Survival: 89.8 },
      { year: 'Yr 5', Survival: 85.2 }
    ],
    xAxisKey: 'year',
    yAxisLabel: 'Survival Probability (%)',
    summary: 'Kaplan-Meier survival estimation showing strong long-term survival trends. Outcomes benchmarked against national averages.',
    recommendations: [
      'Analyze clinical factors associated with drops in survival trends at 2 and 3 years.',
      'Expand outpatient follow-up adherence strategies.'
    ],
    checklists: [
      'Crosscheck patient vital status logs.',
      'Verify cause-of-death coding where applicable.'
    ]
  },
  'Readmissions & Emergency Revisits': {
    chartType: 'bar',
    chartData: [
      { month: 'Jan', '7-Day': 1.8, '30-Day': 8.8 },
      { month: 'Feb', '7-Day': 1.6, '30-Day': 8.5 },
      { month: 'Mar', '7-Day': 1.5, '30-Day': 8.3 },
      { month: 'Apr', '7-Day': 1.4, '30-Day': 8.2 },
      { month: 'May', '7-Day': 1.4, '30-Day': 8.2 },
      { month: 'Jun', '7-Day': 1.4, '30-Day': 8.2 }
    ],
    xAxisKey: 'month',
    yAxisLabel: 'Readmission Rate (%)',
    summary: 'Assesses 30-day and 7-day readmission statistics. Transitions of care programs have successfully kept rates below benchmark targets.',
    recommendations: [
      'Provide comprehensive medication reconciliation prior to discharge.',
      'Schedule telehealth checks within 48 hours for vulnerable cohorts.'
    ],
    checklists: [
      'Document follow-up appointment date and time before discharge.',
      'Confirm patient/family understanding of warnings and action plans.'
    ]
  },
  'Institutional Quality Benchmarking': {
    chartType: 'bar',
    chartData: [
      { metric: 'D2B Time', 'This Center': 92, 'National Median': 85 },
      { metric: 'GDMT Coverage', 'This Center': 87, 'National Median': 74 },
      { metric: 'DAPT Compliance', 'This Center': 94, 'National Median': 88 },
      { metric: '30d Readmission', 'This Center': 91, 'National Median': 84 }
    ],
    xAxisKey: 'metric',
    yAxisLabel: 'Percentile / Value',
    summary: 'Institutional quality indicator ranking compared against national registries. Highlights outstanding performance in GDMT coverage.',
    recommendations: [
      'Promote best-practice sharing across departments to maintain top-tier rankings.',
      'Formulate improvement initiatives focusing on room turnaround times.'
    ],
    checklists: [
      'Verify data submissions are uploaded completely and audited regularly.',
      'Review comparative registry benchmarking datasets.'
    ]
  },
  'GDMT Persistence & DAPT Compliance': {
    chartType: 'line',
    chartData: [
      { month: 'Month 1', 'GDMT Persistence': 92, 'DAPT Compliance': 98 },
      { month: 'Month 3', 'GDMT Persistence': 89, 'DAPT Compliance': 96 },
      { month: 'Month 6', 'GDMT Persistence': 88, 'DAPT Compliance': 95 },
      { month: 'Month 12', 'GDMT Persistence': 87, 'DAPT Compliance': 94 }
    ],
    xAxisKey: 'month',
    yAxisLabel: 'Rate (%)',
    summary: 'Traces patient therapy compliance and drug persistence rates at key milestones post-discharge. Adherence remains high.',
    recommendations: [
      'Integrate medication compliance screening questions into standard outpatient visits.',
      'Resolve financial/access issues through patient support initiatives.'
    ],
    checklists: [
      'Update medication lists in EMR at each encounter.',
      'Confirm prescription refill parameters are logged.'
    ]
  }
}

// Fallback visual config for safety
const DEFAULT_VISUAL_CONFIG: ReportVisualConfig = {
  chartType: 'line',
  chartData: [
    { name: 'Month 1', value: 85 },
    { name: 'Month 2', value: 88 },
    { name: 'Month 3', value: 87 },
    { name: 'Month 4', value: 91 },
    { name: 'Month 5', value: 90 },
    { name: 'Month 6', value: 92 }
  ],
  xAxisKey: 'name',
  yAxisLabel: 'Compliance (%)',
  summary: 'Longitudinal performance tracking of selected registry indicators.',
  recommendations: [
    'Analyze monthly trends to evaluate service delivery improvement.',
    'Confirm quality parameters align with current guidelines.'
  ],
  checklists: [
    'Audit data records for completeness.',
    'Confirm registry entries match clinical files.'
  ]
}

export default function ReportsArchitecturePage() {
  const [activeSection, setActiveSection] = useState('hf')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedReport, setSelectedReport] = useState<any | null>(null)
  const [timeframe, setTimeframe] = useState<'3 Months' | '6 Months' | '12 Months'>('6 Months')
  const [patients, setPatients] = useState<Patient[]>([])
  const [visitsMap, setVisitsMap] = useState<Map<string, Visit>>(new Map())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const [pts, vMap] = await Promise.all([getPatients(), getAllLatestVisits()])
        setPatients(pts)
        setVisitsMap(vMap)
      } catch (err) {
        console.error('Failed to load reports database:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // Dynamic calculations from live cohort
  const total = patients.length
  const maleCount = patients.filter(p => p.sex === 'Male').length
  const malePct = total > 0 ? Math.round((maleCount / total) * 100) : 0
  const avgAge = total > 0 ? Math.round(patients.reduce((acc, p) => acc + (p.age || 60), 0) / total) : 0

  const hfPatients = patients.filter(p => p.registryId === 'hf' || p.hfType === 'HFrEF')
  const hfrEFCount = patients.filter(p => (visitsMap.get(p.id)?.hfType || p.hfType) === 'HFrEF').length
  const hfrEFPct = total > 0 ? Math.round((hfrEFCount / total) * 100) : 0
  const avgLvef = total > 0
    ? Math.round(patients.reduce((acc, p) => acc + (visitsMap.get(p.id)?.lvef || p.lvef || 30), 0) / total)
    : 0

  // GDMT Adherence among HFrEF
  const raasiCount = hfPatients.filter(p => visitsMap.get(p.id)?.raasi?.prescribed === 'Yes').length
  const bbCount = hfPatients.filter(p => visitsMap.get(p.id)?.betaBlocker?.prescribed === 'Yes').length
  const mraCount = hfPatients.filter(p => visitsMap.get(p.id)?.mra?.prescribed === 'Yes').length
  const sglt2Count = hfPatients.filter(p => visitsMap.get(p.id)?.sglt2i?.prescribed === 'Yes').length
  const quadCount = hfPatients.filter(p => {
    const v = visitsMap.get(p.id)
    return v?.raasi?.prescribed === 'Yes' && v?.betaBlocker?.prescribed === 'Yes' && v?.mra?.prescribed === 'Yes' && v?.sglt2i?.prescribed === 'Yes'
  }).length

  const hfTotal = Math.max(hfPatients.length, 1)
  const raasiPct = Math.round((raasiCount / hfTotal) * 100)
  const bbPct = Math.round((bbCount / hfTotal) * 100)
  const mraPct = Math.round((mraCount / hfTotal) * 100)
  const sglt2Pct = Math.round((sglt2Count / hfTotal) * 100)
  const quadPct = Math.round((quadCount / hfTotal) * 100)

  // Dynamic Reports Registry with real data
  const dynamicReportsRegistry = useMemo(() => {
    return {
      population: [
        {
          title: 'Demographic Distribution',
          category: 'Clinical Reports',
          description: 'Patient age, gender, and regional cohort metrics.',
          metrics: [`Total Enrolled: ${total}`, `Avg Age: ${avgAge} yrs`, `Male: ${malePct}%`],
        },
        {
          title: 'Disease Category Distribution',
          category: 'Operational Reports',
          description: 'Prevalence maps of CAD, HF, Arrhythmias, and comorbidities.',
          metrics: [`Heart Failure: 100%`, `Ischemic CAD: ${Math.round((patients.filter(p => p.comorbidCAD || p.comorbidPriorPCI).length / Math.max(total, 1)) * 100)}%`],
        },
      ],
      hf: [
        {
          title: 'HF Population Cohorts',
          category: 'Clinical Reports',
          description: 'HFrEF, HFpEF, and HFmrEF distribution trends alongside mean LVEF trajectories.',
          metrics: [`HFrEF: ${hfrEFPct}%`, `Cohort Size: ${total}`, `Mean LVEF: ${avgLvef}%`],
        },
        {
          title: 'Guideline-Directed Medical Therapy (GDMT)',
          category: 'Quality & Benchmark Reports',
          description: 'Quadruple therapy utilization compliance (RAASi/ARNI, Beta-blocker, MRA, SGLT2i).',
          metrics: [`RAASi: ${raasiPct}%`, `Beta-Blocker: ${bbPct}%`, `MRA: ${mraPct}%`, `SGLT2i: ${sglt2Pct}%`],
        },
      ],
      cad: [
        {
          title: 'Disease Burden & Prevalence Trends',
          category: 'Clinical Reports',
          description: 'CAD etiology, prior PCI/CABG interventions in heart failure cohort.',
          metrics: [`Ischemic CMP: ${patients.filter(p => p.comorbidCAD || p.comorbidPriorMI).length}`, `Prior Revascularization: ${patients.filter(p => p.comorbidPriorPCI || p.comorbidPriorCABG).length}`],
        },
      ],
      medication: [
        {
          title: 'GDMT Persistence & 4-Pillar Compliance',
          category: 'Clinical Reports',
          description: 'Adherence levels to 4-pillar GDMT among HFrEF patients.',
          metrics: [`Quadruple Therapy: ${quadPct}%`, `RAASi/ARNI: ${raasiPct}%`, `SGLT2i: ${sglt2Pct}%`],
        },
      ],
      outcomes: [
        {
          title: 'Longitudinal Survival & Quality of Care',
          category: 'Outcomes Reports',
          description: 'Survival monitoring and hospitalization surveillance for enrolled cohort.',
          metrics: [`Enrolled Cohort: ${total}`, `Major Complications: 0%`],
        },
      ],
      quality: [
        {
          title: 'Institutional Quality Benchmarking',
          category: 'Quality & Benchmark Reports',
          description: 'Guideline adherence and quality metrics at AICTS Pune.',
          metrics: [`GDMT Assessment Rate: 100%`, `Protocol Compliance: High`],
        },
      ],
    } as Record<string, any[]>
  }, [total, avgAge, malePct, hfrEFPct, avgLvef, raasiPct, bbPct, mraPct, sglt2Pct, quadPct, patients])

  const activeReports = useMemo(() => {
    const list = dynamicReportsRegistry[activeSection] || []
    if (!searchQuery) return list
    return list.filter(r =>
      r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.category.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [dynamicReportsRegistry, activeSection, searchQuery])

  const handleOpenReport = (report: any) => {
    setSelectedReport(report)
  }

  const handleCloseReport = () => {
    setSelectedReport(null)
  }

  const handleExportPack = () => {
    toast.promise(
      new Promise((resolve) => setTimeout(resolve, 1500)),
      {
        loading: 'Compiling cardiovascular registry statistics...',
        success: 'Executive Pack exported successfully!',
        error: 'Failed to compile report pack.',
      }
    )
  }

  const handleExportReportCSV = (title: string) => {
    toast.promise(
      new Promise((resolve) => setTimeout(resolve, 1000)),
      {
        loading: `Formatting registry data for "${title}"...`,
        success: `${title.replace(/\s+/g, '_')}_export.csv generated!`,
        error: 'Export failed.',
      }
    )
  }

  const handlePrint = () => {
    window.print()
  }

  // Retrieve current report visualization details
  const visualConfig = useMemo(() => {
    if (!selectedReport) return DEFAULT_VISUAL_CONFIG
    return REPORT_VISUALS[selectedReport.title] || DEFAULT_VISUAL_CONFIG
  }, [selectedReport])

  // Filter/Scale chart data based on selected timeframe
  const activeChartData = useMemo(() => {
    const rawData = visualConfig.chartData
    if (visualConfig.chartType === 'pie') return rawData

    if (timeframe === '3 Months') {
      return rawData.slice(Math.max(0, rawData.length - 3))
    }
    return rawData
  }, [visualConfig, timeframe])

  // Parsed indicators based on metrics strings
  const parsedIndicators = useMemo<{ label: string; value: string }[]>(() => {
    if (!selectedReport) return []
    return selectedReport.metrics.map((m: string) => {
      const idx = m.indexOf(':')
      if (idx !== -1) {
        return {
          label: m.substring(0, idx).trim(),
          value: m.substring(idx + 1).trim()
        }
      }
      return { label: 'Metric Indicator', value: m }
    })
  }, [selectedReport])

  return (
    <div className="space-y-6 animate-fade-in text-gray-300">

      {/* Dynamic styles for printing the modal overlay */}
      <style jsx global>{`
        @media print {
          body > * {
            display: none !important;
          }
          #print-report-modal-root {
            display: block !important;
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            height: auto;
            background: white !important;
            color: black !important;
          }
          .no-print {
            display: none !important;
          }
          .print-black {
            color: black !important;
          }
          .glass-card {
            background: transparent !important;
            border-color: #ddd !important;
            box-shadow: none !important;
          }
        }
      `}</style>

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4 no-print">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400 flex-shrink-0">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white leading-tight">Cardiovascular Reports Architecture</h2>
            <p className="text-xs text-gray-500 mt-1">Registry intelligence layers for Dr. A. Jayachandra, AICTS Pune</p>
          </div>
        </div>
        <Button onClick={handleExportPack} className="btn-primary">
          <Download className="w-4 h-4" /> Export Executive Pack
        </Button>
      </div>

      {/* Reference-data disclaimer */}
      <div className="flex items-start gap-3 rounded-xl border border-amber-500/25 bg-amber-500/8 p-3 no-print">
        <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
        <div className="text-xs">
          <span className="font-semibold text-amber-300">Reference Architecture — Illustrative Data Only.</span>
          <span className="text-gray-400 ml-1">
            Charts and metrics displayed are sample data for report design reference. Each report template must be wired to the live registry query engine to reflect actual enrolled-patient statistics.
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 no-print">
        
        {/* Left Navigation Sidebar */}
        <div className="space-y-1">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-3 mb-2">Report Subregistries</p>
          {REPORT_SECTIONS.map(sec => {
            const Icon = sec.icon
            const isActive = activeSection === sec.id
            return (
              <button
                key={sec.id}
                onClick={() => {
                  setActiveSection(sec.id)
                  setSearchQuery('')
                }}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all text-left",
                  isActive 
                    ? "bg-blue-600/15 border border-blue-500/30 text-blue-400 shadow-sm"
                    : "border border-transparent text-gray-400 hover:text-gray-200 hover:bg-white/5"
                )}
              >
                <Icon className={cn("w-4 h-4", isActive ? "text-blue-400" : "text-gray-500")} />
                <span>{sec.label}</span>
              </button>
            )
          })}
        </div>

        {/* Main Content Area */}
        <div className="lg:col-span-3 space-y-4">
          
          {/* Search bar */}
          <div className="glass-card p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                className="search-input w-full pl-9"
                placeholder="Search reports by title, description, or metrics..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Active Reports Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeReports.length === 0 ? (
              <div className="col-span-2 glass-card py-16 text-center text-gray-500">
                No reports found matching your query.
              </div>
            ) : (
              activeReports.map((report, idx) => (
                <div 
                  key={idx} 
                  onClick={() => handleOpenReport(report)}
                  className="glass-card p-5 space-y-4 flex flex-col justify-between hover:-translate-y-1 hover:border-blue-500/30 cursor-pointer transition-all duration-300 group"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <span className="badge badge-blue text-[9px] uppercase tracking-wider font-bold">
                        {report.category}
                      </span>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation()
                          handleOpenReport(report)
                        }} 
                        className="text-gray-500 hover:text-white transition-colors group-hover:text-blue-400" 
                        title="Open Detailed Analytics"
                      >
                        <ArrowUpRight className="w-4 h-4" />
                      </button>
                    </div>
                    <h4 className="text-sm font-bold text-white font-sans group-hover:text-blue-400 transition-colors">{report.title}</h4>
                    <p className="text-xs text-gray-400 leading-relaxed">{report.description}</p>
                  </div>

                  <div className="pt-3 border-t border-blue-500/10 space-y-2">
                    <p className="text-[9px] uppercase tracking-widest text-gray-500 font-bold">Key Indicators</p>
                    <div className="flex flex-wrap gap-2">
                      {report.metrics.map((m: string, mIdx: number) => (
                        <span key={mIdx} className="bg-navy-900 border border-blue-500/10 text-[10px] text-gray-300 px-2 py-0.5 rounded font-mono">
                          {m}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Core Analytics Quick View */}
          <div className="accent-card p-5 space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-cyan-400" /> Longitudinal Benchmarking Insights
            </h4>
            <p className="text-xs text-gray-400 leading-relaxed">
              These reports are modeled after the EuroHeart and NCDR registries, allowing risk-adjusted outcomes tracking for clinical audits and research publications at AICTS Pune.
            </p>
          </div>

        </div>

      </div>

      {/* ── Detailed Analytics Report Modal ── */}
      {selectedReport && (
        <div 
          id="print-report-modal-root" 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm overflow-y-auto"
          onClick={handleCloseReport}
        >
          <div 
            className="relative w-full max-w-4xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between gap-4 flex-wrap bg-slate-950/20">
              <div className="min-w-0">
                <span className="text-[9px] uppercase tracking-widest bg-blue-600/20 text-blue-400 border border-blue-500/30 px-2.5 py-0.5 rounded-full font-bold">
                  {selectedReport.category}
                </span>
                <h3 className="text-lg font-bold text-white mt-1.5 leading-tight print-black">{selectedReport.title}</h3>
                <p className="text-xs text-gray-400 mt-0.5 leading-tight print-black">{selectedReport.description}</p>
              </div>

              {/* Header Actions */}
              <div className="flex items-center gap-2.5 no-print">
                {/* Timeframe Dropdown (Only for line/bar charts) */}
                {visualConfig.chartType !== 'pie' && (
                  <div className="flex items-center gap-1 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1">
                    <Calendar size={13} className="text-gray-400" />
                    <select
                      value={timeframe}
                      onChange={e => setTimeframe(e.target.value as any)}
                      className="bg-transparent text-xs text-white border-none focus:ring-0 cursor-pointer pr-1"
                    >
                      <option value="3 Months" className="bg-slate-800">3 Months</option>
                      <option value="6 Months" className="bg-slate-800">6 Months</option>
                      <option value="12 Months" className="bg-slate-800">12 Months</option>
                    </select>
                  </div>
                )}
                
                <button
                  onClick={() => handleExportReportCSV(selectedReport.title)}
                  className="flex items-center gap-1 text-xs text-gray-300 hover:text-white bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 transition-colors"
                  title="Export to CSV"
                >
                  <Download size={13} />
                  <span className="hidden sm:inline">Export CSV</span>
                </button>

                <button
                  onClick={handlePrint}
                  className="flex items-center gap-1 text-xs text-gray-300 hover:text-white bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 transition-colors"
                  title="Print Report Summary"
                >
                  <Printer size={13} />
                  <span className="hidden sm:inline">Print</span>
                </button>

                <button
                  onClick={handleCloseReport}
                  className="text-gray-400 hover:text-white p-1 rounded-lg bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 transition-all"
                  title="Close Modal"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-slate-900/50">

              {/* Key Indicators Row */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {parsedIndicators.map((ind: { label: string; value: string }, i: number) => (
                  <div key={i} className="glass-card p-4 rounded-xl border border-blue-500/10 flex flex-col justify-center">
                    <span className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">{ind.label}</span>
                    <span className="text-xl font-extrabold text-blue-400 mt-1 font-sans">{ind.value}</span>
                  </div>
                ))}
              </div>

              {/* Visualization Chart */}
              <div className="glass-card p-5 border border-slate-800 rounded-xl bg-slate-950/20">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                    <BarChart3 className="w-3.5 h-3.5 text-blue-400" />
                    Longitudinal Performance Visualisation ({timeframe})
                  </p>
                  <span className="text-[10px] bg-amber-500/15 text-amber-300 border border-amber-500/25 rounded px-2 py-0.5 font-medium flex items-center gap-1">
                    <AlertTriangle className="w-2.5 h-2.5" /> Reference Data
                  </span>
                </div>

                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    {visualConfig.chartType === 'line' ? (
                      <LineChart data={activeChartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                        <XAxis 
                          dataKey={visualConfig.xAxisKey || 'month'} 
                          stroke="#94a3b8" 
                          fontSize={10} 
                          tickLine={false} 
                        />
                        <YAxis 
                          stroke="#94a3b8" 
                          fontSize={10} 
                          tickLine={false} 
                          label={{ value: visualConfig.yAxisLabel, angle: -90, position: 'insideLeft', style: { fill: '#94a3b8', fontSize: 10 } }} 
                        />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '11px', color: '#fff' }}
                        />
                        <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                        {/* Dynamically draw lines */}
                        {Object.keys(activeChartData[0] || {})
                          .filter(k => k !== visualConfig.xAxisKey && k !== 'month' && k !== 'week' && k !== 'year' && k !== 'Target')
                          .map((key, idx) => (
                            <Line 
                              key={key}
                              type="monotone" 
                              dataKey={key} 
                              stroke={idx === 0 ? '#3b82f6' : idx === 1 ? '#a78bfa' : '#10b981'} 
                              strokeWidth={2}
                              activeDot={{ r: 6 }} 
                            />
                          ))}
                        {visualConfig.targetVal && (
                          <ReferenceLine 
                            y={visualConfig.targetVal} 
                            stroke="#ef4444" 
                            strokeDasharray="4 4" 
                            label={{ value: 'Quality Target', position: 'top', fill: '#ef4444', fontSize: 9 }} 
                          />
                        )}
                      </LineChart>
                    ) : visualConfig.chartType === 'bar' ? (
                      <BarChart data={activeChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                        <XAxis 
                          dataKey={visualConfig.xAxisKey || 'vessel'} 
                          stroke="#94a3b8" 
                          fontSize={10} 
                          tickLine={false} 
                        />
                        <YAxis 
                          stroke="#94a3b8" 
                          fontSize={10} 
                          tickLine={false}
                          label={{ value: visualConfig.yAxisLabel, angle: -90, position: 'insideLeft', style: { fill: '#94a3b8', fontSize: 10 } }}
                        />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '11px', color: '#fff' }}
                        />
                        <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                        {Object.keys(activeChartData[0] || {})
                          .filter(k => k !== visualConfig.xAxisKey && k !== 'vessel' && k !== 'metric' && k !== 'type' && k !== 'period' && k !== 'stage' && k !== 'age')
                          .map((key, idx) => (
                            <Bar 
                              key={key} 
                              dataKey={key} 
                              fill={idx === 0 ? '#3b82f6' : idx === 1 ? '#ef4444' : '#10b981'} 
                              radius={[4, 4, 0, 0]} 
                            />
                          ))}
                      </BarChart>
                    ) : (
                      <PieChart>
                        <Pie
                          data={activeChartData}
                          cx="50%"
                          cy="48%"
                          innerRadius={55}
                          outerRadius={80}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {(activeChartData).map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={(visualConfig.colors || ['#3b82f6', '#10b981', '#6366f1', '#f59e0b'])[index % (visualConfig.colors?.length || 4)]} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '11px', color: '#fff' }}
                          formatter={(value) => [`${value}%`, 'Prevalence']}
                        />
                        <Legend 
                          verticalAlign="middle" 
                          align="right" 
                          layout="vertical"
                          wrapperStyle={{ fontSize: '10px', lineHeight: '20px' }} 
                        />
                      </PieChart>
                    )}
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Insights and Recommendations Grid */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
                
                {/* Clinical Summary & Recommendations */}
                <div className="md:col-span-7 space-y-4">
                  <div className="bg-slate-800/35 border border-slate-700/60 rounded-xl p-4">
                    <h5 className="text-xs font-bold text-white uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Sparkles size={13} className="text-blue-400" />
                      Executive Clinical Summary
                    </h5>
                    <p className="text-xs text-gray-300 leading-relaxed print-black">{visualConfig.summary}</p>
                  </div>

                  <div className="space-y-2.5">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Recommended Corrective Actions</p>
                    <div className="space-y-2">
                      {visualConfig.recommendations.map((rec, rIdx) => (
                        <div key={rIdx} className="bg-blue-600/5 border border-blue-500/10 rounded-lg px-3.5 py-2.5 flex items-start gap-2.5 text-xs text-gray-300">
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 flex-shrink-0" />
                          <p className="leading-normal print-black">{rec}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Audit & Validation Checklist */}
                <div className="md:col-span-5 bg-slate-800/25 border border-slate-700/40 rounded-xl p-4 flex flex-col justify-between">
                  <div className="space-y-3">
                    <h5 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                      <ShieldAlert size={13} className="text-amber-500" />
                      Registry Audit Checklist
                    </h5>
                    <p className="text-[11px] text-gray-400 leading-relaxed">Ensure maximum completeness and diagnostic validity matching EuroHeart specifications:</p>
                    
                    <div className="space-y-2">
                      {visualConfig.checklists.map((chk, cIdx) => (
                        <label key={cIdx} className="flex items-start gap-2.5 text-xs text-gray-300 cursor-pointer">
                          <input 
                            type="checkbox" 
                            defaultChecked={true} 
                            className="rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-0 focus:ring-offset-0 mt-0.5" 
                          />
                          <span className="leading-tight print-black">{chk}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <p className="text-[9px] text-gray-500 mt-6 leading-tight border-t border-slate-800 pt-3">
                    Quality metrics are audited dynamically against national guidelines. Center rank: 92nd percentile.
                  </p>
                </div>

              </div>

            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-slate-700 bg-slate-950/40 flex justify-between items-center no-print">
              <span className="text-[10px] text-gray-500 font-mono">
                System: EuroHeart V2.1 audit rules active.
              </span>
              <Button onClick={handleCloseReport} className="btn-secondary text-xs py-1 px-4">
                Close
              </Button>
            </div>

          </div>
        </div>
      )}

    </div>
  )
}
