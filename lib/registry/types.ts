export interface ChartItem {
  name: string
  value: number
}

export interface ClinicalChart {
  title: string
  type: 'pie' | 'bar-h' | 'bar-v'
  color?: string
  data: ChartItem[]
}

export interface RegistryData {
  id: string
  name: string
  shortDesc: string
  gradient: string
  accentColor: string
  ringColor: string
  patients: number
  newThisMonth: number
  completion: number
  fieldsTotal: number
  fieldsCaptured: number
  status: 'Active' | 'Enrolling' | 'Suspended'
  kpis: { label: string; value: string; sub?: string }[]
  completionByCategory: { name: string; pct: number }[]
  enrollmentTrend: { month: string; count: number }[]
  clinicalCharts: ClinicalChart[]
  // HF-specific extended analytics (optional)
  comorbidityData?: ChartItem[]
  bbbData?: ChartItem[]
  qrsData?: ChartItem[]
  ntBnpData?: ChartItem[]
  egfrData?: ChartItem[]
  sixMwtData?: ChartItem[]
  deviceData?: ChartItem[]
  vaccinationData?: ChartItem[]
  ageData?: ChartItem[]
  sexData?: ChartItem[]
  researchBoard?: {
    n: number
    pearsonGrip: number
    pearsonSixMWT: number
    meanGrip: number
    meanSixMWT: number
    meanNtBnp: number
    gripVsBnp: { x: number; y: number; nyha: string }[]
    sixMwtVsBnp: { x: number; y: number; nyha: string }[]
    ntBnpQuartiles: { quartile: string; meanGrip: number | null; meanSixMWT: number | null; n: number; meanBnp: number }[]
    gripVs6MWT?: { x: number; y: number; nyha: string }[]
    pearsonGripSixMWT?: number
    spearmanGrip?: number
    spearmanSixMWT?: number
    spearmanDelta?: number
    consort?: {
      total: number
      excludedLvef: number
      excludedBnp: number
      excludedFunctional: number
      finalCohort: number
    }
    subgroups?: {
      all: { gripBnp: number; sixMwtBnp: number; gripSixMwt: number; n: number }
      male: { gripBnp: number; sixMwtBnp: number; gripSixMwt: number; n: number }
      female: { gripBnp: number; sixMwtBnp: number; gripSixMwt: number; n: number }
      ageYoung: { gripBnp: number; sixMwtBnp: number; gripSixMwt: number; n: number }
      ageOld: { gripBnp: number; sixMwtBnp: number; gripSixMwt: number; n: number }
      nyhaMild: { gripBnp: number; sixMwtBnp: number; gripSixMwt: number; n: number }
      nyhaSevere: { gripBnp: number; sixMwtBnp: number; gripSixMwt: number; n: number }
    }
    pairedGrip?: {
      nPaired: number
      baselineMean: number
      followupMean: number
      meanDelta: number
      improvedCount: number
      stableCount: number
      declinedCount: number
      list: { id: string; baseline: number; followup: number; delta: number; name: string }[]
    }
  }
}
