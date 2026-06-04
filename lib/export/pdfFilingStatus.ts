/** Pure filing-status normalization for PDF/brief — safe for client and server imports. */

export type PdfFilingStatus = 'mfj' | 'single' | 'widow'

export function normalizePdfFilingStatus(raw: string | null | undefined): PdfFilingStatus {
  const n = (raw ?? '').toLowerCase()
  if (['mfj', 'married_joint', 'married_filing_jointly', 'joint'].includes(n)) return 'mfj'
  if (['qw', 'qualifying_widow', 'widow'].includes(n)) return 'widow'
  return 'single'
}
