'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { seedDemoData, clearAllPatients } from '@/lib/seeder'
import { Database, Trash2, CheckCircle, RefreshCw, AlertTriangle, ArrowRight } from 'lucide-react'
import Button from '@/components/ui/Button'
import Link from 'next/link'
import { toast } from 'sonner'

export default function SeederPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [seeded, setSeeded] = useState(false)

  const handleSeed = async () => {
    setLoading(true)
    setSeeded(false)
    try {
      await seedDemoData()
      setSeeded(true)
      toast.success('Database seeded successfully with 150 patients and clinical visits!')
    } catch (e) {
      console.error(e)
      toast.error('Failed to seed database. Check browser console.')
    } finally {
      setLoading(false)
    }
  }

  const handleClear = async () => {
    if (!confirm('Are you sure you want to delete ALL patients and visits from Firestore? This cannot be undone.')) return
    setClearing(true)
    setSeeded(false)
    try {
      await clearAllPatients()
      toast.success('Database cleared successfully!')
    } catch (e) {
      console.error(e)
      toast.error('Failed to clear database.')
    } finally {
      setClearing(false)
    }
  }

  const patientsList = [
    { name: 'Arjun Talpade', mrn: 'HID-784019', location: 'Kothrud, Pune', phenotype: 'HFrEF', visits: 3 },
    { name: 'Sunita Deshmukh', mrn: 'HID-201948', location: 'Shivajinagar, Pune', phenotype: 'HFpEF', visits: 2 },
    { name: 'Ramesh Kulkarni', mrn: 'HID-849102', location: 'Deccan Gymkhana, Pune', phenotype: 'HFrEF', visits: 2 },
    { name: 'Priya Sharma', mrn: 'HID-102948', location: 'Aundh, Pune', phenotype: 'HFmrEF', visits: 2 },
    { name: 'Vijay Mallya', mrn: 'HID-998822', location: 'Cuffe Parade, Mumbai', phenotype: 'HFrEF', visits: 2 },
    { name: 'Ananya Rao', mrn: 'HID-334455', location: 'Viman Nagar, Pune', phenotype: 'HFpEF', visits: 2 },
    { name: 'Amitabh Bachchan', mrn: 'HID-000777', location: 'Juhu, Mumbai', phenotype: 'HFrEF', visits: 2 },
    { name: 'Sanjay More', mrn: 'HID-554432', location: 'Dadar, Mumbai', phenotype: 'HFrEF', visits: 2 },
    { name: 'Lata Patwardhan', mrn: 'HID-887766', location: 'Dhantoli, Nagpur', phenotype: 'HFrEF', visits: 2 },
    { name: 'Rajesh Kumar', mrn: 'HID-674012', location: 'Kothrud, Pune', phenotype: 'HFrEF', visits: 2 },
    { name: 'Meera Nair', mrn: 'HID-590908', location: 'Powai, Mumbai', phenotype: 'HFpEF', visits: 2 },
    { name: 'Vikram Singh', mrn: 'HID-811115', location: 'Aundh, Pune', phenotype: 'HFrEF', visits: 2 },
    { name: 'Kavitha Krishnan', mrn: 'HID-540622', location: 'Dhantoli, Nagpur', phenotype: 'HFmrEF', visits: 2 },
    { name: 'Devendra Patel', mrn: 'HID-630214', location: 'Dadar, Mumbai', phenotype: 'HFrEF', visits: 2 },
    { name: 'Sneha Reddy', mrn: 'HID-720728', location: 'Viman Nagar, Pune', phenotype: 'HFpEF', visits: 2 },
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
            <p className="text-sm text-gray-400">Initialize and manage mock clinical registry data</p>
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
                Seeding will reset the mock patients database (IDs 1-150) and inject clean multi-encounter visit timelines, GDMT medications, labs, and vitals.
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
                The database is now populated. Go explore the dashboard, analytics, and patient lists.
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
                The following 150 dummy Maharashtra-region patients will be created, with visit records dated up to today (previewing the first 15):
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="registry-table w-full text-xs">
                <thead>
                  <tr>
                    <th>Patient</th>
                    <th>HID</th>
                    <th>Region / Location</th>
                    <th>Phenotype</th>
                    <th className="text-right">Visits</th>
                  </tr>
                </thead>
                <tbody>
                  {patientsList.map((p, i) => (
                    <tr key={i}>
                      <td className="font-semibold text-white">{p.name}</td>
                      <td className="font-mono text-gray-400">{p.mrn}</td>
                      <td className="text-gray-300">{p.location}</td>
                      <td>
                        <span className={`badge ${
                          p.phenotype === 'HFrEF' ? 'badge-red' : 
                          p.phenotype === 'HFpEF' ? 'badge-blue' : 'badge-amber'
                        } text-[10px] font-bold`}>
                          {p.phenotype}
                        </span>
                      </td>
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
