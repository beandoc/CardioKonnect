'use client'
import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import {
  AlertTriangle, CheckCircle, TrendingUp, Activity,
  Clock, Users, Search, ShieldAlert, Zap, Target,
  PlusCircle, Database, ChevronRight, Heart, ShieldCheck,
  AlertCircle
} from 'lucide-react'
import { getPatients, getAllLatestVisits, getAllCathProcedures } from '@/lib/firestore'
import type { Patient, Visit, CathProcedure } from '@/lib/types'
import { cn, formatDate } from '@/lib/utils'
import Button from '@/components/ui/Button'

type AuditTab = 'complications' | 'hf_admissions' | 'renal_safety'

export default function ComplicationAuditPage() {
  const [activeTab, setActiveTab] = useState<AuditTab>('complications')
  const [patients, setPatients] = useState<Patient[]>([])
  const [visitsMap, setVisitsMap] = useState<Map<string, Visit>>(new Map())
  const [procedures, setProcedures] = useState<CathProcedure[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const [pts, vMap, procs] = await Promise.all([
          getPatients(),
          getAllLatestVisits(),
          getAllCathProcedures()
        ])
        setPatients(pts)
        setVisitsMap(vMap)
        setProcedures(procs)
      } catch (err) {
        console.error('Failed to load complication audit data:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const totalPatients = patients.length
  const totalProcedures = procedures.length

  // Authentic procedural complications
  const complicationProcedures = useMemo(() => {
    return procedures.filter(p => p.complications?.hasComplication)
  }, [procedures])

  const perforationCount = useMemo(() => {
    return procedures.filter(p => p.complications?.coronaryPerforation).length
  }, [procedures])

  const dissectionCount = useMemo(() => {
    return procedures.filter(p => p.complications?.coronaryDissection).length
  }, [procedures])

  const noReflowCount = useMemo(() => {
    return procedures.filter(p => p.complications?.noReflowSlowReflow).length
  }, [procedures])

  const stentThrombosisCount = useMemo(() => {
    return procedures.filter(p => p.complications?.acuteStentThrombosis).length
  }, [procedures])

  const emergencyCabgCount = useMemo(() => {
    return procedures.filter(p => p.complications?.emergencyCabg).length
  }, [procedures])

  const bleedingCount = useMemo(() => {
    return procedures.filter(p => p.complications?.accessSiteBleeding).length
  }, [procedures])

  const akiCount = useMemo(() => {
    return procedures.filter(p => p.complications?.contrastInducedAki).length
  }, [procedures])

  const mortalityCount = useMemo(() => {
    return procedures.filter(p => p.complications?.inLabDeath || p.complications?.inHospitalDeath).length
  }, [procedures])

  const hospHistoryCount = useMemo(() => {
    return patients.filter(p => {
      const v = visitsMap.get(p.id)
      return v?.hospHistory === 'Yes' || p.comorbidPriorMI || p.comorbidCAD
    }).length
  }, [patients, visitsMap])

  const renalRiskCount = useMemo(() => {
    return patients.filter(p => {
      const v = visitsMap.get(p.id)
      return (v?.egfr && v.egfr < 45) || p.comorbidCKD
    }).length
  }, [patients, visitsMap])

  const advancedNyhaCount = useMemo(() => {
    return patients.filter(p => {
      const v = visitsMap.get(p.id)
      return v?.nyha === 'III' || v?.nyha === 'IV' || p.nyha === 'III' || p.nyha === 'IV'
    }).length
  }, [patients, visitsMap])

  return (
    <div className="space-y-6 animate-fade-in text-gray-300">
      {/* Header */}
      <div className="glass-card p-6 border border-blue-500/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-600/15 border border-amber-500/30 flex items-center justify-center text-amber-400 flex-shrink-0">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              Clinical Safety & Complication Audit
              <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30">
                NCDR / BARC Standardized
              </span>
            </h1>
            <p className="text-xs text-gray-400 mt-1">
              Live surveillance of intra-procedural adverse events, BARC bleedings, decompensations, and renal toxicity across {totalProcedures} procedures and {totalPatients} patients.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/registry-home/cathlab">
            <Button size="sm" variant="outline" className="text-xs border-amber-500/30 text-amber-300 hover:bg-amber-500/10">
              <Activity className="w-4 h-4" /> Cath Lab Registry
            </Button>
          </Link>
          <Link href="/patients">
            <Button size="sm" className="btn-primary text-xs">
              <Users className="w-4 h-4" /> Patient Roster
            </Button>
          </Link>
        </div>
      </div>

      {/* Safety KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className={cn('kpi-card', complicationProcedures.length > 0 ? 'rose' : 'amber')}>
          <p className="text-[10px] uppercase tracking-wider text-gray-400">Procedural Adverse Events</p>
          <p className={cn('text-2xl font-bold mt-1', complicationProcedures.length > 0 ? 'text-rose-400' : 'text-gray-300')}>
            {totalProcedures > 0 ? complicationProcedures.length : '—'}
          </p>
          <p className="text-[10px] text-gray-400 mt-1">
            {totalProcedures > 0
              ? `${((complicationProcedures.length / totalProcedures) * 100).toFixed(1)}% of ${totalProcedures} audited procedures`
              : 'Not captured — no procedural complication fields in the current CRF'}
          </p>
        </div>

        <div className="kpi-card violet">
          <p className="text-[10px] uppercase tracking-wider text-gray-400">H/O Prior Hospitalization</p>
          <p className="text-2xl font-bold text-white mt-1">{hospHistoryCount}</p>
          <p className="text-[10px] text-violet-400 mt-1">{totalPatients ? Math.round((hospHistoryCount / totalPatients) * 100) : 0}% of cohort</p>
        </div>

        <div className="kpi-card rose">
          <p className="text-[10px] uppercase tracking-wider text-gray-400">NYHA Class III / IV</p>
          <p className="text-2xl font-bold text-white mt-1">{advancedNyhaCount}</p>
          <p className="text-[10px] text-rose-400 mt-1">High decompensation risk</p>
        </div>

        <div className="kpi-card amber">
          <p className="text-[10px] uppercase tracking-wider text-gray-400">Renal Vulnerability (eGFR &lt;45 / CKD)</p>
          <p className="text-2xl font-bold text-white mt-1">{renalRiskCount}</p>
          <p className="text-[10px] text-amber-400 mt-1">Requiring GDMT dose monitoring</p>
        </div>
      </div>

      {/* Audit Navigation Tabs */}
      <div className="flex gap-2 flex-wrap">
        {[
          { id: 'complications', label: `Interventional & Procedural Complications (${totalProcedures > 0 ? complicationProcedures.length : '—'} Events)` },
          { id: 'hf_admissions', label: `Heart Failure Decompensations (${hospHistoryCount} Pts)` },
          { id: 'renal_safety', label: `Cardiorenal & CIN Surveillance (${renalRiskCount} At Risk)` },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as any)}
            className={cn(
              'text-xs px-4 py-2 rounded-xl border transition-all font-semibold',
              activeTab === t.id
                ? 'bg-blue-600 text-white border-blue-500 shadow-lg'
                : 'text-gray-400 border-blue-500/10 bg-slate-900/50 hover:text-white'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Audit Content View */}
      <div className="glass-card border border-blue-500/15 p-6">
        {activeTab === 'complications' && (
          <div className="space-y-6">
            {totalProcedures === 0 ? (
              <div className="text-center py-12 space-y-3 bg-slate-950/40 rounded-xl border border-dashed border-white/10">
                <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto">
                  <Activity className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-white">Not Captured — No Procedural Complication Fields in Current CRF</h3>
                <p className="text-xs text-gray-400 max-w-lg mx-auto leading-relaxed">
                  CardioPlus does not report structural absence of documentation as an audited zero or clean safety record.
                  Procedural complications (Ellis perforations, NHLBI dissections, no-reflow, acute stent thrombosis, BARC access bleeding, emergent CABG, and CIN) will be audited here upon entry of procedure records into the Cath Lab Registry.
                </p>
                <div className="pt-2">
                  <Link href="/registry-home/cathlab">
                    <Button size="sm" className="btn-primary text-xs">
                      Go to Cath Lab Registry
                    </Button>
                  </Link>
                </div>
              </div>
            ) : (
              <>
                {/* Specific Adverse Event KPI Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-slate-950/60 p-3 rounded-xl border border-white/5 space-y-1">
                    <p className="text-gray-400 text-[10px] uppercase font-semibold">Coronary Perforations</p>
                    <p className={cn('text-xl font-bold', perforationCount > 0 ? 'text-rose-400' : 'text-gray-200')}>
                      {perforationCount}
                    </p>
                    <p className="text-[10px] text-gray-500">Ellis Class I–III criteria</p>
                  </div>

                  <div className="bg-slate-950/60 p-3 rounded-xl border border-white/5 space-y-1">
                    <p className="text-gray-400 text-[10px] uppercase font-semibold">Coronary Dissections</p>
                    <p className={cn('text-xl font-bold', dissectionCount > 0 ? 'text-rose-400' : 'text-gray-200')}>
                      {dissectionCount}
                    </p>
                    <p className="text-[10px] text-gray-500">NHLBI Type A–F criteria</p>
                  </div>

                  <div className="bg-slate-950/60 p-3 rounded-xl border border-white/5 space-y-1">
                    <p className="text-gray-400 text-[10px] uppercase font-semibold">Slow-Flow / No-Reflow</p>
                    <p className={cn('text-xl font-bold', noReflowCount > 0 ? 'text-rose-400' : 'text-gray-200')}>
                      {noReflowCount}
                    </p>
                    <p className="text-[10px] text-gray-500">Microvascular spasm</p>
                  </div>

                  <div className="bg-slate-950/60 p-3 rounded-xl border border-white/5 space-y-1">
                    <p className="text-gray-400 text-[10px] uppercase font-semibold">Acute Stent Thrombosis</p>
                    <p className={cn('text-xl font-bold', stentThrombosisCount > 0 ? 'text-rose-400' : 'text-gray-200')}>
                      {stentThrombosisCount}
                    </p>
                    <p className="text-[10px] text-gray-500">Intra-procedural / Acute</p>
                  </div>

                  <div className="bg-slate-950/60 p-3 rounded-xl border border-white/5 space-y-1">
                    <p className="text-gray-400 text-[10px] uppercase font-semibold">Emergent CABG Bailout</p>
                    <p className={cn('text-xl font-bold', emergencyCabgCount > 0 ? 'text-rose-400' : 'text-gray-200')}>
                      {emergencyCabgCount}
                    </p>
                    <p className="text-[10px] text-gray-500">Surgical revascularization</p>
                  </div>

                  <div className="bg-slate-950/60 p-3 rounded-xl border border-white/5 space-y-1">
                    <p className="text-gray-400 text-[10px] uppercase font-semibold">Access Site Bleeding</p>
                    <p className={cn('text-xl font-bold', bleedingCount > 0 ? 'text-rose-400' : 'text-gray-200')}>
                      {bleedingCount}
                    </p>
                    <p className="text-[10px] text-gray-500">BARC criteria (Types 1–5)</p>
                  </div>

                  <div className="bg-slate-950/60 p-3 rounded-xl border border-white/5 space-y-1">
                    <p className="text-gray-400 text-[10px] uppercase font-semibold">Contrast-Induced AKI</p>
                    <p className={cn('text-xl font-bold', akiCount > 0 ? 'text-rose-400' : 'text-gray-200')}>
                      {akiCount}
                    </p>
                    <p className="text-[10px] text-gray-500">KDIGO acute kidney injury</p>
                  </div>

                  <div className="bg-slate-950/60 p-3 rounded-xl border border-white/5 space-y-1">
                    <p className="text-gray-400 text-[10px] uppercase font-semibold">In-Hospital / Lab Mortality</p>
                    <p className={cn('text-xl font-bold', mortalityCount > 0 ? 'text-rose-400' : 'text-gray-200')}>
                      {mortalityCount}
                    </p>
                    <p className="text-[10px] text-gray-500">All-cause procedural death</p>
                  </div>
                </div>

                {complicationProcedures.length === 0 ? (
                  <div className="p-4 rounded-xl bg-slate-900/60 border border-white/10 text-gray-300 text-xs flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 flex-shrink-0 text-amber-400" />
                    <div>
                      <p className="font-semibold text-white">No procedural adverse events recorded across {totalProcedures} logged procedures.</p>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        Ensure all procedural CRFs capture explicit complication fields. A structural absence of complication data must never render as an audited zero or an unverified green checkmark.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <h3 className="text-sm font-bold text-white">Audited Adverse Events Log ({complicationProcedures.length})</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs text-gray-300">
                        <thead className="bg-white/[0.04] text-gray-400 font-semibold uppercase tracking-wider text-[10px]">
                          <tr>
                            <th className="py-2 px-3">Date</th>
                            <th className="py-2 px-3">Patient / MRN</th>
                            <th className="py-2 px-3">Procedure</th>
                            <th className="py-2 px-3">Adverse Event</th>
                            <th className="py-2 px-3">Classification</th>
                            <th className="py-2 px-3">Operator</th>
                            <th className="py-2 px-3">Notes</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.05]">
                          {complicationProcedures.map((proc) => {
                            const p = patients.find(pt => pt.id === proc.patientId)
                            const comp = proc.complications
                            const events: string[] = []
                            if (comp.coronaryPerforation) events.push(`Perforation (Ellis ${comp.coronaryPerforationEllisClass || '?'})`)
                            if (comp.coronaryDissection) events.push(`Dissection (NHLBI ${comp.coronaryDissectionNhlbiType || '?'})`)
                            if (comp.noReflowSlowReflow) events.push('Slow / No-Reflow')
                            if (comp.acuteStentThrombosis) events.push('Stent Thrombosis')
                            if (comp.emergencyCabg) events.push('Emergent CABG')
                            if (comp.accessSiteBleeding) events.push(`Bleeding (${comp.barcBleedingType || 'BARC'})`)
                            if (comp.contrastInducedAki) events.push('Contrast AKI')
                            if (comp.strokeOrTia) events.push('Stroke / TIA')
                            if (comp.inLabDeath || comp.inHospitalDeath) events.push('Mortality')

                            return (
                              <tr key={proc.id} className="hover:bg-white/[0.02] text-[11px]">
                                <td className="py-2 px-3 font-mono">{proc.procedureDate ? new Date(proc.procedureDate).toLocaleDateString() : '—'}</td>
                                <td className="py-2 px-3">
                                  {p ? (
                                    <Link href={`/patients/${p.id}`} className="font-semibold text-white hover:text-amber-400">
                                      {p.firstName} {p.lastName}
                                    </Link>
                                  ) : (
                                    <span>#{proc.patientId.slice(0, 8)}</span>
                                  )}
                                  <p className="text-[10px] text-gray-500 font-mono">MRN: {p?.mrn || '—'}</p>
                                </td>
                                <td className="py-2 px-3">{proc.procedureType} ({proc.clinicalIndication})</td>
                                <td className="py-2 px-3">
                                  <div className="flex flex-wrap gap-1">
                                    {events.map((e, idx) => (
                                      <span key={idx} className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-semibold text-[10px] border border-rose-500/30">
                                        {e}
                                      </span>
                                    ))}
                                  </div>
                                </td>
                                <td className="py-2 px-3 font-mono text-[10px] text-gray-400">
                                  {comp.barcBleedingType || comp.coronaryPerforationEllisClass || comp.coronaryDissectionNhlbiType || 'Documented'}
                                </td>
                                <td className="py-2 px-3 text-gray-400">{proc.operatorName}</td>
                                <td className="py-2 px-3 text-gray-400 max-w-xs truncate">{comp.complicationNotes || '—'}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {activeTab === 'hf_admissions' && (
          <div className="space-y-4">
            <p className="text-sm font-semibold text-white">Patients with Prior Hospitalization History ({hospHistoryCount})</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {patients
                .filter(p => {
                  const v = visitsMap.get(p.id)
                  return v?.hospHistory === 'Yes' || p.comorbidPriorMI || p.comorbidCAD
                })
                .map(p => {
                  const v = visitsMap.get(p.id)
                  return (
                    <div key={p.id} className="p-3 rounded-xl bg-slate-900/70 border border-blue-500/15 space-y-1 text-xs">
                      <div className="flex justify-between items-start">
                        <Link href={`/patients/${p.id}`} className="font-bold text-white hover:text-blue-300">
                          {p.firstName} {p.lastName}
                        </Link>
                        <span className="badge badge-amber text-[9px]">NYHA {v?.nyha || p.nyha || 'II'}</span>
                      </div>
                      <p className="text-gray-400 text-[11px]">LVEF: <strong className="text-rose-400">{v?.lvef ?? p.lvef ?? '—'}%</strong> · {p.mrn}</p>
                      <p className="text-[10px] text-gray-500 truncate">Comorbidities: {(p.comorbidities || []).join(', ') || 'CAD / Prior admission'}</p>
                    </div>
                  )
                })}
            </div>
          </div>
        )}

        {activeTab === 'renal_safety' && (
          <div className="space-y-4">
            <p className="text-sm font-semibold text-white">Cardiorenal & Potassium Surveillance Cohort</p>
            <p className="text-xs text-gray-400">
              Patients on 4-pillar GDMT require routine monitoring of serum potassium and eGFR computed via CKD-EPI equation.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-2">
              {patients.map(p => {
                const v = visitsMap.get(p.id)
                return (
                  <div key={p.id} className="p-3 rounded-xl bg-slate-900/70 border border-blue-500/15 space-y-1 text-xs">
                    <div className="flex justify-between items-start">
                      <Link href={`/patients/${p.id}`} className="font-bold text-white hover:text-blue-300">
                        {p.firstName} {p.lastName}
                      </Link>
                      <span className="badge badge-blue text-[9px]">{p.sex} · {p.age || 60}y</span>
                    </div>
                    <div className="flex justify-between text-[11px] text-gray-300 pt-1">
                      <span>eGFR: <strong className="text-cyan-400">{v?.egfr != null ? `${v.egfr} ml/min` : 'Pending'}</strong></span>
                      <span>K+: <strong className="text-emerald-400">{v?.potassium != null ? `${v.potassium} mmol/L` : 'Pending'}</strong></span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
