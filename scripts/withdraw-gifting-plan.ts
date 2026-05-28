// scripts/withdraw-gifting-plan.ts
// ONE-TIME OPS SCRIPT — manual use only, never imported by app code
// Purpose: withdraw an orphaned annual_gifting strategy_line_items row
//          when gift log was deleted but plan row was not
// Usage: npx dotenv -e .env.local -- npx tsx scripts/withdraw-gifting-plan.ts <householdId>
// Requires: SUPABASE_SERVICE_ROLE_KEY in environment (via createAdminClient)
// Safe to run multiple times (idempotent — only active probable/certain rows are withdrawn)

import { createAdminClient } from '../lib/supabase/admin'

async function main() {
  const householdId = process.argv[2]
  if (!householdId) {
    console.error('Usage: tsx scripts/withdraw-gifting-plan.ts <householdId>')
    process.exit(1)
  }

  const admin = createAdminClient()

  const { data: household, error: hhError } = await admin
    .from('households')
    .select('id, owner_id')
    .eq('id', householdId)
    .maybeSingle()

  if (hhError) {
    console.error(hhError.message)
    process.exit(1)
  }
  if (!household?.id) {
    console.error('No household for id', householdId)
    process.exit(1)
  }

  const { data: items, error: listError } = await admin
    .from('strategy_line_items')
    .select('id, strategy_source, amount, confidence_level, scenario_name')
    .eq('household_id', household.id)
    .eq('is_active', true)
    .in('confidence_level', ['probable', 'certain'])

  if (listError) {
    console.error(listError.message)
    process.exit(1)
  }

  console.log('household_id:', household.id)
  console.log('active in-plan rows:', items?.length ?? 0)
  for (const row of items ?? []) {
    console.log(' -', row.strategy_source, row.amount, row.scenario_name, row.confidence_level)
  }

  const gifting = (items ?? []).filter((i) => i.strategy_source === 'annual_gifting')
  if (gifting.length === 0) {
    console.log('No active annual_gifting plan to withdraw.')
    return
  }

  const now = new Date().toISOString()
  for (const row of gifting) {
    const { error } = await admin
      .from('strategy_line_items')
      .update({
        is_active: false,
        consumer_withdrawn: true,
        withdrawn_at: now,
        reversed_from: row.confidence_level,
        reversal_reason: 'Withdrawn — gift log removed; plan no longer applies',
        consumer_accepted: false,
      })
      .eq('id', row.id)

    if (error) {
      console.error('Withdraw failed', row.id, error.message)
      process.exit(1)
    }
    console.log('Withdrew annual_gifting', row.id, 'amount', row.amount)
  }

  await admin.from('households').update({ updated_at: now }).eq('id', household.id)
  console.log('Done. Refresh estate-tax / trust-strategy pages.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
