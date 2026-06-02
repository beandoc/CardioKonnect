'use client'
import { useState, useMemo } from 'react'
import { Shield, Search, PlusCircle, UserCheck, Check } from 'lucide-react'
import Button from '@/components/ui/Button'
import { cn } from '@/lib/utils'

interface ProviderRow {
  id: string
  name: string
  email: string
  role: string
  status: 'Active' | 'Inactive'
  addedOn: string
}

const INITIAL_PROVIDERS: ProviderRow[] = [
  { id: '1', name: 'Dr. A. Jayachandra', email: 'jayachandra.a@aicts.in', role: 'RegistryOwner', status: 'Active', addedOn: '01/01/2026' },
  { id: '2', name: 'Dr. Srinivas Murthy', email: 's.murthy@aicts.in', role: 'Provider', status: 'Active', addedOn: '15/02/2026' },
  { id: '3', name: 'Dr. K. Raghavan', email: 'k.raghavan@aicts.in', role: 'Provider', status: 'Active', addedOn: '10/03/2026' }
]

export default function HealthcareProvidersPage() {
  const [providers, setProviders] = useState<ProviderRow[]>(INITIAL_PROVIDERS)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')

  const filtered = useMemo(() => {
    return providers.filter(p => {
      const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.email.toLowerCase().includes(search.toLowerCase())
      const matchStatus = statusFilter === 'All' || p.status === statusFilter
      return matchSearch && matchStatus
    })
  }, [providers, search, statusFilter])

  const toggleStatus = (id: string) => {
    setProviders(prev => prev.map(p => p.id === id ? { ...p, status: p.status === 'Active' ? 'Inactive' : 'Active' } : p))
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Shield className="w-5 h-5 text-blue-400" />
            <h2 className="text-xl font-bold text-white">Registry Healthcare Providers</h2>
          </div>
          <p className="text-sm text-gray-400">
            Showing <span className="text-white font-semibold">{filtered.length}</span> of <span className="text-white font-semibold">{providers.length}</span> healthcare providers
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="glass-card p-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            className="search-input w-full pl-9"
            placeholder="Search healthcare providers..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          className="form-input form-select w-40"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
        >
          <option value="All">All Statuses</option>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
        </select>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="registry-table">
            <thead>
              <tr>
                <th className="w-12">#</th>
                <th>Healthcare Provider</th>
                <th>Role</th>
                <th>Status</th>
                <th>Added On</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center">
                    <Shield className="w-10 h-10 text-gray-500 mx-auto mb-2" />
                    <p className="text-gray-400 text-sm font-semibold">No healthcare providers found</p>
                  </td>
                </tr>
              ) : (
                filtered.map((p, i) => (
                  <tr key={p.id} className={cn(p.status === 'Inactive' && 'opacity-50')}>
                    <td className="font-mono text-xs text-gray-500">{i + 1}</td>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-violet-600/20 border border-violet-500/30 text-violet-300 flex items-center justify-center text-xs font-semibold">
                          {p.name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div>
                          <p className="font-medium text-white">{p.name}</p>
                          <p className="text-xs text-gray-400">{p.email}</p>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-violet text-[10px]">{p.role}</span>
                    </td>
                    <td>
                      <span className={p.status === 'Active' ? 'status-active' : 'status-inactive'}>
                        {p.status}
                      </span>
                    </td>
                    <td className="text-gray-300 text-xs">{p.addedOn}</td>
                    <td>
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => toggleStatus(p.id)}>
                          Toggle Status
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
