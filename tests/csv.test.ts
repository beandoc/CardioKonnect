import { describe, it, expect } from 'vitest'
import { csvCell, toCsv } from '../lib/csv'

describe('csv', () => {
  it('neutralises spreadsheet formula prefixes', () => {
    expect(csvCell('=HYPERLINK("http://x","y")')).toBe(`"'=HYPERLINK(""http://x"",""y"")"`)
    expect(csvCell('+1-555')).toBe(`"'+1-555"`)
    expect(csvCell('@SUM(A1)')).toBe(`"'@SUM(A1)"`)
  })

  it('quotes commas, quotes and newlines', () => {
    expect(csvCell('Pune, MH')).toBe('"Pune, MH"')
    expect(csvCell('a "b"')).toBe('"a ""b"""')
    expect(csvCell('line1\nline2')).toBe('"line1\nline2"')
  })

  it('writes numbers and blanks as-is', () => {
    expect(csvCell(-3.5)).toBe('-3.5')
    expect(csvCell(undefined)).toBe('')
    expect(csvCell(NaN)).toBe('')
  })

  it('produces one record per row', () => {
    expect(toCsv([['a', 'b'], [1, 'x,y']])).toBe('a,b\r\n1,"x,y"')
  })
})
