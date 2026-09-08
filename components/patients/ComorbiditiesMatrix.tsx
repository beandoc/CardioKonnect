'use client'
import { useState, useRef, useEffect } from 'react'
import {
  Heart, Activity, Zap, Shield, ChevronDown, Check,
  Droplet, Flame, Stethoscope, Search, X, Plus, Sparkles
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
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [saving, setSaving] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Local state for flags
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

  // Sync when patient prop changes
  useEffect(() => {
    const rawList = Array.isArray(patient.comorbidities) ? patient.comorbidities : []
    const rawUpper = rawList.map(s => String(s).toUpperCase())

    setFlags({
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
    })
  }, [patient])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const toggleFlag = (key: string) => {
    setFlags(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const handleSave = async (customFlags?: Record<string, boolean>) => {
    const targetFlags = customFlags || flags
    setSaving(true)
    const toastId = toast.loading('Saving comorbidities...')

    try {
      const updatedList: string[] = []
      if (targetFlags.comorbidHypertension) updatedList.push('HTN')
      if (targetFlags.comorbidDiabetes) updatedList.push('DM2')
      if (targetFlags.comorbidCAD) updatedList.push('CAD')
      if (targetFlags.comorbidPriorMI) updatedList.push('Prior MI')
      if (targetFlags.comorbidPriorPCI) updatedList.push('Prior PCI')
      if (targetFlags.comorbidPriorCABG) updatedList.push('Prior CABG')
      if (targetFlags.comorbidDyslipidemia) updatedList.push('Dyslipidemia')
      if (targetFlags.comorbidCKD) updatedList.push('CKD')
      if (targetFlags.comorbidAF) updatedList.push('AF')
      if (targetFlags.comorbidCOPD) updatedList.push('COPD')
      if (targetFlags.comorbidStrokeTIA) updatedList.push('Stroke / TIA')
      if (targetFlags.comorbidPAD) updatedList.push('PAD')

      await updatePatient(patient.id, {
        comorbidDiabetes: targetFlags.comorbidDiabetes,
        comorbidCAD: targetFlags.comorbidCAD,
        comorbidPriorMI: targetFlags.comorbidPriorMI,
        comorbidPriorPCI: targetFlags.comorbidPriorPCI,
        comorbidPriorCABG: targetFlags.comorbidPriorCABG,
        comorbidHypertension: targetFlags.comorbidHypertension,
        comorbidDyslipidemia: targetFlags.comorbidDyslipidemia,
        comorbidCKD: targetFlags.comorbidCKD,
        comorbidAF: targetFlags.comorbidAF,
        comorbidCOPD: targetFlags.comorbidCOPD,
        comorbidStrokeTIA: targetFlags.comorbidStrokeTIA,
        comorbidPAD: targetFlags.comorbidPAD,
        comorbidities: updatedList,
      })

      toast.success('Comorbidities updated successfully!', { id: toastId })
      setIsOpen(false)
      onRefresh()
    } catch (err) {
      console.error('Failed to save comorbidities:', err)
      toast.error('Failed to save. Check connection.', { id: toastId })
    } finally {
      setSaving(false)
    }
  }

  const removeSingle = async (key: string) => {
    const updated = { ...flags, [key]: false }
    setFlags(updated)
    await handleSave(updated)
  }

  const activeDefinitions = COMORBIDITY_DEFINITIONS.filter(def => Boolean(flags[def.key as string]))
  const filteredDefinitions = COMORBIDITY_DEFINITIONS.filter(def =>
    def.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
    def.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    def.description.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="glass-card p-4 border border-blue-500/20 shadow-md relative" ref={dropdownRef}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-rose-400" />
          <h3 className="text-sm font-bold text-white">Comorbidities</h3>
          <span className="badge badge-blue text-[10px] font-mono font-bold">
            {activeDefinitions.length} selected
          </span>
        </div>

        {/* Dropdown Toggle Button */}
        <div className="relative">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center gap-1.5 text-xs py-1.5 px-3 bg-slate-900/80 border-blue-500/30 hover:border-blue-400 hover:bg-blue-950/40 text-blue-300 font-semibold"
          >
            <Plus className="w-3.5 h-3.5 text-blue-400" />
            Select Comorbidities
            <ChevronDown className={`w-3.5 h-3.5 ml-1 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </Button>

          {/* Multi-Select Dropdown Popover */}
          {isOpen && (
            <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 glass-card p-3 border border-blue-500/30 shadow-2xl z-50 animate-fade-in bg-slate-950/95 backdrop-blur-xl">
              <div className="flex items-center justify-between border-b border-blue-500/15 pb-2 mb-2">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-cyan-400" /> Select Comorbidities
                </span>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-1 text-gray-400 hover:text-white rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Search Bar */}
              <div className="relative mb-2.5">
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder="Filter conditions (e.g. DM, CAD, CKD)..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg bg-slate-900 border border-blue-500/20 text-white placeholder-gray-500 focus:outline-none focus:border-blue-400"
                />
              </div>

              {/* Dropdown Options List */}
              <div className="max-h-60 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                {filteredDefinitions.length === 0 ? (
                  <p className="text-xs text-gray-500 text-center py-4">No matching condition found.</p>
                ) : (
                  filteredDefinitions.map(item => {
                    const isChecked = Boolean(flags[item.key as string])
                    const Icon = item.icon
                    return (
                      <div
                        key={item.key as string}
                        onClick={() => toggleFlag(item.key as string)}
                        className={`p-2 rounded-lg border text-xs flex items-center justify-between cursor-pointer transition-colors ${
                          isChecked
                            ? 'bg-blue-950/50 border-blue-500/40 text-white'
                            : 'bg-slate-900/40 border-gray-800/60 text-gray-300 hover:bg-slate-900/80 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 pr-2">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleFlag(item.key as string)}
                            className="w-3.5 h-3.5 rounded text-blue-600 bg-gray-900 border-gray-700 cursor-pointer flex-shrink-0"
                          />
                          <div className="min-w-0">
                            <p className="font-semibold text-xs leading-tight truncate">{item.label}</p>
                            <span className="text-[10px] text-gray-400 font-mono">{item.code}</span>
                          </div>
                        </div>

                        {isChecked && (
                          <span className="text-[10px] font-bold text-cyan-400 flex items-center gap-1 flex-shrink-0">
                            <Check className="w-3 h-3" /> Active
                          </span>
                        )}
                      </div>
                    )
                  })
                )}
              </div>

              {/* Popover Footer */}
              <div className="flex items-center justify-between pt-2.5 mt-2.5 border-t border-blue-500/15">
                <button
                  type="button"
                  onClick={() => {
                    const cleared: Record<string, boolean> = {}
                    COMORBIDITY_DEFINITIONS.forEach(d => { cleared[d.key as string] = false })
                    setFlags(cleared)
                  }}
                  className="text-[11px] text-gray-400 hover:text-rose-400 transition-colors"
                >
                  Clear all
                </button>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleSave()}
                    disabled={saving}
                    className="btn-primary text-xs py-1 px-3"
                  >
                    <Check className="w-3.5 h-3.5 mr-1" />
                    {saving ? 'Saving...' : 'Apply & Save'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Selected Comorbidities Compact Pill Badges Display */}
      {activeDefinitions.length === 0 ? (
        <div className="py-2 px-3 rounded-lg bg-slate-950/40 border border-gray-800/40 text-xs text-gray-400 flex items-center justify-between">
          <span>No comorbidities currently documented for this patient.</span>
          <button
            onClick={() => setIsOpen(true)}
            className="text-xs text-blue-400 hover:text-blue-300 font-semibold"
          >
            + Add Comorbidity
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {activeDefinitions.map(item => {
            const Icon = item.icon
            return (
              <span
                key={item.key as string}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-900/90 border border-blue-500/30 text-white shadow-sm hover:border-blue-400/60 transition-colors group"
              >
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: item.color }}
                />
                <span>{item.label}</span>
                <span className="text-[10px] font-mono text-gray-400 bg-slate-800 px-1 py-0.5 rounded">
                  {item.code}
                </span>
                <button
                  type="button"
                  onClick={() => removeSingle(item.key as string)}
                  title={`Remove ${item.label}`}
                  className="text-gray-500 hover:text-rose-400 ml-1 p-0.5 rounded transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}
