'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import type { Visit, CathProcedure } from '@/lib/types'
import { formatDate, nyhaBadgeColor, lvefColor, cn } from '@/lib/utils'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import {
  PlusCircle,
  Stethoscope,
  ChevronDown,
  ChevronRight,
  Activity,
  Heart,
  Clock,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Edit2,
  Trash2,
  Zap,
  Check
} from 'lucide-react'
import {
  calculateDoorToBalloonMin,
  calculateAngiographicSuccess,
  calculateProceduralSuccess
} from '@/lib/interventionalMetrics'

interface Props {
  visits: Visit[]
  procedures?: CathProcedure[]
  patientId: string
  onDelete?: (visitId: string) => void
  onDeleteProcedure?: (procedureId: string) => void
  onEditProcedure?: (procedure: CathProcedure) => void
  onAddProcedure?: () => void
  isConsentGated?: boolean
}

type TimelineItem =
  | { kind: 'visit'; id: string; date: string; data: Visit }
  | { kind: 'procedure'; id: string; date: string; data: CathProcedure }

function VisitCard({ visit, onDelete }: { visit: Visit; onDelete?: (id: string) => void }) {
  const [open, setOpen] = useState(false)

  const nyhaColors: Record<string, string> = {
    I: 'green',
    II: 'blue',
    III: 'amber',
    IV: 'red',
  }

  return (
    <div className="border border-white/10 rounded-2xl overflow-hidden bg-slate-900/80 hover:border-blue-500/30 transition-all shadow-sm">
      {/* Header row */}
      <button
        type="button"
        className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-white/[0.02] transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center flex-shrink-0">
            <Stethoscope className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-semibold text-white text-sm">{formatDate(visit.visitDate)}</p>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-blue-500/15 text-blue-300 border border-blue-500/20">
                Clinical Visit
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">{visit.visitType || 'OPD'} Follow-up</p>
          </div>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap justify-end">
          {visit.nyha && (
            <Badge variant={(nyhaColors[visit.nyha] ?? 'gray') as any}>
              NYHA {visit.nyha}
            </Badge>
          )}
          {visit.hfType && <Badge variant="blue">{visit.hfType}</Badge>}
          {visit.lvef != null && (
            <span className={cn('text-xs font-bold px-2 py-0.5 rounded bg-slate-950/60 border border-white/10', lvefColor(visit.lvef))}>
              LVEF {visit.lvef}%
            </span>
          )}
          {visit.bpSystolic && visit.bpDiastolic && (
            <span className="text-xs text-gray-400 font-mono px-2 py-0.5 rounded bg-slate-950/40 border border-white/5">
              {visit.bpSystolic}/{visit.bpDiastolic} mmHg
            </span>
          )}
          {open ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
        </div>
      </button>

      {/* Expanded detail */}
      {open && (
        <div className="border-t border-white/5 px-5 py-4 bg-slate-950/30">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
            <Stat label="NT-proBNP" value={visit.ntProBNP} unit="pg/mL" />
            <Stat label="eGFR" value={visit.egfr} unit="ml/min/1.73m²" />
            <Stat label="Potassium" value={visit.potassium} unit="mmol/L" />
            <Stat label="6MWT" value={visit.sixMWT} unit="m" />
            <Stat label="HR" value={visit.heartRate} unit="bpm" />
            <Stat label="Resp Rate" value={visit.respiratoryRate} unit="breaths/min" />
            <Stat label="Weight" value={visit.weight} unit="kg" />
            <Stat label="Hb" value={visit.hb} unit="g/dL" />
            <Stat label="HbA1c" value={visit.hba1c} unit="%" />
          </div>

          {/* Medications summary */}
          <div className="mt-3 pt-3 border-t border-white/5">
            <p className="text-xs font-semibold text-gray-400 mb-2">Active Guideline-Directed Medications</p>
            <div className="flex flex-wrap gap-2">
              {visit.diuretic?.prescribed === 'Yes' && <MedChip label={`Diuretic${visit.diuretic.type ? ': ' + visit.diuretic.type : ''}`} dose={visit.diuretic.dose} />}
              {visit.raasi?.prescribed === 'Yes' && <MedChip label={`RAASi${visit.raasi.type ? ': ' + visit.raasi.type : ''}`} dose={visit.raasi.dose} />}
              {visit.betaBlocker?.prescribed === 'Yes' && <MedChip label={`BB${visit.betaBlocker.type ? ': ' + visit.betaBlocker.type : ''}`} dose={visit.betaBlocker.dose} />}
              {visit.mra?.prescribed === 'Yes' && <MedChip label={`MRA${visit.mra.type ? ': ' + visit.mra.type : ''}`} dose={visit.mra.dose} />}
              {visit.sglt2i?.prescribed === 'Yes' && <MedChip label={`SGLT2i${visit.sglt2i.type ? ': ' + visit.sglt2i.type : ''}`} dose={visit.sglt2i.dose} />}
              {visit.ivabradine?.prescribed === 'Yes' && <MedChip label="Ivabradine" dose={visit.ivabradine.dose} />}
              {visit.digoxin?.prescribed === 'Yes' && <MedChip label="Digoxin" dose={visit.digoxin.dose} />}
              {visit.noac?.prescribed === 'Yes' && <MedChip label={`NOAC: ${visit.noac.type || ''}`} dose={visit.noac.dose} />}
            </div>
          </div>

          {/* Device */}
          {(visit.device?.length ?? 0) > 0 && (
            <div className="mt-3 pt-3 border-t border-white/5 flex gap-2 flex-wrap items-center">
              <span className="text-xs text-gray-400 mr-1">Devices:</span>
              {visit.device!.map(d => (
                <span key={d} className="px-2 py-0.5 bg-purple-500/15 text-purple-300 border border-purple-500/30 rounded-full text-xs font-medium">
                  {d}
                </span>
              ))}
            </div>
          )}

          {/* Coronary Anatomy & Prior Interventions */}
          {(visit.coronaryAnatomy && Object.values(visit.coronaryAnatomy).some(v => v !== undefined && v !== '')) && (
            <div className="mt-3 pt-3 border-t border-white/5">
              <p className="text-xs font-semibold text-gray-400 mb-2">Historical Coronary Anatomy</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                {visit.coronaryAnatomy.lmStenosis && <div><span className="text-gray-500">LM:</span> <span className="font-semibold text-gray-200">{visit.coronaryAnatomy.lmStenosis}%</span></div>}
                {visit.coronaryAnatomy.ladStenosis && <div><span className="text-gray-500">LAD:</span> <span className="font-semibold text-gray-200">{visit.coronaryAnatomy.ladStenosis}%</span></div>}
                {visit.coronaryAnatomy.lcxStenosis && <div><span className="text-gray-500">LCx:</span> <span className="font-semibold text-gray-200">{visit.coronaryAnatomy.lcxStenosis}%</span></div>}
                {visit.coronaryAnatomy.rcaStenosis && <div><span className="text-gray-500">RCA:</span> <span className="font-semibold text-gray-200">{visit.coronaryAnatomy.rcaStenosis}%</span></div>}
                {visit.coronaryAnatomy.syntaxScore && <div><span className="text-gray-500">SYNTAX:</span> <span className="font-bold text-amber-400">{visit.coronaryAnatomy.syntaxScore}</span></div>}
              </div>
            </div>
          )}

          {/* Notes */}
          {visit.clinicalNotes && (
            <div className="mt-3 pt-3 border-t border-white/5">
              <p className="text-xs font-semibold text-gray-400 mb-1">Clinical Notes</p>
              <p className="text-xs text-gray-300 whitespace-pre-wrap font-sans">{visit.clinicalNotes}</p>
            </div>
          )}

          <div className="mt-4 pt-3 border-t border-white/5 flex justify-end gap-2">
            {onDelete && (
              <Button
                variant="danger"
                size="sm"
                onClick={() => onDelete(visit.id)}
                className="text-xs"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete Visit
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function ProcedureCard({
  proc,
  onEdit,
  onDelete
}: {
  proc: CathProcedure
  onEdit?: (proc: CathProcedure) => void
  onDelete?: (id: string) => void
}) {
  const [open, setOpen] = useState(false)

  const lesions = proc.lesions || []
  const devices = proc.devices || []
  const complications = Array.isArray(proc.complications)
    ? proc.complications
    : (proc.complications && (proc.complications as any).hasComplication ? [{ type: 'Complication Recorded' }] : [])
  const hasComplication = complications.some((c: any) => c.type !== 'None')

  // Derive door-to-balloon if STEMI
  const dtb = proc.doorToBalloonMin ?? (
    proc.hospitalArrival && proc.firstDevice
      ? calculateDoorToBalloonMin(proc)
      : null
  )

  // Derive success dynamically
  const isAngioSuccess = proc.angiographicSuccess ?? (
    lesions.length > 0 ? calculateAngiographicSuccess(proc) : false
  )
  const isProcSuccess = proc.proceduralSuccess ?? (
    lesions.length > 0 ? calculateProceduralSuccess(proc) : false
  )

  const dateStr = proc.procedureDateTime || proc.procedureDate || ''

  return (
    <div className="border border-amber-500/25 rounded-2xl overflow-hidden bg-slate-900/90 hover:border-amber-500/40 transition-all shadow-md shadow-amber-950/10">
      {/* Header Row */}
      <button
        type="button"
        className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-amber-500/[0.02] transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center flex-shrink-0">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-bold text-white text-sm">{formatDate(dateStr)}</p>
              <span className="text-[10px] uppercase font-extrabold tracking-wider px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Cath / PCI Procedure
              </span>
              {proc.admissionType && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-gray-300 border border-white/5">
                  {proc.admissionType}
                </span>
              )}
            </div>
            <p className="text-xs text-amber-200/70 mt-0.5">
              Indication: <strong className="text-white">{proc.presentation || 'Coronary Intervention'}</strong>
              {proc.accessSite && ` · ${proc.accessSite}`}
              {proc.operatorName && ` · Dr. ${proc.operatorName}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap justify-end">
          {/* DTB badge for STEMI */}
          {dtb !== null && (
            <span className={cn(
              "text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1",
              dtb <= 90
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
            )}>
              <Clock className="w-3 h-3" /> DTB {dtb}m
            </span>
          )}

          {/* Lesions / Devices */}
          <span className="text-xs text-gray-300 px-2 py-0.5 rounded bg-slate-950/60 border border-white/10">
            {lesions.length} {lesions.length === 1 ? 'Lesion' : 'Lesions'} · {devices.length} {devices.length === 1 ? 'Device' : 'Devices'}
          </span>

          {/* Success Status */}
          {isProcSuccess ? (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
              <Check className="w-3 h-3" /> Procedural Success
            </span>
          ) : (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
              {isAngioSuccess ? 'Angio Success' : 'Diagnostic / Staged'}
            </span>
          )}

          {/* Complications Alert */}
          {hasComplication && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1">
              <ShieldAlert className="w-3 h-3" /> Complication
            </span>
          )}

          {open ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
        </div>
      </button>

      {/* Expanded Detail Drawer */}
      {open && (
        <div className="border-t border-amber-500/15 px-5 py-4 bg-slate-950/60 space-y-4 text-xs">
          {/* Key Metrics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-900/80 p-3 rounded-xl border border-white/5">
              <span className="text-gray-400 text-[10px] uppercase font-semibold block">Access & Closure</span>
              <p className="font-semibold text-white mt-0.5">{proc.accessSite} ({proc.sheathSize || '6F'})</p>
              <p className="text-[11px] text-gray-400">{proc.closureDevice || 'TR Band'}</p>
              {proc.accessCrossover && (
                <p className="text-[10px] text-amber-400 mt-1">Crossover: {proc.crossoverReason || 'Spasm/Anatomy'}</p>
              )}
            </div>

            <div className="bg-slate-900/80 p-3 rounded-xl border border-white/5">
              <span className="text-gray-400 text-[10px] uppercase font-semibold block">Radiation & Contrast</span>
              <p className="font-semibold text-white mt-0.5">{proc.contrastVolumeMl ?? '—'} mL contrast</p>
              <p className="text-[11px] text-gray-400">{proc.fluoroscopyTimeMin ?? (proc as any).fluoroscopyTimeMinutes ?? '—'} min fluoroscopy</p>
              {(proc.doseAreaProduct || (proc as any).doseAreaProductGyCm2) && (
                <p className="text-[10px] text-gray-400">DAP: {proc.doseAreaProduct || (proc as any).doseAreaProductGyCm2} Gy·cm²</p>
              )}
            </div>

            <div className="bg-slate-900/80 p-3 rounded-xl border border-white/5">
              <span className="text-gray-400 text-[10px] uppercase font-semibold block">Coronary Anatomy</span>
              <p className="font-semibold text-white mt-0.5">{proc.dominance || 'Right'} Dominance</p>
              <p className="text-[11px] text-gray-400">Rentrop: {proc.rentropCollaterals || 'Grade 0'}</p>
              <p className="text-[10px] text-gray-400">
                {proc.ivusOctDone ? 'IVUS/OCT ✓' : 'No IVUS'} · {proc.ffrIfrDone ? 'Physiology ✓' : 'No FFR'}
              </p>
            </div>

            <div className="bg-slate-900/80 p-3 rounded-xl border border-white/5">
              <span className="text-gray-400 text-[10px] uppercase font-semibold block">Pharmacology & Support</span>
              <p className="font-semibold text-white mt-0.5">{proc.p2y12Agent || 'Ticagrelor/Clopidogrel'}</p>
              <p className="text-[11px] text-gray-400">{(proc as any).anticoagulant || 'UFH'} {(proc as any).actSeconds ? `(ACT: ${(proc as any).actSeconds}s)` : ''}</p>
              {(proc as any).mcsDevice && (proc as any).mcsDevice !== 'None' && (
                <p className="text-[10px] text-purple-400 font-bold">MCS: {(proc as any).mcsDevice}</p>
              )}
            </div>
          </div>

          {/* Lesions Table */}
          {lesions.length > 0 && (
            <div className="rounded-xl border border-white/10 overflow-hidden">
              <div className="bg-slate-900 px-4 py-2 border-b border-white/10 flex items-center justify-between">
                <span className="font-bold text-gray-200">Intervened Lesions ({lesions.length})</span>
                <span className="text-[11px] text-gray-400">AHA/SYNTAX Segments</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/50 text-gray-400 border-b border-white/5">
                    <tr>
                      <th className="py-2 px-3 font-semibold">Seg / Vessel</th>
                      <th className="py-2 px-3 font-semibold">Pre %</th>
                      <th className="py-2 px-3 font-semibold">Post %</th>
                      <th className="py-2 px-3 font-semibold">Length / RVD</th>
                      <th className="py-2 px-3 font-semibold">TIMI (Pre → Post)</th>
                      <th className="py-2 px-3 font-semibold">Characteristics</th>
                      <th className="py-2 px-3 font-semibold">Result</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {lesions.map((l, i) => (
                      <tr key={l.id || i} className="hover:bg-white/[0.02]">
                        <td className="py-2 px-3 font-bold text-white">
                          Seg {l.segmentNumber} · {l.vessel}
                          {(l.culprit || (l as any).isCulprit) && <span className="ml-1.5 px-1 py-0.2 rounded bg-rose-500/20 text-rose-300 text-[9px] font-bold">Culprit</span>}
                        </td>
                        <td className="py-2 px-3 font-mono text-amber-300">{l.preStenosisPct}%</td>
                        <td className="py-2 px-3 font-mono text-emerald-300">{l.postStenosisPct}%</td>
                        <td className="py-2 px-3 text-gray-300">{(l as any).lesionLengthMm || (l as any).lengthMm || '—'}mm / {(l as any).referenceVesselDiameterMm || (l as any).diameterMm || '—'}mm</td>
                        <td className="py-2 px-3 font-mono">
                          TIMI {l.preTimiFlow} → <span className="text-emerald-400 font-bold">TIMI {l.postTimiFlow}</span>
                        </td>
                        <td className="py-2 px-3 text-gray-400">
                          {l.calcification !== 'None' ? `${l.calcification} Ca²⁺` : 'No Ca²⁺'}
                          {l.bifurcation ? ' · Bifurcation' : ''}
                          {(l.cto || (l as any).chronicTotalOcclusion) ? ' · CTO' : ''}
                        </td>
                        <td className="py-2 px-3">
                          {l.postStenosisPct < 20 && l.postTimiFlow === 3 ? (
                            <span className="text-emerald-400 font-bold flex items-center gap-1">
                              <Check className="w-3 h-3" /> Success
                            </span>
                          ) : (
                            <span className="text-amber-400 font-medium">Sub-optimal</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Hardware & Devices */}
          {devices.length > 0 && (
            <div className="rounded-xl border border-white/10 overflow-hidden">
              <div className="bg-slate-900 px-4 py-2 border-b border-white/10">
                <span className="font-bold text-gray-200">Hardware & Stents Deployed ({devices.length})</span>
              </div>
              <div className="p-3 bg-slate-950/40 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {devices.map((d, i) => (
                  <div key={d.id || i} className="p-2.5 rounded-lg bg-slate-900/90 border border-white/5 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 text-[10px] font-bold">
                        {d.type || (d as any).deviceType}
                      </span>
                      <span className="text-[10px] text-gray-400">Seg {d.targetSegment}</span>
                    </div>
                    <p className="font-semibold text-white text-xs">{d.make || (d as any).brandName} {d.model}</p>
                    <p className="text-[11px] text-gray-300 font-mono">
                      {d.diameterMm}mm × {d.lengthMm}mm @ {d.deploymentPressureAtm || (d as any).maxPressureAtm || 14} atm
                    </p>
                    {d.postDilatation && (
                      <p className="text-[10px] text-purple-300">
                        Post-dil: NC Balloon @ {d.postDilatationPressureAtm || 18} atm
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Complications Detailed Notice */}
          {hasComplication && (
            <div className="p-3.5 bg-rose-500/10 border border-rose-500/25 rounded-xl space-y-1 text-xs">
              <p className="font-bold text-rose-300 flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4" /> Complications Recorded
              </p>
              <div className="space-y-1 mt-1 text-rose-200/90">
                {complications.filter((c: any) => c && c.type !== 'None').map((c: any, i: number) => (
                  <p key={i}>
                    • <strong>{c.type}</strong>
                    {c.severity ? ` (${c.severity})` : ''}
                    {c.notes || c.details ? `: ${c.notes || c.details}` : ''}
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* Discharge & Staged Plan */}
          {((proc.daptAgent || (proc as any).dischargeDaptAgent) || proc.stagedPciPlanned) && (
            <div className="pt-2 border-t border-white/5 flex flex-wrap items-center justify-between gap-2 text-gray-300">
              <div className="flex items-center gap-3">
                {(proc.daptAgent || (proc as any).dischargeDaptAgent) && (
                  <span>DAPT: <strong className="text-white">{proc.daptAgent || (proc as any).dischargeDaptAgent}</strong> ({proc.daptPlannedDurationMonths || 12} mos)</span>
                )}
                {(proc.statinIntensity || (proc as any).dischargeStatinIntensity) && (
                  <span>Statin: <strong className="text-white">{proc.statinIntensity || (proc as any).dischargeStatinIntensity}</strong></span>
                )}
              </div>
              {proc.stagedPciPlanned && (
                <span className="text-amber-400 font-medium">
                  Staged PCI Scheduled: {proc.stagedPciDate || 'Within 6 weeks'}
                </span>
              )}
            </div>
          )}

          {/* Action Row */}
          <div className="mt-4 pt-3 border-t border-white/5 flex justify-end gap-2">
            {onEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onEdit(proc)}
                className="text-xs border-amber-500/30 text-amber-300 hover:bg-amber-500/10"
              >
                <Edit2 className="w-3.5 h-3.5" /> Edit Procedure
              </Button>
            )}
            {onDelete && (
              <Button
                variant="danger"
                size="sm"
                onClick={() => onDelete(proc.id)}
                className="text-xs"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete Procedure
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, unit }: { label: string; value?: number | null; unit?: string }) {
  if (value == null) return null
  return (
    <div>
      <p className="text-xs text-gray-400">{label}</p>
      <p className="text-sm font-semibold text-gray-200">
        {value} <span className="text-xs font-normal text-gray-400">{unit}</span>
      </p>
    </div>
  )
}

function MedChip({ label, dose }: { label: string; dose?: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-500/10 text-blue-300 border border-blue-500/20 rounded-lg text-xs">
      {label}{dose ? <span className="font-semibold text-white">· {dose}</span> : null}
    </span>
  )
}

export default function VisitTimeline({
  visits,
  procedures = [],
  patientId,
  onDelete,
  onDeleteProcedure,
  onEditProcedure,
  onAddProcedure,
  isConsentGated = false
}: Props) {
  // Combine visits and procedures chronologically descending
  const timelineItems = React.useMemo(() => {
    const items: TimelineItem[] = []

    visits.forEach(v => {
      items.push({
        kind: 'visit',
        id: v.id,
        date: v.visitDate,
        data: v,
      })
    })

    procedures.forEach(p => {
      items.push({
        kind: 'procedure',
        id: p.id,
        date: p.procedureDateTime || p.procedureDate || '',
        data: p,
      })
    })

    return items.sort((a, b) => {
      const ta = a.date ? new Date(a.date).getTime() : 0
      const tb = b.date ? new Date(b.date).getTime() : 0
      return tb - ta
    })
  }, [visits, procedures])

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="font-bold text-white text-base flex items-center gap-2">
            Clinical Encounters &amp; Interventions
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-gray-300 border border-white/10 font-normal">
              {timelineItems.length} Total ({visits.length} Visits · {procedures.length} Procedures)
            </span>
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Integrated chronological record of outpatient evaluations and cath lab procedures.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Add Procedure Button */}
          {onAddProcedure && (
            isConsentGated ? (
              <button
                disabled
                className="btn-outline btn-sm opacity-40 cursor-not-allowed flex items-center gap-1.5"
                title="Cannot log procedure while consent is pending/declined"
              >
                <Activity className="w-4 h-4" /> Log Cath / PCI
              </button>
            ) : (
              <Button
                size="sm"
                onClick={onAddProcedure}
                className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-1.5"
              >
                <Activity className="w-4 h-4" /> Log Cath / PCI
              </Button>
            )
          )}

          {/* Record Visit Link */}
          {isConsentGated ? (
            <button
              disabled
              className="btn-outline btn-sm opacity-40 cursor-not-allowed flex items-center gap-1.5"
              title="Cannot record visit while consent is pending/declined"
            >
              <PlusCircle className="w-4 h-4" /> Record Visit
            </button>
          ) : (
            <Link href={`/patients/${patientId}/visits/new`}>
              <Button size="sm" className="btn-primary text-xs flex items-center gap-1.5">
                <PlusCircle className="w-4 h-4" /> Record Visit
              </Button>
            </Link>
          )}
        </div>
      </div>

      {timelineItems.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-white/10 rounded-2xl bg-slate-950/40 p-8 space-y-3">
          <Stethoscope className="w-10 h-10 text-gray-500 mx-auto" />
          <h4 className="text-base font-bold text-white">No Encounters Recorded Yet</h4>
          <p className="text-gray-400 text-xs max-w-md mx-auto">
            This patient has no clinical OPD visits or Cath Lab procedures logged in the registry.
          </p>
          <div className="flex justify-center gap-3 pt-2">
            {!isConsentGated && onAddProcedure && (
              <Button size="sm" onClick={onAddProcedure} className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs">
                Log First Procedure
              </Button>
            )}
            {!isConsentGated && (
              <Link href={`/patients/${patientId}/visits/new`}>
                <Button size="sm" className="btn-primary text-xs">
                  Record First Visit
                </Button>
              </Link>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {timelineItems.map(item => {
            if (item.kind === 'visit') {
              return <VisitCard key={item.id} visit={item.data} onDelete={onDelete} />
            }
            return (
              <ProcedureCard
                key={item.id}
                proc={item.data}
                onEdit={onEditProcedure}
                onDelete={onDeleteProcedure}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
