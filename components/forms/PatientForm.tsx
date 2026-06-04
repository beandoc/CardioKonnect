'use client'
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
  sex:            z.enum(['Male', 'Female', 'Other'], { errorMap: () => ({ message: 'Required' }) }),
  mrn:            z.string().optional(),
  contact:        z.string().optional(),
  email:          z.string().email('Invalid email').or(z.literal('')).optional(),
  status:         z.enum(['Active', 'Inactive', 'Pending']).optional(),
  consentStatus:  z.enum(['Granted', 'Revoked', 'Pending', 'Declined']).default('Pending'),
  address:        z.string().optional(),
  comorbidities:  z.array(z.string()).default([]),
  allergies:      z.string().optional(),
  indexDate:      z.string().optional(),
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

export default function PatientForm({ defaultValues, onSubmit, loading, submitLabel = 'Save Patient' }: Props) {
  // Parse incoming legacy comorbidities (string) to array if present
  const parsedDefaultValues = {
    status: 'Active',
    consentStatus: 'Pending',
    ...defaultValues,
    comorbidities: typeof defaultValues?.comorbidities === 'string'
      ? (defaultValues.comorbidities as string).split(',').map(s => s.trim()).filter(Boolean)
      : (defaultValues?.comorbidities || [])
  } as FormValues

  const { register, handleSubmit, control, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: parsedDefaultValues,
  })

  return (
    <form onSubmit={handleSubmit(v => onSubmit(v as unknown as PatientInput))} className="space-y-6">
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
              <option>Other</option>
            </Select>
          </FieldWrap>
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
          <FieldWrap label="Contact Number">
            <Input {...register('contact')} placeholder="+91 9876543210" />
          </FieldWrap>
          <FieldWrap label="Email Address" error={errors.email?.message}>
            <Input {...register('email')} placeholder="email@example.com" error={!!errors.email} />
          </FieldWrap>
          <FieldWrap label="Address" className="col-span-2">
            <Textarea {...register('address')} placeholder="Full address" />
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

      <div className="flex justify-end pt-2">
        <Button type="submit" loading={loading} size="lg">
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}
