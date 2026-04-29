/**
 * Client loader for the consumer projections page.
 *
 * Fetches `/api/projection` (no-store) and maps API rows into `ProjectionYear[]`.
 */

import { mapProjectionRows } from '@/lib/projections/mappers/mapProjectionRows'
import type {
  HouseholdProjectionProfile,
  ProjectionApiRow,
  ProjectionYear,
} from '@/lib/projections/types'

type LoadProjectionPageDataResult = {
  household: HouseholdProjectionProfile | null
  projections: ProjectionYear[]
}

export async function loadProjectionPageData(): Promise<LoadProjectionPageDataResult> {
  const res = await fetch('/api/projection', { cache: 'no-store' })
  if (!res.ok) throw new Error('Failed to load projection data')

  const payload = (await res.json()) as {
    rows?: ProjectionApiRow[]
    household?: HouseholdProjectionProfile | null
  }

  const household = payload.household ?? null
  if (!household) throw new Error('No household found')

  const rows = payload.rows ?? []
  return {
    household,
    projections: mapProjectionRows(rows, household),
  }
}
