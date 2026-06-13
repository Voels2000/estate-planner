import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import {
  ENV_MANIFEST,
  MANIFEST_VAR_NAMES,
  type EnvScope,
  type EnvShape,
  type EnvVarEntry,
} from '@/lib/env/manifest'

export type VarStatus =
  | 'OK'
  | 'MISSING'
  | 'WRONG_SHAPE'
  | 'FORBIDDEN_IN_SCOPE'
  | 'NOT_APPLICABLE'

export type FlagLevel = 'CRITICAL' | 'WARN' | 'REVIEW'

export interface EnvFlag {
  name: string
  level: FlagLevel
  reason: string
  action: string
}

export interface EnvVerifyReport {
  scope: EnvScope
  summary: {
    ok: number
    missing: number
    wrong_shape: number
    flags: number
  }
  vars: Record<string, VarStatus>
  flags: EnvFlag[]
  liveness?: {
    stripe: 'LIVE_OK' | 'LIVE_FAIL'
    stripe_key_mode: 'live' | 'test' | 'unknown' | 'unset'
    stripe_reason?: string
    supabase: 'LIVE_OK' | 'LIVE_FAIL'
    supabase_reason?: string
  }
}

const SYSTEM_PREFIXES = [
  'VERCEL_',
  'NEXT_',
  'NODE_',
  'npm_',
  'AWS_',
  'LAMBDA_',
  'TURBO_',
] as const

const SYSTEM_EXACT = new Set([
  'CI',
  'PATH',
  'HOME',
  'HOSTNAME',
  'PWD',
  'SHLVL',
  '_',
])

/** NEXT_PUBLIC_ keys that may legitimately hold a JWT (anon key). */
const SAFE_PUBLIC_JWT_KEYS = new Set(['NEXT_PUBLIC_SUPABASE_ANON_KEY'])

const EXPOSED_SECRET_PATTERNS: { re: RegExp; label: string }[] = [
  { re: /^sk_(live|test)_/, label: 'Stripe secret key (sk_)' },
  { re: /^rk_/, label: 'Stripe restricted key (rk_)' },
  { re: /^whsec_/, label: 'Stripe webhook secret (whsec_)' },
  { re: /^re_/, label: 'Resend API key (re_)' },
  { re: /^postgres(ql)?:\/\/[^/]+:[^@]+@/, label: 'Postgres connection string with credentials' },
]

export type EnvSource = Record<string, string | undefined>

export function resolveEnvScope(env: EnvSource = process.env): EnvScope {
  const vercelEnv = env.VERCEL_ENV
  if (vercelEnv === 'production') return 'production'
  if (vercelEnv === 'preview') return 'preview'
  return 'local'
}

export function inferStripeKeyMode(
  key: string | undefined,
): 'live' | 'test' | 'unknown' | 'unset' {
  const trimmed = key?.trim() ?? ''
  if (!trimmed) return 'unset'
  if (trimmed.startsWith('sk_live_')) return 'live'
  if (trimmed.startsWith('sk_test_')) return 'test'
  return 'unknown'
}

/** Returns a failure reason when scope and key mode disagree; otherwise undefined. */
export function stripeKeyScopeMismatch(
  scope: EnvScope,
  keyMode: ReturnType<typeof inferStripeKeyMode>,
): string | undefined {
  if (keyMode === 'unset' || keyMode === 'unknown') return undefined
  if (scope === 'production' && keyMode === 'test') {
    return 'Production scope but STRIPE_SECRET_KEY is test mode (sk_test_)'
  }
  if (scope === 'preview' && keyMode === 'live') {
    return 'Preview scope but STRIPE_SECRET_KEY is live mode (sk_live_)'
  }
  return undefined
}

function valueMatchesShape(value: string, shape: EnvShape): boolean {
  if (shape instanceof RegExp) return shape.test(value)
  return value === shape
}

function formatExpectedShape(shape: EnvShape): string {
  if (shape instanceof RegExp) return shape.source
  return JSON.stringify(shape)
}

function classifyVar(
  entry: EnvVarEntry,
  scope: EnvScope,
  raw: string | undefined,
): { status: VarStatus; flag?: EnvFlag } {
  const value = raw?.trim() ?? ''
  const present = value.length > 0

  if (entry.forbiddenInScopes?.includes(scope) && present) {
    return {
      status: 'FORBIDDEN_IN_SCOPE',
      flag: {
        name: entry.name,
        level: 'WARN',
        reason: `${entry.name} must not be set in ${scope} scope.`,
        action: `Remove ${entry.name} from ${scope} scope.`,
      },
    }
  }

  const inScope = entry.scopes.includes(scope)
  const required = entry.requiredInScopes.includes(scope)
  const warnIfMissing = entry.warnIfMissingInScopes?.includes(scope)

  if (!inScope && !required && !warnIfMissing) {
    return { status: present ? 'OK' : 'NOT_APPLICABLE' }
  }

  if (!present) {
    if (required) {
      return { status: 'MISSING' }
    }
    if (warnIfMissing) {
      return {
        status: 'NOT_APPLICABLE',
        flag: {
          name: entry.name,
          level: 'WARN',
          reason: `${entry.name} is unset in ${scope} (legacy fallback may apply).`,
          action: `Set ${entry.name} explicitly before production go-live.`,
        },
      }
    }
    return { status: 'NOT_APPLICABLE' }
  }

  const expectedShape = entry.shape?.[scope]
  if (expectedShape && !valueMatchesShape(value, expectedShape)) {
    return {
      status: 'WRONG_SHAPE',
      flag: {
        name: entry.name,
        level: scope === 'production' ? 'CRITICAL' : 'WARN',
        reason: `${entry.name} value does not match expected pattern for ${scope}.`,
        action: `Set ${entry.name} to match: ${formatExpectedShape(expectedShape)}`,
      },
    }
  }

  return { status: 'OK' }
}

