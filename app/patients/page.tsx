'use client'
import { useState, useMemo, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Users, Search, PlusCircle, UserX, Activity, Database } from 'lucide-react'
import Button from '@/components/ui/Button'
import { cn, formatDate, initials, nyhaBadgeColor, hfTypeBadgeColor, lvefColor, fullName } from '@/lib/utils'
import { getPatients, updatePatient } from '@/lib/firestore'
import type { Patient } from '@/lib/types'
import { toast } from 'sonner'
import { useAppUser } from '@/context/AppUserContext'
import { filterPatientsByAccess } from '@/lib/accessControl'

function PatientList() {
  const { currentUser } = useAppUser()
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

  const accessiblePatients = useMemo(() => {
    return filterPatientsByAccess(currentUser, patients)
  }, [currentUser, patients])

  const filtered = useMemo(() => {
    return accessiblePatients.filter(p => {
      const name = fullName(p).toLowerCase()
      const email = (p.email || '').toLowerCase()
      const matchSearch = name.includes(search.toLowerCase()) || email.includes(search.toLowerCase())
      const matchStatus = statusFilter === 'All' || (p.status || 'Active') === statusFilter
      return matchSearch && matchStatus
    })
  }, [accessiblePatients, search, statusFilter])

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
            Showing <span className="text-white font-semibold">{filtered.length}</span> of <span className="text-white font-semibold">{accessiblePatients.length}</span> accessible patients
            {currentUser?.siteId === 'KANPUR_APEX' && (
              <span className="text-amber-400 font-medium ml-1.5">· Kanpur Cardiac Apex Hospital</span>
            )}
          </p>
        </div>
        <Link href="/patients/new" className="w-full sm:w-auto">
          <Button className="w-full sm:w-auto"><PlusCircle className="w-4 h-4" /> Add Patient</Button>
        </Link>
      </div>

      {accessiblePatients.length === 0 ? (
        <div className="glass-card p-8 flex flex-col items-center justify-center text-center py-16">
          <Database className="w-16 h-16 mb-4 text-amber-500/40 animate-pulse" />
          <h3 className="text-lg font-bold text-white">No Patients Found in Your Registry Scope</h3>
          <p className="text-sm text-gray-400 mt-2 max-w-md mx-auto">
            You are viewing the registry for {currentUser?.name || 'Dr. Rajeev Chauhan'} ({currentUser?.siteId === 'KANPUR_APEX' ? 'Kanpur Cardiac Apex Hospital' : 'AICTS Pune'}).
          </p>
          <div className="flex gap-4 mt-6">
            <Link href="/patients/new">
              <Button className="flex items-center gap-1.5"><PlusCircle className="w-4 h-4" /> Add New Registry Patient</Button>
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
                placeholder="Search by name, MRN, or facility..."
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
                    <th>Registry / Track</th>
                    <th>Clinical Presentation</th>
                    <th>LVEF / Echo</th>
                    <th>Status</th>
                    <th>Last Encounter</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center">
                        <UserX className="w-10 h-10 text-gray-500 mx-auto mb-2" />
                        <p className="text-gray-400 text-sm font-semibold">No matching patients found</p>
                      </td>
                    </tr>
                  ) : (
                    filtered.map((p, i) => {
                      const status = p.status || 'Active'
                      const isCathLab = p.registryId === 'cathlab' || p.siteId === 'KANPUR_APEX' || p.mrn?.startsWith('7AFH')
                      return (
                        <tr key={p.id} className={cn(status === 'Inactive' && 'opacity-50')}>
                          <td className="font-mono text-xs text-gray-500">{i + 1}</td>
                          <td>
                            <div className="flex items-center gap-3">
                              <div
                                className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm flex-shrink-0"
                                style={{
                                  background: isCathLab
                                    ? 'linear-gradient(135deg, #f59e0b, #d97706)'
                                    : 'linear-gradient(135deg, #3b82f6, #8b5cf6)'
                                }}
                              >
                                {initials(p.firstName, p.lastName)}
                              </div>
                              <div>
                                <Link href={`/patients/${p.id}`} className="font-semibold text-white hover:text-blue-400 hover:underline transition-all">
                                  {fullName(p)}
                                </Link>
                                <div className="flex items-center gap-1.5 text-[11px] text-gray-400 font-mono">
                                  <span>{p.mrn || 'MRN: —'}</span>
                                  {p.addressState && (
                                    <>
                                      <span>·</span>
                                      <span className="text-gray-400 font-sans">{p.addressDistrict || p.addressState}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td>
                            {isCathLab ? (
                              <span className="badge badge-amber text-[10px] uppercase font-bold">
                                Cath Lab & PCI
                              </span>
                            ) : (
                              <span className={cn(
                                "badge text-[10px] font-bold",
                                p.hfType ? hfTypeBadgeColor(p.hfType) : 'badge-blue'
                              )}>
                                {p.hfType ? `HF · ${p.hfType}` : 'Heart Failure'}
                              </span>
                            )}
                          </td>
                          <td>
                            {isCathLab ? (
                              <span className="badge badge-rose text-[10px] font-medium">
                                {p.comorbidCAD ? 'CAD / STEMI Candidate' : 'PCI Interventional'}
                              </span>
                            ) : (
                              <span className={cn(
                                "badge text-[10px]",
                                p.nyha ? nyhaBadgeColor(p.nyha) : 'badge-gray'
                              )}>
                                {p.nyha ? `NYHA Class ${p.nyha}` : 'Class II'}
                              </span>
                            )}
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
                          <td className="text-gray-300 text-xs">{p.lastVisitDate ? formatDate(p.lastVisitDate) : p.createdAt ? formatDate(p.createdAt) : '—'}</td>
                          <td>
                            <div className="flex justify-end gap-2">
                              <Link href={`/patients/${p.id}`}>
                                <Button variant="outline" size="sm">
                                  View Record
                                </Button>
                              </Link>
                              <Button variant="outline" size="sm" onClick={() => toggleStatus(p.id, p.status)}>
                                Toggle
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
