'use client'
import { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { FieldWrap, Input, Select, Textarea } from '@/components/ui/FormField'
import { CheckChipGroup } from '@/components/ui/ChipGroup'
import Button from '@/components/ui/Button'
import type { PatientInput } from '@/lib/types'

const schema = z.object({
  firstName:      z.string().min(1, 'Required'),
  lastName:       z.string().min(1, 'Required'),
  dob:            z.string().min(1, 'Required'),
  sex:            z.enum(['Male', 'Female'], { errorMap: () => ({ message: 'Required' }) }),
  mrn:            z.string().optional(),
  contact:        z.string().optional(),
  email:          z.string().email('Invalid email').or(z.literal('')).optional(),
  status:         z.preprocess(v => v === '' ? undefined : v, z.enum(['Active', 'Inactive', 'Pending']).optional()),
  consentStatus:  z.preprocess(v => v === '' ? 'Pending' : v, z.enum(['Granted', 'Revoked', 'Pending', 'Declined'])).default('Pending'),
  address:        z.string().optional(),
  comorbidities:  z.array(z.string()).default([]),
  allergies:      z.string().optional(),
  indexDate:      z.string().optional(),

  // Registry tracking
  registryId:     z.string().optional(),

  // HF Registry fields
  indianCitizen:  z.boolean().default(true),
  studyConsented: z.boolean().default(true),
  hfConfirmationDate: z.string().optional(),
  educationYears: z.coerce.number().min(0).default(0),
  abhaId:         z.string().optional(),
  occupation:     z.string().optional(),
  indexEtiology:  z.array(z.string()).default([]),
  indexEtiologyOther: z.string().optional(),
  familyHistoryPrematureCVD: z.boolean().default(false),
  familyHistorySuddenDeath: z.boolean().default(false),
  familyHistoryCardiomyopathy: z.boolean().default(false),
  familyHistoryGeneticHeart: z.boolean().default(false),
  addressHouse:   z.string().optional(),
  addressStreet:  z.string().optional(),
  addressPost:    z.string().optional(),
  addressDistrict:z.string().optional(),
  addressState:   z.string().optional(),
  addressPin:     z.string().optional(),
  secondaryContact: z.string().optional(),
  caregiverContact: z.string().optional(),
  caregiverSecondaryContact: z.string().optional(),

  // eConsent Version Tracking
  consentVersion: z.string().optional(),
  consentDate:    z.string().optional(),
  consentWitness: z.string().optional(),
  consentWithdrawalDate: z.string().optional(),
  consentWithdrawalReason: z.string().optional(),
  reConsentNeeded: z.boolean().default(false),
  reConsentDate:   z.string().optional(),

  // GCP Exclusions
  exclusionReviewed: z.boolean().default(false),
  excludeActiveTrial: z.boolean().default(false),
  excludeTerminalIllness: z.boolean().default(false),
  excludeNonCompliance: z.boolean().default(false),

  // Mortality / vital status
  vitalStatus: z.preprocess(v => v === '' ? undefined : v, z.enum(['Alive', 'Dead']).optional()),
  dateOfDeath: z.string().optional(),
  deathCauseCategory: z.preprocess(v => v === '' ? undefined : v, z.enum(['Cardiovascular', 'Non-cardiovascular', 'Unknown']).optional()),
}).superRefine((data, ctx) => {
  if (data.registryId === 'hf') {
    if (!data.indianCitizen) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Must be an Indian Citizen for HF Registry enrollment',
        path: ['indianCitizen']
      })
    }
    if (!data.studyConsented) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Study Consent must be obtained for HF Registry enrollment',
        path: ['studyConsented']
      })
    }
    if (!data.exclusionReviewed) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Exclusion criteria review is required for GCP compliance',
        path: ['exclusionReviewed']
      })
    }
    if (data.excludeActiveTrial) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Patient is excluded if participating in an active clinical trial',
        path: ['excludeActiveTrial']
      })
    }
    if (data.excludeTerminalIllness) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Patient is excluded if terminal non-CV illness is present',
        path: ['excludeTerminalIllness']
      })
    }
    if (data.excludeNonCompliance) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Patient is excluded if unable to comply with follow-up',
        path: ['excludeNonCompliance']
      })
    }
  }
})

type FormValues = z.infer<typeof schema>

interface Props {
  defaultValues?: Partial<PatientInput>
  onSubmit: (data: PatientInput) => Promise<void>
  loading?: boolean
  submitLabel?: string
}

