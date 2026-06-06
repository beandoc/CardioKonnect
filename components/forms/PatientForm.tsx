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
  status:         z.enum(['Active', 'Inactive', 'Pending']).optional(),
  consentStatus:  z.enum(['Granted', 'Revoked', 'Pending', 'Declined']).default('Pending'),
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
  aadhaarNo:      z.string().optional(),
  addressHouse:   z.string().optional(),
  addressStreet:  z.string().optional(),
  addressPost:    z.string().optional(),
  addressDistrict:z.string().optional(),
  addressState:   z.string().optional(),
  addressPin:     z.string().optional(),
  secondaryContact: z.string().optional(),
  caregiverContact: z.string().optional(),
  caregiverSecondaryContact: z.string().optional(),

  // Mortality / vital status
  vitalStatus: z.enum(['Alive', 'Dead']).optional(),
  dateOfDeath: z.string().optional(),
  deathCauseCategory: z.enum(['Cardiovascular', 'Non-cardiovascular', 'Unknown']).optional(),
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
  { value: 'AF', label: 'Atrial Fibrillation' }
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
}

export default function PatientForm({ defaultValues, onSubmit, loading, submitLabel = 'Save Patient' }: Props) {
  // Parse incoming legacy comorbidities (string) to array if present
  const parsedDefaultValues = {
    status: 'Active',
    consentStatus: 'Pending',
    indianCitizen: true,
    studyConsented: true,
    educationYears: 0,
    registryId: '',
    ...defaultValues,
    comorbidities: typeof defaultValues?.comorbidities === 'string'
      ? (defaultValues.comorbidities as string).split(',').map(s => s.trim()).filter(Boolean)
      : (defaultValues?.comorbidities || [])
  } as FormValues

  const { register, handleSubmit, control, watch, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: parsedDefaultValues,
  })

  const registryId = watch('registryId')

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
          <FieldWrap label="AADHAAR Card Number" hint="Personally Identifiable Information (PII)">
            <Input {...register('aadhaarNo')} placeholder="XXXX-XXXX-XXXX" />
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
