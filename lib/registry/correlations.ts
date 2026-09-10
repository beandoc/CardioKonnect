// Pearson r — use for grip↔6MWT (both reasonably normal)
export function pearsonR(xs: number[], ys: number[]): number {
  const n = xs.length
  if (n < 2) return 0
  const mx = xs.reduce((a, b) => a + b, 0) / n
  const my = ys.reduce((a, b) => a + b, 0) / n
  const num = xs.reduce((acc, x, i) => acc + (x - mx) * (ys[i] - my), 0)
  const dx = Math.sqrt(xs.reduce((acc, x) => acc + (x - mx) ** 2, 0))
  const dy = Math.sqrt(ys.reduce((acc, y) => acc + (y - my) ** 2, 0))
  return (dx && dy) ? +((num / (dx * dy)).toFixed(4)) : 0
}

// Spearman ρ — correct for log-skewed BNP distribution (rank-based, distribution-free)
export function spearmanR(xs: number[], ys: number[]): number {
  const n = xs.length
  if (n < 2) return 0
  const rank = (arr: number[]) => {
    const sorted = [...arr].map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v)
    const ranks = new Array(n)
    sorted.forEach((item, ri) => { ranks[item.i] = ri + 1 })
    return ranks
  }
  const rx = rank(xs), ry = rank(ys)
  return pearsonR(rx, ry)
}

// Log10-transform BNP for scatter axes (reduces right-skew)
export const log10BNP = (bnp: number) => +(Math.log10(Math.max(bnp, 1))).toFixed(3)
