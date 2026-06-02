'use client'
import { useState, useMemo } from 'react'
import {
  FileText, Search, BarChart3, Heart, ShieldAlert, Award, Compass, Sparkles, Download, ArrowUpRight, TrendingUp
} from 'lucide-react'
import Button from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

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
    { title: 'Safety, Contrast & Radiation Logs', category: 'Quality & Benchmark Reports', description: 'Contrast-induced nephropathy logs, radiation dose area product (DAP), and vascular issues.', metrics: ['CIN Rate: 1.1%', 'Mean DAP: 42 Gy.cm²'] }
  ],
  outcomes: [
    { title: 'Longitudinal Survival & Kaplan-Meier', category: 'Outcomes Reports', description: 'Kaplan-Meier survival curves, MACE-free survival trends, and readmission analytics.', metrics: ['1-Year Survival: 94.2%', 'MACE-free Survival: 89.8%'] },
    { title: 'Readmissions & Emergency Revisits', category: 'Outcomes Reports', description: '7-day and 30-day HF readmission rates, recurrent hospitalizations, and root cause reviews.', metrics: ['30-day Readmissions: 8.2%', '7-day Readmissions: 1.4%'] }
  ],
  quality: [
    { title: 'Institutional Quality Benchmarking', category: 'Quality & Benchmark Reports', description: 'Mortality comparison, door-to-balloon benchmark comparisons, and guideline adherence rankings.', metrics: ['Registry Rank: 92nd percentile', 'D2B Deviation: -8 mins'] }
  ],
  medication: [
    { title: 'GDMT Persistence & DAPT Compliance', category: 'Clinical Reports', description: 'Medication adherence levels at 1, 6, and 12 months post-discharge.', metrics: ['GDMT Persistence: 87%', 'DAPT Compliance: 94%'] }
  ]
}

export default function ReportsArchitecturePage() {
  const [activeSection, setActiveSection] = useState('cad')
  const [searchQuery, setSearchQuery] = useState('')

  const activeReports = useMemo(() => {
    const list = REPORTS_REGISTRY[activeSection] || []
    if (!searchQuery) return list
    return list.filter(r => 
      r.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      r.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.category.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [activeSection, searchQuery])

  const handleOpenReport = (title: string) => {
    toast.success(`Opening report: "${title}"`)
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

  return (
    <div className="space-y-6 animate-fade-in text-gray-300">
      
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
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

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
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
                <div key={idx} className="glass-card p-5 space-y-4 flex flex-col justify-between hover:-translate-y-1 transition-all duration-300">
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <span className="badge badge-blue text-[9px] uppercase tracking-wider font-bold">
                        {report.category}
                      </span>
                      <button onClick={() => handleOpenReport(report.title)} className="text-gray-500 hover:text-white transition-colors" title="Open Report">
                        <ArrowUpRight className="w-4 h-4" />
                      </button>
                    </div>
                    <h4 className="text-sm font-bold text-white font-sans">{report.title}</h4>
                    <p className="text-xs text-gray-400 leading-relaxed">{report.description}</p>
                  </div>

                  <div className="pt-3 border-t border-blue-500/10 space-y-2">
                    <p className="text-[9px] uppercase tracking-widest text-gray-500 font-bold">Key Indicators</p>
                    <div className="flex flex-wrap gap-2">
                      {report.metrics.map((m, mIdx) => (
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

    </div>
  )
}
