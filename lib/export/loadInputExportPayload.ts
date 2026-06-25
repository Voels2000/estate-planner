import type { SupabaseClient } from '@supabase/supabase-js'
import {
  EXPORT_INPUT_TABLES,
  type ExportInputTable,
} from '@/lib/access/inputComputedBoundary'

export const INPUT_EXPORT_SCHEMA_VERSION = '1' as const

export type InputExportPayload = {
  schema_version: typeof INPUT_EXPORT_SCHEMA_VERSION
  exported_at: string
  /** Echo boundary source — consumers must not expect computed tables here. */
  boundary: 'EXPORT_INPUT_TABLES'
  household_id: string | null
  tables: Record<ExportInputTable, unknown[]>
}

type OwnerScope =
  | { column: 'owner_id'; value: string }
  | { column: 'user_id'; value: string }

const TABLE_OWNER_SCOPE: Record<ExportInputTable, OwnerScope['column']> = {
  households: 'owner_id',
  assets: 'owner_id',
  liabilities: 'owner_id',
  income: 'owner_id',
  expenses: 'owner_id',
  insurance_policies: 'user_id',
  real_estate: 'owner_id',
  businesses: 'owner_id',
}

/**
 * Serialize input tables for the authenticated household owner.
 * Inputs-only by construction: only EXPORT_INPUT_TABLES are queried.
 */
export async function loadInputExportPayload(
  supabase: SupabaseClient,
  userId: string,
): Promise<InputExportPayload> {
  const tables = {} as Record<ExportInputTable, unknown[]>

  for (const table of EXPORT_INPUT_TABLES) {
    const ownerColumn = TABLE_OWNER_SCOPE[table]
    const { data, error } = await supabase.from(table).select('*').eq(ownerColumn, userId)

    if (error) {
      throw new Error(`export ${table}: ${error.message}`)
    }

    tables[table] = data ?? []
  }

  const householdRows = tables.households as { id?: string }[]
  const household_id =
    householdRows.length === 1 ? (householdRows[0]?.id ?? null) : (householdRows[0]?.id ?? null)

  return {
    schema_version: INPUT_EXPORT_SCHEMA_VERSION,
    exported_at: new Date().toISOString(),
    boundary: 'EXPORT_INPUT_TABLES',
    household_id,
    tables,
  }
}
