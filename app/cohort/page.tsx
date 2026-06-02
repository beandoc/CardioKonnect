'use client'
import { useState } from 'react'
import Link from 'next/link'
import {
  Heart, Layers, ShieldCheck, Activity, Compass,
  ChevronRight, ArrowUpRight, Flame, BarChart3, Database
} from 'lucide-react'
import Button from '@/components/ui/Button'
import { cn } from '@/lib/utils'

interface RegistryDetails {
  title: string
  subtitle: string
  icon: any
  inspiredBy: string[]
  level: string
  keyModules: string[]
  description: string
  cardioVars: string[]
}

export default function RegistryFrameworkPage() {
  const [activeTab, setActiveTab] = useState<'all' | 'level1' | 'level2'>('all')

  const registryArchitectures: RegistryDetails[] = [
    {
      title: 'Common Cardiovascular Dataset',
      subtitle: 'Core Registry Framework Entryway',
      icon: Database,
      inspiredBy: ['EuroHeart Data Standards'],
      level: 'Level 1: Common Core',
      description: 'The standardized common patient entry schema that maps basic parameters before allocating patients to specific tracks.',
      keyModules: ['Demographics & PII', 'Risk Factors & Lifestyle', 'Clinical History', 'Standard Labs', 'Baseline ECG & Echo'],
      cardioVars: ['Unique Registry ID', 'Smoking/Tobacco Status', 'Hypertension & Dyslipidemia', 'Baseline LVEF & BP']
    },
    {
      title: 'Coronary Artery Disease Registry',
      subtitle: 'CAD Subregistry Module',
      icon: Heart,
      inspiredBy: ['CathPCI Registry', 'EuroHeart ACS', 'SWEDEHEART ACS'],
      level: 'Level 2: Disease-Specific',
      description: 'Tracks CAD cohorts from stable angina to advanced ischemia, mapping details on coronary stenosis and outcomes.',
      keyModules: ['Stable CAD Track', 'Unstable Angina Module', 'NSTEMI Protocol', 'STEMI Fast-track'],
      cardioVars: ['SYNTAX Score', 'TIMI Flow Grade', 'Fractional Flow Reserve (FFR/iFR)', 'Left Main Disease %', 'MACE Outcomes']
    },
    {
      title: 'Acute Coronary Syndrome Registry',
      subtitle: 'ACS Emergency Outcomes Registry',
      icon: Flame,
      inspiredBy: ['Chest Pain-MI Registry', 'RIKS-HIA (SWEDEHEART)'],
      level: 'Level 2: Disease-Specific',
      description: 'Focuses on acute phase emergency metrics, quality benchmarking, and critical pathways performance indicators.',
      keyModules: ['Emergency Transfer Metrics', 'Reperfusion Strategies', 'Killip Class Stratification', 'Shock Management'],
      cardioVars: ['Door-to-ECG Time', 'Door-to-Balloon Time', 'FMC-to-PCI Duration', '30-Day Post-ACS Mortality']
    },
    {
      title: 'PCI & Cath Lab Registry',
      subtitle: 'Interventional Procedure Logs',
      icon: Activity,
      inspiredBy: ['NCDR CathPCI', 'SCAAR (Sweden)'],
      level: 'Level 2: Disease-Specific',
      description: 'Maintains granular logs of all invasive coronary diagnostic and therapeutic catheter lab interventions.',
      keyModules: ['Vessel Access Profiling', 'Stenting Characteristics', 'CTO & Calcification Track', 'Procedural Complications'],
      cardioVars: ['Radial vs Femoral Route', 'DES vs BMS Stents', 'Contrast Volume Utilized', 'Radiation Dose Area Product']
    },
    {
      title: 'Heart Failure Registry',
      subtitle: 'Congestive Heart Failure Outcomes Tracking',
      icon: Layers,
      inspiredBy: ['EuroHeart HF', 'GWTG-HF'],
      level: 'Level 2: Disease-Specific',
      description: 'Captures phenotype definitions, guideline-directed therapy (GDMT) metrics, and recurrent hospitalization indicators.',
      keyModules: ['HF Phenotyping (HFrEF/HFpEF/HFmrEF)', 'NYHA Functional Classification', 'Biomarker Trends (NT-proBNP)', 'GDMT Target Achievement'],
      cardioVars: ['E/e\' Ratio', 'LV Mass Index', 'Right Ventricular Free Wall Strain', 'LVEF Change Over Time']
    },
    {
      title: 'Atrial Fibrillation Registry',
      subtitle: 'Arrhythmia & Electrophysiology Subregistry',
      icon: Compass,
      inspiredBy: ['AFib Ablation Registry', 'EuroHeart AF Registry'],
      level: 'Level 2: Disease-Specific',
      description: 'Tracks patients with rhythm disorders, ablation follow-up data, and stroke prevention parameters.',
      keyModules: ['AF Type (Paroxysmal/Persistent)', 'CHA₂DS₂-VASc Risk Calc', 'HAS-BLED Score', 'Rhythm Control vs Rate Control'],
      cardioVars: ['Arrhythmia/AF Burden %', 'Oral Anticoagulation (OAC) Type', 'Ablation Success Rate']
    },
    {
      title: 'Cardiac Device Registry',
      subtitle: 'Electrophysiology Implants Database',
      icon: ShieldCheck,
      inspiredBy: ['ICD Registry', 'EP Device Registry'],
      level: 'Level 2: Disease-Specific',
      description: 'Keeps longitudinal active performance logs for pacemakers, implantable defibrillators, and resynchronization therapies.',
      keyModules: ['Device Models & Manufacturers', 'Leads Placement Profiles', 'Battery Longevity Metrics', 'Device Interrogations & Telemetry'],
      cardioVars: ['Lead Impedance & Thresholds', 'Appropriate/Inappropriate Shock Logs', 'Device Complications']
    },
    {
      title: 'Structural Heart Disease Registry',
      subtitle: 'Valvular & Structural Interventions Tracker',
      icon: Layers,
      inspiredBy: ['STS/ACC TVT Registry'],
      level: 'Level 2: Disease-Specific',
      description: 'Tracks percutaneous and surgical structural therapies, valve replacement parameters, and procedural success.',
      keyModules: ['TAVR Module', 'Mitral TEER Track', 'TMVR / Tricuspid Protocol', 'Valve Durability & Leak Metrics'],
      cardioVars: ['Valve Effective Orifice Area', 'Mean Transvalvular Gradient', 'Post-procedure Heart Block']
    },
    {
      title: 'Congenital Heart Disease Registry',
      subtitle: 'CHD Lifecycle Registry',
      icon: Heart,
      inspiredBy: ['IMPACT Registry'],
      level: 'Level 2: Disease-Specific',
      description: 'Tracks congenital anomalies from pediatric phase into adult congenital tracks with long-term survival.',
      keyModules: ['Congenital Lesion Types', 'Surgical Reconstruction History', 'Catheter Interventions', 'Transition to Adult CHD'],
      cardioVars: ['Lesion Anatomy Class', 'Palliative Surgical Milestones', 'Shunt Fraction Calculations']
    },
    {
      title: 'Cardiac Rehabilitation Registry',
      subtitle: 'Rehabilitative & Preventive Tracker',
      icon: Activity,
      inspiredBy: ['SEPHIA', 'SWEDEHEART-CR'],
      level: 'Level 2: Disease-Specific',
      description: 'Tracks outpatient physical rehab, functional capacity optimization, lifestyle control, and secondary prevention goals.',
      keyModules: ['Exercise Capacity Diagnostics', 'Smoking Cessation Milestones', 'Lipid/BP Target controls', 'Quality of Life Scores (KCCQ)'],
      cardioVars: ['6-Minute Walk Test Distance (m)', 'METs Achieved', 'Return to Work Timeline']
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
      <div className="accent-card p-6 flex flex-col md:flex-row items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Layers className="w-5 h-5 text-blue-400" />
            <h2 className="text-xl font-bold text-white">Registry Expansion Architecture</h2>
          </div>
          <p className="text-sm text-gray-400">
            A comprehensive mapping of expanding Cardiology Subregistries inspired by international benchmarks (NCDR, SWEDEHEART, and EuroHeart).
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
                  <span className="badge badge-blue text-[9px] uppercase font-semibold">{reg.level}</span>
                </div>

                <p className="text-xs text-gray-400 leading-relaxed">{reg.description}</p>

                {/* Inspired By references */}
                <div className="flex flex-wrap gap-1.5 items-center pt-1">
                  <span className="text-[9px] text-gray-500 font-semibold uppercase tracking-wider">Inspired By:</span>
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

                {/* Captured variables */}
                <div className="pt-2 space-y-1">
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">MAPPED VARIABLES</p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {reg.cardioVars.map((v, idx) => (
                      <span key={idx} className="badge badge-green text-[9px] font-mono">{v}</span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-blue-500/5 flex justify-end">
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
