import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export type DeletionReason =
  | 'user_request'
  | 'subscription_cancelled'
  | 'admin_initiated'
  | 'account_closed'

export type DeletionResult = {
  success: boolean
  userId: string
  email: string
  tablesCleared: string[]
  rowsDeleted: Record<string, number>
  authUserDeleted: boolean
  error?: string
  completedAt: string
}

/** Household-scoped tables (deleted when household_id is known). */
const HOUSEHOLD_TABLES = [
  'strategy_line_items',
  'gift_history',
  'projection_scenarios',
  'estate_health_scores',
  'beneficiary_conflicts',
  'assessment_results',
  'household_people',
  'asset_beneficiaries',
  'entity_titling',
  'legal_documents',
  'notifications',
] as const

/** Owner-scoped tables. */
const OWNER_TABLES = [
  'ingestion_jobs',
  'assets',
  'income',
  'expenses',
  'liabilities',
  'real_estate',
  'insurance_policies',
  'businesses',
  'trusts',
  'digital_assets',
  'life_events',
  'funnel_events',
  'advisor_clients',
  'attorney_clients',
  'connection_requests',
  'referral_clicks',
] as const

async function deleteByColumn(
  admin: SupabaseClient,
  table: string,
  column: string,
  id: string,
  dryRun: boolean,
): Promise<number> {
  if (dryRun) {
    const { count } = await admin
      .from(table)
      .select('*', { count: 'exact', head: true })
      .eq(column, id)
    return count ?? 0
  }
  const { count, error } = await admin
    .from(table)
    .delete({ count: 'exact' })
    .eq(column, id)
  if (error) throw new Error(`${table}: ${error.message}`)
  return count ?? 0
}

export async function deleteUserData(params: {
  userId: string
  email: string
  reason: DeletionReason
  initiatedBy: string
  dryRun?: boolean
  supabaseUrl: string
  supabaseServiceKey: string
}): Promise<DeletionResult> {
  const {
    userId,
    email,
    reason,
    initiatedBy,
    dryRun = false,
    supabaseUrl,
    supabaseServiceKey,
  } = params

  const admin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  })

  const tablesCleared: string[] = []
  const rowsDeleted: Record<string, number> = {}
  const completedAt = new Date().toISOString()

  try {
    const { data: profile } = await admin
      .from('profiles')
      .select('id, household_id')
      .eq('id', userId)
      .maybeSingle()

    if (!profile) {
      return {
        success: false,
        userId,
        email,
        tablesCleared: [],
        rowsDeleted: {},
        authUserDeleted: false,
        error: 'Profile not found — user may already be deleted',
        completedAt,
      }
    }

    const householdId = profile.household_id as string | null

    const ownerColumn = (table: string) =>
      table === 'insurance_policies' ? 'user_id' : 'owner_id'

    for (const table of OWNER_TABLES) {
      const n = await deleteByColumn(admin, table, ownerColumn(table), userId, dryRun)
      rowsDeleted[table] = n
      tablesCleared.push(table)
    }

    if (householdId) {
      for (const table of HOUSEHOLD_TABLES) {
        const n = await deleteByColumn(admin, table, 'household_id', householdId, dryRun)
        rowsDeleted[table] = n
        tablesCleared.push(table)
      }
      if (!dryRun) {
        const { error } = await admin.from('households').delete().eq('id', householdId)
        if (error) throw new Error(`households: ${error.message}`)
      }
      tablesCleared.push('households')
      rowsDeleted.households = 1
    }

    if (!dryRun) {
      const { error: profileErr } = await admin.from('profiles').delete().eq('id', userId)
      if (profileErr) throw new Error(`profiles: ${profileErr.message}`)
    }
    tablesCleared.push('profiles')

    let authUserDeleted = false
    if (!dryRun) {
      const { error: authError } = await admin.auth.admin.deleteUser(userId)
      authUserDeleted = !authError
      if (authError) throw new Error(`auth: ${authError.message}`)
    }

    await admin.from('deletion_audit_log').insert({
      user_id: userId,
      email,
      reason,
      initiated_by: initiatedBy,
      dry_run: dryRun,
      tables_cleared: tablesCleared,
      rows_deleted: rowsDeleted,
      auth_deleted: authUserDeleted,
      completed_at: completedAt,
      success: true,
    })

    return {
      success: true,
      userId,
      email,
      tablesCleared,
      rowsDeleted,
      authUserDeleted,
      completedAt,
    }
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error'

    await admin
      .from('deletion_audit_log')
      .insert({
        user_id: userId,
        email,
        reason,
        initiated_by: initiatedBy,
        dry_run: dryRun,
        success: false,
        error_message: error,
        completed_at: completedAt,
      })
      .then(() => {})

    return {
      success: false,
      userId,
      email,
      tablesCleared,
      rowsDeleted,
      authUserDeleted: false,
      error,
      completedAt,
    }
  }
}
