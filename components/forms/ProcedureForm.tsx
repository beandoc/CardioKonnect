'use client'

import React, { useState, useMemo } from 'react'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { FieldWrap, Input, Select, Textarea } from '@/components/ui/FormField'
import Button from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { addProcedure, updateProcedure } from '@/lib/firestore'
import type { Patient, CathProcedure, CathProcedureInput } from '@/lib/types'
import { AHA_CORONARY_SEGMENTS, type LesionRecord, type DeviceRecord } from '@/lib/interventionalTypes'
import { useAppUser } from '@/context/AppUserContext'
import {
  calculateDoorToBalloonMin,
  calculateVesselsDiseased,
  calculateAngiographicSuccess,
  calculateProceduralSuccess,
  calculateLesionSuccess
} from '@/lib/interventionalMetrics'
import {
  Activity,
  Heart,
  Clock,
  Shield,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Trash2,
  Save,
  ChevronDown,
  ChevronUp,
  X,
  Gauge
} from 'lucide-react'
import { toast } from 'sonner'

// ─── Zod Schema with Registry Validation Rules ────────────────────────────────

const lesionSchema = z.object({
  id: z.string(),
  segmentNumber: z.coerce.number().min(1).max(16),
  vessel: z.enum(['LM', 'LAD', 'LCx', 'RCA', 'Ramus', 'Graft']),
  lesionOrder: z.coerce.number().default(1),
  preStenosisPct: z.coerce.number().min(0).max(100),
  postStenosisPct: z.coerce.number().min(0).max(100),
  lesionLengthMm: z.coerce.number().min(1).max(100),
  referenceVesselDiameterMm: z.coerce.number().min(1.5).max(6.0),
  accAhaClass: z.enum(['A', 'B1', 'B2', 'C']).default('B1'),
  bifurcation: z.boolean().default(false),
  medinaClass: z.string().optional(),
  stentStrategy: z.enum(['Provisional 1-stent', 'Culotte', 'TAP', 'DK-Crush', 'T-stent', 'Crush', 'Other']).optional(),
  ostial: z.boolean().default(false),
  cto: z.boolean().default(false),
  jCtoScore: z.coerce.number().min(0).max(5).optional(),
  inStentRestenosis: z.boolean().default(false),
  mehranIsrClass: z.enum(['I', 'II', 'III', 'IV']).optional(),
  calcification: z.enum(['None', 'Mild', 'Moderate', 'Severe']).default('None'),
  thrombusGrade: z.coerce.number().min(0).max(5).default(0),
  tortuosity: z.enum(['None', 'Moderate', 'Severe']).default('None'),
  culprit: z.boolean().default(false),
  treated: z.boolean().default(true),
  reasonNotTreated: z.string().optional(),
  preTimiFlow: z.coerce.number().min(0).max(3).default(0),
  postTimiFlow: z.coerce.number().min(0).max(3).default(3),
  deviceIds: z.array(z.string()).default([]),
})

const deviceSchema = z.object({
  id: z.string(),
  targetSegment: z.coerce.number().min(1).max(16),
  type: z.enum(['DES', 'BMS', 'DCB', 'BVS', 'POBA']).default('DES'),
  make: z.string().min(1, 'Make required'),
  model: z.string().min(1, 'Model required'),
  diameterMm: z.coerce.number().min(1.5).max(6.0),
  lengthMm: z.coerce.number().min(6).max(60),
  deploymentPressureAtm: z.coerce.number().min(4).max(30).default(14),
  postDilatation: z.boolean().default(false),
  postDilatationPressureAtm: z.coerce.number().optional(),
  serialOrLotNumber: z.string().optional(),
})

const procedureFormSchema = z.object({
  siteId: z.string().min(1, 'Site ID required'),
  operatorId: z.string().min(1, 'Operator ID required'),
  operatorName: z.string().min(1, 'Operator name required'),
  procedureDateTime: z.string().min(1, 'Date & time required'),
  seqForPatient: z.coerce.number().min(1).default(1),

  admissionType: z.enum(['Elective', 'Urgent', 'Emergency', 'Salvage']).default('Urgent'),
  presentation: z.enum(['STEMI', 'NSTEMI', 'UA', 'ChronicCoronarySyndrome', 'Shock', 'OHCA', 'Other']).default('NSTEMI'),
  killipClass: z.enum(['I', 'II', 'III', 'IV']).default('I'),
  priorPCI: z.boolean().default(false),
  priorCABG: z.boolean().default(false),
  cardiacArrestPreProcedure: z.boolean().default(false),

  // Timings
  symptomOnset: z.string().optional(),
  firstMedicalContact: z.string().optional(),
  hospitalArrival: z.string().optional(),
  ecgTime: z.string().optional(),
  labActivation: z.string().optional(),
  arterialAccess: z.string().optional(),
  firstDevice: z.string().optional(),
  transferredIn: z.boolean().default(false),
  transferringFacility: z.string().optional(),
  thrombolysisGiven: z.boolean().default(false),
  thrombolysisTime: z.string().optional(),

  // Access
  accessSite: z.enum(['Radial Right', 'Radial Left', 'Femoral Right', 'Femoral Left', 'Ulnar', 'Brachial']).default('Radial Right'),
  sheathSize: z.enum(['4F', '5F', '6F', '7F', '8F']).default('6F'),
  accessCrossover: z.boolean().default(false),
  crossoverReason: z.string().optional(),
  closureDevice: z.enum(['AngioSeal', 'Perclose', 'Mynx', 'StarClose', 'Manual Compression', 'Radial Band', 'None']).default('Radial Band'),
  ultrasoundGuidedAccess: z.boolean().default(false),

  // Angiography
  dominance: z.enum(['Right', 'Left', 'Codominant']).default('Right'),
  rentropCollaterals: z.enum(['Grade 0', 'Grade 1', 'Grade 2', 'Grade 3']).default('Grade 0'),
  ivusOctDone: z.boolean().default(false),
  ivusOctFindings: z.string().optional(),
  ffrIfrDone: z.boolean().default(false),
  ffrIfrValues: z.string().optional(),

  // Arrays
  lesions: z.array(lesionSchema).default([]),
  devices: z.array(deviceSchema).default([]),

  // Adjuncts
  thrombectomyDone: z.boolean().default(false),
  atherectomyDone: z.boolean().default(false),
  atherectomyType: z.enum(['Rotational', 'Orbital', 'None']).default('None'),
  ivlShockwaveDone: z.boolean().default(false),
  ivlCycles: z.coerce.number().optional(),
  mcsUsed: z.boolean().default(false),
  mcsType: z.enum(['IABP', 'Impella', 'ECMO', 'None']).default('None'),

  // Pharmacology
  p2y12Agent: z.enum(['Clopidogrel', 'Ticagrelor', 'Prasugrel', 'None']).default('Ticagrelor'),
  p2y12LoadingDoseGiven: z.boolean().default(true),
  gpIIbIIIaUsed: z.boolean().default(false),
  anticoagulant: z.enum(['Unfractionated Heparin', 'Bivalirudin', 'Enoxaparin', 'None']).default('Unfractionated Heparin'),
  peakActSeconds: z.coerce.number().optional(),

  // Radiation & Exposure
  contrastVolumeMl: z.coerce.number().min(0).max(1000, 'Max contrast is 1000 mL').default(150),
  contrastAgent: z.enum(['Iso-osmolar (e.g. Visipaque)', 'Low-osmolar (e.g. Omnipaque, Ultravist)']).default('Low-osmolar (e.g. Omnipaque, Ultravist)'),
  fluoroscopyTimeMin: z.coerce.number().min(0).max(240, 'Max fluoro time 240 min').default(12),
  dapGyCm2: z.coerce.number().optional(),
  airKermaMGy: z.coerce.number().optional(),

  // Safety
  noReflow: z.boolean().default(false),
  dissectionNhlbi: z.enum(['None', 'Type A', 'Type B', 'Type C', 'Type D', 'Type E', 'Type F']).default('None'),
  perforationEllis: z.enum(['None', 'Class I', 'Class II', 'Class III', 'Class CS (Cavity Spilling)']).default('None'),
  sideBranchLoss: z.boolean().default(false),
  acuteStentThrombosis: z.boolean().default(false),

  // Disposition
  dischargeDate: z.string().optional(),
  dischargeDaptAgent: z.enum(['Aspirin + Clopidogrel', 'Aspirin + Ticagrelor', 'Aspirin + Prasugrel', 'Single Antiplatelet', 'None']).default('Aspirin + Ticagrelor'),
  dischargeDaptDurationMonths: z.coerce.number().default(12),
  dischargeStatinIntensity: z.enum(['High', 'Moderate', 'Low', 'None']).default('High'),
  dischargeBetaBlocker: z.boolean().default(true),
  dischargeAceiArb: z.boolean().default(true),
  dischargeOac: z.boolean().default(false),
  stagedPciPlanned: z.boolean().default(false),
  stagedPciDate: z.string().optional(),

  radialFirstAdherence: z.boolean().default(true),
  enteredBy: z.string().min(1, 'Abstractor name required'),

  // Right Heart Catheterisation (RHC)
  rhc: z.object({
    performed: z.boolean().default(false),
    rhcDate: z.string().optional(),
    indication: z.string().optional(),
    mPAP: z.coerce.number().optional().or(z.literal('')),
    sPAP: z.coerce.number().optional().or(z.literal('')),
    dPAP: z.coerce.number().optional().or(z.literal('')),
    pcwp: z.coerce.number().optional().or(z.literal('')),
    cardiacOutput: z.coerce.number().optional().or(z.literal('')),
    cardiacIndex: z.coerce.number().optional().or(z.literal('')),
    pvr: z.coerce.number().optional().or(z.literal('')),
    svr: z.coerce.number().optional().or(z.literal('')),
    tpg: z.coerce.number().optional().or(z.literal('')),
    dpg: z.coerce.number().optional().or(z.literal('')),
    svO2: z.coerce.number().optional().or(z.literal('')),
    raPressure: z.coerce.number().optional().or(z.literal('')),
    vasoreactivity: z.boolean().optional(),
    vasoreactivityAgent: z.string().optional(),
    vasoreactivityPositive: z.boolean().optional(),
  }).optional(),
}).superRefine((data, ctx) => {
  // 1. STEMI with no onset time
  if (data.presentation === 'STEMI' && (!data.symptomOnset || data.symptomOnset.trim() === '')) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Symptom onset time is mandatory for STEMI presentation to calculate ischemic time',
      path: ['symptomOnset'],
    })
  }

  // 2. A device with no treated lesion
  if (data.devices && data.devices.length > 0) {
    const hasTreatedLesion = data.lesions && data.lesions.some(l => l.treated)
    if (!hasTreatedLesion) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'A device cannot be deployed without at least one treated lesion documented',
        path: ['devices'],
      })
    }
  }

  // 3. noReflow with post-TIMI 3
  if (data.noReflow) {
    const hasPostTimi3 = data.lesions && data.lesions.some(l => l.postTimiFlow === 3)
    if (hasPostTimi3) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'No-reflow / slow-flow is clinically incompatible with post-procedural TIMI 3 flow (must be TIMI 0–2)',
        path: ['noReflow'],
      })
    }
  }

  // 4. Access crossover reason
  if (data.accessCrossover && (!data.crossoverReason || data.crossoverReason.trim() === '')) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Vascular crossover reason is required when access site conversion occurs',
      path: ['crossoverReason'],
    })
  }
})

