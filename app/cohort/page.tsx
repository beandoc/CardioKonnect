'use client'
import { useState } from 'react'
import Link from 'next/link'
import {
  Heart, Layers, ShieldCheck, Activity, Compass,
  ChevronRight, ArrowUpRight, Flame, BarChart3, Database
} from 'lucide-react'
import Button from '@/components/ui/Button'
import { cn } from '@/lib/utils'

interface RegistryVariable {
  name: string
  fieldPath: string
  status: 'Production Active' | 'Specification Ready'
}

interface RegistryDetails {
  title: string
  subtitle: string
  icon: any
  inspiredBy: string[]
  level: string
  keyModules: string[]
  description: string
  cardioVars: RegistryVariable[]
  schemaStatus: 'Production Implemented' | 'Specification Ready' | 'Framework Architecture'
  linkHref?: string
}

export default function RegistryFrameworkPage() {
  const [activeTab, setActiveTab] = useState<'all' | 'level1' | 'level2'>('all')

  const registryArchitectures: RegistryDetails[] = [
    {
      title: 'Common Cardiovascular Dataset',
      subtitle: 'Core Registry Framework Entryway',
      icon: Database,
      inspiredBy: ['EuroHeart Data Standards', 'ICD-11'],
      level: 'Level 1: Common Core',
      schemaStatus: 'Production Implemented',
      description: 'The standardized common patient entry schema mapping basic demographics, risk factors, and vital signs before track allocation.',
      keyModules: ['Demographics & PII', 'Risk Factors & Lifestyle', 'Clinical History', 'Standard Labs', 'Baseline ECG & Echo'],
      linkHref: '/patients',
      cardioVars: [
        { name: 'Registry Patient ID', fieldPath: 'Patient.id / Patient.mrn', status: 'Production Active' },
        { name: 'Smoking / Tobacco Status', fieldPath: 'Patient.smokingStatus', status: 'Production Active' },
        { name: 'Hypertension & Dyslipidemia', fieldPath: 'Patient.comorbidHTN / comorbidDyslipidemia', status: 'Production Active' },
        { name: 'Baseline Hemodynamics', fieldPath: 'Visit.bpSystolic / Visit.heartRate', status: 'Production Active' }
      ]
    },
    {
      title: 'PCI & Cath Lab Registry',
      subtitle: 'NCDR CathPCI v5+ & CSI-NIC Interventional Module',
      icon: Activity,
      inspiredBy: ['NCDR CathPCI v5.0', 'BCIS (UK)', 'SCAAR (Sweden)', 'CSI/NIC India'],
      level: 'Level 2: Disease-Specific',
      schemaStatus: 'Production Implemented',
      description: 'Granular interventional logs capturing arterial access, DCGI device tracking, lesion-level hemodynamics, and audited complications.',
      keyModules: ['Vascular Access Profiling', 'ACC/AHA 16-Segment Anatomy', 'DCGI Hardware Tracking', 'BARC / ARC Complications Audit'],
      linkHref: '/registry-home/cathlab',
      cardioVars: [
        { name: 'Radial vs Femoral Route', fieldPath: 'CathProcedure.accessSite', status: 'Production Active' },
        { name: 'Stent Type & Lot Number', fieldPath: 'CathDevice.stentType / lotNumber', status: 'Production Active' },
        { name: 'TIMI Flow (Pre & Post)', fieldPath: 'CathLesion.preTimiFlow / postTimiFlow', status: 'Production Active' },
        { name: 'Physiology (FFR / iFR)', fieldPath: 'CathLesion.physiology.ffr / ifr', status: 'Production Active' },
        { name: 'Contrast Volume Utilized', fieldPath: 'CathProcedure.contrastVolumeMl', status: 'Production Active' },
        { name: 'Radiation DAP (Gy·cm²)', fieldPath: 'CathProcedure.doseAreaProductGyCm2', status: 'Production Active' },
        { name: 'BARC Bleeding / Perforation', fieldPath: 'CathProcedure.complications', status: 'Production Active' }
      ]
    },
    {
      title: 'Acute Coronary Syndrome Registry',
      subtitle: 'ACS Emergency Outcomes & Reperfusion Registry',
      icon: Flame,
      inspiredBy: ['Chest Pain-MI Registry', 'RIKS-HIA (SWEDEHEART)', 'ESC Guidelines'],
      level: 'Level 2: Disease-Specific',
      schemaStatus: 'Production Implemented',
      description: 'Tracks emergency timekeepers, Door-to-Balloon compliance, discharge dual antiplatelet therapy, and longitudinal MACE.',
      keyModules: ['Emergency Transfer Metrics', 'Reperfusion Strategies', 'Killip Class Stratification', 'Dual Antiplatelet Adherence'],
      linkHref: '/registry-home/acs',
      cardioVars: [
        { name: 'Door-to-Balloon Time', fieldPath: 'CathProcedure.stemiTimelines.dtbMinutes', status: 'Production Active' },
        { name: 'Door-to-ECG Duration', fieldPath: 'CathProcedure.stemiTimelines.ecgAcquisition', status: 'Production Active' },
        { name: 'DAPT (Aspirin + P2Y12)', fieldPath: 'Visit.aspirin & Visit.p2y12Inhibitor', status: 'Production Active' },
        { name: 'In-Hospital Mortality', fieldPath: 'CathProcedure.dischargeStatus', status: 'Production Active' }
      ]
    },
    {
      title: 'Coronary Artery Disease Registry',
      subtitle: 'CAD Anatomy & Extent Subregistry',
      icon: Heart,
      inspiredBy: ['CathPCI Registry', 'EuroHeart ACS', 'SYNTAX Trial Standards'],
      level: 'Level 2: Disease-Specific',
      schemaStatus: 'Production Implemented',
      description: 'Tracks coronary anatomic burden from stable angina to multivessel ischemia, mapping stenosis and bifurcation anatomy.',
      keyModules: ['SYNTAX Score Distribution', 'Left Main Disease Protocol', 'Bifurcation Medina Classification', 'CTO J-CTO Score'],
      linkHref: '/registry-home/cathlab',
      cardioVars: [
        { name: 'SYNTAX Score', fieldPath: 'Visit.coronaryAnatomy.syntaxScore', status: 'Production Active' },
        { name: 'Vessel Stenosis % (LM/LAD/LCx/RCA)', fieldPath: 'Visit.coronaryAnatomy.*Stenosis', status: 'Production Active' },
        { name: '16-Segment Lesion Mapping', fieldPath: 'CathLesion.segmentId', status: 'Production Active' },
        { name: 'Medina Bifurcation Score', fieldPath: 'CathLesion.bifurcationMedina', status: 'Production Active' }
      ]
    },
    {
      title: 'Heart Failure Registry',
      subtitle: 'Congestive Heart Failure Outcomes Tracking',
      icon: Layers,
      inspiredBy: ['EuroHeart HF', 'GWTG-HF', 'AICTS Clinical Trial Standards'],
      level: 'Level 2: Disease-Specific',
      schemaStatus: 'Production Implemented',
      description: 'Captures phenotype definitions, guideline-directed therapy (GDMT 4 pillars), and longitudinal hospitalization surveillance.',
      keyModules: ['HF Phenotyping (HFrEF/HFpEF/HFmrEF)', 'NYHA Functional Classification', 'Biomarker Trends (NT-proBNP)', 'GDMT Target Achievement'],
      linkHref: '/registry-home/hf',
      cardioVars: [
        { name: 'LVEF Trajectory', fieldPath: 'Visit.lvef', status: 'Production Active' },
        { name: 'NYHA Functional Class', fieldPath: 'Visit.nyha', status: 'Production Active' },
        { name: 'GDMT 4-Pillar Compliance', fieldPath: 'Visit.raasi, betaBlocker, mra, sglt2i', status: 'Production Active' },
        { name: 'KCCQ-12 Summary Score', fieldPath: 'Visit.kccq', status: 'Production Active' }
      ]
    },
    {
      title: 'Atrial Fibrillation Registry',
      subtitle: 'Arrhythmia & Electrophysiology Subregistry',
      icon: Compass,
      inspiredBy: ['AFib Ablation Registry', 'EuroHeart AF Registry'],
      level: 'Level 2: Disease-Specific',
      schemaStatus: 'Specification Ready',
      description: 'Tracks patients with rhythm disorders, ablation follow-up data, and stroke prevention parameters.',
      keyModules: ['AF Type (Paroxysmal/Persistent)', 'CHA₂DS₂-VASc Risk Calc', 'HAS-BLED Score', 'Rhythm Control vs Rate Control'],
      cardioVars: [
        { name: 'AF Comorbidity', fieldPath: 'Patient.comorbidAF', status: 'Production Active' },
        { name: 'Oral Anticoagulation (OAC)', fieldPath: 'Visit.noac / Visit.vki', status: 'Production Active' },
        { name: 'Ablation Success Rate', fieldPath: 'RegistrySpecification.afAblation', status: 'Specification Ready' }
      ]
    },
    {
      title: 'Cardiac Device Registry',
      subtitle: 'Electrophysiology Implants Database',
      icon: ShieldCheck,
      inspiredBy: ['NCDR ICD Registry', 'HRS Guidelines'],
      level: 'Level 2: Disease-Specific',
      schemaStatus: 'Specification Ready',
      description: 'Keeps longitudinal active performance logs for pacemakers, implantable defibrillators, and resynchronization therapies.',
      keyModules: ['Device Models & Manufacturers', 'Leads Placement Profiles', 'Battery Longevity Metrics', 'Device Interrogations & Telemetry'],
      cardioVars: [
        { name: 'Implanted Device Types', fieldPath: 'Visit.device (ICD, CRT-D, PPM)', status: 'Production Active' },
        { name: 'Lead Impedance & Thresholds', fieldPath: 'RegistrySpecification.leadImpedance', status: 'Specification Ready' }
      ]
    },
    {
      title: 'Structural Heart Disease Registry',
      subtitle: 'Valvular & Structural Interventions Tracker',
      icon: Layers,
      inspiredBy: ['STS/ACC TVT Registry'],
      level: 'Level 2: Disease-Specific',
      schemaStatus: 'Specification Ready',
      description: 'Tracks percutaneous and surgical structural therapies, valve replacement parameters, and procedural success.',
      keyModules: ['TAVR Module', 'Mitral TEER Track', 'TMVR / Tricuspid Protocol', 'Valve Durability & Leak Metrics'],
      cardioVars: [
        { name: 'Diastolic Dysfunction / Valve Severity', fieldPath: 'Visit.ddGrade / Visit.rvsp', status: 'Production Active' },
        { name: 'TAVR Valve Orifice Area', fieldPath: 'RegistrySpecification.tavrEOA', status: 'Specification Ready' }
      ]
    },
    {
      title: 'Cardiac Rehabilitation Registry',
      subtitle: 'Rehabilitative & Preventive Tracker',
      icon: Activity,
      inspiredBy: ['SEPHIA', 'SWEDEHEART-CR'],
      level: 'Level 2: Disease-Specific',
      schemaStatus: 'Specification Ready',
      description: 'Tracks outpatient physical rehab, functional capacity optimization, lifestyle control, and secondary prevention goals.',
      keyModules: ['Exercise Capacity Diagnostics', 'Smoking Cessation Milestones', 'Lipid/BP Target controls', 'Quality of Life Scores (KCCQ)'],
      cardioVars: [
        { name: '6-Minute Walk Test Distance (m)', fieldPath: 'Visit.sixMWT', status: 'Production Active' },
        { name: 'Handgrip Dynamometry (kg)', fieldPath: 'Visit.gripRight / Visit.gripLeft', status: 'Production Active' }
      ]
    }
  ]

  const filtered = registryArchitectures.filter(reg => {
    if (activeTab === 'level1') return reg.level.includes('Level 1')
    if (activeTab === 'level2') return reg.level.includes('Level 2')
    return true
  })

  return (
    <div className="space-y-6 animate-fade-in text-gray-300">
      
      {/* Header Banner */}
      <div className="accent-card p-6 flex flex-col md:flex-row items-center justify-between gap-6 border border-amber-500/20 bg-amber-950/10">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <Layers className="w-5 h-5 text-amber-400" />
            <h2 className="text-xl font-bold text-white">Registry Expansion Architecture</h2>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
              Roadmap — Not Implemented
            </span>
          </div>
          <p className="text-sm text-gray-400">
            Architectural specification roadmap for future cardiology subregistries inspired by NCDR, SWEDEHEART, and EuroHeart. These modules are not yet implemented for clinical data collection.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-blue-500/10 pb-3 gap-6 flex-wrap">
        <button
          onClick={() => setActiveTab('all')}
          className={cn("text-xs font-semibold pb-2 border-b-2 px-1 transition-all",
            activeTab === 'all' ? "border-blue-500 text-white" : "border-transparent text-gray-400 hover:text-gray-200"
          )}
        >
          All Framework Layers
        </button>
        <button
          onClick={() => setActiveTab('level1')}
          className={cn("text-xs font-semibold pb-2 border-b-2 px-1 transition-all",
            activeTab === 'level1' ? "border-blue-500 text-white" : "border-transparent text-gray-400 hover:text-gray-200"
          )}
        >
          Level 1: Core Datasets
        </button>
        <button
          onClick={() => setActiveTab('level2')}
          className={cn("text-xs font-semibold pb-2 border-b-2 px-1 transition-all",
            activeTab === 'level2' ? "border-blue-500 text-white" : "border-transparent text-gray-400 hover:text-gray-200"
          )}
        >
          Level 2: Subregistries
        </button>
      </div>

      {/* Flagship Registry Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filtered.map((reg, index) => {
          const Icon = reg.icon
          return (
            <div key={index} className="glass-card p-5 space-y-4 border border-blue-500/10 hover:border-blue-500/25 transition-all flex flex-col justify-between">
              
              <div className="space-y-3">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/25 flex items-center justify-center text-blue-400">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-white text-sm">{reg.title}</h4>
                      <p className="text-[10px] text-gray-500">{reg.subtitle}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="badge badge-blue text-[9px] uppercase font-semibold">{reg.level}</span>
                    <span className={cn(
                      'text-[9px] px-2 py-0.5 rounded-full font-medium border',
                      reg.schemaStatus === 'Production Implemented' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                    )}>
                      {reg.schemaStatus}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-gray-400 leading-relaxed">{reg.description}</p>

                {/* Inspired By references */}
                <div className="flex flex-wrap gap-1.5 items-center pt-1">
                  <span className="text-[9px] text-gray-500 font-semibold uppercase tracking-wider">Benchmark Standards:</span>
                  {reg.inspiredBy.map((ref, idx) => (
                    <span key={idx} className="badge badge-gray text-[9px] font-mono">{ref}</span>
                  ))}
                </div>

                {/* Modules list */}
                <div className="pt-2 space-y-1">
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Key Modules & Phases</p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {reg.keyModules.map((m, idx) => (
                      <span key={idx} className="badge badge-violet text-[9px] font-medium">{m}</span>
                    ))}
                  </div>
                </div>

                {/* Captured variables with TypeScript schema mappings */}
                <div className="pt-2 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">MAPPED TYPESCRIPT SCHEMA VARIABLES</p>
                    <span className="text-[9px] text-gray-500 font-mono">lib/types.ts</span>
                  </div>
                  <div className="grid grid-cols-1 gap-1.5 pt-1">
                    {reg.cardioVars.map((v, idx) => (
                      <div key={idx} className="flex items-center justify-between gap-2 p-1.5 rounded-lg bg-gray-900/50 border border-white/[0.05] text-[10px]">
                        <span className="font-medium text-gray-300">{v.name}</span>
                        <code className="text-emerald-400 font-mono text-[9px] truncate max-w-[210px]">{v.fieldPath}</code>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-blue-500/5 flex items-center justify-between">
                {reg.linkHref ? (
                  <Link href={reg.linkHref}>
                    <Button variant="outline" size="sm" className="btn-sm flex items-center gap-1 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10">
                      Open Active Registry <ArrowUpRight className="w-3.5 h-3.5" />
                    </Button>
                  </Link>
                ) : <span className="text-[10px] text-gray-500">Subregistry Module</span>}
                <Link href="/registry">
                  <Button variant="outline" size="sm" className="btn-sm flex items-center gap-1">
                    Configure Fields <ArrowUpRight className="w-3.5 h-3.5" />
                  </Button>
                </Link>
              </div>

            </div>
          )
        })}
      </div>

    </div>
  )
}
