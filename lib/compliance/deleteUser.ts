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
  'household_people',
  'asset_beneficiaries',
  'entity_titling',
  'legal_documents',
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

/**
 * Tables with direct auth.users FK references — cleared before Auth delete.
 * email_captures uses email (no user_id column); referral_clicks uses advisor_id /
 * attorney_profile_id and is handled separately.
 */
const FK_TABLES_TO_USER = [
  { table: 'notifications', column: 'user_id' },
  { table: 'assessment_results', column: 'user_id' },
  { table: 'funnel_events', column: 'user_id' },
  { table: 'privacy_requests', column: 'user_id' },
  { table: 'deletion_schedule', column: 'user_id' },
  { table: 'ingestion_jobs', column: 'owner_id' },
  { table: 'profiles', column: 'id' },
] as const

/** Full deletion order — FK tables included so nothing is missed in the main loop. */
const DELETION_ORDER = [
  ...OWNER_TABLES,
  ...HOUSEHOLD_TABLES,
  'households',
  ...FK_TABLES_TO_USER.map(({ table }) => table),
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

async function deleteAuthUserWithFallback(
  admin: SupabaseClient,
  userId: string,
  email: string,
  dryRun: boolean,
): Promise<boolean> {
  if (dryRun) return false

  let authUserDeleted = false

  const { error: hardError } = await admin.auth.admin.deleteUser(userId)
  if (hardError) {
    const { error: softError } = await admin.auth.admin.deleteUser(userId, true)
    if (!softError) {
      authUserDeleted = true
      console.warn(
        `[deleteUser] Soft delete used for ${email} — hard delete blocked: ${hardError.message}`,
      )
    }
  } else {
    authUserDeleted = true
  }

  if (authUserDeleted) {
    const { data, error } = await admin.auth.admin.getUserById(userId)
    if (!error && data.user && !data.user.deleted_at) {
      console.warn(`[deleteUser] Auth user ${email} may still exist after deletion attempt`)
    }
  }

  return authUserDeleted
}

async function clearFkReferencesToUser(
  admin: SupabaseClient,
  userId: string,
  email: string,
  dryRun: boolean,
  rowsDeleted: Record<string, number>,
  tablesCleared: string[],
): Promise<void> {
  for (const { table, column } of FK_TABLES_TO_USER) {
    const n = await deleteByColumn(admin, table, column, userId, dryRun)
    rowsDeleted[table] = (rowsDeleted[table] ?? 0) + n
    if (!tablesCleared.includes(table)) tablesCleared.push(table)
  }

  if (dryRun) {
    const { count } = await admin
      .from('email_captures')
      .select('*', { count: 'exact', head: true })
      .eq('email', email)
    rowsDeleted.email_captures = count ?? 0
  } else {
    const { count, error } = await admin
      .from('email_captures')
      .delete({ count: 'exact' })
      .eq('email', email)
    if (error) throw new Error(`email_captures: ${error.message}`)
    rowsDeleted.email_captures = count ?? 0
  }
  if (!tablesCleared.includes('email_captures')) tablesCleared.push('email_captures')
}

async function verifyDeletion(
  admin: SupabaseClient,
  userId: string,
  householdId: string | null,
  dryRun: boolean,
): Promise<string[]> {
  const verificationErrors: string[] = []
  if (dryRun) return verificationErrors

  const checks: Array<{ table: string; column: string; id: string | null }> = [
    { table: 'profiles', column: 'id', id: userId },
    { table: 'households', column: 'owner_id', id: userId },
    { table: 'assets', column: 'owner_id', id: userId },
    { table: 'income', column: 'owner_id', id: userId },
    { table: 'expenses', column: 'owner_id', id: userId },
  ]

  if (householdId) {
    checks.push({ table: 'households', column: 'id', id: householdId })
  }

  for (const { table, column, id } of checks) {
    if (!id) continue

    const { count } = await admin
      .from(table)
      .select('*', { count: 'exact', head: true })
      .eq(column, id)

    if (count && count > 0) {
      verificationErrors.push(`${table}: ${count} rows remain after deletion`)
    }
  }

  if (verificationErrors.length > 0) {
    console.error('[deleteUser] Verification failed:', verificationErrors)
  }

  return verificationErrors
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
      .select('id')
      .eq('id', userId)
      .maybeSingle()

    if (!profile) {
      // No profile — orphaned Auth user. Delete Auth record directly.
      await clearFkReferencesToUser(admin, userId, email, dryRun, rowsDeleted, tablesCleared)

      const authUserDeleted = await deleteAuthUserWithFallback(admin, userId, email, dryRun)

      await admin.from('deletion_audit_log').insert({
        user_id: userId,
        email,
        reason,
        initiated_by: initiatedBy,
        dry_run: dryRun,
        tables_cleared: dryRun ? [] : ['auth_user_only'],
        rows_deleted: rowsDeleted,
        auth_deleted: authUserDeleted,
        success: true,
        completed_at: completedAt,
      })

      return {
        success: true,
        userId,
        email,
        tablesCleared: dryRun ? [] : ['auth_user_only'],
        rowsDeleted,
        authUserDeleted,
        completedAt,
      }
    }

    const { data: household } = await admin
      .from('households')
      .select('id')
      .eq('owner_id', userId)
      .maybeSingle()

    const householdId = household?.id ?? null

    const userIdColumnTables = new Set(['insurance_policies', 'life_events', 'funnel_events'])
    const skipGenericDelete = new Set([
      'advisor_clients',
      'attorney_clients',
      'connection_requests',
      'referral_clicks',
      'ingestion_jobs',
      'funnel_events',
    ])

    const deleteScoped = async (table: string, column: string, value: string) => {
      const n = await deleteByColumn(admin, table, column, value, dryRun)
      rowsDeleted[table] = (rowsDeleted[table] ?? 0) + n
      if (!tablesCleared.includes(table)) tablesCleared.push(table)
    }

    if (!dryRun) {
      await admin
        .from('advisor_clients')
        .delete()
        .or(`advisor_id.eq.${userId},client_id.eq.${userId}`)
      await admin.from('connection_requests').delete().eq('consumer_id', userId)
      await admin
        .from('referral_clicks')
        .delete()
        .or(`advisor_id.eq.${userId},attorney_profile_id.eq.${userId}`)
    }
    tablesCleared.push('advisor_clients', 'connection_requests', 'referral_clicks')

    for (const table of DELETION_ORDER) {
      if (skipGenericDelete.has(table)) continue
      if (table === 'households') continue
      if ((FK_TABLES_TO_USER as readonly { table: string }[]).some((f) => f.table === table)) {
        continue
      }

      if ((HOUSEHOLD_TABLES as readonly string[]).includes(table)) {
        if (!householdId) continue
        await deleteScoped(table, 'household_id', householdId)
        continue
      }

      const column = userIdColumnTables.has(table) ? 'user_id' : 'owner_id'
      await deleteScoped(table, column, userId)
    }

    if (householdId) {
      if (!dryRun) {
        await admin.from('attorney_clients').delete().eq('client_id', householdId)
      }
      if (!tablesCleared.includes('attorney_clients')) tablesCleared.push('attorney_clients')

      if (!dryRun) {
        const { error } = await admin.from('households').delete().eq('id', householdId)
        if (error) throw new Error(`households: ${error.message}`)
      }
      if (!tablesCleared.includes('households')) tablesCleared.push('households')
      rowsDeleted.households = (rowsDeleted.households ?? 0) + 1
    }

    // After deleting all known tables, clear any remaining direct auth.users FK references.
    await clearFkReferencesToUser(admin, userId, email, dryRun, rowsDeleted, tablesCleared)

    const authUserDeleted = await deleteAuthUserWithFallback(admin, userId, email, dryRun)

    const verificationErrors = await verifyDeletion(admin, userId, householdId, dryRun)
    const verificationFailed = verificationErrors.length > 0

    await admin.from('deletion_audit_log').insert({
      user_id: userId,
      email,
      reason,
      initiated_by: initiatedBy,
      dry_run: dryRun,
      tables_cleared: tablesCleared,
      rows_deleted: rowsDeleted,
      auth_deleted: authUserDeleted,
      success: !verificationFailed,
      error_message: verificationFailed
        ? `verification_failed: ${verificationErrors.join('; ')}`
        : undefined,
      completed_at: completedAt,
    })

    if (verificationFailed) {
      return {
        success: false,
        userId,
        email,
        tablesCleared,
        rowsDeleted,
        authUserDeleted,
        error: verificationErrors.join('; '),
        completedAt,
      }
    }

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
