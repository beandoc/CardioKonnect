'use client'
import { useState } from 'react'
import {
  Heart, Activity, Zap, Shield, AlertCircle, CheckCircle,
  Plus, Edit3, X, Check, Droplet, Flame, Stethoscope
} from 'lucide-react'
import type { Patient } from '@/lib/types'
import { updatePatient } from '@/lib/firestore'
import { toast } from 'sonner'
import Button from '@/components/ui/Button'

interface ComorbidityDefinition {
  key: keyof Patient
  label: string
  code: string
  category: 'Cardiovascular' | 'Metabolic' | 'Renal & Respiratory' | 'Other'
  description: string
  icon: any
  color: string
}

const COMORBIDITY_DEFINITIONS: ComorbidityDefinition[] = [
  {
    key: 'comorbidDiabetes',
    label: 'Type 2 Diabetes Mellitus (T2D)',
    code: 'ICD-10 E11',
    category: 'Metabolic',
    description: 'Diagnosed DM or on antidiabetic therapy (SGLT2i / Metformin / Insulin)',
    icon: Flame,
    color: '#f59e0b',
  },
  {
    key: 'comorbidCAD',
    label: 'Coronary Artery Disease (CAD)',
    code: 'ICD-10 I25',
    category: 'Cardiovascular',
    description: 'Angiographic CAD, ischemic cardiomyopathy, or prior revascularization',
    icon: Heart,
    color: '#ef4444',
  },
  {
    key: 'comorbidPriorMI',
    label: 'Prior Myocardial Infarction',
    code: 'ICD-10 I21',
    category: 'Cardiovascular',
    description: 'Documented prior STEMI / NSTEMI with myocardial scar',
    icon: Zap,
    color: '#f43f5e',
  },
  {
    key: 'comorbidPriorPCI',
    label: 'Prior PCI / Stenting',
    code: 'CathLab',
    category: 'Cardiovascular',
    description: 'History of percutaneous coronary intervention with stent',
    icon: Activity,
    color: '#fb7185',
  },
  {
    key: 'comorbidPriorCABG',
    label: 'Prior CABG Surgery',
    code: 'Surgical',
    category: 'Cardiovascular',
    description: 'History of coronary artery bypass grafting',
    icon: Shield,
    color: '#e11d48',
  },
  {
    key: 'comorbidHypertension',
    label: 'Hypertension (HTN)',
    code: 'ICD-10 I10',
    category: 'Cardiovascular',
    description: 'Essential hypertension or on antihypertensive therapy',
    icon: Activity,
    color: '#3b82f6',
  },
  {
    key: 'comorbidDyslipidemia',
    label: 'Dyslipidemia / Hypercholesterolemia',
    code: 'ICD-10 E78',
    category: 'Metabolic',
    description: 'Elevated LDL/TG or on lipid-lowering therapy (statin/ezetimibe)',
    icon: Droplet,
    color: '#a855f7',
  },
  {
    key: 'comorbidCKD',
    label: 'Chronic Kidney Disease (CKD)',
    code: 'ICD-10 N18',
    category: 'Renal & Respiratory',
    description: 'Documented renal disease, eGFR <60, or persistent albuminuria',
    icon: Droplet,
    color: '#06b6d4',
  },
  {
    key: 'comorbidAF',
    label: 'Atrial Fibrillation / Flutter',
    code: 'ICD-10 I48',
    category: 'Cardiovascular',
    description: 'Paroxysmal, persistent, or permanent AF (stroke risk indicator)',
    icon: Zap,
    color: '#8b5cf6',
  },
  {
    key: 'comorbidCOPD',
    label: 'COPD / Chronic Airway Disease',
    code: 'ICD-10 J44',
    category: 'Renal & Respiratory',
    description: 'Chronic obstructive pulmonary disease or severe asthma',
    icon: Stethoscope,
    color: '#10b981',
  },
  {
    key: 'comorbidStrokeTIA',
    label: 'Stroke / TIA History',
    code: 'ICD-10 I63',
    category: 'Cardiovascular',
    description: 'Prior ischemic stroke or transient ischemic attack',
    icon: Shield,
    color: '#ec4899',
  },
  {
    key: 'comorbidPAD',
    label: 'Peripheral Artery Disease (PAD)',
    code: 'ICD-10 I73',
    category: 'Cardiovascular',
    description: 'Lower extremity peripheral vascular disease or claudication',
    icon: Activity,
    color: '#14b8a6',
  },
]

