'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { addVisit, getLatestVisit } from '@/lib/firestore'
import type { VisitInput, Visit } from '@/lib/types'
import VisitForm from '@/components/forms/VisitForm'
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { toast } from 'sonner'
import { FlaskConical, Calendar, ArrowRight, ArrowLeft } from 'lucide-react'

export default function NewVisitPage() {
  const { id: patientId } = useParams<{ id: string }>()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [initialData, setInitialData] = useState<Partial<VisitInput> | undefined>(undefined)
  const [fetching, setFetching] = useState(true)
  const [savedVisitId, setSavedVisitId] = useState<string | null>(null)

  useEffect(() => {
    async function loadPreviousVisit() {
      try {
        const lastVisit = await getLatestVisit(patientId)
        if (lastVisit) {
          // Pre-populate with previous visit values, omitting identifiers and specific dates
          const { id, createdAt, visitDate, echoDate, followupDate, ...rest } = lastVisit
          setInitialData({
            ...rest,
            visitDate: new Date().toISOString().split('T')[0],
          } as Partial<VisitInput>)
          toast.success('Auto-populated fields from previous visit')
        }
      } catch (err) {
        console.error('Failed to retrieve previous visit:', err)
      } finally {
        setFetching(false)
      }
    }
    loadPreviousVisit()
  }, [patientId])

  const handleSubmit = async (data: VisitInput) => {
    setLoading(true)
    try {
      const visitId = await addVisit(patientId, { ...data, patientId })
      toast.success('Visit recorded successfully')
      setSavedVisitId(visitId)
    } catch (e) {
      console.error(e)
      toast.error('Failed to save visit')
    } finally {
      setLoading(false)
    }
  }

  if (fetching) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-400">
        <div className="w-8 h-8 text-blue-500 animate-spin border-2 border-blue-500 border-t-transparent rounded-full" />
        <p>Loading previous clinical visit data...</p>
      </div>
    )
  }

  // Next steps guided actions panel
  if (savedVisitId) {
    return (
      <div className="max-w-2xl mx-auto space-y-6 text-gray-300 mt-6 animate-fade-in">
        <div className="accent-card p-6 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto text-2xl font-bold">
            ✓
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Visit Saved Successfully</h2>
            <p className="text-sm text-gray-400 mt-1">
              Encounters and longitudinal values are recorded in the registry database.
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Guided Clinical Actions</CardTitle>
            <p className="text-xs text-gray-500 mt-1">What would you like to perform next for this patient?</p>
          </CardHeader>
          <CardBody className="space-y-4">
            
            {/* Action 1: Run Risk Calculator */}
            <div 
              onClick={() => router.push(`/risk?patientId=${patientId}&visitId=${savedVisitId}`)}
              className="p-4 bg-violet-500/5 hover:bg-violet-500/10 border border-violet-500/10 hover:border-violet-500/25 rounded-xl cursor-pointer flex items-center justify-between transition-all group"
            >
              <div className="flex gap-4 items-center">
                <div className="w-10 h-10 rounded-lg bg-violet-500/10 border border-violet-500/20 text-violet-400 flex items-center justify-center">
                  <FlaskConical className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white group-hover:text-violet-300">Run Prognostic Risk Calculations</p>
                  <p className="text-xs text-gray-500">Estimate mortality, event rates, and write score to visit</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-gray-500 group-hover:translate-x-1 transition-transform" />
            </div>

            {/* Action 2: Schedule Follow-up */}
            <div 
              onClick={() => router.push('/appointments')}
              className="p-4 bg-blue-500/5 hover:bg-blue-500/10 border border-blue-500/10 hover:border-blue-500/25 rounded-xl cursor-pointer flex items-center justify-between transition-all group"
            >
              <div className="flex gap-4 items-center">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white group-hover:text-blue-300">Schedule Appointments / Consents</p>
                  <p className="text-xs text-gray-500">Book clinical visits or monitor patient consent lists</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-gray-500 group-hover:translate-x-1 transition-transform" />
            </div>

            {/* Action 3: Back to Patient Detail */}
            <div className="flex justify-center pt-4">
              <Button variant="outline" onClick={() => router.push(`/patients/${patientId}`)}>
                <ArrowLeft className="w-4 h-4" /> Back to Patient Profile
              </Button>
            </div>

          </CardBody>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-4xl text-gray-300">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-white">Record Clinical Visit</h2>
        <p className="text-sm text-gray-400 mt-0.5">Capture all clinical, investigation, and medication data for this encounter.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Visit Data Entry</CardTitle>
          <p className="text-xs text-gray-500">Only visit date and type are required. Progress is saved locally automatically.</p>
        </CardHeader>
        <CardBody>
          <VisitForm onSubmit={handleSubmit} loading={loading} defaultValues={initialData} patientId={patientId} />
        </CardBody>
      </Card>
    </div>
  )
}
