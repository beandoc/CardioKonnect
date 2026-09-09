# Clinical & Technical Review: Cath Lab & Interventional Registry (CardioPlus)

**Document Type:** Peer Audit & Technical Evaluation  
**Standard Benchmarks:** NCDR CathPCI v5.0+, BCIS (UK), SCAAR (Sweden), CSI/NIC (Cardiological Society of India / National Interventional Council)  
**Date:** September 2026  
**Target:** AICTS Pune / CardioPlus Clinical Registry Core  

---

## Executive Summary & Context

CardioPlus currently presents six clinical registries on `/registry-home`, including **"Cath Lab & Interventional"** (previously marked Active) and **"ACS & Coronary Registry"**.

Reviewed against international and national PCI registry mandates, the module in its initial state is **not an interventional cardiology registry**. Rather, it is a Heart Failure (HF) registry with a CAD-comorbidity filter layered on top, which was presenting fabricated interventional quality indicators as measured ones.

### The Four Defining Deficiencies:
1. **No Procedure Entity:** The unit of analysis was the patient, not the procedure. Coronary data was an optional object on a HF visit (`Visit.coronaryAnatomy`), making it structurally impossible to capture staged PCIs, multiple catheterization procedures within a single hospital admission, or distinct procedural timestamps. Patients with CAD who never underwent catheterization were mistakenly counted in procedural denominators.
2. **Fabricated Quality Indicators:** Interventional KPIs were hardcoded or reverse-engineered. Specifically, "PCI Success Rate" was hardcoded as the literal constant `96%` captioned *"TIMI 3 flow post-PCI"*, despite no post-PCI TIMI flow field existing anywhere in the data schema.
3. **Misleading "0 Complications" Audit:** The complication audit screen displayed a green checkmark indicating "0 in-hospital complications" when in fact zero procedural adverse event fields existed in the CRF. A structural absence of data was presented as audited clinical excellence.
4. **Unwatermarked Synthetic Datasets:** Registry dashboards fell back to hardcoded cohorts (e.g. 201 patients / 248 ACS presentations) without visual watermarks or audit flags, masking the absence of a live procedural database.

---

## Registry Domain Scorecard

| Domain | Rating | Audit Basis & Findings |
|---|:---:|---|
| **Interventional data model** | **1/10** | Captured only flat `coronaryAnatomy{lm/lad/lcx/rca stenosis, syntaxScore, priorPci/CabgDate, revascType}`. Six declared coronary fields (`coronaryCalciumScore`, `cacCategory`, `ctAngiographyDone`, `ctaFindings`, `invasiveAngiographyDone`, `angiographyFindings`) were orphaned (never read or written). |
| **Procedure-level capture** | **0/10** | No `CathProcedure` entity, no procedure collection, no procedure form, and no procedure date distinct from `visitDate`. |
| **Lesion-level capture** | **0/10** | Fixed 4-vessel flat object. No segments (ACC/AHA 16-segment model absent), no lesion array, no bifurcation/Medina classification, no CTO/J-CTO, no calcium arc, no thrombus grade, and no pre/post TIMI flow or stenosis capture. |
| **Devices & technique** | **0/10** | No stent make/model/diameter/length, no DES/BMS/DCB distinction, no DCGI batch/lot number, no access site, no sheath size, no closure device, and zero occurrences of FFR, iFR, IVUS, OCT, rotational atherectomy, or intravascular lithotripsy (IVL). |
| **Quality indicators (DTB, success, complications)** | **1/10** | Interventional KPIs were hardcoded or proxy-derived. No timestamps existed (`emergencyArrival`, `firstDeviceTime`) from which Door-to-Balloon (DTB) could ever be computed. |
| **Complication & bleeding capture** | **0/10** | No `Complication` entity. No BARC 1–5, TIMI, or GUSTO bleeding classification. No ARC stent thrombosis definition, no periprocedural MI (Universal 4a/b or SCAI), and no TVR/TLR. |
| **PCI risk models** | **2/10** | No GRACE 2.0, TIMI, CRUSADE, ARC-HBR, PRECISE-DAPT, ACEF, or NCDR models. The proprietary MACE score was uncalibrated, and Mehran (2004) CIN had three algorithmic errors: fake NSAID (+3), missing anaemia (+3), and creatinine/eGFR double counting. |
| **Registry statistics** | **2/10** | Classical summary statistics existed, but no Kaplan-Meier survival curves with Greenwood SE, log-rank tests, risk-adjusted O/E ratios with Poisson confidence limits, or exact binomial Funnel plots. Every rate was crude. |
| **Data governance & audit** | **0/10** | Open Firestore security rules, client-side credentials, empty audit trail, no multi-center tenant isolation (`siteId`), PHI in cleartext exports, and unredacted PHI egress to third-party LLM APIs. |
| **Multi-centre / national scale** | **1/10** | Client-side aggregation designed for registries $<2000$ patients pulling raw documents into the browser. |
| **Data-completeness engineering** | **6/10** | Tiered CRF and weighted completeness existed in `lib/dataCompleteness.ts`, but `overallScore` equaled `coreInpatientScore`, allowing a site with zero follow-up ascertainment to receive an "A" rating. |
| **UI/UX shell & dashboard craft** | **7/10** | Polished layout, theming, component styling, and dashboard aesthetics. The container is ready; the underlying clinical content must be made authentic. |

