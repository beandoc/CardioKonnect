'use client'
import { useState, useMemo } from 'react'
import { FileClock, Search, Calendar, Filter, FileSpreadsheet } from 'lucide-react'
import Button from '@/components/ui/Button'
import { cn } from '@/lib/utils'

interface LogRow {
  id: string
  type: string
  logUser: string
  userRole: string
  ipAddress: string
  registryName: string
  patient: string
  provider: string
  facility: string
  timestamp: string
  reason: string
  remarks: string
}

// Generate 58 dummy logs for the list
const GENERATED_LOGS: LogRow[] = [
  { id: '1', type: 'Consent Granted', logUser: 'Dr. Srinivas Murthy', userRole: 'Provider', ipAddress: '192.168.1.114', registryName: 'Heart Failure Registry', patient: 'Arjun Talpade', provider: 'Dr. Srinivas Murthy', facility: 'AICTS Pune', timestamp: '02/06/2026 10:14:11 AM', reason: 'Consent Obtained', remarks: 'Signed paper consent form received.' },
  { id: '2', type: 'Data Exported', logUser: 'Dr. A. Jayachandra', userRole: 'RegistryOwner', ipAddress: '192.168.1.102', registryName: 'Heart Failure Registry', patient: 'N/A', provider: 'Dr. A. Jayachandra', facility: 'AICTS Pune', timestamp: '02/06/2026 09:22:45 AM', reason: 'Cohort Study Analysis', remarks: 'Exported 10 records to Excel sheet.' },
  { id: '3', type: 'Record Created', logUser: 'Dr. K. Raghavan', userRole: 'Provider', ipAddress: '192.168.1.130', registryName: 'Heart Failure Registry', patient: 'Sunita Deshmukh', provider: 'Dr. K. Raghavan', facility: 'AICTS Pune', timestamp: '02/06/2026 08:05:12 AM', reason: 'Clinical Visit Form', remarks: 'Added baseline diagnostic findings.' },
  { id: '4', type: 'Consent Revoked', logUser: 'Dr. Srinivas Murthy', userRole: 'Provider', ipAddress: '192.168.1.114', registryName: 'Heart Failure Registry', patient: 'Priya Sharma', provider: 'Dr. Srinivas Murthy', facility: 'AICTS Pune', timestamp: '01/06/2026 04:30:00 PM', reason: 'Patient Withdrew', remarks: 'Patient requested withdrawal from registry.' },
  { id: '5', type: 'Record Updated', logUser: 'Dr. A. Jayachandra', userRole: 'RegistryOwner', ipAddress: '106.215.177.22', registryName: 'Heart Failure Registry', patient: 'Ramesh Kulkarni', provider: 'Dr. A. Jayachandra', facility: 'AICTS Pune', timestamp: '31/05/2026 02:15:30 PM', reason: 'Follow-up visit update', remarks: 'Updated LVEF metric values.' },
  { id: '6', type: 'Login Success', logUser: 'Dr. A. Jayachandra', userRole: 'RegistryOwner', ipAddress: '106.215.177.22', registryName: 'System Logs', patient: 'N/A', provider: 'N/A', facility: 'AICTS Pune', timestamp: '30/05/2026 09:12:00 AM', reason: 'User session started', remarks: 'Authenticated via 2FA' },
  { id: '7', type: 'Record Created', logUser: 'Dr. Srinivas Murthy', userRole: 'Provider', ipAddress: '192.168.1.114', registryName: 'Heart Failure Registry', patient: 'Vijay Mallya', provider: 'Dr. Srinivas Murthy', facility: 'AICTS Pune', timestamp: '29/05/2026 11:22:45 AM', reason: 'Clinical Visit Form', remarks: 'Created baseline record' },
  { id: '8', type: 'Consent Granted', logUser: 'Dr. K. Raghavan', userRole: 'Provider', ipAddress: '192.168.1.130', registryName: 'Heart Failure Registry', patient: 'Ananya Rao', provider: 'Dr. K. Raghavan', facility: 'AICTS Pune', timestamp: '28/05/2026 03:45:10 PM', reason: 'Standard Consent Process', remarks: 'Digital signature obtained' },
  { id: '9', type: 'Record Created', logUser: 'Dr. A. Jayachandra', userRole: 'RegistryOwner', ipAddress: '106.215.177.22', registryName: 'Heart Failure Registry', patient: 'Amitabh Bachchan', provider: 'Dr. A. Jayachandra', facility: 'AICTS Pune', timestamp: '28/05/2026 01:30:15 PM', reason: 'Baseline admission form', remarks: 'Baseline assessment complete' },
  { id: '10', type: 'Record Updated', logUser: 'Dr. Srinivas Murthy', userRole: 'Provider', ipAddress: '192.168.1.114', registryName: 'Heart Failure Registry', patient: 'Daya Ghadge', provider: 'Dr. Srinivas Murthy', facility: 'AICTS Pune', timestamp: '27/05/2026 04:10:05 PM', reason: 'Follow-up lab update', remarks: 'Updated NT-proBNP values.' }
]

// Add extra stubs to simulate the 58 counts
for (let i = 11; i <= 58; i++) {
  GENERATED_LOGS.push({
    id: `${i}`,
    type: i % 2 === 0 ? 'Record Updated' : 'Record Created',
    logUser: 'Dr. Srinivas Murthy',
    userRole: 'Provider',
    ipAddress: '192.168.1.114',
    registryName: 'Heart Failure Registry',
    patient: `Patient Stub ${i}`,
    provider: 'Dr. Srinivas Murthy',
    facility: 'AICTS Pune',
    timestamp: `25/05/2026 02:${i < 10 ? '0' + i : i}:00 PM`,
    reason: 'Routine Follow-up',
    remarks: 'Auto-saved system audit log.'
  })
}

