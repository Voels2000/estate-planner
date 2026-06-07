export type AdjustedTaxableGiftRow = {
  id: string
  household_id: string
  gift_year: number
  amount: number
  recipient_description: string | null
  three_year_clawback: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

export const ATG_SELECT =
  'id, household_id, gift_year, amount, recipient_description, three_year_clawback, notes, created_at, updated_at'

export function parseAtgGiftYear(raw: unknown): number | null {
  const year = Number(raw)
  if (!Number.isFinite(year) || year < 1977 || year > 2100) return null
  return Math.trunc(year)
}

export function parseAtgAmount(raw: unknown): number | null {
  const amount = Number(raw)
  if (!Number.isFinite(amount) || amount <= 0) return null
  return amount
}

export function sumAdjustedTaxableGifts(rows: Pick<AdjustedTaxableGiftRow, 'amount'>[]): number {
  return rows.reduce((s, r) => s + Number(r.amount), 0)
}
