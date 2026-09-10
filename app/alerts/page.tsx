'use client'
import { useEffect, useState } from 'react'
import { Bell, ShieldAlert, Sparkles, Filter, CheckCircle, Activity } from 'lucide-react'
import Button from '@/components/ui/Button'
import { getPatients, getAllVisits, getAllCathProcedures } from '@/lib/firestore'
import type { Patient, Visit, CathProcedure } from '@/lib/types'
import { fullName } from '@/lib/utils'
import { useAppUser } from '@/context/AppUserContext'
import { filterPatientsByAccess } from '@/lib/accessControl'

interface AlertItem {
  id: string
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
        const [allPatients, allVisits, allProcs] = await Promise.all([
          getPatients(),
          getAllVisits(),
          getAllCathProcedures().catch(() => [] as CathProcedure[]),
        ])

        // Strictly enforce patient access control per institutional scope
        const patients = currentUser ? filterPatientsByAccess(currentUser, allPatients) : allPatients
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

        const resolvedIds = JSON.parse(localStorage.getItem('resolved_alerts') || '[]')
        const dynamicAlerts: AlertItem[] = []

        patients.forEach(p => {
          const patientVisits = visitsByPatient[p.id] || []
          if (patientVisits.length === 0) return

          // Find latest visit
          const latest = patientVisits.reduce((latestVisit, currentVisit) => {
            const latestTime = new Date(latestVisit.visitDate).getTime()
            const currentTime = new Date(currentVisit.visitDate).getTime()
            return (!isNaN(currentTime) && currentTime > latestTime) ? currentVisit : latestVisit
          }, patientVisits[0])

          const pName = fullName(p)
          const mrn = p.mrn || '—'

          // 1. NT-proBNP > 2000
          if (latest.ntProBNP && latest.ntProBNP > 2000) {
            const alertId = `ntprobnp-${p.id}-${latest.id}`
            dynamicAlerts.push({
              id: alertId,
              patient: pName,
              mrn,
              trigger: 'Decompensated Heart Failure Risk',
              severity: 'Critical',
              value: `NT-proBNP: ${latest.ntProBNP} pg/mL`,
              timestamp: latest.visitDate,
              status: resolvedIds.includes(alertId) ? 'Resolved' : 'Open'
            })
          }

          // 2. eGFR < 45
          if (latest.egfr && latest.egfr < 45) {
            const alertId = `egfr-${p.id}-${latest.id}`
            dynamicAlerts.push({
              id: alertId,
              patient: pName,
              mrn,
              trigger: 'eGFR Decline',
              severity: 'Warning',
              value: `eGFR: ${latest.egfr} ml/min`,
              timestamp: latest.visitDate,
              status: resolvedIds.includes(alertId) ? 'Resolved' : 'Open'
            })
          }

          // 3. Potassium > 5.5
          if (latest.potassium && latest.potassium > 5.5) {
            const alertId = `potassium-high-${p.id}-${latest.id}`
            dynamicAlerts.push({
              id: alertId,
              patient: pName,
              mrn,
              trigger: 'Hyperkalemia Alert',
              severity: 'Critical',
              value: `Potassium: ${latest.potassium} mmol/L`,
              timestamp: latest.visitDate,
              status: resolvedIds.includes(alertId) ? 'Resolved' : 'Open'
            })
          }

          // 4. Potassium < 3.5
          if (latest.potassium && latest.potassium < 3.5) {
            const alertId = `potassium-low-${p.id}-${latest.id}`
            dynamicAlerts.push({
              id: alertId,
              patient: pName,
              mrn,
              trigger: 'Hypokalemia Alert',
              severity: 'Critical',
              value: `Potassium: ${latest.potassium} mmol/L`,
              timestamp: latest.visitDate,
              status: resolvedIds.includes(alertId) ? 'Resolved' : 'Open'
            })
          }

          // 5. Interventional / Cath Lab Alerts
          const ptProcs = procsByPatient[p.id] || []
          ptProcs.forEach(proc => {
            if (proc.complications?.hasComplication) {
              const alertId = `proc-comp-${proc.id}`
              const compDesc = [
                proc.complications.inLabDeath && 'In-Lab Mortality',
                proc.complications.coronaryPerforation && 'Coronary Perforation',
                proc.complications.coronaryDissection && 'Coronary Dissection',
                proc.complications.acuteStentThrombosis && 'Acute Stent Thrombosis',
                proc.complications.majorBleed && 'Major Bleed',
                proc.complications.emergencyCabg && 'Emergency CABG'
              ].filter(Boolean).join(', ') || 'Procedural Complication Recorded'

              dynamicAlerts.push({
                id: alertId,
                patient: pName,
                mrn,
                trigger: 'Post-PCI Adverse Event',
                severity: 'Critical',
                value: compDesc,
                timestamp: proc.procedureDate || new Date().toISOString(),
                status: resolvedIds.includes(alertId) ? 'Resolved' : 'Open'
              })
            }

            // High contrast load alert (> 250 mL)
            if (proc.contrastVolumeMl && proc.contrastVolumeMl > 250) {
              const alertId = `contrast-high-${proc.id}`
              dynamicAlerts.push({
                id: alertId,
                patient: pName,
                mrn,
                trigger: 'High Contrast Volume (CIN Risk)',
                severity: 'Warning',
                value: `Volume: ${proc.contrastVolumeMl} mL`,
                timestamp: proc.procedureDate || new Date().toISOString(),
                status: resolvedIds.includes(alertId) ? 'Resolved' : 'Open'
              })
            }

            // Sub-optimal post-TIMI flow (< 3)
            const suboptimalLesion = proc.lesions?.find(l => l.postTimiFlow !== undefined && l.postTimiFlow < 3)
            if (suboptimalLesion) {
              const alertId = `suboptimal-timi-${proc.id}-${suboptimalLesion.vessel}`
              dynamicAlerts.push({
                id: alertId,
                patient: pName,
                mrn,
                trigger: 'Sub-optimal Coronary Perfusion',
                severity: 'Warning',
                value: `${suboptimalLesion.vessel}: TIMI ${suboptimalLesion.postTimiFlow} flow`,
                timestamp: proc.procedureDate || new Date().toISOString(),
                status: resolvedIds.includes(alertId) ? 'Resolved' : 'Open'
              })
            }
          })
        })