export default function MyLogsPage() {
  const [logs, setLogs] = useState<LogRow[]>(GENERATED_LOGS)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('All')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [currentPage, setCurrentPage] = useState(1)

  const filtered = useMemo(() => {
    return logs.filter(log => {
      const q = search.toLowerCase()
      const matchSearch =
        log.remarks.toLowerCase().includes(q) ||
        log.patient.toLowerCase().includes(q) ||
        log.provider.toLowerCase().includes(q) ||
        log.type.toLowerCase().includes(q)

      const matchType = typeFilter === 'All' || log.type === typeFilter

      let matchDate = true
      if (startDate || endDate) {
        const parts = log.timestamp.split(' ')[0].split('/')
        const logDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]))
        if (startDate) {
          const start = new Date(startDate)
          if (logDate < start) matchDate = false
        }
        if (endDate) {
          const end = new Date(endDate)
          if (logDate > end) matchDate = false
        }
      }

      return matchSearch && matchType && matchDate
    })
  }, [logs, search, typeFilter, startDate, endDate])

  const paginated = useMemo(() => {
    const startIdx = (currentPage - 1) * rowsPerPage
    return filtered.slice(startIdx, startIdx + rowsPerPage)
  }, [filtered, currentPage, rowsPerPage])

  return (
    <div className="space-y-5 animate-fade-in text-gray-300">
      
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <FileClock className="w-5 h-5 text-blue-400" />
          <h2 className="text-xl font-bold text-white">My Logs</h2>
        </div>
        <p className="text-sm text-gray-400">Healthcare system event logs and activity monitoring</p>
      </div>

      {/* KPI Cards (matching spec counts) */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="kpi-card blue">
          <p className="text-[10px] uppercase tracking-wider text-gray-400">Total Logs</p>
          <p className="text-2xl font-bold text-white mt-1">10</p>
        </div>
        <div className="kpi-card emerald">
          <p className="text-[10px] uppercase tracking-wider text-gray-400">Active</p>
          <p className="text-2xl font-bold text-white mt-1">10</p>
        </div>
        <div className="kpi-card cyan">
          <p className="text-[10px] uppercase tracking-wider text-gray-400">Last 24h</p>
          <p className="text-2xl font-bold text-white mt-1">4</p>
        </div>
        <div className="kpi-card rose">
          <p className="text-[10px] uppercase tracking-wider text-gray-400">Inactive</p>
          <p className="text-2xl font-bold text-white mt-1">0</p>
        </div>
        <div className="kpi-card violet">
          <p className="text-[10px] uppercase tracking-wider text-gray-400">Last 7 days</p>
          <p className="text-2xl font-bold text-white mt-1">4</p>
        </div>
      </div>

      {/* Filter panel */}
      <div className="glass-card p-4 space-y-4">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              className="search-input w-full pl-9"
              placeholder="Search logs by remarks, patient, provider, or category..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            <select
              className="form-input form-select w-44"
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
            >
              <option value="All">Filter by Type</option>
              <option value="Consent Granted">Consent Granted</option>
              <option value="Consent Revoked">Consent Revoked</option>
              <option value="Record Created">Record Created</option>
              <option value="Record Updated">Record Updated</option>
              <option value="Data Exported">Data Exported</option>
            </select>

            <div className="flex items-center gap-1.5">
              <input
                type="date"
                className="form-input text-xs py-2 w-36"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
              />
              <span className="text-gray-500 text-xs">to</span>
              <input
                type="date"
                className="form-input text-xs py-2 w-36"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto font-sans text-xs">
          <table className="registry-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Log User</th>
                <th>User Role</th>
                <th>IP Address</th>
                <th>Registry Name</th>
                <th>Patient</th>
                <th>Provider</th>
                <th>Facility</th>
                <th>Timestamp</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-gray-400">
                    No matching logs found
                  </td>
                </tr>
              ) : (
                paginated.map(log => (
                  <tr key={log.id}>
                    <td>
                      <span className={cn(
                        "badge text-[10px]",
                        log.type.includes('Consent') && 'badge-green',
                        log.type.includes('Revoked') && 'badge-red',
                        log.type.includes('Created') && 'badge-blue',
                        log.type.includes('Exported') && 'badge-violet',
                        log.type.includes('Updated') && 'badge-amber'
                      )}>
                        {log.type}
                      </span>
                    </td>
                    <td className="font-semibold text-white">{log.logUser}</td>
                    <td className="text-gray-400">{log.userRole}</td>
                    <td className="font-mono text-gray-400">{log.ipAddress}</td>
                    <td className="text-gray-300">{log.registryName}</td>
                    <td className="text-white font-medium">{log.patient}</td>
                    <td className="text-gray-300">{log.provider}</td>
                    <td className="text-gray-400">{log.facility}</td>
                    <td className="text-gray-400 font-mono">{log.timestamp}</td>
                    <td className="text-gray-300">{log.reason}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer pagination (displays 1–10 of 58) */}
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderTop: '1px solid rgba(59, 130, 246, 0.08)' }}>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Rows per page:</span>
            <select
              className="form-input form-select text-xs py-1 px-2 w-16"
              value={rowsPerPage}
              onChange={e => {
                setRowsPerPage(parseInt(e.target.value))
                setCurrentPage(1)
              }}
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
            </select>
            <span className="text-xs text-gray-400">
              {Math.min(filtered.length, (currentPage - 1) * rowsPerPage + 1)}–
              {Math.min(filtered.length, currentPage * rowsPerPage)} of {filtered.length}
            </span>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            >
              Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage * rowsPerPage >= filtered.length}
              onClick={() => setCurrentPage(prev => prev + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
