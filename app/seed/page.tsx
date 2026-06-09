'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Database, Trash2, CheckCircle, RefreshCw, AlertTriangle, ArrowRight } from 'lucide-react'
import Button from '@/components/ui/Button'
import Link from 'next/link'
import { toast } from 'sonner'

import { isDemoMode } from '@/lib/firestore'

export default function SeederPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [seeded, setSeeded] = useState(false)
  const [seedMsg, setSeedMsg] = useState('')

  const handleSeed = async () => {
    setLoading(true)
    setSeeded(false)
    try {
      const res = await fetch('/api/seed')
      const result = await res.json()
      if (result.success) {
        // Always save to localStorage — API parses Excel and returns JSON (no Firestore writes)
        if (result.patients) {
          localStorage.setItem('cardio_patients', JSON.stringify(result.patients))
        }
        if (result.visits) {
          localStorage.setItem('cardio_visits', JSON.stringify(result.visits))
        }
        setSeeded(true)
        setSeedMsg(result.message || 'Database seeded successfully!')
        toast.success(result.message || 'Database seeded successfully!')
      } else {
        throw new Error(result.error || 'Failed to seed')
      }
    } catch (e: any) {
      console.error(e)
      toast.error(e.message || 'Failed to seed database. Check browser console.')
    } finally {
      setLoading(false)
    }
  }

  const handleClear = async () => {
    if (!confirm('Are you sure you want to clear all local patient data? This will remove all patients and visits from your local registry.')) return
    setClearing(true)
    setSeeded(false)
    try {
      const res = await fetch('/api/clear')
      const result = await res.json()
      if (result.success) {
        // Always clear localStorage
        localStorage.setItem('cardio_patients', JSON.stringify([]))
        localStorage.setItem('cardio_visits', JSON.stringify([]))
        toast.success('Registry data cleared successfully!')
      } else {
        throw new Error(result.error || 'Failed to clear database.')
      }
    } catch (e: any) {
      console.error(e)
      toast.error(e.message || 'Failed to clear database.')
    } finally {
      setClearing(false)
    }
  }

  const patientsList = [
    { name: 'LAKHAN SINGH', mrn: 'MRN-1001', location: 'KASOLI', phenotype: 'HFrEF', visits: 2, status: 'Completed (with 3m follow-up)' },
    { name: 'WANNI DEVI', mrn: 'MRN-1002', location: 'MAONDA', phenotype: 'HFrEF', visits: 1, status: 'Inpatient stay only' },
    { name: 'PARA DEVI', mrn: 'MRN-1003', location: 'JASRASAR', phenotype: 'HFrEF', visits: 1, status: 'Inpatient stay only' },
    { name: 'ALAM ALI KHAN', mrn: 'MRN-1004', location: 'NAGAUR', phenotype: 'HFrEF', visits: 2, status: 'Completed (with 3m follow-up)' },
    { name: 'JHARAM KURI', mrn: 'MRN-1005', location: 'SIKAR', phenotype: 'HFrEF', visits: 2, status: 'Completed (with 3m follow-up)' },
    { name: 'ROSHAN ALI GORI', mrn: 'MRN-1006', location: 'SIKAR', phenotype: 'HFrEF', visits: 1, status: 'Inpatient stay only' },
    { name: 'CHAND KANWAR', mrn: 'MRN-1007', location: 'JAIPUR', phenotype: 'HFrEF', visits: 2, status: 'Completed (with 3m follow-up)' },
    { name: 'KISHOR SINGH', mrn: 'MRN-1008', location: 'JAIPUR', phenotype: 'HFrEF', visits: 2, status: 'Completed (with 3m follow-up)' },
    { name: 'NAVI RAM', mrn: 'MRN-1009', location: 'DILWARA', phenotype: 'HFrEF', visits: 1, status: 'Inpatient stay only' },
    { name: 'J ROY', mrn: 'MRN-1010', location: 'SIKAR', phenotype: 'HFrEF', visits: 2, status: 'Completed (with 3m follow-up)' },
  ]

  return (
    <div className="max-w-4xl mx-auto space-y-6 text-gray-300 py-6 animate-fade-in">
      
      {/* Header banner */}
      <div className="accent-card p-6 flex flex-col md:flex-row items-center md:items-start justify-between gap-6">
        <div className="flex flex-col md:flex-row items-center gap-5 text-center md:text-left">
          <div className="w-16 h-16 rounded-2xl bg-blue-600/10 border border-blue-500/20 text-blue-400 text-2xl font-bold flex items-center justify-center flex-shrink-0">
            <Database className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white mb-1">Database Seeder Panel</h2>
            <p className="text-sm text-gray-400">Initialize and manage real clinical Heart Failure Registry data</p>
          </div>
        </div>
      </div>
 
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left column: Controls */}
        <div className="space-y-6">
          <div className="glass-card p-5 space-y-4">
            <h3 className="text-sm font-semibold text-white pb-3 border-b border-blue-500/10 flex items-center gap-2">
              Seeder Actions
            </h3>
            
            <div className="space-y-3">
              <p className="text-xs text-gray-400">
                Seeding will reset the database and import patient records from the Excel source sheet <strong>HF.xlsx</strong>, mapping demographics, lab values, ECG, grip strength tests, and comorbidities.
              </p>

              
              <Button 
                onClick={handleSeed} 
                disabled={loading || clearing} 
                className="w-full justify-center gap-2 bg-blue-600 hover:bg-blue-500"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> Seeding Database...
                  </>
                ) : (
                  <>
                    <Database className="w-4 h-4" /> Clear & Seed Data
                  </>
                )}
              </Button>

              <Button 
                onClick={handleClear} 
                disabled={loading || clearing} 
                variant="outline"
                className="w-full justify-center gap-2 border-red-500/30 text-red-400 hover:bg-red-500/10 hover:border-red-500/50"
              >
                {clearing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> Clearing...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" /> Clear All Patients
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Success card */}
          {seeded && (
            <div className="glass-card p-5 border-emerald-500/30 bg-emerald-950/10 space-y-4">
              <div className="flex items-center gap-2 text-emerald-400">
                <CheckCircle className="w-5 h-5" />
                <h4 className="font-semibold text-sm">Seeding Complete!</h4>
              </div>
              <p className="text-xs text-gray-400">
                {seedMsg || 'The database is now populated with real patient registry data.'}
              </p>
              <div className="flex flex-col gap-2 pt-2">
                <Link href="/patients" className="w-full">
                  <Button className="w-full justify-center gap-2">
                    View Patients List <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
                <Link href="/" className="w-full">
                  <Button variant="outline" className="w-full justify-center">
                    Go to Dashboard
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Right column: Patients list preview */}
        <div className="lg:col-span-2 space-y-4">
          <div className="glass-card p-5 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-white">Cohort Demographic Preview</h3>
              <p className="text-xs text-gray-400 mt-1">
                Preview of the first 10 real patient records from the Excel source spreadsheet (HF.xlsx) to be mapped to the Heart Failure Registry:
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="registry-table w-full text-xs">
                <thead>
                  <tr>
                    <th>Patient</th>
                    <th>MRN</th>
                    <th>Region / Location</th>
                    <th>Phenotype</th>
                    <th>Visits</th>
                    <th className="text-right">Encounters</th>
                  </tr>
                </thead>
                <tbody>
                  {patientsList.map((p, i) => (
                    <tr key={i}>
                      <td className="font-semibold text-white">{p.name}</td>
                      <td className="font-mono text-gray-400">{p.mrn}</td>
                      <td className="text-gray-300">{p.location}</td>
                      <td>
                        <span className="badge badge-red text-[10px] font-bold">
                          {p.phenotype}
                        </span>
                      </td>
                      <td className="text-gray-400">{p.status}</td>
                      <td className="text-right font-semibold text-white">{p.visits}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
