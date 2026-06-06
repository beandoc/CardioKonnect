'use client'
import { useState, useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { FieldWrap, Input, Select, Textarea } from '@/components/ui/FormField'
import { RadioChipGroup, CheckChipGroup } from '@/components/ui/ChipGroup'
import Button from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import type { VisitInput } from '@/lib/types'
import { ChevronRight, ChevronLeft, ShieldAlert, Award, Save } from 'lucide-react'
import { toast } from 'sonner'

// ─── Zod schema ─────────────────────────────────────────────────────────────
const medEntry = z.object({
  prescribed: z.enum(['Yes', 'No', '']).default(''),
  type:       z.string().optional(),
  dose:       z.string().optional(),
  reason:     z.string().optional(),
  startDate:  z.string().optional(),
  stopDate:   z.string().optional(),
  changeReason: z.string().optional(),
})

const prescribedOnly = z.object({
  prescribed: z.enum(['Yes', 'No', '']).default(''),
  type:       z.string().optional(),
  dose:       z.string().optional(),
  startDate:  z.string().optional(),
  stopDate:   z.string().optional(),
  changeReason: z.string().optional(),
})

const schema = z.object({
  // Visit meta
  visitDate: z.string().min(1, 'Required'),
  visitType: z.enum(['OPD', 'Telemedicine', 'Inpatient', '']).default('OPD'),
  echoDoneToday: z.boolean().default(false),
  labsDrawnToday: z.boolean().default(false),

  // Inpatient specifics
  icuDays: z.coerce.number().optional().or(z.literal('')),
  admissionReason: z.string().optional(),
  dischargeDate: z.string().optional(),
  ventilationSupport: z.enum(['No', 'NIV', 'Invasive', '']).default(''),
  mcsSupport: z.enum(['No', 'IABP', 'VAD', '']).default(''),
  weightDischarge: z.coerce.number().optional().or(z.literal('')),
  dischargeOutcome: z.enum(['Discharge', 'Death', 'Referred', '']).default(''),
  causeOfDeath: z.enum(['SCD', 'Pump failure', 'MODS', 'Others', '']).default(''),
  lastHospDate: z.string().optional(),

  // Anthropometrics
  weight: z.coerce.number().positive().optional().or(z.literal('')),
  height: z.coerce.number().positive().optional().or(z.literal('')),
  bmi:    z.coerce.number().optional().or(z.literal('')),
  o2Sat:  z.coerce.number().min(50).max(100).optional().or(z.literal('')),
  oedema: z.string().optional(),

  // Vitals
  bpSystolic:  z.coerce.number().optional().or(z.literal('')),
  bpDiastolic: z.coerce.number().optional().or(z.literal('')),
  heartRate:   z.coerce.number().optional().or(z.literal('')),

  // Clinical
  nyha:    z.enum(['I', 'II', 'III', 'IV', '']).default(''),
  rhythm:  z.string().optional(),
  sixMWT:  z.coerce.number().optional().or(z.literal('')),
  hfType:  z.enum(['HFrEF', 'HFmrEF', 'HFpEF', '']).default(''),
  etiology: z.array(z.string()).default([]),
  etiologyOther: z.string().optional(),

  // Symptoms Checklist
  symptomDyspnea: z.boolean().default(false),
  symptomFatigue: z.boolean().default(false),
  symptomEdema: z.boolean().default(false),
  symptomPalpitation: z.boolean().default(false),
  symptomAngina: z.boolean().default(false),
  symptomAscites: z.boolean().default(false),

  // Signs Checklist
  signLungRales: z.boolean().default(false),
  signPleuralEffusion: z.boolean().default(false),
  signElevatedJVP: z.boolean().default(false),
  signS3: z.boolean().default(false),
  signDependentEdema: z.boolean().default(false),
  signHepatomegaly: z.boolean().default(false),
  signCardiomegaly: z.boolean().default(false),

  jvpStatus: z.enum(['Elevated', 'Not elevated', '']).default(''),
  ventricularArrhythmia: z.boolean().default(false),

  // Interval Events (since last visit)
  eventMI:            z.boolean().default(false),
  eventStroke:        z.boolean().default(false),
  eventVTVF:          z.boolean().default(false),
  eventICDShock:      z.boolean().default(false),
  eventHospitalisation: z.boolean().default(false),

  // Hospitalisation
  hospHistory: z.enum(['Yes', 'No', '']).default(''),
  hospCount:   z.coerce.number().optional().or(z.literal('')),
  hospDetails: z.string().optional(),

  // Echo
  lvef:     z.coerce.number().min(0).max(100).optional().or(z.literal('')),
  echoDate: z.string().optional(),
  lvdd:     z.coerce.number().optional().or(z.literal('')),
  lvsd:     z.coerce.number().optional().or(z.literal('')),
  eEPrime:  z.coerce.number().optional().or(z.literal('')),
  ddGrade:  z.string().optional(),
  rvsp:     z.coerce.number().optional().or(z.literal('')),
  tapse:    z.coerce.number().optional().or(z.literal('')),
  laStrain: z.coerce.number().optional().or(z.literal('')),
  rvFreeWallStrain: z.coerce.number().optional().or(z.literal('')),
  lvMassIndex: z.coerce.number().optional().or(z.literal('')),
  relativeWallThickness: z.coerce.number().optional().or(z.literal('')),
  echNotes: z.string().optional(),

  // Labs
  ntProBNP:       z.coerce.number().optional().or(z.literal('')),
  bnp:            z.coerce.number().optional().or(z.literal('')),
  egfr:           z.coerce.number().optional().or(z.literal('')),
  creatinine:     z.coerce.number().optional().or(z.literal('')),
  potassium:      z.coerce.number().optional().or(z.literal('')),
  sodium:         z.coerce.number().optional().or(z.literal('')),
  hb:             z.coerce.number().optional().or(z.literal('')),
  tft:            z.coerce.number().optional().or(z.literal('')),
  hba1c:          z.coerce.number().optional().or(z.literal('')),
  ferritin:       z.coerce.number().optional().or(z.literal('')),
  transferrinSat: z.coerce.number().optional().or(z.literal('')),
  uricAcid:       z.coerce.number().optional().or(z.literal('')),
  ldl:            z.coerce.number().optional().or(z.literal('')),
  triglycerides:  z.coerce.number().optional().or(z.literal('')),
  hsCrp:          z.coerce.number().optional().or(z.literal('')),
  il6:            z.coerce.number().optional().or(z.literal('')),
  tnfAlpha:       z.coerce.number().optional().or(z.literal('')),
  
  // HF Registry Labs
  peakTropT: z.coerce.number().optional().or(z.literal('')),
  tropTPositive: z.boolean().default(false),
  peakTropI: z.coerce.number().optional().or(z.literal('')),
  tropIPositive: z.boolean().default(false),
  serumUrea: z.coerce.number().optional().or(z.literal('')),
  bun: z.coerce.number().optional().or(z.literal('')),
  bnpDischarge: z.coerce.number().optional().or(z.literal('')),
  ntProBnpDischarge: z.coerce.number().optional().or(z.literal('')),

  // ECG
  qrsDuration: z.coerce.number().optional().or(z.literal('')),
  bbb:         z.string().optional(),
  qtcInterval: z.coerce.number().optional().or(z.literal('')),

  // Core meds
  diuretic:    medEntry,
  raasi:       medEntry,
  betaBlocker: medEntry,
  digoxin:     medEntry,
  sglt2i:      medEntry,
  ivabradine:  medEntry,
  mra:         medEntry,

  // Dyslipidemia
  aspirin: prescribedOnly,
  statin:  prescribedOnly,
  fibrate: prescribedOnly,
  pcsk9:   prescribedOnly,

  // DM
  dmManagement: z.object({
    hba1c:  z.coerce.number().optional().or(z.literal('')),
    drug:   z.string().optional(),
    reason: z.string().optional(),
  }).default({}),

  // Iron
  ivIron: medEntry,

  // Anti-arrhythmic
  noac: prescribedOnly,
  vki:  prescribedOnly,
  antiarrhythmicReason: z.string().optional(),

  // Device
  device:      z.array(z.string()).default([]),
  deviceNotes: z.string().optional(),

  // Vaccination
  vaccInfluenza:     z.string().optional(),
  vaccInfluenzaDate: z.string().optional(),
  vaccPneumo:        z.string().optional(),
  vaccPneumoDate:    z.string().optional(),

  // Functional
  gripRight: z.coerce.number().optional().or(z.literal('')),
  gripLeft:  z.coerce.number().optional().or(z.literal('')),
  frailty:   z.string().optional(),

  // Education
  education: z.array(z.string()).default([]),
  eduNotes:  z.string().optional(),

  // Follow-up
  followupDate: z.string().optional(),
  followupType: z.string().optional(),
  clinicalNotes: z.string().optional(),

  // Novel biomarkers
  hsTnT: z.coerce.number().optional().or(z.literal('')),
  hsTnI: z.coerce.number().optional().or(z.literal('')),
  sST2:  z.coerce.number().optional().or(z.literal('')),
  galectin3: z.coerce.number().optional().or(z.literal('')),
  gdf15: z.coerce.number().optional().or(z.literal('')),
  ca125: z.coerce.number().optional().or(z.literal('')),
  cystatinC: z.coerce.number().optional().or(z.literal('')),
  crp: z.coerce.number().optional().or(z.literal('')),
  esr: z.coerce.number().optional().or(z.literal('')),
  proBNP: z.coerce.number().optional().or(z.literal('')),

  // Vascular
  vascular: z.object({
    pulseWaveVelocity: z.coerce.number().optional().or(z.literal('')),
    augmentationIndex: z.coerce.number().optional().or(z.literal('')),
    centralAorticPressure: z.coerce.number().optional().or(z.literal('')),
    arterialStiffnessIndex: z.coerce.number().optional().or(z.literal('')),
    flowMediatedDilation: z.coerce.number().optional().or(z.literal('')),
    carotidImt: z.coerce.number().optional().or(z.literal('')),
    carotidPlaqueBurden: z.string().optional(),
  }).optional(),

  // Cardiac MRI
  cardiacMRI: z.object({
    lgePresent: z.boolean().optional(),
    lgePattern: z.string().optional(),
    t1Native: z.coerce.number().optional().or(z.literal('')),
    t2Star: z.coerce.number().optional().or(z.literal('')),
    t2Mapping: z.coerce.number().optional().or(z.literal('')),
    ecv: z.coerce.number().optional().or(z.literal('')),
    lgeBurden: z.coerce.number().optional().or(z.literal('')),
    rvefMRI: z.coerce.number().optional().or(z.literal('')),
    lvMassMRI: z.coerce.number().optional().or(z.literal('')),
  }).optional(),

  // CPET
  cpet: z.object({
    cpetDate: z.string().optional(),
    protocol: z.string().optional(),
    peakVO2: z.coerce.number().optional().or(z.literal('')),
    veCO2Slope: z.coerce.number().optional().or(z.literal('')),
    anaerobicThreshold: z.coerce.number().optional().or(z.literal('')),
    peakRER: z.coerce.number().optional().or(z.literal('')),
    o2Pulse: z.coerce.number().optional().or(z.literal('')),
    oues: z.coerce.number().optional().or(z.literal('')),
    peakWorkload: z.coerce.number().optional().or(z.literal('')),
    exerciseDuration: z.coerce.number().optional().or(z.literal('')),
    terminationReason: z.string().optional(),
    weberClass: z.string().optional(),
    cpetNotes: z.string().optional(),
  }).optional(),

  // RHC
  rhc: z.object({
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

  // KCCQ
  kccq: z.object({
    physicalLimitation: z.coerce.number().optional().or(z.literal('')),
    symptomFrequency: z.coerce.number().optional().or(z.literal('')),
    symptomBurden: z.coerce.number().optional().or(z.literal('')),
    qualityOfLife: z.coerce.number().optional().or(z.literal('')),
    socialLimitation: z.coerce.number().optional().or(z.literal('')),
    overallSummaryScore: z.coerce.number().optional().or(z.literal('')),
  }).optional(),

  // Sleep
  sleep: z.object({
    ahiIndex: z.coerce.number().optional().or(z.literal('')),
    sleepApneaType: z.string().optional(),
    epworthScore: z.coerce.number().optional().or(z.literal('')),
    treatment: z.string().optional(),
    nocturnalSatNadir: z.coerce.number().optional().or(z.literal('')),
  }).optional(),

  symptomTrajectory: z.enum(['Improving', 'Stable', 'Worsening', '']).default(''),
  coronaryAnatomy: z.object({
    lmStenosis: z.coerce.number().min(0).max(100).optional().or(z.literal('')),
    ladStenosis: z.coerce.number().min(0).max(100).optional().or(z.literal('')),
    lcxStenosis: z.coerce.number().min(0).max(100).optional().or(z.literal('')),
    rcaStenosis: z.coerce.number().min(0).max(100).optional().or(z.literal('')),
    syntaxScore: z.coerce.number().min(0).max(150).optional().or(z.literal('')),
    priorPciDate: z.string().optional(),
    priorCabgDate: z.string().optional(),
    revascularizationType: z.enum(['None', 'PCI', 'CABG', 'Both', '']).default(''),
  }).default({}),

  valvularHemodynamics: z.object({
    asAVA: z.coerce.number().min(0).max(10).optional().or(z.literal('')),
    asMeanGradient: z.coerce.number().min(0).max(150).optional().or(z.literal('')),
    asVmax: z.coerce.number().min(0).max(10).optional().or(z.literal('')),
    mrRegurgitantVolume: z.coerce.number().min(0).max(200).optional().or(z.literal('')),
    mrEROA: z.coerce.number().min(0).max(100).optional().or(z.literal('')),
    arRegurgitantVolume: z.coerce.number().min(0).max(200).optional().or(z.literal('')),
    arEROA: z.coerce.number().min(0).max(100).optional().or(z.literal('')),
    msMVA: z.coerce.number().min(0).max(10).optional().or(z.literal('')),
    msMeanGradient: z.coerce.number().min(0).max(50).optional().or(z.literal('')),
  }).default({}),

  // Valvular grade fields (top-level in Visit type)
  asGrade: z.string().optional(),
  msGrade: z.string().optional(),
  mrGrade: z.string().optional(),
  arGrade: z.string().optional(),

  // Holter / Wearable
  holterWearable: z.object({
    afBurden: z.coerce.number().optional().or(z.literal('')),
    pvcBurden: z.coerce.number().optional().or(z.literal('')),
  }).optional(),

  // CT Coronary Angiography
  ctca: z.object({
    stenosisSeverity: z.string().optional(),
    highRiskPlaqueFeatures: z.boolean().optional(),
    notes: z.string().optional(),
  }).optional(),


  eq5d: z.object({
    mobility: z.coerce.number().min(1).max(5).optional().or(z.literal('')),
    selfCare: z.coerce.number().min(1).max(5).optional().or(z.literal('')),
    usualActivities: z.coerce.number().min(1).max(5).optional().or(z.literal('')),
    painDiscomfort: z.coerce.number().min(1).max(5).optional().or(z.literal('')),
    anxietyDepression: z.coerce.number().min(1).max(5).optional().or(z.literal('')),
    healthStateScore: z.coerce.number().min(0).max(100).optional().or(z.literal('')),
  }).default({}),
}).superRefine((data, ctx) => {
  if (data.lvef !== undefined && data.lvef !== '') {
    const lvef = Number(data.lvef)
    if (data.hfType === 'HFrEF' && lvef >= 40) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'HFrEF requires LVEF < 40%',
        path: ['hfType']
      })
    }
    if (data.hfType === 'HFmrEF' && (lvef < 40 || lvef > 49)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'HFmrEF requires LVEF 40–49%',
        path: ['hfType']
      })
    }
    if (data.hfType === 'HFpEF' && lvef < 50) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'HFpEF requires LVEF ≥ 50%',
        path: ['hfType']
      })
    }
  }
})

