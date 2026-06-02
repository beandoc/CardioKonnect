'use client'
import { useState, useMemo } from 'react'
import { ShieldAlert, Search, PlusCircle, CheckCircle, Clock } from 'lucide-react'
import Button from '@/components/ui/Button'
import { cn } from '@/lib/utils'

interface Consent {
  id: string
  patient: string
  consent: string
  facility: string
  provider: string
  status: 'Granted' | 'Revoked' | 'Pending'
  created: string
  expiry: string
}

const INITIAL_CONSENTS: Consent[] = [
  {
    id: '35',
    patient: 'Daya Ghadge',
    consent: 'Consent to share Coronary interventions related data for Research Purposes',
    facility: 'AICTS Pune',
    provider: 'Dr. A. Jayachandra',
    status: 'Granted',
    created: 'Feb 04, 2026',
    expiry: 'Feb 04, 2029'
  }
]

export default function ConsentsPage() {
  const [consents, setConsents] = useState<Consent[]>(INITIAL_CONSENTS)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [expiryFilter, setExpiryFilter] = useState('All')
  const [categoryFilter, setCategoryFilter] = useState('All')

  const filtered = useMemo(() => {
    return consents.filter(c => {
      const q = search.toLowerCase()
      const matchSearch = c.patient.toLowerCase().includes(q) || c.consent.toLowerCase().includes(q)
      const matchStatus = statusFilter === 'All' || c.status === statusFilter
      return matchSearch && matchStatus
    })
  }, [consents, search, statusFilter])

  return (
    <div className="space-y-5 animate-fade-in text-gray-300">
      
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShieldAlert className="w-5 h-5 text-blue-400" />
            <h2 className="text-xl font-bold text-white">Registry Consents</h2>
          </div>
          <p className="text-sm text-gray-400">
            Showing <span className="text-white font-semibold">{filtered.length}</span> of <span className="text-white font-semibold">{consents.length}</span> patient consents
          </p>
        </div>
        <Button><PlusCircle className="w-4 h-4" /> Add Consent</Button>
      </div>

      {/* Filter panel */}
      <div className="glass-card p-4 flex flex-wrap gap-4 items-center">
        
        {/* Search */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            className="search-input w-full pl-9"
            placeholder="Search patient consents..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Filters */}
        <div className="flex gap-2 flex-wrap items-center">
          
          <select
            className="form-input form-select w-40 text-xs py-2"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >
            <option value="All">Status: All</option>
            <option value="Granted">Granted</option>
            <option value="Revoked">Revoked</option>
            <option value="Pending">Pending</option>
          </select>

          <select
            className="form-input form-select w-40 text-xs py-2"
            value={expiryFilter}
            onChange={e => setExpiryFilter(e.target.value)}
          >
            <option value="All">Expiry Status</option>
            <option value="Active">Active</option>
            <option value="Expired">Expired</option>
          </select>

          <select
            className="form-input form-select w-44 text-xs py-2"
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
          >
            <option value="All">Consent Category</option>
            <option value="Research">Research Purposes</option>
            <option value="Clinical">Clinical Treatment</option>
          </select>

        </div>
      </div>

      {/* Consents table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto text-xs font-sans">
          <table className="registry-table">
            <thead>
              <tr>
                <th className="w-12">ID</th>
                <th>Patient</th>
                <th>Consent</th>
                <th>Facility</th>
                <th>Provider</th>
                <th>Status</th>
                <th>Created</th>
                <th>Expiry</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-gray-500">
                    No consents found.
                  </td>
                </tr>
              ) : (
                filtered.map(c => (
                  <tr key={c.id}>
                    <td className="font-mono text-xs text-gray-500">{c.id}</td>
                    <td className="font-semibold text-white">{c.patient}</td>
                    <td className="text-gray-300 max-w-xs whitespace-normal">{c.consent}</td>
                    <td className="text-gray-400">{c.facility || '—'}</td>
                    <td className="text-gray-300 font-semibold">{c.provider}</td>
                    <td>
                      <span className={cn(
                        "badge text-[10px]",
                        c.status === 'Granted' && 'badge-green',
                        c.status === 'Revoked' && 'badge-red',
                        c.status === 'Pending' && 'badge-amber'
                      )}>
                        {c.status}
                      </span>
                    </td>
                    <td className="text-gray-400 font-mono">{c.created}</td>
                    <td className="text-gray-400 font-mono">{c.expiry}</td>
                    <td>
                      <div className="flex justify-end gap-1">
                        <Button variant="outline" size="sm" className="btn-sm">
                          Details
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
