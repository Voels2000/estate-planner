import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  emailCaptureDripStep2Eligible,
  emailCaptureDripStep3Eligible,
  profileDripStep2Eligible,
  profileDripStep3Eligible,
  runDripFetch,
  type DripCronCounters,
} from '@/lib/cron/dripEligibility'

const NOW = new Date('2026-06-19T14:00:00.000Z')

function daysAgo(days: number, from = NOW): Date {
  const d = new Date(from)
  d.setDate(d.getDate() - days)
  return d
}

function thresholds(from = NOW) {
  const threeDaysAgo = daysAgo(3, from)
  const sevenDaysAgo = daysAgo(7, from)
  return { threeDaysAgo, sevenDaysAgo, now: from }
}

test.describe('email-capture drip eligibility (§7)', () => {
  const { threeDaysAgo, sevenDaysAgo } = thresholds()

  test('step 2 fires in window (step1 sent, step2 not sent)', () => {
    expect(
      emailCaptureDripStep2Eligible(
        { step1At: daysAgo(5), step2At: null, step3At: null },
        { threeDaysAgo, sevenDaysAgo },
      ),
    ).toBe(true)
  })

  test('step 2 does not fire outside window', () => {
    expect(
      emailCaptureDripStep2Eligible(
        { step1At: daysAgo(2), step2At: null, step3At: null },
        { threeDaysAgo, sevenDaysAgo },
      ),
    ).toBe(false)
  })

  test('step 3 does not fire without step 2 (ordering preserved)', () => {
    expect(
      emailCaptureDripStep3Eligible(
        { step1At: daysAgo(8), step2At: null, step3At: null },
        { sevenDaysAgo },
      ),
    ).toBe(false)
  })

  test('step 3 fires when step1+step2 sent and step1 aged past 7 days', () => {
    expect(
      emailCaptureDripStep3Eligible(
        { step1At: daysAgo(8), step2At: daysAgo(5), step3At: null },
        { sevenDaysAgo },
      ),
    ).toBe(true)
  })

  test('step 3 never re-fires when step3At set', () => {
    expect(
      emailCaptureDripStep3Eligible(
        { step1At: daysAgo(10), step2At: daysAgo(8), step3At: daysAgo(1) },
        { sevenDaysAgo },
      ),
    ).toBe(false)
  })

  test('missed cron day — step1 past old 8-day floor still eligible for step 3', () => {
    // Old code required step1 in [8d, 7d); now any step1 <= 7d ago qualifies.
    expect(
      emailCaptureDripStep3Eligible(
        { step1At: daysAgo(10), step2At: daysAgo(8), step3At: null },
        { sevenDaysAgo },
      ),
    ).toBe(true)
  })
})

test.describe('advisor/attorney profile drip eligibility (§8/§9)', () => {
  const { threeDaysAgo, sevenDaysAgo } = thresholds()

  test('step 2 fires when step1 old enough and step2 not sent', () => {
    expect(
      profileDripStep2Eligible(
        { step1At: daysAgo(4), step2At: null, step3At: null },
        { threeDaysAgo },
      ),
    ).toBe(true)
  })

  test('step 3 does NOT fire without step 2 (Bug 1 fix)', () => {
    expect(
      profileDripStep3Eligible(
        { step1At: daysAgo(8), step2At: null, step3At: null },
        { sevenDaysAgo },
      ),
    ).toBe(false)
  })

  test('step 3 fires when step2 sent and step1 at least 7 days ago', () => {
    expect(
      profileDripStep3Eligible(
        { step1At: daysAgo(8), step2At: daysAgo(5), step3At: null },
        { sevenDaysAgo },
      ),
    ).toBe(true)
  })

  test('step 3 never re-fires when step3At set', () => {
    expect(
      profileDripStep3Eligible(
        { step1At: daysAgo(10), step2At: daysAgo(8), step3At: daysAgo(2) },
        { sevenDaysAgo },
      ),
    ).toBe(false)
  })
})

test.describe('runDripFetch counting (§10 pattern)', () => {
  test('ok response increments sent', async () => {
    const counters: DripCronCounters = { sent: 0, skipped: 0, errors: 0 }
    const originalFetch = global.fetch
    global.fetch = async () => new Response('{}', { status: 200 })
    try {
      await runDripFetch('http://test', { method: 'POST' }, counters, 'test')
      expect(counters.sent).toBe(1)
      expect(counters.errors).toBe(0)
    } finally {
      global.fetch = originalFetch
    }
  })

  test('non-200 increments errors, not sent', async () => {
    const counters: DripCronCounters = { sent: 0, skipped: 0, errors: 0 }
    const originalFetch = global.fetch
    global.fetch = async () => new Response('fail', { status: 500 })
    try {
      await runDripFetch('http://test', { method: 'POST' }, counters, 'test')
      expect(counters.sent).toBe(0)
      expect(counters.errors).toBe(1)
    } finally {
      global.fetch = originalFetch
    }
  })

  test('thrown fetch increments errors, not sent', async () => {
    const counters: DripCronCounters = { sent: 0, skipped: 0, errors: 0 }
    const originalFetch = global.fetch
    global.fetch = async () => {
      throw new Error('network down')
    }
    try {
      await runDripFetch('http://test', { method: 'POST' }, counters, 'test')
      expect(counters.sent).toBe(0)
      expect(counters.errors).toBe(1)
    } finally {
      global.fetch = originalFetch
    }
  })
})

test.describe('attorney drip candidate query (§9 Bug 4 regression)', () => {
  test('notifications cron filters attorney_drip_unsubscribed_at', () => {
    const routePath = join(process.cwd(), 'app/api/cron/notifications/route.ts')
    const src = readFileSync(routePath, 'utf8')
    expect(src).toContain(".is('attorney_drip_unsubscribed_at', null)")
  })
})
