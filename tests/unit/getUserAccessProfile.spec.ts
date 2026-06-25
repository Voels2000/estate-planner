import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { test, expect } from '@playwright/test'
import { buildUserAccessFromProfile } from '@/lib/access/buildUserAccessFromProfile'
import { loadProfileForUserAccess } from '@/lib/access/loadProfileForUserAccess'
import { ProfileAccessError } from '@/lib/access/profileAccessError'

const activeTier3 = {
  role: 'consumer',
  consumer_tier: 3,
  subscription_status: 'active',
  subscription_plan: 'estate_monthly',
  trial_ends_at: null,
  has_ever_subscribed: true,
  subscription_period_end: null,
  is_admin: false,
  is_superuser: false,
} as const

test.describe('buildUserAccessFromProfile', () => {
  test('active consumer_tier 3 resolves to tier 3', () => {
    const access = buildUserAccessFromProfile(activeTier3, false)
    expect(access.tier).toBe(3)
  })

  test('null profile (no row) resolves to tier 0 without throw', () => {
    const access = buildUserAccessFromProfile(null, false)
    expect(access.tier).toBe(0)
  })

  test('legitimate inactive consumer resolves to tier 0', () => {
    const access = buildUserAccessFromProfile(
      {
        role: 'consumer',
        consumer_tier: 0,
        subscription_status: 'none',
        subscription_plan: null,
        trial_ends_at: null,
        has_ever_subscribed: true,
        subscription_period_end: null,
        is_admin: false,
        is_superuser: false,
      },
      false,
    )
    expect(access.tier).toBe(0)
  })

  test('advisor client bypass resolves to tier 3', () => {
    const access = buildUserAccessFromProfile(
      {
        role: 'consumer',
        consumer_tier: 1,
        subscription_status: 'none',
        subscription_plan: null,
        trial_ends_at: null,
        has_ever_subscribed: false,
        subscription_period_end: null,
        is_admin: false,
        is_superuser: false,
      },
      true,
    )
    expect(access.tier).toBe(3)
  })
})

test.describe('loadProfileForUserAccess', () => {
  test('read error throws ProfileAccessError — not tier 0', async () => {
    const admin = {
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: null,
              error: { code: '42703', message: 'column does not exist' },
            }),
          }),
        }),
      }),
    }

    await expect(
      loadProfileForUserAccess(admin as never, 'user-id'),
    ).rejects.toBeInstanceOf(ProfileAccessError)
  })

  test('no row returns null without throw', async () => {
    const admin = {
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: null }),
          }),
        }),
      }),
    }

    const row = await loadProfileForUserAccess(admin as never, 'user-id')
    expect(row).toBeNull()
  })
})

test.describe('getUserAccess caller audit', () => {
  test('callers do not catch getUserAccess into a default tier', () => {
    const roots = ['app', 'lib']
    const offenders: string[] = []

    for (const root of roots) {
      const dir = join(process.cwd(), root)
      walkTs(dir, (file) => {
        const src = readFileSync(file, 'utf8')
        if (!src.includes('getUserAccess')) return
        if (file.endsWith('get-user-access.ts')) return
        if (/catch\s*\([\s\S]*?tier\s*[:=]\s*0/.test(src)) {
          offenders.push(file)
        }
      })
    }

    expect(offenders, `callers swallowing tier: ${offenders.join(', ')}`).toEqual([])
  })
})

function walkTs(dir: string, visit: (file: string) => void) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    const st = statSync(path)
    if (st.isDirectory()) {
      if (name === 'node_modules') continue
      walkTs(path, visit)
    } else if (name.endsWith('.ts') || name.endsWith('.tsx')) {
      visit(path)
    }
  }
}