const COMORBIDITIES_LIST = [
  { value: 'HTN', label: 'Hypertension' },
  { value: 'DM2', label: 'Type 2 Diabetes' },
  { value: 'Dyslipidemia', label: 'Dyslipidemia' },
  { value: 'CKD', label: 'Chronic Kidney Disease' },
  { value: 'CAD', label: 'Coronary Artery Disease' },
  { value: 'Stroke', label: 'Stroke / TIA' },
  { value: 'COPD', label: 'COPD' },
  { value: 'Obesity', label: 'Obesity' },
  { value: 'Hypothyroid', label: 'Hypothyroidism' },
  { value: 'AF', label: 'Atrial Fibrillation' },
  { value: 'PAD', label: 'Peripheral Artery Disease (PAD)' },
  { value: 'PriorMI_IHD', label: 'Prior MI / IHD (distinct from active CAD)' },
  { value: 'PriorCardiacSurgery', label: 'Prior Cardiac Surgery (Valve repair/replacement, CABG)' },
  { value: 'PriorPCI', label: 'Prior PCI' },
  { value: 'HeartFailurePrior', label: 'Heart Failure (prior to current episode — established HF)' },
  { value: 'AnemiaEstablished', label: 'Anemia (established, not lab-derived)' },
  { value: 'SleepApneaEstablished', label: 'Sleep Apnea (established diagnosis)' },
  { value: 'DepressionAnxiety', label: 'Depression / Anxiety' },
  { value: 'RA_Autoimmune', label: 'Rheumatoid Arthritis / Autoimmune Disease' },
  { value: 'AlcoholUseCardiomyopathy', label: 'Alcohol Use Disorder / Alcoholic Cardiomyopathy' },
  { value: 'PriorMalignancy', label: 'Prior Malignancy (for Cardio-Oncology)' },
  { value: 'GoutHyperuricemia', label: 'Gout / Hyperuricemia' },
  { value: 'ValvularHeartDiseaseEstablished', label: 'Valvular Heart Disease (prior or established)' }
]

const FIELD_LABELS: Record<string, string> = {
  firstName: 'First Name',
  lastName: 'Last Name',
  dob: 'Date of Birth',
  sex: 'Sex',
  email: 'Email Address',
  status: 'Status',
  consentStatus: 'Consent Status',
  indexDate: 'Index Date',
  contact: 'Contact Number',
  address: 'Address',
  comorbidities: 'Comorbidities',
  allergies: 'Known Drug Allergies',
  mrn: 'Hospital Identification Number (HID)',
  abhaId: 'ABHA ID',
  occupation: 'Occupation',
  indexEtiology: 'Index Diagnosis Etiology',
  familyHistoryPrematureCVD: 'Family history of premature CV disease',
  familyHistorySuddenDeath: 'Family history of sudden cardiac death',
  familyHistoryCardiomyopathy: 'Family history of cardiomyopathy',
  familyHistoryGeneticHeart: 'Family history of genetic heart disease',
  indianCitizen: 'Indian Citizen',
  studyConsented: 'Study Consent Obtained',
  exclusionReviewed: 'Exclusion Criteria Reviewed Confirmation',
  excludeActiveTrial: 'Active Clinical Trial Exclusion Status',
  excludeTerminalIllness: 'Terminal Illness Exclusion Status',
  excludeNonCompliance: 'Non-Compliance Exclusion Status',
  vitalStatus: 'Vital Status',
  dateOfDeath: 'Date of Death',
  deathCauseCategory: 'Cause of Death Category',
}

