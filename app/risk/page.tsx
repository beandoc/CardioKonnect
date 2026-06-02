'use client'
import { useState, useMemo } from 'react'
import { FlaskConical, Calculator, Heart, Info, ArrowRight, ShieldCheck, Activity } from 'lucide-react'
import Button from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/utils'
import { calculateMAGGIC, calculateH2FPEF, calculateCHARM } from '@/lib/riskScores'

export default function RiskCalculatorsPage() {
  const [activeCalculator, setActiveCalculator] = useState<'maggic' | 'h2fpef' | 'charm'>('maggic')
  const [crUnit, setCrUnit] = useState<'mg/dL' | 'umol/L'>('mg/dL')

  const handleCrUnitChange = (newUnit: 'mg/dL' | 'umol/L') => {
    if (crUnit === newUnit) return;
    setCrUnit(newUnit);
    if (newUnit === 'umol/L') {
      setMaggicCr(+(maggicCr * 88.4).toFixed(2));
      setCharmCr(+(charmCr * 88.4).toFixed(2));
    } else {
      setMaggicCr(+(maggicCr / 88.4).toFixed(2));
      setCharmCr(+(charmCr / 88.4).toFixed(2));
    }
  }

  // MAGGIC inputs state
  const [maggicAge, setMaggicAge] = useState(65)
  const [maggicLvef, setMaggicLvef] = useState(35)
  const [maggicSbp, setMaggicSbp] = useState(120)
  const [maggicBmi, setMaggicBmi] = useState(24)
  const [maggicCr, setMaggicCr] = useState(1.13)
  const [maggicNyha, setMaggicNyha] = useState<'I' | 'II' | 'III' | 'IV'>('II')
  const [maggicSex, setMaggicSex] = useState<'Male' | 'Female'>('Male')
  const [maggicDiabetes, setMaggicDiabetes] = useState(true)
  const [maggicSmoker, setMaggicSmoker] = useState(false)
  const [maggicCopd, setMaggicCopd] = useState(false)
  const [maggicHfYears, setMaggicHfYears] = useState(2)
  const [maggicBb, setMaggicBb] = useState(true)
  const [maggicAce, setMaggicAce] = useState(true)

  // H2FPEF inputs state
  const [h2Bmi, setH2Bmi] = useState(32)
  const [h2Meds, setH2Meds] = useState(2)
  const [h2Af, setH2Af] = useState(true)
  const [h2Pap, setH2Pap] = useState(40)
  const [h2Age, setH2Age] = useState(65)
  const [h2EEPrime, setH2EEPrime] = useState(11)

  // CHARM inputs state
  const [charmAge, setCharmAge] = useState(65)
  const [charmNyha, setCharmNyha] = useState<'I' | 'II' | 'III' | 'IV'>('III')
  const [charmLvef, setCharmLvef] = useState(30)
  const [charmCr, setCharmCr] = useState(1.24)
  const [charmSodium, setCharmSodium] = useState(136)
  const [charmDiabetes, setCharmDiabetes] = useState(true)
  const [charmCopd, setCharmCopd] = useState(false)
  const [charmSmoker, setCharmSmoker] = useState(true)

  // Compute values
  const maggicResult = useMemo(() => {
    const crMgDl = crUnit === 'umol/L' ? maggicCr / 88.4 : maggicCr;
    return calculateMAGGIC({
      age: maggicAge,
      lvef: maggicLvef,
      systolicBP: maggicSbp,
      bmi: maggicBmi,
      creatinine: crMgDl,
      nyha: maggicNyha,
      sex: maggicSex,
      diabetesMellitus: maggicDiabetes,
      currentSmoker: maggicSmoker,
      copd: maggicCopd,
      heartFailureDiagnosisYears: maggicHfYears,
      betaBlocker: maggicBb,
      aceInhibitorOrArb: maggicAce
    })
  }, [maggicAge, maggicLvef, maggicSbp, maggicBmi, maggicCr, crUnit, maggicNyha, maggicSex, maggicDiabetes, maggicSmoker, maggicCopd, maggicHfYears, maggicBb, maggicAce])

  const h2fpefResult = useMemo(() => {
    return calculateH2FPEF({
      bmi: h2Bmi,
      antihypertensiveDrugs: h2Meds,
      atrialFibrillation: h2Af,
      pulmonaryArterialPressure: h2Pap,
      age: h2Age,
      echoEEPrime: h2EEPrime
    })
  }, [h2Bmi, h2Meds, h2Af, h2Pap, h2Age, h2EEPrime])

  const charmResult = useMemo(() => {
    const crMgDl = crUnit === 'umol/L' ? charmCr / 88.4 : charmCr;
    return calculateCHARM({
      age: charmAge,
      nyha: charmNyha,
      lvef: charmLvef,
      creatinine: crMgDl,
      sodium: charmSodium,
      diabetes: charmDiabetes,
      copd: charmCopd,
      currentSmoker: charmSmoker
    })
  }, [charmAge, charmNyha, charmLvef, charmCr, crUnit, charmSodium, charmDiabetes, charmCopd, charmSmoker])

  return (
    <div className="space-y-6 animate-fade-in text-gray-300">
      
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl bg-violet-600/10 border border-violet-500/20 flex items-center justify-center text-violet-400 flex-shrink-0">
          <FlaskConical className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white leading-tight">Cardiovascular Risk Stratification</h2>
          <p className="text-xs text-gray-400 mt-1">
            Validated clinical calculators to estimate mortality, event rates, and diagnostic probabilities.
          </p>
        </div>
      </div>

      {/* Calculator Selector Tabs */}
      <div className="flex border-b border-blue-500/10 pb-3 gap-6 flex-wrap">
        <button
          onClick={() => setActiveCalculator('maggic')}
          className={cn("text-xs font-semibold pb-2 border-b-2 px-1 transition-all",
            activeCalculator === 'maggic' ? "border-blue-500 text-white" : "border-transparent text-gray-400 hover:text-gray-200"
          )}
        >
          MAGGIC Mortality Risk
        </button>
        <button
          onClick={() => setActiveCalculator('h2fpef')}
          className={cn("text-xs font-semibold pb-2 border-b-2 px-1 transition-all",
            activeCalculator === 'h2fpef' ? "border-blue-500 text-white" : "border-transparent text-gray-400 hover:text-gray-200"
          )}
        >
          H2FPEF Diagnostic Score
        </button>
        <button
          onClick={() => setActiveCalculator('charm')}
          className={cn("text-xs font-semibold pb-2 border-b-2 px-1 transition-all",
            activeCalculator === 'charm' ? "border-blue-500 text-white" : "border-transparent text-gray-400 hover:text-gray-200"
          )}
        >
          CHARM CV Event Rate
        </button>
      </div>

      {/* Calculator Body Split Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Side: Inputs Panel */}
        <div className="lg:col-span-7 space-y-6">
          <div className="glass-card p-5 space-y-4">
            <h3 className="text-sm font-semibold text-white pb-2 border-b border-blue-500/10 flex items-center gap-2">
              <Calculator className="w-4 h-4 text-blue-400" /> Calculator Parameters
            </h3>

            {/* MAGGIC Parameters */}
            {activeCalculator === 'maggic' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="form-label">Age (years)</label>
                  <input type="number" min={18} max={120} className="form-input" value={maggicAge} onChange={e => setMaggicAge(parseInt(e.target.value) || 0)} />
                </div>
                <div>
                  <label className="form-label">LVEF (%)</label>
                  <input type="number" min={5} max={85} className="form-input" value={maggicLvef} onChange={e => setMaggicLvef(parseInt(e.target.value) || 0)} />
                </div>
                <div>
                  <label className="form-label">Systolic BP (mmHg)</label>
                  <input type="number" min={50} max={250} className="form-input" value={maggicSbp} onChange={e => setMaggicSbp(parseInt(e.target.value) || 0)} />
                </div>
                <div>
                  <label className="form-label">BMI (kg/m²)</label>
                  <input type="number" min={10} max={60} step="0.1" className="form-input" value={maggicBmi} onChange={e => setMaggicBmi(parseFloat(e.target.value) || 0)} />
                </div>
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="form-label mb-0">Creatinine</label>
                    <select value={crUnit} onChange={e => handleCrUnitChange(e.target.value as any)} className="bg-transparent text-[10px] text-blue-400 focus:outline-none cursor-pointer">
                      <option value="mg/dL">mg/dL</option>
                      <option value="umol/L">µmol/L</option>
                    </select>
                  </div>
                  <input type="number" min={crUnit === 'mg/dL' ? 0.1 : 8.8} max={crUnit === 'mg/dL' ? 20 : 1768} step={crUnit === 'mg/dL' ? '0.01' : '1'} className="form-input" value={maggicCr} onChange={e => setMaggicCr(parseFloat(e.target.value) || 0)} />
                </div>
                <div>
                  <label className="form-label">NYHA Class</label>
                  <select className="form-select" value={maggicNyha} onChange={e => setMaggicNyha(e.target.value as any)}>
                    <option>I</option>
                    <option>II</option>
                    <option>III</option>
                    <option>IV</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Sex</label>
                  <select className="form-select" value={maggicSex} onChange={e => setMaggicSex(e.target.value as any)}>
                    <option>Male</option>
                    <option>Female</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">HF diagnosed &ge; 18 months ago?</label>
                  <select className="form-select" value={maggicHfYears} onChange={e => setMaggicHfYears(parseFloat(e.target.value) || 0)}>
                    <option value={2}>Yes (&ge; 18 months)</option>
                    <option value={0}>No (&lt; 18 months)</option>
                  </select>
                </div>
                <div className="md:col-span-2 pt-2 grid grid-cols-2 gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={maggicDiabetes} onChange={e => setMaggicDiabetes(e.target.checked)} className="w-4 h-4 rounded" />
                    <span>Diabetes Mellitus</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={maggicSmoker} onChange={e => setMaggicSmoker(e.target.checked)} className="w-4 h-4 rounded" />
                    <span>Current Smoker</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={maggicCopd} onChange={e => setMaggicCopd(e.target.checked)} className="w-4 h-4 rounded" />
                    <span>COPD</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={maggicBb} onChange={e => setMaggicBb(e.target.checked)} className="w-4 h-4 rounded" />
                    <span>Prescribed Beta-Blocker</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={maggicAce} onChange={e => setMaggicAce(e.target.checked)} className="w-4 h-4 rounded" />
                    <span>Prescribed ACEi/ARB</span>
                  </label>
                </div>
              </div>
            )}

            {/* H2FPEF Parameters */}
            {activeCalculator === 'h2fpef' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="form-label">Age (years)</label>
                  <input type="number" min={18} max={120} className="form-input" value={h2Age} onChange={e => setH2Age(parseInt(e.target.value) || 0)} />
                </div>
                <div>
                  <label className="form-label">BMI (kg/m²)</label>
                  <input type="number" min={10} max={60} step="0.1" className="form-input" value={h2Bmi} onChange={e => setH2Bmi(parseFloat(e.target.value) || 0)} />
                </div>
                <div>
                  <label className="form-label">Antihypertensive Drugs Count</label>
                  <input type="number" min={0} max={10} className="form-input" value={h2Meds} onChange={e => setH2Meds(parseInt(e.target.value) || 0)} />
                </div>
                <div>
                  <label className="form-label">Pulmonary Arterial Pressure (mmHg)</label>
                  <input type="number" min={10} max={120} className="form-input" value={h2Pap} onChange={e => setH2Pap(parseInt(e.target.value) || 0)} />
                </div>
                <div>
                  <label className="form-label">Echo E/e' Ratio</label>
                  <input type="number" min={1} max={40} step="0.1" className="form-input" value={h2EEPrime} onChange={e => setH2EEPrime(parseFloat(e.target.value) || 0)} />
                </div>
                <div>
                  <label className="form-label">Atrial Fibrillation Status</label>
                  <select className="form-select" value={h2Af ? 'Yes' : 'No'} onChange={e => setH2Af(e.target.value === 'Yes')}>
                    <option>Yes</option>
                    <option>No</option>
                  </select>
                </div>
              </div>
            )}

            {/* CHARM Parameters */}
            {activeCalculator === 'charm' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="form-label">Age (years)</label>
                  <input type="number" min={18} max={120} className="form-input" value={charmAge} onChange={e => setCharmAge(parseInt(e.target.value) || 0)} />
                </div>
                <div>
                  <label className="form-label">LVEF (%)</label>
                  <input type="number" min={5} max={85} className="form-input" value={charmLvef} onChange={e => setCharmLvef(parseInt(e.target.value) || 0)} />
                </div>
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="form-label mb-0">Creatinine</label>
                    <select value={crUnit} onChange={e => handleCrUnitChange(e.target.value as any)} className="bg-transparent text-[10px] text-blue-400 focus:outline-none cursor-pointer">
                      <option value="mg/dL">mg/dL</option>
                      <option value="umol/L">µmol/L</option>
                    </select>
                  </div>
                  <input type="number" min={crUnit === 'mg/dL' ? 0.1 : 8.8} max={crUnit === 'mg/dL' ? 20 : 1768} step={crUnit === 'mg/dL' ? '0.01' : '1'} className="form-input" value={charmCr} onChange={e => setCharmCr(parseFloat(e.target.value) || 0)} />
                </div>
                <div>
                  <label className="form-label">Serum Sodium (mmol/L)</label>
                  <input type="number" min={100} max={170} className="form-input" value={charmSodium} onChange={e => setCharmSodium(parseInt(e.target.value) || 0)} />
                </div>
                <div>
                  <label className="form-label">NYHA Class</label>
                  <select className="form-select" value={charmNyha} onChange={e => setCharmNyha(e.target.value as any)}>
                    <option>I</option>
                    <option>II</option>
                    <option>III</option>
                    <option>IV</option>
                  </select>
                </div>
                <div className="md:col-span-2 pt-2 grid grid-cols-2 gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={charmDiabetes} onChange={e => setCharmDiabetes(e.target.checked)} className="w-4 h-4 rounded" />
                    <span>Diabetes Mellitus</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={charmSmoker} onChange={e => setCharmSmoker(e.target.checked)} className="w-4 h-4 rounded" />
                    <span>Current Smoker</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={charmCopd} onChange={e => setCharmCopd(e.target.checked)} className="w-4 h-4 rounded" />
                    <span>COPD</span>
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Risk Visualization Charts / Result Panel */}
        <div className="lg:col-span-5 space-y-6">
          <div className="glass-card p-5 space-y-5 border border-blue-500/10">
            <h3 className="text-sm font-semibold text-white pb-2 border-b border-blue-500/10 flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" /> Stratification Results
            </h3>

            {/* MAGGIC Render Result */}
            {activeCalculator === 'maggic' && (
              <div className="space-y-5">
                <div className="flex justify-between items-center bg-blue-500/5 p-4 rounded-xl border border-blue-500/10">
                  <div>
                    <p className="text-[10px] uppercase text-gray-400">MAGGIC Point Score</p>
                    <p className="text-3xl font-extrabold text-white mt-1">{maggicResult.score}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] uppercase text-gray-400">Risk Class</p>
                    <span className={cn(
                      "badge mt-1 text-[11px]",
                      maggicResult.riskCategory === 'Low' && 'badge-green',
                      maggicResult.riskCategory === 'Intermediate' && 'badge-amber',
                      maggicResult.riskCategory === 'High' && 'badge-red'
                    )}>
                      {maggicResult.riskCategory} Risk
                    </span>
                  </div>
                </div>

                {/* Graph bars representation of mortality */}
                <div className="space-y-3.5">
                  <p className="text-xs font-semibold text-white">Estimated Mortality Probability</p>
                  
                  {/* 1 Year */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs text-gray-400">
                      <span>1-Year Mortality</span>
                      <span className="font-semibold text-white">{(maggicResult.oneYearMortality * 100).toFixed(1)}%</span>
                    </div>
                    <div className="progress-track">
                      <div className="progress-fill bg-blue-500" style={{ width: `${maggicResult.oneYearMortality * 100}%` }} />
                    </div>
                  </div>

                  {/* 3 Year */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs text-gray-400">
                      <span>3-Year Mortality</span>
                      <span className="font-semibold text-white">{(maggicResult.threeYearMortality * 100).toFixed(1)}%</span>
                    </div>
                    <div className="progress-track">
                      <div className="progress-fill bg-violet-500" style={{ width: `${maggicResult.threeYearMortality * 100}%` }} />
                    </div>
                  </div>

                  {/* 5 Year */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs text-gray-400">
                      <span>5-Year Mortality</span>
                      <span className="font-semibold text-white">{(maggicResult.fiveYearMortality * 100).toFixed(1)}%</span>
                    </div>
                    <div className="progress-track">
                      <div className="progress-fill bg-cyan-500" style={{ width: `${maggicResult.fiveYearMortality * 100}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* H2FPEF Render Result */}
            {activeCalculator === 'h2fpef' && (
              <div className="space-y-5">
                <div className="flex justify-between items-center bg-blue-500/5 p-4 rounded-xl border border-blue-500/10">
                  <div>
                    <p className="text-[10px] uppercase text-gray-400">H2FPEF Point Score</p>
                    <p className="text-3xl font-extrabold text-white mt-1">{h2fpefResult.score} <span className="text-sm font-normal text-gray-400">/ 9</span></p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] uppercase text-gray-400">Probability</p>
                    <span className="badge badge-violet mt-1 text-[11px]">
                      {(h2fpefResult.probability * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-xs font-semibold text-white">Diagnostic Probability Gauge</p>
                  <div className="progress-track">
                    <div className="progress-fill bg-gradient-to-r from-blue-500 to-violet-500" style={{ width: `${h2fpefResult.probability * 100}%` }} />
                  </div>
                </div>

                <div className="alert-strip info text-xs mt-3 leading-relaxed">
                  {h2fpefResult.interpretation}
                </div>
              </div>
            )}

            {/* CHARM Render Result */}
            {activeCalculator === 'charm' && (
              <div className="space-y-5">
                <div className="flex justify-between items-center bg-blue-500/5 p-4 rounded-xl border border-blue-500/10">
                  <div>
                    <p className="text-[10px] uppercase text-gray-400">CHARM Score Points</p>
                    <p className="text-3xl font-extrabold text-white mt-1">{charmResult.score}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] uppercase text-gray-400">Risk Group</p>
                    <span className={cn(
                      "badge mt-1 text-[11px]",
                      charmResult.category === 'Low' && 'badge-green',
                      charmResult.category === 'Medium' && 'badge-amber',
                      charmResult.category === 'High' && 'badge-red'
                    )}>
                      {charmResult.category}
                    </span>
                  </div>
                </div>

                <div className="space-y-3.5">
                  <p className="text-xs font-semibold text-white">1-Year CV Death / HF Hospitalization</p>
                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>Estimated Event Rate</span>
                    <span className="font-semibold text-white">{(charmResult.estimatedOneYearEventRate * 100).toFixed(0)}%</span>
                  </div>
                  <div className="progress-track">
                    <div className="progress-fill bg-rose-500" style={{ width: `${charmResult.estimatedOneYearEventRate * 100}%` }} />
                  </div>
                </div>
              </div>
            )}

            <div className="bg-blue-500/5 p-3 rounded-xl border border-blue-500/10 flex items-start gap-2.5 text-xs text-gray-400 leading-normal">
              <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
              <p>
                Calculations are derived from peer-reviewed evidence-based cardiovascular prognostic systems. Use for reference purposes to supplement patient examinations.
              </p>
            </div>

          </div>
        </div>

      </div>

    </div>
  )
}
