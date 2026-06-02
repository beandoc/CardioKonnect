'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { addPatient } from '@/lib/firestore'
import { generateMRN } from '@/lib/utils'
import type { PatientInput } from '@/lib/types'
import PatientForm from '@/components/forms/PatientForm'
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card'
import { toast } from 'sonner'

export default function NewPatientPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (data: PatientInput) => {
    setLoading(true)
    try {
      const id = await addPatient({ ...data, mrn: data.mrn || generateMRN() })
      toast.success('Patient added successfully')
      router.push(`/patients/${id}`)
    } catch (e) {
      console.error(e)
      toast.error('Failed to save patient')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900">Register New Patient</h2>
        <p className="text-sm text-gray-500 mt-0.5">Enter patient demographic information. Clinical data is captured per visit.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Patient Demographics</CardTitle>
        </CardHeader>
        <CardBody>
          <PatientForm onSubmit={handleSubmit} loading={loading} submitLabel="Register Patient" />
        </CardBody>
      </Card>
    </div>
  )
}