type FormValues = z.infer<typeof schema>

// ─── Sub-component for a medication row ────────────────────────────────────

function MedRow({
  label, prescribedField, typeField, typeOptions, doseField, reasonField,
  startDateField, stopDateField, changeReasonField, control, register, disabled
}: {
  label: string
  prescribedField: string
  typeField?: string
  typeOptions?: string[]
  doseField?: string
  reasonField?: string
  startDateField?: string
  stopDateField?: string
  changeReasonField?: string
  control: any
  register: any
  disabled?: boolean
}) {
  return (
    <div className="bg-gray-800/40 border border-blue-500/10 rounded-xl p-4 space-y-3">
      <p className="text-sm font-semibold text-white">{label}</p>
      <Controller
        name={prescribedField as never}
        control={control}
        render={({ field }) => (
          <RadioChipGroup
            options={[{ value: 'Yes', label: 'Prescribed' }, { value: 'No', label: 'Not Prescribed' }]}
            value={field.value as string}
            onChange={field.onChange}
            disabled={disabled}
          />
        )}
      />
      <div className="grid grid-cols-2 gap-3">
        {typeField && typeOptions && (
          <FieldWrap label="Drug / Type">
            <Select {...register(typeField)} disabled={disabled}>
              <option value="">Select</option>
              {typeOptions.map(o => <option key={o}>{o}</option>)}
            </Select>
          </FieldWrap>
        )}
        {doseField && (
          <FieldWrap label="Dose">
            <Input {...register(doseField)} placeholder="e.g. 40mg OD" disabled={disabled} />
          </FieldWrap>
        )}
        {startDateField && (
          <FieldWrap label="Start Date">
            <Input type="date" {...register(startDateField)} disabled={disabled} />
          </FieldWrap>
        )}
        {stopDateField && (
          <FieldWrap label="Stop Date">
            <Input type="date" {...register(stopDateField)} disabled={disabled} />
          </FieldWrap>
        )}
        {changeReasonField && (
          <FieldWrap label="Escalation / Change Reason" className="col-span-2">
            <Input {...register(changeReasonField)} placeholder="Reason for change, e.g. dose escalation, side effects" disabled={disabled} />
          </FieldWrap>
        )}
        {reasonField && (
          <FieldWrap label="Reason if not prescribed" className="col-span-2">
            <Input {...register(reasonField)} placeholder="Reason" disabled={disabled} />
          </FieldWrap>
        )}
      </div>
    </div>
  )
}

// ─── Main component ─────────────────────────────────────────────────────────

interface Props {
  defaultValues?: Partial<VisitInput>
  onSubmit: (data: VisitInput) => Promise<void>
  loading?: boolean
  patientId?: string
}