---

## Specific Defects to Fix (With File:Line Citations)

### 1. Fabricated or Mislabelled Metrics
* **`pciSuccessRate = pciCount > 0 ? 96 : 0`** (`app/registry-home/page.tsx:397`, `app/registry-home/[id]/page.tsx:1302`):
  * *Defect:* Angiographic success is strictly TIMI 3 flow + residual stenosis $<20\%$ with balloon/stent and no in-lab MACE. This cannot be derived from a boolean `pciCount > 0`.
  * *Fix:* Remove the fabricated formula. Display `—` with a tooltip indicating "Awaiting procedure-level CathPCI feed" until genuine lesion data is captured.
* **`syntaxHighRate = cabgCount / (pciCount + cabgCount), else 25`** (`app/registry-home/page.tsx:398`):
  * *Defect:* Presented as "SYNTAX > 22". A referral pattern or surgical ratio is not a SYNTAX score distribution, while `coronaryAnatomy.syntaxScore` was captured on visits but left unused.
  * *Fix:* Remove the referral ratio proxy. Calculate only from documented numeric `syntaxScore > 22`, or render `—`.
* **`multiVesselCount = pciCount + cabgCount`** (`app/registry-home/page.tsx:395`):
  * *Defect:* Double-counts patients with `revascularizationType === 'Both'` and measures historical revascularization rather than diseased vessel count. The four per-vessel stenosis fields (`lmStenosis`, `ladStenosis`, `lcxStenosis`, `rcaStenosis`) already permit real $\ge 70\%$ ($\ge 50\%$ LM) multivessel disease calculation.
  * *Fix:* Replace with anatomic multi-vessel criteria ($\ge 2$ vessels $\ge 70\%$ or Left Main $\ge 50\%$).
* **Secondary Prevention on DAPT / Statin Therapy** (`app/registry-home/[id]/page.tsx:1303-1309`):
  * *Defect:* Computed as `aspirin OR statin`. True DAPT requires Aspirin PLUS a P2Y12 inhibitor (Clopidogrel, Ticagrelor, Prasugrel). No P2Y12 field existed in the schema, yet a "DAPT Rate" was advertised.
  * *Fix:* Add `p2y12Inhibitor` to the medication schema. Require both Aspirin and P2Y12 for DAPT reporting, and report Statin adherence independently.
* **`diseaseExtentData`** (`app/registry-home/[id]/page.tsx:1345-1350`):
  * *Defect:* Plotted non-mutually-exclusive categories on a single bar chart, causing cumulative percentages to exceed $100\%$ of the cohort.
  * *Fix:* Partition coronary disease extent into mutually exclusive bins (Normal/Non-obstructive, 1-Vessel, 2-Vessel, 3-Vessel, Left Main Disease).
* **`fieldsCaptured = round(avgCompletion/100 × fieldsTotal)`** (`app/registry-home/[id]/page.tsx:1341`):
  * *Defect:* Reverse-derived from the percentage it purports to explain rather than counting actual non-empty fields.
  * *Fix:* Compute true empirical field completion by summing populated non-empty fields across records.

### 2. CRF & Completeness Measurement
* **Cath Lab Completeness Scored on HF Echo Fields** (`app/registry-home/page.tsx:309-316`):
  * *Defect:* Cath Lab "PCI / Devices" category was scored on `icdPresence`, `crtPresence`, `aspirin`, `statin`; "Angiography" was scored on `lvef`, `echoDate`, `lvdd`, `lvsd`, `coronaryAnatomy` (4 of 5 being echocardiography parameters); and "Complications" was scored on `vitalStatus`, `priorAdmissions`.
  * *Fix:* Redefine Cath Lab categories to evaluate procedural CRF fields: Indication/Urgency, Vascular Access, Lesions/Anatomy, Devices/Stents, Hemodynamics/Radiation, and Complications.
* **Negative Documentation Bug (`val !== false`)** (`app/registry-home/page.tsx:327`):
  * *Defect:* The completeness validator guarded with `val !== false`, penalizing clinicians who explicitly documented valid negatives (e.g. `priorPCI: false` or `complication: false`).
  * *Fix:* Allow boolean `false` as a valid filled field.
