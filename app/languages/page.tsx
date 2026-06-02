'use client'
import { useState, useMemo } from 'react'
import { Globe, Search, PlusCircle, Trash2, Edit2 } from 'lucide-react'
import Button from '@/components/ui/Button'
import { cn } from '@/lib/utils'

interface LanguageRow {
  id: string
  name: string
  patientsCount: number
}

const INITIAL_LANGUAGES: LanguageRow[] = [
  { id: '8', name: 'Bengali', patientsCount: 0 },
  { id: '1', name: 'English', patientsCount: 0 },
  { id: '4', name: 'Gujarati', patientsCount: 0 },
  { id: '3', name: 'Hindi', patientsCount: 0 },
  { id: '9', name: 'Kannada', patientsCount: 0 },
  { id: '5', name: 'Marathi', patientsCount: 0 },
  { id: '6', name: 'Tamil', patientsCount: 0 },
  { id: '7', name: 'Telugu', patientsCount: 0 },
]

export default function LanguageMasterPage() {
  const [languages, setLanguages] = useState<LanguageRow[]>(INITIAL_LANGUAGES)
  const [search, setSearch] = useState('')
  const [rowsPerPage, setRowsPerPage] = useState(10)

  const filtered = useMemo(() => {
    return languages.filter(l => 
      l.name.toLowerCase().includes(search.toLowerCase())
    )
  }, [languages, search])

  return (
    <div className="space-y-5 animate-fade-in text-gray-300">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Globe className="w-5 h-5 text-blue-400" />
            <h2 className="text-xl font-bold text-white">Language Master</h2>
          </div>
          <p className="text-sm text-gray-400">Manage patient interface and notification languages</p>
        </div>
        <Button>
          <PlusCircle className="w-4 h-4" /> Add Language
        </Button>
      </div>

      {/* Filters */}
      <div className="glass-card p-4 flex flex-wrap gap-4 items-center justify-between">
        <div className="relative flex-1 min-w-[280px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            className="search-input w-full pl-9"
            placeholder="Search languages..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto text-xs">
          <table className="registry-table">
            <thead>
              <tr>
                <th className="w-12">ID</th>
                <th>Language Name</th>
                <th>Patients Count</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-gray-500">
                    No languages found.
                  </td>
                </tr>
              ) : (
                filtered.map(l => (
                  <tr key={l.id}>
                    <td className="font-mono text-gray-500">#{l.id}</td>
                    <td className="text-white font-medium">{l.name}</td>
                    <td className="text-gray-300 font-mono">{l.patientsCount}</td>
                    <td>
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" className="btn-sm p-1.5">
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="outline" size="sm" className="btn-sm p-1.5 text-rose-400 hover:text-rose-300">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="px-4 py-3 flex items-center justify-end gap-4 text-xs text-gray-400 border-t border-blue-500/10">
          <div className="flex items-center gap-2">
            <span>Rows per page:</span>
            <select
              value={rowsPerPage}
              onChange={e => setRowsPerPage(Number(e.target.value))}
              className="form-select bg-transparent border border-blue-500/15 rounded px-2 py-1 text-xs"
              style={{ width: 'auto', backgroundImage: 'none', paddingRight: '0.75rem' }}
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </div>
          <div>
            1–{filtered.length} of {filtered.length}
          </div>
        </div>
      </div>
    </div>
  )
}
