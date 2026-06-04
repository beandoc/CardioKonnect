'use client'
import Link from 'next/link'
import type { Visit } from '@/lib/types'
import { formatDate, nyhaBadgeColor, lvefColor } from '@/lib/utils'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import { PlusCircle, Stethoscope, ChevronDown, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'

interface Props {
  visits: Visit[]
  patientId: string
  onDelete?: (visitId: string) => void
}

function VisitCard({ visit, onDelete }: { visit: Visit; onDelete?: (id: string) => void }) {
  const [open, setOpen] = useState(false)

  const nyhaColors: Record<string, string> = {
    I: 'green', II: 'blue', III: 'amber', IV: 'red',
  }

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white hover:border-blue-200 transition-colors">
      {/* Header row */}
      <button
        type="button"
        className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
            <Stethoscope className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="font-semibold text-gray-800 text-sm">{formatDate(visit.visitDate)}</p>
            <p className="text-xs text-gray-400">{visit.visitType || 'OPD'}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap justify-end">
          {visit.nyha && (
            <Badge variant={(nyhaColors[visit.nyha] ?? 'gray') as 'green' | 'blue' | 'amber' | 'red' | 'gray'}>
              NYHA {visit.nyha}
            </Badge>
          )}
          {visit.hfType && <Badge variant="blue">{visit.hfType}</Badge>}
          {visit.lvef != null && (
            <span className={cn('text-sm font-bold', lvefColor(visit.lvef))}>
              LVEF {visit.lvef}%
            </span>
          )}
          {visit.bpSystolic && visit.bpDiastolic && (
            <span className="text-xs text-gray-500">{visit.bpSystolic}/{visit.bpDiastolic} mmHg</span>
          )}
          {open ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
        </div>
      </button>

      {/* Expanded detail */}
      {open && (
        <div className="border-t border-gray-100 px-5 py-4">
          <div className="grid grid-cols-4 gap-4 mb-4">
            <Stat label="NT-proBNP" value={visit.ntProBNP} unit="pg/mL" />
            <Stat label="eGFR" value={visit.egfr} unit="ml/min/1.73m²" />
            <Stat label="Potassium" value={visit.potassium} unit="mmol/L" />
            <Stat label="6MWT" value={visit.sixMWT} unit="m" />
            <Stat label="HR" value={visit.heartRate} unit="bpm" />
            <Stat label="Weight" value={visit.weight} unit="kg" />
            <Stat label="Hb" value={visit.hb} unit="g/dL" />
            <Stat label="HbA1c" value={visit.hba1c} unit="%" />
          </div>

          {/* Medications summary */}
          <div className="mt-3 pt-3 border-t border-gray-100">
            <p className="text-xs font-semibold text-gray-500 mb-2">Active Medications</p>
            <div className="flex flex-wrap gap-2">
              {visit.diuretic?.prescribed === 'Yes' && <MedChip label={`Diuretic${visit.diuretic.type ? ': '+visit.diuretic.type : ''}`} dose={visit.diuretic.dose} />}
              {visit.raasi?.prescribed === 'Yes' && <MedChip label={`RAASi${visit.raasi.type ? ': '+visit.raasi.type : ''}`} dose={visit.raasi.dose} />}
              {visit.betaBlocker?.prescribed === 'Yes' && <MedChip label={`BB${visit.betaBlocker.type ? ': '+visit.betaBlocker.type : ''}`} dose={visit.betaBlocker.dose} />}
              {visit.mra?.prescribed === 'Yes' && <MedChip label={`MRA${visit.mra.type ? ': '+visit.mra.type : ''}`} dose={visit.mra.dose} />}
              {visit.sglt2i?.prescribed === 'Yes' && <MedChip label={`SGLT2i${visit.sglt2i.type ? ': '+visit.sglt2i.type : ''}`} dose={visit.sglt2i.dose} />}
              {visit.ivabradine?.prescribed === 'Yes' && <MedChip label="Ivabradine" dose={visit.ivabradine.dose} />}
              {visit.digoxin?.prescribed === 'Yes' && <MedChip label="Digoxin" dose={visit.digoxin.dose} />}
              {visit.noac?.prescribed === 'Yes' && <MedChip label={`NOAC: ${visit.noac.type || ''}`} dose={visit.noac.dose} />}
            </div>
          </div>

          {/* Device */}
          {(visit.device?.length ?? 0) > 0 && (
            <div className="mt-2 flex gap-2 flex-wrap">
              {visit.device!.map(d => (
                <span key={d} className="px-2 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 rounded-full text-xs font-medium">{d}</span>
              ))}
            </div>
          )}

          {/* Valvular Hemodynamics */}
          {(visit.valvularHemodynamics && Object.values(visit.valvularHemodynamics).some(v => v != null)) && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-500 mb-2">Valvular Hemodynamics</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                {visit.asGrade && <div><span className="text-gray-400">AS Grade:</span> <span className="font-semibold text-gray-700">{visit.asGrade}</span></div>}
                {visit.valvularHemodynamics.asAVA && <div><span className="text-gray-400">AVA:</span> <span className="font-semibold text-gray-700">{visit.valvularHemodynamics.asAVA} cm²</span></div>}
                {visit.valvularHemodynamics.asMeanGradient && <div><span className="text-gray-400">AS Mean Grad:</span> <span className="font-semibold text-gray-700">{visit.valvularHemodynamics.asMeanGradient} mmHg</span></div>}
                {visit.valvularHemodynamics.asVmax && <div><span className="text-gray-400">AS Vmax:</span> <span className="font-semibold text-gray-700">{visit.valvularHemodynamics.asVmax} m/s</span></div>}
                
                {visit.msGrade && <div><span className="text-gray-400">MS Grade:</span> <span className="font-semibold text-gray-700">{visit.msGrade}</span></div>}
                {visit.valvularHemodynamics.msMVA && <div><span className="text-gray-400">MVA:</span> <span className="font-semibold text-gray-700">{visit.valvularHemodynamics.msMVA} cm²</span></div>}
                {visit.valvularHemodynamics.msMeanGradient && <div><span className="text-gray-400">MS Mean Grad:</span> <span className="font-semibold text-gray-700">{visit.valvularHemodynamics.msMeanGradient} mmHg</span></div>}

                {visit.mrGrade && <div><span className="text-gray-400">MR Grade:</span> <span className="font-semibold text-gray-700">{visit.mrGrade}</span></div>}
                {visit.valvularHemodynamics.mrRegurgitantVolume && <div><span className="text-gray-400">MR Regurg. Vol:</span> <span className="font-semibold text-gray-700">{visit.valvularHemodynamics.mrRegurgitantVolume} mL</span></div>}
                {visit.valvularHemodynamics.mrEROA && <div><span className="text-gray-400">MR EROA:</span> <span className="font-semibold text-gray-700">{visit.valvularHemodynamics.mrEROA} mm²</span></div>}

                {visit.arGrade && <div><span className="text-gray-400">AR Grade:</span> <span className="font-semibold text-gray-700">{visit.arGrade}</span></div>}
                {visit.valvularHemodynamics.arRegurgitantVolume && <div><span className="text-gray-400">AR Regurg. Vol:</span> <span className="font-semibold text-gray-700">{visit.valvularHemodynamics.arRegurgitantVolume} mL</span></div>}
                {visit.valvularHemodynamics.arEROA && <div><span className="text-gray-400">AR EROA:</span> <span className="font-semibold text-gray-700">{visit.valvularHemodynamics.arEROA} mm²</span></div>}
              </div>
            </div>
          )}

          {/* Coronary Anatomy */}
          {(visit.coronaryAnatomy && Object.values(visit.coronaryAnatomy).some(v => v !== undefined && v !== '')) && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-500 mb-2">Coronary Anatomy & Prior Interventions</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                {visit.coronaryAnatomy.lmStenosis && <div><span className="text-gray-400">LM Stenosis:</span> <span className="font-semibold text-gray-700">{visit.coronaryAnatomy.lmStenosis}%</span></div>}
                {visit.coronaryAnatomy.ladStenosis && <div><span className="text-gray-400">LAD Stenosis:</span> <span className="font-semibold text-gray-700">{visit.coronaryAnatomy.ladStenosis}%</span></div>}
                {visit.coronaryAnatomy.lcxStenosis && <div><span className="text-gray-400">LCx Stenosis:</span> <span className="font-semibold text-gray-700">{visit.coronaryAnatomy.lcxStenosis}%</span></div>}
                {visit.coronaryAnatomy.rcaStenosis && <div><span className="text-gray-400">RCA Stenosis:</span> <span className="font-semibold text-gray-700">{visit.coronaryAnatomy.rcaStenosis}%</span></div>}
                {visit.coronaryAnatomy.syntaxScore && <div><span className="text-gray-400">SYNTAX Score:</span> <span className="font-semibold text-red-600">{visit.coronaryAnatomy.syntaxScore}</span></div>}
                {visit.coronaryAnatomy.revascularizationType && <div><span className="text-gray-400">Prior Revascularization:</span> <span className="font-semibold text-gray-700">{visit.coronaryAnatomy.revascularizationType}</span></div>}
                {visit.coronaryAnatomy.priorPciDate && <div><span className="text-gray-400">PCI Date:</span> <span className="font-semibold text-gray-700">{visit.coronaryAnatomy.priorPciDate}</span></div>}
                {visit.coronaryAnatomy.priorCabgDate && <div><span className="text-gray-400">CABG Date:</span> <span className="font-semibold text-gray-700">{visit.coronaryAnatomy.priorCabgDate}</span></div>}
              </div>
            </div>
          )}

          {/* QoL & Trajectory */}
          {((visit.eq5d && Object.values(visit.eq5d).some(v => v !== undefined && v !== '')) || visit.symptomTrajectory) && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-500 mb-2">Symptom Trajectory & EQ-5D-5L</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                {visit.symptomTrajectory && <div><span className="text-gray-400">Symptom Trajectory:</span> <span className={cn('font-bold', visit.symptomTrajectory === 'Improving' ? 'text-green-600' : visit.symptomTrajectory === 'Worsening' ? 'text-red-600' : 'text-blue-600')}>{visit.symptomTrajectory}</span></div>}
                {visit.eq5d?.healthStateScore != null && <div><span className="text-gray-400">EQ-VAS Score:</span> <span className="font-semibold text-gray-700">{visit.eq5d.healthStateScore}/100</span></div>}
                {visit.eq5d?.mobility && <div><span className="text-gray-400">Mobility:</span> <span className="font-semibold text-gray-700">{visit.eq5d.mobility}/5</span></div>}
                {visit.eq5d?.selfCare && <div><span className="text-gray-400">Self-Care:</span> <span className="font-semibold text-gray-700">{visit.eq5d.selfCare}/5</span></div>}
                {visit.eq5d?.usualActivities && <div><span className="text-gray-400">Usual Activities:</span> <span className="font-semibold text-gray-700">{visit.eq5d.usualActivities}/5</span></div>}
                {visit.eq5d?.painDiscomfort && <div><span className="text-gray-400">Pain/Discomfort:</span> <span className="font-semibold text-gray-700">{visit.eq5d.painDiscomfort}/5</span></div>}
                {visit.eq5d?.anxietyDepression && <div><span className="text-gray-400">Anxiety/Depression:</span> <span className="font-semibold text-gray-700">{visit.eq5d.anxietyDepression}/5</span></div>}
              </div>
            </div>
          )}

          {/* Notes */}
          {visit.clinicalNotes && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-500 mb-1">Clinical Notes</p>
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{visit.clinicalNotes}</p>
            </div>
          )}

          <div className="mt-3 pt-3 border-t border-gray-100 flex justify-end gap-2">
            {onDelete && (
              <Button
                variant="danger"
                size="sm"
                onClick={() => onDelete(visit.id)}
              >
                Delete Visit
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
      <p className="text-sm font-semibold text-gray-700">{value} <span className="text-xs font-normal text-gray-400">{unit}</span></p>
    </div>
  )
}

function MedChip({ label, dose }: { label: string; dose?: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-100 rounded-lg text-xs">
      {label}{dose ? <span className="font-semibold">· {dose}</span> : null}
    </span>
  )
}

export default function VisitTimeline({ visits, patientId, onDelete }: Props) {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-800">Visit History ({visits.length})</h3>
        <Link href={`/patients/${patientId}/visits/new`}>
          <Button size="sm">
            <PlusCircle className="w-4 h-4" /> Record Visit
          </Button>
        </Link>
      </div>

      {visits.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl">
          <Stethoscope className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">No visits recorded yet</p>
          <Link href={`/patients/${patientId}/visits/new`}>
            <Button className="mt-3" size="sm">Record first visit</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {visits.map(v => (
            <VisitCard key={v.id} visit={v} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  )
}
