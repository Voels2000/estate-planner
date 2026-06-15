import { after } from 'next/server'
import { getConsumerAppUrl } from '@/lib/consumer/afterHouseholdWrite'
import { triggerEstateHealthRecompute } from '@/lib/estate/triggerEstateHealthRecompute'

const DEBOUNCE_MS = 3000
const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>()
const inFlight = new Set<string>()

async function runBaseCaseAndRecompute(householdId: string): Promise<void> {
  if (inFlight.has(householdId)) return
  inFlight.add(householdId)
  try {
    const { generateBaseCase } = await import('@/lib/actions/generate-base-case')
    await generateBaseCase(householdId)
    await triggerEstateHealthRecompute(householdId, getConsumerAppUrl())
  } catch (error) {
    console.error('[triggerBackgroundBaseCaseAndRecompute] failed:', householdId, error)
  } finally {
    inFlight.delete(householdId)
  }
}

/**
 * Debounced background base-case regeneration + estate health recompute.
 * Serves stale projection/composition cache immediately; refreshes in the background.
 */
export function triggerBackgroundBaseCaseAndRecompute(householdId: string): void {
  if (!householdId) return
  if (process.env.E2E_SKIP_RECOMPUTE === 'true') return

  const schedule = () => {
    const existing = debounceTimers.get(householdId)
    if (existing) clearTimeout(existing)
    debounceTimers.set(
      householdId,
      setTimeout(() => {
        debounceTimers.delete(householdId)
        void runBaseCaseAndRecompute(householdId)
      }, DEBOUNCE_MS),
    )
  }

  if (process.env.VERCEL) {
    after(schedule)
    return
  }

  schedule()
}
