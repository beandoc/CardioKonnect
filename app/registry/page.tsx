'use client'
import { useEffect, useState } from 'react'
import {
  Database, Search, Plus, Trash2, Edit2, Filter,
  ChevronDown, CheckCircle, XCircle, Eye, EyeOff, ArrowUpDown, Activity
} from 'lucide-react'
import { toast } from 'sonner'
import type { FieldType, RegistryField } from '@/lib/types'
import { getRegistryFields, setRegistryFields } from '@/lib/firestore'

const DATA_TYPES: FieldType[] = ['Text','Number','Date','Dropdown','Boolean','Multi-Select','Textarea','Score']
const CATEGORIES = ['All','Visit','Clinical','Echo','Labs','Biomarkers','Vascular','Wearables','Imaging','Medications','QoL']

const typeColor: Record<string, string> = {
  'Text': 'badge-gray', 'Number': 'badge-blue', 'Date': 'badge-violet',
  'Dropdown': 'badge-amber', 'Boolean': 'badge-green', 'Multi-Select': 'badge-cyan',
  'Textarea': 'badge-gray', 'Score': 'badge-blue',
}

export default function RegistryPage() {
  const [fields, setFields]     = useState<RegistryField[]>([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('All')
  const [catFilter, setCatFilter]   = useState<string>('All')
  const [mandFilter, setMandFilter] = useState<string>('All')
  const [showAdd, setShowAdd]   = useState(false)
  const [editId, setEditId]     = useState<string | null>(null)
  const [editingField, setEditingField] = useState<RegistryField | null>(null)
  const [newField, setNewField] = useState({ fieldName: '', displayLabel: '', dataType: 'Text' as FieldType, mandatory: false, pii: false, category: 'Clinical' })

  useEffect(() => {
    async function load() {
      try {
        const data = await getRegistryFields()
        setFields(data)
      } catch (err) {
        console.error(err)
        toast.error('Failed to load registry fields')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const saveFields = (newFields: RegistryField[]) => {
    const previous = fields
    setFields(newFields)
    
    const promise = setRegistryFields(newFields).catch(err => {
      console.error(err)
      setFields(previous)
      throw err
    })

    toast.promise(promise, {
      loading: 'Saving configuration...',
      success: 'Configuration saved to Firestore',
      error: 'Failed to save configuration',
    })
  }

  const filtered = fields.filter(f => {
    const q = search.toLowerCase()
    const matchQ = !q || f.fieldName.toLowerCase().includes(q) || f.displayLabel.toLowerCase().includes(q)
    const matchT = typeFilter === 'All' || f.dataType === typeFilter
    const matchC = catFilter === 'All' || f.category === catFilter
    const matchM = mandFilter === 'All' || (mandFilter === 'Yes' ? f.mandatory : !f.mandatory)
    return matchQ && matchT && matchC && matchM
  })

  const handleAdd = () => {
    if (!newField.fieldName || !newField.displayLabel) return
    const id = Date.now().toString()
    const updated = [...fields, { ...newField, id, srNo: fields.length + 1, active: true }]
    saveFields(updated)
    setNewField({ fieldName: '', displayLabel: '', dataType: 'Text', mandatory: false, pii: false, category: 'Clinical' })
    setShowAdd(false)
  }

  const handleDelete = (id: string) => {
    const updated = fields.filter(f => f.id !== id).map((f, index) => ({ ...f, srNo: index + 1 }))
    saveFields(updated)
  }

  const handleToggleActive = (id: string) => {
    const updated = fields.map(f => f.id === id ? { ...f, active: !f.active } : f)
    saveFields(updated)
  }

  const handleStartEdit = (f: RegistryField) => {
    setEditId(f.id)
    setEditingField({ ...f })
    setShowAdd(false)
  }

  const handleSaveEdit = () => {
    if (!editingField || !editingField.fieldName || !editingField.displayLabel) return
    const updated = fields.map(f => f.id === editId ? editingField : f)
    saveFields(updated)
    setEditId(null)
    setEditingField(null)
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Activity className="w-8 h-8 text-blue-500 animate-spin" />
        <p className="text-sm text-gray-400">Loading configuration...</p>
      </div>
    )
  }

  return (
    <div className="space-y-5 animate-fade-in">

      {/* ── Header ── */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Database className="w-5 h-5" style={{ color: '#3b82f6' }} />
            <h2 className="text-xl font-bold text-white" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
              Registry Fields Setup
            </h2>
          </div>
          <p className="text-sm" style={{ color: 'rgba(148,163,184,0.6)' }}>
            Configure data fields captured per visit · Showing <span className="text-white font-semibold">{filtered.length}</span> of <span className="text-white font-semibold">{fields.length}</span> fields
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowAdd(s => !s)} className="btn-primary">
            <Plus className="w-4 h-4" /> Add Field
          </button>
        </div>
      </div>

      {/* ── Add Field Panel ── */}
      {showAdd && (
        <div className="accent-card p-5 space-y-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Plus className="w-4 h-4 text-blue-400" /> New Registry Field
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="form-label">Field Name (code)</label>
              <input className="form-input" placeholder="e.g. peakVO2" value={newField.fieldName}
                onChange={e => setNewField(p => ({ ...p, fieldName: e.target.value }))} />
            </div>
            <div>
              <label className="form-label">Display Label</label>
              <input className="form-input" placeholder="e.g. Peak VO₂" value={newField.displayLabel}
                onChange={e => setNewField(p => ({ ...p, displayLabel: e.target.value }))} />
            </div>
            <div>
              <label className="form-label">Data Type</label>
              <select className="form-select" value={newField.dataType}
                onChange={e => setNewField(p => ({ ...p, dataType: e.target.value as FieldType }))}>
                {DATA_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Category</label>
              <select className="form-select" value={newField.category}
                onChange={e => setNewField(p => ({ ...p, category: e.target.value }))}>
                {CATEGORIES.filter(c => c !== 'All').map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={newField.mandatory}
                onChange={e => setNewField(p => ({ ...p, mandatory: e.target.checked }))}
                className="w-4 h-4 rounded" />
              <span className="text-sm" style={{ color: 'rgba(148,163,184,0.8)' }}>Mandatory</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={newField.pii}
                onChange={e => setNewField(p => ({ ...p, pii: e.target.checked }))}
                className="w-4 h-4 rounded" />
              <span className="text-sm" style={{ color: 'rgba(148,163,184,0.8)' }}>PII (Personally Identifiable)</span>
            </label>
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={handleAdd} className="btn-primary btn-sm">
              <CheckCircle className="w-3.5 h-3.5" /> Save Field
            </button>
            <button onClick={() => setShowAdd(false)} className="btn-outline btn-sm">
              <XCircle className="w-3.5 h-3.5" /> Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Edit Field Panel ── */}
      {editId && editingField && (
        <div className="accent-card p-5 space-y-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Edit2 className="w-4 h-4 text-amber-400" /> Edit Registry Field
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="form-label">Field Name (code)</label>
              <input className="form-input" placeholder="e.g. peakVO2" value={editingField.fieldName}
                onChange={e => setEditingField(p => p ? ({ ...p, fieldName: e.target.value }) : null)} />
            </div>
            <div>
              <label className="form-label">Display Label</label>
              <input className="form-input" placeholder="e.g. Peak VO₂" value={editingField.displayLabel}
                onChange={e => setEditingField(p => p ? ({ ...p, displayLabel: e.target.value }) : null)} />
            </div>
            <div>
              <label className="form-label">Data Type</label>
              <select className="form-select" value={editingField.dataType}
                onChange={e => setEditingField(p => p ? ({ ...p, dataType: e.target.value as FieldType }) : null)}>
                {DATA_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Category</label>
              <select className="form-select" value={editingField.category}
                onChange={e => setEditingField(p => p ? ({ ...p, category: e.target.value }) : null)}>
                {CATEGORIES.filter(c => c !== 'All').map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={editingField.mandatory}
                onChange={e => setEditingField(p => p ? ({ ...p, mandatory: e.target.checked }) : null)}
                className="w-4 h-4 rounded" />
              <span className="text-sm" style={{ color: 'rgba(148,163,184,0.8)' }}>Mandatory</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={editingField.pii}
                onChange={e => setEditingField(p => p ? ({ ...p, pii: e.target.checked }) : null)}
                className="w-4 h-4 rounded" />
              <span className="text-sm" style={{ color: 'rgba(148,163,184,0.8)' }}>PII (Personally Identifiable)</span>
            </label>
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={handleSaveEdit} className="btn-primary btn-sm">
              <CheckCircle className="w-3.5 h-3.5" /> Save Changes
            </button>
            <button onClick={() => { setEditId(null); setEditingField(null); }} className="btn-outline btn-sm">
              <XCircle className="w-3.5 h-3.5" /> Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Filters ── */}
      <div className="glass-card p-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'rgba(148,163,184,0.4)' }} />
          <input className="search-input w-full" placeholder="Search by field name or label…"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5" style={{ color: 'rgba(148,163,184,0.4)' }} />
            <select className="form-select text-xs py-2"
              value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
              <option value="All">All Types</option>
              {DATA_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <select className="form-select text-xs py-2" value={catFilter} onChange={e => setCatFilter(e.target.value)}>
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
          <select className="form-select text-xs py-2" value={mandFilter} onChange={e => setMandFilter(e.target.value)}>
            <option value="All">All Mandatory</option>
            <option value="Yes">Mandatory</option>
            <option value="No">Optional</option>
          </select>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="registry-table">
            <thead>
              <tr>
                <th className="w-12">Sr No</th>
                <th>Field Name</th>
                <th>Display Label</th>
                <th>Category</th>
                <th>
                  <span className="flex items-center gap-1">
                    Data Type <ArrowUpDown className="w-3 h-3" />
                  </span>
                </th>
                <th>Mandatory</th>
                <th>PII</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-16">
                    <Database className="w-10 h-10 mx-auto mb-3" style={{ color: 'rgba(59,130,246,0.2)' }} />
                    <p className="text-sm" style={{ color: 'rgba(148,163,184,0.5)' }}>No fields found</p>
                    <p className="text-xs mt-1" style={{ color: 'rgba(148,163,184,0.3)' }}>
                      {fields.length === 0 ? 'Add your first field to this registry.' : 'Try adjusting your search or filters.'}
                    </p>
                  </td>
                </tr>
              ) : filtered.map(f => (
                <tr key={f.id} className={!f.active ? 'opacity-40' : ''}>
                  <td className="font-mono text-xs" style={{ color: 'rgba(148,163,184,0.4)' }}>{f.srNo}</td>
                  <td>
                    <span className="font-mono text-xs px-2 py-0.5 rounded" style={{ background: 'rgba(59,130,246,0.08)', color: '#93c5fd' }}>
                      {f.fieldName}
                    </span>
                  </td>
                  <td className="font-medium text-white">{f.displayLabel}</td>
                  <td>
                    <span className="badge badge-gray text-[10px]">{f.category}</span>
                  </td>
                  <td>
                    <span className={`badge text-[10px] ${typeColor[f.dataType] ?? 'badge-gray'}`}>{f.dataType}</span>
                  </td>
                  <td>
                    {f.mandatory
                      ? <CheckCircle className="w-4 h-4" style={{ color: '#10b981' }} />
                      : <span className="text-xs" style={{ color: 'rgba(148,163,184,0.3)' }}>—</span>}
                  </td>
                  <td>
                    {f.pii
                      ? <span className="badge badge-amber text-[10px]">PII</span>
                      : <span className="text-xs" style={{ color: 'rgba(148,163,184,0.3)' }}>—</span>}
                  </td>
                  <td>
                    <span className={f.active ? 'status-active' : 'status-inactive'}>
                      {f.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => handleToggleActive(f.id)} className="btn-ghost btn-sm" title={f.active ? 'Deactivate' : 'Activate'}>
                        {f.active ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                      </button>
                      <button onClick={() => handleStartEdit(f)} className="btn-ghost btn-sm" title="Edit">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDelete(f.id)} className="btn-ghost btn-sm" title="Delete"
                        style={{ color: 'rgba(244,63,94,0.6)' }}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Footer */}
        <div className="px-5 py-3 flex items-center justify-between" style={{ borderTop: '1px solid rgba(59,130,246,0.08)' }}>
          <p className="text-xs" style={{ color: 'rgba(148,163,184,0.4)' }}>
            Showing {filtered.length} of {fields.length} fields
          </p>
          <div className="flex gap-2">
            <span className="badge badge-green text-[10px]">{fields.filter(f => f.active).length} Active</span>
            <span className="badge badge-gray text-[10px]">{fields.filter(f => !f.active).length} Inactive</span>
            <span className="badge badge-amber text-[10px]">{fields.filter(f => f.mandatory).length} Mandatory</span>
          </div>
        </div>
      </div>
    </div>
  )
}
