'use client'
import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { addVisit } from '@/lib/firestore'
import type { VisitInput } from '@/lib/types'
import VisitForm from '@/components/forms/VisitForm'
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card'
import { toast } from 'sonner'

export default function NewVisitPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (data: VisitInput) => {
    setLoading(true)
    try {
      await addVisit(id, { ...data, patientId: id })
      toast.success('Visit recorded successfully')
      router.push(`/patients/${id}?tab=timeline`)
    } catch (e) {
      console.error(e)
      toast.error('Failed to save visit')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900">Record Clinical Visit</h2>
        <p className="text-sm text-gray-500 mt-0.5">Capture all clinical, investigation, and medication data for this encounter.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Visit Data Entry — 8 Sections</CardTitle>
          <p className="text-xs text-gray-400">Navigate tabs to complete all sections. Only visit date is required.</p>
        </CardHeader>
        <CardBody>
          <VisitForm onSubmit={handleSubmit} loading={loading} />
        </CardBody>
      </Card>
    </div>
  )
}
