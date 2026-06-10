'use client'
import React, { memo } from 'react'
import { FieldWrap, Input, Select, Textarea } from '@/components/ui/FormField'
// Removed: RadioChipGroup, CheckChipGroup - using Select instead for memoized components
import type { UseFormRegister, Control, FieldValues } from 'react-hook-form'

interface SectionProps {
  register: any  // UseFormRegister with FormValues type
  control: any   // Control with FormValues type
  errors: Record<string, any>
  isTelemedicine?: boolean
}

// ─── Medications Section (memoized) ────────────────────────────────────────

interface MedicationsSectionProps extends SectionProps {
  isInpatient?: boolean
}

export const MedicationsSection = memo(function MedicationsSection({
  register,
  control,
  errors,
  isInpatient,
}: MedicationsSectionProps) {
  return (
    <div className="space-y-5">
      <div>
        <p className="section-heading">GDMT Pillars & Core Medications</p>

        {/* Diuretic */}
        <div className="mt-4 bg-gray-800/40 border border-blue-500/10 rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold text-white">Diuretic</p>
          <div className="grid grid-cols-2 gap-3">
            <FieldWrap label="Type">
              <Select {...register('diuretic.type')}>
                <option value="">Select</option>
                <option>Furosemide</option>
                <option>Torsemide</option>
                <option>Spironolactone</option>
              </Select>
            </FieldWrap>
            <FieldWrap label="Dose">
              <Input {...register('diuretic.dose')} placeholder="e.g. 40mg OD" />
            </FieldWrap>
            <FieldWrap label="Prescribed?" className="col-span-2">
              <Select {...register('diuretic.prescribed')}>
                <option value="">Select</option>
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </Select>
            </FieldWrap>
          </div>
        </div>

        {/* RAASi */}
        <div className="mt-4 bg-gray-800/40 border border-blue-500/10 rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold text-white">RAASi (ACEi / ARB / ARNI)</p>
          <div className="grid grid-cols-2 gap-3">
            <FieldWrap label="Type">
              <Select {...register('raasi.type')}>
                <option value="">Select</option>
                <option>Lisinopril</option>
                <option>Enalapril</option>
                <option>Ramipril</option>
                <option>Losartan</option>
                <option>Valsartan</option>
                <option>Candesartan</option>
                <option>Sacubitril/Valsartan</option>
              </Select>
            </FieldWrap>
            <FieldWrap label="Dose">
              <Input {...register('raasi.dose')} placeholder="e.g. 10mg OD" />
            </FieldWrap>
            <FieldWrap label="Prescribed?" className="col-span-2">
              <Select {...register('raasi.prescribed')}>
                <option value="">Select</option>
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </Select>
            </FieldWrap>
          </div>
        </div>

        {/* Beta-Blocker */}
        <div className="mt-4 bg-gray-800/40 border border-blue-500/10 rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold text-white">Beta-Blocker</p>
          <div className="grid grid-cols-2 gap-3">
            <FieldWrap label="Type">
              <Select {...register('betaBlocker.type')}>
                <option value="">Select</option>
                <option>Carvedilol</option>
                <option>Bisoprolol</option>
                <option>Metoprolol</option>
                <option>Nebivolol</option>
              </Select>
            </FieldWrap>
            <FieldWrap label="Dose">
              <Input {...register('betaBlocker.dose')} placeholder="e.g. 50mg OD" />
            </FieldWrap>
            <FieldWrap label="Prescribed?" className="col-span-2">
              <Select {...register('betaBlocker.prescribed')}>
                <option value="">Select</option>
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </Select>
            </FieldWrap>
          </div>
        </div>

        {/* MRA */}
        <div className="mt-4 bg-gray-800/40 border border-blue-500/10 rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold text-white">MRA (Mineralocorticoid Receptor Antagonist)</p>
          <div className="grid grid-cols-2 gap-3">
            <FieldWrap label="Type">
              <Select {...register('mra.type')}>
                <option value="">Select</option>
                <option>Spironolactone</option>
                <option>Eplerenone</option>
              </Select>
            </FieldWrap>
            <FieldWrap label="Dose">
              <Input {...register('mra.dose')} placeholder="e.g. 50mg OD" />
            </FieldWrap>
            <FieldWrap label="Prescribed?" className="col-span-2">
              <Select {...register('mra.prescribed')}>
                <option value="">Select</option>
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </Select>
            </FieldWrap>
          </div>
        </div>

        {/* SGLT2i */}
        <div className="mt-4 bg-gray-800/40 border border-blue-500/10 rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold text-white">SGLT2 Inhibitor</p>
          <div className="grid grid-cols-2 gap-3">
            <FieldWrap label="Type">
              <Select {...register('sglt2i.type')}>
                <option value="">Select</option>
                <option>Dapagliflozin</option>
                <option>Empagliflozin</option>
              </Select>
            </FieldWrap>
            <FieldWrap label="Dose">
              <Input {...register('sglt2i.dose')} placeholder="e.g. 10mg OD" />
            </FieldWrap>
            <FieldWrap label="Prescribed?" className="col-span-2">
              <Select {...register('sglt2i.prescribed')}>
                <option value="">Select</option>
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </Select>
            </FieldWrap>
          </div>
        </div>

        {/* GDMT Numeric Doses */}
        <div className="mt-4 p-4 rounded-xl border border-emerald-500/20 bg-emerald-950/10 space-y-2">
          <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-3">GDMT Numeric Doses (mg) — for uptitration tracking</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <FieldWrap label="Furosemide daily dose (mg)" hint="Total daily loop diuretic dose">
              <Input type="number" {...register('furosemideDoseMgDaily')} placeholder="e.g. 40" />
            </FieldWrap>
            <FieldWrap label="RAASi dose (mg)" hint="e.g. Ramipril 10, ARNI 97/103">
              <Input type="number" step="0.5" {...register('raasiDoseMg')} placeholder="e.g. 10" />
            </FieldWrap>
            <FieldWrap label="Beta-blocker dose (mg)" hint="e.g. Carvedilol 25, Bisoprolol 10">
              <Input type="number" step="0.5" {...register('betablockerDoseMg')} placeholder="e.g. 25" />
            </FieldWrap>
            <FieldWrap label="MRA dose (mg)" hint="e.g. Spironolactone 25 or 50">
              <Input type="number" {...register('mraDoseMg')} placeholder="e.g. 25" />
            </FieldWrap>
            <FieldWrap label="SGLT2i dose (mg)" hint="Dapagliflozin 10 / Empagliflozin 10">
              <Input type="number" {...register('sglt2iDoseMg')} placeholder="e.g. 10" />
            </FieldWrap>
          </div>
        </div>

        {/* Other Meds */}
        <p className="section-heading mt-6">Other Medications</p>

        <div className="mt-4 bg-gray-800/40 border border-blue-500/10 rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold text-white">Aspirin</p>
          <Select {...register('aspirin.prescribed')}>
            <option value="">Select</option>
            <option value="Yes">Yes</option>
            <option value="No">No</option>
          </Select>
        </div>

        <div className="mt-4 bg-gray-800/40 border border-blue-500/10 rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold text-white">Statin</p>
          <Select {...register('statin.prescribed')}>
            <option value="">Select</option>
            <option value="Yes">Yes</option>
            <option value="No">No</option>
          </Select>
        </div>
      </div>
    </div>
  )
})

