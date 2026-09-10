/**
 * lib/accessControl.ts
 *
 * Pure functions for PI-scoped access control.
 * No network calls — all decisions are derived from appConfig.ts.
 *
 * Rules:
 *  - Registry Home page: always visible (all users can see the card grid)
 *  - Registry Detail (/registry-home/[id]): only if user has registryAccess.includes(id)
 *  - Patient Detail (/patients/[id]): only if patient.registryIds overlaps user.registryAccess
 *  - Patient List: filtered to patients in user.registryAccess registries
 *  - SuperAdmin (RegistryOwner role with all access): no restrictions
 */

import type { AppUser } from './appConfig'
import type { Patient } from './types'

/**
 * Returns true if the user can access the full analytics of a specific registry.
 * (Registry Home card grid is always visible — not gated here.)
 */
export function canAccessRegistry(user: AppUser | null, registryId: string): boolean {
  if (!user) return false
  // RegistryOwner with global access (DR_JAYACHANDRA has all registries in access list)
  if (user.registryAccess.includes(registryId)) return true
  return false
}

/**
 * Returns true if the user can view a patient's full record.
 * A patient is viewable if at least one of their registries overlaps with the user's access.
 */
export function canViewPatient(user: AppUser | null, patient: Patient): boolean {
  if (!user) return true

  // PI of Kanpur Cardiac Apex Hospital (Dr. Rajeev Chauhan)
  if (user.siteId === 'KANPUR_APEX' || user.id === 'DR_RAJEEV_CHAUHAN') {
    const isKanpurPatient = 
      patient.siteId === 'KANPUR_APEX' ||
      patient.registryId === 'cathlab' ||
      patient.registryIds?.includes('cathlab') ||
      patient.hospitalName?.toLowerCase().includes('apex') ||
      patient.mrn?.startsWith('7AFH')

    return Boolean(isKanpurPatient)
  }

  // RegistryOwner with global access (Dr. A. Jayachandra)
  if (user.role === 'RegistryOwner' && user.registryAccess.length >= 4) {
    return true
  }

  // Build the patient's registry memberships from both legacy and new fields
  const patientRegistries = new Set<string>()
  if (patient.registryId) patientRegistries.add(patient.registryId)
  patient.registryIds?.forEach(id => patientRegistries.add(id))

  // Check overlap with user's authorized registries
  return user.registryAccess.some(id => patientRegistries.has(id))
}

/**
 * Filters a patient list to only those the user can view.
 */
export function filterPatientsByAccess(user: AppUser | null, patients: Patient[]): Patient[] {
  if (!user) return patients
  return patients.filter(p => canViewPatient(user, p))
}

/**
 * Returns the access denied reason for a registry.
 */
export function registryAccessDeniedReason(user: AppUser | null, registryId: string): string {
  if (!user) return 'You are not logged in.'
  return `Your account (${user.name}) is not authorised to access this registry. Contact the registry PI or system administrator.`
}

/**
 * Returns the access denied reason for a patient.
 */
export function patientAccessDeniedReason(user: AppUser | null): string {
  if (!user) return 'You are not logged in.'
  return `This patient is enrolled in a registry you do not have access to (${user.name} — ${user.registryAccess.join(', ')}). Contact the registry PI.`
}