export default function PatientForm({ defaultValues, onSubmit, loading, submitLabel = 'Save Patient' }: Props) {
  // Parse incoming legacy comorbidities (string) to array if present
  // Strip enum fields from spread to normalize them explicitly below (avoids duplicate-key TS error)
  const { vitalStatus: _vs, deathCauseCategory: _dcc, status: _st, consentStatus: _cs, ...restDefaults } = defaultValues || {}
  const parsedDefaultValues = {
    indianCitizen: true,
    studyConsented: true,
    educationYears: 0,
    registryId: '',
    ...restDefaults,
    abhaId: defaultValues?.abhaId || (defaultValues as any)?.aadhaarNo || '',
    occupation: defaultValues?.occupation || '',
    indexEtiology: defaultValues?.indexEtiology || [],
    indexEtiologyOther: defaultValues?.indexEtiologyOther || '',
    familyHistoryPrematureCVD: defaultValues?.familyHistoryPrematureCVD || false,
    familyHistorySuddenDeath: defaultValues?.familyHistorySuddenDeath || false,
    familyHistoryCardiomyopathy: defaultValues?.familyHistoryCardiomyopathy || false,
    familyHistoryGeneticHeart: defaultValues?.familyHistoryGeneticHeart || false,
    consentVersion: defaultValues?.consentVersion || '',
    consentDate: defaultValues?.consentDate || '',
    consentWitness: defaultValues?.consentWitness || '',
    consentWithdrawalDate: defaultValues?.consentWithdrawalDate || '',
    consentWithdrawalReason: defaultValues?.consentWithdrawalReason || '',
    reConsentNeeded: defaultValues?.reConsentNeeded || false,
    reConsentDate: defaultValues?.reConsentDate || '',
    exclusionReviewed: defaultValues?.exclusionReviewed || false,
    excludeActiveTrial: defaultValues?.excludeActiveTrial || false,
    excludeTerminalIllness: defaultValues?.excludeTerminalIllness || false,
    excludeNonCompliance: defaultValues?.excludeNonCompliance || false,
    comorbidities: typeof defaultValues?.comorbidities === 'string'
      ? (defaultValues.comorbidities as string).split(',').map(s => s.trim()).filter(Boolean)
      : (defaultValues?.comorbidities || []),
    // Normalize enum fields: Firestore may store '' which fails zod enum validation
    vitalStatus: _vs || undefined,
    deathCauseCategory: _dcc || undefined,
    status: _st || 'Active',
    consentStatus: _cs || 'Pending',
  } as FormValues

  const { register, handleSubmit, control, watch, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: parsedDefaultValues,
  })

  const registryId = watch('registryId')
  const consentStatus = watch('consentStatus')
  const reConsentNeeded = watch('reConsentNeeded')

  useEffect(() => {
    if (Object.keys(errors).length > 0) {
      console.log('PatientForm validation errors:', errors)
    }
  }, [errors])

  return (
    <form onSubmit={handleSubmit(v => onSubmit(v as unknown as PatientInput))} className="space-y-6">
      {Object.keys(errors).length > 0 && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-300">
          <p className="font-bold mb-1">Please correct the following errors before registering:</p>
          <ul className="list-disc pl-4 space-y-0.5">
            {Object.entries(errors).map(([field, err]) => {
              const label = FIELD_LABELS[field] || field
              return (
                <li key={field}>
                  <strong>{label}</strong>: {err?.message || 'Invalid value'}
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {/* ── Section: Registry Enrollment ───────────────────────────── */}
      <div>
        <p className="section-heading flex items-center gap-1.5 text-blue-400">
          Registry Enrollment
        </p>
        <div className="bg-blue-500/5 p-4 rounded-xl border border-blue-500/10">
          <FieldWrap label="Target Registry Enrollment">
            <Select {...register('registryId')}>
              <option value="">None / General Patient Profile</option>
              <option value="hf">Heart Failure Registry</option>
              <option value="acs">ACS & Coronary Registry</option>
              <option value="arrhythmia">Arrhythmia & EP Registry</option>
              <option value="structural">Structural Heart Disease Registry</option>
              <option value="cathlab">Cath Lab & Interventional Registry</option>
              <option value="preventive">Preventive Cardiology Registry</option>
            </Select>
          </FieldWrap>
        </div>
      </div>

      {/* ── Section: Study Inclusion Checklist ───────────────────────── */}
      {registryId === 'hf' && (
        <div className="space-y-4">
          <div>
            <p className="section-heading flex items-center gap-1.5 text-blue-400">
              Heart Failure Registry Inclusion Checklist
            </p>
            <div className="grid grid-cols-2 gap-4 bg-blue-500/5 p-4 rounded-xl border border-blue-500/10">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input type="checkbox" {...register('indianCitizen')} className="w-4 h-4 rounded text-blue-500 bg-gray-900 border-gray-700" />
                <span className="text-sm font-semibold text-white">Indian Citizen (Inclusion A4)</span>
              </label>
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input type="checkbox" {...register('studyConsented')} className="w-4 h-4 rounded text-blue-500 bg-gray-900 border-gray-700" />
                <span className="text-sm font-semibold text-white">Study Consent Obtained (Inclusion A5)</span>
              </label>
            </div>
          </div>

          <div>
            <p className="section-heading flex items-center gap-1.5 text-blue-400">
              Heart Failure Registry Exclusion Criteria (None must be present)
            </p>
            <div className="space-y-4 bg-blue-500/5 p-4 rounded-xl border border-blue-500/10 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input type="checkbox" {...register('excludeActiveTrial')} className="w-4 h-4 rounded text-rose-500 bg-gray-900 border-gray-700" />
                  <span className="text-sm font-semibold text-white">Active Investigational Trial Participation</span>
                </label>
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input type="checkbox" {...register('excludeTerminalIllness')} className="w-4 h-4 rounded text-rose-500 bg-gray-900 border-gray-700" />
                  <span className="text-sm font-semibold text-white">Terminal Non-CV Illness (&lt;6mo life expectancy)</span>
                </label>
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input type="checkbox" {...register('excludeNonCompliance')} className="w-4 h-4 rounded text-rose-500 bg-gray-900 border-gray-700" />
                  <span className="text-sm font-semibold text-white">Inability to comply with follow-up</span>
                </label>
              </div>
              <div className="border-t border-gray-800 pt-3">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input type="checkbox" {...register('exclusionReviewed')} className="w-4 h-4 rounded text-emerald-500 bg-gray-900 border-gray-700 mt-0.5" />
                  <div>
                    <span className="text-sm font-bold text-white">GCP Exclusion Review Confirmation</span>
                    <p className="text-gray-400 mt-0.5">I confirm that exclusion criteria have been reviewed and none are present for this patient.</p>
                  </div>
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Section: Personal ─────────────────────────────────────── */}
      <div>
        <p className="section-heading">Personal Information</p>
        <div className="grid grid-cols-2 gap-4">
          <FieldWrap label="First Name" required error={errors.firstName?.message}>
            <Input {...register('firstName')} placeholder="First name" error={!!errors.firstName} />
          </FieldWrap>
          <FieldWrap label="Last Name" required error={errors.lastName?.message}>
            <Input {...register('lastName')} placeholder="Last name" error={!!errors.lastName} />
          </FieldWrap>
          <FieldWrap label="Date of Birth" required error={errors.dob?.message}>
            <Input type="date" {...register('dob')} error={!!errors.dob} />
          </FieldWrap>
          <FieldWrap label="Sex" required error={errors.sex?.message}>
            <Select {...register('sex')} error={!!errors.sex}>
              <option value="">Select</option>
              <option>Male</option>
              <option>Female</option>
            </Select>
          </FieldWrap>
          {registryId === 'hf' && (
            <>
              <FieldWrap label="Date of Confirmation of HF">
                <Input type="date" {...register('hfConfirmationDate')} />
              </FieldWrap>
              <FieldWrap label="Total Years of Education Completed" hint="Zero for illiterate">
                <Input type="number" {...register('educationYears')} />
              </FieldWrap>
            </>
          )}
        </div>
      </div>

      {/* ── Section: Contact & ID ─────────────────────────────────── */}
      <div>
        <p className="section-heading">Contact & Identification</p>
        <div className="grid grid-cols-2 gap-4">
          <FieldWrap label="Hospital Identification Number (HID)">
            <Input {...register('mrn')} placeholder="HID-XXXXXX" />
          </FieldWrap>
          <FieldWrap label="Status" error={errors.status?.message}>
            <Select {...register('status')} error={!!errors.status}>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
              <option value="Pending">Pending</option>
            </Select>
          </FieldWrap>
          <FieldWrap label="Consent Status" error={errors.consentStatus?.message}>
            <Select {...register('consentStatus')} error={!!errors.consentStatus}>
              <option value="Pending">Pending</option>
              <option value="Granted">Granted</option>
              <option value="Revoked">Revoked</option>
              <option value="Declined">Declined</option>
            </Select>
          </FieldWrap>

          {consentStatus === 'Granted' && (
            <div className="col-span-2 grid grid-cols-3 gap-4 bg-emerald-500/5 p-4 rounded-xl border border-emerald-500/10">
              <FieldWrap label="Consent Version" required error={errors.consentVersion?.message}>
                <Input {...register('consentVersion')} placeholder="e.g. v1.2" />
              </FieldWrap>
              <FieldWrap label="Consent Date" required error={errors.consentDate?.message}>
                <Input type="date" {...register('consentDate')} />
              </FieldWrap>
              <FieldWrap label="Consent Witness / Co-signer" error={errors.consentWitness?.message}>
                <Input {...register('consentWitness')} placeholder="Witness name" />
              </FieldWrap>
            </div>
          )}

          {consentStatus === 'Revoked' && (
            <div className="col-span-2 grid grid-cols-2 gap-4 bg-rose-500/5 p-4 rounded-xl border border-rose-500/10">
              <FieldWrap label="Withdrawal Date" required error={errors.consentWithdrawalDate?.message}>
                <Input type="date" {...register('consentWithdrawalDate')} />
              </FieldWrap>
              <FieldWrap label="Withdrawal Reason" error={errors.consentWithdrawalReason?.message}>
                <Input {...register('consentWithdrawalReason')} placeholder="Reason for withdrawing consent" />
              </FieldWrap>
            </div>
          )}

          {registryId === 'hf' && (
            <div className="col-span-2 bg-blue-500/5 p-4 rounded-xl border border-blue-500/10 space-y-3">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input type="checkbox" {...register('reConsentNeeded')} className="w-4 h-4 rounded text-blue-500 bg-gray-900 border-gray-700" />
                <span className="text-sm font-semibold text-white">Re-consent Tracking Required</span>
              </label>
              {reConsentNeeded && (
                <div className="w-1/2">
                  <FieldWrap label="Re-consent Date">
                    <Input type="date" {...register('reConsentDate')} />
                  </FieldWrap>
                </div>
              )}
            </div>
          )}
          <FieldWrap label="Index Date (Enrollment / HF Diagnosis)">
            <Input type="date" {...register('indexDate')} />
          </FieldWrap>
          <FieldWrap label="Primary Contact Number">
            <Input {...register('contact')} placeholder="+91 9876543210" />
          </FieldWrap>
          <FieldWrap label="Secondary Contact Number">
            <Input {...register('secondaryContact')} placeholder="+91 XXXXX XXXXX" />
          </FieldWrap>
          <FieldWrap label="Email Address" error={errors.email?.message}>
            <Input {...register('email')} placeholder="email@example.com" error={!!errors.email} />
          </FieldWrap>
          <FieldWrap label="ABHA ID" hint="Personally Identifiable Information (PII)">
            <Input {...register('abhaId')} placeholder="XX-XXXX-XXXX-XXXX" />
          </FieldWrap>
          <FieldWrap label="Occupation">
            <Input {...register('occupation')} placeholder="e.g. Farmer, School Teacher" />
          </FieldWrap>
          <FieldWrap label="Caregiver Phone Number">
            <Input {...register('caregiverContact')} placeholder="+91 XXXXX XXXXX" />
          </FieldWrap>
          <FieldWrap label="Caregiver Secondary Phone">
            <Input {...register('caregiverSecondaryContact')} placeholder="+91 XXXXX XXXXX" />
          </FieldWrap>
          <FieldWrap label="Address (General / Backup)" className="col-span-2">
            <Textarea {...register('address')} placeholder="Full address" />
          </FieldWrap>
        </div>

        <p className="section-heading mt-4">Registry Geographic Address</p>
        <div className="grid grid-cols-2 gap-4">
          <FieldWrap label="House/Flat Name or No">
            <Input {...register('addressHouse')} placeholder="e.g. Flat 3A" />
          </FieldWrap>
          <FieldWrap label="Street / Locality / Sector">
            <Input {...register('addressStreet')} placeholder="e.g. J.M. Road" />
          </FieldWrap>
          <FieldWrap label="Post Office">
            <Input {...register('addressPost')} placeholder="e.g. Deccan" />
          </FieldWrap>
          <FieldWrap label="District">
            <Input {...register('addressDistrict')} placeholder="e.g. Pune" />
          </FieldWrap>
          <FieldWrap label="State / UT">
            <Input {...register('addressState')} placeholder="e.g. Maharashtra" />
          </FieldWrap>
          <FieldWrap label="PIN Code">
            <Input {...register('addressPin')} placeholder="e.g. 411004" />
          </FieldWrap>
        </div>
      </div>

      {/* ── Section: Medical background ───────────────────────────── */}
      <div>
        <p className="section-heading">Medical Background</p>
        <div className="grid grid-cols-1 gap-4">
          <FieldWrap label="Comorbidities">
            <Controller
              name="comorbidities"
              control={control}
              render={({ field }) => (
                <CheckChipGroup
                  options={COMORBIDITIES_LIST}
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />
          </FieldWrap>
          <FieldWrap label="Known Drug Allergies">
            <Textarea {...register('allergies')} placeholder="e.g. Penicillin, Aspirin" />
          </FieldWrap>
          {registryId === 'hf' && (
            <div className="space-y-4 border-t border-gray-800/40 pt-4">
              <p className="text-xs font-bold text-blue-400 uppercase tracking-wider">Index Diagnosis Etiology</p>
              <Controller
                name="indexEtiology"
                control={control}
                render={({ field }) => (
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
                    value={field.value || []}
                    onChange={field.onChange}
                  />
                )}
              />
              <div className="mt-2">
                <FieldWrap label="Other Index Etiology (specify)">
                  <Input {...register('indexEtiologyOther')} placeholder="Specify" />
                </FieldWrap>
              </div>
            </div>
          )}
          <div className="border-t border-gray-800/40 pt-4">
            <p className="text-xs font-bold text-blue-400 mb-3 uppercase tracking-wider">Family History Checklist</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="flex items-center gap-3 cursor-pointer p-2.5 bg-gray-900/30 hover:bg-gray-900/60 border border-blue-500/5 rounded-lg transition-colors">
                <input type="checkbox" {...register('familyHistoryPrematureCVD')} className="w-4 h-4 rounded bg-gray-900 border-blue-500/30 text-blue-500" />
                <div>
                  <span className="text-sm font-semibold text-white">Premature CV Disease</span>
                  <p className="text-[10px] text-gray-500 mt-0.5">Family history of premature cardiovascular disease</p>
                </div>
              </label>
              <label className="flex items-center gap-3 cursor-pointer p-2.5 bg-gray-900/30 hover:bg-gray-900/60 border border-blue-500/5 rounded-lg transition-colors">
                <input type="checkbox" {...register('familyHistorySuddenDeath')} className="w-4 h-4 rounded bg-gray-900 border-blue-500/30 text-blue-500" />
                <div>
                  <span className="text-sm font-semibold text-white">Sudden Cardiac Death</span>
                  <p className="text-[10px] text-gray-500 mt-0.5">Family history of sudden unexplained cardiac death</p>
                </div>
              </label>
              <label className="flex items-center gap-3 cursor-pointer p-2.5 bg-gray-900/30 hover:bg-gray-900/60 border border-blue-500/5 rounded-lg transition-colors">
                <input type="checkbox" {...register('familyHistoryCardiomyopathy')} className="w-4 h-4 rounded bg-gray-900 border-blue-500/30 text-blue-500" />
                <div>
                  <span className="text-sm font-semibold text-white">Cardiomyopathy</span>
                  <p className="text-[10px] text-gray-500 mt-0.5">Family history of dilated, hypertrophic, or restrictive cardiomyopathy</p>
                </div>
              </label>
              <label className="flex items-center gap-3 cursor-pointer p-2.5 bg-gray-900/30 hover:bg-gray-900/60 border border-blue-500/5 rounded-lg transition-colors">
                <input type="checkbox" {...register('familyHistoryGeneticHeart')} className="w-4 h-4 rounded bg-gray-900 border-blue-500/30 text-blue-500" />
                <div>
                  <span className="text-sm font-semibold text-white">Genetic Heart Disease</span>
                  <p className="text-[10px] text-gray-500 mt-0.5">Family history of channelopathies, Marfan syndrome, or genetic conditions</p>
                </div>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* ── Section: Mortality / Vital Status ─────────────────────── */}
      <div>
        <p className="section-heading">Mortality &amp; Vital Status</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FieldWrap label="Vital Status">
            <Select {...register('vitalStatus')}>
              <option value="">Not recorded</option>
              <option value="Alive">Alive</option>
              <option value="Dead">Dead</option>
            </Select>
          </FieldWrap>
          <FieldWrap label="Date of Death">
            <Input type="date" {...register('dateOfDeath')} />
          </FieldWrap>
          <FieldWrap label="Cause of Death Category">
            <Select {...register('deathCauseCategory')}>
              <option value="">Not applicable</option>
              <option value="Cardiovascular">Cardiovascular</option>
              <option value="Non-cardiovascular">Non-cardiovascular</option>
              <option value="Unknown">Unknown</option>
            </Select>
          </FieldWrap>
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <Button type="submit" loading={loading} size="lg">
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}
