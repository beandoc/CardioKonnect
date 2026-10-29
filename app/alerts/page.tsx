'use client'
import { complicationFlags } from '@/lib/complications'
import { useEffect, useState, useMemo, useCallback } from 'react'
import Link from 'next/link'
import {
  Bell, ShieldAlert, Sparkles, Filter, CheckCircle,
  Activity, ExternalLink, RefreshCw, Search, User
} from 'lucide-react'
import Button from '@/components/ui/Button'
import PaginationControls from '@/components/ui/PaginationControls'
import {
  getPatients, getAllVisits, getAllCathProcedures,
  getResolvedAlertIds, resolveAlert as saveAlertResolution,
  unresolveAlert
} from '@/lib/firestore'
import type { Patient, Visit, CathProcedure } from '@/lib/types'
import { fullName, formatDate, cn } from '@/lib/utils'
import { useAppUser } from '@/context/AppUserContext'
import { filterPatientsByAccess } from '@/lib/accessControl'
import { notifyLoadError } from '@/lib/notify'
import { toast } from 'sonner'

interface AlertItem {
  id: string
  patientId: string
  patient: string
  mrn: string
  trigger: string
  severity: 'Critical' | 'Warning' | 'Info'
  value: string
  timestamp: string
  status: 'Open' | 'Resolved'
}

