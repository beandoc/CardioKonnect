'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Database, CheckCircle, RefreshCw, ArrowRight, Lock } from 'lucide-react'
import Button from '@/components/ui/Button'
import { toast } from 'sonner'
import * as XLSX from 'xlsx'
import { parseExcelRows } from '@/lib/excelParser'
import { validateImport, importPatients } from '@/lib/firestoreSeed'
import { useAppUser } from '@/context/AppUserContext'

const IMPORT_ROLES = ['SuperAdmin', 'RegistryOwner']

export default function SeederPage() {
  const { currentUser } = useAppUser()
  const [loading, setLoading] = useState(false)
  const [seeded, setSeeded] = useState(false)
  const [seedMsg, setSeedMsg] = useState('')
  const [progress, setProgress] = useState<string[]>([])

  const canImport = !!currentUser && IMPORT_ROLES.includes(currentUser.role) && currentUser.registryAccess.includes('hf')

  const addProgress = (msg: string) => setProgress(prev => [...prev, msg])

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !currentUser || !canImport) return

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

      addProgress(`Parsed ${rows.length} rows. Validating…`)
      const { patients, visits } = parseExcelRows(rows)
      const { errors, duplicates, toImport } = await validateImport(patients, visits)

      if (errors.length > 0) {
        errors.slice(0, 20).forEach(err => addProgress(`✗ ${err}`))
        throw new Error(`Validation failed with ${errors.length} error(s). Nothing was written.`)
      }
      if (duplicates.length > 0) {
        addProgress(`Skipping ${duplicates.length} patient(s) already in the registry (matched by MRN, or name + DOB).`)
      }
      if (toImport.length === 0) {
        addProgress('No new patients to import.')
        return
      }

      if (!confirm(`Add ${toImport.length} new patient(s) to the ${currentUser.siteId} HF registry? Existing records are not modified.`)) {
        addProgress('Import cancelled.')
        return
      }

      const importIds = new Set(toImport.map(p => p.id))
      const { patientsWritten, visitsWritten } = await importPatients(
        toImport,
        visits.filter(v => importIds.has(v.patientId)),
        { siteId: currentUser.siteId, registryId: 'hf' },
        addProgress
      )

      const msg = `Added ${patientsWritten} patients and ${visitsWritten} visits from ${file.name}`
      setSeeded(true)
      setSeedMsg(msg)
      toast.success(msg)
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Error importing Excel file.')
      addProgress(`Error: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

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

            {canImport ? (
              <div className="space-y-3">
                <p className="text-xs text-gray-400">
                  Upload <strong>HF.xlsx</strong> to add patient records to your site&apos;s HF registry.
                  Every row is validated first; patients already in the registry are skipped and existing records are never modified.
                </p>

                <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-blue-500/25 hover:border-blue-500/50 rounded-xl cursor-pointer hover:bg-blue-500/[0.02] transition duration-200">
                  <div className="flex flex-col items-center justify-center text-center px-3">
                    <Database className="w-5 h-5 text-blue-400 mb-1" />
                    <p className="text-[10px] text-gray-300 font-semibold">Click to browse or drag HF.xlsx</p>
                    <p className="text-[9px] text-gray-500 mt-0.5">Append-only import — nothing is deleted</p>
                  </div>
                  <input
                    type="file"
                    className="hidden"
                    accept=".xlsx,.xls"
                    onChange={handleFileUpload}
                    disabled={loading}
                  />
                </label>

                {loading && (
                  <div className="flex items-center gap-2 text-xs text-blue-400">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Importing to Firestore…
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-start gap-2 text-xs text-gray-400">
                <Lock className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                Bulk import is restricted to HF registry owners.
              </div>
            )}
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

      </div>
    </div>
  )
}
