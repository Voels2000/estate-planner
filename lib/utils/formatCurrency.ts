export function formatDollars(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(Math.round(n))
}

export function formatDollarsCompact(n: number): string {
  if (Math.abs(n) >= 1_000_000) {
    return '$' + (Math.round(n / 100_000) / 10).toFixed(1) + 'M'
  }
  if (Math.abs(n) >= 1_000) {
    return '$' + Math.round(n / 1_000) + 'K'
  }
  return formatDollars(n)
}
