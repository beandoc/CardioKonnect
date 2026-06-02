'use client'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { FieldWrap, Input, Select, Textarea } from '@/components/ui/FormField'
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
  address:        z.string().optional(),
  comorbidities:  z.string().optional(),
  allergies:      z.string().optional(),
})

type FormValues = z.infer<typeof schema>

interface Props {
  defaultValues?: Partial<PatientInput>
  onSubmit: (data: PatientInput) => Promise<void>
  loading?: boolean
  submitLabel?: string
}

export default function PatientForm({ defaultValues, onSubmit, loading, submitLabel = 'Save Patient' }: Props) {
  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      status: 'Active',
      ...defaultValues
    } as FormValues,
  })

  return (
    <form onSubmit={handleSubmit(v => onSubmit(v as PatientInput))} className="space-y-6">
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
        <div className="grid grid-cols-2 gap-4">
          <FieldWrap label="Comorbidities" hint="e.g. DM Type 2, HTN, CKD">
            <Textarea {...register('comorbidities')} placeholder="List comorbidities" />
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
