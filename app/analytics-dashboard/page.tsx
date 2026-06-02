'use client'
import { useState, useMemo } from 'react'
import {
  Activity, Users, Heart, ClipboardList, ShieldAlert, Award, FileText,
  BarChart3, TrendingUp, AlertTriangle, Zap, CheckCircle, Smartphone, Info
} from 'lucide-react'
import Button from '@/components/ui/Button'
import { cn } from '@/lib/utils'

export default function AnalyticsDashboardPage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'burden' | 'cathlab' | 'medication' | 'outcomes' | 'preventive'>('overview')

  return (
    <div className="space-y-6 animate-fade-in text-gray-300">
      
      {/* Executive Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400 flex-shrink-0">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white leading-tight">Cardiology Intelligence & Analytics</h2>
            <p className="text-xs text-gray-400 mt-1">Operational & clinical analytics dashboard paired with clinical insights</p>
            <p className="text-[10px] text-gray-500 mt-0.5">Registry Owner View &bull; Dr. A. Jayachandra &bull; AICTS Pune</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">Export Report</Button>
          <Button size="sm">Refresh Data</Button>
        </div>
      </div>

      {/* High-Value Executive Dashboard KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="kpi-card blue">
          <p className="text-[10px] uppercase tracking-wider text-gray-400">Mortality Rate</p>
          <p className="text-2xl font-bold text-white mt-1">2.4%</p>
          <p className="text-[10px] text-emerald-400 mt-1">&darr; 0.8% vs last qtr</p>
        </div>
        <div className="kpi-card rose">
          <p className="text-[10px] uppercase tracking-wider text-gray-400">MACE Rate</p>
          <p className="text-2xl font-bold text-white mt-1">5.1%</p>
          <p className="text-[10px] text-gray-500 mt-1">30-day follow-up</p>
        </div>
        <div className="kpi-card emerald">
          <p className="text-[10px] uppercase tracking-wider text-gray-400">STEMI FMC-to-PCI</p>
          <p className="text-2xl font-bold text-white mt-1">68m</p>
          <p className="text-[10px] text-emerald-400 mt-1">Target &lt;90m achieved</p>
        </div>
        <div className="kpi-card amber">
          <p className="text-[10px] uppercase tracking-wider text-gray-400">Readmission Rate</p>
          <p className="text-2xl font-bold text-white mt-1">8.2%</p>
          <p className="text-[10px] text-rose-400 mt-1">&uarr; 0.4% this month</p>
        </div>
        <div className="kpi-card violet">
          <p className="text-[10px] uppercase tracking-wider text-gray-400">GDMT Adherence</p>
          <p className="text-2xl font-bold text-white mt-1">91.4%</p>
          <p className="text-[10px] text-emerald-400 mt-1">Outstanding adherence</p>
        </div>
      </div>

      {/* Intelligence Tab Headers */}
      <div className="flex border-b border-blue-500/10 pb-3 gap-6 flex-wrap">
        <button onClick={() => setActiveTab('overview')} className={cn("text-xs font-semibold pb-2 border-b-2 px-1 transition-all", activeTab === 'overview' ? "border-blue-500 text-white" : "border-transparent text-gray-400 hover:text-gray-200")}>Population Overview</button>
        <button onClick={() => setActiveTab('burden')} className={cn("text-xs font-semibold pb-2 border-b-2 px-1 transition-all", activeTab === 'burden' ? "border-blue-500 text-white" : "border-transparent text-gray-400 hover:text-gray-200")}>Disease Burden</button>
        <button onClick={() => setActiveTab('cathlab')} className={cn("text-xs font-semibold pb-2 border-b-2 px-1 transition-all", activeTab === 'cathlab' ? "border-blue-500 text-white" : "border-transparent text-gray-400 hover:text-gray-200")}>Cath Lab Analytics</button>
        <button onClick={() => setActiveTab('medication')} className={cn("text-xs font-semibold pb-2 border-b-2 px-1 transition-all", activeTab === 'medication' ? "border-blue-500 text-white" : "border-transparent text-gray-400 hover:text-gray-200")}>Medication & GDMT</button>
        <button onClick={() => setActiveTab('outcomes')} className={cn("text-xs font-semibold pb-2 border-b-2 px-1 transition-all", activeTab === 'outcomes' ? "border-blue-500 text-white" : "border-transparent text-gray-400 hover:text-gray-200")}>Longitudinal Outcomes</button>
        <button onClick={() => setActiveTab('preventive')} className={cn("text-xs font-semibold pb-2 border-b-2 px-1 transition-all", activeTab === 'preventive' ? "border-blue-500 text-white" : "border-transparent text-gray-400 hover:text-gray-200")}>Preventive Cardiology</button>
      </div>

      {/* Main Tab Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left main analysis panel */}
        <div className="lg:col-span-8 space-y-6">
          
          {activeTab === 'overview' && (
            <div className="glass-card p-5 space-y-4">
              <h3 className="text-sm font-semibold text-white pb-2 border-b border-blue-500/10 flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-400" /> Cohort Demographics & Growth
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <p className="text-xs font-semibold text-white">OPD vs IPD vs ICU Status</p>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between"><span>Outpatient Clinic (OPD)</span><span className="text-white font-semibold">62%</span></div>
                    <div className="progress-track"><div className="progress-fill bg-blue-500" style={{ width: '62%' }} /></div>
                    
                    <div className="flex justify-between"><span>Inpatient Wards (IPD)</span><span className="text-white font-semibold">24%</span></div>
                    <div className="progress-track"><div className="progress-fill bg-violet-500" style={{ width: '24%' }} /></div>

                    <div className="flex justify-between"><span>Cardiology ICU / CCU</span><span className="text-white font-semibold">14%</span></div>
                    <div className="progress-track"><div className="progress-fill bg-rose-500" style={{ width: '14%' }} /></div>
                  </div>
                </div>

                <div className="space-y-4">
                  <p className="text-xs font-semibold text-white">Registry Growth Trends</p>
                  <div className="space-y-3 text-xs">
                    <div className="flex justify-between border-b border-blue-500/5 pb-1">
                      <span className="text-gray-400">Daily Registrations</span>
                      <span className="text-white font-semibold">+4 / day</span>
                    </div>
                    <div className="flex justify-between border-b border-blue-500/5 pb-1">
                      <span className="text-gray-400">Monthly Registrations</span>
                      <span className="text-white font-semibold">+124 / month</span>
                    </div>
                    <div className="flex justify-between border-b border-blue-500/5 pb-1">
                      <span className="text-gray-400">Yearly Active Cohort</span>
                      <span className="text-white font-semibold">1,480 total</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Geographic Distribution</span>
                      <span className="text-white font-semibold">Pune Metro Area (82%)</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'burden' && (
            <div className="glass-card p-5 space-y-4">
              <h3 className="text-sm font-semibold text-white pb-2 border-b border-blue-500/10 flex items-center gap-2">
                <Heart className="w-4 h-4 text-rose-400" /> Cardiovascular Disease Burden Analysis
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
                <div className="space-y-3">
                  <p className="font-semibold text-white">Coronary Artery Disease (CAD)</p>
                  <div className="flex justify-between"><span>STEMI Presentation</span><span className="text-white">35%</span></div>
                  <div className="flex justify-between"><span>NSTEMI / UA</span><span className="text-white">45%</span></div>
                  <div className="flex justify-between"><span>Multi-vessel involvement</span><span className="text-white">68%</span></div>
                  <div className="flex justify-between"><span>Left Main CAD prevalence</span><span className="text-white">12%</span></div>
                </div>
                <div className="space-y-3">
                  <p className="font-semibold text-white">Heart Failure Breakdown</p>
                  <div className="flex justify-between"><span>HFrEF (EF &lt;40%)</span><span className="text-white">52%</span></div>
                  <div className="flex justify-between"><span>HFmrEF (EF 40-49%)</span><span className="text-white">18%</span></div>
                  <div className="flex justify-between"><span>HFpEF (EF &ge;50%)</span><span className="text-white">30%</span></div>
                  <div className="flex justify-between"><span>Decompensation Hospitalizations</span><span className="text-white">1.8 / yr</span></div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'cathlab' && (
            <div className="glass-card p-5 space-y-4">
              <h3 className="text-sm font-semibold text-white pb-2 border-b border-blue-500/10 flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-400" /> Cath Lab & Interventional Metrics
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
                <div className="space-y-3">
                  <p className="font-semibold text-white">STEMI Door-to-Balloon Performance</p>
                  <div className="flex justify-between"><span>Door-to-ECG (&lt;10m target)</span><span className="text-white font-mono">6.5 min</span></div>
                  <div className="flex justify-between"><span>Door-to-Needle (Thrombolysis)</span><span className="text-white font-mono">24 min</span></div>
                  <div className="flex justify-between"><span>Door-to-Balloon Time (PCI)</span><span className="text-white font-mono">68 min</span></div>
                  <div className="flex justify-between"><span>TIMI 3 Flow Post-PCI achievement</span><span className="text-emerald-400 font-bold">94.2%</span></div>
                </div>
                <div className="space-y-3">
                  <p className="font-semibold text-white">Access, Contrast & Complications</p>
                  <div className="flex justify-between"><span>Radial Access Route Rate</span><span className="text-white">88.5%</span></div>
                  <div className="flex justify-between"><span>Mean Contrast Volume</span><span className="text-white">125 mL</span></div>
                  <div className="flex justify-between"><span>IVUS/OCT Imaging utilization</span><span className="text-white">22.4%</span></div>
                  <div className="flex justify-between"><span>Contrast-Induced Nephropathy</span><span className="text-rose-400 font-semibold">1.2%</span></div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'medication' && (
            <div className="glass-card p-5 space-y-4">
              <h3 className="text-sm font-semibold text-white pb-2 border-b border-blue-500/10 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-cyan-400" /> GDMT Compliance & Adherence rates
              </h3>
              <div className="space-y-3 text-xs">
                <div className="flex justify-between"><span>Aspirin / Dual Antiplatelet (DAPT)</span><span className="text-white">96.8%</span></div>
                <div className="progress-track"><div className="progress-fill bg-blue-500" style={{ width: '96.8%' }} /></div>

                <div className="flex justify-between"><span>Statin / Lipid Lowering target</span><span className="text-white">94.2%</span></div>
                <div className="progress-track"><div className="progress-fill bg-violet-500" style={{ width: '94.2%' }} /></div>

                <div className="flex justify-between"><span>Beta-Blocker enrollment</span><span className="text-white">91.5%</span></div>
                <div className="progress-track"><div className="progress-fill bg-emerald-500" style={{ width: '91.5%' }} /></div>

                <div className="flex justify-between"><span>ACEi / ARB / ARNI guideline usage</span><span className="text-white">88.2%</span></div>
                <div className="progress-track"><div className="progress-fill bg-cyan-500" style={{ width: '88.2%' }} /></div>
              </div>
            </div>
          )}

          {activeTab === 'outcomes' && (
            <div className="glass-card p-5 space-y-4">
              <h3 className="text-sm font-semibold text-white pb-2 border-b border-blue-500/10 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-violet-400" /> Longitudinal Outcomes & MACE Rates
              </h3>
              <div className="grid grid-cols-2 gap-4 text-center">
                <div className="dark-card p-4">
                  <p className="text-[10px] text-gray-500 uppercase">30-Day Survival</p>
                  <p className="text-2xl font-bold text-white mt-1">98.5%</p>
                </div>
                <div className="dark-card p-4">
                  <p className="text-[10px] text-gray-500 uppercase">1-Year Survival</p>
                  <p className="text-2xl font-bold text-white mt-1">92.4%</p>
                </div>
                <div className="dark-card p-4 col-span-2">
                  <p className="text-[10px] text-gray-500 uppercase">Preventable Readmission Rate</p>
                  <p className="text-xl font-bold text-emerald-400 mt-1">3.2%</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'preventive' && (
            <div className="glass-card p-5 space-y-4">
              <h3 className="text-sm font-semibold text-white pb-2 border-b border-blue-500/10 flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-400" /> Preventive Cardiology & Goals
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
                <div className="space-y-3">
                  <p className="font-semibold text-white">Risk Factor Target Controls</p>
                  <div className="flex justify-between"><span>Blood Pressure Control (&lt;130/80)</span><span className="text-white">74%</span></div>
                  <div className="flex justify-between"><span>LDL Target Achievement (&lt;55 mg/dL)</span><span className="text-white">62%</span></div>
                  <div className="flex justify-between"><span>Diabetes Control (HbA1c &lt;7.0%)</span><span className="text-white">68%</span></div>
                </div>
                <div className="space-y-3">
                  <p className="font-semibold text-white">Lifestyle & Rehab Compliance</p>
                  <div className="flex justify-between"><span>Cardiac Rehab Enrollment</span><span className="text-white">45%</span></div>
                  <div className="flex justify-between"><span>Smoking Cessation Success</span><span className="text-emerald-400">72%</span></div>
                  <div className="flex justify-between"><span>Physical Activity Target Achieved</span><span className="text-white">58%</span></div>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Right side: AI Risk Stratification & Clinical Alerts */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* AI & Predictive Analytics */}
          <div className="glass-card p-5 space-y-4">
            <h3 className="text-sm font-semibold text-white pb-2 border-b border-blue-500/10 flex items-center gap-2">
              <Zap className="w-4 h-4 text-violet-400 animate-pulse" /> AI & Predictive Analytics
            </h3>
            
            <div className="space-y-3 text-xs">
              <div className="flex justify-between items-center border-b border-blue-500/5 pb-2">
                <div>
                  <p className="font-semibold text-white">HF Decompensation Risk</p>
                  <p className="text-[10px] text-gray-500">Based on NT-proBNP & weight trend</p>
                </div>
                <span className="badge badge-red">High Risk</span>
              </div>

              <div className="flex justify-between items-center border-b border-blue-500/5 pb-2">
                <div>
                  <p className="font-semibold text-white">Sudden Cardiac Death Alert</p>
                  <p className="text-[10px] text-gray-500">Telemetry arrhythmia burden logs</p>
                </div>
                <span className="badge badge-green">Stable</span>
              </div>

              <div className="flex justify-between items-center border-b border-blue-500/5 pb-2">
                <div>
                  <p className="font-semibold text-white">30-Day Readmission Risk</p>
                  <p className="text-[10px] text-gray-500">Clinical score prediction model</p>
                </div>
                <span className="badge badge-amber">Moderate</span>
              </div>

              <div className="flex justify-between items-center">
                <div>
                  <p className="font-semibold text-white">Bleeding / DAPT Risk</p>
                  <p className="text-[10px] text-gray-500">PRECISE-DAPT score estimation</p>
                </div>
                <span className="badge badge-green">Low Risk</span>
              </div>
            </div>
          </div>

          {/* Real-Time Alerts */}
          <div className="glass-card p-5 space-y-4">
            <h3 className="text-sm font-semibold text-white pb-2 border-b border-blue-500/10 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400" /> Clinical Action Alerts
            </h3>
            
            <div className="space-y-3 text-xs">
              
              <div className="alert-strip danger p-3 flex gap-2">
                <Info className="w-4 h-4 flex-shrink-0" />
                <div>
                  <p className="font-semibold">Abnormal Troponin Trend Detected</p>
                  <p className="text-[10px] opacity-80 mt-0.5">Patient ID: APT-90412 &bull; View ECG</p>
                </div>
              </div>

              <div className="alert-strip warn p-3 flex gap-2">
                <Info className="w-4 h-4 flex-shrink-0" />
                <div>
                  <p className="font-semibold">Medication Non-Adherence Alert</p>
                  <p className="text-[10px] opacity-80 mt-0.5">SGLT2i dose overdue for 3 days</p>
                </div>
              </div>

            </div>
          </div>

          {/* Intelligence Principle note */}
          <div className="bg-blue-500/5 p-4 rounded-2xl border border-blue-500/10 space-y-2 text-xs">
            <p className="font-semibold text-blue-400 flex items-center gap-1.5">
              <Smartphone className="w-4 h-4" /> Wearable & Device Integration
            </p>
            <p className="text-gray-400 leading-normal text-[11px]">
              This cardiology registry is evolving into a full Clinical Intelligence System. Telemetry records, device parameters, and wearable data are streamed in real time.
            </p>
          </div>

        </div>

      </div>

    </div>
  )
}
