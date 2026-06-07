import type { SupabaseClient } from '@supabase/supabase-js'
import { ESTATE_VERIFICATION_PRESETS } from '@/lib/verify/estateVerificationPresets'
import {
  formatEstateVerificationMatrix,
  runEstateVerification,
  type EstateVerificationResult,
  type RunEstateVerificationOptions,
} from '@/lib/verify/runEstateVerification'
import {
  formatHttpSurfaceResult,
  scrapeEstateHttpSurfaces,
  type HttpSurfaceResult,
} from '@/lib/verify/scrapeEstateHttpSurfaces'
import {
  formatStrategyLifecycleResult,
  runStrategyLifecycleVerification,
  type StrategyLifecycleResult,
} from '@/lib/verify/runStrategyLifecycleVerification'

export type FullEstateVerificationOptions = RunEstateVerificationOptions & {
  runLifecycle?: boolean
  runHttp?: boolean
  httpBaseUrl?: string
  httpUserEmail?: string
}

export type FullEstateVerificationResult = EstateVerificationResult & {
  lifecycle: StrategyLifecycleResult | null
  httpSurfaces: HttpSurfaceResult | null
  passed: boolean
}

function resolveHttpEmail(
  opts: FullEstateVerificationOptions,
  matrix: EstateVerificationResult,
): string | null {
  if (opts.httpUserEmail?.trim()) return opts.httpUserEmail.trim()
  if (matrix.preset) {
    if (matrix.preset === 'e2e') {
      return process.env.PLAYWRIGHT_CONSUMER_EMAIL?.trim() ?? null
    }
    return ESTATE_VERIFICATION_PRESETS[matrix.preset].verifyEmail ?? null
  }
  return matrix.ownerEmail
}

export async function runFullEstateVerification(
  admin: SupabaseClient,
  opts: FullEstateVerificationOptions = {},
): Promise<FullEstateVerificationResult> {
  const matrix = await runEstateVerification(admin, opts)

  let lifecycle: StrategyLifecycleResult | null = null
  if (opts.runLifecycle) {
    const allowAny = process.env.ALLOW_LIFECYCLE_ANY === '1'
    if (!allowAny && matrix.preset !== 'e2e') {
      lifecycle = {
        passed: false,
        cleanedUp: true,
        steps: [
          {
            id: 'lifecycle-skipped',
            pass: false,
            detail: 'Strategy lifecycle runs on --preset e2e only (mutates strategy_line_items)',
          },
        ],
      }
    } else {
      lifecycle = await runStrategyLifecycleVerification(
        admin,
        matrix.householdId,
        opts.tolerance ?? 1,
      )
    }
  }

  let httpSurfaces: HttpSurfaceResult | null = null
  if (opts.runHttp) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const userEmail = resolveHttpEmail(opts, matrix)

    if (!supabaseUrl || !anonKey) {
      httpSurfaces = {
        passed: false,
        baseUrl: opts.httpBaseUrl ?? process.env.PLAYWRIGHT_BASE_URL ?? 'https://www.mywealthmaps.com',
        userEmail: userEmail ?? '(missing)',
        checks: [
          {
            id: 'http-setup',
            pass: false,
            detail: 'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY',
            grossEstate: null,
            federalTax: null,
            stateTax: null,
          },
        ],
      }
    } else if (!userEmail) {
      httpSurfaces = {
        passed: false,
        baseUrl: opts.httpBaseUrl ?? process.env.PLAYWRIGHT_BASE_URL ?? 'https://www.mywealthmaps.com',
        userEmail: '(missing)',
        checks: [
          {
            id: 'http-setup',
            pass: false,
            detail: 'Set VERIFY_USER_EMAIL, preset verifyEmail, or PLAYWRIGHT_CONSUMER_EMAIL for --http',
            grossEstate: null,
            federalTax: null,
            stateTax: null,
          },
        ],
      }
    } else {
      httpSurfaces = await scrapeEstateHttpSurfaces({
        admin,
        supabaseUrl,
        anonKey,
        householdId: matrix.householdId,
        userEmail,
        baseline: matrix.surfaces.compositionCache,
        tolerance: opts.tolerance,
        baseUrl: opts.httpBaseUrl,
      })
    }
  }

  const passed =
    matrix.passed &&
    (lifecycle == null || lifecycle.passed) &&
    (httpSurfaces == null || httpSurfaces.passed)

  return {
    ...matrix,
    lifecycle,
    httpSurfaces,
    passed,
  }
}

export function formatFullEstateVerificationReport(result: FullEstateVerificationResult): string {
  const matrixOnlyPassed =
    result.matrix.every((r) => r.pass) &&
    result.goldenChecks.every((g) => g.pass)
  const parts = [formatEstateVerificationMatrix({ ...result, passed: matrixOnlyPassed })]
  if (result.lifecycle) {
    parts.push(formatStrategyLifecycleResult(result.lifecycle))
  }
  if (result.httpSurfaces) {
    parts.push(formatHttpSurfaceResult(result.httpSurfaces))
  }
  parts.push('')
  parts.push(
    result.passed
      ? 'OVERALL: PASS — matrix + optional lifecycle + HTTP checks'
      : 'OVERALL: FAIL — see sections above',
  )
  parts.push('')
  return parts.join('\n')
}
