export function getEnrollmentTrend(records: { hfConfirmationDate?: string; indexDate?: string; createdAt?: string; procedureDate?: string }[]) {
  const sorted = [...records].sort((a, b) => {
    const dateA = a.hfConfirmationDate || a.indexDate || a.procedureDate || a.createdAt || ''
    const dateB = b.hfConfirmationDate || b.indexDate || b.procedureDate || b.createdAt || ''
    return dateA.localeCompare(dateB)
  })

  const countsByMonth: Record<string, number> = {}
  sorted.forEach(p => {
    const dateStr = p.hfConfirmationDate || p.indexDate || p.procedureDate || p.createdAt
    if (!dateStr) return
    const date = new Date(dateStr)
    if (isNaN(date.getTime())) return
    const monthStr = date.toLocaleString('default', { month: 'short' }) + ' ' + date.getFullYear().toString().slice(-2)
    countsByMonth[monthStr] = (countsByMonth[monthStr] || 0) + 1
  })

  let cumulative = 0
  const trend = Object.entries(countsByMonth).map(([month, count]) => {
    cumulative += count
    return { month, count: cumulative }
  })

  if (trend.length === 0) {
    return [{ month: 'Jan', count: 0 }, { month: 'Feb', count: 0 }, { month: 'Mar', count: 0 }]
  }
  return trend
}