        setAlerts(dynamicAlerts)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    loadAlerts()
  }, [currentUser])

  const resolveAlert = (id: string) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, status: 'Resolved' } : a))
    const resolvedIds = JSON.parse(localStorage.getItem('resolved_alerts') || '[]')
    if (!resolvedIds.includes(id)) {
      resolvedIds.push(id)
      localStorage.setItem('resolved_alerts', JSON.stringify(resolvedIds))
    }
  }

  const filtered = alerts.filter(a => {
    if (filter === 'All') return true
    if (filter === 'Open') return a.status === 'Open'
    if (filter === 'Resolved') return a.status === 'Resolved'
    return a.severity === filter
  })

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Activity className="w-6 h-6 text-blue-400 animate-pulse" />
    </div>
  )

  return (
    <div className="space-y-5 animate-fade-in text-gray-300">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Bell className="w-5 h-5 text-rose-400 animate-pulse" />
            <h2 className="text-xl font-bold text-white">Clinical Action Alerts</h2>
          </div>
          <p className="text-sm text-gray-400">Real-time patient deterioration alerts & flags</p>
        </div>
      </div>

      {/* Filters */}
      <div className="glass-card p-4 flex gap-3 items-center justify-between">
        <div className="flex gap-2">
          {['All', 'Open', 'Critical', 'Warning', 'Resolved'].map(tab => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                filter === tab 
                  ? 'bg-blue-600/20 border border-blue-500/30 text-blue-400' 
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Alerts List */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="glass-card p-12 text-center text-gray-500">
            No clinical alerts found in this category.
          </div>
        ) : (
          filtered.map(alert => (
            <div
              key={alert.id}
              className={`alert-strip ${
                alert.status === 'Resolved' ? 'ok' :
                alert.severity === 'Critical' ? 'danger' :
                alert.severity === 'Warning' ? 'warn' : 'info'
              }`}
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-white text-xs">{alert.patient}</span>
                  <span className="text-[10px] text-gray-500 font-mono">({alert.mrn})</span>
                  <span className="text-[10px] text-gray-500">&bull; {alert.timestamp}</span>
                </div>
                <p className="text-xs font-semibold text-white mt-1">{alert.trigger}</p>
                <p className="text-[11px] text-gray-400 font-mono mt-0.5">{alert.value}</p>
              </div>
              <div className="flex gap-2">
                {alert.status === 'Open' ? (
                  <Button variant="outline" size="sm" className="btn-sm text-emerald-400" onClick={() => resolveAlert(alert.id)}>
                    <CheckCircle className="w-3.5 h-3.5" /> Resolve flag
                  </Button>
                ) : (
                  <span className="badge badge-green text-[10px] font-bold">Resolved</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
