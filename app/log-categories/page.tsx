'use client'
import { useState, useMemo } from 'react'
import { ClipboardList, Search, PlusCircle, CheckCircle, Eye, EyeOff } from 'lucide-react'
import Button from '@/components/ui/Button'
import { cn } from '@/lib/utils'

interface LogType {
  id: string
  code: string
  description: string
  status: 'Active' | 'Inactive'
  usage: string
}

const INITIAL_LOG_TYPES: LogType[] = [
  { id: '8', code: 'Auth_Login', description: 'User Login', status: 'Active', usage: '98 logs' },
  { id: '10', code: 'Auth_Login_Role', description: 'Role assigned to User on Login for session', status: 'Active', usage: '98 logs' },
  { id: '9', code: 'Auth_Logout', description: 'User Logout', status: 'Active', usage: '85 logs' }
]

export default function EventLogCategoriesPage() {
  const [types, setTypes] = useState<LogType[]>(INITIAL_LOG_TYPES)
  const [search, setSearch] = useState('')
  const [showInactive, setShowInactive] = useState(false)

  const filtered = useMemo(() => {
    return types.filter(t => {
      const q = search.toLowerCase()
      const matchSearch = t.code.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)
      const matchStatus = showInactive || t.status === 'Active'
      return matchSearch && matchStatus
    })
  }, [types, search, showInactive])

  const toggleStatus = (id: string) => {
    setTypes(prev => prev.map(t => t.id === id ? { ...t, status: t.status === 'Active' ? 'Inactive' : 'Active' } : t))
  }

  const activeCount = types.filter(t => t.status === 'Active').length
  const inactiveCount = types.filter(t => t.status === 'Inactive').length

  return (
    <div className="space-y-5 animate-fade-in text-gray-300">
      
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ClipboardList className="w-5 h-5 text-blue-400" />
            <h2 className="text-xl font-bold text-white">Event Log Types</h2>
          </div>
          <p className="text-sm text-gray-400">Manage event log types and operational schemas</p>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="kpi-card blue">
          <p className="text-[10px] uppercase tracking-wider text-gray-400">Total Types</p>
          <p className="text-2xl font-bold text-white mt-1">10</p>
        </div>
        <div className="kpi-card emerald">
          <p className="text-[10px] uppercase tracking-wider text-gray-400">Active</p>
          <p className="text-2xl font-bold text-white mt-1">{activeCount}</p>
        </div>
        <div className="kpi-card rose">
          <p className="text-[10px] uppercase tracking-wider text-gray-400">Inactive</p>
          <p className="text-2xl font-bold text-white mt-1">{inactiveCount}</p>
        </div>
        <div className="kpi-card violet">
          <p className="text-[10px] uppercase tracking-wider text-gray-400">In Use</p>
          <p className="text-2xl font-bold text-white mt-1">6</p>
        </div>
      </div>

      {/* Filters */}
      <div className="glass-card p-4 flex flex-wrap gap-4 items-center justify-between">
        <div className="relative flex-1 min-w-[280px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            className="search-input w-full pl-9"
            placeholder="Search types by code or description..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <label className="flex items-center gap-2 cursor-pointer text-xs">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={e => setShowInactive(e.target.checked)}
            className="w-4 h-4 rounded border-blue-500/25 bg-navy-950"
          />
          <span>Show Inactive Types</span>
        </label>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto text-xs">
          <table className="registry-table">
            <thead>
              <tr>
                <th className="w-12">ID</th>
                <th>Type Code</th>
                <th>Description</th>
                <th>Status</th>
                <th>Usage</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-500">
                    No log types found.
                  </td>
                </tr>
              ) : (
                filtered.map(t => (
                  <tr key={t.id} className={cn(t.status === 'Inactive' && 'opacity-50')}>
                    <td className="font-mono text-gray-500">#{t.id}</td>
                    <td className="font-mono font-semibold text-white">{t.code}</td>
                    <td className="text-gray-300 font-medium">{t.description}</td>
                    <td>
                      <span className={t.status === 'Active' ? 'status-active' : 'status-inactive'}>
                        {t.status}
                      </span>
                    </td>
                    <td className="text-gray-400 font-mono">{t.usage}</td>
                    <td>
                      <div className="flex justify-end gap-1">
                        <Button variant="outline" size="sm" className="btn-sm flex items-center gap-1" onClick={() => toggleStatus(t.id)}>
                          {t.status === 'Active' ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          Toggle
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
