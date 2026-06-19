/** Pure eligibility for notifications-cron drip steps (§7–§9). */

export type DripStepTimestamps = {
  step1At: Date | null
  step2At: Date | null
  step3At: Date | null
}

/** §7 email_captures — step 2: step 1 sent in (3d, 7d] window. */
export function emailCaptureDripStep2Eligible(
  steps: DripStepTimestamps,
  thresholds: { threeDaysAgo: Date; sevenDaysAgo: Date },
): boolean {
  const { step1At, step2At } = steps
  if (!step1At || step2At) return false
  return step1At >= thresholds.sevenDaysAgo && step1At < thresholds.threeDaysAgo
}

/** §7 email_captures — step 3: requires step 2; step 1 at least 7 days ago. */
export function emailCaptureDripStep3Eligible(
  steps: DripStepTimestamps,
  thresholds: { sevenDaysAgo: Date },
): boolean {
  const { step1At, step2At, step3At } = steps
  if (!step1At || !step2At || step3At) return false
  return step1At <= thresholds.sevenDaysAgo
}

/** §8/§9 profiles — step 2: step 1 at least 3 days ago. */
export function profileDripStep2Eligible(
  steps: DripStepTimestamps,
  thresholds: { threeDaysAgo: Date },
): boolean {
  const { step1At, step2At } = steps
  if (!step1At || step2At) return false
  return step1At <= thresholds.threeDaysAgo
}

/** §8/§9 profiles — step 3: requires step 2; step 1 at least 7 days ago. */
export function profileDripStep3Eligible(
  steps: DripStepTimestamps,
  thresholds: { sevenDaysAgo: Date },
): boolean {
  const { step1At, step2At, step3At } = steps
  if (!step1At || !step2At || step3At) return false
  return step1At <= thresholds.sevenDaysAgo
}

export type DripCronCounters = { sent: number; skipped: number; errors: number }

/** Mirror §10 digest counting — honest sent/errors on drip fetch outcomes. */
export async function runDripFetch(
  url: string,
  init: RequestInit,
  counters: DripCronCounters,
  label: string,
): Promise<void> {
  try {
    const res = await fetch(url, init)
    if (res?.ok) {
      counters.sent++
    } else {
      counters.errors++
      console.error(`drip ${label} send failed: ${res?.status ?? 'unknown'}`)
    }
  } catch (e) {
    counters.errors++
    console.error(`drip ${label} send threw`, e)
  }
}
