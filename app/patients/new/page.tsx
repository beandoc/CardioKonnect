'use client'
import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { addPatient } from '@/lib/firestore'
import { generateMRN } from '@/lib/utils'
import type { PatientInput } from '@/lib/types'
import PatientForm from '@/components/forms/PatientForm'
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card'
import { toast } from 'sonner'
import { Activity } from 'lucide-react'

function NewPatientFormContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const registryId = searchParams.get('registry') || ''
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (data: PatientInput) => {
    setLoading(true)
    const toastId = toast.loading('Registering new patient...')

    const timeoutId = setTimeout(() => {
      toast.warning('Database response is taking longer than expected. Please check your internet or security rules.', {
        id: toastId,
        duration: 8000,
      })
    }, 5000)

    try {
      const id = await addPatient({ ...data, mrn: data.mrn || generateMRN() })
      clearTimeout(timeoutId)
      toast.success('Patient added successfully', { id: toastId })
      router.push(`/patients/${id}`)
    } catch (e) {
      clearTimeout(timeoutId)
      console.error('Patient registration error:', e)
      toast.error('Failed to save patient. Please check database configuration/security rules.', { id: toastId })
    } finally {
      setLoading(false)
    }
  }

  return (
    <PatientForm defaultValues={{ registryId }} onSubmit={handleSubmit} loading={loading} submitLabel="Register Patient" />
  )
}

export default function NewPatientPage() {
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
          <Suspense fallback={
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <Activity className="w-6 h-6 text-blue-500 animate-spin" />
              <p className="text-sm text-gray-400">Loading form...</p>
            </div>
          }>
            <NewPatientFormContent />
          </Suspense>
        </CardBody>
      </Card>
    </div>
  )
}
