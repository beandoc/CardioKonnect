/**
 * RFC 4180 CSV serialisation with spreadsheet formula-injection protection.
 *
 * Text cells beginning with =, +, -, @, tab or carriage return are prefixed
 * with an apostrophe so Excel / Sheets treat them as text, not formulas.
 * Numbers are written as-is (a negative number is data, not a formula).
 */

const FORMULA_PREFIX = /^[=+\-@\t\r]/

export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : ''
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  let s = String(value)
  if (FORMULA_PREFIX.test(s)) s = `'${s}`
  return /[",\r\n']/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv(rows: unknown[][]): string {
  return rows.map(row => row.map(csvCell).join(',')).join('\r\n')
}
