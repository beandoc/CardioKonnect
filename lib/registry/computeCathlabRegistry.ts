import type { CathProcedure, Patient } from '@/lib/types'
import { calculateLesionSuccess } from '@/lib/interventionalMetrics'
import type { RegistryData } from './types'
import { getEnrollmentTrend } from './utils'

export function computeCathlabRegistry(procedures: CathProcedure[], patients?: Patient[]): RegistryData | null {
  try {
    const uniquePatientIds = new Set(procedures.map(p => p.patientId))
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)
    const newThisMonth = procedures.filter(p => p.createdAt && new Date(p.createdAt) >= startOfMonth).length

    // Interventional metrics
    const pciProcedures = procedures.filter(p => p.procedureType !== 'Diagnostic Coronary Angiography')
    const allTreatedLesions = pciProcedures.flatMap(p => (p.lesions || []).filter(l => l.treatmentStrategy !== 'Medical Therapy'))
    
    // Strict Angiographic Success: TIMI 3 flow + residual stenosis < 20% with NO in-lab MACE
    const successfulLesions = pciProcedures.flatMap(p => {
      const hasInLabMace = !!(
        p.complications?.inLabDeath ||
        p.complications?.emergencyCabg ||
        p.complications?.acuteStentThrombosis ||
        p.complications?.periproceduralMi
      )
      if (hasInLabMace) return []
      return (p.lesions || []).filter(l => calculateLesionSuccess(l))
    })
    const pciSuccessRate = allTreatedLesions.length > 0
      ? Math.round((successfulLesions.length / allTreatedLesions.length) * 100)
      : null

    const radialCount = procedures.filter(p => p.accessSite && p.accessSite.includes('Radial')).length
    const radialRate = procedures.length ? Math.round((radialCount / procedures.length) * 100) : null

    const stemiCases = procedures.filter(p => p.clinicalIndication === 'STEMI' && p.stemiTimelines?.dtbMinutes != null)
    const dtbMet = stemiCases.filter(p => (p.stemiTimelines?.dtbMinutes ?? 999) <= 90).length
    const dtbRate = stemiCases.length > 0 ? Math.round((dtbMet / stemiCases.length) * 100) : null

    const complicationCount = procedures.filter(p => p.complications?.hasComplication).length
    const complicationRate = procedures.length ? ((complicationCount / procedures.length) * 100).toFixed(1) : null

    // 6 Category completeness
    const procCategories = [
      { name: 'Indication & Urgency', test: (p: CathProcedure) => !!(p.procedureType && p.clinicalIndication) },
      { name: 'Vascular Access', test: (p: CathProcedure) => !!(p.accessSite && p.sheathSize && p.closureDevice) },
      { name: 'Lesions & Anatomy', test: (p: CathProcedure) => Array.isArray(p.lesions) && p.lesions.length > 0 },
      { name: 'Devices & Stents', test: (p: CathProcedure) => Array.isArray(p.lesions) && p.lesions.some(l => l.devices && l.devices.length > 0) },
      { name: 'Hemodynamics & Rad', test: (p: CathProcedure) => (p.contrastVolumeMl || 0) > 0 || (p.fluoroscopyTimeMinutes || 0) > 0 },
      { name: 'Complications & Safety', test: (p: CathProcedure) => p.complications != null },
    ]

    const completionByCategory = procCategories.map(cat => {
      if (procedures.length === 0) return { name: cat.name, pct: 0 }
      const filledCount = procedures.filter(cat.test).length
      return { name: cat.name, pct: Math.round((filledCount / procedures.length) * 100) }
    })

    const avgCompletion = completionByCategory.length
      ? Math.round(completionByCategory.reduce((s, c) => s + c.pct, 0) / completionByCategory.length)
      : 0

    // Real empirical fields captured calculation
    const cathFieldsCount = 28
    let totalFilledCountSum = 0
    procedures.forEach(p => {
      let filled = 0
      if (p.procedureType) filled++
      if (p.clinicalIndication) filled++
      if (p.procedureDate) filled++
      if (p.operatorName) filled++
      if (p.accessSite) filled++
      if (p.sheathSize) filled++
      if (p.closureDevice) filled++
      if (p.radialCrossover !== undefined) filled++
      if (p.contrastVolumeMl != null && p.contrastVolumeMl > 0) filled++
      if (p.fluoroscopyTimeMinutes != null && p.fluoroscopyTimeMinutes > 0) filled++
      if (p.contrastType) filled++
      if (p.radiationAirKermaGy != null || p.doseAreaProductGyCm2 != null) filled++
      if (p.dischargeStatus) filled++
      if (p.complications) filled++
      if (p.overallSuccess !== undefined) filled++
      if (p.lesions && p.lesions.length > 0) {
        filled++
        const l = p.lesions[0]
        if (l.vessel) filled++
        if (l.segmentNumber != null) filled++
        if (l.preTimiFlow !== undefined) filled++
        if (l.postTimiFlow !== undefined) filled++
        if (l.preStenosisPct != null) filled++
        if (l.postStenosisPct != null) filled++
        if (l.treatmentStrategy) filled++
        if (l.devices && l.devices.length > 0) {
          filled++
          if (l.devices[0].deviceType) filled++
          if (l.devices[0].diameterMm) filled++
          if (l.devices[0].lengthMm) filled++
          if (l.devices[0].serialOrBatchNumber) filled++
        }
      }
      totalFilledCountSum += filled
    })
    const actualCathFieldsCaptured = procedures.length ? Math.round(totalFilledCountSum / procedures.length) : 0

    // Real clinical charts
    // 1. Procedure Modality
    const typeCounts: Record<string, number> = {}
    procedures.forEach(p => {
      const t = p.procedureType || 'Diagnostic Coronary Angiography'
      typeCounts[t] = (typeCounts[t] || 0) + 1
    })
    const procedureTypeData = Object.entries(typeCounts).map(([name, value]) => ({ name, value }))

    // 2. Vascular Access Distribution
    const accessCounts: Record<string, number> = {}
    procedures.forEach(p => {
      const a = p.accessSite || 'Radial'
      accessCounts[a] = (accessCounts[a] || 0) + 1
    })
    const accessData = Object.entries(accessCounts).map(([name, value]) => ({ name, value }))

    // 3. Culprit / Target Vessels Treated
    const vesselCounts: Record<string, number> = {}
    procedures.forEach(p => {
      (p.lesions || []).forEach(l => {
        const v = l.vessel || 'Other'
        vesselCounts[v] = (vesselCounts[v] || 0) + 1
      })
    })
    const vesselData = Object.entries(vesselCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, value]) => ({ name, value }))

    // 4. STEMI Door-to-Balloon Distribution
    const dtbData = [
      { name: '< 60 min', value: stemiCases.filter(p => (p.stemiTimelines?.dtbMinutes ?? 999) < 60).length },
      { name: '60–90 min', value: stemiCases.filter(p => { const m = p.stemiTimelines?.dtbMinutes ?? 999; return m >= 60 && m <= 90 }).length },
      { name: '90–120 min', value: stemiCases.filter(p => { const m = p.stemiTimelines?.dtbMinutes ?? 999; return m > 90 && m <= 120 }).length },
      { name: '> 120 min', value: stemiCases.filter(p => (p.stemiTimelines?.dtbMinutes ?? 0) > 120).length },
    ]

    return {
      id: 'cathlab',
      name: 'Cath Lab & Interventional Registry',
      shortDesc: 'PCI · STEMI Networks · Coronary Interventions',
      gradient: 'linear-gradient(135deg, #b45309 0%, #f59e0b 100%)',
      accentColor: '#f59e0b',
      ringColor: '#fbbf24',
      patients: uniquePatientIds.size,
      newThisMonth: newThisMonth,
      completion: avgCompletion,
      fieldsTotal: cathFieldsCount,
      fieldsCaptured: actualCathFieldsCaptured,
      status: (uniquePatientIds.size > 0 ? 'Active' : 'Suspended') as 'Active' | 'Suspended',
      kpis: [
        { label: 'PCI Success Rate', value: pciSuccessRate !== null ? `${pciSuccessRate}%` : '—', sub: allTreatedLesions.length ? `${successfulLesions.length}/${allTreatedLesions.length} treated lesions` : 'no treated lesions' },
        { label: 'Transradial Access', value: radialRate !== null ? `${radialRate}%` : '—', sub: procedures.length ? `${radialCount}/${procedures.length} radial first` : 'no procedures' },
        { label: 'STEMI DTB ≤90m', value: dtbRate !== null ? `${dtbRate}%` : '—', sub: stemiCases.length ? `${dtbMet}/${stemiCases.length} primary PCIs` : 'no STEMI cases' },
        { label: 'Major Complications', value: complicationRate !== null ? `${complicationRate}%` : '—', sub: procedures.length ? `${complicationCount} audited events` : 'no procedures' },
      ],
      completionByCategory,
      enrollmentTrend: getEnrollmentTrend(procedures.map(p => ({ createdAt: p.procedureDate || p.createdAt })) as any),
      clinicalCharts: [
        {
          title: 'Procedure Modality Distribution',
          type: 'pie' as const,
          data: procedureTypeData.length ? procedureTypeData : [{ name: 'No Procedures Logged', value: 0 }]
        },
        {
          title: 'Vascular Access Approach',
          type: 'bar-h' as const,
          color: '#10b981',
          data: accessData.length ? accessData : [{ name: 'No Data', value: 0 }]
        },
        {
          title: 'Coronary Vessel Interventions',
          type: 'bar-v' as const,
          color: '#f59e0b',
          data: vesselData.length ? vesselData : [{ name: 'No Lesions', value: 0 }]
        },
        {
          title: 'Door-to-Balloon Compliance (STEMI)',
          type: 'bar-v' as const,
          color: '#ef4444',
          data: dtbData
        }
      ]
    }
  } catch (err) {
    console.error('Cathlab dynamic calculation error:', err)
    return null
  }
}