interface ComorbiditiesMatrixProps {
  patient: Patient
  onRefresh: () => void
}

export default function ComorbiditiesMatrix({ patient, onRefresh }: ComorbiditiesMatrixProps) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  // Local state for all discrete flags
  const [flags, setFlags] = useState<Record<string, boolean>>(() => {
    const rawList = Array.isArray(patient.comorbidities) ? patient.comorbidities : []
    const rawUpper = rawList.map(s => String(s).toUpperCase())

    return {
      comorbidDiabetes: Boolean(patient.comorbidDiabetes ?? (rawUpper.some(s => s.includes('DM') || s.includes('DIABETES')))),
      comorbidCAD: Boolean(patient.comorbidCAD ?? (rawUpper.some(s => s.includes('CAD') || s.includes('CORONARY') || s.includes('ISCHEMIC')))),
      comorbidPriorMI: Boolean(patient.comorbidPriorMI ?? (rawUpper.some(s => s.includes('MI') || s.includes('INFARCT')))),
      comorbidPriorPCI: Boolean(patient.comorbidPriorPCI ?? (rawUpper.some(s => s.includes('PCI') || s.includes('STENT')))),
      comorbidPriorCABG: Boolean(patient.comorbidPriorCABG ?? (rawUpper.some(s => s.includes('CABG') || s.includes('BYPASS')))),
      comorbidHypertension: Boolean(patient.comorbidHypertension ?? (rawUpper.some(s => s.includes('HTN') || s.includes('HYPERTENSION')))),
      comorbidDyslipidemia: Boolean(patient.comorbidDyslipidemia ?? (rawUpper.some(s => s.includes('LIPID') || s.includes('DYSLIPIDEMIA')))),
      comorbidCKD: Boolean(patient.comorbidCKD ?? (rawUpper.some(s => s.includes('CKD') || s.includes('KIDNEY') || s.includes('RENAL')))),
      comorbidAF: Boolean(patient.comorbidAF ?? (rawUpper.some(s => s.includes('AF') || s.includes('ATRIAL FIBRILLATION')))),
      comorbidCOPD: Boolean(patient.comorbidCOPD ?? (rawUpper.some(s => s.includes('COPD') || s.includes('ASTHMA')))),
      comorbidStrokeTIA: Boolean(patient.comorbidStrokeTIA ?? (rawUpper.some(s => s.includes('STROKE') || s.includes('TIA')))),
      comorbidPAD: Boolean(patient.comorbidPAD ?? (rawUpper.some(s => s.includes('PAD') || s.includes('PERIPHERAL')))),
    }
  })

  const toggleFlag = (key: string) => {
    setFlags(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const handleSave = async () => {
    setSaving(true)
    const toastId = toast.loading('Saving discrete comorbidity fields...')

    try {
      // Rebuild normalized string list for backward compatibility
      const updatedList: string[] = []
      if (flags.comorbidHypertension) updatedList.push('HTN')
      if (flags.comorbidDiabetes) updatedList.push('DM2')
      if (flags.comorbidCAD) updatedList.push('CAD')
      if (flags.comorbidPriorMI) updatedList.push('Prior MI')
      if (flags.comorbidPriorPCI) updatedList.push('Prior PCI')
      if (flags.comorbidPriorCABG) updatedList.push('Prior CABG')
      if (flags.comorbidDyslipidemia) updatedList.push('Dyslipidemia')
      if (flags.comorbidCKD) updatedList.push('CKD')
      if (flags.comorbidAF) updatedList.push('AF')
      if (flags.comorbidCOPD) updatedList.push('COPD')
      if (flags.comorbidStrokeTIA) updatedList.push('Stroke / TIA')
      if (flags.comorbidPAD) updatedList.push('PAD')

      await updatePatient(patient.id, {
        comorbidDiabetes: flags.comorbidDiabetes,
        comorbidCAD: flags.comorbidCAD,
        comorbidPriorMI: flags.comorbidPriorMI,
        comorbidPriorPCI: flags.comorbidPriorPCI,
        comorbidPriorCABG: flags.comorbidPriorCABG,
        comorbidHypertension: flags.comorbidHypertension,
        comorbidDyslipidemia: flags.comorbidDyslipidemia,
        comorbidCKD: flags.comorbidCKD,
        comorbidAF: flags.comorbidAF,
        comorbidCOPD: flags.comorbidCOPD,
        comorbidStrokeTIA: flags.comorbidStrokeTIA,
        comorbidPAD: flags.comorbidPAD,
        comorbidities: updatedList,
      })

      toast.success('Discrete comorbidity variables saved to database!', { id: toastId })
      setEditing(false)
      onRefresh()
    } catch (err) {
      console.error('Failed to save comorbidities:', err)
      toast.error('Failed to save. Check your connection.', { id: toastId })
    } finally {
      setSaving(false)
    }
  }

  const activeCount = Object.values(flags).filter(Boolean).length

  return (
    <div className="glass-card p-5 border border-blue-500/20 shadow-xl space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-blue-500/10 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-rose-400" />
              Granular Comorbidities &amp; Clinical Variables
            </h3>
            <span className="badge badge-blue text-[10px] font-mono font-bold">
              {activeCount} active conditions
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            Discrete variables queryable by logical engines, risk models (MAGGIC, CHA₂DS₂-VASc), and clinical alerts.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <button
                onClick={() => setEditing(false)}
                className="px-3 py-1.5 rounded-lg text-xs text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
              <Button size="sm" onClick={handleSave} disabled={saving} className="btn-primary">
                <Check className="w-3.5 h-3.5" /> {saving ? 'Saving...' : 'Save Variables'}
              </Button>
            </>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
              <Edit3 className="w-3.5 h-3.5" /> Edit Comorbidities
            </Button>
          )}
        </div>
      </div>

      {/* Discrete Variables Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {COMORBIDITY_DEFINITIONS.map(item => {
          const isPresent = Boolean(flags[item.key as string])
          const Icon = item.icon

          return (
            <div
              key={item.key as string}
              onClick={() => {
                if (editing) toggleFlag(item.key as string)
              }}
              className={`p-3 rounded-xl border transition-all ${
                editing ? 'cursor-pointer hover:scale-[1.02]' : ''
              } ${
                isPresent
                  ? 'bg-slate-900/80 border-blue-500/30 shadow-md'
                  : 'bg-slate-950/40 border-gray-800/60 opacity-60'
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-2">
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{
                      backgroundColor: isPresent ? `${item.color}20` : 'rgba(100,116,139,0.1)',
                      color: isPresent ? item.color : '#94a3b8',
                      border: `1px solid ${isPresent ? `${item.color}40` : 'rgba(100,116,139,0.2)'}`,
                    }}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-[10px] font-mono text-gray-400">{item.code}</span>
                </div>

                {editing ? (
                  <input
                    type="checkbox"
                    checked={isPresent}
                    onChange={() => toggleFlag(item.key as string)}
                    className="w-4 h-4 rounded text-blue-600 bg-gray-900 border-gray-700 cursor-pointer"
                  />
                ) : (
                  <span
                    className={`badge text-[9px] font-bold ${
                      isPresent ? 'badge-green' : 'badge-gray'
                    }`}
                  >
                    {isPresent ? 'Present' : 'Absent'}
                  </span>
                )}
              </div>

              <p className="text-xs font-bold text-white leading-snug">{item.label}</p>
              <p className="text-[10px] text-gray-400 mt-1 line-clamp-2 leading-tight">
                {item.description}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
