'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Heart, Activity, ShieldAlert, Award, FileText, CheckCircle,
  Layers, ShieldCheck, ArrowRight, Users, PlusCircle, ClipboardList,
  Calendar, Bell, Brain, TrendingUp, BarChart3, FlaskConical,
  Database, Stethoscope, Zap, Building2, Search, ArrowUpRight,
  Sparkles, Shield
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAppUser } from '@/context/AppUserContext'
import { getPatients, getAllCathProcedures, getAllLatestVisits, getResolvedAlertIds } from '@/lib/firestore'
import { filterPatientsByAccess } from '@/lib/accessControl'
import { complicationFlags } from '@/lib/complications'
import { SITES } from '@/lib/appConfig'

interface ClinicalDomain {
  id: string
  title: string
  icon: any
  category: 'clinical' | 'imaging' | 'pci' | 'followup' | 'consent'
  description: string
  primaryAction: {
    label: string
    href: string
  }
  secondaryAction?: {
    label: string
    href: string
  }
  items: string[]
}

export default function ClinicalOverviewPage() {
  const { currentUser } = useAppUser()
  const [activeTab, setActiveTab] = useState<'all' | 'clinical' | 'imaging' | 'pci' | 'followup' | 'consent'>('all')
  const [patientCount, setPatientCount] = useState<number>(0)
  const [procedureCount, setProcedureCount] = useState<number>(0)
  const [openAlertsCount, setOpenAlertsCount] = useState<number>(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadStats() {
      try {
        const [allPts, allProcs, latestVisitMap, resolvedIds] = await Promise.all([
          getPatients(),
          getAllCathProcedures(),
          getAllLatestVisits(),
          getResolvedAlertIds(),
        ])

        const accessiblePts = filterPatientsByAccess(currentUser, allPts)
        const accessibleIds = new Set(accessiblePts.map(p => p.id))
        const accessibleProcs = allProcs.filter(p => p.patientId && accessibleIds.has(p.patientId))

        setPatientCount(accessiblePts.length)
        setProcedureCount(accessibleProcs.length)

        // Compute open alerts count
        const dynamicAlerts: string[] = []
        accessiblePts.forEach(p => {
          const v = latestVisitMap.get(p.id)
          if (v) {
            if (v.ntProBNP && v.ntProBNP > 2000) dynamicAlerts.push(`ntprobnp-${p.id}-${v.id}`)
            if (v.egfr && v.egfr < 45) dynamicAlerts.push(`egfr-${p.id}-${v.id}`)
            if (v.potassium && (v.potassium > 5.5 || v.potassium < 3.5)) dynamicAlerts.push(`potassium-${p.id}-${v.id}`)
          }
        })
        accessibleProcs.forEach(pr => {
          if (complicationFlags(pr).hasComplication) dynamicAlerts.push(`proc-comp-${pr.id}`)
        })

        const activeAlerts = dynamicAlerts.filter(id => !resolvedIds.has(id)).length
        setOpenAlertsCount(activeAlerts)
      } catch (err) {
        console.error('Failed to load clinical overview stats:', err)
      } finally {
        setLoading(false)
      }
    }

    loadStats()
  }, [currentUser])

  const activeSiteName = currentUser?.siteId && SITES[currentUser.siteId]
    ? SITES[currentUser.siteId].name
    : 'AICTS, Pune'

  const clinicalDomains: ClinicalDomain[] = [
    {
      id: 'demographics',
      title: 'Patient Demographics & Enrollment',
      icon: Users,
      category: 'clinical',
      description: 'Master patient identity, hospital ID (HID/MRN), age, sex, and multi-registry enrollment status.',
      primaryAction: { label: 'Patient Directory', href: '/patients' },
      secondaryAction: { label: 'Add Patient', href: '/patients/new' },
      items: [
        'Unique Hospital Identification Number (HID/MRN)',
        'Referring Physician & Primary Investigator (PI)',
        'Registry Serial Number & Enrollment Date',
        'Hospital Center & Emergency Contact Info'
      ]
    },
    {
      id: 'clinical_dx',
      title: 'Heart Failure & Clinical Assessment',
      icon: Heart,
      category: 'clinical',
      description: 'HFrEF, HFmrEF, and HFpEF classifications, NYHA functional class, and underlying etiology.',
      primaryAction: { label: 'HF Registry Dashboard', href: '/registry-home/hf' },
      secondaryAction: { label: 'Population Analytics', href: '/analytics' },
      items: [
        'NYHA Class I–IV Functional Assessment',
        'Heart Failure Phenotype (HFrEF / HFmrEF / HFpEF)',
        'Ischemic vs Non-Ischemic Cardiomyopathy Etiologies',
        'Prior HF Hospitalizations & Decompensation History'
      ]
    },
    {
      id: 'risk_factors',
      title: 'Cardiovascular Risk Stratification',
      icon: Activity,
      category: 'clinical',
      description: 'Standardized clinical risk engines: MAGGIC, ACC/AHA ASCVD, and PREDICT-HF calculators.',
      primaryAction: { label: 'Open Risk Calculators', href: '/risk' },
      secondaryAction: { label: 'Cohort Builder', href: '/cohort' },
      items: [
        'Hypertension, Type 2 Diabetes & Dyslipidemia',
        'Tobacco Pack-Years & Social Substance History',
        'Chronic Kidney Disease (CKD) Stages',
        'Clinical Frailty Scale (CFS) & 6-Minute Walk'
      ]
    },
    {
      id: 'hemodynamics',
      title: 'Vital Signs & Bedside Hemodynamics',
      icon: Stethoscope,
      category: 'clinical',
      description: 'Bedside hemodynamics, blood pressure, heart rate, oxygenation, and fluid overload signs.',
      primaryAction: { label: 'DEO Entry Desk', href: '/deo' },
      secondaryAction: { label: 'AI Triage', href: '/triage' },
      items: [
        'Resting Blood Pressure & Mean Arterial Pressure (MAP)',
        'Heart Rate & Clinical Cardiac Rhythm',
        'Peripheral Edema (None / Mild / Moderate / Severe)',
        'Oxygen Saturation (SpO₂) & Respiratory Rate'
      ]
    },
    {
      id: 'ecg_rhythm',
      title: 'ECG & Arrhythmia Surveillance',
      icon: Zap,
      category: 'imaging',
      description: 'QRS duration, bundle branch blocks (LBBB/RBBB), and Atrial Fibrillation monitoring.',
      primaryAction: { label: 'Clinical Alerts', href: '/alerts' },
      secondaryAction: { label: 'EP Registry', href: '/registry-home/arrhythmia' },
      items: [
        'QRS Duration (ms) & CRT Screening Thresholds',
        'LBBB / RBBB Conduction Abnormalities',
        'Atrial Fibrillation / Flutter Documentation',
        'Anticoagulation (OAC/NOAC/VKI) Coverage'
      ]
    },
    {
      id: 'laboratory',
      title: 'Laboratory Biomarkers & Organ Function',
      icon: FlaskConical,
      category: 'clinical',
      description: 'Core biomarkers: NT-proBNP, Serum Creatinine, eGFR (CKD-EPI 2021), Electrolytes, and Ferritin.',
      primaryAction: { label: 'View Patients', href: '/patients' },
      secondaryAction: { label: 'AI Clinical Insights', href: '/insights' },
      items: [
        'NT-proBNP & BNP Decompensation Thresholds',
        'eGFR & Serum Creatinine Serial Tracking',
        'Serum Potassium (K+) & Sodium (Na+)',
        'Serum Ferritin & Iron Deficiency Screening'
      ]
    },
    {
      id: 'imaging',
      title: 'Echocardiography & Cardiac Imaging',
      icon: EyeIcon,
      category: 'imaging',
      description: 'Left Ventricular Ejection Fraction (LVEF), structural valve lesions, and chamber dimensions.',
      primaryAction: { label: 'Structural Registry', href: '/registry-home/structural' },
      secondaryAction: { label: 'Registry Fields', href: '/registry' },
      items: [
        'Quantitative LVEF% (Biplane Simpson / 3D Echo)',
        'LVDD & LVSD Chamber Dimensions (mm)',
        'Diastolic Dysfunction Grading & RVSP',
        'Regional Wall Motion Abnormalities (RWMA)'
      ]
    },
    {
      id: 'cathlab',
      title: 'Cath Lab & Interventional Procedures',
      icon: ClipboardList,
      category: 'pci',
      description: 'Coronary angiography, radial-first vascular access, PCI stent records, and TIMI flow restoration.',
      primaryAction: { label: 'Procedural Audit', href: '/procedures' },
      secondaryAction: { label: 'Cath Lab Portal', href: '/registry-home/cathlab' },
      items: [
        'Transradial vs Transfemoral Vascular Access',
        'Coronary Lesion Segments & AHA/ACC Class',
        'Pre & Post-PCI TIMI Flow Grades',
        'Drug-Eluting Stents (DES) Diameter & Length'
      ]
    },
    {
      id: 'complications',
      title: 'Procedural Safety & Complications',
      icon: ShieldAlert,
      category: 'pci',
      description: 'Surveillance of acute stent thrombosis, coronary perforation, major bleeding, and MACE.',
      primaryAction: { label: 'Complication Audit', href: '/complication-audit' },
      secondaryAction: { label: 'Open Alerts', href: '/alerts' },
      items: [
        'In-Lab Mortality & Resuscitation Events',
        'Coronary Dissection & Perforation Audits',
        'BARC Classified Major Bleeding Incidents',
        'Emergency CABG & Bailout Interventions'
      ]
    },
    {
      id: 'gdmt',
      title: 'GDMT 4-Pillar Pharmacotherapy',
      icon: Heart,
      category: 'clinical',
      description: 'Guideline-directed medical therapy adherence: RAASi/ARNI, Beta-blocker, MRA, and SGLT2i.',
      primaryAction: { label: 'Live Analytics', href: '/analytics-dashboard' },
      secondaryAction: { label: 'AI Engine', href: '/ai-engine' },
      items: [
        'RAASi / ARNI (Sacubitril/Valsartan) Optimization',
        'Evidence-Based Beta-Blocker Titration',
        'Mineralocorticoid Receptor Antagonists (MRA)',
        'SGLT2 Inhibitor (Dapagliflozin/Empagliflozin)'
      ]
    },
    {
      id: 'devices',
      title: 'Cardiac Implantable Electronic Devices',
      icon: Zap,
      category: 'pci',
      description: 'Tracking CRT-D, CRT-P, ICD, and pacemaker indications, implantation dates, and battery life.',
      primaryAction: { label: 'Research Board', href: '/research-board' },
      secondaryAction: { label: 'Registry Fields', href: '/registry' },
      items: [
        'CRT-D / CRT-P Resynchronization Systems',
        'ICD Primary vs Secondary Prevention Indications',
        'Biventricular Pacing Percentage (>95% Goal)',
        'Lead Profiles, Sensing & Defibrillation Checks'
      ]
    },
    {
      id: 'consent',
      title: 'Regulatory Consent & Compliance',
      icon: ShieldCheck,
      category: 'consent',
      description: 'Ethical committee informed consent tracking, research authorization, and data governance.',
      primaryAction: { label: 'Appointments & Consents', href: '/appointments' },
      secondaryAction: { label: 'Audit Logs', href: '/log-categories' },
      items: [
        'Informed Consent Status (Granted / Pending / Declined)',
        'Multi-Center Research Authorization',
        'Cross-Institutional Tenant Privacy Isolation',
        'HIPAA / Indian Digital Health Data Compliance'
      ]
    }
  ]

  const filteredDomains = clinicalDomains.filter(
    domain => activeTab === 'all' || domain.category === activeTab
  )

  return (
    <div className="space-y-6 animate-fade-in text-gray-300 pb-12">
      
      {/* ── 1. Top Executive Navigation Banner ── */}
      <div className="glass-card p-6 rounded-2xl border border-blue-500/20 relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, rgba(15, 26, 61, 0.85) 0%, rgba(7, 14, 27, 0.95) 100%)',
          boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.5)'
        }}>
        <div className="absolute top-0 right-0 w-96 h-96 rounded-full pointer-events-none opacity-15 filter blur-[100px]"
          style={{ background: 'radial-gradient(circle, #3b82f6 0%, #8b5cf6 100%)' }} />

        <div className="relative flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white flex-shrink-0 shadow-lg shadow-blue-500/20"
              style={{ background: 'linear-gradient(135deg, #2563eb, #7c3aed)' }}>
              <Building2 className="w-7 h-7 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-xs uppercase tracking-wider font-semibold text-blue-400 bg-blue-500/10 px-2.5 py-0.5 rounded-full border border-blue-500/20">
                  Information Architecture
                </span>
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  <Shield className="w-3.5 h-3.5 text-emerald-400" />
                  {activeSiteName}
                </span>
              </div>
              <h1 className="text-2xl font-bold text-white tracking-tight">
                CardioKonnect Clinical Overview & Command Center
              </h1>
              <p className="text-xs text-gray-400 max-w-3xl mt-1">
                Central navigation architecture connecting multicenter cardiovascular research registries, procedural audits, clinical decision engines, and patient records.
              </p>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="flex items-center gap-3 w-full lg:w-auto">
            <Link href="/patients" className="flex-1 lg:flex-initial">
              <div className="px-4 py-3 rounded-xl bg-blue-950/40 border border-blue-500/20 hover:border-blue-500/50 transition cursor-pointer text-center min-w-[110px]">
                <p className="text-[10px] text-gray-400 uppercase font-semibold">Patients</p>
                <p className="text-xl font-bold text-white font-mono">{loading ? '—' : patientCount}</p>
              </div>
            </Link>

            <Link href="/procedures" className="flex-1 lg:flex-initial">
              <div className="px-4 py-3 rounded-xl bg-amber-950/30 border border-amber-500/20 hover:border-amber-500/50 transition cursor-pointer text-center min-w-[110px]">
                <p className="text-[10px] text-gray-400 uppercase font-semibold">Procedures</p>
                <p className="text-xl font-bold text-amber-300 font-mono">{loading ? '—' : procedureCount}</p>
              </div>
            </Link>

            <Link href="/alerts" className="flex-1 lg:flex-initial">
              <div className="px-4 py-3 rounded-xl bg-rose-950/30 border border-rose-500/20 hover:border-rose-500/50 transition cursor-pointer text-center min-w-[110px]">
                <p className="text-[10px] text-gray-400 uppercase font-semibold">Active Alerts</p>
                <p className="text-xl font-bold text-rose-300 font-mono">{loading ? '—' : openAlertsCount}</p>
              </div>
            </Link>
          </div>
        </div>
      </div>

      {/* ── 2. Primary Clinical Launchpad (Quick Action Workspaces) ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs uppercase tracking-wider font-bold text-gray-400 flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" /> Core Clinical Workspaces & Quick Launchpad
          </h2>
          <span className="text-[11px] text-gray-400">Direct navigation to active portals</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link href="/patients" className="block group">
            <div className="glass-card p-4 rounded-xl border border-blue-500/20 hover:border-blue-500/60 transition group-hover:bg-blue-900/10">
              <div className="flex items-center justify-between mb-2">
                <div className="w-9 h-9 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400">
                  <Users className="w-5 h-5" />
                </div>
                <ArrowUpRight className="w-4 h-4 text-gray-400 group-hover:text-blue-300 transition" />
              </div>
              <h3 className="text-sm font-bold text-white group-hover:text-blue-300 transition">Patient Database</h3>
              <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">Search, filter, and review longitudinal patient clinical profiles and visit histories.</p>
            </div>
          </Link>

          <Link href="/deo" className="block group">
            <div className="glass-card p-4 rounded-xl border border-indigo-500/20 hover:border-indigo-500/60 transition group-hover:bg-indigo-900/10">
              <div className="flex items-center justify-between mb-2">
                <div className="w-9 h-9 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                  <ClipboardList className="w-5 h-5" />
                </div>
                <ArrowUpRight className="w-4 h-4 text-gray-400 group-hover:text-indigo-300 transition" />
              </div>
              <h3 className="text-sm font-bold text-white group-hover:text-indigo-300 transition">DEO Entry Desk</h3>
              <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">High-throughput clinical data capture queue for hospital operators & trial coordinators.</p>
            </div>
          </Link>

          <Link href="/procedures" className="block group">
            <div className="glass-card p-4 rounded-xl border border-amber-500/20 hover:border-amber-500/60 transition group-hover:bg-amber-900/10">
              <div className="flex items-center justify-between mb-2">
                <div className="w-9 h-9 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-400">
                  <Stethoscope className="w-5 h-5" />
                </div>
                <ArrowUpRight className="w-4 h-4 text-gray-400 group-hover:text-amber-300 transition" />
              </div>
              <h3 className="text-sm font-bold text-white group-hover:text-amber-300 transition">Cath Lab Audit</h3>
              <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">Transradial access logs, coronary stent outcomes, lesion details, and TIMI 3 flow.</p>
            </div>
          </Link>

          <Link href="/alerts" className="block group">
            <div className="glass-card p-4 rounded-xl border border-rose-500/20 hover:border-rose-500/60 transition group-hover:bg-rose-900/10">
              <div className="flex items-center justify-between mb-2">
                <div className="w-9 h-9 rounded-lg bg-rose-500/20 flex items-center justify-center text-rose-400">
                  <Bell className="w-5 h-5" />
                </div>
                <div className="flex items-center gap-1.5">
                  {openAlertsCount > 0 && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/30 text-rose-300 font-bold">
                      {openAlertsCount} Open
                    </span>
                  )}
                  <ArrowUpRight className="w-4 h-4 text-gray-400 group-hover:text-rose-300 transition" />
                </div>
              </div>
              <h3 className="text-sm font-bold text-white group-hover:text-rose-300 transition">Clinical Safety Alerts</h3>
              <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">Automated warnings for NT-proBNP &gt;2000, eGFR decline, and post-PCI complications.</p>
            </div>
          </Link>
        </div>
      </div>

      {/* ── 3. Multicenter Cardiovascular Registries Hub ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs uppercase tracking-wider font-bold text-gray-400 flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-400" /> Active Research Registries
          </h2>
          <Link href="/registry-home" className="text-xs text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1">
            View All Registries <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Heart Failure Registry Card */}
          <div className="glass-card p-5 rounded-2xl border border-blue-500/20 hover:border-blue-500/40 transition">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
                  AICTS, Pune
                </span>
                <h3 className="text-base font-bold text-white mt-2">Heart Failure Registry (HF)</h3>
                <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                  Tracking HFrEF, HFmrEF, and HFpEF phenotypes, GDMT 4-pillar guideline adherence, biomarkers, and long-term rehospitalization outcomes.
                </p>
                <div className="flex items-center gap-3 text-xs text-gray-400 mt-3">
                  <span>PI: <strong className="text-white">Dr. A. Jayachandra</strong></span>
                  <span>·</span>
                  <span>Cohort: <strong className="text-white">63 Patients</strong></span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-800/60">
              <Link href="/" className="btn-primary text-xs px-3.5 py-2 rounded-xl flex items-center gap-1.5 font-semibold">
                Open HF Dashboard <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <Link href="/registry-home/hf" className="btn-ghost text-xs px-3 py-2 rounded-xl flex items-center gap-1.5 text-gray-400 hover:text-white">
                Detailed Analytics
              </Link>
            </div>
          </div>

          {/* Cath Lab & Interventional Registry Card */}
          <div className="glass-card p-5 rounded-2xl border border-amber-500/20 hover:border-amber-500/40 transition">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                  Apex Hospital, Kanpur
                </span>
                <h3 className="text-base font-bold text-white mt-2">Cath Lab & Interventional Registry</h3>
                <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                  Monitoring coronary angiography, transradial access, STEMI door-to-balloon timelines, intravascular imaging, and stent safety.
                </p>
                <div className="flex items-center gap-3 text-xs text-gray-400 mt-3">
                  <span>PI: <strong className="text-white">Dr. Rajeev Chauhan</strong></span>
                  <span>·</span>
                  <span>Procedures: <strong className="text-white">14 Interventions</strong></span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-800/60">
              <Link href="/registry-home/cathlab" className="btn-primary text-xs px-3.5 py-2 rounded-xl flex items-center gap-1.5 font-semibold bg-amber-600 hover:bg-amber-500 text-white">
                Open Cath Lab Portal <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <Link href="/procedures" className="btn-ghost text-xs px-3 py-2 rounded-xl flex items-center gap-1.5 text-gray-400 hover:text-white">
                Procedure Logbook
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ── 4. Clinical Data Architecture & Domain Matrix ── */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center justify-between pb-2 border-b border-blue-500/10 flex-wrap gap-4">
          <div>
            <h2 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2">
              <Database className="w-4 h-4 text-blue-400" /> Cardiovascular Data Architecture & Modules
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">Click into any domain to view records or enter patient clinical data</p>
          </div>

          {/* Filtering tabs */}
          <div className="flex gap-1.5 flex-wrap">
            <button onClick={() => setActiveTab('all')} className={cn("tab-btn btn-sm text-xs", activeTab === 'all' && 'active')}>All Domains</button>
            <button onClick={() => setActiveTab('clinical')} className={cn("tab-btn btn-sm text-xs", activeTab === 'clinical' && 'active')}>Clinical & Biomarkers</button>
            <button onClick={() => setActiveTab('imaging')} className={cn("tab-btn btn-sm text-xs", activeTab === 'imaging' && 'active')}>ECG & Echo Imaging</button>
            <button onClick={() => setActiveTab('pci')} className={cn("tab-btn btn-sm text-xs", activeTab === 'pci' && 'active')}>Cath Lab & Safety</button>
            <button onClick={() => setActiveTab('consent')} className={cn("tab-btn btn-sm text-xs", activeTab === 'consent' && 'active')}>Consent & Governance</button>
          </div>
        </div>

        {/* Data Field Cards Grid with Direct Interactive Navigation */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredDomains.map(domain => {
            const IconComponent = domain.icon
            return (
              <div key={domain.id} className="glass-card p-5 rounded-2xl border border-blue-500/15 hover:border-blue-500/40 transition-all flex flex-col justify-between group">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-9 h-9 rounded-xl bg-blue-500/15 flex items-center justify-center text-blue-400">
                      <IconComponent className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider bg-slate-900/60 px-2 py-0.5 rounded border border-gray-700/50">
                      {domain.category}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-white group-hover:text-blue-300 transition">
                    {domain.title}
                  </h3>
                  <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                    {domain.description}
                  </p>

                  <div className="mt-3.5 pt-3 border-t border-white/[0.06]">
                    <p className="text-[10px] uppercase font-bold tracking-wider text-gray-400 mb-2">Tracked Clinical Parameters:</p>
                    <ul className="space-y-1.5">
                      {domain.items.map((item, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-xs text-gray-300">
                          <CheckCircle className="w-3.5 h-3.5 text-blue-400/80 mt-0.5 flex-shrink-0" />
                          <span className="leading-tight">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Direct Action Navigation Footer */}
                <div className="mt-5 pt-3.5 border-t border-gray-800/80 flex items-center justify-between gap-2">
                  <Link href={domain.primaryAction.href} className="btn-primary text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-semibold">
                    {domain.primaryAction.label} <ArrowRight className="w-3 h-3" />
                  </Link>

                  {domain.secondaryAction && (
                    <Link href={domain.secondaryAction.href} className="text-xs text-gray-400 hover:text-white font-medium flex items-center gap-1">
                      {domain.secondaryAction.label}
                    </Link>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── 5. Analytics & Research Intelligence Hub ── */}
      <div className="p-6 rounded-2xl border border-purple-500/20 space-y-4"
        style={{ background: 'linear-gradient(135deg, rgba(30, 27, 75, 0.4) 0%, rgba(15, 23, 42, 0.6) 100%)' }}>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-400">
              <Brain className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Advanced Research & Clinical Intelligence Engines</h3>
              <p className="text-xs text-gray-400">AI prediction tools, risk scoring models, and population research cohorts</p>
            </div>
          </div>
          <Link href="/ai-engine" className="text-xs text-purple-300 hover:text-purple-200 font-semibold flex items-center gap-1">
            Open AI Engine <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-2">
          <Link href="/analytics" className="p-3 rounded-xl bg-slate-900/60 border border-blue-500/15 hover:border-blue-500/40 transition text-center block group">
            <BarChart3 className="w-5 h-5 text-blue-400 mx-auto mb-1.5 group-hover:scale-110 transition" />
            <p className="text-xs font-bold text-white">Population Analytics</p>
            <p className="text-[10px] text-gray-400 mt-0.5">Demographics & GDMT</p>
          </Link>

          <Link href="/risk" className="p-3 rounded-xl bg-slate-900/60 border border-emerald-500/15 hover:border-emerald-500/40 transition text-center block group">
            <Activity className="w-5 h-5 text-emerald-400 mx-auto mb-1.5 group-hover:scale-110 transition" />
            <p className="text-xs font-bold text-white">Risk Calculators</p>
            <p className="text-[10px] text-gray-400 mt-0.5">MAGGIC & ASCVD</p>
          </Link>

          <Link href="/cohort" className="p-3 rounded-xl bg-slate-900/60 border border-amber-500/15 hover:border-amber-500/40 transition text-center block group">
            <Layers className="w-5 h-5 text-amber-400 mx-auto mb-1.5 group-hover:scale-110 transition" />
            <p className="text-xs font-bold text-white">Cohort Builder</p>
            <p className="text-[10px] text-gray-400 mt-0.5">Custom Clinical Filters</p>
          </Link>

          <Link href="/insights" className="p-3 rounded-xl bg-slate-900/60 border border-indigo-500/15 hover:border-indigo-500/40 transition text-center block group">
            <TrendingUp className="w-5 h-5 text-indigo-400 mx-auto mb-1.5 group-hover:scale-110 transition" />
            <p className="text-xs font-bold text-white">AI Insights</p>
            <p className="text-[10px] text-gray-400 mt-0.5">Phenotype Clusters</p>
          </Link>

          <Link href="/research-board" className="p-3 rounded-xl bg-slate-900/60 border border-violet-500/15 hover:border-violet-500/40 transition text-center block group">
            <FlaskConical className="w-5 h-5 text-violet-400 mx-auto mb-1.5 group-hover:scale-110 transition" />
            <p className="text-xs font-bold text-white">Research Board</p>
            <p className="text-[10px] text-gray-400 mt-0.5">Trial Datasets</p>
          </Link>

          <Link href="/reports" className="p-3 rounded-xl bg-slate-900/60 border border-cyan-500/15 hover:border-cyan-500/40 transition text-center block group">
            <FileText className="w-5 h-5 text-cyan-400 mx-auto mb-1.5 group-hover:scale-110 transition" />
            <p className="text-xs font-bold text-white">Reports & Exports</p>
            <p className="text-[10px] text-gray-400 mt-0.5">CSV & Regulatory</p>
          </Link>
        </div>
      </div>

    </div>
  )
}

function EyeIcon(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}
