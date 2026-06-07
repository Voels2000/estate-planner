import type { SupabaseClient } from '@supabase/supabase-js'
import { recomputeCompositionCache } from '@/lib/verify/recomputeCompositionCache'

export type StrategyLifecycleStep = {
  id: string
  pass: boolean
  detail: string
}

export type StrategyLifecycleResult = {
  passed: boolean
  steps: StrategyLifecycleStep[]
  cleanedUp: boolean
}

const VERIFY_STRATEGY_SOURCE = 'annual_gifting'
const VERIFY_SCENARIO_NAME = '__estate_verify_lifecycle__'
const VERIFY_TEST_AMOUNT = 250_000

function record(steps: StrategyLifecycleStep[], id: string, pass: boolean, detail: string) {
  steps.push({ id, pass, detail })
}

/** Mutating lifecycle probe — e2e / disposable households only. */
export async function runStrategyLifecycleVerification(
  admin: SupabaseClient,
  householdId: string,
  tolerance = 1,
): Promise<StrategyLifecycleResult> {
  const steps: StrategyLifecycleStep[] = []
  let lineItemId: string | null = null
  let advisorLineItemId: string | null = null
  let cleanedUp = true

  try {
    const baseline = await recomputeCompositionCache(admin, householdId)
    const baselineOutside = Number(baseline.consumer.outside_strategy_total ?? 0)

    const { data: inserted, error: insertErr } = await admin
      .from('strategy_line_items')
      .insert({
        household_id: householdId,
        scenario_id: 'current_law',
        projection_year: null,
        metric_target: 'taxable_estate',
        category: 'gifting',
        strategy_source: VERIFY_STRATEGY_SOURCE,
        source_role: 'consumer',
        amount: VERIFY_TEST_AMOUNT,
        sign: -1,
        confidence_level: 'probable',
        effective_year: new Date().getFullYear(),
        scenario_name: VERIFY_SCENARIO_NAME,
        is_active: true,
        consumer_accepted: false,
        consumer_rejected: false,
      })
      .select('id')
      .single()

    if (insertErr || !inserted?.id) {
      record(steps, 'consumer-insert', false, insertErr?.message ?? 'insert failed')
      return { passed: false, steps, cleanedUp: true }
    }
    lineItemId = inserted.id
    record(steps, 'consumer-insert', true, `row ${inserted.id.slice(0, 8)}… amount $${VERIFY_TEST_AMOUNT.toLocaleString()}`)

    const afterInsert = await recomputeCompositionCache(admin, householdId)
    const outsideAfterInsert = Number(afterInsert.consumer.outside_strategy_total ?? 0)
    const outsideDelta = outsideAfterInsert - baselineOutside
    record(
      steps,
      'consumer-outside-strategy',
      Math.abs(outsideDelta - VERIFY_TEST_AMOUNT) <= tolerance,
      `outside_strategy_total ${baselineOutside.toLocaleString()} → ${outsideAfterInsert.toLocaleString()} (Δ ${outsideDelta.toLocaleString()})`,
    )

    const now = new Date().toISOString()
    const { error: withdrawErr } = await admin
      .from('strategy_line_items')
      .update({
        is_active: false,
        consumer_withdrawn: true,
        withdrawn_at: now,
        reversed_from: 'probable',
        consumer_accepted: false,
      })
      .eq('id', lineItemId)

    record(
      steps,
      'consumer-withdraw',
      !withdrawErr,
      withdrawErr?.message ?? 'withdrawn (is_active=false)',
    )

    const afterWithdraw = await recomputeCompositionCache(admin, householdId)
    const outsideAfterWithdraw = Number(afterWithdraw.consumer.outside_strategy_total ?? 0)
    record(
      steps,
      'consumer-withdraw-revert',
      Math.abs(outsideAfterWithdraw - baselineOutside) <= tolerance,
      `outside_strategy_total back to ${outsideAfterWithdraw.toLocaleString()} (baseline ${baselineOutside.toLocaleString()})`,
    )

    await admin.from('strategy_line_items').delete().eq('id', lineItemId)
    lineItemId = null

    const { data: advisorRow, error: advisorInsertErr } = await admin
      .from('strategy_line_items')
      .insert({
        household_id: householdId,
        scenario_id: 'current_law',
        projection_year: null,
        metric_target: 'taxable_estate',
        category: 'gifting',
        strategy_source: VERIFY_STRATEGY_SOURCE,
        source_role: 'advisor',
        amount: 100_000,
        sign: -1,
        confidence_level: 'probable',
        effective_year: new Date().getFullYear(),
        scenario_name: VERIFY_SCENARIO_NAME,
        is_active: true,
        consumer_accepted: false,
        consumer_rejected: false,
        advisor_id: null,
      })
      .select('id, consumer_accepted')
      .single()

    if (advisorInsertErr || !advisorRow?.id) {
      record(steps, 'advisor-insert', false, advisorInsertErr?.message ?? 'insert failed')
      return { passed: steps.every((s) => s.pass), steps, cleanedUp: true }
    }
    advisorLineItemId = advisorRow.id
    record(steps, 'advisor-pending', true, `pending recommendation ${advisorRow.id.slice(0, 8)}…`)

    const { error: acceptErr } = await admin
      .from('strategy_line_items')
      .update({
        consumer_accepted: true,
        consumer_rejected: false,
        accepted_at: now,
      })
      .eq('id', advisorLineItemId)

    const { data: acceptedRow } = await admin
      .from('strategy_line_items')
      .select('consumer_accepted, consumer_rejected, is_active')
      .eq('id', advisorLineItemId)
      .single()

    record(
      steps,
      'advisor-accept',
      !acceptErr && acceptedRow?.consumer_accepted === true && acceptedRow?.consumer_rejected === false,
      acceptErr?.message ?? `consumer_accepted=${acceptedRow?.consumer_accepted}`,
    )

    const { error: advisorWithdrawErr } = await admin
      .from('strategy_line_items')
      .update({
        is_active: false,
        consumer_withdrawn: true,
        withdrawn_at: now,
        reversed_from: 'probable',
        consumer_accepted: false,
      })
      .eq('id', advisorLineItemId)

    record(
      steps,
      'advisor-withdraw',
      !advisorWithdrawErr,
      advisorWithdrawErr?.message ?? 'withdrawn after accept',
    )

    await admin.from('strategy_line_items').delete().eq('id', advisorLineItemId)
    advisorLineItemId = null

    await recomputeCompositionCache(admin, householdId)
    record(steps, 'cleanup', true, 'temporary strategy rows removed')
  } catch (err) {
    cleanedUp = false
    record(
      steps,
      'unexpected',
      false,
      err instanceof Error ? err.message : String(err),
    )
  } finally {
    if (lineItemId) {
      await admin.from('strategy_line_items').delete().eq('id', lineItemId)
    }
    if (advisorLineItemId) {
      await admin.from('strategy_line_items').delete().eq('id', advisorLineItemId)
    }
    if (lineItemId || advisorLineItemId) {
      await recomputeCompositionCache(admin, householdId).catch(() => undefined)
    }
  }

  return {
    passed: steps.every((s) => s.pass),
    steps,
    cleanedUp,
  }
}

export function formatStrategyLifecycleResult(result: StrategyLifecycleResult): string {
  const lines = ['', 'Strategy lifecycle checks', '─'.repeat(48)]
  for (const step of result.steps) {
    lines.push(`${step.pass ? 'PASS' : 'FAIL'} — ${step.id}: ${step.detail}`)
  }
  lines.push('')
  lines.push(
    result.passed
      ? 'RESULT: PASS — consumer outside_strategy + advisor accept/withdraw'
      : 'RESULT: FAIL — strategy lifecycle',
  )
  return lines.join('\n')
}