// ─── Labs Section (memoized) ──────────────────────────────────────────────

export const LabsSection = memo(function LabsSection({
  register,
  errors,
}: SectionProps) {
  return (
    <div className="space-y-5">
      <div>
        <p className="section-heading">Biomarkers (BNP, Troponin, Novel)</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <FieldWrap label="NT-proBNP (pg/mL)">
            <Input type="number" {...register('ntProBNP')} placeholder="e.g. 450" />
          </FieldWrap>
          <FieldWrap label="BNP (pg/mL)">
            <Input type="number" {...register('bnp')} placeholder="e.g. 250" />
          </FieldWrap>
          <FieldWrap label="hs-Troponin T (ng/L)">
            <Input type="number" {...register('hsTnT')} placeholder="e.g. 14" />
          </FieldWrap>
          <FieldWrap label="hs-Troponin I (ng/L)">
            <Input type="number" {...register('hsTnI')} placeholder="e.g. 5" />
          </FieldWrap>
          <FieldWrap label="sST2 (ng/mL)">
            <Input type="number" {...register('sST2')} placeholder="e.g. 35" />
          </FieldWrap>
          <FieldWrap label="Galectin-3 (ng/mL)">
            <Input type="number" {...register('galectin3')} placeholder="e.g. 18" />
          </FieldWrap>
          <FieldWrap label="GDF-15 (pg/mL)">
            <Input type="number" {...register('gdf15')} placeholder="e.g. 1200" />
          </FieldWrap>
          <FieldWrap label="CA-125 (U/mL)">
            <Input type="number" {...register('ca125')} placeholder="e.g. 35" />
          </FieldWrap>
        </div>
      </div>

      <div>
        <p className="section-heading">Renal Function</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <FieldWrap label="eGFR (ml/min)">
            <Input type="number" {...register('egfr')} placeholder="e.g. 65" />
          </FieldWrap>
          <FieldWrap label="Creatinine (mg/dL)">
            <Input type="number" step="0.01" {...register('creatinine')} placeholder="e.g. 1.2" />
          </FieldWrap>
          <FieldWrap label="Cystatin C (mg/L)">
            <Input type="number" step="0.01" {...register('cystatinC')} placeholder="e.g. 1.1" />
          </FieldWrap>
          <FieldWrap label="Potassium (mmol/L)">
            <Input type="number" step="0.1" {...register('potassium')} placeholder="e.g. 4.5" />
          </FieldWrap>
          <FieldWrap label="Sodium (mmol/L)">
            <Input type="number" {...register('sodium')} placeholder="e.g. 137" />
          </FieldWrap>
          <FieldWrap label="Magnesium (mg/dL)">
            <Input type="number" step="0.1" {...register('magnesium')} placeholder="e.g. 2.1" />
          </FieldWrap>
        </div>
      </div>

      <div>
        <p className="section-heading">Haematology & Iron Metabolism</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <FieldWrap label="Haemoglobin (g/dL)">
            <Input type="number" step="0.1" {...register('hb')} placeholder="e.g. 12.5" />
          </FieldWrap>
          <FieldWrap label="WBC (K/uL)">
            <Input type="number" step="0.1" {...register('wbc')} placeholder="e.g. 7.5" />
          </FieldWrap>
          <FieldWrap label="Platelets (K/uL)">
            <Input type="number" {...register('platelets')} placeholder="e.g. 250" />
          </FieldWrap>
          <FieldWrap label="Ferritin (ng/mL)">
            <Input type="number" {...register('ferritin')} placeholder="e.g. 150" />
          </FieldWrap>
          <FieldWrap label="Transferrin Saturation (%)">
            <Input type="number" step="0.1" {...register('transferrinSat')} placeholder="e.g. 28" />
          </FieldWrap>
        </div>
      </div>

      <div>
        <p className="section-heading">Lipids & Metabolism</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <FieldWrap label="Total Cholesterol (mg/dL)">
            <Input type="number" {...register('totalCholesterol')} placeholder="e.g. 190" />
          </FieldWrap>
          <FieldWrap label="LDL (mg/dL)">
            <Input type="number" {...register('ldl')} placeholder="e.g. 120" />
          </FieldWrap>
          <FieldWrap label="HDL (mg/dL)">
            <Input type="number" {...register('hdl')} placeholder="e.g. 40" />
          </FieldWrap>
          <FieldWrap label="Triglycerides (mg/dL)">
            <Input type="number" {...register('triglycerides')} placeholder="e.g. 150" />
          </FieldWrap>
          <FieldWrap label="HbA1c (%)">
            <Input type="number" step="0.1" {...register('hba1c')} placeholder="e.g. 6.5" />
          </FieldWrap>
          <FieldWrap label="Uric Acid (mg/dL)">
            <Input type="number" step="0.1" {...register('uricAcid')} placeholder="e.g. 6.5" />
          </FieldWrap>
        </div>
      </div>

      <div>
        <p className="section-heading">Liver Function</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <FieldWrap label="ALT (U/L)">
            <Input type="number" {...register('alt')} placeholder="e.g. 35" />
          </FieldWrap>
          <FieldWrap label="AST (U/L)">
            <Input type="number" {...register('ast')} placeholder="e.g. 35" />
          </FieldWrap>
          <FieldWrap label="Albumin (g/dL)">
            <Input type="number" step="0.1" {...register('albumin')} placeholder="e.g. 4.0" />
          </FieldWrap>
          <FieldWrap label="Bilirubin (mg/dL)">
            <Input type="number" step="0.1" {...register('bilirubin')} placeholder="e.g. 0.8" />
          </FieldWrap>
        </div>
      </div>
    </div>
  )
})

