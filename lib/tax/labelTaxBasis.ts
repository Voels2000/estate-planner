/**
 * Canonical label-basis builders for tax surfaces.
 *
 * Contract:
 * - "Current year" labels use today's actual values.
 * - Future labels use projection rows when available.
 * - Missing projection inputs are explicit (no silent substitution).
 */

export type ProjectionGrossEstateRow = {
  year: number
  gross_estate?: number | null
  estate_incl_home?: number | null
}

export type EstateTaxYearBasis = {
  year: number
  grossEstate: number | null
  source: 'actual_today' | 'projection_year' | 'missing'
}

function toFiniteNumber(value: unknown): number | null {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

export function normalizeProjectionGrossEstate(row: ProjectionGrossEstateRow): number | null {
  return toFiniteNumber(row.estate_incl_home ?? row.gross_estate ?? null)
}

export function buildEstateTaxYearBasis(params: {
  currentYear: number
  years: number[]
  todayGrossEstate: number | null
  projectionRows: ProjectionGrossEstateRow[]
}): EstateTaxYearBasis[] {
  const projectedByYear = new Map<number, number>(
    params.projectionRows
      .filter((row) => Number.isFinite(Number(row.year)))
      .map((row) => [Number(row.year), normalizeProjectionGrossEstate(row)])
      .filter((pair): pair is [number, number] => pair[1] !== null),
  )

  return params.years.map((year) => {
    if (year === params.currentYear) {
      return {
        year,
        grossEstate: params.todayGrossEstate,
        source: params.todayGrossEstate === null ? 'missing' : 'actual_today',
      }
    }
    const projected = projectedByYear.get(year)
    return {
      year,
      grossEstate: projected ?? null,
      source: projected === undefined ? 'missing' : 'projection_year',
    }
  })
}