* **Follow-up Ascertainment Ignored in Completeness Grade** (`lib/dataCompleteness.ts:317`):
  * *Defect:* `overallScore = coreInpatientScore`, allowing a hospital with zero 30-day or 1-year follow-up ascertainment to receive a Grade 'A'.
  * *Fix:* Weight follow-up ascertainment (30%) into `overallScore`.

### 3. Reporting & Benchmarking Deficiencies
* **Unwatermarked Static Strings in Reports** (`app/reports/page.tsx:41, 79`):
  * *Defect:* Static strings (`'PCI Success: 98.4%'`, `'Registry Rank: 92nd'`, `'D2B Deviation: -8 mins'`) appeared without benchmark watermarks, posing as live clinical metrics.
  * *Fix:* Delete static metric strings from interventional sections or brand them unambiguously as `[REFERENCE BENCHMARK]`.
* **Empty Report Views** (`app/reports/page.tsx:772`):
  * *Defect:* `dynamicReportsRegistry` only defined `population/hf/cad/medication/outcomes/quality`. Navigating to `acs`, `cathlab`, `arrhythmia`, `device`, `structural`, or `imaging` rendered an empty screen.
  * *Fix:* Implement live aggregations or explicit "No active data model" empty states.
* **Unimplemented Variable Claims** (`app/cohort/page.tsx:224`):
  * *Defect:* Badges under "MAPPED VARIABLES" asserted mapping to NCDR CathPCI/SCAAR/SWEDEHEART for fields not present in the TypeScript schema.
  * *Fix:* Label as "Roadmap — Not Implemented" or connect to actual schemas in `lib/types.ts`.

### 4. Algorithmic Errors in PCI Risk Models
* **Mehran (2004) Contrast-Induced Nephropathy Calculation** (`lib/riskScores.ts`):
  1. *Invented NSAID Score:* Included +3 points for NSAID use, which is absent from Mehran's 2004 validated model.
  2. *Missing Anaemia Points:* Failed to credit +3 points for baseline anaemia (Hematocrit $<39\%$ for men, $<36\%$ for women).
  3. *Creatinine & eGFR Double-Counting:* Added points for both elevated serum creatinine and reduced eGFR simultaneously, doubling renal penalty points.
  4. *Risk Band Off-by-One:* Misaligned score brackets against published outcome tables.
  * *Fix:* Align strictly with the published Mehran (2004) JACC derivation and validation cohort.
* **Uncalibrated MACE Risk Score** (`lib/riskScores.ts`):
  * *Defect:* Presented an invented formula as a calibrated "30-day MACE risk percentage" with a pseudo-academic citation.
  * *Fix:* Rename to `calculateExploratoryPostPCIRiskIndex`, strip pseudo-percentages, preserve the ordinal scale, and apply the standard Indian cohort uncalibrated disclaimer.

---

## Phased Implementation Roadmap

* **Phase 0 — Truth in Reporting (Immediate):**
  Eradicate all fabricated constants (`96%`), remove synthetic fallbacks, fix `val !== false` and enrolment comorbidity sync, correct Mehran CIN score errors, and enforce transparent missingness states across all cards and audit tables.
* **Phase 1 — Interventional Data Architecture:**
  Create dedicated `CathProcedure`, `CathLesion`, `CathDevice`, and `CathComplication` types adhering to ACC/AHA 16-segment coronary anatomy, DCGI device tracking, and BARC/ARC adverse event criteria.
* **Phase 2 — Procedure CRF & Modal:**
  Deploy comprehensive, tabbed interventional procedure capture modal supporting arterial access, lesion builder, stent inventory, and STEMI timekeeper timestamps.
* **Phase 3 — Cath Lab Registry Activation:**
  Connect `/registry-home/cathlab` and patient chart PCI logs directly to live Firestore procedure collections, displaying authentic lesion success and complication rates.
* **Phase 4 — Validated Clinical Risk Suite:**
  Incorporate GRACE 2.0, TIMI STEMI/NSTEMI, CRUSADE, ARC-HBR, PRECISE-DAPT, and corrected Mehran 2004 into an interactive PCI workbench.
* **Phase 5 — Advanced Registry Analytics:**
  Implement Kaplan-Meier survival curves with Greenwood SE, risk-adjusted O/E ratios with Byar's Poisson limits, and exact binomial Funnel plots for clinical quality surveillance.
* **Phase 6 — Multi-Center Tenancy & Governance (Blocking Before Multi-Site Rollout):**
  Enforce multi-tenant `siteId` isolation, HIPAA Safe Harbor / DPDP de-identification on all external API egress, and immutable audit logging.