export default function ClinicalAlertsPage() {
  const { currentUser } = useAppUser()
  const [alerts, setAlerts] = useState<AlertItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('All')

  useEffect(() => {
    async function loadAlerts() {
      try {
        const [allPatients, allVisits, allProcs, resolvedIds] = await Promise.all([
          getPatients(),
          getAllVisits(),
          getAllCathProcedures(),
          getResolvedAlertIds(),
        ])

        // Strictly enforce patient access control per institutional scope
        const patients = filterPatientsByAccess(currentUser, allPatients)
        const accessiblePatientIds = new Set(patients.map(p => p.id))
        
        const visitsByPatient: Record<string, Visit[]> = {}
        allVisits.forEach(v => {
          if (v.patientId && accessiblePatientIds.has(v.patientId)) {
            if (!visitsByPatient[v.patientId]) {
              visitsByPatient[v.patientId] = []
            }
            visitsByPatient[v.patientId].push(v)
          }
        })

        const procsByPatient: Record<string, CathProcedure[]> = {}
        allProcs.forEach(p => {
          if (p.patientId && accessiblePatientIds.has(p.patientId)) {
            if (!procsByPatient[p.patientId]) {
              procsByPatient[p.patientId] = []
            }
            procsByPatient[p.patientId].push(p)
          }
        })

        const dynamicAlerts: AlertItem[] = []

        patients.forEach(p => {
          const pName = fullName(p)
          const mrn = p.mrn || '—'
          const patientVisits = visitsByPatient[p.id] || []

          if (patientVisits.length > 0) {
            // Find latest visit
            const latest = patientVisits.reduce((latestVisit, currentVisit) => {
              const latestTime = new Date(latestVisit.visitDate).getTime()
              const currentTime = new Date(currentVisit.visitDate).getTime()
              return (!isNaN(currentTime) && currentTime > latestTime) ? currentVisit : latestVisit
            }, patientVisits[0])

            // 1. NT-proBNP > 2000
            if (latest.ntProBNP && latest.ntProBNP > 2000) {
              const alertId = `ntprobnp-${p.id}-${latest.id}`
              dynamicAlerts.push({
                id: alertId,
                patientId: p.id,
                patient: pName,
                mrn,
                trigger: 'Decompensated Heart Failure Risk',
                severity: 'Critical',
                value: `NT-proBNP: ${latest.ntProBNP} pg/mL`,
                timestamp: latest.visitDate,
                status: resolvedIds.has(alertId) ? 'Resolved' : 'Open'
              })
            }

            // 2. eGFR < 45
            if (latest.egfr && latest.egfr < 45) {
              const alertId = `egfr-${p.id}-${latest.id}`
              dynamicAlerts.push({
                id: alertId,
                patientId: p.id,
                patient: pName,
                mrn,
                trigger: 'eGFR Decline',
                severity: 'Warning',
                value: `eGFR: ${latest.egfr} ml/min`,
                timestamp: latest.visitDate,
                status: resolvedIds.has(alertId) ? 'Resolved' : 'Open'
              })
            }

            // 3. Potassium > 5.5
            if (latest.potassium && latest.potassium > 5.5) {
              const alertId = `potassium-high-${p.id}-${latest.id}`
              dynamicAlerts.push({
                id: alertId,
                patientId: p.id,
                patient: pName,
                mrn,
                trigger: 'Hyperkalemia Alert',
                severity: 'Critical',
                value: `Potassium: ${latest.potassium} mmol/L`,
                timestamp: latest.visitDate,
                status: resolvedIds.has(alertId) ? 'Resolved' : 'Open'
              })
            }

            // 4. Potassium < 3.5
            if (latest.potassium && latest.potassium < 3.5) {
              const alertId = `potassium-low-${p.id}-${latest.id}`
              dynamicAlerts.push({
                id: alertId,
                patientId: p.id,
                patient: pName,
                mrn,
                trigger: 'Hypokalemia Alert',
                severity: 'Critical',
                value: `Potassium: ${latest.potassium} mmol/L`,
                timestamp: latest.visitDate,
                status: resolvedIds.has(alertId) ? 'Resolved' : 'Open'
              })
            }
          }

          // 5. Interventional / Cath Lab Alerts
          const ptProcs = procsByPatient[p.id] || []
          ptProcs.forEach(proc => {
            if (complicationFlags(proc).hasComplication) {
              const alertId = `proc-comp-${proc.id}`
              const compDesc = [
                complicationFlags(proc).inLabDeath && 'In-Lab Mortality',
                complicationFlags(proc).coronaryPerforation && 'Coronary Perforation',
                complicationFlags(proc).coronaryDissection && 'Coronary Dissection',
                complicationFlags(proc).acuteStentThrombosis && 'Acute Stent Thrombosis',
                complicationFlags(proc).majorBleed && 'Major Bleed',
                complicationFlags(proc).emergencyCabg && 'Emergency CABG'
              ].filter(Boolean).join(', ') || 'Procedural Complication Recorded'

              dynamicAlerts.push({
                id: alertId,
                patientId: p.id,
                patient: pName,
                mrn,
                trigger: 'Post-PCI Adverse Event',
                severity: 'Critical',
                value: compDesc,
                timestamp: proc.procedureDate || new Date().toISOString(),
                status: resolvedIds.has(alertId) ? 'Resolved' : 'Open'
              })
            }

            // High contrast load alert (> 250 mL)
            if (proc.contrastVolumeMl && proc.contrastVolumeMl > 250) {
              const alertId = `contrast-high-${proc.id}`
              dynamicAlerts.push({
                id: alertId,
                patientId: p.id,
                patient: pName,
                mrn,
                trigger: 'High Contrast Volume (CIN Risk)',
                severity: 'Warning',
                value: `Volume: ${proc.contrastVolumeMl} mL`,
                timestamp: proc.procedureDate || new Date().toISOString(),
                status: resolvedIds.has(alertId) ? 'Resolved' : 'Open'
              })
            }

            // Sub-optimal post-TIMI flow (< 3)
            const suboptimalLesion = proc.lesions?.find(l => l.postTimiFlow !== undefined && l.postTimiFlow < 3)
            if (suboptimalLesion) {
              const alertId = `suboptimal-timi-${proc.id}-${suboptimalLesion.vessel}`
              dynamicAlerts.push({
                id: alertId,
                patientId: p.id,
                patient: pName,
                mrn,
                trigger: 'Sub-optimal Coronary Perfusion',
                severity: 'Warning',
                value: `${suboptimalLesion.vessel}: TIMI ${suboptimalLesion.postTimiFlow} flow`,
                timestamp: proc.procedureDate || new Date().toISOString(),
                status: resolvedIds.has(alertId) ? 'Resolved' : 'Open'
              })
            }
          })
        })

        // Sort alerts by date (newest first)
        dynamicAlerts.sort((a, b) => {
          const tA = new Date(a.timestamp).getTime() || 0
          const tB = new Date(b.timestamp).getTime() || 0
          return tB - tA
        })

        setAlerts(dynamicAlerts)
      } catch (err) {
        notifyLoadError(err, 'Alerts')
      } finally {
        setLoading(false)
      }
    }
    loadAlerts()
  }, [currentUser])

  const loadAlerts = useCallback(async () => {
    setLoading(true)
    try {
      const [allPatients, allVisits, allProcs, resolvedIds] = await Promise.all([
        getPatients(),
        getAllVisits(),
        getAllCathProcedures(),
        getResolvedAlertIds(),
      ])

      const patients = filterPatientsByAccess(currentUser, allPatients)
      const accessiblePatientIds = new Set(patients.map(p => p.id))
      
      const visitsByPatient: Record<string, Visit[]> = {}
      allVisits.forEach(v => {
        if (v.patientId && accessiblePatientIds.has(v.patientId)) {
          if (!visitsByPatient[v.patientId]) visitsByPatient[v.patientId] = []
          visitsByPatient[v.patientId].push(v)
        }
      })

      const procsByPatient: Record<string, CathProcedure[]> = {}
      allProcs.forEach(p => {
        if (p.patientId && accessiblePatientIds.has(p.patientId)) {
          if (!procsByPatient[p.patientId]) procsByPatient[p.patientId] = []
          procsByPatient[p.patientId].push(p)
        }
      })

      const dynamicAlerts: AlertItem[] = []

      patients.forEach(p => {
        const pName = fullName(p)
        const mrn = p.mrn || '—'
        const patientVisits = visitsByPatient[p.id] || []

        if (patientVisits.length > 0) {
          const latest = patientVisits.reduce((latestVisit, currentVisit) => {
            const latestTime = new Date(latestVisit.visitDate).getTime()
            const currentTime = new Date(currentVisit.visitDate).getTime()
            return (!isNaN(currentTime) && currentTime > latestTime) ? currentVisit : latestVisit
          }, patientVisits[0])

          if (latest.ntProBNP && latest.ntProBNP > 2000) {
            const alertId = `ntprobnp-${p.id}-${latest.id}`
            dynamicAlerts.push({
              id: alertId,
              patientId: p.id,
              patient: pName,
              mrn,
              trigger: 'Decompensated Heart Failure Risk',
              severity: 'Critical',
              value: `NT-proBNP: ${latest.ntProBNP} pg/mL`,
              timestamp: latest.visitDate,
              status: resolvedIds.has(alertId) ? 'Resolved' : 'Open'
            })
          }

          if (latest.egfr && latest.egfr < 45) {
            const alertId = `egfr-${p.id}-${latest.id}`
            dynamicAlerts.push({
              id: alertId,
              patientId: p.id,
              patient: pName,
              mrn,
              trigger: 'eGFR Decline',
              severity: 'Warning',
              value: `eGFR: ${latest.egfr} ml/min`,
              timestamp: latest.visitDate,
              status: resolvedIds.has(alertId) ? 'Resolved' : 'Open'
            })
          }

          if (latest.potassium && latest.potassium > 5.5) {
            const alertId = `potassium-high-${p.id}-${latest.id}`
            dynamicAlerts.push({
              id: alertId,
              patientId: p.id,
              patient: pName,
              mrn,
              trigger: 'Hyperkalemia Alert',
              severity: 'Critical',
              value: `Potassium: ${latest.potassium} mmol/L`,
              timestamp: latest.visitDate,
              status: resolvedIds.has(alertId) ? 'Resolved' : 'Open'
            })
          }

          if (latest.potassium && latest.potassium < 3.5) {
            const alertId = `potassium-low-${p.id}-${latest.id}`
            dynamicAlerts.push({
              id: alertId,
              patientId: p.id,
              patient: pName,
              mrn,
              trigger: 'Hypokalemia Alert',
              severity: 'Critical',
              value: `Potassium: ${latest.potassium} mmol/L`,
              timestamp: latest.visitDate,
              status: resolvedIds.has(alertId) ? 'Resolved' : 'Open'
            })
          }
        }

        const ptProcs = procsByPatient[p.id] || []
        ptProcs.forEach(proc => {
          if (complicationFlags(proc).hasComplication) {
            const alertId = `proc-comp-${proc.id}`
            const compDesc = [
              complicationFlags(proc).inLabDeath && 'In-Lab Mortality',
              complicationFlags(proc).coronaryPerforation && 'Coronary Perforation',
              complicationFlags(proc).coronaryDissection && 'Coronary Dissection',
              complicationFlags(proc).acuteStentThrombosis && 'Acute Stent Thrombosis',
              complicationFlags(proc).majorBleed && 'Major Bleed',
              complicationFlags(proc).emergencyCabg && 'Emergency CABG'
            ].filter(Boolean).join(', ') || 'Procedural Complication Recorded'

            dynamicAlerts.push({
              id: alertId,
              patientId: p.id,
              patient: pName,
              mrn,
              trigger: 'Post-PCI Adverse Event',
              severity: 'Critical',
              value: compDesc,
              timestamp: proc.procedureDate || new Date().toISOString(),
              status: resolvedIds.has(alertId) ? 'Resolved' : 'Open'
            })
          }

          if (proc.contrastVolumeMl && proc.contrastVolumeMl > 250) {
            const alertId = `contrast-high-${proc.id}`
            dynamicAlerts.push({
              id: alertId,
              patientId: p.id,
              patient: pName,
              mrn,
              trigger: 'High Contrast Volume (CIN Risk)',
              severity: 'Warning',
              value: `Volume: ${proc.contrastVolumeMl} mL`,
              timestamp: proc.procedureDate || new Date().toISOString(),
              status: resolvedIds.has(alertId) ? 'Resolved' : 'Open'
            })
          }

          const suboptimalLesion = proc.lesions?.find(l => l.postTimiFlow !== undefined && l.postTimiFlow < 3)
          if (suboptimalLesion) {
            const alertId = `suboptimal-timi-${proc.id}-${suboptimalLesion.vessel}`
            dynamicAlerts.push({
              id: alertId,
              patientId: p.id,
              patient: pName,
              mrn,
              trigger: 'Sub-optimal Coronary Perfusion',
              severity: 'Warning',
              value: `${suboptimalLesion.vessel}: TIMI ${suboptimalLesion.postTimiFlow} flow`,
              timestamp: proc.procedureDate || new Date().toISOString(),
              status: resolvedIds.has(alertId) ? 'Resolved' : 'Open'
            })
          }
        })
      })

      dynamicAlerts.sort((a, b) => {
        const tA = new Date(a.timestamp).getTime() || 0
        const tB = new Date(b.timestamp).getTime() || 0
        return tB - tA
      })

      setAlerts(dynamicAlerts)
    } catch (err) {
      notifyLoadError(err, 'Alerts')
    } finally {
      setLoading(false)
    }
  }, [currentUser])

  const resolveAlert = async (alert: AlertItem) => {
    try {
      await saveAlertResolution(alert.id, alert.patientId)
      setAlerts(prev => prev.map(a => a.id === alert.id ? { ...a, status: 'Resolved' } : a))
      toast.success(`Flag resolved for ${alert.patient}`, {
        description: alert.trigger
      })
    } catch (err) {
      console.error(err)
      toast.error('Could not save the alert resolution. Please try again.')
    }
  }

  const handleUnresolve = async (alert: AlertItem) => {
    try {
      await unresolveAlert(alert.id, alert.patientId)
      setAlerts(prev => prev.map(a => a.id === alert.id ? { ...a, status: 'Open' } : a))
      toast.info(`Alert flag re-opened for ${alert.patient}`, {
        description: alert.trigger
      })
    } catch (err) {
      console.error(err)
      toast.error('Could not re-open the alert. Please try again.')
    }
  }

  // Search and quick filter
  const [searchQuery, setSearchQuery] = useState('')

  // Counts
  const totalCount = alerts.length
  const openCount = useMemo(() => alerts.filter(a => a.status === 'Open').length, [alerts])
  const criticalCount = useMemo(() => alerts.filter(a => a.severity === 'Critical' && a.status === 'Open').length, [alerts])
  const warningCount = useMemo(() => alerts.filter(a => a.severity === 'Warning' && a.status === 'Open').length, [alerts])
  const resolvedCount = useMemo(() => alerts.filter(a => a.status === 'Resolved').length, [alerts])

  const filtered = useMemo(() => {
    return alerts.filter(a => {
      const q = searchQuery.toLowerCase().trim()
      const matchesSearch = !q ||
        a.patient.toLowerCase().includes(q) ||
        a.mrn.toLowerCase().includes(q) ||
        a.trigger.toLowerCase().includes(q) ||
        a.value.toLowerCase().includes(q)
      if (!matchesSearch) return false

      if (filter === 'All') return true
      if (filter === 'Open') return a.status === 'Open'
      if (filter === 'Resolved') return a.status === 'Resolved'
      return a.severity === filter
    })
  }, [alerts, filter, searchQuery])

  // Alerts Pagination State
  const [alertPage, setAlertPage] = useState(1)
  const [alertPageSize, setAlertPageSize] = useState(10)

  useEffect(() => {
    setAlertPage(1)
  }, [filter, searchQuery, alertPageSize])

  const paginatedAlerts = useMemo(() => {
    const start = (alertPage - 1) * alertPageSize
    return filtered.slice(start, start + alertPageSize)
  }, [filtered, alertPage, alertPageSize])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Activity className="w-6 h-6 text-blue-400 animate-pulse" />
    </div>
  )

  return (
    <div className="space-y-5 animate-fade-in text-gray-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Bell className="w-5 h-5 text-rose-400 animate-pulse" />
            <h2 className="text-xl font-bold text-white">Clinical Action Alerts</h2>
          </div>
          <p className="text-sm text-gray-400">
            Real-time patient deterioration alerts & flags wired to latest encounters & labs
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={loadAlerts}
          disabled={loading}
          className="btn-sm text-xs text-gray-300 hover:text-white border-blue-500/30"
        >
          <RefreshCw className={cn("w-3.5 h-3.5 mr-1.5", loading && "animate-spin")} />
          Sync Alerts
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <div className="glass-card p-4 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="flex gap-1.5 flex-wrap">
          {[
            { id: 'All', label: 'All', count: totalCount },
            { id: 'Open', label: 'Open', count: openCount },
            { id: 'Critical', label: 'Critical', count: criticalCount },
            { id: 'Warning', label: 'Warning', count: warningCount },
            { id: 'Resolved', label: 'Resolved', count: resolvedCount },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer',
                filter === tab.id
                  ? 'bg-blue-600/25 border border-blue-500/40 text-blue-300 shadow-sm'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-white/5 border border-transparent'
              )}
            >
              <span>{tab.label}</span>
              <span className={cn(
                'text-[10px] px-1.5 py-0.2 rounded-full font-mono',
                filter === tab.id ? 'bg-blue-500/30 text-white' : 'bg-white/10 text-gray-400'
              )}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            placeholder="Search patient, MRN, lab, trigger..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-blue-500/20 bg-slate-950/60 text-white placeholder-gray-500 text-xs focus:outline-none focus:border-blue-500 transition"
          />
        </div>
      </div>

      {/* Alerts List */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="glass-card p-12 text-center text-gray-400 space-y-2">
            <ShieldAlert className="w-8 h-8 text-gray-500 mx-auto" />
            <p className="text-sm font-semibold text-white">No clinical alerts found in this view</p>
            <p className="text-xs text-gray-500">
              {searchQuery ? 'Try adjusting your search criteria.' : 'All clinical parameters are within acceptable protocol thresholds.'}
            </p>
          </div>
        ) : (
          <>
            {paginatedAlerts.map(alert => (
              <div
                key={alert.id}
                className={cn(
                  'alert-strip flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border transition-all duration-200',
                  alert.status === 'Resolved' ? 'ok opacity-75 border-emerald-500/20 bg-emerald-950/10' :
                  alert.severity === 'Critical' ? 'danger border-rose-500/30 bg-rose-950/15' :
                  alert.severity === 'Warning' ? 'warn border-amber-500/30 bg-amber-950/15' : 'info border-blue-500/30 bg-blue-950/15'
                )}
              >
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={cn(
                      'px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider',
                      alert.status === 'Resolved' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                      alert.severity === 'Critical' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' :
                      'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    )}>
                      {alert.status === 'Resolved' ? 'Resolved' : alert.severity}
                    </span>
                    <Link
                      href={`/patients/${alert.patientId}`}
                      className="font-bold text-white text-xs hover:text-blue-300 transition-colors flex items-center gap-1 group"
                    >
                      <span className="group-hover:underline">{alert.patient}</span>
                      <ExternalLink className="w-3 h-3 text-blue-400 opacity-60 group-hover:opacity-100" />
                    </Link>
                    <span className="text-[10px] text-gray-400 font-mono">({alert.mrn})</span>
                    <span className="text-[10px] text-gray-500 font-medium">&bull; {formatDate(alert.timestamp)}</span>
                  </div>
                  <p className="text-xs font-semibold text-white mt-1">{alert.trigger}</p>
                  <p className="text-[11px] text-gray-300 font-mono mt-0.5">{alert.value}</p>
                </div>
                <div className="flex items-center gap-2 self-end sm:self-center flex-shrink-0">
                  <Link href={`/patients/${alert.patientId}`}>
                    <Button variant="outline" size="sm" className="btn-sm text-[11px] py-1 px-2.5 text-blue-300 border-blue-500/30 hover:bg-blue-500/10">
                      <User className="w-3 h-3 mr-1" /> View Patient
                    </Button>
                  </Link>
                  {alert.status === 'Open' ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="btn-sm text-[11px] py-1 px-2.5 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
                      onClick={() => resolveAlert(alert)}
                    >
                      <CheckCircle className="w-3 h-3 mr-1" /> Resolve flag
                    </Button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="badge badge-green text-[10px] font-bold">Resolved</span>
                      <button
                        onClick={() => handleUnresolve(alert)}
                        className="text-[11px] text-gray-400 hover:text-amber-300 underline underline-offset-2 transition cursor-pointer"
                        title="Re-open this alert flag"
                      >
                        Re-open
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            <PaginationControls
              currentPage={alertPage}
              totalItems={filtered.length}
              pageSize={alertPageSize}
              onPageChange={setAlertPage}
              onPageSizeChange={setAlertPageSize}
              itemName="alerts"
            />
          </>
        )}
      </div>
    </div>
  )
}