export default function VisitForm({ defaultValues, onSubmit, loading, patientId }: Props) {
  const [tab, setTab] = useState(0)
  const [draftSaved, setDraftSaved] = useState(false)

  const { register, control, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      visitDate: new Date().toISOString().split('T')[0],
      visitType: 'OPD',
      echoDoneToday: false,
      labsDrawnToday: false,
      diuretic: { prescribed: '' },
      raasi: { prescribed: '' },
      betaBlocker: { prescribed: '' },
      digoxin: { prescribed: '' },
      sglt2i: { prescribed: '' },
      ivabradine: { prescribed: '' },
      mra: { prescribed: '' },
      aspirin: { prescribed: '' },
      statin: { prescribed: '' },
      fibrate: { prescribed: '' },
      pcsk9: { prescribed: '' },
      ivIron: { prescribed: '' },
      noac: { prescribed: '' },
      vki: { prescribed: '' },
      etiology: [],
      device: [],
      education: [],
      dmManagement: {},
      vascular: {},
      holterWearable: {},
      ctca: {},
      cardiacMRI: {},
      symptomTrajectory: '',
      symptomDyspnea: false,
      symptomFatigue: false,
      symptomEdema: false,
      symptomPalpitation: false,
      symptomAngina: false,
      symptomAscites: false,
      signLungRales: false,
      signPleuralEffusion: false,
      signElevatedJVP: false,
      signS3: false,
      signDependentEdema: false,
      signHepatomegaly: false,
      signCardiomegaly: false,
      jvpStatus: '',
      ventricularArrhythmia: false,
      eventMI: false,
      eventStroke: false,
      eventVTVF: false,
      eventICDShock: false,
      eventHospitalisation: false,
      peakTropT: '',
      tropTPositive: false,
      peakTropI: '',
      tropIPositive: false,
      serumUrea: '',
      bun: '',
      bnpDischarge: '',
      ntProBnpDischarge: '',
      ventilationSupport: '',
      mcsSupport: '',
      weightDischarge: '',
      dischargeOutcome: '',
      causeOfDeath: '',
      lastHospDate: '',
      coronaryAnatomy: {
        lmStenosis: '',
        ladStenosis: '',
        lcxStenosis: '',
        rcaStenosis: '',
        syntaxScore: '',
        priorPciDate: '',
        priorCabgDate: '',
        revascularizationType: ''
      },
      valvularHemodynamics: {
        asAVA: '',
        asMeanGradient: '',
        asVmax: '',
        mrRegurgitantVolume: '',
        mrEROA: '',
        arRegurgitantVolume: '',
        arEROA: '',
        msMVA: '',
        msMeanGradient: ''
      },
      eq5d: {
        mobility: '',
        selfCare: '',
        usualActivities: '',
        painDiscomfort: '',
        anxietyDepression: '',
        healthStateScore: ''
      },
      ...(defaultValues as Partial<FormValues>),
    },
  })

  const visitType = watch('visitType')
  const echoDoneToday = watch('echoDoneToday')
  const labsDrawnToday = watch('labsDrawnToday')
  const hfType = watch('hfType')
  const watchedWeight = watch('weight')
  const watchedHeight = watch('height')

  // Auto-calculate BMI when weight or height changes
  useEffect(() => {
    const w = Number(watchedWeight)
    const h = Number(watchedHeight)
    if (w > 0 && h > 0) {
      const bmi = parseFloat((w / ((h / 100) ** 2)).toFixed(1))
      setValue('bmi', bmi)
    }
  }, [watchedWeight, watchedHeight, setValue])

  // Generate dynamic tabs based on condition
  const TABS = [
    { id: 'visit', label: 'Vitals & Clinical' }
  ]

  const isTelemedicine = visitType === 'Telemedicine'

  if (!isTelemedicine && echoDoneToday) {
    TABS.push({ id: 'echo', label: 'Echocardiography' })
  }
  if (!isTelemedicine && labsDrawnToday) {
    TABS.push({ id: 'labs', label: 'Labs & Biomarkers' })
  }
  
  TABS.push(
    { id: 'meds', label: 'Medications' },
    { id: 'advanced', label: 'Advanced Studies' },
    { id: 'qol', label: 'QoL & SDOH' }
  )

  // Auto-save draft functionality
  const allValues = watch()
  useEffect(() => {
    if (patientId) {
      const timer = setTimeout(() => {
        localStorage.setItem(`visit_draft_${patientId}`, JSON.stringify(allValues))
        setDraftSaved(true)
        setTimeout(() => setDraftSaved(false), 2000)
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [allValues, patientId])

  // Load draft from localStorage on mount
  useEffect(() => {
    if (patientId) {
      const draft = localStorage.getItem(`visit_draft_${patientId}`)
      if (draft) {
        try {
          const parsed = JSON.parse(draft)
          Object.keys(parsed).forEach(key => {
            setValue(key as keyof FormValues, parsed[key])
          })
          toast.success('Restored draft from local auto-save')
        } catch (e) {
          console.warn('Failed to parse visit draft:', e)
        }
      }
    }
  }, [patientId, setValue])

  const clearDraft = () => {
    if (patientId) {
      localStorage.removeItem(`visit_draft_${patientId}`)
    }
  }

  const handleFormSubmit = async (data: FormValues) => {
    clearDraft()
    await onSubmit(data as unknown as VisitInput)
  }

  // Active Tab Index mapping based on TABS array
  const activeTabId = TABS[tab]?.id || 'visit'

  return (
    <form
      onSubmit={handleSubmit(handleFormSubmit)}
      className="space-y-0 text-gray-300"
    >
      {/* Draft Saved Indicator */}
      <div className="flex justify-between items-center mb-4 pb-2 border-b border-blue-500/10">
        <div className="flex gap-2">
          {isTelemedicine && (
            <span className="badge badge-amber text-[10px] flex items-center gap-1">
              Telemedicine Visit Mode
            </span>
          )}
          {visitType === 'Inpatient' && (
            <span className="badge badge-blue text-[10px] flex items-center gap-1">
              Inpatient Admission Mode
            </span>
          )}
        </div>
        <div className="text-[10px] text-gray-500 flex items-center gap-1 font-mono">
          {draftSaved ? (
            <>
              <Save className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400">Draft Auto-Saved</span>
            </>
          ) : (
            <span>Changes saved locally</span>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-blue-500/10 overflow-x-auto -mb-px gap-2">
        {TABS.map((t, i) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(i)}
            className={cn(
              'tab-btn text-xs font-semibold pb-3 border-b-2 px-3 transition-all',
              activeTabId === t.id ? 'border-blue-500 text-white' : 'border-transparent text-gray-400 hover:text-gray-200'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="pt-5 space-y-4">

        {/* ── Tab: Visit & Vitals ────────────────────────────────── */}
        {activeTabId === 'visit' && (
          <div className="space-y-5">
            <div>
              <p className="section-heading">Visit Information (OPD encounter details)</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FieldWrap label="Visit Date" required error={errors.visitDate?.message}>
                  <Input type="date" {...register('visitDate')} error={!!errors.visitDate} />
                </FieldWrap>
                <FieldWrap label="Visit Type" required error={errors.visitType?.message}>
                  <Select {...register('visitType')} error={!!errors.visitType}>
                    <option value="">Select</option>
                    <option value="OPD">OPD</option>
                    <option value="Telemedicine">Telemedicine</option>
                    <option value="Inpatient">Inpatient</option>
                  </Select>
                </FieldWrap>
                <FieldWrap label="Oedema">
                  <Select {...register('oedema')}>
                    <option value="">Select</option>
                    <option>None</option>
                    <option>Mild</option>
                    <option>Moderate</option>
                    <option>Severe</option>
                  </Select>
                </FieldWrap>
              </div>

              {/* Conditional triggers for Echo and Labs */}
              {!isTelemedicine && (
                <div className="mt-4 p-4 bg-blue-500/5 border border-blue-500/10 rounded-xl grid grid-cols-2 gap-4">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" {...register('echoDoneToday')} className="w-5 h-5 rounded bg-gray-900 border-blue-500/30 text-blue-500" />
                    <div>
                      <p className="text-xs font-bold text-white">Echocardiography performed today?</p>
                      <p className="text-[10px] text-gray-500">Unlocks echo parameters input screen</p>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" {...register('labsDrawnToday')} className="w-5 h-5 rounded bg-gray-900 border-blue-500/30 text-blue-500" />
                    <div>
                      <p className="text-xs font-bold text-white">Laboratory tests drawn today?</p>
                      <p className="text-[10px] text-gray-500">Unlocks renal, biomarkers, and labs screen</p>
                    </div>
                  </label>
                </div>
              )}
            </div>

            {/* Conditional Inpatient Fields */}
            {visitType === 'Inpatient' && (
              <div className="p-4 bg-violet-500/5 border border-violet-500/10 rounded-xl space-y-4">
                <p className="text-xs font-bold text-violet-400">Inpatient Admission Details</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FieldWrap label="ICU / HDU Days" error={errors.icuDays?.message}>
                    <Input type="number" {...register('icuDays')} placeholder="e.g. 2" />
                  </FieldWrap>
                  <FieldWrap label="Discharge Date">
                    <Input type="date" {...register('dischargeDate')} />
                  </FieldWrap>
                  <FieldWrap label="Last HF Admission Date">
                    <Input type="date" {...register('lastHospDate')} />
                  </FieldWrap>
                  <FieldWrap label="Reason for Admission" className="md:col-span-3">
                    <Input {...register('admissionReason')} placeholder="e.g., ADHF (Acute Decompensated Heart Failure), Cardiogenic Shock" />
                  </FieldWrap>
                </div>

                <div className="border-t border-violet-500/10 pt-4 space-y-4">
                  <p className="text-xs font-bold text-violet-400">In-Hospital Support & Discharge Outcomes</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FieldWrap label="Ventilation Support">
                      <Select {...register('ventilationSupport')}>
                        <option value="">Select Support</option>
                        <option value="No">No Support</option>
                        <option value="NIV">Non-Invasive (NIV)</option>
                        <option value="Invasive">Invasive Ventilation</option>
                      </Select>
                    </FieldWrap>

                    <FieldWrap label="Mechanical Circulatory Support (MCS)">
                      <Select {...register('mcsSupport')}>
                        <option value="">Select MCS</option>
                        <option value="No">No Support</option>
                        <option value="IABP">IABP</option>
                        <option value="VAD">VAD (Impella/ECMO/LVAD)</option>
                      </Select>
                    </FieldWrap>

                    <FieldWrap label="Weight at Discharge (kg)" error={errors.weightDischarge?.message}>
                      <Input type="number" step="0.1" {...register('weightDischarge')} placeholder="e.g. 70.2" />
                    </FieldWrap>

                    <FieldWrap label="Discharge Outcome">
                      <Select {...register('dischargeOutcome')}>
                        <option value="">Select Outcome</option>
                        <option value="Discharge">Discharged Alive</option>
                        <option value="Death">Death (Deceased)</option>
                        <option value="Referred">Referred to another facility</option>
                      </Select>
                    </FieldWrap>

                    {watch('dischargeOutcome') === 'Death' && (
                      <FieldWrap label="Cause of Death">
                        <Select {...register('causeOfDeath')}>
                          <option value="">Select Cause</option>
                          <option value="SCD">Sudden Cardiac Death (SCD)</option>
                          <option value="Pump failure">Refractory Pump Failure</option>
                          <option value="MODS">Multi-Organ Dysfunction Syndrome</option>
                          <option value="Others">Others / Non-cardiac</option>
                        </Select>
                      </FieldWrap>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Telemedicine Info Banner */}
            {isTelemedicine && (
              <div className="p-4 bg-amber-500/5 border border-amber-500/10 rounded-xl flex items-start gap-3 text-xs text-amber-400">
                <ShieldAlert className="w-5 h-5 flex-shrink-0" />
                <div>
                  <p className="font-semibold">Telemedicine Encounter Mode</p>
                  <p className="text-gray-400 mt-1">
                    Echocardiography and Laboratory test inputs are disabled since physical exams/samples cannot be obtained.
                  </p>
                </div>
              </div>
            )}

            <div>
              <p className="section-heading">Anthropometrics</p>
              <div className="grid grid-cols-3 gap-4">
                <FieldWrap label="Weight (kg)" error={errors.weight?.message}>
                  <Input type="number" step="0.1" {...register('weight')} placeholder="72.5" error={!!errors.weight} />
                </FieldWrap>
                <FieldWrap label="Height (cm)" error={errors.height?.message}>
                  <Input type="number" {...register('height')} placeholder="165" error={!!errors.height} />
                </FieldWrap>
                <FieldWrap label="BMI (kg/m²)" hint="Auto-calculated from Wt/Ht">
                  <Input type="number" step="0.1" {...register('bmi')} placeholder="—" readOnly className="opacity-70 cursor-default" />
                </FieldWrap>
                <FieldWrap label="O₂ Saturation (%)" error={errors.o2Sat?.message}>
                  <Input type="number" {...register('o2Sat')} placeholder="97" error={!!errors.o2Sat} />
                </FieldWrap>
              </div>
            </div>

            <div>
              <p className="section-heading">Vitals</p>
              <div className="grid grid-cols-3 gap-4">
                <FieldWrap label="Systolic BP (mmHg)" disabled={isTelemedicine} error={errors.bpSystolic?.message}>
                  <Input type="number" {...register('bpSystolic')} placeholder="120" disabled={isTelemedicine} error={!!errors.bpSystolic} />
                </FieldWrap>
                <FieldWrap label="Diastolic BP (mmHg)" disabled={isTelemedicine} error={errors.bpDiastolic?.message}>
                  <Input type="number" {...register('bpDiastolic')} placeholder="80" disabled={isTelemedicine} error={!!errors.bpDiastolic} />
                </FieldWrap>
                <FieldWrap label="Heart Rate (bpm)" disabled={isTelemedicine} error={errors.heartRate?.message}>
                  <Input type="number" {...register('heartRate')} placeholder="72" disabled={isTelemedicine} error={!!errors.heartRate} />
                </FieldWrap>
              </div>
            </div>

            <div>
              <p className="section-heading">NYHA Functional Class</p>
              <Controller name="nyha" control={control} render={({ field }) => (
                <RadioChipGroup
                  options={[
                    { value: 'I',   label: 'Class I — No symptoms' },
                    { value: 'II',  label: 'Class II — Mild symptoms' },
                    { value: 'III', label: 'Class III — Moderate symptoms' },
                    { value: 'IV',  label: 'Class IV — Severe symptoms' },
                  ]}
                  value={field.value}
                  onChange={field.onChange}
                />
              )} />
            </div>

            <div>
              <p className="section-heading">Heart Failure Symptoms & Signs (Inclusion Checklist)</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-800/20 border border-blue-500/10 rounded-xl p-5">
                {/* Symptoms */}
                <div className="space-y-3">
                  <p className="text-xs font-bold text-blue-400 uppercase tracking-wider">Symptoms</p>
                  <div className="space-y-2">
                    <label className="flex items-center gap-3 cursor-pointer p-2 bg-gray-800/40 hover:bg-gray-800/60 rounded-lg transition-colors">
                      <input type="checkbox" {...register('symptomDyspnea')} className="w-4 h-4 rounded bg-gray-900 border-blue-500/30 text-blue-500" />
                      <span className="text-sm text-gray-300">Dyspnoea / PND / Orthopnoea</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer p-2 bg-gray-800/40 hover:bg-gray-800/60 rounded-lg transition-colors">
                      <input type="checkbox" {...register('symptomFatigue')} className="w-4 h-4 rounded bg-gray-900 border-blue-500/30 text-blue-500" />
                      <span className="text-sm text-gray-300">Fatigue / Decreased effort tolerance</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer p-2 bg-gray-800/40 hover:bg-gray-800/60 rounded-lg transition-colors">
                      <input type="checkbox" {...register('symptomEdema')} className="w-4 h-4 rounded bg-gray-900 border-blue-500/30 text-blue-500" />
                      <span className="text-sm text-gray-300">History of Edema</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer p-2 bg-gray-800/40 hover:bg-gray-800/60 rounded-lg transition-colors">
                      <input type="checkbox" {...register('symptomPalpitation')} className="w-4 h-4 rounded bg-gray-900 border-blue-500/30 text-blue-500" />
                      <span className="text-sm text-gray-300">Palpitations</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer p-2 bg-gray-800/40 hover:bg-gray-800/60 rounded-lg transition-colors">
                      <input type="checkbox" {...register('symptomAngina')} className="w-4 h-4 rounded bg-gray-900 border-blue-500/30 text-blue-500" />
                      <span className="text-sm text-gray-300">Angina</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer p-2 bg-gray-800/40 hover:bg-gray-800/60 rounded-lg transition-colors">
                      <input type="checkbox" {...register('symptomAscites')} className="w-4 h-4 rounded bg-gray-900 border-blue-500/30 text-blue-500" />
                      <span className="text-sm text-gray-300">Ascites</span>
                    </label>
                  </div>
                </div>

                {/* Signs */}
                <div className="space-y-3">
                  <p className="text-xs font-bold text-blue-400 uppercase tracking-wider">Signs</p>
                  <div className="space-y-2">
                    <label className="flex items-center gap-3 cursor-pointer p-2 bg-gray-800/40 hover:bg-gray-800/60 rounded-lg transition-colors">
                      <input type="checkbox" {...register('signLungRales')} className="w-4 h-4 rounded bg-gray-900 border-blue-500/30 text-blue-500" />
                      <span className="text-sm text-gray-300">Lung Rales / Crepitations</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer p-2 bg-gray-800/40 hover:bg-gray-800/60 rounded-lg transition-colors">
                      <input type="checkbox" {...register('signPleuralEffusion')} className="w-4 h-4 rounded bg-gray-900 border-blue-500/30 text-blue-500" />
                      <span className="text-sm text-gray-300">Pleural Effusion / Ascites</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer p-2 bg-gray-800/40 hover:bg-gray-800/60 rounded-lg transition-colors">
                      <input type="checkbox" {...register('signElevatedJVP')} className="w-4 h-4 rounded bg-gray-900 border-blue-500/30 text-blue-500" />
                      <span className="text-sm text-gray-300">Elevated JVP</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer p-2 bg-gray-800/40 hover:bg-gray-800/60 rounded-lg transition-colors">
                      <input type="checkbox" {...register('signS3')} className="w-4 h-4 rounded bg-gray-900 border-blue-500/30 text-blue-500" />
                      <span className="text-sm text-gray-300">S3 Gallop</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer p-2 bg-gray-800/40 hover:bg-gray-800/60 rounded-lg transition-colors">
                      <input type="checkbox" {...register('signDependentEdema')} className="w-4 h-4 rounded bg-gray-900 border-blue-500/30 text-blue-500" />
                      <span className="text-sm text-gray-300">Dependent Edema</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer p-2 bg-gray-800/40 hover:bg-gray-800/60 rounded-lg transition-colors">
                      <input type="checkbox" {...register('signHepatomegaly')} className="w-4 h-4 rounded bg-gray-900 border-blue-500/30 text-blue-500" />
                      <span className="text-sm text-gray-300">Hepatomegaly</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer p-2 bg-gray-800/40 hover:bg-gray-800/60 rounded-lg transition-colors">
                      <input type="checkbox" {...register('signCardiomegaly')} className="w-4 h-4 rounded bg-gray-900 border-blue-500/30 text-blue-500" />
                      <span className="text-sm text-gray-300">Cardiomegaly</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* JVP Status & Arrhythmia Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 bg-gray-800/40 border border-blue-500/10 rounded-xl p-4">
                <FieldWrap label="JVP Status Assessment">
                  <Select {...register('jvpStatus')}>
                    <option value="">Select JVP Status</option>
                    <option value="Elevated">Elevated</option>
                    <option value="Not elevated">Not elevated</option>
                  </Select>
                </FieldWrap>

                <div className="flex flex-col justify-center">
                  <label className="flex items-center gap-3 cursor-pointer p-2 rounded-lg transition-colors">
                    <input type="checkbox" {...register('ventricularArrhythmia')} className="w-5 h-5 rounded bg-gray-900 border-blue-500/30 text-blue-500" />
                    <div>
                      <span className="text-sm font-semibold text-white">Ventricular Arrhythmia (VT/VF)</span>
                      <p className="text-[10px] text-gray-500">History of Ventricular Tachycardia or Ventricular Fibrillation</p>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            <div>
              <p className="section-heading">Cardiac Rhythm</p>
              <Controller name="rhythm" control={control} render={({ field }) => (
                <RadioChipGroup
                  options={[
                    { value: 'Sinus',           label: 'Sinus Rhythm' },
                    { value: 'AF',              label: 'Atrial Fibrillation' },
                    { value: 'Atrial Flutter',  label: 'Atrial Flutter' },
                    { value: 'VT',              label: 'Ventricular Tachycardia' },
                    { value: 'Not Known',       label: 'Not Known' },
                    { value: 'Other',           label: 'Other' },
                  ]}
                  value={field.value ?? ''}
                  onChange={field.onChange}
                />
              )} />
            </div>

            <div>
              <p className="section-heading">ECG</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FieldWrap label="QRS Duration (ms)">
                  <Input type="number" {...register('qrsDuration')} placeholder="e.g. 120" />
                </FieldWrap>
                <FieldWrap label="Bundle Branch Block">
                  <Select {...register('bbb')}>
                    <option value="">None / Not assessed</option>
                    <option value="LBBB">LBBB</option>
                    <option value="RBBB">RBBB</option>
                    <option value="IVCD">IVCD</option>
                  </Select>
                </FieldWrap>
                <FieldWrap label="QTc Interval (ms)">
                  <Input type="number" {...register('qtcInterval')} placeholder="e.g. 440" />
                </FieldWrap>
              </div>
            </div>

            <div>
              <p className="section-heading">Type of Heart Failure</p>
              <Controller name="hfType" control={control} render={({ field, fieldState }) => (
                <>
                  <RadioChipGroup
                    options={[
                      { value: 'HFrEF',   label: 'HF reduced EF (HFrEF) — LVEF <40%' },
                      { value: 'HFmrEF',  label: 'HF mid-range EF (HFmrEF) — LVEF 40–49%' },
                      { value: 'HFpEF',   label: 'HF preserved EF (HFpEF) — LVEF ≥50%' },
                    ]}
                    value={field.value}
                    onChange={field.onChange}
                  />
                  {fieldState.error && <p className="text-rose-400 text-xs mt-2 font-medium">{fieldState.error.message}</p>}
                </>
              )} />
            </div>

            <div>
              <p className="section-heading">Etiology</p>
              <Controller name="etiology" control={control} render={({ field }) => (
                <CheckChipGroup
                  options={[
                    { value: 'Ischemic',              label: 'Ischemic' },
                    { value: 'Hypertension',           label: 'Hypertension' },
                    { value: 'Viral Myocarditis',      label: 'Viral Myocarditis' },
                    { value: 'Peri-partum',            label: 'Peri-partum' },
                    { value: 'RHD',                    label: 'RHD – Pen. prophylaxis' },
                    { value: 'Idiopathic',             label: 'Idiopathic' },
                    { value: 'Valvular',               label: 'Valvular Heart Disease' },
                    { value: 'Diabetic Cardiomyopathy',label: 'Diabetic Cardiomyopathy' },
                  ]}
                  value={field.value}
                  onChange={field.onChange}
                />
              )} />
              <div className="mt-3">
                <FieldWrap label="Other etiology (specify)">
                  <Input {...register('etiologyOther')} placeholder="Specify" />
                </FieldWrap>
              </div>
            </div>

            <div>
              <p className="section-heading">Events Since Last Visit</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {([
                  { name: 'eventMI',            label: 'Myocardial Infarction (MI)' },
                  { name: 'eventStroke',         label: 'Stroke / TIA' },
                  { name: 'eventVTVF',           label: 'VT / VF Episode' },
                  { name: 'eventICDShock',        label: 'ICD Shock' },
                  { name: 'eventHospitalisation', label: 'Hospitalisation' },
                ] as const).map(({ name, label }) => (
                  <label key={name} className="flex items-center gap-2 bg-slate-900/50 border border-gray-700/40 rounded-lg px-3 py-2 cursor-pointer hover:border-blue-500/40 transition-colors">
                    <input type="checkbox" {...register(name)} className="w-4 h-4 rounded bg-gray-900 border-blue-500/30 text-blue-500" />
                    <span className="text-sm text-gray-300">{label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <p className="section-heading">Hospitalisation History</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FieldWrap label="H/O Hospitalisation">
                  <Controller name="hospHistory" control={control} render={({ field }) => (
                    <RadioChipGroup
                      options={[{ value: 'Yes', label: 'Yes' }, { value: 'No', label: 'No' }]}
                      value={field.value}
                      onChange={field.onChange}
                    />
                  )} />
                </FieldWrap>
                <FieldWrap label="No. of Admissions (past year)">
                  <Input type="number" {...register('hospCount')} placeholder="0" />
                </FieldWrap>
                <FieldWrap label="Details" className="col-span-2">
                  <Textarea {...register('hospDetails')} placeholder="Dates, reason, duration…" />
                </FieldWrap>
              </div>
            </div>
          </div>
        )}

        {/* ── Tab: Echocardiography (conditional) ─────────────────── */}
        {activeTabId === 'echo' && (
          <div className="space-y-5 animate-fade-in">
            <div>
              <p className="section-heading">Echocardiography Details</p>
              <div className="grid grid-cols-3 gap-4">
                <FieldWrap label="LVEF (%)" hint="Left ventricular ejection fraction" error={errors.lvef?.message}>
                  <Input type="number" step="0.1" {...register('lvef')} placeholder="55" error={!!errors.lvef} />
                </FieldWrap>
                <FieldWrap label="Echo Date" error={errors.echoDate?.message}>
                  <Input type="date" {...register('echoDate')} error={!!errors.echoDate} />
                </FieldWrap>
                <FieldWrap label="LV Diastolic Diameter (mm)">
                  <Input type="number" step="0.1" {...register('lvdd')} placeholder="50" />
                </FieldWrap>
                <FieldWrap label="LV Systolic Diameter (mm)">
                  <Input type="number" step="0.1" {...register('lvsd')} placeholder="35" />
                </FieldWrap>
                <FieldWrap label="E/e' Ratio">
                  <Input type="number" step="0.1" {...register('eEPrime')} placeholder="8" />
                </FieldWrap>
                <FieldWrap label="Diastolic Dysfunction Grade">
                  <Select {...register('ddGrade')}>
                    <option value="">None / Select</option>
                    <option>Grade I</option>
                    <option>Grade II</option>
                    <option>Grade III</option>
                  </Select>
                </FieldWrap>
                <FieldWrap label="RVSP (mmHg)" hint="RV systolic pressure">
                  <Input type="number" {...register('rvsp')} placeholder="30" />
                </FieldWrap>
                <FieldWrap label="TAPSE (mm)" hint="<17 mm = RV dysfunction">
                  <Input type="number" step="0.1" {...register('tapse')} placeholder="20" />
                </FieldWrap>
                <FieldWrap label="LA Strain (%)">
                  <Input type="number" step="0.1" {...register('laStrain')} placeholder="18" />
                </FieldWrap>
                <FieldWrap label="RV Free Wall Strain (%)">
                  <Input type="number" step="0.1" {...register('rvFreeWallStrain')} placeholder="-20" />
                </FieldWrap>
                <FieldWrap label="LV Mass Index (g/m²)">
                  <Input type="number" step="0.1" {...register('lvMassIndex')} placeholder="95" />
                </FieldWrap>
                <FieldWrap label="Relative Wall Thickness">
                  <Input type="number" step="0.01" {...register('relativeWallThickness')} placeholder="0.4" />
                </FieldWrap>
                <FieldWrap label="Echo Notes" className="col-span-3">
                  <Textarea {...register('echNotes')} placeholder="Wall motion abnormalities, valve findings…" />
                </FieldWrap>
              </div>

              <p className="text-sm font-semibold text-white mt-6 mb-3 border-b border-gray-700/50 pb-2">Valvular Hemodynamics & Severity Grades</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Aortic Stenosis */}
                <div className="space-y-4 bg-slate-900/40 p-4 rounded-xl border border-blue-500/10">
                  <p className="text-xs font-bold text-blue-400 uppercase tracking-wider">Aortic Stenosis (AS)</p>
                  <FieldWrap label="AS Grade">
                    <Select {...register('asGrade')}>
                      <option value="">Select Grade</option>
                      <option>None</option>
                      <option>Mild</option>
                      <option>Moderate</option>
                      <option>Severe</option>
                    </Select>
                  </FieldWrap>
                  <FieldWrap label="AVA (cm²)">
                    <Input type="number" step="0.01" {...register('valvularHemodynamics.asAVA')} placeholder="e.g. 0.8" />
                  </FieldWrap>
                  <FieldWrap label="Mean Gradient (mmHg)">
                    <Input type="number" step="0.1" {...register('valvularHemodynamics.asMeanGradient')} placeholder="e.g. 40" />
                  </FieldWrap>
                  <FieldWrap label="Peak Velocity Vmax (m/s)">
                    <Input type="number" step="0.1" {...register('valvularHemodynamics.asVmax')} placeholder="e.g. 4.2" />
                  </FieldWrap>
                </div>

                {/* Mitral Stenosis */}
                <div className="space-y-4 bg-slate-900/40 p-4 rounded-xl border border-blue-500/10">
                  <p className="text-xs font-bold text-blue-400 uppercase tracking-wider">Mitral Stenosis (MS)</p>
                  <FieldWrap label="MS Grade">
                    <Select {...register('msGrade')}>
                      <option value="">Select Grade</option>
                      <option>None</option>
                      <option>Mild</option>
                      <option>Moderate</option>
                      <option>Severe</option>
                    </Select>
                  </FieldWrap>
                  <FieldWrap label="MVA (cm²)">
                    <Input type="number" step="0.01" {...register('valvularHemodynamics.msMVA')} placeholder="e.g. 1.2" />
                  </FieldWrap>
                  <FieldWrap label="Mean Diastolic Gradient (mmHg)">
                    <Input type="number" step="0.1" {...register('valvularHemodynamics.msMeanGradient')} placeholder="e.g. 6" />
                  </FieldWrap>
                </div>

                {/* Regurgitant Lesions (MR/AR) */}
                <div className="space-y-4 bg-slate-900/40 p-4 rounded-xl border border-blue-500/10">
                  <p className="text-xs font-bold text-blue-400 uppercase tracking-wider">Regurgitant Lesions</p>
                  <div className="grid grid-cols-2 gap-2">
                    <FieldWrap label="MR Grade">
                      <Select {...register('mrGrade')}>
                        <option value="">Select</option>
                        <option>None</option>
                        <option>Mild</option>
                        <option>Moderate</option>
                        <option>Severe</option>
                      </Select>
                    </FieldWrap>
                    <FieldWrap label="AR Grade">
                      <Select {...register('arGrade')}>
                        <option value="">Select</option>
                        <option>None</option>
                        <option>Mild</option>
                        <option>Moderate</option>
                        <option>Severe</option>
                      </Select>
                    </FieldWrap>
                  </div>
                  <div className="border-t border-gray-800 pt-2 space-y-2">
                    <p className="text-[10px] text-gray-400 uppercase font-semibold">Mitral Regurgitation (MR)</p>
                    <div className="grid grid-cols-2 gap-2">
                      <FieldWrap label="Volume (mL)">
                        <Input type="number" {...register('valvularHemodynamics.mrRegurgitantVolume')} placeholder="45" />
                      </FieldWrap>
                      <FieldWrap label="EROA (mm²)">
                        <Input type="number" step="0.1" {...register('valvularHemodynamics.mrEROA')} placeholder="35" />
                      </FieldWrap>
                    </div>
                  </div>
                  <div className="border-t border-gray-800 pt-2 space-y-2">
                    <p className="text-[10px] text-gray-400 uppercase font-semibold">Aortic Regurgitation (AR)</p>
                    <div className="grid grid-cols-2 gap-2">
                      <FieldWrap label="Volume (mL)">
                        <Input type="number" {...register('valvularHemodynamics.arRegurgitantVolume')} placeholder="50" />
                      </FieldWrap>
                      <FieldWrap label="EROA (mm²)">
                        <Input type="number" step="0.1" {...register('valvularHemodynamics.arEROA')} placeholder="28" />
                      </FieldWrap>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        {/* ── Tab: Labs & Biomarkers (conditional) ───────────────── */}
        {activeTabId === 'labs' && (
          <div className="space-y-5 animate-fade-in">
            <div>
              <p className="section-heading">Biomarkers (Admission / Baseline)</p>
              <div className="grid grid-cols-2 gap-4">
                <FieldWrap label="NT-proBNP (pg/mL)" error={errors.ntProBNP?.message}>
                  <Input type="number" {...register('ntProBNP')} placeholder="125" error={!!errors.ntProBNP} />
                </FieldWrap>
                <FieldWrap label="BNP (pg/mL)" error={errors.bnp?.message}>
                  <Input type="number" {...register('bnp')} placeholder="80" error={!!errors.bnp} />
                </FieldWrap>
              </div>

              {/* Troponin Status */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 bg-gray-800/20 border border-blue-500/10 rounded-xl p-4">
                <div className="space-y-3 border-r border-gray-700/30 pr-4">
                  <p className="text-xs font-bold text-gray-300">Cardiac Troponin T</p>
                  <div className="grid grid-cols-2 gap-2">
                    <FieldWrap label="Peak Value (ng/L)" error={errors.peakTropT?.message}>
                      <Input type="number" step="0.01" {...register('peakTropT')} placeholder="e.g. 0.05" />
                    </FieldWrap>
                    <div className="flex items-center pt-5">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" {...register('tropTPositive')} className="w-4 h-4 rounded bg-gray-900 border-blue-500/30 text-blue-500" />
                        <span className="text-xs font-semibold text-gray-300">Trop-T Positive</span>
                      </label>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 pl-2">
                  <p className="text-xs font-bold text-gray-300">Cardiac Troponin I</p>
                  <div className="grid grid-cols-2 gap-2">
                    <FieldWrap label="Peak Value (ng/L)" error={errors.peakTropI?.message}>
                      <Input type="number" step="0.01" {...register('peakTropI')} placeholder="e.g. 0.12" />
                    </FieldWrap>
                    <div className="flex items-center pt-5">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" {...register('tropIPositive')} className="w-4 h-4 rounded bg-gray-900 border-blue-500/30 text-blue-500" />
                        <span className="text-xs font-semibold text-gray-300">Trop-I Positive</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Discharge Biomarkers */}
              <div className="grid grid-cols-2 gap-4 mt-4">
                <FieldWrap label="BNP at Discharge (pg/mL)" error={errors.bnpDischarge?.message}>
                  <Input type="number" {...register('bnpDischarge')} placeholder="e.g. 150" />
                </FieldWrap>
                <FieldWrap label="NT-proBNP at Discharge (pg/mL)" error={errors.ntProBnpDischarge?.message}>
                  <Input type="number" {...register('ntProBnpDischarge')} placeholder="e.g. 600" />
                </FieldWrap>
              </div>
            </div>

            <div>
              <p className="section-heading">Renal & Electrolytes</p>
              <div className="grid grid-cols-3 gap-4">
                <FieldWrap label="eGFR (ml/min/1.73m²)" error={errors.egfr?.message}>
                  <Input type="number" step="0.1" {...register('egfr')} placeholder="60" error={!!errors.egfr} />
                </FieldWrap>
                <FieldWrap label="Creatinine (mg/dL)" error={errors.creatinine?.message}>
                  <Input type="number" step="0.01" {...register('creatinine')} placeholder="1.0" error={!!errors.creatinine} />
                </FieldWrap>
                <FieldWrap label="Potassium (mmol/L)">
                  <Input type="number" step="0.1" {...register('potassium')} placeholder="4.2" />
                </FieldWrap>
                <FieldWrap label="Sodium (mmol/L)">
                  <Input type="number" {...register('sodium')} placeholder="138" />
                </FieldWrap>
                <FieldWrap label="Uric Acid (mg/dL)">
                  <Input type="number" step="0.1" {...register('uricAcid')} placeholder="5.5" />
                </FieldWrap>
                <FieldWrap label="Serum Urea (mg/dL)" error={errors.serumUrea?.message}>
                  <Input type="number" step="0.1" {...register('serumUrea')} placeholder="e.g. 30" />
                </FieldWrap>
                <FieldWrap label="BUN (mg/dL)" error={errors.bun?.message}>
                  <Input type="number" step="0.1" {...register('bun')} placeholder="e.g. 15" />
                </FieldWrap>
              </div>
            </div>
            <div>
              <p className="section-heading">Haematology & Other</p>
              <div className="grid grid-cols-3 gap-4">
                <FieldWrap label="Haemoglobin (g/dL)">
                  <Input type="number" step="0.1" {...register('hb')} placeholder="13.5" />
                </FieldWrap>
                <FieldWrap label="Serum Ferritin (µg/L)">
                  <Input type="number" {...register('ferritin')} placeholder="80" />
                </FieldWrap>
                <FieldWrap label="Transferrin Saturation (%)">
                  <Input type="number" {...register('transferrinSat')} placeholder="25" />
                </FieldWrap>
                <FieldWrap label="TSH (mIU/L)">
                  <Input type="number" step="0.01" {...register('tft')} placeholder="2.5" />
                </FieldWrap>
                <FieldWrap label="HbA1c (%)">
                  <Input type="number" step="0.1" {...register('hba1c')} placeholder="7.0" />
                </FieldWrap>
                <FieldWrap label="LDL Cholesterol (mg/dL)">
                  <Input type="number" {...register('ldl')} placeholder="80" />
                </FieldWrap>
                <FieldWrap label="Triglycerides (mg/dL)">
                  <Input type="number" {...register('triglycerides')} placeholder="150" />
                </FieldWrap>
              </div>
            </div>
          </div>
        )}

        {/* ── Tab: Medications ───────────────────────────────────── */}
        {activeTabId === 'meds' && (
          <div className="space-y-5">
            {/* GDMT Validation / Alert for HFrEF */}
            {hfType === 'HFrEF' && (
              <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl flex gap-3 items-start text-xs text-rose-300">
                <ShieldAlert className="w-5 h-5 flex-shrink-0 mt-0.5 text-rose-400 animate-pulse" />
                <div>
                  <p className="font-bold">Guideline-Directed Medical Therapy (GDMT) Required</p>
                  <p className="text-gray-400 mt-1">
                    For HFrEF patients, evaluate all core columns: 1) RAASi/ARNI, 2) Beta-Blockers, 3) MRA, and 4) SGLT2 inhibitors.
                  </p>
                </div>
              </div>
            )}

            <p className="section-heading font-semibold text-white">1. Core Heart Failure Therapy</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <MedRow label="Beta Blocker" prescribedField="betaBlocker.prescribed"
                typeField="betaBlocker.type" typeOptions={['Carvedilol','Metoprolol Succinate','Bisoprolol','Nebivolol']}
                doseField="betaBlocker.dose" reasonField="betaBlocker.reason"
                startDateField="betaBlocker.startDate" stopDateField="betaBlocker.stopDate" changeReasonField="betaBlocker.changeReason"
                control={control} register={register} />

              <MedRow label="ACE Inhibitor / ARB / ARNI (RAASi)" prescribedField="raasi.prescribed"
                typeField="raasi.type" typeOptions={['Ramipril (ACEi)','Enalapril (ACEi)','Lisinopril (ACEi)','Losartan (ARB)','Valsartan (ARB)','Telmisartan (ARB)','Sacubitril/Valsartan (ARNI)']}
                doseField="raasi.dose" reasonField="raasi.reason"
                startDateField="raasi.startDate" stopDateField="raasi.stopDate" changeReasonField="raasi.changeReason"
                control={control} register={register} />

              <MedRow label="MRA — Mineralocorticoid Receptor Antagonist" prescribedField="mra.prescribed"
                typeField="mra.type" typeOptions={['Spironolactone','Eplerenone','Finerenone']}
                doseField="mra.dose" reasonField="mra.reason"
                startDateField="mra.startDate" stopDateField="mra.stopDate" changeReasonField="mra.changeReason"
                control={control} register={register} />

              <MedRow label="SGLT2 Inhibitor" prescribedField="sglt2i.prescribed"
                typeField="sglt2i.type" typeOptions={['Dapagliflozin 10mg OD','Empagliflozin 10mg OD']}
                doseField="sglt2i.dose" reasonField="sglt2i.reason"
                startDateField="sglt2i.startDate" stopDateField="sglt2i.stopDate" changeReasonField="sglt2i.changeReason"
                control={control} register={register} />
            </div>

            <p className="section-heading font-semibold text-white mt-4">2. Other Heart Failure / Clinical Medications</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <MedRow label="Diuretics" prescribedField="diuretic.prescribed"
                typeField="diuretic.type" typeOptions={['Furosemide','Torsemide','Bumetanide','Hydrochlorothiazide']}
                doseField="diuretic.dose" reasonField="diuretic.reason"
                startDateField="diuretic.startDate" stopDateField="diuretic.stopDate" changeReasonField="diuretic.changeReason"
                control={control} register={register} />

              <MedRow label="Ivabradine" prescribedField="ivabradine.prescribed"
                doseField="ivabradine.dose" reasonField="ivabradine.reason"
                startDateField="ivabradine.startDate" stopDateField="ivabradine.stopDate" changeReasonField="ivabradine.changeReason"
                control={control} register={register} />

              <MedRow label="Digoxin" prescribedField="digoxin.prescribed"
                doseField="digoxin.dose" reasonField="digoxin.reason"
                startDateField="digoxin.startDate" stopDateField="digoxin.stopDate" changeReasonField="digoxin.changeReason"
                control={control} register={register} />

              <MedRow label="IV Iron Therapy" prescribedField="ivIron.prescribed"
                doseField="ivIron.dose" reasonField="ivIron.reason"
                startDateField="ivIron.startDate" stopDateField="ivIron.stopDate" changeReasonField="ivIron.changeReason"
                control={control} register={register} />
            </div>

            <p className="section-heading font-semibold text-white mt-4">3. Comorbidity & Cardiovascular Therapies</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Aspirin */}
              <div className="bg-gray-800/40 border border-blue-500/10 rounded-xl p-4">
                <p className="text-sm font-semibold text-white mb-2">Aspirin</p>
                <Controller name="aspirin.prescribed" control={control} render={({ field }) => (
                  <RadioChipGroup
                    options={[{ value: 'Yes', label: 'Prescribed' }, { value: 'No', label: 'Not Prescribed' }]}
                    value={field.value} onChange={field.onChange} />
                )} />
                <div className="mt-3">
                  <FieldWrap label="Dose">
                    <Input {...register('aspirin.dose')} placeholder="75mg OD" />
                  </FieldWrap>
                </div>
              </div>

              {/* Statin */}
              <div className="bg-gray-800/40 border border-blue-500/10 rounded-xl p-4">
                <p className="text-sm font-semibold text-white mb-2">Statin</p>
                <Controller name="statin.prescribed" control={control} render={({ field }) => (
                  <RadioChipGroup
                    options={[{ value: 'Yes', label: 'Prescribed' }, { value: 'No', label: 'Not Prescribed' }]}
                    value={field.value} onChange={field.onChange} />
                )} />
                <div className="grid grid-cols-2 gap-2 mt-3">
                  <FieldWrap label="Type">
                    <Select {...register('statin.type')}>
                      <option value="">Select</option>
                      <option>Atorvastatin</option><option>Rosuvastatin</option>
                      <option>Pitavastatin</option><option>Simvastatin</option>
                    </Select>
                  </FieldWrap>
                  <FieldWrap label="Dose">
                    <Input {...register('statin.dose')} placeholder="40mg OD" />
                  </FieldWrap>
                </div>
              </div>

              {/* Anticoagulants */}
              <div className="bg-gray-800/40 border border-blue-500/10 rounded-xl p-4 col-span-1 md:col-span-2">
                <p className="text-sm font-semibold text-white mb-3">Anticoagulation / Anti-arrhythmic</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="p-3 bg-gray-900/40 border border-blue-500/5 rounded-lg">
                    <p className="text-xs font-semibold text-gray-400 mb-2">NOAC</p>
                    <Controller name="noac.prescribed" control={control} render={({ field }) => (
                      <RadioChipGroup
                        options={[{ value: 'Yes', label: 'Prescribed' }, { value: 'No', label: 'Not Prescribed' }]}
                        value={field.value} onChange={field.onChange} />
                    )} />
                    <div className="grid grid-cols-2 gap-2 mt-3">
                      <FieldWrap label="Type">
                        <Select {...register('noac.type')}>
                          <option value="">Select</option>
                          <option>Apixaban</option><option>Rivaroxaban</option>
                          <option>Dabigatran</option><option>Edoxaban</option>
                        </Select>
                      </FieldWrap>
                      <FieldWrap label="Dose">
                        <Input {...register('noac.dose')} placeholder="5mg BD" />
                      </FieldWrap>
                    </div>
                  </div>

                  <div className="p-3 bg-gray-900/40 border border-blue-500/5 rounded-lg">
                    <p className="text-xs font-semibold text-gray-400 mb-2">Vitamin K Inhibitor</p>
                    <Controller name="vki.prescribed" control={control} render={({ field }) => (
                      <RadioChipGroup
                        options={[{ value: 'Yes', label: 'Prescribed' }, { value: 'No', label: 'Not Prescribed' }]}
                        value={field.value} onChange={field.onChange} />
                    )} />
                    <div className="grid grid-cols-2 gap-2 mt-3">
                      <FieldWrap label="Type">
                        <Select {...register('vki.type')}>
                          <option value="">Select</option>
                          <option>Warfarin</option><option>Acenocoumarol</option>
                        </Select>
                      </FieldWrap>
                      <FieldWrap label="Dose">
                        <Input {...register('vki.dose')} placeholder="INR 2-3" />
                      </FieldWrap>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Tab: Advanced Studies ──────────────────────────────── */}
        {activeTabId === 'advanced' && (
          <div className="space-y-5">
            <div>
              <p className="section-heading">Cardiac Rhythm Devices</p>
              <Controller name="device" control={control} render={({ field }) => (
                <CheckChipGroup
                  options={[
                    { value: 'ICD',   label: 'ICD' },
                    { value: 'CRT-D', label: 'CRT-D' },
                    { value: 'CRT-P', label: 'CRT-P' },
                    { value: 'PPM',   label: 'PPM' },
                  ]}
                  value={field.value}
                  onChange={field.onChange}
                />
              )} />
              <div className="mt-3">
                <FieldWrap label="Device notes / implant date">
                  <Textarea {...register('deviceNotes')} placeholder="Device model, implant date, recent interrogation…" />
                </FieldWrap>
              </div>
            </div>

            <div>
              <p className="section-heading">Advanced Diagnostics (Vascular / Holter / MRI)</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FieldWrap label="Pulse Wave Velocity (m/s)">
                  <Input type="number" step="0.1" {...register('vascular.pulseWaveVelocity')} placeholder="8.5" />
                </FieldWrap>
                <FieldWrap label="AF Burden (%)">
                  <Input type="number" step="0.1" {...register('holterWearable.afBurden')} placeholder="2%" />
                </FieldWrap>
                <FieldWrap label="Cardiac MRI - LGE Burden (%)">
                  <Input type="number" step="0.1" {...register('cardiacMRI.lgeBurden')} placeholder="5%" />
                </FieldWrap>
                <FieldWrap label="CTCA - Stenosis Severity">
                  <Select {...register('ctca.stenosisSeverity')}>
                    <option value="">Select</option>
                    <option>None</option>
                    <option>Mild (&lt;50%)</option>
                    <option>Moderate (50-69%)</option>
                    <option>Severe (≥70%)</option>
                  </Select>
                </FieldWrap>
              </div>
            </div>

            <div>
              <p className="section-heading">Vaccinations & Strength</p>
              <div className="grid grid-cols-2 gap-4">
                <FieldWrap label="Influenza Vaccine Status">
                  <Select {...register('vaccInfluenza')}>
                    <option value="">Select</option>
                    <option>Given</option>
                    <option>Not given</option>
                    <option>Declined</option>
                  </Select>
                </FieldWrap>
                <FieldWrap label="Hand Grip Strength - Right (kg)">
                  <Input type="number" step="0.1" {...register('gripRight')} placeholder="28" />
                </FieldWrap>
              </div>
            </div>

            <div>
              <p className="section-heading text-white">Coronary Anatomy & Prior Revascularization</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <FieldWrap label="LM Stenosis (%)" error={errors.coronaryAnatomy?.lmStenosis?.message}>
                  <Input type="number" {...register('coronaryAnatomy.lmStenosis')} placeholder="e.g. 50" error={!!errors.coronaryAnatomy?.lmStenosis} />
                </FieldWrap>
                <FieldWrap label="LAD Stenosis (%)" error={errors.coronaryAnatomy?.ladStenosis?.message}>
                  <Input type="number" {...register('coronaryAnatomy.ladStenosis')} placeholder="e.g. 70" error={!!errors.coronaryAnatomy?.ladStenosis} />
                </FieldWrap>
                <FieldWrap label="LCx Stenosis (%)" error={errors.coronaryAnatomy?.lcxStenosis?.message}>
                  <Input type="number" {...register('coronaryAnatomy.lcxStenosis')} placeholder="e.g. 30" error={!!errors.coronaryAnatomy?.lcxStenosis} />
                </FieldWrap>
                <FieldWrap label="RCA Stenosis (%)" error={errors.coronaryAnatomy?.rcaStenosis?.message}>
                  <Input type="number" {...register('coronaryAnatomy.rcaStenosis')} placeholder="e.g. 0" error={!!errors.coronaryAnatomy?.rcaStenosis} />
                </FieldWrap>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <FieldWrap label="SYNTAX Score" error={errors.coronaryAnatomy?.syntaxScore?.message} hint="Lesion complexity score">
                  <Input type="number" {...register('coronaryAnatomy.syntaxScore')} placeholder="e.g. 22" error={!!errors.coronaryAnatomy?.syntaxScore} />
                </FieldWrap>
                <FieldWrap label="Prior Revascularization">
                  <Select {...register('coronaryAnatomy.revascularizationType')}>
                    <option value="">None / Select</option>
                    <option value="None">None</option>
                    <option value="PCI">PCI</option>
                    <option value="CABG">CABG</option>
                    <option value="Both">Both PCI & CABG</option>
                  </Select>
                </FieldWrap>
                <FieldWrap label="Prior PCI Date">
                  <Input type="date" {...register('coronaryAnatomy.priorPciDate')} />
                </FieldWrap>
                <FieldWrap label="Prior CABG Date">
                  <Input type="date" {...register('coronaryAnatomy.priorCabgDate')} />
                </FieldWrap>
              </div>
            </div>
          </div>
        )}

        {/* ── Tab: QoL & SDOH ─────────────────────────────────────── */}
        {activeTabId === 'qol' && (
          <div className="space-y-5">
            <div>
              <p className="section-heading">Patient Lifestyle Education</p>
              <Controller name="education" control={control} render={({ field }) => (
                <CheckChipGroup
                  options={[
                    { value: 'Diet',                label: 'Diet counselling' },
                    { value: 'Exercise',            label: 'Exercise guidance' },
                    { value: 'Weight monitoring',   label: 'Daily weight monitoring' },
                    { value: 'Fluid restriction',   label: 'Fluid restriction' },
                    { value: 'Worsening symptoms',  label: 'Detection of worsening symptoms' },
                    { value: 'Medication adherence',label: 'Medication adherence' },
                    { value: 'Salt restriction',    label: 'Salt restriction (<2g/day)' },
                  ]}
                  value={field.value}
                  onChange={field.onChange}
                />
              )} />
            </div>

            <div>
              <p className="section-heading text-white">Symptom Trajectory & EQ-5D-5L QoL Index</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <FieldWrap label="Symptom Trajectory" hint="Clinical status change since last visit">
                  <Select {...register('symptomTrajectory')}>
                    <option value="">Select Trajectory</option>
                    <option value="Improving">Improving</option>
                    <option value="Stable">Stable</option>
                    <option value="Worsening">Worsening</option>
                  </Select>
                </FieldWrap>
                <FieldWrap label="EQ-VAS Health State Score (0-100)" hint="0 (worst) to 100 (best) self-rated health" error={errors.eq5d?.healthStateScore?.message}>
                  <Input type="number" {...register('eq5d.healthStateScore')} placeholder="e.g. 75" error={!!errors.eq5d?.healthStateScore} />
                </FieldWrap>
              </div>

              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">EQ-5D-5L Dimension Scores (1: Best, 5: Worst)</p>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3 bg-slate-900/40 p-4 rounded-xl border border-blue-500/10">
                <FieldWrap label="Mobility" error={errors.eq5d?.mobility?.message}>
                  <Select {...register('eq5d.mobility')}>
                    <option value="">Select</option>
                    <option value="1">1 - No problems</option>
                    <option value="2">2 - Slight problems</option>
                    <option value="3">3 - Moderate problems</option>
                    <option value="4">4 - Severe problems</option>
                    <option value="5">5 - Extreme problems</option>
                  </Select>
                </FieldWrap>

                <FieldWrap label="Self-Care" error={errors.eq5d?.selfCare?.message}>
                  <Select {...register('eq5d.selfCare')}>
                    <option value="">Select</option>
                    <option value="1">1 - No problems</option>
                    <option value="2">2 - Slight problems</option>
                    <option value="3">3 - Moderate problems</option>
                    <option value="4">4 - Severe problems</option>
                    <option value="5">5 - Extreme problems</option>
                  </Select>
                </FieldWrap>

                <FieldWrap label="Usual Activities" error={errors.eq5d?.usualActivities?.message}>
                  <Select {...register('eq5d.usualActivities')}>
                    <option value="">Select</option>
                    <option value="1">1 - No problems</option>
                    <option value="2">2 - Slight problems</option>
                    <option value="3">3 - Moderate problems</option>
                    <option value="4">4 - Severe problems</option>
                    <option value="5">5 - Extreme problems</option>
                  </Select>
                </FieldWrap>

                <FieldWrap label="Pain / Discomfort" error={errors.eq5d?.painDiscomfort?.message}>
                  <Select {...register('eq5d.painDiscomfort')}>
                    <option value="">Select</option>
                    <option value="1">1 - No discomfort</option>
                    <option value="2">2 - Slight discomfort</option>
                    <option value="3">3 - Moderate discomfort</option>
                    <option value="4">4 - Severe discomfort</option>
                    <option value="5">5 - Extreme discomfort</option>
                  </Select>
                </FieldWrap>

                <FieldWrap label="Anxiety / Depression" error={errors.eq5d?.anxietyDepression?.message}>
                  <Select {...register('eq5d.anxietyDepression')}>
                    <option value="">Select</option>
                    <option value="1">1 - Not anxious/depressed</option>
                    <option value="2">2 - Slightly anxious/depressed</option>
                    <option value="3">3 - Moderately anxious/depressed</option>
                    <option value="4">4 - Severely anxious/depressed</option>
                    <option value="5">5 - Extremely anxious/depressed</option>
                  </Select>
                </FieldWrap>
              </div>
            </div>

            <div>
              <p className="section-heading">Follow-up Plan & Clinical Notes</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FieldWrap label="Next Follow-up Date">
                  <Input type="date" {...register('followupDate')} />
                </FieldWrap>
                <FieldWrap label="Follow-up Type">
                  <Select {...register('followupType')}>
                    <option value="">Select</option>
                    <option value="OPD">OPD</option>
                    <option value="Telemedicine">Telemedicine</option>
                    <option value="Inpatient">Inpatient</option>
                  </Select>
                </FieldWrap>
                <FieldWrap label="Clinical Assessment Notes" className="md:col-span-2">
                  <Textarea {...register('clinicalNotes')} rows={5} placeholder="Clinical assessment, differential diagnoses, management plan, response to treatment…" />
                </FieldWrap>
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between pt-4 border-t border-blue-500/10">
          <Button
            type="button"
            variant="outline"
            onClick={() => setTab(t => Math.max(0, t - 1))}
            disabled={tab === 0}
          >
            <ChevronLeft className="w-4 h-4" /> Back
          </Button>
          {tab < TABS.length - 1 ? (
            <Button type="button" onClick={() => setTab(t => t + 1)}>
              Next <ChevronRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button type="submit" loading={loading} size="lg">
              Save Visit
            </Button>
          )}
        </div>
      </div>
    </form>
  )
}
