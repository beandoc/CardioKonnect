/**
 * lib/appConfig.ts
 *
 * Single source of truth for:
 *  - Hospital sites
 *  - Registry definitions (id, name, PI, site)
 *  - Application users and their registry access
 *
 * This is the authoritative config. All access-control decisions derive from it.
 */

// ─── Sites / Hospitals ────────────────────────────────────────────────────────
export interface Site {
  id: string
  name: string
  shortName: string
  city: string
  state: string
  type: 'Government' | 'Private' | 'Trust'
}

export const SITES: Record<string, Site> = {
  AICTS_PUNE: {
    id: 'AICTS_PUNE',
    name: 'All India Institute of Cardiothoracic Sciences',
    shortName: 'AICTS Pune',
    city: 'Pune',
    state: 'Maharashtra',
    type: 'Government',
  },
  KANPUR_APEX: {
    id: 'KANPUR_APEX',
    name: 'Kanpur Cardiac Apex Hospital',
    shortName: 'Apex Hospital Kanpur',
    city: 'Kanpur',
    state: 'Uttar Pradesh',
    type: 'Private',
  },
}

// ─── Registry Config ──────────────────────────────────────────────────────────
export interface RegistryConfig {
  id: string
  name: string
  shortName: string
  siteId: string          // Which hospital this registry belongs to
  piId: string            // Principal Investigator user ID
  piName: string          // PI display name
  piRoleTitle: string     // e.g. "Registry Owner & PI" or "Principal Investigator"
  welcomeMessage: string  // Doctor-specific welcome message shown when entering the registry
  gradient: string
  accentColor: string
  enrollmentCriteria: 'explicit' // Always 'explicit' — clinical inference is banned
}

export const REGISTRY_CONFIG: Record<string, RegistryConfig> = {
  hf: {
    id: 'hf',
    name: 'Heart Failure Registry',
    shortName: 'HF Registry',
    siteId: 'AICTS_PUNE',
    piId: 'DR_JAYACHANDRA',
    piName: 'Dr. A. Jayachandra',
    piRoleTitle: 'Registry Owner & PI',
    welcomeMessage: 'Tracking HFrEF, HFmrEF, HFpEF phenotypes, GDMT 4-pillar adherence, biomarkers, and long-term heart failure outcomes at AICTS Pune.',
    gradient: 'linear-gradient(135deg, #1d4ed8 0%, #3b82f6 100%)',
    accentColor: '#60a5fa',
    enrollmentCriteria: 'explicit',
  },
  cathlab: {
    id: 'cathlab',
    name: 'Cath Lab & Interventional Registry',
    shortName: 'Cath Lab Registry',
    siteId: 'KANPUR_APEX',
    piId: 'DR_RAJEEV_CHAUHAN',
    piName: 'Dr. Rajeev Chauhan',
    piRoleTitle: 'Principal Investigator',
    welcomeMessage: 'Monitoring coronary angiography, PCI procedures, STEMI door-to-balloon timelines, intravascular imaging, and stent safety at Kanpur Cardiac Apex Hospital.',
    gradient: 'linear-gradient(135deg, #b45309 0%, #f59e0b 100%)',
    accentColor: '#f59e0b',
    enrollmentCriteria: 'explicit',
  },
  acs: {
    id: 'acs',
    name: 'ACS & Coronary Registry',
    shortName: 'ACS Registry',
    siteId: 'AICTS_PUNE',
    piId: 'DR_JAYACHANDRA',
    piName: 'Dr. A. Jayachandra',
    piRoleTitle: 'Principal Investigator',
    welcomeMessage: 'Tracking acute coronary syndromes, STEMI/NSTEMI presentations, acute revascularization protocols, and secondary prevention at AICTS Pune.',
    gradient: 'linear-gradient(135deg, #9f1239 0%, #ef4444 100%)',
    accentColor: '#f87171',
    enrollmentCriteria: 'explicit',
  },
  preventive: {
    id: 'preventive',
    name: 'Preventive Cardiology Registry',
    shortName: 'Preventive Registry',
    siteId: 'AICTS_PUNE',
    piId: 'DR_JAYACHANDRA',
    piName: 'Dr. A. Jayachandra',
    piRoleTitle: 'Principal Investigator',
    welcomeMessage: 'Tracking cardiovascular risk stratification, lipid management, lifestyle interventions, and primary prevention cohorts at AICTS Pune.',
    gradient: 'linear-gradient(135deg, #065f46 0%, #10b981 100%)',
    accentColor: '#34d399',
    enrollmentCriteria: 'explicit',
  },
}

