'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Users, UserPlus, FileText, CheckCircle2, AlertTriangle, Search,
  RefreshCw, PlusCircle, ArrowRight, Activity, Heart, Shield,
  ClipboardList, Edit3, Save, X, ChevronRight, Check, Sparkles,
  Database, Stethoscope, Layers, UploadCloud, LogOut, ArrowUpRight
} from 'lucide-react'
import { getPatients, getVisits, addPatient, addVisit, updateVisit, getAllLatestVisits } from '@/lib/firestore'
import { scoreDataCompleteness } from '@/lib/clinicalIntelligence'
import { generateMRN, getAge, initials } from '@/lib/utils'
import type { Patient, Visit, PatientInput, VisitInput, MedEntry } from '@/lib/types'
import { toast } from 'sonner'

export default function DEOPortalPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'worklist' | 'register' | 'encounter' | 'directory'>('worklist')
  const [loading, setLoading] = useState(true)
  const [patients, setPatients] = useState<Patient[]>([])
  const [latestVisits, setLatestVisits] = useState<Map<string, Visit>>(new Map())
  const [searchQuery, setSearchQuery] = useState('')
  const [filterGrade, setFilterGrade] = useState<'ALL' | 'A' | 'B' | 'C' | 'D'>('ALL')
  
  // Quick Edit Modal State
  const [selectedPatientForEdit, setSelectedPatientForEdit] = useState<{
    patient: Patient
    visit: Visit | null
  } | null>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)
  const [editFormData, setEditFormData] = useState<Partial<VisitInput>>({})

  // New Patient Form State
  const [isRegistering, setIsRegistering] = useState(false)
  const [regForm, setRegForm] = useState({
    firstName: '',
    lastName: '',
    mrn: '',
    age: '',
    sex: 'Male' as 'Male' | 'Female',
    contact: '',
    address: '',
    city: 'Pune',
    state: 'Maharashtra',
    etiology: 'Ischemic Cardiomyopathy (ICM)',
    nyha: 'II' as 'I' | 'II' | 'III' | 'IV',
    lvef: '',
    registryId: 'heart-failure',
    comorbidHypertension: false,
    comorbidDiabetes: false,
    comorbidCAD: false,
    comorbidCKD: false,
    comorbidCOPD: false,
  })

  // Quick Encounter Logger State
  const [encounterPatientId, setEncounterPatientId] = useState('')
  const [isLoggingEncounter, setIsLoggingEncounter] = useState(false)
  const [encounterForm, setEncounterForm] = useState<Partial<VisitInput>>({
    visitDate: new Date().toISOString().split('T')[0],
    visitType: 'OPD',
    bpSystolic: undefined,
    bpDiastolic: undefined,
    heartRate: undefined,
    weight: undefined,
    height: undefined,
    o2Sat: undefined,
    oedema: 'None',
    nyha: 'II',
    lvef: undefined,
    lvdd: undefined,
    tapse: undefined,
    eEPrime: undefined,
    rvsp: undefined,
    rhythm: 'Sinus',
    qrsDuration: undefined,
    bbb: '',
    creatinine: undefined,
    egfr: undefined,
    potassium: undefined,
    sodium: undefined,
    hb: undefined,
    hba1c: undefined,
    ntProBNP: undefined,
    ferritin: undefined,
    transferrinSat: undefined,
    raasi: { prescribed: 'Yes', type: 'Sacubitril/Valsartan', dose: '100mg' },
    betaBlocker: { prescribed: 'Yes', type: 'Bisoprolol', dose: '5mg' },
    mra: { prescribed: 'Yes', type: 'Spironolactone', dose: '25mg' },
    sglt2i: { prescribed: 'Yes', type: 'Dapagliflozin', dose: '10mg' },
    diuretic: { prescribed: 'Yes', type: 'Torsemide', dose: '10mg' },
  })

  // Load Registry Data
  const loadData = async () => {
    setLoading(true)
    try {
      const pts = await getPatients()
      const visitMap = await getAllLatestVisits()
      setPatients(pts)
      setLatestVisits(visitMap)
    } catch (err) {
      console.error('Failed to load DEO portal data:', err)
      toast.error('Failed to load registry records.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Processed Patient Rows with Completeness
  const processedPatients = useMemo(() => {
    return patients.map(patient => {
      const visit = latestVisits.get(patient.id) || null
      const completeness = visit ? scoreDataCompleteness(visit) : {
        overallPct: 20,
        dataGrade: 'D' as const,
        domains: []
      }

      // Collect missing field labels across domains
      const missingLabels: string[] = []
      if (completeness.domains) {
        completeness.domains.forEach(d => {
          if (d.missing && d.missing.length > 0) {
            missingLabels.push(...d.missing)
          }
        })
      }

      return {
        patient,
        visit,
        completenessPct: completeness.overallPct,
        dataGrade: completeness.dataGrade,
        domains: completeness.domains,
        missingLabels
      }
    })
  }, [patients, latestVisits])

  // Filtered Rows for Missing Data Worklist
  const worklistRows = useMemo(() => {
    return processedPatients
      .filter(row => {
        const query = searchQuery.toLowerCase()
        const fullName = `${row.patient.firstName} ${row.patient.lastName}`.toLowerCase()
        const mrn = (row.patient.mrn || row.patient.id).toLowerCase()
        const matchesSearch = fullName.includes(query) || mrn.includes(query)
        const matchesGrade = filterGrade === 'ALL' || row.dataGrade === filterGrade
        return matchesSearch && matchesGrade
      })
      .sort((a, b) => a.completenessPct - b.completenessPct) // lowest completeness first for DEO action
  }, [processedPatients, searchQuery, filterGrade])

  // Overall Statistics
  const stats = useMemo(() => {
    const total = processedPatients.length
    if (total === 0) {
      return { total: 0, gradeA: 0, gradeB: 0, gradeC: 0, gradeD: 0, avgPct: 0, needAction: 0 }
    }
    const gradeA = processedPatients.filter(p => p.dataGrade === 'A').length
    const gradeB = processedPatients.filter(p => p.dataGrade === 'B').length
    const gradeC = processedPatients.filter(p => p.dataGrade === 'C').length
    const gradeD = processedPatients.filter(p => p.dataGrade === 'D').length
    const avgPct = Math.round(processedPatients.reduce((sum, p) => sum + p.completenessPct, 0) / total)
    const needAction = gradeC + gradeD
    return { total, gradeA, gradeB, gradeC, gradeD, avgPct, needAction }
  }, [processedPatients])

  // Open Quick Edit Modal for Missing Fields
  const openQuickEdit = (patient: Patient, visit: Visit | null) => {
    setSelectedPatientForEdit({ patient, visit })
    if (visit) {
      setEditFormData({
        bpSystolic: visit.bpSystolic,
        bpDiastolic: visit.bpDiastolic,
        heartRate: visit.heartRate,
        weight: visit.weight,
        height: visit.height,
        o2Sat: visit.o2Sat,
        oedema: visit.oedema || 'None',
        nyha: visit.nyha || 'II',
        lvef: visit.lvef,
        lvdd: visit.lvdd,
        tapse: visit.tapse,
        eEPrime: visit.eEPrime,
        rvsp: visit.rvsp,
        rhythm: visit.rhythm || 'Sinus',
        qrsDuration: visit.qrsDuration,
        bbb: visit.bbb || '',
        creatinine: visit.creatinine,
        egfr: visit.egfr,
        potassium: visit.potassium,
        sodium: visit.sodium,
        hb: visit.hb,
        hba1c: visit.hba1c,
        ntProBNP: visit.ntProBNP,
        ferritin: visit.ferritin,
        transferrinSat: visit.transferrinSat,
        raasi: visit.raasi || { prescribed: 'Yes', type: 'Sacubitril/Valsartan' },
        betaBlocker: visit.betaBlocker || { prescribed: 'Yes', type: 'Bisoprolol' },
        mra: visit.mra || { prescribed: 'Yes', type: 'Spironolactone' },
        sglt2i: visit.sglt2i || { prescribed: 'Yes', type: 'Dapagliflozin' },
        diuretic: visit.diuretic || { prescribed: 'Yes', type: 'Torsemide' },
      })
    } else {
      setEditFormData({
        visitDate: new Date().toISOString().split('T')[0],
        visitType: 'OPD',
        nyha: 'II',
        oedema: 'None',
        rhythm: 'Sinus',
        bbb: '',
      })
    }
    setIsEditModalOpen(true)
  }

  // Save Quick Edit
  const handleSaveQuickEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedPatientForEdit) return

    setSavingEdit(true)
    const toastId = toast.loading('Updating registry record in Firestore...')

    try {
      const patientId = selectedPatientForEdit.patient.id
      const existingVisit = selectedPatientForEdit.visit

      // Auto-compute eGFR if Creatinine and Age/Sex provided
      let finalFormData = { ...editFormData }
      if (finalFormData.creatinine && selectedPatientForEdit.patient.dob) {
        const age = getAge(selectedPatientForEdit.patient.dob) || selectedPatientForEdit.patient.age || 60
        const isFemale = selectedPatientForEdit.patient.sex === 'Female'
        const scr = finalFormData.creatinine
        const k = isFemale ? 0.7 : 0.9
        const a = isFemale ? -0.241 : -0.302
        const minVal = Math.min(scr / k, 1)
        const maxVal = Math.max(scr / k, 1)
        const calcEgfr = Math.round(142 * (minVal ** a) * (maxVal ** -1.200) * (0.9938 ** age) * (isFemale ? 1.012 : 1))
        if (!finalFormData.egfr) {
          finalFormData.egfr = calcEgfr
        }
      }

      if (existingVisit) {
        await updateVisit(patientId, existingVisit.id, finalFormData)
      } else {
        await addVisit(patientId, {
          visitDate: new Date().toISOString().split('T')[0],
          visitType: 'OPD',
          ...finalFormData,
        } as VisitInput)
      }

      toast.success('Patient registry record updated successfully!', { id: toastId })
      setIsEditModalOpen(false)
      await loadData()
    } catch (err) {
      console.error('Failed to update visit:', err)
      toast.error('Failed to update record in database.', { id: toastId })
    } finally {
      setSavingEdit(false)
    }
  }

  // Handle Register Patient
  const handleRegisterPatient = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!regForm.firstName.trim() || !regForm.lastName.trim()) {
      toast.error('Please enter patient first and last name.')
      return
    }

    setIsRegistering(true)
    const toastId = toast.loading('Registering new patient in registry...')

    try {
      const patientInput: PatientInput = {
        mrn: regForm.mrn.trim() || generateMRN(),
        firstName: regForm.firstName.trim(),
        lastName: regForm.lastName.trim(),
        dob: regForm.age ? new Date(new Date().getFullYear() - Number(regForm.age), 0, 1).toISOString().split('T')[0] : '1965-01-01',
        age: regForm.age ? Number(regForm.age) : undefined,
        sex: regForm.sex,
        contact: regForm.contact.trim(),
        address: regForm.address.trim() || `${regForm.city}, ${regForm.state}`,
        registryId: regForm.registryId,
        indexEtiology: [regForm.etiology],
        nyha: regForm.nyha,
        lvef: regForm.lvef ? Number(regForm.lvef) : undefined,
        comorbidHypertension: regForm.comorbidHypertension,
        comorbidDiabetes: regForm.comorbidDiabetes,
        comorbidCAD: regForm.comorbidCAD,
        comorbidCKD: regForm.comorbidCKD,
        comorbidCOPD: regForm.comorbidCOPD,
      }

      const newId = await addPatient(patientInput)

      // Also create baseline visit if LVEF or NYHA provided
      if (regForm.lvef || regForm.nyha) {
        await addVisit(newId, {
          visitDate: new Date().toISOString().split('T')[0],
          visitType: 'OPD',
          nyha: regForm.nyha,
          lvef: regForm.lvef ? Number(regForm.lvef) : undefined,
          oedema: 'None',
          rhythm: 'Sinus',
          bbb: '',
          diuretic: { prescribed: 'Yes', type: 'Torsemide' },
          raasi: { prescribed: 'Yes', type: 'Sacubitril/Valsartan' },
          betaBlocker: { prescribed: 'Yes', type: 'Bisoprolol' },
          mra: { prescribed: 'Yes', type: 'Spironolactone' },
          sglt2i: { prescribed: 'Yes', type: 'Dapagliflozin' },
        } as VisitInput)
      }

      toast.success(`Patient ${regForm.firstName} ${regForm.lastName} registered successfully!`, { id: toastId })
      
      // Reset Form
      setRegForm({
        firstName: '',
        lastName: '',
        mrn: '',
        age: '',
        sex: 'Male',
        contact: '',
        address: '',
        city: 'Pune',
        state: 'Maharashtra',
        etiology: 'Ischemic Cardiomyopathy (ICM)',
        nyha: 'II',
        lvef: '',
        registryId: 'heart-failure',
        comorbidHypertension: false,
        comorbidDiabetes: false,
        comorbidCAD: false,
        comorbidCKD: false,
        comorbidCOPD: false,
      })

      await loadData()
      setActiveTab('worklist')
    } catch (err) {
      console.error('Failed to register patient:', err)
      toast.error('Failed to register patient in database.', { id: toastId })
    } finally {
      setIsRegistering(false)
    }
  }

  // Handle Rapid Encounter Logger Submit
  const handleLogEncounter = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!encounterPatientId) {
      toast.error('Please select a patient.')
      return
    }

    setIsLoggingEncounter(true)
    const toastId = toast.loading('Saving clinical encounter...')

    try {
      await addVisit(encounterPatientId, encounterForm as VisitInput)
      toast.success('Clinical encounter logged successfully!', { id: toastId })
      setEncounterPatientId('')
      await loadData()
      setActiveTab('worklist')
    } catch (err) {
      console.error('Failed to save encounter:', err)
      toast.error('Failed to save encounter in database.', { id: toastId })
    } finally {
      setIsLoggingEncounter(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#071328] text-slate-100 pb-16 font-sans">
      {/* ── Top Operator Navigation & System Header ── */}
      <header className="sticky top-0 z-40 bg-[#0c1f3d]/90 backdrop-blur-md border-b border-blue-500/20 px-4 lg:px-8 py-3.5">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-tr from-amber-500 to-emerald-500 shadow-lg shadow-amber-500/20">
                <ClipboardList className="w-5 h-5 text-slate-950 font-bold" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base font-bold text-white tracking-tight">DEO Data Entry Portal</h1>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    Operator Desk
                  </span>
                </div>
                <p className="text-xs text-slate-400">AICTS Pune · Cardiac Registry Data Capture & Completeness Workstation</p>
              </div>
            </div>

            {/* Quick refresh on mobile */}
            <button
              onClick={loadData}
              disabled={loading}
              className="md:hidden p-2 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 transition-all"
              title="Refresh Registry Data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Right Action Switchers */}
          <div className="flex items-center gap-3 w-full md:w-auto justify-end">
            <button
              onClick={loadData}
              disabled={loading}
              className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 border border-blue-500/20 text-xs font-medium transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Sync Firestore
            </button>

            <Link
              href="/"
              onClick={() => localStorage.setItem('cardiokonnect_role', 'doctor')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-medium transition-all"
            >
              <Stethoscope className="w-3.5 h-3.5 text-blue-400" />
              Switch to Doctor View
              <ArrowUpRight className="w-3 h-3 text-slate-400" />
            </Link>

            <Link
              href="/login"
              className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-all"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 lg:px-8 pt-6 space-y-6">
        
        {/* ── KPI Highlight Summary ── */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
          <div className="p-4 rounded-xl bg-[#0d2346] border border-blue-500/20 relative overflow-hidden">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-xs font-medium uppercase tracking-wider">Total Enrolled</span>
              <Users className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-2xl font-bold text-white tracking-tight">{stats.total}</div>
            <p className="text-[11px] text-slate-400 mt-0.5">Active patients in registry</p>
          </div>

          <div className="p-4 rounded-xl bg-[#0d2346] border border-emerald-500/20 relative overflow-hidden">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-xs font-medium uppercase tracking-wider">Complete (Grade A)</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-emerald-300 tracking-tight">{stats.gradeA}</div>
            <p className="text-[11px] text-emerald-400/80 mt-0.5">&ge;80% complete audit</p>
          </div>

          <div className="p-4 rounded-xl bg-[#0d2346] border border-blue-500/20 relative overflow-hidden">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-xs font-medium uppercase tracking-wider">Adequate (Grade B)</span>
              <Activity className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-2xl font-bold text-blue-300 tracking-tight">{stats.gradeB}</div>
            <p className="text-[11px] text-slate-400 mt-0.5">60–79% complete audit</p>
          </div>

          <div className="p-4 rounded-xl bg-[#0d2346] border border-amber-500/20 relative overflow-hidden">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-xs font-medium uppercase tracking-wider">Pending (Grade C/D)</span>
              <AlertTriangle className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-bold text-amber-300 tracking-tight">{stats.needAction}</div>
            <p className="text-[11px] text-amber-400/80 mt-0.5">Missing labs or vitals</p>
          </div>

          <div className="col-span-2 lg:col-span-1 p-4 rounded-xl bg-gradient-to-br from-blue-950/80 to-indigo-950/80 border border-blue-400/30 relative overflow-hidden">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-xs font-medium uppercase tracking-wider text-blue-200">Avg Completeness</span>
              <Sparkles className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-bold text-white tracking-tight">{stats.avgPct}%</div>
            <div className="w-full bg-slate-800/80 h-1.5 rounded-full mt-1.5 overflow-hidden">
              <div className="bg-gradient-to-r from-blue-400 to-emerald-400 h-full rounded-full transition-all duration-500" style={{ width: `${stats.avgPct}%` }} />
            </div>
          </div>
        </div>

        {/* ── Main Tab Switcher ── */}
        <div className="flex flex-wrap items-center gap-2 border-b border-blue-500/20 pb-3">
          <button
            onClick={() => setActiveTab('worklist')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all ${
              activeTab === 'worklist'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'bg-[#0c1f3d] text-slate-300 hover:text-white hover:bg-[#112a52] border border-blue-500/10'
            }`}
          >
            <ClipboardList className="w-4 h-4" />
            Missing Data Worklist
            {stats.needAction > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                activeTab === 'worklist' ? 'bg-slate-950 text-amber-400' : 'bg-amber-500/20 text-amber-300'
              }`}>
                {stats.needAction}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('register')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all ${
              activeTab === 'register'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'bg-[#0c1f3d] text-slate-300 hover:text-white hover:bg-[#112a52] border border-blue-500/10'
            }`}
          >
            <UserPlus className="w-4 h-4" />
            Register New Patient
          </button>

          <button
            onClick={() => setActiveTab('encounter')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all ${
              activeTab === 'encounter'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20'
                : 'bg-[#0c1f3d] text-slate-300 hover:text-white hover:bg-[#112a52] border border-blue-500/10'
            }`}
          >
            <Stethoscope className="w-4 h-4" />
            Quick Encounter / Labs
          </button>

          <button
            onClick={() => setActiveTab('directory')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all ${
              activeTab === 'directory'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                : 'bg-[#0c1f3d] text-slate-300 hover:text-white hover:bg-[#112a52] border border-blue-500/10'
            }`}
          >
            <Users className="w-4 h-4" />
            Patient Directory
          </button>
        </div>

        {/* ─────────────────────────────────────────────────────────────
            TAB 1: MISSING DATA RESOLUTION WORKLIST
        ───────────────────────────────────────────────────────────── */}
        {activeTab === 'worklist' && (
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-4 rounded-xl bg-[#0c1f3d] border border-blue-500/20">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter missing data by patient name or Hospital ID / MRN..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-lg bg-[#071328] border border-blue-500/20 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-medium">Quality Grade:</span>
                {(['ALL', 'D', 'C', 'B', 'A'] as const).map(grade => (
                  <button
                    key={grade}
                    onClick={() => setFilterGrade(grade)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                      filterGrade === grade
                        ? grade === 'D' || grade === 'C' ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-blue-600 text-white'
                        : 'bg-[#071328] text-slate-400 hover:text-white border border-blue-500/10'
                    }`}
                  >
                    {grade === 'ALL' ? 'All Grades' : `Grade ${grade}`}
                  </button>
                ))}
              </div>
            </div>

            {/* Patients Worklist Table */}
            <div className="rounded-xl bg-[#0c1f3d] border border-blue-500/20 overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-blue-500/20 bg-[#08172e] text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      <th className="py-3 px-4">Patient & Hospital ID</th>
                      <th className="py-3 px-4">Demographics</th>
                      <th className="py-3 px-4">Completeness Score</th>
                      <th className="py-3 px-4">Missing Registry Parameters</th>
                      <th className="py-3 px-4 text-right">Operator Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-blue-500/10 text-xs">
                    {loading ? (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-slate-400">
                          <Activity className="w-6 h-6 text-amber-500 animate-spin mx-auto mb-2" />
                          Loading registry queue from Firestore...
                        </td>
                      </tr>
                    ) : worklistRows.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-slate-400">
                          <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                          <p className="text-sm font-semibold text-white">No pending records match criteria!</p>
                          <p className="text-xs text-slate-400 mt-1">All selected records meet data completeness standards.</p>
                        </td>
                      </tr>
                    ) : (
                      worklistRows.map(row => {
                        const fullName = `${row.patient.firstName} ${row.patient.lastName}`
                        const age = getAge(row.patient.dob) || row.patient.age || '—'
                        const isGradeCritical = row.dataGrade === 'C' || row.dataGrade === 'D'

                        return (
                          <tr key={row.patient.id} className="hover:bg-blue-500/5 transition-colors">
                            <td className="py-3.5 px-4">
                              <div className="font-semibold text-white text-sm">{fullName}</div>
                              <div className="text-[11px] font-mono text-blue-400 mt-0.5">
                                HID: {row.patient.mrn || row.patient.id.slice(0, 8)}
                              </div>
                            </td>

                            <td className="py-3.5 px-4 text-slate-300">
                              <div>{age} yrs · {row.patient.sex}</div>
                              <div className="text-[11px] text-slate-400 truncate max-w-[140px]">{row.patient.indexEtiology?.[0] || 'Heart Failure'}</div>
                            </td>

                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-2">
                                <span className={`px-2 py-0.5 rounded font-bold text-[11px] ${
                                  row.dataGrade === 'A' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                                  row.dataGrade === 'B' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' :
                                  row.dataGrade === 'C' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                                  'bg-red-500/20 text-red-300 border border-red-500/30'
                                }`}>
                                  Grade {row.dataGrade} ({row.completenessPct}%)
                                </span>
                              </div>
                              <div className="w-28 bg-slate-800 h-1.5 rounded-full mt-1.5 overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    row.completenessPct >= 80 ? 'bg-emerald-400' :
                                    row.completenessPct >= 60 ? 'bg-blue-400' :
                                    row.completenessPct >= 40 ? 'bg-amber-400' : 'bg-red-400'
                                  }`}
                                  style={{ width: `${row.completenessPct}%` }}
                                />
                              </div>
                            </td>

                            <td className="py-3.5 px-4">
                              {row.missingLabels.length === 0 ? (
                                <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                                  <Check className="w-3.5 h-3.5" /> Fully Documented
                                </span>
                              ) : (
                                <div className="flex flex-wrap gap-1 max-w-md">
                                  {row.missingLabels.slice(0, 4).map((label, idx) => (
                                    <span key={idx} className="px-2 py-0.5 rounded text-[10px] font-medium bg-red-500/10 text-red-300 border border-red-500/20">
                                      {label}
                                    </span>
                                  ))}
                                  {row.missingLabels.length > 4 && (
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
                                      +{row.missingLabels.length - 4} more
                                    </span>
                                  )}
                                </div>
                              )}
                            </td>

                            <td className="py-3.5 px-4 text-right">
                              <button
                                onClick={() => openQuickEdit(row.patient, row.visit)}
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                  isGradeCritical
                                    ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-sm shadow-amber-500/20'
                                    : 'bg-blue-600 hover:bg-blue-500 text-white'
                                }`}
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                                Fill Missing Data
                              </button>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            TAB 2: FAST PATIENT REGISTRATION
        ───────────────────────────────────────────────────────────── */}
        {activeTab === 'register' && (
          <div className="max-w-4xl mx-auto rounded-xl bg-[#0c1f3d] border border-blue-500/20 p-6 shadow-xl space-y-6">
            <div className="border-b border-blue-500/20 pb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">Fast Patient Intake Form</h2>
                  <p className="text-xs text-slate-400">Capture essential demographics and clinical etiology for new registry admission</p>
                </div>
              </div>
            </div>

            <form onSubmit={handleRegisterPatient} className="space-y-6">
              {/* Demographics Grid */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-3">1. Patient Demographics & Hospital Identification</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-300 mb-1">First Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Ramesh"
                      value={regForm.firstName}
                      onChange={e => setRegForm({ ...regForm, firstName: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-[#071328] border border-blue-500/20 text-xs text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-300 mb-1">Last Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Patil"
                      value={regForm.lastName}
                      onChange={e => setRegForm({ ...regForm, lastName: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-[#071328] border border-blue-500/20 text-xs text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-300 mb-1">Hospital ID / MRN (Auto if blank)</label>
                    <input
                      type="text"
                      placeholder="e.g. AICTS-HF-2026-089"
                      value={regForm.mrn}
                      onChange={e => setRegForm({ ...regForm, mrn: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-[#071328] border border-blue-500/20 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-300 mb-1">Age (Years)</label>
                    <input
                      type="number"
                      placeholder="e.g. 58"
                      value={regForm.age}
                      onChange={e => setRegForm({ ...regForm, age: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-[#071328] border border-blue-500/20 text-xs text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-300 mb-1">Biological Sex</label>
                    <select
                      value={regForm.sex}
                      onChange={e => setRegForm({ ...regForm, sex: e.target.value as any })}
                      className="w-full px-3 py-2 rounded-lg bg-[#071328] border border-blue-500/20 text-xs text-white focus:outline-none focus:border-blue-500"
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-300 mb-1">Contact Phone</label>
                    <input
                      type="tel"
                      placeholder="e.g. +91 98230 00000"
                      value={regForm.contact}
                      onChange={e => setRegForm({ ...regForm, contact: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-[#071328] border border-blue-500/20 text-xs text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Clinical Baseline Grid */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-3">2. Baseline Clinical Classification</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-300 mb-1">Primary Etiology</label>
                    <select
                      value={regForm.etiology}
                      onChange={e => setRegForm({ ...regForm, etiology: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-[#071328] border border-blue-500/20 text-xs text-white focus:outline-none focus:border-blue-500"
                    >
                      <option value="Ischemic Cardiomyopathy (ICM)">Ischemic Cardiomyopathy (ICM)</option>
                      <option value="Non-Ischemic Dilated Cardiomyopathy (NICM/DCMP)">Non-Ischemic Dilated (NICM/DCMP)</option>
                      <option value="Hypertensive Heart Disease">Hypertensive Heart Disease</option>
                      <option value="Valvular Heart Disease (VHD)">Valvular Heart Disease (VHD)</option>
                      <option value="Diabetic Cardiomyopathy">Diabetic Cardiomyopathy</option>
                      <option value="Hypertrophic Cardiomyopathy (HCM)">Hypertrophic Cardiomyopathy (HCM)</option>
                      <option value="Peripartum Cardiomyopathy">Peripartum Cardiomyopathy</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-300 mb-1">Baseline NYHA Class</label>
                    <select
                      value={regForm.nyha}
                      onChange={e => setRegForm({ ...regForm, nyha: e.target.value as any })}
                      className="w-full px-3 py-2 rounded-lg bg-[#071328] border border-blue-500/20 text-xs text-white focus:outline-none focus:border-blue-500"
                    >
                      <option value="I">Class I (No limitation)</option>
                      <option value="II">Class II (Slight limitation)</option>
                      <option value="III">Class III (Marked limitation)</option>
                      <option value="IV">Class IV (Symptoms at rest)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-300 mb-1">Baseline LVEF (%)</label>
                    <input
                      type="number"
                      placeholder="e.g. 30"
                      value={regForm.lvef}
                      onChange={e => setRegForm({ ...regForm, lvef: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-[#071328] border border-blue-500/20 text-xs text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Comorbidities Checkboxes */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-2">3. Documented Comorbidities</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                  {[
                    { key: 'comorbidHypertension', label: 'Hypertension' },
                    { key: 'comorbidDiabetes', label: 'Diabetes Mellitus' },
                    { key: 'comorbidCAD', label: 'Coronary CAD' },
                    { key: 'comorbidCKD', label: 'Renal CKD' },
                    { key: 'comorbidCOPD', label: 'COPD / Asthma' },
                  ].map(c => (
                    <label key={c.key} className="flex items-center gap-2 p-2.5 rounded-lg bg-[#071328] border border-blue-500/10 cursor-pointer hover:border-blue-500/30">
                      <input
                        type="checkbox"
                        checked={(regForm as any)[c.key]}
                        onChange={e => setRegForm({ ...regForm, [c.key]: e.target.checked })}
                        className="rounded bg-slate-900 border-slate-700 text-blue-500 focus:ring-0"
                      />
                      <span className="text-xs text-slate-200">{c.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-blue-500/20">
                <button
                  type="button"
                  onClick={() => setActiveTab('worklist')}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isRegistering}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold shadow-lg shadow-emerald-500/20 transition-all"
                >
                  <Save className="w-4 h-4" />
                  {isRegistering ? 'Registering...' : 'Register Patient & Add to Worklist'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            TAB 3: QUICK ENCOUNTER & LAB ENTRY
        ───────────────────────────────────────────────────────────── */}
        {activeTab === 'encounter' && (
          <div className="max-w-4xl mx-auto rounded-xl bg-[#0c1f3d] border border-blue-500/20 p-6 shadow-xl space-y-6">
            <div className="border-b border-blue-500/20 pb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                  <Stethoscope className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">Record Clinical Encounter & Laboratories</h2>
                  <p className="text-xs text-slate-400">Log vitals, 2D Echo measurements, 12-lead ECG, blood labs, and 4-pillar GDMT</p>
                </div>
              </div>
            </div>

            <form onSubmit={handleLogEncounter} className="space-y-6">
              {/* Select Patient & Date */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl bg-[#071328] border border-blue-500/20">
                <div>
                  <label className="block text-[11px] font-medium text-amber-300 mb-1">Select Patient *</label>
                  <select
                    required
                    value={encounterPatientId}
                    onChange={e => setEncounterPatientId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#0c1f3d] border border-blue-500/30 text-xs text-white font-medium focus:outline-none focus:border-amber-500"
                  >
                    <option value="">-- Choose Registered Patient --</option>
                    {patients.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.firstName} {p.lastName} (HID: {p.mrn || p.id.slice(0, 8)})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-300 mb-1">Encounter Date *</label>
                  <input
                    type="date"
                    required
                    value={encounterForm.visitDate}
                    onChange={e => setEncounterForm({ ...encounterForm, visitDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-[#0c1f3d] border border-blue-500/30 text-xs text-white focus:outline-none focus:border-amber-500"
                  >
                  </input>
                </div>
              </div>

              {/* Vitals Grid */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-blue-400 mb-3">1. Vital Signs & Physical Findings</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">Systolic BP (mmHg)</label>
                    <input
                      type="number"
                      placeholder="120"
                      value={encounterForm.bpSystolic ?? ''}
                      onChange={e => setEncounterForm({ ...encounterForm, bpSystolic: e.target.value ? Number(e.target.value) : undefined })}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#071328] border border-blue-500/20 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">Diastolic BP (mmHg)</label>
                    <input
                      type="number"
                      placeholder="80"
                      value={encounterForm.bpDiastolic ?? ''}
                      onChange={e => setEncounterForm({ ...encounterForm, bpDiastolic: e.target.value ? Number(e.target.value) : undefined })}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#071328] border border-blue-500/20 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">Heart Rate (bpm)</label>
                    <input
                      type="number"
                      placeholder="72"
                      value={encounterForm.heartRate ?? ''}
                      onChange={e => setEncounterForm({ ...encounterForm, heartRate: e.target.value ? Number(e.target.value) : undefined })}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#071328] border border-blue-500/20 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">SpO2 (%)</label>
                    <input
                      type="number"
                      placeholder="98"
                      value={encounterForm.o2Sat ?? ''}
                      onChange={e => setEncounterForm({ ...encounterForm, o2Sat: e.target.value ? Number(e.target.value) : undefined })}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#071328] border border-blue-500/20 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">Weight (kg)</label>
                    <input
                      type="number"
                      placeholder="65"
                      value={encounterForm.weight ?? ''}
                      onChange={e => setEncounterForm({ ...encounterForm, weight: e.target.value ? Number(e.target.value) : undefined })}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#071328] border border-blue-500/20 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">Oedema Grade</label>
                    <select
                      value={encounterForm.oedema || 'None'}
                      onChange={e => setEncounterForm({ ...encounterForm, oedema: e.target.value as any })}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#071328] border border-blue-500/20 text-xs text-white"
                    >
                      <option value="None">None</option>
                      <option value="Mild (1+)">Mild (1+)</option>
                      <option value="Moderate (2+)">Moderate (2+)</option>
                      <option value="Severe (3+)">Severe (3+)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* 2D Echo & ECG Grid */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-blue-400 mb-3">2. 2D Echocardiography & 12-Lead ECG</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3">
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">LVEF (%)</label>
                    <input
                      type="number"
                      placeholder="30"
                      value={encounterForm.lvef ?? ''}
                      onChange={e => setEncounterForm({ ...encounterForm, lvef: e.target.value ? Number(e.target.value) : undefined })}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#071328] border border-blue-500/20 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">LVEDD (mm)</label>
                    <input
                      type="number"
                      placeholder="55"
                      value={encounterForm.lvdd ?? ''}
                      onChange={e => setEncounterForm({ ...encounterForm, lvdd: e.target.value ? Number(e.target.value) : undefined })}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#071328] border border-blue-500/20 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">TAPSE (mm)</label>
                    <input
                      type="number"
                      placeholder="18"
                      value={encounterForm.tapse ?? ''}
                      onChange={e => setEncounterForm({ ...encounterForm, tapse: e.target.value ? Number(e.target.value) : undefined })}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#071328] border border-blue-500/20 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">E/e' Ratio</label>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="14"
                      value={encounterForm.eEPrime ?? ''}
                      onChange={e => setEncounterForm({ ...encounterForm, eEPrime: e.target.value ? Number(e.target.value) : undefined })}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#071328] border border-blue-500/20 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">RVSP (mmHg)</label>
                    <input
                      type="number"
                      placeholder="35"
                      value={encounterForm.rvsp ?? ''}
                      onChange={e => setEncounterForm({ ...encounterForm, rvsp: e.target.value ? Number(e.target.value) : undefined })}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#071328] border border-blue-500/20 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">QRS Duration (ms)</label>
                    <input
                      type="number"
                      placeholder="110"
                      value={encounterForm.qrsDuration ?? ''}
                      onChange={e => setEncounterForm({ ...encounterForm, qrsDuration: e.target.value ? Number(e.target.value) : undefined })}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#071328] border border-blue-500/20 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">Conduction / BBB</label>
                    <select
                      value={encounterForm.bbb || ''}
                      onChange={e => setEncounterForm({ ...encounterForm, bbb: e.target.value as any })}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#071328] border border-blue-500/20 text-xs text-white"
                    >
                      <option value="">None / Narrow</option>
                      <option value="LBBB">LBBB</option>
                      <option value="RBBB">RBBB</option>
                      <option value="IVCD">IVCD / Non-specific</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Lab Parameters Grid */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-blue-400 mb-3">3. Blood Laboratory Parameters</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-3">
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">Creatinine (mg/dL)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="1.0"
                      value={encounterForm.creatinine ?? ''}
                      onChange={e => setEncounterForm({ ...encounterForm, creatinine: e.target.value ? Number(e.target.value) : undefined })}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#071328] border border-blue-500/20 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">eGFR (mL/min)</label>
                    <input
                      type="number"
                      placeholder="75"
                      value={encounterForm.egfr ?? ''}
                      onChange={e => setEncounterForm({ ...encounterForm, egfr: e.target.value ? Number(e.target.value) : undefined })}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#071328] border border-blue-500/20 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">Potassium (mEq/L)</label>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="4.2"
                      value={encounterForm.potassium ?? ''}
                      onChange={e => setEncounterForm({ ...encounterForm, potassium: e.target.value ? Number(e.target.value) : undefined })}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#071328] border border-blue-500/20 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">Sodium (mEq/L)</label>
                    <input
                      type="number"
                      placeholder="138"
                      value={encounterForm.sodium ?? ''}
                      onChange={e => setEncounterForm({ ...encounterForm, sodium: e.target.value ? Number(e.target.value) : undefined })}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#071328] border border-blue-500/20 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">Hb (g/dL)</label>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="12.5"
                      value={encounterForm.hb ?? ''}
                      onChange={e => setEncounterForm({ ...encounterForm, hb: e.target.value ? Number(e.target.value) : undefined })}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#071328] border border-blue-500/20 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">NT-proBNP (pg/mL)</label>
                    <input
                      type="number"
                      placeholder="1200"
                      value={encounterForm.ntProBNP ?? ''}
                      onChange={e => setEncounterForm({ ...encounterForm, ntProBNP: e.target.value ? Number(e.target.value) : undefined })}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#071328] border border-blue-500/20 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">Ferritin (ng/mL)</label>
                    <input
                      type="number"
                      placeholder="150"
                      value={encounterForm.ferritin ?? ''}
                      onChange={e => setEncounterForm({ ...encounterForm, ferritin: e.target.value ? Number(e.target.value) : undefined })}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#071328] border border-blue-500/20 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">TSAT (%)</label>
                    <input
                      type="number"
                      placeholder="25"
                      value={encounterForm.transferrinSat ?? ''}
                      onChange={e => setEncounterForm({ ...encounterForm, transferrinSat: e.target.value ? Number(e.target.value) : undefined })}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#071328] border border-blue-500/20 text-xs text-white"
                    />
                  </div>
                </div>
              </div>

              {/* 4-Pillar GDMT Check */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-blue-400 mb-3">4. 4-Pillar Guideline-Directed Medical Therapy (GDMT)</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { key: 'raasi', title: '1. RAASi / ARNI', defaultDrug: 'Sacubitril/Valsartan' },
                    { key: 'betaBlocker', title: '2. Beta-Blocker', defaultDrug: 'Bisoprolol' },
                    { key: 'mra', title: '3. MRA Antagonist', defaultDrug: 'Spironolactone' },
                    { key: 'sglt2i', title: '4. SGLT2 Inhibitor', defaultDrug: 'Dapagliflozin' },
                  ].map(pillar => (
                    <div key={pillar.key} className="p-3 rounded-xl bg-[#071328] border border-blue-500/20 space-y-2">
                      <div className="text-[11px] font-bold text-slate-200">{pillar.title}</div>
                      <div className="flex items-center gap-2">
                        <select
                          value={(encounterForm as any)[pillar.key]?.prescribed || 'Yes'}
                          onChange={e => setEncounterForm({
                            ...encounterForm,
                            [pillar.key]: {
                              ...(encounterForm as any)[pillar.key],
                              prescribed: e.target.value,
                              type: e.target.value === 'Yes' ? pillar.defaultDrug : undefined
                            }
                          })}
                          className="w-full px-2 py-1 rounded bg-[#0c1f3d] border border-blue-500/20 text-xs text-white"
                        >
                          <option value="Yes">Prescribed (Yes)</option>
                          <option value="No">Not Prescribed (No)</option>
                          <option value="Contraindicated">Contraindicated</option>
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-blue-500/20">
                <button
                  type="button"
                  onClick={() => setActiveTab('worklist')}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoggingEncounter}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold shadow-lg shadow-emerald-500/20 transition-all"
                >
                  <Save className="w-4 h-4" />
                  {isLoggingEncounter ? 'Saving...' : 'Save Encounter to Registry'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            TAB 4: PATIENT DIRECTORY
        ───────────────────────────────────────────────────────────── */}
        {activeTab === 'directory' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 rounded-xl bg-[#0c1f3d] border border-blue-500/20">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search directory by patient name, phone, or MRN..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-lg bg-[#071328] border border-blue-500/20 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <button
                onClick={() => setActiveTab('register')}
                className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-md shadow-blue-500/20"
              >
                <UserPlus className="w-4 h-4" />
                Add New Patient
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {processedPatients
                .filter(row => {
                  const query = searchQuery.toLowerCase()
                  const fullName = `${row.patient.firstName} ${row.patient.lastName}`.toLowerCase()
                  const mrn = (row.patient.mrn || row.patient.id).toLowerCase()
                  return fullName.includes(query) || mrn.includes(query)
                })
                .map(row => {
                  const fullName = `${row.patient.firstName} ${row.patient.lastName}`
                  const age = getAge(row.patient.dob) || row.patient.age || '—'

                  return (
                    <div key={row.patient.id} className="p-4 rounded-xl bg-[#0c1f3d] border border-blue-500/20 hover:border-blue-500/40 transition-all flex flex-col justify-between space-y-3">
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-white text-sm">{fullName}</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            row.dataGrade === 'A' ? 'bg-emerald-500/20 text-emerald-300' :
                            row.dataGrade === 'B' ? 'bg-blue-500/20 text-blue-300' :
                            row.dataGrade === 'C' ? 'bg-amber-500/20 text-amber-300' : 'bg-red-500/20 text-red-300'
                          }`}>
                            Grade {row.dataGrade} ({row.completenessPct}%)
                          </span>
                        </div>
                        <div className="text-[11px] font-mono text-blue-400 mt-0.5">
                          HID: {row.patient.mrn || row.patient.id.slice(0, 8)}
                        </div>
                        <div className="text-xs text-slate-300 mt-2">
                          {age} yrs · {row.patient.sex} · {row.patient.address || 'AICTS Pune'}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5 truncate">
                          {row.patient.indexEtiology?.[0] || 'Heart Failure'}
                        </div>
                      </div>

                      <div className="pt-3 border-t border-blue-500/10 flex items-center justify-between">
                        <span className="text-[11px] text-slate-400">
                          {row.visit ? `Last Visit: ${row.visit.visitDate}` : 'No visits recorded'}
                        </span>
                        <button
                          onClick={() => openQuickEdit(row.patient, row.visit)}
                          className="px-2.5 py-1 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 border border-blue-500/20 text-xs font-medium transition-all"
                        >
                          Quick Edit
                        </button>
                      </div>
                    </div>
                  )
                })}
            </div>
          </div>
        )}

      </div>

      {/* ─────────────────────────────────────────────────────────────
          QUICK EDIT / MISSING DATA RESOLUTION MODAL
      ───────────────────────────────────────────────────────────── */}
      {isEditModalOpen && selectedPatientForEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className="relative w-full max-w-3xl my-8 rounded-2xl bg-[#0c1f3d] border border-blue-500/30 shadow-2xl overflow-hidden">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-[#08172e] border-b border-blue-500/20">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center font-bold">
                  <Edit3 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    Update Registry Record · {selectedPatientForEdit.patient.firstName} {selectedPatientForEdit.patient.lastName}
                  </h3>
                  <p className="text-[11px] text-slate-400 font-mono">
                    Hospital ID: {selectedPatientForEdit.patient.mrn || selectedPatientForEdit.patient.id}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveQuickEdit} className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
              
              {/* Vitals Section */}
              <div>
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-amber-400 mb-2">Vital Signs & Physical State</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                  <div>
                    <label className="block text-[10px] text-slate-300 mb-1">Systolic BP</label>
                    <input
                      type="number"
                      placeholder="mmHg"
                      value={editFormData.bpSystolic ?? ''}
                      onChange={e => setEditFormData({ ...editFormData, bpSystolic: e.target.value ? Number(e.target.value) : undefined })}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#071328] border border-blue-500/20 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-300 mb-1">Diastolic BP</label>
                    <input
                      type="number"
                      placeholder="mmHg"
                      value={editFormData.bpDiastolic ?? ''}
                      onChange={e => setEditFormData({ ...editFormData, bpDiastolic: e.target.value ? Number(e.target.value) : undefined })}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#071328] border border-blue-500/20 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-300 mb-1">Heart Rate</label>
                    <input
                      type="number"
                      placeholder="bpm"
                      value={editFormData.heartRate ?? ''}
                      onChange={e => setEditFormData({ ...editFormData, heartRate: e.target.value ? Number(e.target.value) : undefined })}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#071328] border border-blue-500/20 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-300 mb-1">SpO2 (%)</label>
                    <input
                      type="number"
                      placeholder="%"
                      value={editFormData.o2Sat ?? ''}
                      onChange={e => setEditFormData({ ...editFormData, o2Sat: e.target.value ? Number(e.target.value) : undefined })}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#071328] border border-blue-500/20 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-300 mb-1">Weight (kg)</label>
                    <input
                      type="number"
                      placeholder="kg"
                      value={editFormData.weight ?? ''}
                      onChange={e => setEditFormData({ ...editFormData, weight: e.target.value ? Number(e.target.value) : undefined })}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#071328] border border-blue-500/20 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-300 mb-1">Oedema</label>
                    <select
                      value={editFormData.oedema || 'None'}
                      onChange={e => setEditFormData({ ...editFormData, oedema: e.target.value as any })}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#071328] border border-blue-500/20 text-xs text-white"
                    >
                      <option value="None">None</option>
                      <option value="Mild (1+)">Mild (1+)</option>
                      <option value="Moderate (2+)">Moderate (2+)</option>
                      <option value="Severe (3+)">Severe (3+)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* 2D Echo & ECG Section */}
              <div>
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-amber-400 mb-2">2D Echocardiography & ECG Conduction</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3">
                  <div>
                    <label className="block text-[10px] text-slate-300 mb-1">LVEF (%)</label>
                    <input
                      type="number"
                      placeholder="%"
                      value={editFormData.lvef ?? ''}
                      onChange={e => setEditFormData({ ...editFormData, lvef: e.target.value ? Number(e.target.value) : undefined })}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#071328] border border-blue-500/20 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-300 mb-1">LVEDD (mm)</label>
                    <input
                      type="number"
                      placeholder="mm"
                      value={editFormData.lvdd ?? ''}
                      onChange={e => setEditFormData({ ...editFormData, lvdd: e.target.value ? Number(e.target.value) : undefined })}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#071328] border border-blue-500/20 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-300 mb-1">TAPSE (mm)</label>
                    <input
                      type="number"
                      placeholder="mm"
                      value={editFormData.tapse ?? ''}
                      onChange={e => setEditFormData({ ...editFormData, tapse: e.target.value ? Number(e.target.value) : undefined })}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#071328] border border-blue-500/20 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-300 mb-1">E/e' Ratio</label>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="Ratio"
                      value={editFormData.eEPrime ?? ''}
                      onChange={e => setEditFormData({ ...editFormData, eEPrime: e.target.value ? Number(e.target.value) : undefined })}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#071328] border border-blue-500/20 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-300 mb-1">RVSP (mmHg)</label>
                    <input
                      type="number"
                      placeholder="mmHg"
                      value={editFormData.rvsp ?? ''}
                      onChange={e => setEditFormData({ ...editFormData, rvsp: e.target.value ? Number(e.target.value) : undefined })}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#071328] border border-blue-500/20 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-300 mb-1">QRS (ms)</label>
                    <input
                      type="number"
                      placeholder="ms"
                      value={editFormData.qrsDuration ?? ''}
                      onChange={e => setEditFormData({ ...editFormData, qrsDuration: e.target.value ? Number(e.target.value) : undefined })}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#071328] border border-blue-500/20 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-300 mb-1">Conduction/BBB</label>
                    <select
                      value={editFormData.bbb || ''}
                      onChange={e => setEditFormData({ ...editFormData, bbb: e.target.value as any })}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#071328] border border-blue-500/20 text-xs text-white"
                    >
                      <option value="">None</option>
                      <option value="LBBB">LBBB</option>
                      <option value="RBBB">RBBB</option>
                      <option value="IVCD">IVCD</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Labs Section */}
              <div>
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-amber-400 mb-2">Blood Laboratory Values</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-3">
                  <div>
                    <label className="block text-[10px] text-slate-300 mb-1">Creatinine</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="mg/dL"
                      value={editFormData.creatinine ?? ''}
                      onChange={e => setEditFormData({ ...editFormData, creatinine: e.target.value ? Number(e.target.value) : undefined })}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#071328] border border-blue-500/20 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-300 mb-1">eGFR</label>
                    <input
                      type="number"
                      placeholder="mL/min"
                      value={editFormData.egfr ?? ''}
                      onChange={e => setEditFormData({ ...editFormData, egfr: e.target.value ? Number(e.target.value) : undefined })}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#071328] border border-blue-500/20 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-300 mb-1">Potassium</label>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="mEq/L"
                      value={editFormData.potassium ?? ''}
                      onChange={e => setEditFormData({ ...editFormData, potassium: e.target.value ? Number(e.target.value) : undefined })}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#071328] border border-blue-500/20 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-300 mb-1">Sodium</label>
                    <input
                      type="number"
                      placeholder="mEq/L"
                      value={editFormData.sodium ?? ''}
                      onChange={e => setEditFormData({ ...editFormData, sodium: e.target.value ? Number(e.target.value) : undefined })}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#071328] border border-blue-500/20 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-300 mb-1">Hb (g/dL)</label>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="g/dL"
                      value={editFormData.hb ?? ''}
                      onChange={e => setEditFormData({ ...editFormData, hb: e.target.value ? Number(e.target.value) : undefined })}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#071328] border border-blue-500/20 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-300 mb-1">NT-proBNP</label>
                    <input
                      type="number"
                      placeholder="pg/mL"
                      value={editFormData.ntProBNP ?? ''}
                      onChange={e => setEditFormData({ ...editFormData, ntProBNP: e.target.value ? Number(e.target.value) : undefined })}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#071328] border border-blue-500/20 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-300 mb-1">Ferritin</label>
                    <input
                      type="number"
                      placeholder="ng/mL"
                      value={editFormData.ferritin ?? ''}
                      onChange={e => setEditFormData({ ...editFormData, ferritin: e.target.value ? Number(e.target.value) : undefined })}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#071328] border border-blue-500/20 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-300 mb-1">TSAT (%)</label>
                    <input
                      type="number"
                      placeholder="%"
                      value={editFormData.transferrinSat ?? ''}
                      onChange={e => setEditFormData({ ...editFormData, transferrinSat: e.target.value ? Number(e.target.value) : undefined })}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#071328] border border-blue-500/20 text-xs text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Modal Footer Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-blue-500/20">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-lg shadow-amber-500/20 transition-all"
                >
                  <Save className="w-4 h-4" />
                  {savingEdit ? 'Updating Firestore...' : 'Save & Resolve Missing Fields'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}
