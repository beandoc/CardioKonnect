'use client'
import { useState } from 'react'
import { Heart, Activity, ShieldAlert, Award, FileText, CheckCircle, Flame, Layers, ShieldCheck, HelpCircle } from 'lucide-react'
import Button from '@/components/ui/Button'
import Link from 'next/link'
import { cn } from '@/lib/utils'

export default function RegistryHomePage() {
  const [activeTab, setActiveTab] = useState<'all' | 'clinical' | 'imaging' | 'pci' | 'followup' | 'consent'>('all')

  const sections = [
    {
      title: '👤 Basic Information',
      category: 'clinical',
      items: [
        'Patient Demographics & Unique Registry ID',
        'Referring Physician & Consultant Name',
        'Admission Visit Date, Time & Status',
        'Hospital, Facility Center & Emergency Info'
      ]
    },
    {
      title: '🏥 Clinical Details',
      category: 'clinical',
      items: [
        'Cardiac Diagnoses (ACS, Heart Failure, Arrhythmia)',
        'Classifications (NYHA Class, CCS Angina Grade)',
        'Cardiomyopathy & Valvular Disease Types',
        'CAD History & Sudden Cardiac Death Family History'
      ]
    },
    {
      title: '⚠️ Cardiovascular Risk Factors',
      category: 'clinical',
      items: [
        'Hypertension, Diabetes & Dyslipidemia Status',
        'Tobacco Use, Alcohol Consumption & Obesity (BMI)',
        'Chronic Kidney Disease & Sleep Apnea Presence',
        'Physical Activity Levels & Psychosocial Stress'
      ]
    },
    {
      title: '💓 Vital Signs & Hemodynamics',
      category: 'clinical',
      items: [
        'Heart Rate, Blood Pressure & Respiratory Rate',
        'Oxygen Saturation (SpO₂) & Body Temperature',
        'CVP, Cardiac Output & Cardiac Index (ICU)',
        'Killip Classification for ACS Risk'
      ]
    },
    {
      title: '🩺 ECG & Rhythm Monitoring',
      category: 'imaging',
      items: [
        'Baseline ECG (ST Changes, QTc Intervals)',
        'Holter Monitor Metrics (Arrhythmia & PVC Burden)',
        'Device Rhythm Analysis (Pacemakers, ICD Telemetry)'
      ]
    },
    {
      title: '🧪 Laboratory Parameters',
      category: 'clinical',
      items: [
        'Cardiac Enzymes (Troponin I/T, CK-MB)',
        'Heart Failure Markers (BNP / NT-proBNP)',
        'Lipids, HbA1c, Kidney Function (Creatinine, eGFR)',
        'Hemoglobin, Coagulation Profiles & CRP/ESR'
      ]
    },
    {
      title: '🖥️ Cardiac Imaging',
      category: 'imaging',
      items: [
        'Echocardiography (LVEF, Wall Motion, Valves)',
        'CTCA, Cardiac MRI & Perfusion Imaging Findings',
        'Pulmonary Pressures & Stress Test Results'
      ]
    },
    {
      title: '🧵 Angiography & Cath Lab',
      category: 'pci',
      items: [
        'Procedure Indications & Timestamp Records',
        'Anatomical Findings & SYNTAX Score Assessment',
        'Vessel Involvements, TIMI Flow & FFR/iFR Values',
        'Radiation Exposure Data & Contrast Volume Logs'
      ]
    },
    {
      title: '🫀 Interventional Cardiology',
      category: 'pci',
      items: [
        'PCI Status, Culprit Vessels & Stent Type details',
        'Number, Length of Stents & Intravascular Imaging',
        'Door-to-Balloon Duration & Procedural Complications'
      ]
    },
    {
      title: '🔋 Cardiac Devices',
      category: 'pci',
      items: [
        'Pacemakers, ICDs, CRTs Implantation Details',
        'Lead Profiles, Battery Status & Interrogation Records',
        'Device Complications & Manufacturer Models'
      ]
    },
    {
      title: '💊 Medications & Therapeutics',
      category: 'clinical',
      items: [
        'Antiplatelets, Anticoagulants & Statins Adherence',
        'GDMT Compliance (Beta Blockers, ACEi/ARB/ARNI, MRAs)',
        'Drug Allergies Records & Medication Tracking'
      ]
    },
    {
      title: '🚨 Emergency & Critical Care',
      category: 'clinical',
      items: [
        'Cardiac Arrest, CPR & Defibrillation Incidents',
        'Mechanical Ventilation, IABP/ECMO Support Details',
        'Vasopressor/Inotrope Infusions & ICU Stay Timelines'
      ]
    },
    {
      title: '🏃 Rehab & Lifestyle',
      category: 'followup',
      items: [
        'Exercise Capacity (6-Minute Walk Test Logs)',
        'Cardiac Rehab Enrollment & Counseling Progress',
        'Quality of Life (QoL) Scores & Health Tracking'
      ]
    },
    {
      title: '⚠️ Complications & Outcomes',
      category: 'followup',
      items: [
        'Recurrent MI, Stroke, TIA & Bleeding Events (BARC)',
        'Heart Failure Rehospitalization & MACE Trackers',
        '30-Day Readmissions & Sudden Cardiac Death Audits'
      ]
    },
    {
      title: '📅 Follow-Up & Wearables',
      category: 'followup',
      items: [
        'Longitudinal Visit Dates & Repeat Diagnostics (Echo/PCI)',
        'Remote Device & Wearable Monitoring Integrations',
        'Event-Free Survival Rates & Functional Status Trends'
      ]
    },
    {
      title: '📝 Additional Information',
      category: 'followup',
      items: [
        'Physician Notes, MDT Inputs & Trial Participations',
        'Patient Symptoms Surveys & Quality Indicators',
        'AI-Based Cardiovascular Risk Prediction Scores'
      ]
    },
    {
      title: '✅ Consent Management',
      category: 'consent',
      items: [
        'Procedures, Devices & Cath Lab Consent Status',
        'Data Sharing & Research Participation Authorizations',
        'Imaging & Telemonitoring Consent Categories'
      ]
    }
  ]

  const filteredSections = sections.filter(sec => activeTab === 'all' || sec.category === activeTab)

  return (
    <div className="space-y-6 animate-fade-in text-gray-300">
      
      {/* 1. Header Banner */}
      <div className="glass-card p-6 flex flex-col md:flex-row items-center justify-between gap-4 border border-blue-500/10">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center text-white flex-shrink-0 animate-gradient"
            style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}>
            <Heart className="w-6 h-6 fill-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Cardiology Registry</h1>
            <p className="text-xs text-gray-400">Comprehensive Cardiovascular Patient Management & Outcomes Platform</p>
          </div>
        </div>
      </div>

      {/* 2. Hero Presentation Banner */}
      <div className="p-6 rounded-2xl flex flex-col md:flex-row items-center gap-6 preserve-dark"
        style={{ background: 'linear-gradient(135deg, #1d4ed8 0%, #4f46e5 50%, #7c3aed 100%)' }}>
        <div className="w-20 h-20 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(4px)', border: '1px solid rgba(255,255,255,0.2)' }}>
          <Heart className="w-12 h-12 text-white fill-white" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-white">Cardiology Registry System</h2>
          <p className="text-sm leading-relaxed max-w-4xl" style={{ color: 'rgba(255,255,255,0.92)' }}>
            A comprehensive digital platform for tracking cardiovascular diseases, interventional procedures, cardiac imaging, medication adherence, risk stratification, and long-term clinical outcomes across outpatient, inpatient, cath lab, ICU, and rehabilitation settings.
          </p>
        </div>
      </div>

      {/* 3. Three Core Pillars */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="p-5 rounded-2xl space-y-3 preserve-dark" style={{ background: 'linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%)', boxShadow: '0 8px 24px rgba(29,78,216,0.30)' }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.2)' }}>
            <Activity className="w-5 h-5 text-white" />
          </div>
          <h3 className="text-base font-bold text-white">Cardiovascular Care Tracking</h3>
          <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.90)' }}>
            Complete longitudinal cardiac care records including acute coronary syndromes, heart failure, arrhythmias, structural heart disease, and preventive cardiology.
          </p>
        </div>

        <div className="p-5 rounded-2xl space-y-3 preserve-dark" style={{ background: 'linear-gradient(135deg, #047857 0%, #065f46 100%)', boxShadow: '0 8px 24px rgba(4,120,87,0.30)' }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.2)' }}>
            <Layers className="w-5 h-5 text-white" />
          </div>
          <h3 className="text-base font-bold text-white">Real-Time Clinical Monitoring</h3>
          <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.90)' }}>
            Continuous monitoring of vitals, ECG parameters, biomarkers, procedural outcomes, and cardiovascular risk trends.
          </p>
        </div>

        <div className="p-5 rounded-2xl space-y-3 preserve-dark" style={{ background: 'linear-gradient(135deg, #6d28d9 0%, #5b21b6 100%)', boxShadow: '0 8px 24px rgba(109,40,217,0.30)' }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.2)' }}>
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <h3 className="text-base font-bold text-white">Consent & Compliance Management</h3>
          <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.90)' }}>
            Integrated digital consent management for procedures, registry participation, imaging, research usage, and long-term follow-up.
          </p>
        </div>
      </div>

      {/* 4. Registry Benefits & Value (User spec) */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2">
          <Award className="w-4 h-4 text-amber-400" /> Registry Benefits & Value
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          
          <div className="dark-card p-4 space-y-2 border border-blue-500/10 hover:border-blue-500/20 transition-all">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400">
              🎯
            </div>
            <p className="font-semibold text-xs text-white">Improved Patient Outcomes</p>
            <p className="text-[11px] text-gray-400 leading-relaxed">
              Comprehensive tracking enables data-driven decisions, personalized treatment plans, and better long-term outcomes for cardiovascular patients.
            </p>
          </div>

          <div className="dark-card p-4 space-y-2 border border-blue-500/10 hover:border-blue-500/20 transition-all">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
              📊
            </div>
            <p className="font-semibold text-xs text-white">Quality Monitoring & Analytics</p>
            <p className="text-[11px] text-gray-400 leading-relaxed">
              Real-time monitoring of treatment effectiveness, adherence rates, and complication patterns for continuous quality improvement.
            </p>
          </div>

          <div className="dark-card p-4 space-y-2 border border-blue-500/10 hover:border-blue-500/20 transition-all">
            <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center text-violet-400">
              🔐
            </div>
            <p className="font-semibold text-xs text-white">Regulatory Compliance</p>
            <p className="text-[11px] text-gray-400 leading-relaxed">
              Meet healthcare standards, maintain audit trails, and ensure proper documentation for accreditation requirements.
            </p>
          </div>

          <div className="dark-card p-4 space-y-2 border border-blue-500/10 hover:border-blue-500/20 transition-all">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center text-cyan-400">
              🔬
            </div>
            <p className="font-semibold text-xs text-white">Clinical Research Support</p>
            <p className="text-[11px] text-gray-400 leading-relaxed">
              Structured data collection enables research studies, outcome analysis, and evidence-based practice development.
            </p>
          </div>

        </div>
      </div>

      {/* 5. Comprehensive Data Fields Setup & Categories */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center justify-between pb-2 border-b border-blue-500/10 flex-wrap gap-4">
          <h3 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-400" /> 📋 Comprehensive Data Fields
          </h3>
          {/* Filtering tabs */}
          <div className="flex gap-1.5 flex-wrap">
            <button onClick={() => setActiveTab('all')} className={cn("tab-btn btn-sm", activeTab === 'all' && 'active')}>All</button>
            <button onClick={() => setActiveTab('clinical')} className={cn("tab-btn btn-sm", activeTab === 'clinical' && 'active')}>Clinical & Lab</button>
            <button onClick={() => setActiveTab('imaging')} className={cn("tab-btn btn-sm", activeTab === 'imaging' && 'active')}>ECG & Imaging</button>
            <button onClick={() => setActiveTab('pci')} className={cn("tab-btn btn-sm", activeTab === 'pci' && 'active')}>Cath Lab & Device</button>
            <button onClick={() => setActiveTab('followup')} className={cn("tab-btn btn-sm", activeTab === 'followup' && 'active')}>Outcomes & Rehab</button>
            <button onClick={() => setActiveTab('consent')} className={cn("tab-btn btn-sm", activeTab === 'consent' && 'active')}>Consent</button>
          </div>
        </div>

        {/* Data Field Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSections.map((sec, i) => (
            <div key={i} className="glass-card p-5 space-y-3.5 border border-blue-500/10 hover:border-blue-500/25 transition-all">
              <h4 className="text-sm font-bold text-white flex items-center gap-2 border-b border-blue-500/5 pb-2.5">
                {sec.title}
              </h4>
              <ul className="space-y-2">
                {sec.items.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-xs text-gray-400">
                    <CheckCircle className="w-3.5 h-3.5 text-blue-500/70 mt-0.5 flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