// ─── Application Users ────────────────────────────────────────────────────────
export type AppRole = 'SuperAdmin' | 'RegistryOwner' | 'PI' | 'Cardiologist' | 'SeniorResident' | 'DEO'

export interface AppUser {
  id: string
  name: string
  shortName: string        // Initials for avatar
  email: string
  role: AppRole
  siteId: string           // Primary hospital affiliation
  loginUsernames: string[] // Accepted username logins
  defaultPassword: string  // Hardcoded demo password
  /** Registry IDs this user has access to. SuperAdmin sees all. Empty = no registry access. */
  registryAccess: string[]
  /** If PI: the registry IDs they are PI for (subset of registryAccess) */
  piOf: string[]
}

export const APP_USERS: Record<string, AppUser> = {
  DR_JAYACHANDRA: {
    id: 'DR_JAYACHANDRA',
    name: 'Dr. A. Jayachandra',
    shortName: 'AJ',
    email: 'jayachandra.a@aicts.in',
    role: 'RegistryOwner',
    siteId: 'AICTS_PUNE',
    loginUsernames: ['cardiokonnect', 'cardioconnect', 'doctor', 'dr.jayachandra', 'jayachandra', 'aicts'],
    defaultPassword: 'test1234',
    registryAccess: ['hf', 'acs', 'preventive', 'arrhythmia', 'structural', 'cathlab'],
    piOf: ['hf', 'acs', 'preventive'],
  },
  DR_RAJEEV_CHAUHAN: {
    id: 'DR_RAJEEV_CHAUHAN',
    name: 'Dr. Rajeev Chauhan',
    shortName: 'RC',
    email: 'rajeev.chauhan@apexkanpur.in',
    role: 'PI',
    siteId: 'KANPUR_APEX',
    loginUsernames: ['cardiokonnect', 'cardioconnect', 'dr.rajeev', 'rajeev', 'rajeev.chauhan', 'apexkanpur', 'cathlab'],
    defaultPassword: 'cathlab1234',
    // Can see Registry Home (all registries) but only access cathlab data
    registryAccess: ['cathlab'],
    piOf: ['cathlab'],
  },
  DR_NITIN_SHARMA: {
    id: 'DR_NITIN_SHARMA',
    name: 'Dr. Nitin Sharma',
    shortName: 'NS',
    email: 'nitin.sharma@aicts.in',
    role: 'Cardiologist',
    siteId: 'AICTS_PUNE',
    loginUsernames: ['dr.nitin', 'nitin', 'nitin.sharma'],
    defaultPassword: 'nitin1234',
    registryAccess: ['hf', 'acs'],
    piOf: [],
  },
  DR_ARSHDEEP: {
    id: 'DR_ARSHDEEP',
    name: 'Dr. Arshdeep',
    shortName: 'AS',
    email: 'arshdeep@aicts.in',
    role: 'SeniorResident',
    siteId: 'AICTS_PUNE',
    loginUsernames: ['dr.arshdeep', 'arshdeep'],
    defaultPassword: 'arsh1234',
    registryAccess: ['hf'],
    piOf: [],
  },
}

/** Ordered list for the user switcher UI */
export const USER_LIST = Object.values(APP_USERS)

/**
 * Validates login credentials against hardcoded user registry.
 */
export function authenticateUser(usernameInput: string, passwordInput: string): AppUser | null {
  const u = usernameInput.trim().toLowerCase()
  const p = passwordInput.trim()

  for (const user of Object.values(APP_USERS)) {
    const matchesUser = user.loginUsernames.some(name => name.toLowerCase() === u) || user.email.toLowerCase() === u
    if (matchesUser && user.defaultPassword === p) {
      return user
    }
  }
  return null
}
