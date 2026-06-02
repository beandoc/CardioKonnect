'use client'
import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { FieldWrap, Input, Select, Textarea } from '@/components/ui/FormField'
import { RadioChipGroup, CheckChipGroup } from '@/components/ui/ChipGroup'
import Button from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import type { VisitInput } from '@/lib/types'
import { ChevronRight, ChevronLeft } from 'lucide-react'

// ─── Zod schema (partial — most fields optional) ────────────────────────────
const medEntry = z.object({
  prescribed: z.enum(['Yes', 'No', '']).default(''),
  type:       z.string().optional(),
  dose:       z.string().optional(),
  reason:     z.string().optional(),
})

const prescribedOnly = z.object({
  prescribed: z.enum(['Yes', 'No', '']).default(''),
  type:       z.string().optional(),
  dose:       z.string().optional(),
})

const schema = z.object({
  // Visit meta
  visitDate: z.string().min(1, 'Required'),
  visitType: z.enum(['OPD', 'Telemedicine', 'Inpatient', '']).default('OPD'),

  // Anthropometrics
  weight: z.coerce.number().positive().optional().or(z.literal('')),
  height: z.coerce.number().positive().optional().or(z.literal('')),
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
  followupType: z.enum(['OPD', 'Telemedicine', '']).default(''),
  clinicalNotes: z.string().optional(),

  // Vascular
  vascular: z.object({
    pulseWaveVelocity: z.coerce.number().optional().or(z.literal('')),
    augmentationIndex: z.coerce.number().optional().or(z.literal('')),
    centralAorticPressure: z.coerce.number().optional().or(z.literal('')),
    arterialStiffnessIndex: z.coerce.number().optional().or(z.literal('')),
    flowMediatedDilation: z.coerce.number().optional().or(z.literal('')),
    carotidImt: z.coerce.number().optional().or(z.literal('')),
    carotidPlaqueBurden: z.string().optional(),
  }).default({}),

  // Holter Wearable
  holterWearable: z.object({
    afBurden: z.coerce.number().optional().or(z.literal('')),
    pvcBurden: z.coerce.number().optional().or(z.literal('')),
    circadianRhythmMetrics: z.string().optional(),
  }).default({}),

  // CTCA
  ctca: z.object({
    stenosisSeverity: z.string().optional(),
    highRiskPlaqueFeatures: z.boolean().optional(),
    notes: z.string().optional(),
  }).default({}),

  // MRI
  cardiacMRI: z.object({
    t1Native: z.coerce.number().optional().or(z.literal('')),
    t2Mapping: z.coerce.number().optional().or(z.literal('')),
    ecv: z.coerce.number().optional().or(z.literal('')),
    lgeBurden: z.coerce.number().optional().or(z.literal('')),
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

const TABS = [
  { id: 'visit',    label: 'Visit & Vitals' },
  { id: 'clinical', label: 'Clinical' },
  { id: 'echo',     label: 'Echo & ECG' },
  { id: 'imaging',  label: 'Advanced Imaging' },
  { id: 'labs',     label: 'Laboratory' },
  { id: 'vascular', label: 'Vascular & Wearables' },
  { id: 'meds',     label: 'Medications' },
  { id: 'extended', label: 'Extended Meds' },
  { id: 'device',   label: 'Device & Vacc.' },
  { id: 'edu',      label: 'Education & F/U' },
]

// ─── Sub-component for a medication row ────────────────────────────────────

function MedRow({
  label, prescribedField, typeField, typeOptions, doseField, reasonField, control, register,
}: {
  label: string
  prescribedField: string
  typeField?: string
  typeOptions?: string[]
  doseField?: string
  reasonField?: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  control: any; register: any
}) {
  return (
    <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 space-y-3">
      <p className="text-sm font-semibold text-gray-700">{label}</p>
      <Controller
        name={prescribedField as never}
        control={control}
        render={({ field }) => (
          <RadioChipGroup
            options={[{ value: 'Yes', label: 'Prescribed' }, { value: 'No', label: 'Not Prescribed' }]}
            value={field.value as string}
            onChange={field.onChange}
          />
        )}
      />
      <div className="grid grid-cols-2 gap-3">
        {typeField && typeOptions && (
          <FieldWrap label="Drug / Type">
            <Select {...register(typeField)}>
              <option value="">Select</option>
              {typeOptions.map(o => <option key={o}>{o}</option>)}
            </Select>
          </FieldWrap>
        )}
        {doseField && (
          <FieldWrap label="Dose">
            <Input {...register(doseField)} placeholder="e.g. 40mg OD" />
          </FieldWrap>
        )}
        {reasonField && (
          <FieldWrap label="Reason if not prescribed" className="col-span-2">
            <Input {...register(reasonField)} placeholder="Reason" />
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
}

export default function VisitForm({ defaultValues, onSubmit, loading }: Props) {
  const [tab, setTab] = useState(0)

  const { register, control, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      visitDate: new Date().toISOString().split('T')[0],
      visitType: 'OPD',
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
      ...(defaultValues as Partial<FormValues>),
    },
  })

  return (
    <form
      onSubmit={handleSubmit(v => onSubmit(v as unknown as VisitInput))}
      className="space-y-0"
    >
      {/* Tab bar */}
      <div className="flex border-b border-gray-200 overflow-x-auto -mb-px">
        {TABS.map((t, i) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(i)}
            className={cn('tab-btn', tab === i && 'active')}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="pt-5 space-y-4">

        {/* ── Tab 0: Visit & Vitals ────────────────────────────────── */}
        {tab === 0 && (
          <div className="space-y-5">
            <div>
              <p className="section-heading">Visit Information</p>
              <div className="grid grid-cols-3 gap-4">
                <FieldWrap label="Visit Date" required error={errors.visitDate?.message}>
                  <Input type="date" {...register('visitDate')} error={!!errors.visitDate} />
                </FieldWrap>
                <FieldWrap label="Visit Type">
                  <Select {...register('visitType')}>
                    <option value="">Select</option>
                    <option>OPD</option>
                    <option>Telemedicine</option>
                    <option>Inpatient</option>
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
            </div>
            <div>
              <p className="section-heading">Anthropometrics</p>
              <div className="grid grid-cols-4 gap-4">
                <FieldWrap label="Weight (kg)">
                  <Input type="number" step="0.1" {...register('weight')} placeholder="72.5" />
                </FieldWrap>
                <FieldWrap label="Height (cm)">
                  <Input type="number" {...register('height')} placeholder="165" />
                </FieldWrap>
                <FieldWrap label="O₂ Saturation (%)">
                  <Input type="number" {...register('o2Sat')} placeholder="97" />
                </FieldWrap>
              </div>
            </div>
            <div>
              <p className="section-heading">Vitals</p>
              <div className="grid grid-cols-3 gap-4">
                <FieldWrap label="Systolic BP (mmHg)">
                  <Input type="number" {...register('bpSystolic')} placeholder="120" />
                </FieldWrap>
                <FieldWrap label="Diastolic BP (mmHg)">
                  <Input type="number" {...register('bpDiastolic')} placeholder="80" />
                </FieldWrap>
                <FieldWrap label="Heart Rate (bpm)">
                  <Input type="number" {...register('heartRate')} placeholder="72" />
                </FieldWrap>
              </div>
            </div>
          </div>
        )}

        {/* ── Tab 1: Clinical ──────────────────────────────────────── */}
        {tab === 1 && (
          <div className="space-y-5">
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
              <p className="section-heading">Functional Capacity</p>
              <div className="grid grid-cols-2 gap-4">
                <FieldWrap label="6-Minute Walk Test (metres)">
                  <Input type="number" {...register('sixMWT')} placeholder="380" />
                </FieldWrap>
              </div>
            </div>
            <div>
              <p className="section-heading">Hospitalisation History</p>
              <div className="grid grid-cols-3 gap-4">
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
                <FieldWrap label="Details" className="col-span-3">
                  <Textarea {...register('hospDetails')} placeholder="Dates, reason, duration…" />
                </FieldWrap>
              </div>
            </div>
          </div>
        )}

        {/* ── Tab 2: Echo & ECG ───────────────────────────────────── */}
        {tab === 2 && (
          <div className="space-y-5">
            <div>
              <p className="section-heading">Echocardiography</p>
              <div className="grid grid-cols-3 gap-4">
                <FieldWrap label="LVEF (%)" hint="Left ventricular ejection fraction">
                  <Input type="number" step="0.1" {...register('lvef')} placeholder="55" />
                </FieldWrap>
                <FieldWrap label="Echo Date">
                  <Input type="date" {...register('echoDate')} />
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
            </div>
            <div>
              <p className="section-heading">ECG</p>
              <div className="grid grid-cols-3 gap-4">
                <FieldWrap label="QRS Duration (ms)">
                  <Input type="number" {...register('qrsDuration')} placeholder="100" />
                </FieldWrap>
                <FieldWrap label="Bundle Branch Block">
                  <Select {...register('bbb')}>
                    <option value="">None</option>
                    <option>LBBB</option>
                    <option>RBBB</option>
                    <option>IVCD</option>
                  </Select>
                </FieldWrap>
                <FieldWrap label="QTc Interval (ms)">
                  <Input type="number" {...register('qtcInterval')} placeholder="440" />
                </FieldWrap>
              </div>
            </div>
          </div>
        )}

        {/* ── Tab 3: Advanced Imaging ─────────────────────────────── */}
        {tab === 3 && (
          <div className="space-y-5">
            <div>
              <p className="section-heading">Cardiac MRI</p>
              <div className="grid grid-cols-2 gap-4">
                <FieldWrap label="Native T1 mapping (ms)">
                  <Input type="number" {...register('cardiacMRI.t1Native')} placeholder="1000" />
                </FieldWrap>
                <FieldWrap label="T2 mapping (ms)">
                  <Input type="number" {...register('cardiacMRI.t2Mapping')} placeholder="50" />
                </FieldWrap>
                <FieldWrap label="Extracellular Volume (ECV) (%)">
                  <Input type="number" step="0.1" {...register('cardiacMRI.ecv')} placeholder="28" />
                </FieldWrap>
                <FieldWrap label="LGE Burden (%)">
                  <Input type="number" step="0.1" {...register('cardiacMRI.lgeBurden')} placeholder="5" />
                </FieldWrap>
              </div>
            </div>
            <div>
              <p className="section-heading">CT Coronary Angiography</p>
              <div className="grid grid-cols-2 gap-4">
                <FieldWrap label="Stenosis Severity">
                  <Select {...register('ctca.stenosisSeverity')}>
                    <option value="">Select</option>
                    <option>None</option>
                    <option>Mild (&lt;50%)</option>
                    <option>Moderate (50-69%)</option>
                    <option>Severe (≥70%)</option>
                  </Select>
                </FieldWrap>
                <div className="flex items-center space-x-2 pt-6">
                  <input type="checkbox" id="highRiskPlaqueFeatures" {...register('ctca.highRiskPlaqueFeatures')} className="w-5 h-5" />
                  <label htmlFor="highRiskPlaqueFeatures" className="text-sm text-gray-700">High Risk Plaque Features</label>
                </div>
                <FieldWrap label="Notes" className="col-span-2">
                  <Textarea {...register('ctca.notes')} placeholder="Additional CT findings..." />
                </FieldWrap>
              </div>
            </div>
          </div>
        )}

        {/* ── Tab 4: Laboratory ───────────────────────────────────── */}
        {tab === 4 && (
          <div className="space-y-5">
            <div>
              <p className="section-heading">Biomarkers</p>
              <div className="grid grid-cols-3 gap-4">
                <FieldWrap label="NT-proBNP (pg/mL)">
                  <Input type="number" {...register('ntProBNP')} placeholder="125" />
                </FieldWrap>
                <FieldWrap label="BNP (pg/mL)">
                  <Input type="number" {...register('bnp')} placeholder="80" />
                </FieldWrap>
              </div>
            </div>
            <div>
              <p className="section-heading">Renal & Electrolytes</p>
              <div className="grid grid-cols-3 gap-4">
                <FieldWrap label="eGFR (ml/min/1.73m²)">
                  <Input type="number" step="0.1" {...register('egfr')} placeholder="60" />
                </FieldWrap>
                <FieldWrap label="Creatinine (mg/dL)">
                  <Input type="number" step="0.01" {...register('creatinine')} placeholder="1.0" />
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
                <FieldWrap label="TFT — TSH (mIU/L)">
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
            <div>
              <p className="section-heading">Inflammation Markers</p>
              <div className="grid grid-cols-3 gap-4">
                <FieldWrap label="hs-CRP (mg/L)">
                  <Input type="number" step="0.1" {...register('hsCrp')} placeholder="1.5" />
                </FieldWrap>
                <FieldWrap label="IL-6 (pg/mL)">
                  <Input type="number" step="0.1" {...register('il6')} placeholder="5.0" />
                </FieldWrap>
                <FieldWrap label="TNF-alpha (pg/mL)">
                  <Input type="number" step="0.1" {...register('tnfAlpha')} placeholder="2.5" />
                </FieldWrap>
              </div>
            </div>
          </div>
        )}

        {/* ── Tab 5: Vascular & Wearables ─────────────────────────── */}
        {tab === 5 && (
          <div className="space-y-5">
            <div>
              <p className="section-heading">Vascular & Endothelial Assessment</p>
              <div className="grid grid-cols-2 gap-4">
                <FieldWrap label="Pulse Wave Velocity (m/s)">
                  <Input type="number" step="0.1" {...register('vascular.pulseWaveVelocity')} placeholder="8.5" />
                </FieldWrap>
                <FieldWrap label="Augmentation Index (%)">
                  <Input type="number" step="0.1" {...register('vascular.augmentationIndex')} placeholder="25" />
                </FieldWrap>
                <FieldWrap label="Central Aortic Pressure (mmHg)">
                  <Input type="number" {...register('vascular.centralAorticPressure')} placeholder="110" />
                </FieldWrap>
                <FieldWrap label="Arterial Stiffness Index">
                  <Input type="number" step="0.1" {...register('vascular.arterialStiffnessIndex')} placeholder="7.5" />
                </FieldWrap>
                <FieldWrap label="Flow-Mediated Dilation (%)">
                  <Input type="number" step="0.1" {...register('vascular.flowMediatedDilation')} placeholder="5.0" />
                </FieldWrap>
                <FieldWrap label="Carotid IMT (mm)">
                  <Input type="number" step="0.01" {...register('vascular.carotidImt')} placeholder="0.8" />
                </FieldWrap>
                <FieldWrap label="Carotid Plaque Burden">
                  <Select {...register('vascular.carotidPlaqueBurden')}>
                    <option value="">Select</option>
                    <option>None</option>
                    <option>Mild</option>
                    <option>Moderate</option>
                    <option>Severe</option>
                  </Select>
                </FieldWrap>
              </div>
            </div>
            <div>
              <p className="section-heading">Holter / Wearables</p>
              <div className="grid grid-cols-2 gap-4">
                <FieldWrap label="AF Burden (%)">
                  <Input type="number" step="0.1" {...register('holterWearable.afBurden')} placeholder="2" />
                </FieldWrap>
                <FieldWrap label="PVC Burden (%)">
                  <Input type="number" step="0.1" {...register('holterWearable.pvcBurden')} placeholder="1" />
                </FieldWrap>
                <FieldWrap label="Circadian Rhythm Metrics" className="col-span-2">
                  <Input {...register('holterWearable.circadianRhythmMetrics')} placeholder="e.g. Preserved, Blunted dipping" />
                </FieldWrap>
              </div>
            </div>
          </div>
        )}

        {/* ── Tab 6: Core Medications ─────────────────────────────── */}
        {tab === 6 && (
          <div className="space-y-4">
            <p className="section-heading">Heart Failure Pharmacotherapy</p>
            <MedRow label="Diuretics" prescribedField="diuretic.prescribed"
              typeField="diuretic.type" typeOptions={['Furosemide','Torsemide','Bumetanide','Hydrochlorothiazide']}
              doseField="diuretic.dose" reasonField="diuretic.reason"
              control={control} register={register} />

            <MedRow label="ACE Inhibitor / ARB / ARNI (RAASi)" prescribedField="raasi.prescribed"
              typeField="raasi.type" typeOptions={['Ramipril (ACEi)','Enalapril (ACEi)','Lisinopril (ACEi)','Losartan (ARB)','Valsartan (ARB)','Telmisartan (ARB)','Sacubitril/Valsartan (ARNI)']}
              doseField="raasi.dose" reasonField="raasi.reason"
              control={control} register={register} />

            <MedRow label="Beta Blocker" prescribedField="betaBlocker.prescribed"
              typeField="betaBlocker.type" typeOptions={['Carvedilol','Metoprolol Succinate','Bisoprolol','Nebivolol']}
              doseField="betaBlocker.dose" reasonField="betaBlocker.reason"
              control={control} register={register} />

            <MedRow label="MRA — Mineralocorticoid Receptor Antagonist" prescribedField="mra.prescribed"
              typeField="mra.type" typeOptions={['Spironolactone','Eplerenone','Finerenone']}
              doseField="mra.dose" reasonField="mra.reason"
              control={control} register={register} />

            <MedRow label="SGLT2 Inhibitor" prescribedField="sglt2i.prescribed"
              typeField="sglt2i.type" typeOptions={['Dapagliflozin 10mg OD','Empagliflozin 10mg OD']}
              doseField="sglt2i.dose" reasonField="sglt2i.reason"
              control={control} register={register} />

            <MedRow label="Ivabradine" prescribedField="ivabradine.prescribed"
              doseField="ivabradine.dose" reasonField="ivabradine.reason"
              control={control} register={register} />

            <MedRow label="Digoxin" prescribedField="digoxin.prescribed"
              doseField="digoxin.dose" reasonField="digoxin.reason"
              control={control} register={register} />
          </div>
        )}

        {/* ── Tab 7: Extended Medications ────────────────────────── */}
        {tab === 7 && (
          <div className="space-y-5">
            <div>
              <p className="section-heading">Dyslipidemia Management</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
                  <p className="text-sm font-semibold text-gray-700 mb-2">Aspirin</p>
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
                <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
                  <p className="text-sm font-semibold text-gray-700 mb-2">Statin</p>
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
                <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
                  <p className="text-sm font-semibold text-gray-700 mb-2">Fibrate</p>
                  <Controller name="fibrate.prescribed" control={control} render={({ field }) => (
                    <RadioChipGroup
                      options={[{ value: 'Yes', label: 'Prescribed' }, { value: 'No', label: 'Not Prescribed' }]}
                      value={field.value} onChange={field.onChange} />
                  )} />
                  <div className="mt-3">
                    <FieldWrap label="Type">
                      <Select {...register('fibrate.type')}>
                        <option value="">Select</option>
                        <option>Fenofibrate</option><option>Gemfibrozil</option>
                      </Select>
                    </FieldWrap>
                  </div>
                </div>
                <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
                  <p className="text-sm font-semibold text-gray-700 mb-2">PCSK-9 Inhibitor</p>
                  <Controller name="pcsk9.prescribed" control={control} render={({ field }) => (
                    <RadioChipGroup
                      options={[{ value: 'Yes', label: 'Prescribed' }, { value: 'No', label: 'Not Prescribed' }]}
                      value={field.value} onChange={field.onChange} />
                  )} />
                  <div className="mt-3">
                    <FieldWrap label="Type">
                      <Select {...register('pcsk9.type')}>
                        <option value="">Select</option>
                        <option>Evolocumab</option><option>Alirocumab</option>
                      </Select>
                    </FieldWrap>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <p className="section-heading">Diabetes Management (if DM diagnosed)</p>
              <div className="grid grid-cols-3 gap-4">
                <FieldWrap label="HbA1c (%)">
                  <Input type="number" step="0.1" {...register('dmManagement.hba1c')} placeholder="7.0" />
                </FieldWrap>
                <FieldWrap label="Anti-diabetic Drug & Dose">
                  <Input {...register('dmManagement.drug')} placeholder="Metformin 500mg BD" />
                </FieldWrap>
                <FieldWrap label="Reason if not optimally treated">
                  <Input {...register('dmManagement.reason')} placeholder="Reason" />
                </FieldWrap>
              </div>
            </div>

            <div>
              <p className="section-heading">Iron Deficiency / Anaemia</p>
              <MedRow label="IV Iron Therapy" prescribedField="ivIron.prescribed"
                doseField="ivIron.dose" reasonField="ivIron.reason"
                control={control} register={register} />
            </div>

            <div>
              <p className="section-heading">Anticoagulation / Anti-arrhythmic</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
                  <p className="text-sm font-semibold text-gray-700 mb-2">NOAC</p>
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
                <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
                  <p className="text-sm font-semibold text-gray-700 mb-2">Vitamin K Inhibitor</p>
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
                    <FieldWrap label="Dose / INR target">
                      <Input {...register('vki.dose')} placeholder="INR 2–3" />
                    </FieldWrap>
                  </div>
                </div>
              </div>
              <div className="mt-3">
                <FieldWrap label="Reason if anticoagulation not prescribed">
                  <Input {...register('antiarrhythmicReason')} placeholder="Reason" />
                </FieldWrap>
              </div>
            </div>
          </div>
        )}

        {/* ── Tab 8: Device & Vaccination ─────────────────────────── */}
        {tab === 8 && (
          <div className="space-y-5">
            <div>
              <p className="section-heading">Device Therapy</p>
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
              <p className="section-heading">Vaccination</p>
              <div className="grid grid-cols-2 gap-4">
                <FieldWrap label="Influenza Vaccine">
                  <Select {...register('vaccInfluenza')}>
                    <option value="">Select</option>
                    <option>Given – Right arm</option>
                    <option>Given – Left arm</option>
                    <option>Not given</option>
                    <option>Declined</option>
                    <option>Previously vaccinated</option>
                  </Select>
                </FieldWrap>
                <FieldWrap label="Influenza Vaccine Date">
                  <Input type="date" {...register('vaccInfluenzaDate')} />
                </FieldWrap>
                <FieldWrap label="Pneumococcal Vaccine">
                  <Select {...register('vaccPneumo')}>
                    <option value="">Select</option>
                    <option>Given – Right arm</option>
                    <option>Given – Left arm</option>
                    <option>Not given</option>
                    <option>Declined</option>
                    <option>Previously vaccinated</option>
                  </Select>
                </FieldWrap>
                <FieldWrap label="Pneumococcal Vaccine Date">
                  <Input type="date" {...register('vaccPneumoDate')} />
                </FieldWrap>
              </div>
            </div>

            <div>
              <p className="section-heading">Functional Assessment</p>
              <div className="grid grid-cols-3 gap-4">
                <FieldWrap label="Hand Grip — Right (kg)">
                  <Input type="number" step="0.1" {...register('gripRight')} placeholder="28" />
                </FieldWrap>
                <FieldWrap label="Hand Grip — Left (kg)">
                  <Input type="number" step="0.1" {...register('gripLeft')} placeholder="26" />
                </FieldWrap>
                <FieldWrap label="Frailty Assessment">
                  <Select {...register('frailty')}>
                    <option value="">Select</option>
                    <option>Not frail</option>
                    <option>Pre-frail</option>
                    <option>Frail</option>
                  </Select>
                </FieldWrap>
              </div>
            </div>
          </div>
        )}

        {/* ── Tab 9: Education & Follow-up ────────────────────────── */}
        {tab === 9 && (
          <div className="space-y-5">
            <div>
              <p className="section-heading">Patient Education Provided</p>
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
                    { value: 'Smoking cessation',   label: 'Smoking cessation' },
                    { value: 'Alcohol restriction', label: 'Alcohol restriction' },
                  ]}
                  value={field.value}
                  onChange={field.onChange}
                />
              )} />
              <div className="mt-3">
                <FieldWrap label="Education notes">
                  <Textarea {...register('eduNotes')} placeholder="Additional patient education notes…" />
                </FieldWrap>
              </div>
            </div>
            <div>
              <p className="section-heading">Follow-up Plan</p>
              <div className="grid grid-cols-2 gap-4">
                <FieldWrap label="Next Follow-up Date">
                  <Input type="date" {...register('followupDate')} />
                </FieldWrap>
                <FieldWrap label="Follow-up Type">
                  <Select {...register('followupType')}>
                    <option value="">Select</option>
                    <option>OPD</option>
                    <option>Telemedicine</option>
                  </Select>
                </FieldWrap>
                <FieldWrap label="Clinical Notes / Assessment" className="col-span-2">
                  <Textarea
                    {...register('clinicalNotes')}
                    rows={5}
                    placeholder="Clinical assessment, differential diagnoses, management plan, response to treatment…"
                  />
                </FieldWrap>
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between pt-4 border-t border-gray-100">
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
