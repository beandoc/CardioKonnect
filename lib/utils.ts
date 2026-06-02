import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, parseISO, differenceInYears } from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getAge(dob: string): number | null {
  if (!dob) return null
  try { return differenceInYears(new Date(), parseISO(dob)) }
  catch { return null }
}

export function formatDate(iso: string | undefined, fmt = 'dd MMM yyyy'): string {
  if (!iso) return '—'
  try { return format(parseISO(iso), fmt) }
  catch { return iso }
}

export function nyhaBadgeColor(nyha: string | undefined) {
  const map: Record<string, string> = {
    I:   'badge badge-green',
    II:  'badge badge-blue',
    III: 'badge badge-amber',
    IV:  'badge badge-red',
  }
  return map[nyha ?? ''] ?? 'badge badge-gray'
}

export function hfTypeBadgeColor(hfType: string | undefined) {
  const map: Record<string, string> = {
    HFrEF:   'badge badge-red',
    HFmrEF:  'badge badge-amber',
    HFpEF:   'badge badge-blue',
  }
  return map[hfType ?? ''] ?? 'badge badge-gray'
}

export function lvefColor(lvef: number | undefined): string {
  if (!lvef) return 'text-slate-500'
  if (lvef < 35) return 'font-bold' // handled inline with style
  if (lvef < 50) return 'font-bold'
  return 'font-bold'
}

export function initials(firstName: string, lastName: string): string {
  return ((firstName?.[0] ?? '') + (lastName?.[0] ?? '')).toUpperCase()
}

export function generateMRN(): string {
  return 'CP-' + String(Date.now()).slice(-6)
}
