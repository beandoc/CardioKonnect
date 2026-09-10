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

export function safeTime(dateStr: string | undefined | null): number {
  if (!dateStr) return 0
  const t = new Date(dateStr).getTime()
  return isNaN(t) ? 0 : t
}

export function fullName(patient: { firstName?: string; lastName?: string } | null | undefined): string {
  if (!patient) return ''
  return [patient.firstName, patient.lastName].filter(Boolean).join(' ').trim() || '—'
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

// Comprehensive military rank & sensitive prefix sanitization
export function cleanMilitaryRanks(rawName: string): string {
  if (!rawName) return ''
  let str = String(rawName).trim()

  // 1. Check for hyphen with relationship prefix (e.g. W/O, M/O, F/O, S/O, D/O, H/O ... - PATIENT_NAME)
  if (str.includes('-')) {
    const parts = str.split('-').map(p => p.trim()).filter(Boolean)
    if (parts.length >= 2) {
      const prefixPart = parts[0]
      let patientPart = parts.slice(1).join(' ').trim()
      
      // If patient part is a single name like PREMVATHI, inherit surname from prefix if available
      if (!patientPart.includes(' ')) {
        const prefixWords = prefixPart
          .replace(/\b(M\/O|W\/O|F\/O|S\/O|D\/O|H\/O|LT|COL|MAJ|GEN|BRIG|CAPT|HAV|NK|SUB|SGT|NB)\b/gi, ' ')
          .trim().split(/\s+/).filter(Boolean)
        const surname = prefixWords[prefixWords.length - 1]
        if (surname && surname.length > 1 && !/^[A-Z]$/i.test(surname)) {
          patientPart = `${patientPart} ${surname}`
        }
      }
      str = patientPart
    }
  }

  // 2. Clean relationship prefixes: W/O, M/O, F/O, S/O, D/O, H/O, SELF
  str = str.replace(/\b(?:M\/O|F\/O|W\/O|S\/O|D\/O|H\/O|SELF)\b/gi, ' ')

  // 3. Clean retired / ex designations
  str = str.replace(/\b(?:RTD\.?|RETIRED|EX[-\s]|EX\b|NCE\b)/gi, ' ')

  // 4. Clean all military ranks (Army, Air Force, Navy, JCO, NCO, OR, etc.)
  const militaryPatterns = [
    /\bMAJOR\s+GENERAL\b/gi,
    /\bMAJ\.?\s*GEN\.?\b/gi,
    /\bLIEUTENANT\s+COLONEL\b/gi,
    /\bLT\.?\s*COL\.?\b/gi,
    /\bBRIGADIER\b/gi,
    /\bBRIG\.?\b/gi,
    /\bCOLONEL\b/gi,
    /\bCOL\.?\b/gi,
    /\bGROUP\s+CAPTAIN\b/gi,
    /\bGP\.?\s*CAPT\.?\b/gi,
    /\bGP\b/gi,
    /\bAIR\s+COMMODORE\b/gi,
    /\bCOMMODORE\b/gi,
    /\bCMDE\.?\b/gi,
    /\bWING\s+COMMANDER\b/gi,
    /\bWG\.?\s*CDR\.?\b/gi,
    /\bSQUADRON\s+LEADER\b/gi,
    /\bSQN\.?\s*LDR\.?\b/gi,
    /\bFLIGHT\s+LIEUTENANT\b/gi,
    /\bFLT\.?\s*LT\.?\b/gi,
    /\bFLYING\s+OFFICER\b/gi,
    /\bFG\.?\s*OFFR\.?\b/gi,
    /\bSUBEDAR\s+MAJOR\b/gi,
    /\bSUB\.?\s*MAJ\.?\b/gi,
    /\bNAIB\s+SUBEDAR\b/gi,
    /\bNB[\s\/\.]+SUB\.?\b/gi,
    /\bNB\b/gi,
    /\bSUBEDAR\b/gi,
    /\bSUB\.?\b/gi,
    /\bHAVILDAR\b/gi,
    /\bHAVALDAR\b/gi,
    /\bHAV\.?\b/gi,
    /\bNAIK\b/gi,
    /\bNK\.?\b/gi,
    /\bSEPOY\b/gi,
    /\bSEP\.?\b/gi,
    /\bMAJOR\b/gi,
    /\bMAJ\.?\b/gi,
    /\bCAPTAIN\b/gi,
    /\bCAPT\.?\b/gi,
    /\bLIEUTENANT\b/gi,
    /\bLT\.?\b/gi,
    /\bJUNIOR\s+WARRANT\s+OFFICER\b/gi,
    /\bJWO\b/gi,
    /\bMASTER\s+WARRANT\s+OFFICER\b/gi,
    /\bMWO\b/gi,
    /\bWARRANT\s+OFFICER\b/gi,
    /\bWO\b/gi,
    /\bLEADING\s+AIRCRAFTMAN\b/gi,
    /\bLAC\b/gi,
    /\bAIRCRAFTMAN\b/gi,
    /\bAC\b/gi,
    /\bSERGEANT\b/gi,
    /\bSGT\.?\b/gi,
    /\bCOMMANDER\b/gi,
    /\bCDR\.?\b/gi,
    /\bADMIRAL\b/gi,
    /\bADM\.?\b/gi,
    /\bJCO\b/gi,
    /\bNCO\b/gi,
  ]

  for (const pat of militaryPatterns) {
    str = str.replace(pat, ' ')
  }

  // 5. Clean punctuation, slashes, extra spaces
  str = str.replace(/[\\\/_]/g, ' ').replace(/\s+/g, ' ').trim()
  str = str.replace(/^[\/\-\.\s]+/, '').trim()
  str = str.replace(/[\/\-\.]+$/, '').trim()

  return str
}

export function splitPatientName(cleanFullName: string): { firstName: string; lastName: string } {
  const words = cleanFullName.split(/\s+/).filter(Boolean)
  if (words.length <= 1) {
    return { firstName: words[0] || '', lastName: '' }
  }
  return {
    firstName: words.slice(0, -1).join(' '),
    lastName: words[words.length - 1],
  }
}

export function initials(firstName: string, lastName: string): string {
  const cleanFirst = cleanMilitaryRanks(firstName || '')
  const cleanLast = cleanMilitaryRanks(lastName || '')
  return ((cleanFirst?.[0] ?? '') + (cleanLast?.[0] ?? '')).toUpperCase()
}

export function generateMRN(siteId?: string, registryId?: string): string {
  const year = new Date().getFullYear()
  const rand = String(Math.floor(1000 + Math.random() * 9000))
  if (siteId === 'KANPUR_APEX' || registryId === 'cathlab') {
    return `7AFH-${year}-${rand}`
  }
  return `AICTS-${year}-${rand}`
}

