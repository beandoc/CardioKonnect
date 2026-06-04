import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, differenceInYears } from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function parseDateString(str: string | undefined): Date {
  if (!str) return new Date(NaN)
  
  // Try parsing DD/MM/YYYY or D/M/YYYY
  if (str.includes('/')) {
    const parts = str.split('/')
    if (parts.length === 3) {
      const d = parseInt(parts[0], 10)
      const m = parseInt(parts[1], 10) - 1
      const y = parseInt(parts[2], 10)
      const date = new Date(y, m, d)
      if (!isNaN(date.getTime())) return date
    }
  }
  
  // Try parsing YYYY-MM-DD or DD-MM-YYYY
  if (str.includes('-')) {
    const parts = str.split('-')
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        // YYYY-MM-DD
        const y = parseInt(parts[0], 10)
        const m = parseInt(parts[1], 10) - 1
        const d = parseInt(parts[2], 10)
        const date = new Date(y, m, d)
        if (!isNaN(date.getTime())) return date
      } else {
        // DD-MM-YYYY
        const d = parseInt(parts[0], 10)
        const m = parseInt(parts[1], 10) - 1
        const y = parseInt(parts[2], 10)
        const date = new Date(y, m, d)
        if (!isNaN(date.getTime())) return date
      }
    }
  }

  // Fallback to standard Date parsing
  return new Date(str)
}

export function getAge(dob: string): number | null {
  if (!dob) return null
  try {
    const parsed = parseDateString(dob)
    if (isNaN(parsed.getTime())) return null
    return differenceInYears(new Date(), parsed)
  }
  catch { return null }
}

export function formatDate(iso: string | undefined, fmt = 'dd MMM yyyy'): string {
  if (!iso) return '—'
  try {
    const parsed = parseDateString(iso)
    if (isNaN(parsed.getTime())) return iso
    return format(parsed, fmt)
  }
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