// ─── Echocardiography Section (memoized) ──────────────────────────────────

export const EchocardiographySection = memo(function EchocardiographySection({
  register,
  errors,
}: SectionProps) {
  return (
    <div className="space-y-5">
      <div>
        <p className="section-heading">Left Ventricle & Systolic Function</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <FieldWrap label="LVEF (%)" error={errors.lvef?.message} required>
            <Input type="number" step="0.1" {...register('lvef')} placeholder="55" error={!!errors.lvef} />
          </FieldWrap>
          <FieldWrap label="LV Diastolic Diameter (mm)">
            <Input type="number" step="0.1" {...register('lvdd')} placeholder="50" />
          </FieldWrap>
          <FieldWrap label="LV Systolic Diameter (mm)">
            <Input type="number" step="0.1" {...register('lvsd')} placeholder="35" />
          </FieldWrap>
          <FieldWrap label="E/e' Ratio">
            <Input type="number" step="0.1" {...register('eEPrime')} placeholder="8" />
          </FieldWrap>
          <FieldWrap label="LA Strain (%)">
            <Input type="number" step="0.1" {...register('laStrain')} placeholder="18" />
          </FieldWrap>
          <FieldWrap label="GLS (%)">
            <Input type="number" step="0.1" {...register('gls')} placeholder="-18" />
          </FieldWrap>
        </div>
      </div>

      <div>
        <p className="section-heading">Right Ventricle & Pulmonary</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <FieldWrap label="RVSP (mmHg)">
            <Input type="number" {...register('rvsp')} placeholder="30" />
          </FieldWrap>
          <FieldWrap label="TAPSE (mm)">
            <Input type="number" step="0.1" {...register('tapse')} placeholder="20" />
          </FieldWrap>
          <FieldWrap label="RV Free Wall Strain (%)">
            <Input type="number" step="0.1" {...register('rvFreeWallStrain')} placeholder="-20" />
          </FieldWrap>
          <FieldWrap label="RV FAC (%)">
            <Input type="number" step="0.1" {...register('rvFAC')} placeholder="40" />
          </FieldWrap>
          <FieldWrap label="RV S' (cm/s)">
            <Input type="number" step="0.1" {...register('rvS')} placeholder="10.5" />
          </FieldWrap>
        </div>
      </div>

      <div>
        <p className="section-heading">Diastolic Function & Pressures</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <FieldWrap label="Diastolic Dysfunction Grade">
            <Select {...register('ddGrade')}>
              <option value="">Select</option>
              <option>Normal</option>
              <option>I - Impaired Relaxation</option>
              <option>II - Pseudonormal</option>
              <option>III - Restrictive</option>
            </Select>
          </FieldWrap>
          <FieldWrap label="Deceleration Time (ms)">
            <Input type="number" {...register('decelerationTime')} placeholder="200" />
          </FieldWrap>
          <FieldWrap label="LA Volume Index (mL/m²)">
            <Input type="number" step="0.1" {...register('laVolumeIndex')} placeholder="28" />
          </FieldWrap>
          <FieldWrap label="IVC Diameter (mm)">
            <Input type="number" step="0.1" {...register('ivcDiameter')} placeholder="18" />
          </FieldWrap>
          <FieldWrap label="IVC Collapsibility (%)">
            <Input type="number" step="0.1" {...register('ivcCollapsibility')} placeholder="50" />
          </FieldWrap>
        </div>
      </div>

      <div>
        <p className="section-heading">Valvular Assessment</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <FieldWrap label="MR Grade">
            <Select {...register('mrGrade')}>
              <option value="">Select</option>
              <option>Trivial</option>
              <option>Mild</option>
              <option>Moderate</option>
              <option>Severe</option>
            </Select>
          </FieldWrap>
          <FieldWrap label="AR Grade">
            <Select {...register('arGrade')}>
              <option value="">Select</option>
              <option>Trivial</option>
              <option>Mild</option>
              <option>Moderate</option>
              <option>Severe</option>
            </Select>
          </FieldWrap>
          <FieldWrap label="TR Grade">
            <Select {...register('trGrade')}>
              <option value="">Select</option>
              <option>Trivial</option>
              <option>Mild</option>
              <option>Moderate</option>
              <option>Severe</option>
            </Select>
          </FieldWrap>
          <FieldWrap label="Pericardial Effusion">
            <Select {...register('pericardialEffusion')}>
              <option value="">Select</option>
              <option>None</option>
              <option>Trivial</option>
              <option>Small</option>
              <option>Moderate</option>
              <option>Large</option>
            </Select>
          </FieldWrap>
        </div>
      </div>

      <div>
        <p className="section-heading">Echo Notes</p>
        <FieldWrap label="Additional Findings">
          <Textarea {...register('echNotes')} placeholder="Wall motion abnormalities, valve findings…" rows={4} />
        </FieldWrap>
      </div>
    </div>
  )
})
