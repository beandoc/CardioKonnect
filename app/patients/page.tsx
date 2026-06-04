'use client'
import { useState, useMemo, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Users, Search, PlusCircle, UserX, Activity, Database } from 'lucide-react'
import Button from '@/components/ui/Button'
import { cn, formatDate, initials, nyhaBadgeColor, hfTypeBadgeColor, lvefColor } from '@/lib/utils'
import { getPatients, updatePatient } from '@/lib/firestore'
import { seedDemoData } from '@/lib/seeder'
import type { Patient } from '@/lib/types'
import { toast } from 'sonner'

function PatientList() {
  const searchParams = useSearchParams()
  const searchQuery = searchParams.get('search') || ''

  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')

  useEffect(() => {
    if (searchQuery) {
      setSearch(searchQuery)
    }
  }, [searchQuery])

  const loadPatientsData = async () => {
    setLoading(true)
    try {
      const data = await getPatients()
      setPatients(data)
    } catch (err) {
      console.error(err)
      toast.error('Failed to load patients from database')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPatientsData()
  }, [])

  const filtered = useMemo(() => {
    return patients.filter(p => {
      const name = `${p.firstName} ${p.lastName}`.toLowerCase()
      const email = (p.email || '').toLowerCase()
      const matchSearch = name.includes(search.toLowerCase()) || email.includes(search.toLowerCase())
      const matchStatus = statusFilter === 'All' || (p.status || 'Active') === statusFilter
      return matchSearch && matchStatus
    })
  }, [patients, search, statusFilter])

  const toggleStatus = async (id: string, currentStatus?: 'Active' | 'Inactive' | 'Pending') => {
    const nextStatus = currentStatus === 'Inactive' ? 'Active' : 'Inactive'
    try {
      await updatePatient(id, { status: nextStatus })
      setPatients(prev => prev.map(p => p.id === id ? { ...p, status: nextStatus } : p))
      toast.success('Patient status updated')
    } catch (err) {
      console.error(err)
      toast.error('Failed to update status')
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Activity className="w-8 h-8 text-blue-500 animate-spin" />
        <p className="text-sm text-gray-400">Loading patients...</p>
      </div>
    )
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-5 h-5 text-blue-400" />
            <h2 className="text-xl font-bold text-white">Registry Patients</h2>
          </div>
          <p className="text-sm text-gray-400">
            Showing <span className="text-white font-semibold">{filtered.length}</span> of <span className="text-white font-semibold">{patients.length}</span> patients
          </p>
        </div>
        <Link href="/patients/new" className="w-full sm:w-auto">
          <Button className="w-full sm:w-auto"><PlusCircle className="w-4 h-4" /> Add Patient</Button>
        </Link>
      </div>

      {patients.length === 0 ? (
        <div className="glass-card p-8 flex flex-col items-center justify-center text-center py-16">
          <Database className="w-16 h-16 mb-4 text-blue-500/40 animate-pulse" />
          <h3 className="text-lg font-bold text-white">No Patients in Registry Yet</h3>
          <p className="text-sm text-gray-400 mt-2 max-w-md mx-auto">
            You don't have any patients registered in Cardio-Konnect yet. You can register a new patient manually.
          </p>

          <div className="flex gap-4 mt-6">
            <Link href="/patients/new">
              <Button className="flex items-center gap-1.5"><PlusCircle className="w-4 h-4" /> Add Patient</Button>
            </Link>
          </div>
        </div>
      ) : (
        <>
          {/* Filters */}
          <div className="glass-card p-4 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                className="search-input w-full pl-9"
                placeholder="Search by name or email"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <select
              className="form-input form-select w-full sm:w-40"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
            >
              <option value="All">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
              <option value="Pending">Pending</option>
            </select>
          </div>

          {/* Table */}
          <div className="glass-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="registry-table">
                <thead>
                  <tr>
                    <th className="w-12">#</th>
                    <th>Patient</th>
                    <th>HF Type</th>
                    <th>NYHA</th>
                    <th>LVEF</th>
                    <th>Status</th>
                    <th>Last Visit</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center">
                        <UserX className="w-10 h-10 text-gray-500 mx-auto mb-2" />
                        <p className="text-gray-400 text-sm font-semibold">No patients found</p>
                      </td>
                    </tr>
                  ) : (
                    filtered.map((p, i) => {
                      const status = p.status || 'Active'
                      return (
                        <tr key={p.id} className={cn(status === 'Inactive' && 'opacity-50')}>
                          <td className="font-mono text-xs text-gray-500">{i + 1}</td>
                          <td>
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-blue-600/20 border border-blue-500/30 text-blue-300 flex items-center justify-center text-xs font-semibold">
                                {initials(p.firstName, p.lastName)}
                              </div>
                              <div>
                                <Link href={`/patients/${p.id}`} className="font-medium text-white hover:text-blue-400 hover:underline transition-all">
                                  {p.firstName} {p.lastName}
                                </Link>
                                <p className="text-xs text-gray-400">{p.email || '—'}</p>
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className={cn(
                              "badge text-[10px]",
                              p.hfType ? hfTypeBadgeColor(p.hfType) : 'badge-gray'
                            )}>
                              {p.hfType || '—'}
                            </span>
                          </td>
                          <td>
                            <span className={cn(
                              "badge text-[10px]",
                              p.nyha ? nyhaBadgeColor(p.nyha) : 'badge-gray'
                            )}>
                              {p.nyha ? `Class ${p.nyha}` : '—'}
                            </span>
                          </td>
                          <td>
                            <span className="font-semibold text-xs" style={{ color: p.lvef ? lvefColor(p.lvef) : '#94a3b8' }}>
                              {p.lvef != null ? `${p.lvef}%` : '—'}
                            </span>
                          </td>
                          <td>
                            <span className={status === 'Active' ? 'status-active' : status === 'Pending' ? 'badge badge-amber' : 'status-inactive'}>
                              {status}
                            </span>
                          </td>
                          <td className="text-gray-300 text-xs">{p.lastVisitDate ? formatDate(p.lastVisitDate) : '—'}</td>
                          <td>
                            <div className="flex justify-end gap-2">
                              <Link href={`/patients/${p.id}`}>
                                <Button variant="outline" size="sm">
                                  View Profile
                                </Button>
                              </Link>
                              <Button variant="outline" size="sm" onClick={() => toggleStatus(p.id, p.status)}>
                                Toggle Status
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default function RegistryPatientsPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Activity className="w-8 h-8 text-blue-500 animate-spin" />
        <p className="text-sm text-gray-400">Loading patients...</p>
      </div>
    }>
      <PatientList />
    </Suspense>
  )
}
