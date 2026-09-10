import { Patient, Visit } from '../types'
import { RegistryData } from './types'
import { getEnrollmentTrend } from './utils'
import { pearsonR, spearmanR, log10BNP } from './correlations'
import { safeTime, fullName, getAge } from '../utils'

export function computeHfRegistry(patients: Patient[], visits: Visit[]): RegistryData | null {
  try {
    // 1. Filter to Heart Failure patients
    const hfPatients = patients.filter(
      p => p.registryId === 'hf' || p.hfType === 'HFrEF' || p.hfType === 'HFmrEF' || p.hfType === 'HFpEF' || p.studyConsented
    )
    const patientIds = new Set(hfPatients.map(p => p.id))
    const hfVisits = visits.filter(v => patientIds.has(v.patientId))

    // Pre-index visits by patient ID for O(1) lookups
    const visitsByPatient = new Map<string, Visit[]>()
    hfVisits.forEach(v => {
      let list = visitsByPatient.get(v.patientId)
      if (!list) {
        list = []
        visitsByPatient.set(v.patientId, list)
      }
      list.push(v)
    })

    const latestVisitByPatient = new Map<string, Visit>()
    visitsByPatient.forEach((pVisits, pid) => {
      if (pVisits.length > 0) {
        const latest = pVisits.reduce((l, c) => (safeTime(c.visitDate) > safeTime(l.visitDate) ? c : l), pVisits[0])
        latestVisitByPatient.set(pid, latest)
      }
    })

    // 2. Calculations
    const totalPatients = hfPatients.length

    // Enrolled this month (from patient registration date)
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)
    const newThisMonth = hfPatients.filter(p => p.createdAt && new Date(p.createdAt) >= startOfMonth).length

    // Avg LVEF
    const lvefVals = hfPatients.map(p => p.lvef).filter(v => v !== undefined && v !== null && typeof v === 'number') as number[]
    const avgLvef = lvefVals.length ? Math.round(lvefVals.reduce((a, b) => a + b, 0) / lvefVals.length) : 0

    // GDMT Rate (3+ of RAASi, Beta-Blocker, MRA, SGLT2i)
    let gdmt3PlusCount = 0
    let hfWithMedsCount = 0
    hfPatients.forEach(p => {
      const latest = latestVisitByPatient.get(p.id)
      if (!latest) return
      let activePillars = 0
      if (latest.raasi?.prescribed === 'Yes') activePillars++
      if (latest.betaBlocker?.prescribed === 'Yes') activePillars++
      if (latest.mra?.prescribed === 'Yes') activePillars++
      if (latest.sglt2i?.prescribed === 'Yes') activePillars++
      if (activePillars >= 3) gdmt3PlusCount++
      hfWithMedsCount++
    })
    const gdmtRate = hfWithMedsCount ? Math.round((gdmt3PlusCount / hfWithMedsCount) * 100) : 0

    // NYHA III-IV rate
    let nyha34Count = 0
    let hasNyhaCount = 0
    hfPatients.forEach(p => {
      if (p.nyha) {
        hasNyhaCount++
        if (p.nyha === 'III' || p.nyha === 'IV') {
          nyha34Count++
        }
      }
    })
    const nyhaRate = hasNyhaCount ? Math.round((nyha34Count / hasNyhaCount) * 100) : 0

    // HF Hospitalisation rate
    let hospCount = 0
    let hasHospInfoCount = 0
    hfPatients.forEach(p => {
      const latest = latestVisitByPatient.get(p.id)
      if (!latest) return
      if (latest.hospHistory) {
        hasHospInfoCount++
        if (latest.hospHistory === 'Yes') {
          hospCount++
        }
      }
    })
    const hospRate = hasHospInfoCount ? Math.round((hospCount / hasHospInfoCount) * 100) : 0

    // KCCQ Good/Excellent QoL rate (KCCQ Overall Summary Score >= 75)
    let goodQolCount = 0
    let hasKccqCount = 0
    const kccqDistribution = { Poor: 0, FairGood: 0, Excellent: 0 }
    hfPatients.forEach(p => {
      const latest = latestVisitByPatient.get(p.id)
      if (!latest) return
      if (latest.kccq?.overallSummaryScore !== undefined && latest.kccq?.overallSummaryScore !== null) {
        const score = latest.kccq.overallSummaryScore
        hasKccqCount++
        if (score >= 75) {
          goodQolCount++
          kccqDistribution.Excellent++
        } else if (score >= 50) {
          kccqDistribution.FairGood++
        } else {
          kccqDistribution.Poor++
        }
      }
    })
    const goodQolRate = hasKccqCount ? Math.round((goodQolCount / hasKccqCount) * 100) : 0
    const kccqChartData = [
      { name: 'Poor QoL (< 50)', value: kccqDistribution.Poor },
      { name: 'Fair/Good QoL (50–74)', value: kccqDistribution.FairGood },
      { name: 'Excellent QoL (≥ 75)', value: kccqDistribution.Excellent },
    ].filter(x => x.value > 0)

    // Phenotype Distribution
    const phenotypeCounts = { HFrEF: 0, HFmrEF: 0, HFpEF: 0 }
    hfPatients.forEach(p => {
      if (p.hfType === 'HFrEF') phenotypeCounts.HFrEF++
      else if (p.hfType === 'HFmrEF') phenotypeCounts.HFmrEF++
      else if (p.hfType === 'HFpEF') phenotypeCounts.HFpEF++
    })
    const phenotypeData = [
      { name: 'HFrEF (EF < 40%)', value: phenotypeCounts.HFrEF },
      { name: 'HFmrEF (EF 40–49%)', value: phenotypeCounts.HFmrEF },
      { name: 'HFpEF (EF ≥ 50%)', value: phenotypeCounts.HFpEF },
    ].filter(x => x.value > 0)

    // NYHA Distribution
    const nyhaCounts = { I: 0, II: 0, III: 0, IV: 0 }
    hfPatients.forEach(p => {
      if (p.nyha === 'I') nyhaCounts.I++
      else if (p.nyha === 'II') nyhaCounts.II++
      else if (p.nyha === 'III') nyhaCounts.III++
      else if (p.nyha === 'IV') nyhaCounts.IV++
    })
    const nyhaData = [
      { name: 'Class I', value: nyhaCounts.I },
      { name: 'Class II', value: nyhaCounts.II },
      { name: 'Class III', value: nyhaCounts.III },
      { name: 'Class IV', value: nyhaCounts.IV },
    ].filter(x => x.value > 0)

    // LVEF Bins
    const lvefBins = { '< 30%': 0, '30–39%': 0, '40–49%': 0, '≥ 50%': 0 }
    hfPatients.forEach(p => {
      if (typeof p.lvef === 'number') {
        if (p.lvef < 30) lvefBins['< 30%']++
        else if (p.lvef < 40) lvefBins['30–39%']++
        else if (p.lvef < 50) lvefBins['40–49%']++
        else lvefBins['≥ 50%']++
      }
    })
    const lvefData = Object.entries(lvefBins).map(([name, value]) => ({ name, value }))

    // GDMT Rates
    let activeVisitCount = 0
    const medCounts = { 'Beta-Blocker': 0, 'RAASi (ACEi/ARB/ARNI)': 0, MRA: 0, SGLT2i: 0, Diuretics: 0 }
    hfPatients.forEach(p => {
      const latest = latestVisitByPatient.get(p.id)
      if (!latest) return
      activeVisitCount++
      if (latest.betaBlocker?.prescribed === 'Yes') medCounts['Beta-Blocker']++
      if (latest.raasi?.prescribed === 'Yes') medCounts['RAASi (ACEi/ARB/ARNI)']++
      if (latest.mra?.prescribed === 'Yes') medCounts['MRA']++
      if (latest.sglt2i?.prescribed === 'Yes') medCounts['SGLT2i']++
      if (latest.diuretic?.prescribed === 'Yes') medCounts['Diuretics']++
    })
    const gdmtChartData = Object.entries(medCounts).map(([name, count]) => ({
      name,
      value: activeVisitCount ? Math.round((count / activeVisitCount) * 100) : 0
    }))

    // Symptoms and signs prevalence
    const symptomsSignsCounts: Record<string, number> = {
      'Dyspnoea/PND': 0,
      'Fatigue': 0,
      'History of Edema': 0,
      'Palpitations': 0,
      'Angina': 0,
      'Ascites': 0,
      'Lung Rales': 0,
      'Pleural Effusion': 0,
      'Elevated JVP': 0,
      'S3 Gallop': 0,
      'Dependent Edema': 0,
      'Hepatomegaly': 0,
      'Cardiomegaly': 0
    }
    let totalClinicalVisits = 0
    hfPatients.forEach(p => {
      const latest = latestVisitByPatient.get(p.id)
      if (!latest) return
      totalClinicalVisits++
      if (latest.symptomDyspnea) symptomsSignsCounts['Dyspnoea/PND']++
      if (latest.symptomFatigue) symptomsSignsCounts['Fatigue']++
      if (latest.symptomEdema) symptomsSignsCounts['History of Edema']++
      if (latest.symptomPalpitation) symptomsSignsCounts['Palpitations']++
      if (latest.symptomAngina) symptomsSignsCounts['Angina']++
      if (latest.symptomAscites) symptomsSignsCounts['Ascites']++
      if (latest.signLungRales) symptomsSignsCounts['Lung Rales']++
      if (latest.signPleuralEffusion) symptomsSignsCounts['Pleural Effusion']++
      if (latest.signElevatedJVP) symptomsSignsCounts['Elevated JVP']++
      if (latest.signS3) symptomsSignsCounts['S3 Gallop']++
      if (latest.signDependentEdema) symptomsSignsCounts['Dependent Edema']++
      if (latest.signHepatomegaly) symptomsSignsCounts['Hepatomegaly']++
      if (latest.signCardiomegaly) symptomsSignsCounts['Cardiomegaly']++
    })
    const symptomsSignsData = Object.entries(symptomsSignsCounts)
      .map(([name, count]) => ({
        name,
        value: totalClinicalVisits ? Math.round((count / totalClinicalVisits) * 100) : 0
      }))
      .sort((a, b) => b.value - a.value)

    // Completeness by category
    const categories = [
      { name: 'Demographics', fields: ['firstName', 'lastName', 'dob', 'sex', 'mrn', 'contact', 'address', 'indianCitizen', 'studyConsented', 'abhaId', 'occupation', 'addressHouse', 'addressStreet', 'addressPost', 'addressDistrict', 'addressState', 'addressPin', 'secondaryContact', 'caregiverContact'] },
      { name: 'Vitals & Exam', fields: ['bpSystolic', 'bpDiastolic', 'heartRate', 'weight', 'height', 'o2Sat', 'oedema'] },
      { name: 'Echo / Imaging', fields: ['lvef', 'echoDate', 'lvdd', 'lvsd', 'eEPrime', 'ddGrade', 'rvsp', 'laStrain', 'rvFreeWallStrain', 'lvMassIndex', 'relativeWallThickness'] },
      { name: 'Laboratory', fields: ['ntProBNP', 'bnp', 'egfr', 'creatinine', 'potassium', 'sodium', 'hb', 'tft', 'hba1c', 'ferritin', 'transferrinSat', 'uricAcid', 'ldl', 'triglycerides', 'peakTropT', 'peakTropI', 'serumUrea', 'bun'] },
      { name: 'Medications', fields: ['diuretic', 'raasi', 'betaBlocker', 'digoxin', 'sglt2i', 'ivabradine', 'mra', 'aspirin', 'statin', 'noac', 'vki', 'ivIron'] },
      { name: 'QoL / Functional', fields: ['symptomTrajectory', 'eq5d', 'sixMWT', 'gripRight', 'gripLeft', 'education', 'kccq'] }
    ]

    const categoryAverages: Record<string, number> = {}
    categories.forEach(cat => {
      let totalScoreForCat = 0
      hfPatients.forEach(p => {
        const latest = latestVisitByPatient.get(p.id) || null

        let filled = 0
        cat.fields.forEach(f => {
          if (f in p) {
            const val = (p as any)[f]
            if (val !== undefined && val !== null && val !== '') filled++
          } else if (latest && f in latest) {
            const val = (latest as any)[f]
            if (val !== undefined && val !== null && val !== '') {
              if (typeof val === 'object') {
                if (val.prescribed !== undefined && val.prescribed !== '') filled++
                else if (Object.keys(val).length > 0) filled++
              } else {
                filled++
              }
            }
          }
        })
        totalScoreForCat += Math.round((filled / cat.fields.length) * 100)
      })
      categoryAverages[cat.name] = totalPatients ? Math.round(totalScoreForCat / totalPatients) : 0
    })

    const completionByCategory = Object.entries(categoryAverages).map(([name, pct]) => ({ name, pct }))
    const completionRate = completionByCategory.length
      ? Math.round(completionByCategory.reduce((s, c) => s + c.pct, 0) / completionByCategory.length)
      : 0

    // Enrollment Trend
    const enrollmentTrend = getEnrollmentTrend(hfPatients)

    const allHfFieldNames = Array.from(new Set(categories.flatMap(c => c.fields)))
    let hfTotalFieldsFilledSum = 0
    hfPatients.forEach(p => {
      const latest = latestVisitByPatient.get(p.id) || null
      let filled = 0
      allHfFieldNames.forEach(f => {
        if (f in p) {
          const val = (p as any)[f]
          if (val !== undefined && val !== null && val !== '') filled++
        } else if (latest && f in latest) {
          const val = (latest as any)[f]
          if (val !== undefined && val !== null && val !== '') {
            if (typeof val === 'object') {
              if (val.prescribed !== undefined && val.prescribed !== '') filled++
              else if (Object.keys(val).length > 0) filled++
            } else {
              filled++
            }
          }
        }
      })
      hfTotalFieldsFilledSum += filled
    })
    const actualHfFieldsCaptured = totalPatients ? Math.round(hfTotalFieldsFilledSum / totalPatients) : 0

    // Comorbidity prevalence
    const pct = (n: number) => (totalPatients ? Math.round((n / totalPatients) * 100) : 0)
    const comorbidityCounts = {
      Hypertension: hfPatients.filter(p => p.comorbidHypertension).length,
      'Diabetes Mellitus': hfPatients.filter(p => p.comorbidDiabetes).length,
      'Coronary Artery Disease': hfPatients.filter(p => p.comorbidCAD).length,
      'Prior MI': hfPatients.filter(p => p.comorbidPriorMI).length,
      'Prior PCI': hfPatients.filter(p => p.comorbidPriorPCI).length,
      'Prior CABG': hfPatients.filter(p => p.comorbidPriorCABG).length,
      'Atrial Fibrillation': hfPatients.filter(p => p.comorbidAF).length,
      CKD: hfPatients.filter(p => p.comorbidCKD).length,
      'COPD / Asthma': hfPatients.filter(p => p.comorbidCOPD).length,
      Dyslipidemia: hfPatients.filter(p => p.comorbidDyslipidemia).length,
    }
    const comorbidityData = Object.entries(comorbidityCounts)
      .map(([name, count]) => ({ name, value: pct(count) }))
      .sort((a, b) => b.value - a.value)

    // ECG profile
    const bbbCounts: Record<string, number> = { None: 0, LBBB: 0, RBBB: 0, IVCD: 0 }
    hfVisits.forEach(v => {
      if (!v.bbb) bbbCounts.None++
      else bbbCounts[v.bbb] = (bbbCounts[v.bbb] || 0) + 1
    })
    const bbbData = Object.entries(bbbCounts).map(([name, value]) => ({ name, value })).filter(x => x.value > 0)

    const qrsBins = { '<120 ms': 0, '120–149 ms': 0, '≥150 ms (CRT eligible)': 0 }
    hfVisits.forEach(v => {
      if (!v.qrsDuration) return
      if (v.qrsDuration < 120) qrsBins['<120 ms']++
      else if (v.qrsDuration < 150) qrsBins['120–149 ms']++
      else qrsBins['≥150 ms (CRT eligible)']++
    })
    const qrsData = Object.entries(qrsBins).map(([name, value]) => ({ name, value }))

    // NT-proBNP distribution
    const ntBnpBins = { '<300 pg/mL': 0, '300–1000': 0, '1000–5000': 0, '>5000 pg/mL': 0 }
    hfVisits.forEach(v => {
      if (!v.ntProBNP) return
      if (v.ntProBNP < 300) ntBnpBins['<300 pg/mL']++
      else if (v.ntProBNP < 1000) ntBnpBins['300–1000']++
      else if (v.ntProBNP < 5000) ntBnpBins['1000–5000']++
      else ntBnpBins['>5000 pg/mL']++
    })
    const ntBnpData = Object.entries(ntBnpBins).map(([name, value]) => ({ name, value }))

    // eGFR / CKD staging
    const egfrBins = { 'G5 (<15)': 0, 'G4 (15–29)': 0, 'G3b (30–44)': 0, 'G3a (45–59)': 0, 'G2 (60–89)': 0, 'G1 (≥90)': 0 }
    hfVisits.forEach(v => {
      if (!v.egfr) return
      if (v.egfr < 15) egfrBins['G5 (<15)']++
      else if (v.egfr < 30) egfrBins['G4 (15–29)']++
      else if (v.egfr < 45) egfrBins['G3b (30–44)']++
      else if (v.egfr < 60) egfrBins['G3a (45–59)']++
      else if (v.egfr < 90) egfrBins['G2 (60–89)']++
      else egfrBins['G1 (≥90)']++
    })
    const egfrData = Object.entries(egfrBins).map(([name, value]) => ({ name, value }))

    // 6MWT distribution
    const sixMwtBins = { '<150 m': 0, '150–299 m': 0, '300–449 m': 0, '≥450 m': 0 }
    hfVisits.forEach(v => {
      if (!v.sixMWT) return
      if (v.sixMWT < 150) sixMwtBins['<150 m']++
      else if (v.sixMWT < 300) sixMwtBins['150–299 m']++
      else if (v.sixMWT < 450) sixMwtBins['300–449 m']++
      else sixMwtBins['≥450 m']++
    })
    const sixMwtData = Object.entries(sixMwtBins).map(([name, value]) => ({ name, value }))

    // Device therapy
    const deviceCounts = { 'No Device': 0, ICD: 0, 'CRT-D': 0, 'ICD + CRT-D': 0 }
    hfPatients.forEach(p => {
      if (p.icdPresence && p.crtPresence) deviceCounts['ICD + CRT-D']++
      else if (p.icdPresence) deviceCounts.ICD++
      else if (p.crtPresence) deviceCounts['CRT-D']++
      else deviceCounts['No Device']++
    })
    const deviceData = Object.entries(deviceCounts).map(([name, value]) => ({ name, value })).filter(x => x.value > 0)

    // Vaccination
    const flu = hfVisits.filter(v => v.vaccInfluenza === 'Yes').length
    const pneumo = hfVisits.filter(v => v.vaccPneumo === 'Yes').length
    const totalVacc = activeVisitCount || 1
    const vaccinationData = [
      { name: 'Influenza Vaccine', value: Math.round((flu / totalVacc) * 100) },
      { name: 'Pneumococcal Vaccine', value: Math.round((pneumo / totalVacc) * 100) },
    ]

    // Age distribution
    const ageBins = { '<45': 0, '45–54': 0, '55–64': 0, '65–74': 0, '≥75': 0 }
    hfPatients.forEach(p => {
      if (!p.age && !p.dob) return
      const age = p.age ?? (p.dob ? getAge(p.dob) : null) ?? 55
      if (age < 45) ageBins['<45']++
      else if (age < 55) ageBins['45–54']++
      else if (age < 65) ageBins['55–64']++
      else if (age < 75) ageBins['65–74']++
      else ageBins['≥75']++
    })
    const ageData = Object.entries(ageBins).map(([name, value]) => ({ name, value }))

    const sexData = [
      { name: 'Male', value: hfPatients.filter(p => p.sex === 'Male').length },
      { name: 'Female', value: hfPatients.filter(p => p.sex === 'Female').length },
    ].filter(x => x.value > 0)

    // ─── Research Board: Grip / 6MWT ↔ NT-proBNP in LVEF <40% ─────────────
    const researchBoard = (() => {
      const meanArr = (arr: number[]) => (arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0)
      const meanF = (arr: number[]) => (arr.length ? +(arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(2) : 0)

      // 1. CONSORT counts
      const total = hfPatients.length

      // Exclude: LVEF >= 40% (or missing LVEF)
      const lvefExcluded = hfPatients.filter(p => {
        const latest = latestVisitByPatient.get(p.id)
        const lvef = latest?.lvef ?? p.lvef
        return !lvef || lvef >= 40
      })
      const excludedLvef = lvefExcluded.length

      const hfRefCohort = hfPatients.filter(p => {
        const latest = latestVisitByPatient.get(p.id)
        const lvef = latest?.lvef ?? p.lvef
        return lvef && lvef < 40
      })

      // Exclude: missing NT-proBNP
      const bnpExcluded = hfRefCohort.filter(p => {
        const latest = latestVisitByPatient.get(p.id)
        const bnp = latest?.ntProBNP
        return !bnp || bnp <= 0
      })
      const excludedBnp = bnpExcluded.length

      const hfRefBnpCohort = hfRefCohort.filter(p => {
        const latest = latestVisitByPatient.get(p.id)
        const bnp = latest?.ntProBNP
        return bnp && bnp > 0
      })

      // Exclude: missing BOTH grip and 6MWT
      const functionalExcluded = hfRefBnpCohort.filter(p => {
        const latest = latestVisitByPatient.get(p.id)
        const hasGrip = latest?.gripRight !== undefined && latest.gripRight > 0
        const hasSixMwt = latest?.sixMWT !== undefined && latest.sixMWT > 0
        return !hasGrip && !hasSixMwt
      })
      const excludedFunctional = functionalExcluded.length

      const consort = {
        total,
        excludedLvef,
        excludedBnp,
        excludedFunctional,
        finalCohort: hfRefBnpCohort.length - excludedFunctional,
      }

      // Filter: LVEF <40% AND NT-proBNP recorded
      const eligible = hfPatients.flatMap(p => {
        const latest = latestVisitByPatient.get(p.id)
        if (!latest) return []
        const lvef = latest.lvef ?? p.lvef
        if (!lvef || lvef >= 40) return []
        const ntProBNP = latest.ntProBNP
        if (!ntProBNP || ntProBNP <= 0) return []
        return [{ p, latest, lvef, ntProBNP, nyha: latest.nyha || p.nyha || 'II' }]
      })

      // Scatter 1: Grip vs log10(BNP) — Spearman ρ
      const gripVsBnp = eligible
        .filter(d => d.latest.gripRight !== undefined && d.latest.gripRight > 0)
        .map(d => ({
          x: Math.round(d.latest.gripRight!),
          y: log10BNP(d.ntProBNP),
          yRaw: Math.round(d.ntProBNP),
          nyha: d.nyha as string,
        }))
      const spearmanGripVal = spearmanR(
        gripVsBnp.map(d => d.x),
        gripVsBnp.map(d => d.yRaw)
      )

      // Scatter 2: 6MWT vs log10(BNP) — Spearman ρ
      const sixMwtVsBnp = eligible
        .filter(d => d.latest.sixMWT !== undefined && d.latest.sixMWT > 0)
        .map(d => ({
          x: Math.round(d.latest.sixMWT!),
          y: log10BNP(d.ntProBNP),
          yRaw: Math.round(d.ntProBNP),
          nyha: d.nyha as string,
        }))
      const spearmanSixMWTVal = spearmanR(
        sixMwtVsBnp.map(d => d.x),
        sixMwtVsBnp.map(d => d.yRaw)
      )

      // Scatter 3: Grip vs 6MWT — Pearson r
      const gripVs6MWT = eligible
        .filter(d =>
          d.latest.gripRight !== undefined && d.latest.gripRight > 0 &&
          d.latest.sixMWT !== undefined && d.latest.sixMWT > 0
        )
        .map(d => ({
          x: Math.round(d.latest.gripRight!),
          y: Math.round(d.latest.sixMWT!),
          nyha: d.nyha as string,
        }))
      const pearsonGripSixMWT = pearsonR(gripVs6MWT.map(d => d.x), gripVs6MWT.map(d => d.y))

      // Follow-up delta analysis (3-month grip vs BNP change)
      const followUpDelta = eligible.flatMap(d => {
        const pVisits = visitsByPatient.get(d.p.id) || []
        const fu = pVisits
          .filter(v => v.visitDate !== d.latest.visitDate)
          .sort((a, b) => safeTime(b.visitDate) - safeTime(a.visitDate))[0]
        if (!fu || !fu.gripRight || !fu.ntProBNP) return []
        return [{
          id: d.p.id,
          deltaGrip: Math.round(fu.gripRight - (d.latest.gripRight ?? fu.gripRight)),
          deltaBnp: Math.round(fu.ntProBNP - d.ntProBNP),
          baselineGrip: Math.round(d.latest.gripRight ?? 0),
          followupGrip: Math.round(fu.gripRight),
          baselineBnp: Math.round(d.ntProBNP),
          followupBnp: Math.round(fu.ntProBNP),
          nyha: d.nyha as string,
        }]
      })
      const spearmanDelta = followUpDelta.length >= 2
        ? spearmanR(followUpDelta.map(d => d.deltaGrip), followUpDelta.map(d => d.deltaBnp))
        : 0

      // NT-proBNP quartile stratification
      const sortedByBnp = [...eligible].sort((a, b) => a.ntProBNP - b.ntProBNP)
      const qLen = sortedByBnp.length
      const qGroups = [
        { quartile: 'Q1 — Lowest BNP', data: sortedByBnp.slice(0, Math.floor(qLen * 0.25)) },
        { quartile: 'Q2', data: sortedByBnp.slice(Math.floor(qLen * 0.25), Math.floor(qLen * 0.5)) },
        { quartile: 'Q3', data: sortedByBnp.slice(Math.floor(qLen * 0.5), Math.floor(qLen * 0.75)) },
        { quartile: 'Q4 — Highest BNP', data: sortedByBnp.slice(Math.floor(qLen * 0.75)) },
      ]
      const ntBnpQuartiles = qGroups.map(g => ({
        quartile: g.quartile,
        meanGrip: g.data.filter(d => d.latest.gripRight).length
          ? meanArr(g.data.filter(d => d.latest.gripRight).map(d => d.latest.gripRight!))
          : null,
        meanSixMWT: g.data.filter(d => d.latest.sixMWT).length
          ? meanArr(g.data.filter(d => d.latest.sixMWT).map(d => d.latest.sixMWT!))
          : null,
        n: g.data.length,
        meanBnp: g.data.length ? meanArr(g.data.map(d => d.ntProBNP)) : 0,
      }))

      const gripVals = eligible.filter(d => d.latest.gripRight).map(d => d.latest.gripRight!)
      const sixMwtVals = eligible.filter(d => d.latest.sixMWT).map(d => d.latest.sixMWT!)

      // Subgroups analysis
      const getPtAge = (d: any) => {
        if (typeof d.p.age === 'number') return d.p.age
        if (d.p.dob) {
          const a = getAge(d.p.dob)
          if (a !== null) return a
        }
        return 55
      }

      const getSubgroupCorrelations = (subgroupData: typeof eligible) => {
        const gripBnpData = subgroupData.filter(d => d.latest.gripRight !== undefined && d.latest.gripRight > 0)
        const sixMwtBnpData = subgroupData.filter(d => d.latest.sixMWT !== undefined && d.latest.sixMWT > 0)
        const gripSixMwtData = subgroupData.filter(
          d => d.latest.gripRight !== undefined && d.latest.gripRight > 0 && d.latest.sixMWT !== undefined && d.latest.sixMWT > 0
        )

        const gripBnpCorr = spearmanR(
          gripBnpData.map(d => d.latest.gripRight!),
          gripBnpData.map(d => d.ntProBNP)
        )
        const sixMwtBnpCorr = spearmanR(
          sixMwtBnpData.map(d => d.latest.sixMWT!),
          sixMwtBnpData.map(d => d.ntProBNP)
        )
        const gripSixMwtCorr = pearsonR(
          gripSixMwtData.map(d => d.latest.gripRight!),
          gripSixMwtData.map(d => d.latest.sixMWT!)
        )

        return {
          gripBnp: gripBnpCorr,
          sixMwtBnp: sixMwtBnpCorr,
          gripSixMwt: gripSixMwtCorr,
          n: subgroupData.length,
        }
      }

      const subgroups = {
        all: getSubgroupCorrelations(eligible),
        male: getSubgroupCorrelations(eligible.filter(d => d.p.sex === 'Male')),
        female: getSubgroupCorrelations(eligible.filter(d => d.p.sex === 'Female')),
        ageYoung: getSubgroupCorrelations(eligible.filter(d => getPtAge(d) < 60)),
        ageOld: getSubgroupCorrelations(eligible.filter(d => getPtAge(d) >= 60)),
        nyhaMild: getSubgroupCorrelations(eligible.filter(d => d.nyha === 'I' || d.nyha === 'II')),
        nyhaSevere: getSubgroupCorrelations(eligible.filter(d => d.nyha === 'III' || d.nyha === 'IV')),
      }

      // Paired functional trajectory (baseline vs 3-month grip strength)
      const pairedGripList = eligible.flatMap(d => {
        const pVisits = visitsByPatient.get(d.p.id) || []
        const fu = pVisits
          .filter(v => v.visitType === 'OPD')
          .sort((a, b) => safeTime(b.visitDate) - safeTime(a.visitDate))[0]
        if (!fu || fu.gripRight === undefined || fu.gripRight <= 0) return []

        const baselineGrip = d.latest.gripRight ?? 0
        if (baselineGrip <= 0) return []

        const delta = fu.gripRight - baselineGrip
        const name = fullName(d.p)
        return [{
          id: d.p.id,
          name,
          baseline: Math.round(baselineGrip),
          followup: Math.round(fu.gripRight),
          delta: +delta.toFixed(1),
        }]
      })

      const nPaired = pairedGripList.length
      const baselineMean = nPaired ? meanArr(pairedGripList.map(d => d.baseline)) : 0
      const followupMean = nPaired ? meanArr(pairedGripList.map(d => d.followup)) : 0
      const meanDelta = nPaired ? +(pairedGripList.reduce((acc, d) => acc + d.delta, 0) / nPaired).toFixed(1) : 0
      const improvedCount = pairedGripList.filter(d => d.delta >= 2).length
      const stableCount = pairedGripList.filter(d => d.delta > -2 && d.delta < 2).length
      const declinedCount = pairedGripList.filter(d => d.delta <= -2).length

      const pairedGrip = {
        nPaired,
        baselineMean,
        followupMean,
        meanDelta,
        improvedCount,
        stableCount,
        declinedCount,
        list: pairedGripList,
      }

      return {
        n: eligible.length,
        nGrip: gripVsBnp.length,
        nSixMWT: sixMwtVsBnp.length,
        nGripSixMWT: gripVs6MWT.length,
        nFollowUp: followUpDelta.length,
        spearmanGrip: spearmanGripVal,
        spearmanSixMWT: spearmanSixMWTVal,
        pearsonGripSixMWT,
        spearmanDelta,
        pearsonGrip: spearmanGripVal,
        pearsonSixMWT: spearmanSixMWTVal,
        meanGrip: meanArr(gripVals),
        meanSixMWT: meanArr(sixMwtVals),
        meanNtBnp: meanArr(eligible.map(d => d.ntProBNP)),
        meanLogBnp: meanF(eligible.map(d => log10BNP(d.ntProBNP))),
        gripVsBnp: gripVsBnp.map(d => ({ x: d.x, y: d.y, nyha: d.nyha })),
        sixMwtVsBnp: sixMwtVsBnp.map(d => ({ x: d.x, y: d.y, nyha: d.nyha })),
        gripVs6MWT,
        followUpDelta,
        ntBnpQuartiles,
        consort,
        subgroups,
        pairedGrip,
      }
    })()

    return {
      id: 'hf',
      name: 'Heart Failure Registry',
      shortDesc: 'HFrEF · HFmrEF · HFpEF · Advanced HF',
      gradient: 'linear-gradient(135deg, #1d4ed8 0%, #3b82f6 100%)',
      accentColor: '#3b82f6',
      ringColor: '#60a5fa',
      patients: totalPatients,
      newThisMonth,
      completion: completionRate,
      fieldsTotal: allHfFieldNames.length,
      fieldsCaptured: actualHfFieldsCaptured,
      status: 'Active' as const,
      kpis: [
        { label: 'Avg LVEF', value: `${avgLvef}%`, sub: 'Active registry mean' },
        { label: 'GDMT Rate', value: `${gdmtRate}%`, sub: 'on 3+ core drugs' },
        { label: 'NYHA III–IV', value: `${nyhaRate}%`, sub: 'severe/mod symptoms' },
        { label: 'HF Hospitalisation', value: `${hospRate}%`, sub: 'history of admissions' },
        { label: 'Good/Excellent QoL', value: `${goodQolRate}%`, sub: 'KCCQ overall score ≥ 75' },
      ],
      completionByCategory,
      enrollmentTrend,
      clinicalCharts: [
        {
          title: 'HF Phenotype Distribution',
          type: 'pie' as const,
          data: phenotypeData.length ? phenotypeData : [{ name: 'None Registered', value: 1 }],
        },
        {
          title: 'NYHA Functional Class',
          type: 'pie' as const,
          data: nyhaData.length ? nyhaData : [{ name: 'None Registered', value: 1 }],
        },
        {
          title: 'LVEF Distribution',
          type: 'bar-v' as const,
          color: '#3b82f6',
          data: lvefData,
        },
        {
          title: 'GDMT Prescribing Rates (%)',
          type: 'bar-h' as const,
          color: '#60a5fa',
          data: gdmtChartData,
        },
        {
          title: 'Symptoms & Signs Prevalence (%)',
          type: 'bar-h' as const,
          color: '#34d399',
          data: symptomsSignsData,
        },
        {
          title: 'KCCQ Quality of Life Status',
          type: 'pie' as const,
          data: kccqChartData.length ? kccqChartData : [{ name: 'No QoL Data', value: 1 }],
        },
      ],
      comorbidityData,
      bbbData,
      qrsData,
      ntBnpData,
      egfrData,
      sixMwtData,
      deviceData,
      vaccinationData,
      ageData,
      sexData,
      researchBoard,
    }
  } catch (err) {
    console.error('HF analytics calculation error:', err)
    return null
  }
}
