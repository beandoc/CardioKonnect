'use client'
import { useState } from 'react'
import {
  ShieldCheck, AlertTriangle, CheckCircle, ChevronRight,
  PlusCircle, Edit3, Sparkles, Database, PieChart, Info
} from 'lucide-react'
import { assessPatientCompleteness, type CompletenessReport, type FieldAuditItem } from '@/lib/dataCompleteness'
import type { Patient, Visit } from '@/lib/types'
import Button from '@/components/ui/Button'
import QuickDataEntryModal from './QuickDataEntryModal'

interface DataCompletenessCardProps {
  patient: Patient
  latestVisit: Visit | null
  onRefresh: () => void
}

export default function DataCompletenessCard({
  patient,
  latestVisit,
  onRefresh,
}: DataCompletenessCardProps) {
  const [showModal, setShowModal] = useState(false)
  const [showAllDetails, setShowAllDetails] = useState(false)

  const report: CompletenessReport = assessPatientCompleteness(patient, latestVisit)

  return (
    <>
      <div className="glass-card p-5 border border-blue-500/20 shadow-xl space-y-4">
        {/* Top summary row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xl flex-shrink-0 shadow-lg"
              style={{
                backgroundColor: `${report.color}20`,
                color: report.color,
                border: `1.5px solid ${report.color}50`,
              }}
            >
              {report.overallScore}%
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-bold text-white">Tier 1 Core CRF Completeness</h3>
                <span
                  className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider"
                  style={{
                    backgroundColor: `${report.color}20`,
                    color: report.color,
                    border: `1px solid ${report.color}40`,
                  }}
                >
                  Grade {report.grade}
                </span>
                <span className="text-[10px] bg-blue-500/10 text-blue-300 border border-blue-500/20 px-2 py-0.5 rounded font-mono">
                  Follow-up: {report.followUpScore}%
                </span>
                <span className="text-[10px] bg-purple-500/10 text-purple-300 border border-purple-500/20 px-2 py-0.5 rounded font-mono">
                  Research Modules: {report.optionalResearchScore}%
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                {report.completedFields} of {report.totalFields} core mandatory parameters documented (Core quality target: 100%)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => setShowModal(true)}
              className="btn-primary flex items-center gap-1.5 whitespace-nowrap shadow-md text-xs py-2 px-3"
            >
              <Edit3 className="w-3.5 h-3.5" />
              Enter Missing Data
            </Button>
            <button
              onClick={() => setShowAllDetails(v => !v)}
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 transition-colors"
            >
              {showAllDetails ? 'Hide Audit' : 'View Audit'}
            </button>
          </div>
        </div>

        {/* Missing Critical items banner if any */}
        {report.missingCritical.length > 0 && (
          <div className="missing-critical-banner p-3.5 rounded-xl bg-amber-950/30 border border-amber-500/30 flex items-start gap-2.5 text-xs text-amber-200">
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-bold text-amber-300">Missing Critical Parameters: </span>
              <span className="text-amber-200/90 font-medium">
                {report.missingCritical.map(f => f.label).join(' · ')}
              </span>
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="text-[11px] font-bold text-amber-300 underline hover:text-amber-100 whitespace-nowrap ml-2"
            >
              Fill Now →
            </button>
          </div>
        )}

        {/* Category progress bars */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 pt-1">
          {report.categories.map(cat => {
            const barColor = cat.score >= 80 ? '#10b981' : cat.score >= 50 ? '#3b82f6' : '#f59e0b'
            return (
              <div key={cat.name} className="p-2.5 rounded-xl dark-card space-y-1.5">
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-gray-400 font-semibold truncate">{cat.name}</span>
                  <span className="font-bold font-mono text-white">{cat.score}%</span>
                </div>
                <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${cat.score}%`,
                      backgroundColor: barColor,
                    }}
                  />
                </div>
              </div>
            )
          })}
        </div>

        {/* Detailed audit drawer */}
        {showAllDetails && (
          <div className="pt-3 border-t border-blue-500/15 space-y-3 animate-fade-in">
            <p className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
              Complete Field Breakdown & Real Value Audit
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {report.allFields.map(f => (
                <div
                  key={f.key}
                  onClick={() => setShowModal(true)}
                  className={`p-2.5 rounded-lg border text-xs flex items-center justify-between cursor-pointer transition-all ${
                    f.isComplete
                      ? 'bg-emerald-950/20 border-emerald-500/25 hover:border-emerald-500/50 text-gray-300'
                      : f.importance === 'Critical'
                      ? 'bg-rose-950/20 border-rose-500/30 hover:border-rose-500/50 text-rose-300'
                      : 'bg-slate-900/50 border-gray-700/50 hover:border-blue-500/40 text-gray-400'
                  }`}
                >
                  <div className="min-w-0 pr-2">
                    <p className="font-semibold text-white truncate">{f.label}</p>
                    <p className="text-[10px] text-gray-400 truncate">
                      {f.isComplete ? (f.value ?? 'Recorded') : 'Missing — click to add'}
                    </p>
                  </div>
                  {f.isComplete ? (
                    <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  ) : (
                    <PlusCircle className="w-4 h-4 text-blue-400 flex-shrink-0" />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Direct data entry modal */}
      <QuickDataEntryModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        patient={patient}
        latestVisit={latestVisit}
        onSaved={onRefresh}
      />
    </>
  )
}