function isSystemEnvKey(key: string): boolean {
  if (SYSTEM_EXACT.has(key)) return true
  return SYSTEM_PREFIXES.some((prefix) => key.startsWith(prefix))
}

function detectExposedSecrets(env: EnvSource): EnvFlag[] {
  const flags: EnvFlag[] = []
  for (const [key, raw] of Object.entries(env)) {
    if (!key.startsWith('NEXT_PUBLIC_')) continue
    const value = raw?.trim() ?? ''
    if (!value) continue

    for (const { re, label } of EXPOSED_SECRET_PATTERNS) {
      if (re.test(value)) {
        flags.push({
          name: key,
          level: 'CRITICAL',
          reason: `NEXT_PUBLIC_ var exposes ${label}.`,
          action: 'Remove NEXT_PUBLIC_ prefix / move server-side.',
        })
        break
      }
    }

    if (
      /^eyJ/.test(value) &&
      !SAFE_PUBLIC_JWT_KEYS.has(key) &&
      !flags.some((f) => f.name === key)
    ) {
      flags.push({
        name: key,
        level: 'CRITICAL',
        reason: 'NEXT_PUBLIC_ var exposes a JWT (possible service-role key).',
        action: 'Remove NEXT_PUBLIC_ prefix / move server-side.',
      })
    }
  }
  return flags
}

function detectUnknownVars(env: EnvSource): EnvFlag[] {
  const flags: EnvFlag[] = []
  for (const key of Object.keys(env)) {
    if (MANIFEST_VAR_NAMES.has(key)) continue
    if (isSystemEnvKey(key)) continue
    flags.push({
      name: key,
      level: 'REVIEW',
      reason: `${key} is not in the env manifest.`,
      action: 'Stale? Confirm unused in codebase, then delete from this scope.',
    })
  }
  return flags
}

async function runLivenessChecks(
  env: EnvSource,
  scope: EnvScope,
): Promise<EnvVerifyReport['liveness']> {
  const result: NonNullable<EnvVerifyReport['liveness']> = {
    stripe: 'LIVE_FAIL',
    stripe_key_mode: 'unset',
    supabase: 'LIVE_FAIL',
  }

  const stripeKey = env.STRIPE_SECRET_KEY?.trim()
  const keyMode = inferStripeKeyMode(stripeKey)
  result.stripe_key_mode = keyMode

  if (!stripeKey) {
    result.stripe_reason = 'STRIPE_SECRET_KEY unset'
  } else {
    const mismatch = stripeKeyScopeMismatch(scope, keyMode)
    if (mismatch) {
      result.stripe_reason = mismatch
    } else {
      try {
        const stripe = new Stripe(stripeKey, { apiVersion: '2025-02-24.acacia' })
        await stripe.balance.retrieve()
        result.stripe = 'LIVE_OK'
      } catch (err) {
        result.stripe_reason =
          err instanceof Error ? err.message : 'Stripe balance.retrieve failed'
      }
    }
  }

  try {
    const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim()
    const key = env.SUPABASE_SERVICE_ROLE_KEY?.trim()
    if (!url || !key) {
      result.supabase_reason =
        'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY'
    } else {
      const admin = createClient(url, key)
      const { error } = await admin.from('profiles').select('id').limit(1)
      if (error) {
        result.supabase_reason = error.message
      } else {
        result.supabase = 'LIVE_OK'
      }
    }
  } catch (err) {
    result.supabase_reason =
      err instanceof Error ? err.message : 'Supabase query failed'
  }

  return result
}

export async function verifyEnvironment(options?: {
  live?: boolean
  env?: EnvSource
}): Promise<EnvVerifyReport> {
  const env = options?.env ?? process.env
  const scope = resolveEnvScope(env)
  const vars: Record<string, VarStatus> = {}
  const flags: EnvFlag[] = []

  let ok = 0
  let missing = 0
  let wrongShape = 0

  for (const entry of ENV_MANIFEST) {
    const { status, flag } = classifyVar(entry, scope, env[entry.name])
    if (status !== 'NOT_APPLICABLE') {
      vars[entry.name] = status
    }
    if (flag) flags.push(flag)

    if (status === 'OK') ok++
    else if (status === 'MISSING') missing++
    else if (status === 'WRONG_SHAPE') wrongShape++
  }

  flags.push(...detectExposedSecrets(env))
  flags.push(...detectUnknownVars(env))

  const report: EnvVerifyReport = {
    scope,
    summary: {
      ok,
      missing,
      wrong_shape: wrongShape,
      flags: flags.length,
    },
    vars,
    flags,
  }

  if (options?.live) {
    report.liveness = await runLivenessChecks(env, scope)
  }

  return report
}