type FormData = z.infer<typeof procedureFormSchema>

interface Props {
  patient: Patient
  procedureToEdit?: CathProcedure | null
  onClose: () => void
  onSuccess: () => void
}

export default function ProcedureForm({ patient, procedureToEdit, onClose, onSuccess }: Props) {
  const { currentUser } = useAppUser()
  const [activeTab, setActiveTab] = useState<'encounter' | 'access' | 'angiography' | 'lesions' | 'safety' | 'discharge' | 'rhc'>('encounter')
  const [expandedLesionIndex, setExpandedLesionIndex] = useState<number | null>(0)
  const [saving, setSaving] = useState(false)
  const [segmentMap, setSegmentMap] = useState<Record<number, number>>(
    procedureToEdit?.segmentStenosisMap || {}
  )

  const isKanpur = patient.siteId === 'KANPUR_APEX' || currentUser?.siteId === 'KANPUR_APEX' || patient.registryIds?.includes('cathlab') || patient.registryId === 'cathlab'
  const defaultSiteId = procedureToEdit?.siteId || patient.siteId || currentUser?.siteId || (isKanpur ? 'KANPUR_APEX' : 'AICTS_PUNE')
  const defaultOperatorId = procedureToEdit?.operatorId || currentUser?.id || (isKanpur ? 'DR_RAJEEV_CHAUHAN' : 'DR_A_JAYACHANDRA')
  const defaultOperatorName = procedureToEdit?.operatorName || currentUser?.name || (isKanpur ? 'Dr. Rajeev Chauhan' : 'Dr. A. Jayachandra')
  const defaultEnteredBy = procedureToEdit?.enteredBy || currentUser?.name || (isKanpur ? 'Dr. Rajeev Chauhan' : 'Cath Lab Abstractor')

  const defaultValues: FormData = {
    siteId: defaultSiteId,
    operatorId: defaultOperatorId,
    operatorName: defaultOperatorName,
    procedureDateTime: procedureToEdit?.procedureDateTime || procedureToEdit?.procedureDate || new Date().toISOString().slice(0, 16),
    seqForPatient: procedureToEdit?.seqForPatient || 1,

    admissionType: procedureToEdit?.admissionType || 'Urgent',
    presentation: procedureToEdit?.presentation || 'NSTEMI',
    killipClass: procedureToEdit?.killipClass || 'I',
    priorPCI: procedureToEdit?.priorPCI ?? Boolean(patient.comorbidPriorPCI),
    priorCABG: procedureToEdit?.priorCABG ?? Boolean(patient.comorbidPriorCABG),
    cardiacArrestPreProcedure: procedureToEdit?.cardiacArrestPreProcedure ?? false,

    symptomOnset: procedureToEdit?.symptomOnset || '',
    firstMedicalContact: procedureToEdit?.firstMedicalContact || '',
    hospitalArrival: procedureToEdit?.hospitalArrival || '',
    ecgTime: procedureToEdit?.ecgTime || '',
    labActivation: procedureToEdit?.labActivation || '',
    arterialAccess: procedureToEdit?.arterialAccess || '',
    firstDevice: procedureToEdit?.firstDevice || '',
    transferredIn: procedureToEdit?.transferredIn ?? false,
    transferringFacility: procedureToEdit?.transferringFacility || '',
    thrombolysisGiven: procedureToEdit?.thrombolysisGiven ?? false,
    thrombolysisTime: procedureToEdit?.thrombolysisTime || '',

    accessSite: (procedureToEdit?.accessSite as any) || 'Radial Right',
    sheathSize: procedureToEdit?.sheathSize || '6F',
    accessCrossover: procedureToEdit?.accessCrossover ?? false,
    crossoverReason: procedureToEdit?.crossoverReason || '',
    closureDevice: (procedureToEdit?.closureDevice as any) || 'Radial Band',
    ultrasoundGuidedAccess: procedureToEdit?.ultrasoundGuidedAccess ?? false,

    dominance: procedureToEdit?.dominance || 'Right',
    rentropCollaterals: procedureToEdit?.rentropCollaterals || 'Grade 0',
    ivusOctDone: procedureToEdit?.ivusOctDone ?? false,
    ivusOctFindings: procedureToEdit?.ivusOctFindings || '',
    ffrIfrDone: procedureToEdit?.ffrIfrDone ?? false,
    ffrIfrValues: procedureToEdit?.ffrIfrValues || '',

    lesions: (procedureToEdit?.lesions as any) || [
      {
        id: 'lesion-1',
        segmentNumber: 6, // LAD Proximal
        vessel: 'LAD',
        lesionOrder: 1,
        preStenosisPct: 90,
        postStenosisPct: 0,
        lesionLengthMm: 24,
        referenceVesselDiameterMm: 3.0,
        accAhaClass: 'B2',
        bifurcation: false,
        ostial: false,
        cto: false,
        inStentRestenosis: false,
        calcification: 'Mild',
        thrombusGrade: 2,
        tortuosity: 'None',
        culprit: true,
        treated: true,
        preTimiFlow: 1,
        postTimiFlow: 3,
        deviceIds: ['dev-1'],
      }
    ],
    devices: (procedureToEdit?.devices as any) || [
      {
        id: 'dev-1',
        targetSegment: 6,
        type: 'DES',
        make: 'Abbott',
        model: 'Xience Sierra',
        diameterMm: 3.0,
        lengthMm: 28,
        deploymentPressureAtm: 14,
        postDilatation: true,
        postDilatationPressureAtm: 18,
        serialOrLotNumber: 'SN-94812'
      }
    ],

    thrombectomyDone: procedureToEdit?.thrombectomyDone ?? false,
    atherectomyDone: procedureToEdit?.atherectomyDone ?? false,
    atherectomyType: procedureToEdit?.atherectomyType || 'None',
    ivlShockwaveDone: procedureToEdit?.ivlShockwaveDone ?? false,
    ivlCycles: procedureToEdit?.ivlCycles || undefined,
    mcsUsed: procedureToEdit?.mcsUsed ?? false,
    mcsType: procedureToEdit?.mcsType || 'None',

    p2y12Agent: procedureToEdit?.p2y12Agent || 'Ticagrelor',
    p2y12LoadingDoseGiven: procedureToEdit?.p2y12LoadingDoseGiven ?? true,
    gpIIbIIIaUsed: procedureToEdit?.gpIIbIIIaUsed ?? false,
    anticoagulant: procedureToEdit?.anticoagulant || 'Unfractionated Heparin',
    peakActSeconds: procedureToEdit?.peakActSeconds || 280,

    contrastVolumeMl: procedureToEdit?.contrastVolumeMl || 140,
    contrastAgent: procedureToEdit?.contrastAgent || 'Low-osmolar (e.g. Omnipaque, Ultravist)',
    fluoroscopyTimeMin: procedureToEdit?.fluoroscopyTimeMin || 11,
    dapGyCm2: procedureToEdit?.dapGyCm2 || undefined,
    airKermaMGy: procedureToEdit?.airKermaMGy || undefined,

    noReflow: procedureToEdit?.noReflow ?? false,
    dissectionNhlbi: procedureToEdit?.dissectionNhlbi || 'None',
    perforationEllis: procedureToEdit?.perforationEllis || 'None',
    sideBranchLoss: procedureToEdit?.sideBranchLoss ?? false,
    acuteStentThrombosis: procedureToEdit?.acuteStentThrombosis ?? false,

    dischargeDate: procedureToEdit?.dischargeDate || '',
    dischargeDaptAgent: procedureToEdit?.dischargeDaptAgent || 'Aspirin + Ticagrelor',
    dischargeDaptDurationMonths: procedureToEdit?.dischargeDaptDurationMonths || 12,
    dischargeStatinIntensity: procedureToEdit?.dischargeStatinIntensity || 'High',
    dischargeBetaBlocker: procedureToEdit?.dischargeBetaBlocker ?? true,
    dischargeAceiArb: procedureToEdit?.dischargeAceiArb ?? true,
    dischargeOac: procedureToEdit?.dischargeOac ?? false,
    stagedPciPlanned: procedureToEdit?.stagedPciPlanned ?? false,
    stagedPciDate: procedureToEdit?.stagedPciDate || '',

    radialFirstAdherence: procedureToEdit?.radialFirstAdherence ?? true,
    enteredBy: defaultEnteredBy,

    rhc: {
      performed: procedureToEdit?.rhc != null,
      rhcDate: procedureToEdit?.rhc?.rhcDate || '',
      indication: procedureToEdit?.rhc?.indication || 'Heart Failure / Pulmonary Hypertension Workup',
      mPAP: procedureToEdit?.rhc?.mPAP ?? '',
      sPAP: procedureToEdit?.rhc?.sPAP ?? '',
      dPAP: procedureToEdit?.rhc?.dPAP ?? '',
      pcwp: procedureToEdit?.rhc?.pcwp ?? '',
      cardiacOutput: procedureToEdit?.rhc?.cardiacOutput ?? '',
      cardiacIndex: procedureToEdit?.rhc?.cardiacIndex ?? '',
      pvr: procedureToEdit?.rhc?.pvr ?? '',
      svr: procedureToEdit?.rhc?.svr ?? '',
      tpg: procedureToEdit?.rhc?.tpg ?? '',
      dpg: procedureToEdit?.rhc?.dpg ?? '',
      svO2: procedureToEdit?.rhc?.svO2 ?? '',
      raPressure: procedureToEdit?.rhc?.raPressure ?? '',
      vasoreactivity: procedureToEdit?.rhc?.vasoreactivity ?? false,
      vasoreactivityAgent: procedureToEdit?.rhc?.vasoreactivityAgent || '',
      vasoreactivityPositive: procedureToEdit?.rhc?.vasoreactivityPositive ?? false,
    },
  }

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors }
  } = useForm<FormData>({
    resolver: zodResolver(procedureFormSchema),
    defaultValues
  })

  const { fields: lesionFields, append: appendLesion, remove: removeLesion } = useFieldArray({
    control,
    name: 'lesions'
  })

  const { fields: deviceFields, append: appendDevice, remove: removeDevice } = useFieldArray({
    control,
    name: 'devices'
  })

  // Watch critical reactive values
  const watchPresentation = watch('presentation')
  const watchAccessSite = watch('accessSite')
  const watchAccessCrossover = watch('accessCrossover')
  const watchContrastVolume = watch('contrastVolumeMl')
  const watchArrival = watch('hospitalArrival')
  const watchFirstDevice = watch('firstDevice')
  const watchNoReflow = watch('noReflow')
  const watchLesions = watch('lesions')

  // Live Derived Door-to-Balloon in UI
  const liveDtb = useMemo(() => {
    if (!watchArrival || !watchFirstDevice) return null
    const arr = new Date(watchArrival).getTime()
    const dev = new Date(watchFirstDevice).getTime()
    if (isNaN(arr) || isNaN(dev)) return null
    const diff = Math.round((dev - arr) / 60000)
    return diff >= 0 ? diff : null
  }, [watchArrival, watchFirstDevice])

  // Mehran contrast threshold warning
  const weightKg = (patient as any).weight || 65
  const serumCr = (patient as any).creatinine || 1.1
  const mehranContrastCap = Math.min(300, Math.round((5 * weightKg) / serumCr))
  const isContrastOverCap = watchContrastVolume > mehranContrastCap

  // Segment click handler
  const handleSegmentStenosisChange = (segNum: number, stenosis: number) => {
    setSegmentMap(prev => ({ ...prev, [segNum]: stenosis }))
  }

  // Submit handler with strict clinical cross-field validations
  const onSubmit = async (data: FormData) => {
    // 1. STEMI cross-field validation
    if (data.presentation === 'STEMI') {
      if (!data.symptomOnset) {
        toast.error('Clinical Validation Error: STEMI presentations require documented Symptom Onset Time')
        setActiveTab('encounter')
        return
      }
      if (!data.firstDevice && !data.arterialAccess) {
        toast.error('Clinical Validation Error: STEMI primary PCI requires First Device or Arterial Access timestamp')
        setActiveTab('encounter')
        return
      }
    }

    // 2. Access crossover reason
    if (data.accessCrossover && !data.crossoverReason) {
      toast.error('Clinical Validation Error: Arterial access crossover requires documented reason')
      setActiveTab('access')
      return
    }

    // 3. Device requires at least one treated lesion
    if (data.devices.length > 0 && !data.lesions.some(l => l.treated)) {
      toast.error('Clinical Validation Error: Devices deployed without any treated lesion recorded')
      setActiveTab('lesions')
      return
    }

    // 4. Staged PCI date
    if (data.stagedPciPlanned && !data.stagedPciDate) {
      toast.error('Clinical Validation Error: Staged PCI planned requires scheduled follow-up date')
      setActiveTab('discharge')
      return
    }

    // 5. No-reflow requires post-TIMI < 3
    if (data.noReflow && data.lesions.length > 0 && data.lesions.every(l => l.postTimiFlow === 3)) {
      toast.error('Clinical Validation Error: No-reflow flagged but all lesions have post-PCI TIMI 3 flow')
      setActiveTab('safety')
      return
    }

    setSaving(true)
    try {
      const payload: CathProcedureInput = {
        patientId: patient.id,
        siteId: data.siteId,
        operatorId: data.operatorId,
        operatorName: data.operatorName,
        procedureDateTime: new Date(data.procedureDateTime).toISOString(),
        procedureDate: new Date(data.procedureDateTime).toISOString().slice(0, 10),
        seqForPatient: data.seqForPatient,

        admissionType: data.admissionType,
        presentation: data.presentation,
        killipClass: data.killipClass,
        priorPCI: data.priorPCI,
        priorCABG: data.priorCABG,
        cardiacArrestPreProcedure: data.cardiacArrestPreProcedure,

        symptomOnset: data.symptomOnset ? new Date(data.symptomOnset).toISOString() : undefined,
        firstMedicalContact: data.firstMedicalContact ? new Date(data.firstMedicalContact).toISOString() : undefined,
        hospitalArrival: data.hospitalArrival ? new Date(data.hospitalArrival).toISOString() : undefined,
        ecgTime: data.ecgTime ? new Date(data.ecgTime).toISOString() : undefined,
        labActivation: data.labActivation ? new Date(data.labActivation).toISOString() : undefined,
        arterialAccess: data.arterialAccess ? new Date(data.arterialAccess).toISOString() : undefined,
        firstDevice: data.firstDevice ? new Date(data.firstDevice).toISOString() : undefined,
        transferredIn: data.transferredIn,
        transferringFacility: data.transferringFacility || undefined,
        thrombolysisGiven: data.thrombolysisGiven,
        thrombolysisTime: data.thrombolysisTime ? new Date(data.thrombolysisTime).toISOString() : undefined,

        accessSite: data.accessSite as any,
        sheathSize: data.sheathSize as any,
        accessCrossover: data.accessCrossover,
        crossoverReason: data.crossoverReason as any || undefined,
        closureDevice: data.closureDevice as any,
        ultrasoundGuidedAccess: data.ultrasoundGuidedAccess,

        dominance: data.dominance,
        segmentStenosisMap: segmentMap,
        rentropCollaterals: data.rentropCollaterals,
        ivusOctDone: data.ivusOctDone,
        ivusOctFindings: data.ivusOctFindings || undefined,
        ffrIfrDone: data.ffrIfrDone,
        ffrIfrValues: data.ffrIfrValues || undefined,

        lesions: data.lesions as any,
        devices: data.devices as any,

        thrombectomyDone: data.thrombectomyDone,
        atherectomyDone: data.atherectomyDone,
        atherectomyType: data.atherectomyType,
        ivlShockwaveDone: data.ivlShockwaveDone,
        ivlCycles: data.ivlCycles,
        laserDone: false,
        guideExtensionUsed: false,
        mcsUsed: data.mcsUsed,
        mcsType: data.mcsType,
        mcsTiming: data.mcsUsed ? 'Bailout' : undefined,
        temporaryPacingDone: false,

        p2y12Agent: data.p2y12Agent,
        p2y12LoadingDoseGiven: data.p2y12LoadingDoseGiven,
        gpIIbIIIaUsed: data.gpIIbIIIaUsed,
        anticoagulant: data.anticoagulant,
        peakActSeconds: data.peakActSeconds,

        contrastVolumeMl: data.contrastVolumeMl,
        contrastAgent: data.contrastAgent,
        fluoroscopyTimeMin: data.fluoroscopyTimeMin,
        dapGyCm2: data.dapGyCm2,
        airKermaMGy: data.airKermaMGy,

        noReflow: data.noReflow,
        dissectionNhlbi: data.dissectionNhlbi,
        perforationEllis: data.perforationEllis,
        sideBranchLoss: data.sideBranchLoss,
        acuteStentThrombosis: data.acuteStentThrombosis,

        complications: [] as any,

        dischargeDate: data.dischargeDate || undefined,
        dischargeDaptAgent: data.dischargeDaptAgent as any,
        dischargeDaptDurationMonths: data.dischargeDaptDurationMonths,
        dischargeStatinIntensity: data.dischargeStatinIntensity as any,
        dischargeBetaBlocker: data.dischargeBetaBlocker,
        dischargeAceiArb: data.dischargeAceiArb,
        dischargeOac: data.dischargeOac,
        stagedPciPlanned: data.stagedPciPlanned,
        stagedPciDate: data.stagedPciDate || undefined,
        heartTeamReferral: false,

        radialFirstAdherence: data.accessSite.includes('Radial'),
        enteredBy: data.enteredBy,
        dataLocked: false,

        rhc: data.rhc?.performed ? {
          rhcDate: data.rhc.rhcDate || data.procedureDateTime.slice(0, 10),
          indication: data.rhc.indication,
          mPAP: data.rhc.mPAP !== '' ? Number(data.rhc.mPAP) : undefined,
          sPAP: data.rhc.sPAP !== '' ? Number(data.rhc.sPAP) : undefined,
          dPAP: data.rhc.dPAP !== '' ? Number(data.rhc.dPAP) : undefined,
          pcwp: data.rhc.pcwp !== '' ? Number(data.rhc.pcwp) : undefined,
          cardiacOutput: data.rhc.cardiacOutput !== '' ? Number(data.rhc.cardiacOutput) : undefined,
          cardiacIndex: data.rhc.cardiacIndex !== '' ? Number(data.rhc.cardiacIndex) : undefined,
          pvr: data.rhc.pvr !== '' ? Number(data.rhc.pvr) : undefined,
          svr: data.rhc.svr !== '' ? Number(data.rhc.svr) : undefined,
          tpg: data.rhc.tpg !== '' ? Number(data.rhc.tpg) : undefined,
          dpg: data.rhc.dpg !== '' ? Number(data.rhc.dpg) : undefined,
          svO2: data.rhc.svO2 !== '' ? Number(data.rhc.svO2) : undefined,
          raPressure: data.rhc.raPressure !== '' ? Number(data.rhc.raPressure) : undefined,
          vasoreactivity: data.rhc.vasoreactivity,
          vasoreactivityAgent: data.rhc.vasoreactivityAgent,
          vasoreactivityPositive: data.rhc.vasoreactivityPositive,
        } : undefined,
      } as any

      if (procedureToEdit?.id) {
        await updateProcedure(patient.id, procedureToEdit.id, payload)
        toast.success('Interventional procedure updated successfully')
      } else {
        await addProcedure(patient.id, payload)
        toast.success('Interventional procedure entered into CathPCI registry')
      }

      onSuccess()
      onClose()
    } catch (err) {
      console.error('Failed to save procedure:', err)
      toast.error('Failed to save procedure record to registry')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-5xl bg-slate-900 border border-amber-500/20 rounded-2xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
        
        {/* Modal Header */}
        <div className="p-5 border-b border-amber-500/10 bg-slate-950/60 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Cath Lab &amp; Interventional Procedure CRF
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  NCDR CathPCI v5.0+
                </span>
              </h2>
              <p className="text-xs text-gray-400">
                Patient: <span className="text-gray-200 font-semibold">{patient.firstName} {patient.lastName}</span> (MRN: {patient.mrn || '—'}) • Age {patient.age ?? '—'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Live Quality Banners */}
        <div className="bg-slate-950/40 px-5 py-2.5 border-b border-white/5 flex items-center justify-between flex-wrap gap-2 text-xs flex-shrink-0">
          <div className="flex items-center gap-4">
            {liveDtb !== null && (
              <span className={cn(
                "font-bold flex items-center gap-1.5 px-2 py-0.5 rounded",
                liveDtb <= 90 ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/20" : "bg-rose-500/15 text-rose-300 border border-rose-500/20"
              )}>
                <Clock className="w-3.5 h-3.5" /> Door-to-Balloon: {liveDtb} mins {liveDtb <= 90 ? '(Target Met)' : '(Target >90m Exceeded)'}
              </span>
            )}
            {isContrastOverCap && (
              <span className="bg-amber-500/15 text-amber-300 border border-amber-500/20 px-2 py-0.5 rounded font-medium flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" /> Contrast {watchContrastVolume}mL exceeds Mehran cap ({mehranContrastCap}mL)
              </span>
            )}
          </div>
          <span className="text-[11px] text-gray-400">
            Tenancy: <strong className="text-gray-300">Site {watch('siteId')}</strong> • Operator: <strong className="text-gray-300">{watch('operatorId')}</strong>
          </span>
        </div>

        {/* Tabs Navigation */}
        <div className="flex border-b border-white/10 bg-slate-950/40 px-5 gap-1 overflow-x-auto flex-shrink-0">
          {[
            { id: 'encounter', label: '1. Encounter & Timings', icon: Clock },
            { id: 'access', label: '2. Access & Technique', icon: Shield },
            { id: 'angiography', label: '3. Angiography (16-Seg)', icon: Heart },
            { id: 'lesions', label: '4. Lesions & Devices', icon: Layers },
            { id: 'safety', label: '5. Results & Safety', icon: AlertTriangle },
            { id: 'discharge', label: '6. Discharge & Rx', icon: CheckCircle2 },
            { id: 'rhc', label: '7. Right Heart Cath (RHC)', icon: Gauge },
          ].map(tab => {
            const Icon = tab.icon
            const active = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  "flex items-center gap-2 py-3 px-3 text-xs font-semibold border-b-2 transition-all whitespace-nowrap",
                  active
                    ? "border-amber-500 text-amber-400 bg-amber-500/5"
                    : "border-transparent text-gray-400 hover:text-gray-200"
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Form Body (Scrollable) */}
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 overflow-y-auto space-y-6 flex-1">
          {Object.keys(errors).length > 0 && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl space-y-2 text-xs text-rose-300 animate-shake">
              <div className="flex items-center gap-2 font-bold text-rose-200">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                <span>Procedural Registry Validation Inconsistencies ({Object.keys(errors).length})</span>
              </div>
              <ul className="list-disc list-inside space-y-1 pl-1 text-[11px] text-rose-300/90">
                {Object.entries(errors).map(([field, err]: [string, any]) => (
                  <li key={field}>
                    <strong className="capitalize">{field.replace(/([A-Z])/g, ' $1')}:</strong> {err?.message || 'Invalid value'}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* TAB 1: Encounter & Timings */}
          {activeTab === 'encounter' && (
            <div className="space-y-5 animate-fade-in">
              <h3 className="text-sm font-bold text-white border-b border-white/5 pb-2">Encounter Classification &amp; STEMI Timekeeper</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <FieldWrap label="Site ID (Tenancy)" error={errors.siteId?.message}>
                  <Input {...register('siteId')} placeholder="e.g. AICTS_PUNE" />
                </FieldWrap>
                <FieldWrap label="Operator ID" error={errors.operatorId?.message}>
                  <Input {...register('operatorId')} placeholder="e.g. OP_01" />
                </FieldWrap>
                <FieldWrap label="Primary Operator Name" error={errors.operatorName?.message}>
                  <Input {...register('operatorName')} placeholder="e.g. Dr. A. Sharma" />
                </FieldWrap>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <FieldWrap label="Procedure Date & Time" error={errors.procedureDateTime?.message}>
                  <Input type="datetime-local" {...register('procedureDateTime')} />
                </FieldWrap>
                <FieldWrap label="Admission Acuity">
                  <Select {...register('admissionType')}>
                    <option value="Elective">Elective</option>
                    <option value="Urgent">Urgent</option>
                    <option value="Emergency">Emergency</option>
                    <option value="Salvage">Salvage (CPR in progress)</option>
                  </Select>
                </FieldWrap>
                <FieldWrap label="Clinical Presentation">
                  <Select {...register('presentation')}>
                    <option value="STEMI">STEMI (ST-Elevation MI)</option>
                    <option value="NSTEMI">NSTEMI (Non-ST-Elevation MI)</option>
                    <option value="UA">Unstable Angina</option>
                    <option value="ChronicCoronarySyndrome">Chronic Coronary Syndrome</option>
                    <option value="Shock">Cardiogenic Shock</option>
                    <option value="OHCA">Out-of-Hospital Cardiac Arrest</option>
                    <option value="Other">Other Diagnostic</option>
                  </Select>
                </FieldWrap>
                <FieldWrap label="Killip Class">
                  <Select {...register('killipClass')}>
                    <option value="I">Class I (No HF)</option>
                    <option value="II">Class II (Rales, S3)</option>
                    <option value="III">Class III (Frank Pulmonary Oedema)</option>
                    <option value="IV">Class IV (Cardiogenic Shock)</option>
                  </Select>
                </FieldWrap>
              </div>

              {/* STEMI Timekeeper Row */}
              <div className="p-4 rounded-xl border border-amber-500/20 bg-slate-950/60 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-amber-300 uppercase tracking-wide flex items-center gap-1.5">
                    <Clock className="w-4 h-4" /> STEMI Hub &amp; Spoke Timelines (Door-to-Balloon)
                  </p>
                  <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
                    <input type="checkbox" {...register('transferredIn')} className="rounded bg-slate-900 border-white/20 text-amber-500" />
                    Transferred from Spoke Facility
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <FieldWrap label="Symptom Onset" hint="Required for STEMI">
                    <Input type="datetime-local" {...register('symptomOnset')} />
                  </FieldWrap>
                  <FieldWrap label="First Medical Contact (FMC)">
                    <Input type="datetime-local" {...register('firstMedicalContact')} />
                  </FieldWrap>
                  <FieldWrap label="Hospital Arrival (Door)">
                    <Input type="datetime-local" {...register('hospitalArrival')} />
                  </FieldWrap>
                  <FieldWrap label="First Diagnostic ECG">
                    <Input type="datetime-local" {...register('ecgTime')} />
                  </FieldWrap>
                  <FieldWrap label="Cath Lab Activation">
                    <Input type="datetime-local" {...register('labActivation')} />
                  </FieldWrap>
                  <FieldWrap label="Arterial Puncture / Access">
                    <Input type="datetime-local" {...register('arterialAccess')} />
                  </FieldWrap>
                  <FieldWrap label="First Intracoronary Device" hint="Balloon/stent/aspiration">
                    <Input type="datetime-local" {...register('firstDevice')} />
                  </FieldWrap>
                  <FieldWrap label="Pharmaco-invasive Thrombolysis">
                    <div className="flex items-center gap-2 pt-1">
                      <input type="checkbox" {...register('thrombolysisGiven')} className="rounded bg-slate-900 border-white/20 text-amber-500" />
                      <span className="text-xs text-gray-300">Lysis Given Pre-Cath</span>
                    </div>
                  </FieldWrap>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Access & Technique */}
          {activeTab === 'access' && (
            <div className="space-y-5 animate-fade-in">
              <h3 className="text-sm font-bold text-white border-b border-white/5 pb-2">Arterial Access &amp; Sheath Technique</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <FieldWrap label="Initial Access Site">
                  <Select {...register('accessSite')}>
                    <option value="Radial Right">Radial Right (Default)</option>
                    <option value="Radial Left">Radial Left</option>
                    <option value="Femoral Right">Femoral Right</option>
                    <option value="Femoral Left">Femoral Left</option>
                    <option value="Ulnar">Ulnar</option>
                    <option value="Brachial">Brachial</option>
                  </Select>
                </FieldWrap>
                <FieldWrap label="French Sheath Size">
                  <Select {...register('sheathSize')}>
                    <option value="5F">5 French</option>
                    <option value="6F">6 French (Standard)</option>
                    <option value="7F">7 French (Complex/Bifurcation)</option>
                    <option value="8F">8 French (Large bore / MCS)</option>
                  </Select>
                </FieldWrap>
                <FieldWrap label="Hemostatic Closure">
                  <Select {...register('closureDevice')}>
                    <option value="Radial Band">Radial Compression Band (TR Band)</option>
                    <option value="Manual Compression">Manual Compression</option>
                    <option value="AngioSeal">Angio-Seal</option>
                    <option value="Perclose">Perclose ProGlide</option>
                    <option value="Mynx">Mynx Control</option>
                    <option value="StarClose">StarClose</option>
                    <option value="None">None</option>
                  </Select>
                </FieldWrap>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-950/60 border border-white/5">
                <label className="flex items-center gap-3 text-xs text-gray-200 cursor-pointer">
                  <input type="checkbox" {...register('accessCrossover')} className="rounded bg-slate-900 border-white/20 text-amber-500" />
                  <span>Access Site Crossover Occurred (e.g. Radial to Femoral)</span>
                </label>
                {watchAccessCrossover && (
                  <FieldWrap label="Crossover Reason" error={errors.crossoverReason?.message}>
                    <Input {...register('crossoverReason')} placeholder="e.g. Severe spasm, subclavian loop, tortuosity" />
                  </FieldWrap>
                )}
              </div>

              {/* Adjunctive Techniques */}
              <h3 className="text-sm font-bold text-white border-b border-white/5 pb-2 pt-2">Advanced Adjuncts &amp; Mechanical Support</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <label className="p-3 rounded-xl bg-slate-950/40 border border-white/5 flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" {...register('thrombectomyDone')} className="rounded text-amber-500" />
                  <span>Thrombectomy</span>
                </label>
                <label className="p-3 rounded-xl bg-slate-950/40 border border-white/5 flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" {...register('atherectomyDone')} className="rounded text-amber-500" />
                  <span>Rotational / Orbital</span>
                </label>
                <label className="p-3 rounded-xl bg-slate-950/40 border border-white/5 flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" {...register('ivlShockwaveDone')} className="rounded text-amber-500" />
                  <span>IVL Shockwave</span>
                </label>
                <label className="p-3 rounded-xl bg-slate-950/40 border border-white/5 flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" {...register('mcsUsed')} className="rounded text-amber-500" />
                  <span>Mechanical Support (MCS)</span>
                </label>
              </div>
            </div>
          )}

          {/* TAB 3: Angiography (16-segment) */}
          {activeTab === 'angiography' && (
            <div className="space-y-5 animate-fade-in">
              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <h3 className="text-sm font-bold text-white">ACC/AHA 16-Segment Coronary Stenosis Mapping</h3>
                <span className="text-xs text-amber-300 font-semibold">
                  Dominance: {watch('dominance')}
                </span>
              </div>

              {/* 16-Segment Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {AHA_CORONARY_SEGMENTS.map(seg => {
                  const val = segmentMap[seg.number] ?? 0
                  return (
                    <div key={seg.number} className={cn(
                      "p-3 rounded-xl border transition-all text-xs space-y-1.5",
                      val >= 70 || (seg.number === 5 && val >= 50)
                        ? "bg-rose-500/10 border-rose-500/30"
                        : val > 0
                        ? "bg-amber-500/10 border-amber-500/20"
                        : "bg-slate-950/40 border-white/5"
                    )}>
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white">#{seg.number} {seg.code}</span>
                        <span className={cn(
                          "font-bold",
                          val >= 70 ? "text-rose-400" : val >= 50 ? "text-amber-400" : "text-gray-400"
                        )}>{val}%</span>
                      </div>
                      <p className="text-[10px] text-gray-400 truncate">{seg.name}</p>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="5"
                        value={val}
                        onChange={e => handleSegmentStenosisChange(seg.number, Number(e.target.value))}
                        className="w-full accent-amber-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                      />
                    </div>
                  )
                })}
              </div>

              {/* Intravascular Imaging & Physiology */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="p-4 rounded-xl bg-slate-950/60 border border-white/5 space-y-3">
                  <label className="flex items-center gap-2 text-xs font-bold text-white cursor-pointer">
                    <input type="checkbox" {...register('ivusOctDone')} className="rounded text-amber-500" />
                    Intravascular Imaging Done (IVUS / OCT)
                  </label>
                  <Input {...register('ivusOctFindings')} placeholder="e.g. Pre-PCI MLA 2.4mm², calcified nodule, post-stent MSA 7.8mm²" />
                </div>
                <div className="p-4 rounded-xl bg-slate-950/60 border border-white/5 space-y-3">
                  <label className="flex items-center gap-2 text-xs font-bold text-white cursor-pointer">
                    <input type="checkbox" {...register('ffrIfrDone')} className="rounded text-amber-500" />
                    Coronary Physiology Done (FFR / iFR / RFR)
                  </label>
                  <Input {...register('ffrIfrValues')} placeholder="e.g. FFR LAD 0.74 (ischemic), post-PCI FFR 0.91" />
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: Lesions & Devices */}
          {activeTab === 'lesions' && (
            <div className="space-y-5 animate-fade-in">
              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <div>
                  <h3 className="text-sm font-bold text-white">Target Lesions &amp; Deployed Stents</h3>
                  <p className="text-xs text-gray-400">Core interventional unit of analysis. Every treated lesion must have documented post-TIMI flow.</p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => appendLesion({
                    id: `lesion-${Date.now()}`,
                    segmentNumber: 1,
                    vessel: 'RCA',
                    lesionOrder: lesionFields.length + 1,
                    preStenosisPct: 90,
                    postStenosisPct: 0,
                    lesionLengthMm: 20,
                    referenceVesselDiameterMm: 3.0,
                    accAhaClass: 'B1',
                    bifurcation: false,
                    ostial: false,
                    cto: false,
                    inStentRestenosis: false,
                    calcification: 'None',
                    thrombusGrade: 0,
                    tortuosity: 'None',
                    culprit: false,
                    treated: true,
                    preTimiFlow: 0,
                    postTimiFlow: 3,
                    deviceIds: [],
                  })}
                  className="btn-primary text-xs flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Lesion
                </Button>
              </div>

              {/* Lesion Repeatable Row Cards */}
              <div className="space-y-4">
                {lesionFields.map((field, index) => {
                  const isExpanded = expandedLesionIndex === index
                  return (
                    <div key={field.id} className="border border-white/10 rounded-xl bg-slate-950/60 overflow-hidden">
                      {/* Card Header */}
                      <div className="p-4 flex items-center justify-between bg-slate-950/80 cursor-pointer" onClick={() => setExpandedLesionIndex(isExpanded ? null : index)}>
                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-300 flex items-center justify-center font-bold text-xs">
                            {index + 1}
                          </span>
                          <div>
                            <p className="text-xs font-bold text-white">
                              Lesion #{index + 1}: Segment #{watch(`lesions.${index}.segmentNumber`)} ({watch(`lesions.${index}.vessel`)})
                            </p>
                            <p className="text-[11px] text-gray-400">
                              Stenosis: {watch(`lesions.${index}.preStenosisPct`)}% → {watch(`lesions.${index}.postStenosisPct`)}% • TIMI {watch(`lesions.${index}.preTimiFlow`)} → {watch(`lesions.${index}.postTimiFlow`)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "text-[10px] px-2 py-0.5 rounded font-bold",
                            watch(`lesions.${index}.postTimiFlow`) === 3 && watch(`lesions.${index}.postStenosisPct`) < 20
                              ? "bg-emerald-500/15 text-emerald-300"
                              : "bg-amber-500/15 text-amber-300"
                          )}>
                            {watch(`lesions.${index}.postTimiFlow`) === 3 && watch(`lesions.${index}.postStenosisPct`) < 20
                              ? 'TIMI 3 Success'
                              : 'Sub-optimal'}
                          </span>
                          {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                          {lesionFields.length > 1 && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); removeLesion(index) }}
                              className="p-1 rounded text-rose-400 hover:bg-rose-500/10 ml-2"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Expanded Lesion Details */}
                      {isExpanded && (
                        <div className="p-4 border-t border-white/5 space-y-4 text-xs">
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <FieldWrap label="AHA Segment Number">
                              <Select {...register(`lesions.${index}.segmentNumber`)}>
                                {AHA_CORONARY_SEGMENTS.map(s => (
                                  <option key={s.number} value={s.number}>#{s.number} - {s.name}</option>
                                ))}
                              </Select>
                            </FieldWrap>
                            <FieldWrap label="Vessel Territory">
                              <Select {...register(`lesions.${index}.vessel`)}>
                                <option value="LAD">LAD</option>
                                <option value="LCx">LCx</option>
                                <option value="RCA">RCA</option>
                                <option value="LM">LM (Left Main)</option>
                                <option value="Ramus">Ramus</option>
                                <option value="Graft">Bypass Graft</option>
                              </Select>
                            </FieldWrap>
                            <FieldWrap label="Pre Stenosis (%)">
                              <Input type="number" min="0" max="100" {...register(`lesions.${index}.preStenosisPct`)} />
                            </FieldWrap>
                            <FieldWrap label="Post Stenosis (%)">
                              <Input type="number" min="0" max="100" {...register(`lesions.${index}.postStenosisPct`)} />
                            </FieldWrap>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <FieldWrap label="Pre TIMI Flow">
                              <Select {...register(`lesions.${index}.preTimiFlow`)}>
                                <option value="0">TIMI 0 (No perfusion)</option>
                                <option value="1">TIMI 1 (Penetration without perfusion)</option>
                                <option value="2">TIMI 2 (Partial perfusion)</option>
                                <option value="3">TIMI 3 (Complete normal perfusion)</option>
                              </Select>
                            </FieldWrap>
                            <FieldWrap label="Post TIMI Flow">
                              <Select {...register(`lesions.${index}.postTimiFlow`)}>
                                <option value="0">TIMI 0</option>
                                <option value="1">TIMI 1</option>
                                <option value="2">TIMI 2</option>
                                <option value="3">TIMI 3</option>
                              </Select>
                            </FieldWrap>
                            <FieldWrap label="Lesion Length (mm)">
                              <Input type="number" min="1" max="100" {...register(`lesions.${index}.lesionLengthMm`)} />
                            </FieldWrap>
                            <FieldWrap label="Reference Vessel Diam (mm)">
                              <Input type="number" step="0.25" min="1.5" max="6.0" {...register(`lesions.${index}.referenceVesselDiameterMm`)} />
                            </FieldWrap>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input type="checkbox" {...register(`lesions.${index}.culprit`)} className="rounded text-amber-500" />
                              <span>Culprit Lesion</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input type="checkbox" {...register(`lesions.${index}.bifurcation`)} className="rounded text-amber-500" />
                              <span>Bifurcation</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input type="checkbox" {...register(`lesions.${index}.cto`)} className="rounded text-amber-500" />
                              <span>Chronic Total Occlusion (CTO)</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input type="checkbox" {...register(`lesions.${index}.inStentRestenosis`)} className="rounded text-amber-500" />
                              <span>In-Stent Restenosis (ISR)</span>
                            </label>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Devices / Stents Table */}
              <div className="pt-4 border-t border-white/5 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wide">Implanted Hardware (Stents, DCB, Scaffolds)</h4>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => appendDevice({
                      id: `dev-${Date.now()}`,
                      targetSegment: 6,
                      type: 'DES',
                      make: 'Abbott',
                      model: 'Xience Sierra',
                      diameterMm: 3.0,
                      lengthMm: 28,
                      deploymentPressureAtm: 14,
                      postDilatation: true,
                      postDilatationPressureAtm: 18,
                    })}
                    className="btn-secondary text-xs flex items-center gap-1.5"
                  >
                    <Plus className="w-3 h-3" /> Add Stent/Device
                  </Button>
                </div>

                <div className="space-y-2">
                  {deviceFields.map((dev, dIdx) => (
                    <div key={dev.id} className="grid grid-cols-2 sm:grid-cols-6 gap-2 p-2.5 rounded-lg bg-slate-950/40 border border-white/5 items-center text-xs">
                      <FieldWrap label="Hardware Type">
                        <Select {...register(`devices.${dIdx}.type`)}>
                          <option value="DES">Drug-Eluting Stent (DES)</option>
                          <option value="DCB">Drug-Coated Balloon (DCB)</option>
                          <option value="BMS">Bare-Metal Stent (BMS)</option>
                          <option value="BVS">Bio-resorbable Scaffold</option>
                          <option value="POBA">Plain Balloon (POBA)</option>
                        </Select>
                      </FieldWrap>
                      <FieldWrap label="Make">
                        <Input {...register(`devices.${dIdx}.make`)} placeholder="e.g. Abbott / Medtronic" />
                      </FieldWrap>
                      <FieldWrap label="Model">
                        <Input {...register(`devices.${dIdx}.model`)} placeholder="e.g. Resolute Onyx" />
                      </FieldWrap>
                      <FieldWrap label="Diam (mm)">
                        <Input type="number" step="0.25" min="1.5" max="6.0" {...register(`devices.${dIdx}.diameterMm`)} />
                      </FieldWrap>
                      <FieldWrap label="Length (mm)">
                        <Input type="number" min="6" max="60" {...register(`devices.${dIdx}.lengthMm`)} />
                      </FieldWrap>
                      <div className="flex items-center justify-end pt-4">
                        <button
                          type="button"
                          onClick={() => removeDevice(dIdx)}
                          className="p-1 rounded text-rose-400 hover:bg-rose-500/10"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: Results & Safety */}
          {activeTab === 'safety' && (
            <div className="space-y-5 animate-fade-in">
              <h3 className="text-sm font-bold text-white border-b border-white/5 pb-2">Procedural Complications &amp; Quality Endpoints</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FieldWrap label="Ellis Coronary Perforation Class">
                  <Select {...register('perforationEllis')}>
                    <option value="None">None (Clean)</option>
                    <option value="Class I">Class I: Extraluminal crater without extravasation</option>
                    <option value="Class II">Class II: Pericardial or myocardial blushing</option>
                    <option value="Class III">Class III: Frank extravasation (≥1mm jet)</option>
                    <option value="Class CS (Cavity Spilling)">Class CS: Cavity spilling (into ventricle/atrium)</option>
                  </Select>
                </FieldWrap>
                <FieldWrap label="NHLBI Dissection Type">
                  <Select {...register('dissectionNhlbi')}>
                    <option value="None">None (Clean)</option>
                    <option value="Type A">Type A: Minor radiolucent area</option>
                    <option value="Type B">Type B: Linear parallel tract</option>
                    <option value="Type C">Type C: Extraluminal cap with persistence</option>
                    <option value="Type D">Type D: Spiral dissection</option>
                    <option value="Type E">Type E: Persistent filling defect</option>
                    <option value="Type F">Type F: Total coronary occlusion</option>
                  </Select>
                </FieldWrap>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-xl bg-slate-950/60 border border-white/5 text-xs">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" {...register('noReflow')} className="rounded text-rose-500" />
                  <span>Slow-flow / No-reflow</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" {...register('sideBranchLoss')} className="rounded text-rose-500" />
                  <span>Side Branch Occlusion</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" {...register('acuteStentThrombosis')} className="rounded text-rose-500" />
                  <span>Acute Stent Thrombosis</span>
                </label>
              </div>

              {/* Radiation Exposure */}
              <h3 className="text-sm font-bold text-white border-b border-white/5 pb-2 pt-2">Radiation &amp; Contrast Exposure</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <FieldWrap label="Contrast Volume (mL)" error={errors.contrastVolumeMl?.message}>
                  <Input type="number" min="0" max="1000" {...register('contrastVolumeMl')} />
                </FieldWrap>
                <FieldWrap label="Fluoroscopy Time (minutes)" error={errors.fluoroscopyTimeMin?.message}>
                  <Input type="number" min="0" max="240" {...register('fluoroscopyTimeMin')} />
                </FieldWrap>
                <FieldWrap label="Peak ACT (seconds)">
                  <Input type="number" min="100" max="600" {...register('peakActSeconds')} placeholder="e.g. 280" />
                </FieldWrap>
              </div>
            </div>
          )}

          {/* TAB 6: Discharge & Secondary Prevention */}
          {activeTab === 'discharge' && (
            <div className="space-y-5 animate-fade-in">
              <h3 className="text-sm font-bold text-white border-b border-white/5 pb-2">Discharge Pharmacotherapy &amp; Staging</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <FieldWrap label="Discharge DAPT Regimen">
                  <Select {...register('dischargeDaptAgent')}>
                    <option value="Aspirin + Ticagrelor">Aspirin + Ticagrelor (ACS default)</option>
                    <option value="Aspirin + Prasugrel">Aspirin + Prasugrel</option>
                    <option value="Aspirin + Clopidogrel">Aspirin + Clopidogrel</option>
                    <option value="Single Antiplatelet">Single Antiplatelet (SAPT)</option>
                    <option value="None">None</option>
                  </Select>
                </FieldWrap>
                <FieldWrap label="Planned DAPT Duration (months)">
                  <Select {...register('dischargeDaptDurationMonths')}>
                    <option value="1">1 Month (High bleeding risk)</option>
                    <option value="3">3 Months</option>
                    <option value="6">6 Months</option>
                    <option value="12">12 Months (Standard ACS)</option>
                    <option value="24">Extended DAPT (&gt;12 Months)</option>
                  </Select>
                </FieldWrap>
                <FieldWrap label="Statin Intensity">
                  <Select {...register('dischargeStatinIntensity')}>
                    <option value="High">High-Intensity (Atorva 80 / Rosuva 40)</option>
                    <option value="Moderate">Moderate-Intensity</option>
                    <option value="Low">Low-Intensity</option>
                    <option value="None">None / Statin Intolerant</option>
                  </Select>
                </FieldWrap>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-xl bg-slate-950/60 border border-white/5 text-xs">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" {...register('dischargeBetaBlocker')} className="rounded text-amber-500" />
                  <span>Beta-Blocker Prescribed</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" {...register('dischargeAceiArb')} className="rounded text-amber-500" />
                  <span>ACEi / ARB Prescribed</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" {...register('dischargeOac')} className="rounded text-amber-500" />
                  <span>Oral Anticoagulation (Triple/Double Rx)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" {...register('stagedPciPlanned')} className="rounded text-amber-500" />
                  <span>Staged PCI Planned</span>
                </label>
              </div>

              {watch('stagedPciPlanned') && (
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 max-w-sm">
                  <FieldWrap label="Scheduled Staged PCI Date" error={errors.stagedPciDate?.message}>
                    <Input type="date" {...register('stagedPciDate')} />
                  </FieldWrap>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <FieldWrap label="Discharge Date">
                  <Input type="date" {...register('dischargeDate')} />
                </FieldWrap>
                <FieldWrap label="Registry Abstractor Name" error={errors.enteredBy?.message}>
                  <Input {...register('enteredBy')} placeholder="Your name or initials" />
                </FieldWrap>
              </div>
            </div>
          )}

          {/* TAB 7: Right Heart Catheterisation (RHC) */}
          {activeTab === 'rhc' && (
            <div className="space-y-5 animate-fade-in">
              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <div>
                  <h3 className="text-sm font-bold text-white">Right Heart Catheterisation (RHC) Dataset</h3>
                  <p className="text-xs text-gray-400">Pulmonary hypertension hemodynamics, transpulmonary gradient &amp; vasoreactivity</p>
                </div>
                <label className="flex items-center gap-2 cursor-pointer bg-blue-500/10 border border-blue-500/20 px-3 py-1.5 rounded-lg text-xs text-blue-300 font-semibold">
                  <input type="checkbox" {...register('rhc.performed')} className="rounded text-blue-500" />
                  <span>RHC Performed in Encounter</span>
                </label>
              </div>

              {watch('rhc.performed') ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FieldWrap label="RHC Procedure Date">
                      <Input type="date" {...register('rhc.rhcDate')} />
                    </FieldWrap>
                    <FieldWrap label="Clinical Indication for RHC">
                      <Select {...register('rhc.indication')}>
                        <option value="Heart Failure / Pulmonary Hypertension Workup">Heart Failure / Pulmonary Hypertension Workup</option>
                        <option value="Cardiogenic Shock / Hemodynamic Profiling">Cardiogenic Shock / Hemodynamic Profiling</option>
                        <option value="Pre-Transplant / LVAD Candidacy">Pre-Transplant / LVAD Candidacy</option>
                        <option value="Valvular Heart Disease / Pre-TAVI/TEER">Valvular Heart Disease / Pre-TAVI/TEER</option>
                        <option value="Constrictive vs Restrictive Evaluation">Constrictive vs Restrictive Evaluation</option>
                        <option value="Unexplained Dyspnea">Unexplained Dyspnea</option>
                      </Select>
                    </FieldWrap>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-950/60 border border-white/5">
                    <FieldWrap label="RA Pressure (mmHg)">
                      <Input type="number" step="0.1" {...register('rhc.raPressure')} placeholder="Normal: 2-6" />
                    </FieldWrap>
                    <FieldWrap label="Systolic PAP (sPAP mmHg)">
                      <Input type="number" step="0.1" {...register('rhc.sPAP')} placeholder="Normal: 15-30" />
                    </FieldWrap>
                    <FieldWrap label="Diastolic PAP (dPAP mmHg)">
                      <Input type="number" step="0.1" {...register('rhc.dPAP')} placeholder="Normal: 4-12" />
                    </FieldWrap>
                    <FieldWrap label="Mean PAP (mPAP mmHg)">
                      <Input type="number" step="0.1" {...register('rhc.mPAP')} placeholder="Normal: <20 (>20 PH)" />
                    </FieldWrap>

                    <FieldWrap label="PCWP / Wedge (mmHg)">
                      <Input type="number" step="0.1" {...register('rhc.pcwp')} placeholder="Normal: <=15" />
                    </FieldWrap>
                    <FieldWrap label="Cardiac Output (L/min)">
                      <Input type="number" step="0.1" {...register('rhc.cardiacOutput')} placeholder="e.g. 4.8" />
                    </FieldWrap>
                    <FieldWrap label="Cardiac Index (L/min/m²)">
                      <Input type="number" step="0.1" {...register('rhc.cardiacIndex')} placeholder="Normal: 2.5-4.0" />
                    </FieldWrap>
                    <FieldWrap label="PVR (Wood Units)">
                      <Input type="number" step="0.1" {...register('rhc.pvr')} placeholder="Normal: <2.0" />
                    </FieldWrap>

                    <FieldWrap label="TPG (mPAP - PCWP mmHg)">
                      <Input type="number" step="0.1" {...register('rhc.tpg')} placeholder="Normal: <12" />
                    </FieldWrap>
                    <FieldWrap label="DPG (dPAP - PCWP mmHg)">
                      <Input type="number" step="0.1" {...register('rhc.dpg')} placeholder="Normal: <7" />
                    </FieldWrap>
                    <FieldWrap label="SVR (dyn·s/cm⁵)">
                      <Input type="number" step="1" {...register('rhc.svr')} placeholder="Normal: 800-1200" />
                    </FieldWrap>
                    <FieldWrap label="SvO2 / Mixed Venous Sat (%)">
                      <Input type="number" step="0.1" {...register('rhc.svO2')} placeholder="Normal: 65-75%" />
                    </FieldWrap>
                  </div>

                  {/* Acute Vasoreactivity Testing */}
                  <div className="p-4 rounded-xl bg-slate-950/40 border border-white/5 space-y-3">
                    <p className="text-xs font-bold text-gray-300">Acute Vasoreactivity Testing Protocol</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-300">
                        <input type="checkbox" {...register('rhc.vasoreactivity')} className="rounded text-amber-500" />
                        <span>Vasoreactivity Testing Performed</span>
                      </label>
                      <FieldWrap label="Vasoreactivity Agent">
                        <Select {...register('rhc.vasoreactivityAgent')}>
                          <option value="">None</option>
                          <option value="Inhaled Nitric Oxide (iNO 20-40 ppm)">Inhaled Nitric Oxide (iNO 20-40 ppm)</option>
                          <option value="Inhaled Iloprost">Inhaled Iloprost</option>
                          <option value="IV Adenosine">IV Adenosine</option>
                        </Select>
                      </FieldWrap>
                      <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-300">
                        <input type="checkbox" {...register('rhc.vasoreactivityPositive')} className="rounded text-emerald-500" />
                        <span>Positive Vasoreactivity (mPAP drop ≥10 to ≤40 mmHg)</span>
                      </label>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-8 rounded-xl bg-slate-950/30 border border-dashed border-white/10 text-center space-y-2">
                  <Gauge className="w-8 h-8 text-gray-500 mx-auto" />
                  <p className="text-xs font-semibold text-gray-400">Right Heart Catheterisation Not Performed</p>
                  <p className="text-[11px] text-gray-500">Enable the toggle above if pulmonary artery pressures, wedge pressure, or vasoreactivity testing were performed during this cath lab encounter.</p>
                </div>
              )}
            </div>
          )}

          {/* Form Actions Footer */}
          <div className="pt-4 border-t border-white/10 flex items-center justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="text-xs"
            >
              Cancel
            </Button>
            <div className="flex items-center gap-2">
              <Button
                type="submit"
                loading={saving}
                className="btn-primary text-xs flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                Save Procedure to CathPCI Registry
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
