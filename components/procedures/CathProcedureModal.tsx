'use client'
import { useState, useEffect } from 'react'
import {
  X, Check, AlertCircle, Save, Activity, Heart, ShieldAlert,
  Clock, Plus, Trash2, ShieldCheck, ChevronRight, Stethoscope
} from 'lucide-react'
import { addCathProcedure, updateCathProcedure } from '@/lib/firestore'
import {
  CORONARY_SEGMENTS, type CoronarySegmentId,
  type Patient, type CathProcedure, type CathProcedureInput, type CathLesion, type CathDevice,
  type CathProcedureType, type ClinicalIndication, type AccessSite, type CoronaryVessel, type TimiFlow
} from '@/lib/types'
import { toast } from 'sonner'
import Button from '@/components/ui/Button'

interface CathProcedureModalProps {
  isOpen: boolean
  onClose: () => void
  patient: Patient
  procedureToEdit?: CathProcedure | null
  onSaved: () => void
}

const VESSELS: CoronaryVessel[] = [
  'LM', 'pLAD', 'mLAD', 'dLAD', 'D1', 'D2',
  'pLCx', 'mLCx', 'OM1', 'OM2',
  'pRCA', 'mRCA', 'dRCA', 'PDA', 'PLV',
  'Ramus', 'SVG', 'LIMA', 'RIMA'
]

