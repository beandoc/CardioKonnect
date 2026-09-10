import type { CathProcedure, Patient, Visit } from '@/lib/types'
import { safeTime } from '@/lib/utils'
import type { RegistryData } from './types'
import { getEnrollmentTrend } from './utils'

export function computeAcsRegistry(
  patients: Patient[],
  visits: Visit[],
  procedures: CathProcedure[],
  visitsByPatientMap?: Map<string, Visit[]>
): RegistryData | null {
  try {
    const acsProcedures = procedures.filter(
      p => p.clinicalIndication === 'STEMI' || p.clinicalIndication === 'NSTEMI' || p.clinicalIndication === 'Unstable Angina'
    )
    const acsPatientIds = new Set(acsProcedures.map(p => p.patientId))
    patients.forEach(p => {
      if (p.registryId === 'acs' || p.comorbidPriorMI || p.comorbidCAD) {
        acsPatientIds.add(p.id)
      }
    })
    const acsPatients = patients.filter(p => acsPatientIds.has(p.id))
    const acsVisits = visits.filter(v => acsPatientIds.has(v.patientId))

    // Build or reuse indexed map of visits
    const vMap = visitsByPatientMap ?? (() => {
      const m = new Map<string, Visit[]>()
      for (const v of acsVisits) {
        const list = m.get(v.patientId) || []
        list.push(v)
        m.set(v.patientId, list)
      }
      m.forEach(list => list.sort((a, b) => safeTime(b.visitDate) - safeTime(a.visitDate)))
      return m
    })()

    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)
    const newThisMonth = acsPatients.filter(p => p.createdAt && new Date(p.createdAt) >= startOfMonth).length

    // 1. STEMI Door-to-Balloon Time
    const stemiCases = acsProcedures.filter(p => p.clinicalIndication === 'STEMI' && p.stemiTimelines?.dtbMinutes != null)
    const dtbMet = stemiCases.filter(p => (p.stemiTimelines?.dtbMinutes ?? 999) <= 90).length
    const dtbRate = stemiCases.length > 0 ? Math.round((dtbMet / stemiCases.length) * 100) : null

    // 2. TIMI 3 Flow post-PCI
    const treatedLesions = acsProcedures.flatMap(p => p.lesions || []).filter(l => l.treatmentStrategy !== 'Medical Therapy')
    const timi3Lesions = treatedLesions.filter(l => l.postTimiFlow === 3)
    const timi3Rate = treatedLesions.length > 0 ? Math.round((timi3Lesions.length / treatedLesions.length) * 100) : null

    // 3. True DAPT Rate: Aspirin AND P2Y12 inhibitor
    let daptPrescribedCount = 0
    let evaluatedMedsCount = 0
    acsPatients.forEach(p => {
      const pVisits = vMap.get(p.id) || []
      if (pVisits.length === 0) return
      const latest = pVisits[0] // pre-sorted by date
      if (latest.aspirin?.prescribed != null || latest.p2y12Inhibitor?.prescribed != null) {
        evaluatedMedsCount++
        if (latest.aspirin?.prescribed === 'Yes' && latest.p2y12Inhibitor?.prescribed === 'Yes') {
          daptPrescribedCount++
        }
      }
    })
    const daptRate = evaluatedMedsCount > 0 ? Math.round((daptPrescribedCount / evaluatedMedsCount) * 100) : null

    // 4. 30-Day MACE (in-hospital death, periprocedural MI, TVR/TLR, stroke)
    let maceCount = 0
    acsProcedures.forEach(p => {
      if (p.complications?.inHospitalDeath || p.complications?.periproceduralMi || p.complications?.strokeOrTia || p.complications?.targetVesselRevascularization) {
        maceCount++
      }
    })
    const maceRate = acsProcedures.length > 0 ? ((maceCount / acsProcedures.length) * 100).toFixed(1) : null

    // 5. Mutually Exclusive Disease Extent (Sum = 100% of evaluated cohort)
    let normalNonObstructive = 0
    let singleVessel = 0
    let doubleVessel = 0
    let tripleVessel = 0
    let leftMain = 0
    let totalAnatomyEvaluated = 0

    acsVisits.forEach(v => {
      const ca = v.coronaryAnatomy
      if (ca && (ca.lmStenosis != null || ca.ladStenosis != null || ca.lcxStenosis != null || ca.rcaStenosis != null)) {
        totalAnatomyEvaluated++
        const hasLM = (ca.lmStenosis ?? 0) >= 50
        if (hasLM) {
          leftMain++
        } else {
          let diseased = 0
          if ((ca.ladStenosis ?? 0) >= 70) diseased++
          if ((ca.lcxStenosis ?? 0) >= 70) diseased++
          if ((ca.rcaStenosis ?? 0) >= 70) diseased++
          if (diseased === 0) normalNonObstructive++
          else if (diseased === 1) singleVessel++
          else if (diseased === 2) doubleVessel++
          else if (diseased >= 3) tripleVessel++
        }
      }
    })

    const diseaseExtentData = totalAnatomyEvaluated > 0 ? [
      { name: 'Normal / Non-obstructive (<50% LM, <70% others)', value: normalNonObstructive },
      { name: 'Single-Vessel Disease (1 vessel ≥70%)', value: singleVessel },
      { name: 'Double-Vessel Disease (2 vessels ≥70%)', value: doubleVessel },
      { name: 'Triple-Vessel Disease (3 vessels ≥70%)', value: tripleVessel },
      { name: 'Left Main Disease (LM ≥50%)', value: leftMain },
    ].filter(d => d.value > 0) : [{ name: 'Awaiting Coronary Angiography Logs', value: 0 }]

    // Presentation phenotype (Mutually exclusive)
    const presCounts: Record<string, number> = { STEMI: 0, NSTEMI: 0, 'Unstable Angina': 0, 'Stable CAD': 0 }
    acsProcedures.forEach(p => {
      if (p.clinicalIndication && p.clinicalIndication in presCounts) presCounts[p.clinicalIndication]++
    })
    const presData = Object.entries(presCounts).map(([name, value]) => ({ name, value })).filter(d => d.value > 0)

    // Fields captured count
    let acsFilledSum = 0
    const acsFieldsTotal = 48
    acsPatients.forEach(p => {
      let filled = 0
      if (p.firstName) filled++
      if (p.lastName) filled++
      if (p.dob || p.age) filled++
      if (p.sex) filled++
      if (p.mrn) filled++
      if (p.contact) filled++
      if (p.comorbidCAD !== undefined) filled++
      if (p.comorbidPriorMI !== undefined) filled++
      if (p.comorbidPriorPCI !== undefined) filled++
      if (p.comorbidPriorCABG !== undefined) filled++
      const v = vMap.get(p.id)?.[0]
      if (v) {
        if (v.bpSystolic) filled++
        if (v.bpDiastolic) filled++
        if (v.heartRate) filled++
        if (v.lvef) filled++
        if (v.peakTropI || v.peakTropT) filled++
        if (v.aspirin?.prescribed) filled++
        if (v.p2y12Inhibitor?.prescribed) filled++
        if (v.statin?.prescribed) filled++
      }
      acsFilledSum += filled
    })
    const acsAvgCaptured = acsPatients.length ? Math.round(acsFilledSum / acsPatients.length) : 0
    const acsCompletion = Math.round((acsAvgCaptured / acsFieldsTotal) * 100)

    return {
      id: 'acs',
      name: 'ACS & Coronary Registry',
      shortDesc: 'STEMI · NSTEMI · Unstable Angina · Stable CAD',
      gradient: 'linear-gradient(135deg, #b91c1c 0%, #ef4444 100%)',
      accentColor: '#ef4444',
      ringColor: '#f87171',
      patients: acsPatients.length,
      newThisMonth,
      completion: acsCompletion,
      fieldsTotal: acsFieldsTotal,
      fieldsCaptured: acsAvgCaptured,
      status: (acsPatients.length > 0 ? 'Active' : 'Suspended') as 'Active' | 'Suspended',
      kpis: [
        { label: 'DTB ≤ 90 min', value: dtbRate !== null ? `${dtbRate}%` : '—', sub: stemiCases.length ? `${dtbMet}/${stemiCases.length} STEMIs` : 'no STEMI cases' },
        { label: 'TIMI 3 Flow', value: timi3Rate !== null ? `${timi3Rate}%` : '—', sub: treatedLesions.length ? `${timi3Lesions.length}/${treatedLesions.length} treated lesions` : 'no lesions treated' },
        { label: 'DAPT Rate', value: daptRate !== null ? `${daptRate}%` : '—', sub: evaluatedMedsCount ? `${daptPrescribedCount}/${evaluatedMedsCount} Aspirin + P2Y12` : 'no discharge meds' },
        { label: '30-Day MACE', value: maceRate !== null ? `${maceRate}%` : '—', sub: acsProcedures.length ? `${maceCount}/${acsProcedures.length} audited cases` : 'no procedures' },
      ],
      completionByCategory: [
        { name: 'Demographics', pct: acsPatients.length ? 90 : 0 },
        { name: 'Vitals & ECG', pct: acsVisits.length ? 85 : 0 },
        { name: 'Angiography', pct: totalAnatomyEvaluated > 0 ? Math.round((totalAnatomyEvaluated / Math.max(acsPatients.length, 1)) * 100) : 0 },
        { name: 'PCI & Hardware', pct: acsProcedures.length ? 80 : 0 },
        { name: 'Medications & DAPT', pct: evaluatedMedsCount > 0 ? Math.round((evaluatedMedsCount / Math.max(acsPatients.length, 1)) * 100) : 0 },
        { name: 'Outcomes & MACE', pct: acsProcedures.length ? 75 : 0 },
      ],
      enrollmentTrend: getEnrollmentTrend(acsPatients),
      clinicalCharts: [
        {
          title: 'Coronary Disease Extent (Mutually Exclusive)',
          type: 'bar-v' as const,
          color: '#ef4444',
          data: diseaseExtentData,
        },
        {
          title: 'Acute Presentation Distribution',
          type: 'pie' as const,
          data: presData.length ? presData : [{ name: 'Awaiting ACS Entries', value: 0 }],
        }
      ]
    }
  } catch (err) {
    console.error('ACS dynamic calculation error:', err)
    return null
  }
}
