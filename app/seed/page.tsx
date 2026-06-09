'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Database, Trash2, CheckCircle, RefreshCw, ArrowRight } from 'lucide-react'
import Button from '@/components/ui/Button'
import { toast } from 'sonner'
import * as XLSX from 'xlsx'
import { parseExcelRows } from '@/lib/excelParser'
import { seedFirestore, clearFirestorePatients } from '@/lib/firestoreSeed'

export default function SeederPage() {
  const [loading, setLoading] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [seeded, setSeeded] = useState(false)
  const [seedMsg, setSeedMsg] = useState('')
  const [progress, setProgress] = useState<string[]>([])

  const addProgress = (msg: string) => setProgress(prev => [...prev, msg])

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setLoading(true)
    setSeeded(false)
    setProgress([])

    try {
      addProgress(`Reading ${file.name}…`)
      const data = await file.arrayBuffer()
      const wb = XLSX.read(data, { type: 'array', cellDates: true })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json<any>(ws)

      if (rows.length === 0) throw new Error('No rows found in the uploaded Excel file.')

      addProgress(`Parsed ${rows.length} rows. Converting to patient records…`)
      const { patients, visits, patientsCount } = parseExcelRows(rows)

      addProgress('Clearing existing Firestore data…')
      await clearFirestorePatients(addProgress)

      addProgress('Writing to Firestore…')
      const { patientsWritten, visitsWritten } = await seedFirestore(patients, visits, addProgress)

      const msg = `Seeded ${patientsWritten} patients and ${visitsWritten} visits from ${file.name}`
      setSeeded(true)
      setSeedMsg(msg)
      toast.success(`Imported ${patientsCount} patients successfully!`)
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Error seeding from Excel file.')
      addProgress(`Error: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleClear = async () => {
    if (!confirm('Clear ALL patient data from Firestore? This cannot be undone.')) return
    setClearing(true)
    setProgress([])
    try {
      await clearFirestorePatients(addProgress)
      toast.success('All patient data cleared from Firestore.')
      setSeeded(false)
    } catch (e: any) {
      console.error(e)
      toast.error(e.message || 'Failed to clear Firestore data.')
      addProgress(`Error: ${e.message}`)
    } finally {
      setClearing(false)
    }
  }

  const patientsList = [
    { name: 'LAKHAN SINGH',    mrn: 'MRN-1001', location: 'KASOLI',  phenotype: 'HFrEF', visits: 2, status: 'Completed (with 3m follow-up)' },
    { name: 'WANNI DEVI',      mrn: 'MRN-1002', location: 'MAONDA',  phenotype: 'HFrEF', visits: 1, status: 'Inpatient stay only' },
    { name: 'PARA DEVI',       mrn: 'MRN-1003', location: 'JASRASAR',phenotype: 'HFrEF', visits: 1, status: 'Inpatient stay only' },
    { name: 'ALAM ALI KHAN',   mrn: 'MRN-1004', location: 'NAGAUR',  phenotype: 'HFrEF', visits: 2, status: 'Completed (with 3m follow-up)' },
    { name: 'JHARAM KURI',     mrn: 'MRN-1005', location: 'SIKAR',   phenotype: 'HFrEF', visits: 2, status: 'Completed (with 3m follow-up)' },
    { name: 'ROSHAN ALI GORI', mrn: 'MRN-1006', location: 'SIKAR',   phenotype: 'HFrEF', visits: 1, status: 'Inpatient stay only' },
    { name: 'CHAND KANWAR',    mrn: 'MRN-1007', location: 'JAIPUR',  phenotype: 'HFrEF', visits: 2, status: 'Completed (with 3m follow-up)' },
    { name: 'KISHOR SINGH',    mrn: 'MRN-1008', location: 'JAIPUR',  phenotype: 'HFrEF', visits: 2, status: 'Completed (with 3m follow-up)' },
    { name: 'NAVI RAM',        mrn: 'MRN-1009', location: 'DILWARA', phenotype: 'HFrEF', visits: 1, status: 'Inpatient stay only' },
    { name: 'J ROY',           mrn: 'MRN-1010', location: 'SIKAR',   phenotype: 'HFrEF', visits: 2, status: 'Completed (with 3m follow-up)' },
  ]

  return (
    <div className="max-w-4xl mx-auto space-y-6 text-gray-300 py-6 animate-fade-in">

      {/* Header */}
      <div className="accent-card p-6 flex flex-col md:flex-row items-center md:items-start justify-between gap-6">
        <div className="flex flex-col md:flex-row items-center gap-5 text-center md:text-left">
          <div className="w-16 h-16 rounded-2xl bg-blue-600/10 border border-blue-500/20 text-blue-400 flex items-center justify-center flex-shrink-0">
            <Database className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white mb-1">Database Seeder Panel</h2>
            <p className="text-sm text-gray-400">Upload HF.xlsx to write real patient data directly into Firebase Firestore</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Controls */}
        <div className="space-y-6">
          <div className="glass-card p-5 space-y-4">
            <h3 className="text-sm font-semibold text-white pb-3 border-b border-blue-500/10">Seeder Actions</h3>

            <div className="space-y-3">
              <p className="text-xs text-gray-400">
                Upload <strong>HF.xlsx</strong> to import patient records into Firestore.
                Data becomes available to every device immediately — no localStorage involved.
              </p>

              <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-blue-500/25 hover:border-blue-500/50 rounded-xl cursor-pointer hover:bg-blue-500/[0.02] transition duration-200">
                <div className="flex flex-col items-center justify-center text-center px-3">
                  <Database className="w-5 h-5 text-blue-400 mb-1" />
                  <p className="text-[10px] text-gray-300 font-semibold">Click to browse or drag HF.xlsx</p>
                  <p className="text-[9px] text-gray-500 mt-0.5">Clears existing Firestore data, then writes new records</p>
                </div>
                <input
                  type="file"
                  className="hidden"
                  accept=".xlsx,.xls"
                  onChange={handleFileUpload}
                  disabled={loading || clearing}
                />
              </label>

              {loading && (
                <div className="flex items-center gap-2 text-xs text-blue-400">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Seeding to Firestore…
                </div>
              )}

              <Button
                onClick={handleClear}
                disabled={loading || clearing}
                variant="outline"
                className="w-full justify-center gap-2 border-red-500/20 text-red-400 hover:bg-red-500/10 hover:border-red-500/30 text-xs py-1.5"
              >
                {clearing ? (
                  <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Clearing…</>
                ) : (
                  <><Trash2 className="w-3.5 h-3.5" /> Clear Firestore Data</>
                )}
              </Button>
            </div>
          </div>

          {/* Progress log */}
          {progress.length > 0 && (
            <div className="glass-card p-4 space-y-1">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Progress</p>
              {progress.map((msg, i) => (
                <p key={i} className="text-[10px] text-gray-300 font-mono leading-relaxed">{msg}</p>
              ))}
            </div>
          )}

          {/* Success */}
          {seeded && (
            <div className="glass-card p-5 border-emerald-500/30 bg-emerald-950/10 space-y-4">
              <div className="flex items-center gap-2 text-emerald-400">
                <CheckCircle className="w-5 h-5" />
                <h4 className="font-semibold text-sm">Seeding Complete!</h4>
              </div>
              <p className="text-xs text-gray-400">{seedMsg}</p>
              <div className="flex flex-col gap-2 pt-2">
                <Link href="/patients" className="w-full">
                  <Button className="w-full justify-center gap-2">
                    View Patients <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
                <Link href="/" className="w-full">
                  <Button variant="outline" className="w-full justify-center">Go to Dashboard</Button>
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Cohort preview */}
        <div className="lg:col-span-2 space-y-4">
          <div className="glass-card p-5 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-white">Cohort Demographic Preview</h3>
              <p className="text-xs text-gray-400 mt-1">
                First 10 real patient records from HF.xlsx that will be imported:
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="registry-table w-full text-xs">
                <thead>
                  <tr>
                    <th>Patient</th>
                    <th>MRN</th>
                    <th>Region</th>
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
                      <td><span className="badge badge-red text-[10px] font-bold">{p.phenotype}</span></td>
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