export default function CathProcedureModal({
  isOpen,
  onClose,
  patient,
  procedureToEdit,
  onSaved
}: CathProcedureModalProps) {
  const [activeTab, setActiveTab] = useState<'details' | 'timelines' | 'lesions' | 'complications'>('details')
  const [saving, setSaving] = useState(false)

  // Top-level procedure state
  const [procedureDate, setProcedureDate] = useState(
    procedureToEdit?.procedureDate ? procedureToEdit.procedureDate.slice(0, 16) : new Date().toISOString().slice(0, 16)
  )
  const [procedureType, setProcedureType] = useState<CathProcedureType>(
    procedureToEdit?.procedureType || 'Primary PCI'
  )
  const [clinicalIndication, setClinicalIndication] = useState<ClinicalIndication>(
    procedureToEdit?.clinicalIndication || 'STEMI'
  )
  const [siteId, setSiteId] = useState(procedureToEdit?.siteId || 'Main-CathLab')
  const [operatorName, setOperatorName] = useState(procedureToEdit?.operatorName || 'Dr. Interventionalist')
  const [assistantOperatorName, setAssistantOperatorName] = useState(procedureToEdit?.assistantOperatorName || '')

  // Access & Hardware
  const [accessSite, setAccessSite] = useState<AccessSite>(procedureToEdit?.accessSite || 'Right Radial')
  const [sheathSize, setSheathSize] = useState<'5F' | '6F' | '7F' | '8F'>(procedureToEdit?.sheathSize || '6F')
  const [radialCrossover, setRadialCrossover] = useState(procedureToEdit?.radialCrossover || false)
  const [radialCrossoverReason, setRadialCrossoverReason] = useState(procedureToEdit?.radialCrossoverReason || '')
  const [closureDevice, setClosureDevice] = useState(procedureToEdit?.closureDevice || 'TR Band')

  // Contrast & Radiation
  const [contrastVolumeMl, setContrastVolumeMl] = useState(procedureToEdit?.contrastVolumeMl ?? 120)
  const [contrastType, setContrastType] = useState<'Iso-osmolar' | 'Low-osmolar'>(procedureToEdit?.contrastType || 'Low-osmolar')
  const [fluoroscopyTimeMinutes, setFluoroscopyTimeMinutes] = useState(procedureToEdit?.fluoroscopyTimeMinutes ?? 12.5)
  const [radiationAirKermaGy, setRadiationAirKermaGy] = useState(procedureToEdit?.radiationAirKermaGy ?? 0.85)
  const [doseAreaProductGyCm2, setDoseAreaProductGyCm2] = useState(procedureToEdit?.doseAreaProductGyCm2 ?? 45)

  // STEMI Timelines
  const [presentationType, setPresentationType] = useState<'Direct Hub Presentation' | 'Spoke Transfer (Pharmaco-invasive)' | 'Spoke Transfer (Primary PCI)'>(
    procedureToEdit?.stemiTimelines?.presentationType || 'Direct Hub Presentation'
  )
  const [symptomOnsetTime, setSymptomOnsetTime] = useState(procedureToEdit?.stemiTimelines?.symptomOnsetTime || '')
  const [fmcTime, setFmcTime] = useState(procedureToEdit?.stemiTimelines?.fmcTime || '')
  const [ecgTime, setEcgTime] = useState(procedureToEdit?.stemiTimelines?.ecgTime || '')
  const [cathLabActivationTime, setCathLabActivationTime] = useState(procedureToEdit?.stemiTimelines?.cathLabActivationTime || '')
  const [arterialPunctureTime, setArterialPunctureTime] = useState(procedureToEdit?.stemiTimelines?.arterialPunctureTime || '')
  const [firstDeviceTime, setFirstDeviceTime] = useState(procedureToEdit?.stemiTimelines?.firstDeviceTime || '')
  const [dtbMinutes, setDtbMinutes] = useState<number | undefined>(procedureToEdit?.stemiTimelines?.dtbMinutes)

  // Auto-calculate DTB minutes if FMC/arrival and First Device times are given
  useEffect(() => {
    if (fmcTime && firstDeviceTime) {
      const t1 = new Date(fmcTime).getTime()
      const t2 = new Date(firstDeviceTime).getTime()
      if (!isNaN(t1) && !isNaN(t2) && t2 > t1) {
        setDtbMinutes(Math.round((t2 - t1) / 60000))
      }
    }
  }, [fmcTime, firstDeviceTime])

  // Lesions & Interventions
  const [lesions, setLesions] = useState<CathLesion[]>(
    procedureToEdit?.lesions || [
      {
        id: 'lesion-1',
        vessel: 'pLAD',
        segmentNumber: 6,
        isCulprit: true,
        preStenosisPct: 99,
        preTimiFlow: 0,
        calcification: 'Moderate',
        bifurcation: false,
        chronicTotalOcclusion: false,
        thrombusGrade: 4,
        treatmentStrategy: 'DES',
        devices: [
          {
            id: 'dev-1',
            deviceType: 'DES',
            brandName: 'Xience Sierra (Abbott)',
            diameterMm: 3.5,
            lengthMm: 28,
            maxPressureAtm: 16,
            serialOrBatchNumber: 'DCGI-IND-2025-098'
          }
        ],
        postStenosisPct: 0,
        postTimiFlow: 3,
        lesionSuccess: true
      }
    ]
  )

  // Complications
  const [hasComplication, setHasComplication] = useState(procedureToEdit?.complications?.hasComplication || false)
  const [coronaryPerforation, setCoronaryPerforation] = useState(procedureToEdit?.complications?.coronaryPerforation || false)
  const [coronaryPerforationEllisClass, setCoronaryPerforationEllisClass] = useState(procedureToEdit?.complications?.coronaryPerforationEllisClass)
  const [coronaryDissection, setCoronaryDissection] = useState(procedureToEdit?.complications?.coronaryDissection || false)
  const [coronaryDissectionNhlbiType, setCoronaryDissectionNhlbiType] = useState(procedureToEdit?.complications?.coronaryDissectionNhlbiType)
  const [noReflowSlowReflow, setNoReflowSlowReflow] = useState(procedureToEdit?.complications?.noReflowSlowReflow || false)
  const [acuteStentThrombosis, setAcuteStentThrombosis] = useState(procedureToEdit?.complications?.acuteStentThrombosis || false)
  const [abruptClosure, setAbruptClosure] = useState(procedureToEdit?.complications?.abruptClosure || false)
  const [emergencyCabg, setEmergencyCabg] = useState(procedureToEdit?.complications?.emergencyCabg || false)
  const [mechanicalSupportRequired, setMechanicalSupportRequired] = useState(procedureToEdit?.complications?.mechanicalSupportRequired || false)
  const [mechanicalSupportType, setMechanicalSupportType] = useState(procedureToEdit?.complications?.mechanicalSupportType || 'IABP')
  const [inLabCardiacArrest, setInLabCardiacArrest] = useState(procedureToEdit?.complications?.inLabCardiacArrest || false)
  const [inLabDeath, setInLabDeath] = useState(procedureToEdit?.complications?.inLabDeath || false)
  const [accessSiteBleeding, setAccessSiteBleeding] = useState(procedureToEdit?.complications?.accessSiteBleeding || false)
  const [barcBleedingType, setBarcBleedingType] = useState(procedureToEdit?.complications?.barcBleedingType)
  const [retroperitonealHematoma, setRetroperitonealHematoma] = useState(procedureToEdit?.complications?.retroperitonealHematoma || false)
  const [pseudoaneurysm, setPseudoaneurysm] = useState(procedureToEdit?.complications?.pseudoaneurysm || false)
  const [radialArteryOcclusion, setRadialArteryOcclusion] = useState(procedureToEdit?.complications?.radialArteryOcclusion || false)
  const [contrastInducedAki, setContrastInducedAki] = useState(procedureToEdit?.complications?.contrastInducedAki || false)
  const [strokeOrTia, setStrokeOrTia] = useState(procedureToEdit?.complications?.strokeOrTia || false)
  const [periproceduralMi, setPeriproceduralMi] = useState(procedureToEdit?.complications?.periproceduralMi || false)
  const [arteriovenousFistula, setArteriovenousFistula] = useState(procedureToEdit?.complications?.arteriovenousFistula || false)
  const [targetVesselRevascularization, setTargetVesselRevascularization] = useState(procedureToEdit?.complications?.targetVesselRevascularization || false)
  const [targetLesionRevascularization, setTargetLesionRevascularization] = useState(procedureToEdit?.complications?.targetLesionRevascularization || false)
  const [inHospitalDeath, setInHospitalDeath] = useState(procedureToEdit?.complications?.inHospitalDeath || false)
  const [complicationNotes, setComplicationNotes] = useState(procedureToEdit?.complications?.complicationNotes || '')

  // Overall procedure status
  const [overallSuccess, setOverallSuccess] = useState(procedureToEdit?.overallSuccess ?? true)
  const [dischargeStatus, setDischargeStatus] = useState(procedureToEdit?.dischargeStatus || 'Discharged Alive')
  const [notes, setNotes] = useState(procedureToEdit?.notes || '')

  // Lesion helpers
  const handleAddLesion = () => {
    const newL: CathLesion = {
      id: `lesion-${Date.now()}`,
      vessel: 'mRCA',
      isCulprit: false,
      preStenosisPct: 85,
      preTimiFlow: 3,
      calcification: 'None',
      bifurcation: false,
      chronicTotalOcclusion: false,
      treatmentStrategy: 'DES',
      devices: [],
      postStenosisPct: 0,
      postTimiFlow: 3,
      lesionSuccess: true
    }
    setLesions([...lesions, newL])
  }

  const handleRemoveLesion = (index: number) => {
    setLesions(lesions.filter((_, i) => i !== index))
  }

  const handleUpdateLesion = (index: number, updates: Partial<CathLesion>) => {
    const updated = [...lesions]
    const current = updated[index]
    const merged = { ...current, ...updates }
    // Recalculate lesionSuccess
    if (merged.postTimiFlow === 3 && merged.postStenosisPct < 20) {
      merged.lesionSuccess = true
    } else {
      merged.lesionSuccess = false
    }
    updated[index] = merged
    setLesions(updated)
  }

  const handleAddDevice = (lesionIndex: number) => {
    const updated = [...lesions]
    const dev: CathDevice = {
      id: `dev-${Date.now()}`,
      deviceType: 'DES',
      brandName: 'Onyx Frontier (Medtronic)',
      diameterMm: 3.0,
      lengthMm: 24,
      maxPressureAtm: 16,
      serialOrBatchNumber: ''
    }
    updated[lesionIndex].devices = [...(updated[lesionIndex].devices || []), dev]
    setLesions(updated)
  }

  const handleRemoveDevice = (lesionIndex: number, deviceIndex: number) => {
    const updated = [...lesions]
    updated[lesionIndex].devices = updated[lesionIndex].devices.filter((_, i) => i !== deviceIndex)
    setLesions(updated)
  }

  const handleUpdateDevice = (lesionIndex: number, deviceIndex: number, updates: Partial<CathDevice>) => {
    const updated = [...lesions]
    const devs = [...updated[lesionIndex].devices]
    devs[deviceIndex] = { ...devs[deviceIndex], ...updates }
    updated[lesionIndex].devices = devs
    setLesions(updated)
  }

  const handleSave = async () => {
    if (!operatorName.trim()) {
      toast.error('Primary Operator name is required')
      return
    }

    setSaving(true)
    try {
      const payload: CathProcedureInput = {
        patientId: patient.id,
        siteId,
        operatorName,
        assistantOperatorName: assistantOperatorName || undefined,
        procedureDate: new Date(procedureDate).toISOString(),
        procedureType,
        clinicalIndication,
        stemiTimelines: clinicalIndication === 'STEMI' ? {
          presentationType,
          symptomOnsetTime: symptomOnsetTime ? new Date(symptomOnsetTime).toISOString() : undefined,
          fmcTime: fmcTime ? new Date(fmcTime).toISOString() : undefined,
          ecgTime: ecgTime ? new Date(ecgTime).toISOString() : undefined,
          cathLabActivationTime: cathLabActivationTime ? new Date(cathLabActivationTime).toISOString() : undefined,
          arterialPunctureTime: arterialPunctureTime ? new Date(arterialPunctureTime).toISOString() : undefined,
          firstDeviceTime: firstDeviceTime ? new Date(firstDeviceTime).toISOString() : undefined,
          dtbMinutes: dtbMinutes != null ? Number(dtbMinutes) : undefined
        } : undefined,
        accessSite,
        sheathSize,
        radialCrossover,
        radialCrossoverReason: radialCrossover ? radialCrossoverReason : undefined,
        closureDevice,
        contrastVolumeMl: Number(contrastVolumeMl) || 0,
        contrastType,
        fluoroscopyTimeMinutes: Number(fluoroscopyTimeMinutes) || 0,
        radiationAirKermaGy: radiationAirKermaGy != null ? Number(radiationAirKermaGy) : undefined,
        doseAreaProductGyCm2: doseAreaProductGyCm2 != null ? Number(doseAreaProductGyCm2) : undefined,
        lesions,
        complications: {
          hasComplication,
          coronaryPerforation,
          coronaryPerforationEllisClass: coronaryPerforation ? coronaryPerforationEllisClass : undefined,
          coronaryDissection,
          coronaryDissectionNhlbiType: coronaryDissection ? coronaryDissectionNhlbiType : undefined,
          noReflowSlowReflow,
          acuteStentThrombosis,
          abruptClosure,
          emergencyCabg,
          mechanicalSupportRequired,
          mechanicalSupportType: mechanicalSupportRequired ? mechanicalSupportType : undefined,
          inLabCardiacArrest,
          inLabDeath,
          accessSiteBleeding,
          barcBleedingType: accessSiteBleeding ? barcBleedingType : undefined,
          retroperitonealHematoma,
          pseudoaneurysm,
          arteriovenousFistula,
          radialArteryOcclusion,
          contrastInducedAki,
          strokeOrTia,
          periproceduralMi,
          targetVesselRevascularization,
          targetLesionRevascularization,
          inHospitalDeath,
          complicationNotes: complicationNotes || undefined
        },
        overallSuccess,
        dischargeStatus: dischargeStatus as any,
        notes: notes || undefined
      }

      if (procedureToEdit?.id) {
        await updateCathProcedure(procedureToEdit.id, payload)
        toast.success('Interventional Procedure Updated Successfully')
      } else {
        await addCathProcedure(payload)
        toast.success('Interventional Procedure Logged to National Cath Registry')
      }

      onSaved()
      onClose()
    } catch (err: any) {
      console.error('Error saving procedure:', err)
      toast.error('Failed to save procedure: ' + (err.message || 'Unknown error'))
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-amber-500/30 rounded-2xl shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Heart className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                {procedureToEdit ? 'Edit Cath / Interventional Procedure' : 'Log Cath Lab & PCI Procedure'}
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30">
                  NCDR CathPCI · NIC India
                </span>
              </h2>
              <p className="text-xs text-gray-400">
                Patient: <span className="text-white font-semibold">{patient.firstName} {patient.lastName}</span> · MRN: {patient.mrn || '—'} · {patient.age || '—'}y {patient.sex}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-white/10 bg-slate-900/90 px-6 gap-2">
          <button
            onClick={() => setActiveTab('details')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'details'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Stethoscope className="w-3.5 h-3.5" />
            Procedure & Access
          </button>
          <button
            onClick={() => setActiveTab('timelines')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'timelines'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            STEMI Timelines {dtbMinutes != null && `(${dtbMinutes}m)`}
          </button>
          <button
            onClick={() => setActiveTab('lesions')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'lesions'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            Lesions & Stenting ({lesions.length})
          </button>
          <button
            onClick={() => setActiveTab('complications')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'complications'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            Complications & Safety {hasComplication && <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />}
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 max-h-[65vh] overflow-y-auto space-y-6 text-xs">
          {/* TAB 1: Procedure & Access */}
          {activeTab === 'details' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-gray-400 font-medium mb-1">Procedure Date & Time *</label>
                  <input
                    type="datetime-local"
                    value={procedureDate}
                    onChange={(e) => setProcedureDate(e.target.value)}
                    className="w-full bg-slate-950 border border-white/15 rounded-xl px-3 py-2 text-white focus:border-amber-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-gray-400 font-medium mb-1">Procedure Type *</label>
                  <select
                    value={procedureType}
                    onChange={(e) => setProcedureType(e.target.value as any)}
                    className="w-full bg-slate-950 border border-white/15 rounded-xl px-3 py-2 text-white focus:border-amber-400 focus:outline-none"
                  >
                    <option value="Primary PCI">Primary PCI (STEMI)</option>
                    <option value="Ad-hoc PCI">Ad-hoc PCI</option>
                    <option value="Elective PCI">Elective PCI</option>
                    <option value="Rescue / Pharmaco-invasive PCI">Rescue / Pharmaco-invasive PCI</option>
                    <option value="Staged PCI">Staged PCI</option>
                    <option value="Diagnostic Coronary Angiography">Diagnostic Coronary Angiography</option>
                    <option value="Structural Heart Intervention">Structural Heart Intervention</option>
                    <option value="Graft Study">Graft Study</option>
                  </select>
                </div>
                <div>
                  <label className="block text-gray-400 font-medium mb-1">Clinical Indication *</label>
                  <select
                    value={clinicalIndication}
                    onChange={(e) => setClinicalIndication(e.target.value as any)}
                    className="w-full bg-slate-950 border border-white/15 rounded-xl px-3 py-2 text-white focus:border-amber-400 focus:outline-none"
                  >
                    <option value="STEMI">STEMI</option>
                    <option value="NSTEMI">NSTEMI</option>
                    <option value="Unstable Angina">Unstable Angina</option>
                    <option value="Chronic Coronary Syndrome">Chronic Coronary Syndrome (Stable CAD)</option>
                    <option value="Cardiogenic Shock">Cardiogenic Shock</option>
                    <option value="Post-Cardiac Arrest / OHCA">Post-Cardiac Arrest / OHCA</option>
                    <option value="Pre-operative Cardiac Clearance">Pre-operative Cardiac Clearance</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              {/* Operators & Site */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-white/10">
                <div>
                  <label className="block text-gray-400 font-medium mb-1">Primary Interventionalist *</label>
                  <input
                    type="text"
                    value={operatorName}
                    onChange={(e) => setOperatorName(e.target.value)}
                    placeholder="e.g. Dr. A. Sharma"
                    className="w-full bg-slate-950 border border-white/15 rounded-xl px-3 py-2 text-white focus:border-amber-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-gray-400 font-medium mb-1">Assistant / Fellow</label>
                  <input
                    type="text"
                    value={assistantOperatorName}
                    onChange={(e) => setAssistantOperatorName(e.target.value)}
                    placeholder="e.g. Dr. R. Patel"
                    className="w-full bg-slate-950 border border-white/15 rounded-xl px-3 py-2 text-white focus:border-amber-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-gray-400 font-medium mb-1">Cath Lab Center / Site ID</label>
                  <input
                    type="text"
                    value={siteId}
                    onChange={(e) => setSiteId(e.target.value)}
                    placeholder="e.g. AIIMS-CathLab-1"
                    className="w-full bg-slate-950 border border-white/15 rounded-xl px-3 py-2 text-white focus:border-amber-400 focus:outline-none"
                  />
                </div>
              </div>

              {/* Access Details */}
              <div className="bg-slate-950/40 p-4 rounded-xl border border-white/5 space-y-3">
                <p className="font-semibold text-amber-400 uppercase tracking-wider text-[10px]">Vascular Access & Hemostasis</p>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-gray-400 mb-1">Primary Access Site</label>
                    <select
                      value={accessSite}
                      onChange={(e) => setAccessSite(e.target.value as any)}
                      className="w-full bg-slate-900 border border-white/15 rounded-xl px-3 py-2 text-white focus:border-amber-400"
                    >
                      <option value="Right Radial">Right Radial (Default Transradial)</option>
                      <option value="Left Radial">Left Radial</option>
                      <option value="Right Femoral">Right Femoral</option>
                      <option value="Left Femoral">Left Femoral</option>
                      <option value="Right Ulnar">Right Ulnar</option>
                      <option value="Left Ulnar">Left Ulnar</option>
                      <option value="Brachial">Brachial</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-gray-400 mb-1">Sheath Size</label>
                    <select
                      value={sheathSize}
                      onChange={(e) => setSheathSize(e.target.value as any)}
                      className="w-full bg-slate-900 border border-white/15 rounded-xl px-3 py-2 text-white focus:border-amber-400"
                    >
                      <option value="5F">5 French</option>
                      <option value="6F">6 French</option>
                      <option value="7F">7 French</option>
                      <option value="8F">8 French</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-gray-400 mb-1">Hemostasis Closure</label>
                    <select
                      value={closureDevice}
                      onChange={(e) => setClosureDevice(e.target.value as any)}
                      className="w-full bg-slate-900 border border-white/15 rounded-xl px-3 py-2 text-white focus:border-amber-400"
                    >
                      <option value="TR Band">TR Band (Radial)</option>
                      <option value="Angio-Seal">Angio-Seal (Femoral)</option>
                      <option value="Perclose ProGlide">Perclose ProGlide</option>
                      <option value="Manta">Manta (Large Bore)</option>
                      <option value="Manual Compression">Manual Compression</option>
                      <option value="Pressure Bandage">Pressure Bandage</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-gray-400 mb-1">Radial Crossover</label>
                    <div className="flex items-center gap-2 mt-2">
                      <input
                        type="checkbox"
                        checked={radialCrossover}
                        onChange={(e) => setRadialCrossover(e.target.checked)}
                        className="rounded border-gray-700 text-amber-500 focus:ring-amber-400 h-4 w-4 bg-slate-900"
                      />
                      <span className="text-gray-300">Switched to Femoral</span>
                    </div>
                  </div>
                </div>
                {radialCrossover && (
                  <div>
                    <label className="block text-gray-400 mb-1">Reason for Radial Crossover</label>
                    <input
                      type="text"
                      value={radialCrossoverReason}
                      onChange={(e) => setRadialCrossoverReason(e.target.value)}
                      placeholder="e.g. Severe radial spasm, subclavian loop, tortuosity"
                      className="w-full bg-slate-900 border border-white/15 rounded-xl px-3 py-2 text-white focus:border-amber-400"
                    />
                  </div>
                )}
              </div>

              {/* Radiation & Contrast */}
              <div className="bg-slate-950/40 p-4 rounded-xl border border-white/5 space-y-3">
                <p className="font-semibold text-amber-400 uppercase tracking-wider text-[10px]">Radiation & Contrast Burden</p>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <div>
                    <label className="block text-gray-400 mb-1">Contrast Vol (mL)</label>
                    <input
                      type="number"
                      value={contrastVolumeMl}
                      onChange={(e) => setContrastVolumeMl(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-white/15 rounded-xl px-3 py-2 text-white focus:border-amber-400"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-400 mb-1">Contrast Osmolarity</label>
                    <select
                      value={contrastType}
                      onChange={(e) => setContrastType(e.target.value as any)}
                      className="w-full bg-slate-900 border border-white/15 rounded-xl px-3 py-2 text-white"
                    >
                      <option value="Low-osmolar">Low-osmolar (Iohexol)</option>
                      <option value="Iso-osmolar">Iso-osmolar (Iodixanol)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-gray-400 mb-1">Fluoro Time (min)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={fluoroscopyTimeMinutes}
                      onChange={(e) => setFluoroscopyTimeMinutes(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-white/15 rounded-xl px-3 py-2 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-400 mb-1">Air Kerma (Gy)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={radiationAirKermaGy}
                      onChange={(e) => setRadiationAirKermaGy(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-white/15 rounded-xl px-3 py-2 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-400 mb-1">DAP (Gy·cm²)</label>
                    <input
                      type="number"
                      value={doseAreaProductGyCm2}
                      onChange={(e) => setDoseAreaProductGyCm2(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-white/15 rounded-xl px-3 py-2 text-white"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: STEMI Timelines */}
          {activeTab === 'timelines' && (
            <div className="space-y-4">
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-200 text-xs flex items-center justify-between">
                <span>STEMI India & Hub-and-Spoke Door-to-Balloon Quality Metric Surveillance</span>
                {dtbMinutes != null && (
                  <span className={`px-2.5 py-1 rounded-full font-bold text-xs ${dtbMinutes <= 90 ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'}`}>
                    DTB: {dtbMinutes} mins {dtbMinutes <= 90 ? '(Target Met ≤90m)' : '(Delayed >90m)'}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-400 font-medium mb-1">STEMI Presentation Type</label>
                  <select
                    value={presentationType}
                    onChange={(e) => setPresentationType(e.target.value as any)}
                    className="w-full bg-slate-950 border border-white/15 rounded-xl px-3 py-2 text-white"
                  >
                    <option value="Direct Hub Presentation">Direct Hub Presentation</option>
                    <option value="Spoke Transfer (Primary PCI)">Spoke Transfer (Transferred for Primary PCI)</option>
                    <option value="Spoke Transfer (Pharmaco-invasive)">Spoke Transfer (Pharmaco-invasive post-lysis)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-gray-400 font-medium mb-1">Calculated Door-to-Balloon (min)</label>
                  <input
                    type="number"
                    value={dtbMinutes ?? ''}
                    onChange={(e) => setDtbMinutes(e.target.value ? Number(e.target.value) : undefined)}
                    placeholder="Auto-calculated or manual (min)"
                    className="w-full bg-slate-950 border border-white/15 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-white/10">
                <div>
                  <label className="block text-gray-400 mb-1">Symptom Onset Time</label>
                  <input
                    type="datetime-local"
                    value={symptomOnsetTime}
                    onChange={(e) => setSymptomOnsetTime(e.target.value)}
                    className="w-full bg-slate-950 border border-white/15 rounded-xl px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-gray-400 mb-1">First Medical Contact (FMC) / Arrival *</label>
                  <input
                    type="datetime-local"
                    value={fmcTime}
                    onChange={(e) => setFmcTime(e.target.value)}
                    className="w-full bg-slate-950 border border-white/15 rounded-xl px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-gray-400 mb-1">First Diagnostic ECG Time</label>
                  <input
                    type="datetime-local"
                    value={ecgTime}
                    onChange={(e) => setEcgTime(e.target.value)}
                    className="w-full bg-slate-950 border border-white/15 rounded-xl px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-gray-400 mb-1">Cath Lab Activation Time</label>
                  <input
                    type="datetime-local"
                    value={cathLabActivationTime}
                    onChange={(e) => setCathLabActivationTime(e.target.value)}
                    className="w-full bg-slate-950 border border-white/15 rounded-xl px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-gray-400 mb-1">Arterial Puncture Time</label>
                  <input
                    type="datetime-local"
                    value={arterialPunctureTime}
                    onChange={(e) => setArterialPunctureTime(e.target.value)}
                    className="w-full bg-slate-950 border border-white/15 rounded-xl px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-gray-400 mb-1">First Device Time (Wire / Balloon) *</label>
                  <input
                    type="datetime-local"
                    value={firstDeviceTime}
                    onChange={(e) => setFirstDeviceTime(e.target.value)}
                    className="w-full bg-slate-950 border border-white/15 rounded-xl px-3 py-2 text-white"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Lesions & Stents */}
          {activeTab === 'lesions' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-white text-sm">Coronary Lesions & Interventions</h3>
                  <p className="text-gray-400 text-[11px]">NCDR CathPCI Segment Classification & Stent Devices</p>
                </div>
                <Button
                  onClick={handleAddLesion}
                  variant="outline"
                  className="text-xs flex items-center gap-1 border-amber-500/40 text-amber-300 hover:bg-amber-500/10"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Lesion
                </Button>
              </div>

              {lesions.map((lesion, lIdx) => (
                <div key={lesion.id || lIdx} className="bg-slate-950 border border-white/10 rounded-xl p-4 space-y-4">
                  <div className="flex items-center justify-between border-b border-white/10 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 font-bold flex items-center justify-center text-xs">
                        #{lIdx + 1}
                      </span>
                      <span className="font-bold text-white text-sm">{lesion.vessel}</span>
                      {lesion.isCulprit && (
                        <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-semibold text-[10px] border border-rose-500/30">
                          Culprit Lesion
                        </span>
                      )}
                      {lesion.lesionSuccess ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold text-[10px] border border-emerald-500/30">
                          Success (TIMI {lesion.postTimiFlow} · Residual {lesion.postStenosisPct}%)
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-semibold text-[10px] border border-amber-500/30">
                          Sub-optimal / Incomplete
                        </span>
                      )}
                    </div>
                    {lesions.length > 1 && (
                      <button
                        onClick={() => handleRemoveLesion(lIdx)}
                        className="text-rose-400 hover:text-rose-300 p-1"
                        title="Remove lesion"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Lesion Parameters */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-gray-400 mb-1">ACC/AHA Segment *</label>
                      <select
                        value={lesion.segmentNumber || (CORONARY_SEGMENTS.find(s => s.vessel === lesion.vessel)?.id || 6)}
                        onChange={(e) => {
                          const segId = Number(e.target.value) as CoronarySegmentId
                          const found = CORONARY_SEGMENTS.find(s => s.id === segId)
                          handleUpdateLesion(lIdx, {
                            segmentNumber: segId,
                            segmentName: found?.label,
                            vessel: found?.vessel || lesion.vessel
                          })
                        }}
                        className="w-full bg-slate-900 border border-white/15 rounded-xl px-2.5 py-1.5 text-white text-xs"
                      >
                        {CORONARY_SEGMENTS.map((s) => (
                          <option key={s.id} value={s.id}>{s.label}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-gray-400 mb-1">Culprit Status</label>
                      <select
                        value={lesion.isCulprit ? 'Yes' : 'No'}
                        onChange={(e) => handleUpdateLesion(lIdx, { isCulprit: e.target.value === 'Yes' })}
                        className="w-full bg-slate-900 border border-white/15 rounded-xl px-2.5 py-1.5 text-white"
                      >
                        <option value="Yes">Yes — Culprit</option>
                        <option value="No">No — Non-culprit</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-gray-400 mb-1">Pre-Stenosis (%)</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={lesion.preStenosisPct}
                        onChange={(e) => handleUpdateLesion(lIdx, { preStenosisPct: Number(e.target.value) })}
                        className="w-full bg-slate-900 border border-white/15 rounded-xl px-2.5 py-1.5 text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-gray-400 mb-1">Pre-TIMI Flow</label>
                      <select
                        value={lesion.preTimiFlow}
                        onChange={(e) => handleUpdateLesion(lIdx, { preTimiFlow: Number(e.target.value) as TimiFlow })}
                        className="w-full bg-slate-900 border border-white/15 rounded-xl px-2.5 py-1.5 text-white"
                      >
                        <option value="0">TIMI 0 — No perfusion</option>
                        <option value="1">TIMI 1 — Penetration without perfusion</option>
                        <option value="2">TIMI 2 — Partial perfusion</option>
                        <option value="3">TIMI 3 — Complete perfusion</option>
                      </select>
                    </div>
                  </div>

                  {/* Morphologic characteristics */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-gray-400 mb-1">Calcification</label>
                      <select
                        value={lesion.calcification}
                        onChange={(e) => handleUpdateLesion(lIdx, { calcification: e.target.value as any })}
                        className="w-full bg-slate-900 border border-white/15 rounded-xl px-2.5 py-1.5 text-white"
                      >
                        <option value="None">None</option>
                        <option value="Mild">Mild</option>
                        <option value="Moderate">Moderate</option>
                        <option value="Severe">Severe</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-gray-400 mb-1">Bifurcation</label>
                      <select
                        value={lesion.bifurcation ? 'Yes' : 'No'}
                        onChange={(e) => handleUpdateLesion(lIdx, { bifurcation: e.target.value === 'Yes' })}
                        className="w-full bg-slate-900 border border-white/15 rounded-xl px-2.5 py-1.5 text-white"
                      >
                        <option value="No">No</option>
                        <option value="Yes">Yes (Bifurcation)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-gray-400 mb-1">Intravascular Imaging</label>
                      <select
                        value={lesion.intravascularImaging || 'None'}
                        onChange={(e) => handleUpdateLesion(lIdx, { intravascularImaging: e.target.value as any })}
                        className="w-full bg-slate-900 border border-white/15 rounded-xl px-2.5 py-1.5 text-white"
                      >
                        <option value="None">None (Angio Only)</option>
                        <option value="IVUS">IVUS Guided</option>
                        <option value="OCT">OCT Guided</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-gray-400 mb-1">Treatment Strategy</label>
                      <select
                        value={lesion.treatmentStrategy}
                        onChange={(e) => handleUpdateLesion(lIdx, { treatmentStrategy: e.target.value as any })}
                        className="w-full bg-slate-900 border border-white/15 rounded-xl px-2.5 py-1.5 text-white"
                      >
                        <option value="DES">DES (Drug-Eluting Stent)</option>
                        <option value="DCB">DCB (Drug-Coated Balloon)</option>
                        <option value="BMS">BMS</option>
                        <option value="POBA Only">POBA Only</option>
                        <option value="Thrombectomy Only">Thrombectomy Only</option>
                        <option value="Atherectomy / IVL">Atherectomy / IVL</option>
                        <option value="Medical Therapy">Medical Therapy</option>
                      </select>
                    </div>
                  </div>

                  {/* Devices Deployed (Stents / Balloons) */}
                  <div className="bg-slate-900/60 p-3 rounded-xl border border-white/5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-gray-300 text-[11px]">Devices Deployed (Stents & Balloons)</span>
                      <button
                        type="button"
                        onClick={() => handleAddDevice(lIdx)}
                        className="text-amber-400 hover:text-amber-300 text-[11px] font-semibold flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" /> Add Stent / Device
                      </button>
                    </div>

                    {lesion.devices.map((device, dIdx) => (
                      <div key={device.id || dIdx} className="grid grid-cols-1 md:grid-cols-6 gap-2 bg-slate-950 p-2.5 rounded-lg border border-white/5 items-center">
                        <div>
                          <label className="block text-gray-500 text-[9px]">Type</label>
                          <select
                            value={device.deviceType}
                            onChange={(e) => handleUpdateDevice(lIdx, dIdx, { deviceType: e.target.value as any })}
                            className="w-full bg-slate-900 border border-white/10 rounded px-1.5 py-1 text-white text-[11px]"
                          >
                            <option value="DES">DES</option>
                            <option value="DCB">DCB</option>
                            <option value="NC Balloon">NC Balloon</option>
                            <option value="Cutting / Scoring Balloon">Scoring Balloon</option>
                            <option value="IVL Lithotripsy">IVL Shockwave</option>
                          </select>
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-gray-500 text-[9px]">Brand / Model</label>
                          <input
                            type="text"
                            value={device.brandName}
                            onChange={(e) => handleUpdateDevice(lIdx, dIdx, { brandName: e.target.value })}
                            placeholder="e.g. Xience / Resolute"
                            className="w-full bg-slate-900 border border-white/10 rounded px-1.5 py-1 text-white text-[11px]"
                          />
                        </div>
                        <div>
                          <label className="block text-gray-500 text-[9px]">Diam × Length (mm)</label>
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              step="0.25"
                              value={device.diameterMm}
                              onChange={(e) => handleUpdateDevice(lIdx, dIdx, { diameterMm: Number(e.target.value) })}
                              className="w-12 bg-slate-900 border border-white/10 rounded px-1 py-1 text-white text-[11px]"
                            />
                            <span>×</span>
                            <input
                              type="number"
                              value={device.lengthMm}
                              onChange={(e) => handleUpdateDevice(lIdx, dIdx, { lengthMm: Number(e.target.value) })}
                              className="w-12 bg-slate-900 border border-white/10 rounded px-1 py-1 text-white text-[11px]"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-gray-500 text-[9px]">DCGI Batch / Serial #</label>
                          <input
                            type="text"
                            value={device.serialOrBatchNumber || ''}
                            onChange={(e) => handleUpdateDevice(lIdx, dIdx, { serialOrBatchNumber: e.target.value })}
                            placeholder="Batch #"
                            className="w-full bg-slate-900 border border-white/10 rounded px-1.5 py-1 text-white text-[11px]"
                          />
                        </div>
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => handleRemoveDevice(lIdx, dIdx)}
                            className="text-rose-400 hover:text-rose-300 p-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Post-Intervention Results */}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 bg-amber-500/5 p-3 rounded-xl border border-amber-500/15">
                    <div>
                      <label className="block text-gray-300 font-medium mb-1">Post-PCI Stenosis (%) *</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={lesion.postStenosisPct}
                        onChange={(e) => handleUpdateLesion(lIdx, { postStenosisPct: Number(e.target.value) })}
                        className="w-full bg-slate-900 border border-white/15 rounded-xl px-2.5 py-1.5 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-300 font-medium mb-1">Post-PCI TIMI Flow *</label>
                      <select
                        value={lesion.postTimiFlow}
                        onChange={(e) => handleUpdateLesion(lIdx, { postTimiFlow: Number(e.target.value) as TimiFlow })}
                        className="w-full bg-slate-900 border border-white/15 rounded-xl px-2.5 py-1.5 text-white font-mono"
                      >
                        <option value="3">TIMI 3 — Normal Flow (Optimal)</option>
                        <option value="2">TIMI 2 — Slow / Partial Perfusion</option>
                        <option value="1">TIMI 1 — Minimal Penetration</option>
                        <option value="0">TIMI 0 — No Flow (Failure)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-gray-300 font-medium mb-1">Lesion Success Status</label>
                      <div className="mt-2 flex items-center gap-1.5 font-bold">
                        {lesion.lesionSuccess ? (
                          <span className="text-emerald-400 flex items-center gap-1">
                            <Check className="w-4 h-4" /> SUCCESS (TIMI 3 & &lt;20%)
                          </span>
                        ) : (
                          <span className="text-rose-400 flex items-center gap-1">
                            <AlertCircle className="w-4 h-4" /> SUB-OPTIMAL
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB 4: Complications & Safety */}
          {activeTab === 'complications' && (
            <div className="space-y-4">
              <div className="p-3 bg-slate-950 border border-white/10 rounded-xl flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-white text-sm">Procedural Adverse Events & Safety Surveillance</h3>
                  <p className="text-gray-400 text-[11px]">NCDR / BARC Standardized Complication Reporting</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-300">Any Adverse Event?</span>
                  <input
                    type="checkbox"
                    checked={hasComplication}
                    onChange={(e) => setHasComplication(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-700 text-rose-600 focus:ring-rose-500 bg-slate-900"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <p className="font-bold text-rose-400 text-xs uppercase tracking-wider">Intra-Procedural Events (Cath Lab)</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="bg-slate-950 p-3 rounded-xl border border-white/10 space-y-2">
                    <label className="flex items-center gap-2 text-gray-300 font-medium">
                      <input
                        type="checkbox"
                        checked={coronaryPerforation}
                        onChange={(e) => setCoronaryPerforation(e.target.checked)}
                        className="rounded text-rose-500"
                      />
                      Coronary Perforation
                    </label>
                    {coronaryPerforation && (
                      <select
                        value={coronaryPerforationEllisClass || 'I'}
                        onChange={(e) => setCoronaryPerforationEllisClass(e.target.value as any)}
                        className="w-full bg-slate-900 border border-white/15 rounded-lg px-2 py-1 text-white text-[11px]"
                      >
                        <option value="I">Ellis Class I (Crater)</option>
                        <option value="II">Ellis Class II (Myocardial blush)</option>
                        <option value="III">Ellis Class III (Frank extravasation)</option>
                        <option value="Cavity-spilling">Cavity-spilling</option>
                      </select>
                    )}
                  </div>

                  <div className="bg-slate-950 p-3 rounded-xl border border-white/10 space-y-2">
                    <label className="flex items-center gap-2 text-gray-300 font-medium">
                      <input
                        type="checkbox"
                        checked={coronaryDissection}
                        onChange={(e) => setCoronaryDissection(e.target.checked)}
                        className="rounded text-rose-500"
                      />
                      Coronary Dissection
                    </label>
                    {coronaryDissection && (
                      <select
                        value={coronaryDissectionNhlbiType || 'C'}
                        onChange={(e) => setCoronaryDissectionNhlbiType(e.target.value as any)}
                        className="w-full bg-slate-900 border border-white/15 rounded-lg px-2 py-1 text-white text-[11px]"
                      >
                        <option value="A">NHLBI Type A</option>
                        <option value="B">NHLBI Type B</option>
                        <option value="C">NHLBI Type C</option>
                        <option value="D">NHLBI Type D (Spiral)</option>
                        <option value="E">NHLBI Type E</option>
                        <option value="F">NHLBI Type F (Total occlusion)</option>
                      </select>
                    )}
                  </div>

                  <div className="bg-slate-950 p-3 rounded-xl border border-white/10 space-y-2">
                    <label className="flex items-center gap-2 text-gray-300 font-medium">
                      <input
                        type="checkbox"
                        checked={noReflowSlowReflow}
                        onChange={(e) => setNoReflowSlowReflow(e.target.checked)}
                        className="rounded text-rose-500"
                      />
                      Slow-Flow / No-Reflow
                    </label>
                    <p className="text-[10px] text-gray-500">Microvascular spasm / distal embolization</p>
                  </div>

                  <div className="bg-slate-950 p-3 rounded-xl border border-white/10 space-y-2">
                    <label className="flex items-center gap-2 text-gray-300 font-medium">
                      <input
                        type="checkbox"
                        checked={acuteStentThrombosis}
                        onChange={(e) => setAcuteStentThrombosis(e.target.checked)}
                        className="rounded text-rose-500"
                      />
                      Acute Stent Thrombosis
                    </label>
                    <p className="text-[10px] text-gray-500">Intra-procedural thrombus occlusion</p>
                  </div>

                  <div className="bg-slate-950 p-3 rounded-xl border border-white/10 space-y-2">
                    <label className="flex items-center gap-2 text-gray-300 font-medium">
                      <input
                        type="checkbox"
                        checked={emergencyCabg}
                        onChange={(e) => setEmergencyCabg(e.target.checked)}
                        className="rounded text-rose-500"
                      />
                      Emergent CABG Bailout
                    </label>
                    <p className="text-[10px] text-gray-500">Urgent surgical revascularization</p>
                  </div>

                  <div className="bg-slate-950 p-3 rounded-xl border border-white/10 space-y-2">
                    <label className="flex items-center gap-2 text-gray-300 font-medium">
                      <input
                        type="checkbox"
                        checked={mechanicalSupportRequired}
                        onChange={(e) => setMechanicalSupportRequired(e.target.checked)}
                        className="rounded text-rose-500"
                      />
                      Mechanical Circulatory Support
                    </label>
                    {mechanicalSupportRequired && (
                      <select
                        value={mechanicalSupportType}
                        onChange={(e) => setMechanicalSupportType(e.target.value as any)}
                        className="w-full bg-slate-900 border border-white/15 rounded-lg px-2 py-1 text-white text-[11px]"
                      >
                        <option value="IABP">IABP (Intra-aortic Balloon Pump)</option>
                        <option value="Impella">Impella</option>
                        <option value="ECMO">VA-ECMO</option>
                      </select>
                    )}
                  </div>
                </div>

                <p className="font-bold text-rose-400 text-xs uppercase tracking-wider pt-3">In-Hospital & Access Site Complications</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="bg-slate-950 p-3 rounded-xl border border-white/10 space-y-2">
                    <label className="flex items-center gap-2 text-gray-300 font-medium">
                      <input
                        type="checkbox"
                        checked={accessSiteBleeding}
                        onChange={(e) => setAccessSiteBleeding(e.target.checked)}
                        className="rounded text-rose-500"
                      />
                      Access Site Bleeding / Hematoma
                    </label>
                    {accessSiteBleeding && (
                      <select
                        value={barcBleedingType || 'Type 2'}
                        onChange={(e) => setBarcBleedingType(e.target.value as any)}
                        className="w-full bg-slate-900 border border-white/15 rounded-lg px-2 py-1 text-white text-[11px]"
                      >
                        <option value="Type 1">BARC Type 1 (Minor)</option>
                        <option value="Type 2">BARC Type 2 (Actionable minor)</option>
                        <option value="Type 3a">BARC Type 3a (Hb drop 3-5g/dL, transfusion)</option>
                        <option value="Type 3b">BARC Type 3b (Cardiac tamponade, Hb drop &gt;5)</option>
                        <option value="Type 3c">BARC Type 3c (Intracranial)</option>
                        <option value="Type 5">BARC Type 5 (Fatal bleeding)</option>
                      </select>
                    )}
                  </div>

                  <div className="bg-slate-950 p-3 rounded-xl border border-white/10 space-y-2">
                    <label className="flex items-center gap-2 text-gray-300 font-medium">
                      <input
                        type="checkbox"
                        checked={contrastInducedAki}
                        onChange={(e) => setContrastInducedAki(e.target.checked)}
                        className="rounded text-rose-500"
                      />
                      Contrast-Induced AKI
                    </label>
                    <p className="text-[10px] text-gray-500">KDIGO criteria (sCr rise &gt;0.3 mg/dL)</p>
                  </div>

                  <div className="bg-slate-950 p-3 rounded-xl border border-white/10 space-y-2">
                    <label className="flex items-center gap-2 text-gray-300 font-medium">
                      <input
                        type="checkbox"
                        checked={strokeOrTia}
                        onChange={(e) => setStrokeOrTia(e.target.checked)}
                        className="rounded text-rose-500"
                      />
                      Peri-procedural Stroke / TIA
                    </label>
                    <p className="text-[10px] text-gray-500">Neurological deficit</p>
                  </div>

                  <div className="bg-slate-950 p-3 rounded-xl border border-white/10 space-y-2">
                    <label className="flex items-center gap-2 text-gray-300 font-medium">
                      <input
                        type="checkbox"
                        checked={radialArteryOcclusion}
                        onChange={(e) => setRadialArteryOcclusion(e.target.checked)}
                        className="rounded text-rose-500"
                      />
                      Radial Artery Occlusion (RAO)
                    </label>
                    <p className="text-[10px] text-gray-500">Loss of radial pulse / duplex confirmed</p>
                  </div>

                  <div className="bg-slate-950 p-3 rounded-xl border border-white/10 space-y-2">
                    <label className="flex items-center gap-2 text-gray-300 font-medium">
                      <input
                        type="checkbox"
                        checked={periproceduralMi}
                        onChange={(e) => setPeriproceduralMi(e.target.checked)}
                        className="rounded text-rose-500"
                      />
                      Periprocedural MI (Type 4a/b)
                    </label>
                    <p className="text-[10px] text-gray-500">SCAI / Universal Definition cTn elevation</p>
                  </div>

                  <div className="bg-slate-950 p-3 rounded-xl border border-white/10 space-y-2">
                    <label className="flex items-center gap-2 text-gray-300 font-medium">
                      <input
                        type="checkbox"
                        checked={arteriovenousFistula}
                        onChange={(e) => setArteriovenousFistula(e.target.checked)}
                        className="rounded text-rose-500"
                      />
                      Arteriovenous Fistula (AVF)
                    </label>
                    <p className="text-[10px] text-gray-500">Femoral / radial vascular access bruit</p>
                  </div>

                  <div className="bg-slate-950 p-3 rounded-xl border border-white/10 space-y-2">
                    <label className="flex items-center gap-2 text-gray-300 font-medium">
                      <input
                        type="checkbox"
                        checked={targetVesselRevascularization || targetLesionRevascularization}
                        onChange={(e) => {
                          setTargetVesselRevascularization(e.target.checked)
                          setTargetLesionRevascularization(e.target.checked)
                        }}
                        className="rounded text-rose-500"
                      />
                      Repeat TVR / TLR Required
                    </label>
                    <p className="text-[10px] text-gray-500">Unplanned target vessel/lesion intervention</p>
                  </div>

                  <div className="bg-slate-950 p-3 rounded-xl border border-white/10 space-y-2">
                    <label className="flex items-center gap-2 text-rose-400 font-bold">
                      <input
                        type="checkbox"
                        checked={inLabDeath || inHospitalDeath}
                        onChange={(e) => {
                          setInLabDeath(e.target.checked)
                          setInHospitalDeath(e.target.checked)
                        }}
                        className="rounded text-rose-600"
                      />
                      Mortality Event
                    </label>
                    <p className="text-[10px] text-gray-500">In-lab or in-hospital death</p>
                  </div>
                </div>

                <div>
                  <label className="block text-gray-400 mb-1">Complication & Case Summary Notes</label>
                  <textarea
                    rows={2}
                    value={complicationNotes}
                    onChange={(e) => setComplicationNotes(e.target.value)}
                    placeholder="Describe specific adverse event management, covered stent used, reversal agents, etc."
                    className="w-full bg-slate-950 border border-white/15 rounded-xl px-3 py-2 text-white"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-white/10 bg-slate-950/80">
          <div className="flex items-center gap-3">
            <span className="text-gray-400 text-xs">Procedure Outcome:</span>
            <button
              type="button"
              onClick={() => setOverallSuccess(!overallSuccess)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-all ${
                overallSuccess
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                  : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
              }`}
            >
              {overallSuccess ? 'Overall Success (TIMI 3 / MACE-Free)' : 'Procedure Incomplete / Aborted'}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={onClose}
              variant="outline"
              className="text-xs px-4"
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs px-5 flex items-center gap-2"
              disabled={saving}
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save to Cath Registry'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
