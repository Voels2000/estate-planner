import type { SupabaseClient } from '@supabase/supabase-js'
import { authCookieHeader, createUserSessionForEmail } from '@/lib/verify/authSession'
import type { EstateSurfaceSnapshot } from '@/lib/verify/runEstateVerification'

export type HttpSurfaceCheck = {
  id: string
  pass: boolean
  detail: string
  grossEstate: number | null
  federalTax: number | null
  stateTax: number | null
}

export type HttpSurfaceResult = {
  passed: boolean
  baseUrl: string
  userEmail: string
  checks: HttpSurfaceCheck[]
}

function snapshotFromCompositionApi(body: Record<string, unknown>): EstateSurfaceSnapshot {
  const federal =
    body.estimated_tax_federal != null
      ? Number(body.estimated_tax_federal)
      : Number(body.estimated_tax ?? 0)
  return {
    grossEstate: Math.max(0, Number(body.gross_estate ?? 0)),
    federalTax: Math.max(0, federal),
    stateTax: Math.max(0, Number(body.estimated_tax_state ?? 0)),
    netEstate: body.net_estate != null ? Number(body.net_estate) : null,
  }
}

function within(a: number, b: number, tolerance: number) {
  return Math.abs(a - b) <= tolerance
}

/** Compare authenticated HTTP API responses to service-role matrix baseline. */
export async function scrapeEstateHttpSurfaces(params: {
  admin: SupabaseClient
  supabaseUrl: string
  anonKey: string
  householdId: string
  userEmail: string
  baseline: EstateSurfaceSnapshot
  tolerance?: number
  baseUrl?: string
}): Promise<HttpSurfaceResult> {
  const tolerance = params.tolerance ?? 1
  const baseUrl = (
    params.baseUrl ??
    process.env.PLAYWRIGHT_BASE_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    'https://www.mywealthmaps.com'
  ).replace(/\/$/, '')
  const checks: HttpSurfaceCheck[] = []

  const session = await createUserSessionForEmail(
    params.admin,
    params.supabaseUrl,
    params.anonKey,
    params.userEmail,
  )
  const cookie = authCookieHeader(params.supabaseUrl, session)

  const compositionRes = await fetch(`${baseUrl}/api/estate-composition`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookie,
    },
    body: JSON.stringify({ householdId: params.householdId, sourceRole: 'consumer' }),
  })

  if (!compositionRes.ok) {
    checks.push({
      id: 'api-estate-composition',
      pass: false,
      detail: `HTTP ${compositionRes.status}: ${await compositionRes.text()}`,
      grossEstate: null,
      federalTax: null,
      stateTax: null,
    })
    return { passed: false, baseUrl, userEmail: params.userEmail, checks }
  }

  const compositionBody = (await compositionRes.json()) as Record<string, unknown>
  const apiSnapshot = snapshotFromCompositionApi(compositionBody)
  const compositionPass =
    within(apiSnapshot.grossEstate, params.baseline.grossEstate, tolerance) &&
    within(apiSnapshot.federalTax, params.baseline.federalTax, tolerance) &&
    within(apiSnapshot.stateTax, params.baseline.stateTax, tolerance)

  checks.push({
    id: 'api-estate-composition',
    pass: compositionPass,
    detail: compositionPass
      ? `gross $${Math.round(apiSnapshot.grossEstate).toLocaleString()} aligns with matrix cache`
      : `gross api $${Math.round(apiSnapshot.grossEstate).toLocaleString()} vs cache $${Math.round(params.baseline.grossEstate).toLocaleString()}`,
    grossEstate: apiSnapshot.grossEstate,
    federalTax: apiSnapshot.federalTax,
    stateTax: apiSnapshot.stateTax,
  })

  const exportRes = await fetch(
    `${baseUrl}/api/export-estate-plan?household_id=${encodeURIComponent(params.householdId)}`,
    { headers: { Cookie: cookie } },
  )

  if (exportRes.status === 403) {
    checks.push({
      id: 'api-export-estate-plan',
      pass: true,
      detail: 'skipped — paid Tier 3 required for export API (403 expected on trial/e2e)',
      grossEstate: null,
      federalTax: null,
      stateTax: null,
    })
  } else if (!exportRes.ok) {
    checks.push({
      id: 'api-export-estate-plan',
      pass: false,
      detail: `HTTP ${exportRes.status}: ${(await exportRes.text()).slice(0, 200)}`,
      grossEstate: null,
      federalTax: null,
      stateTax: null,
    })
  } else {
    const exportBody = (await exportRes.json()) as {
      federal_estate_tax?: { gross_estate?: number; estimated_tax?: number }
      state_estate_tax?: { estimated_state_tax?: number }
    }
    const exportGross = Number(exportBody.federal_estate_tax?.gross_estate ?? 0)
    const exportFederal = Number(exportBody.federal_estate_tax?.estimated_tax ?? 0)
    const exportState = Number(exportBody.state_estate_tax?.estimated_state_tax ?? 0)
    const exportPass =
      within(exportGross, params.baseline.grossEstate, tolerance) &&
      within(exportFederal, params.baseline.federalTax, tolerance) &&
      within(exportState, params.baseline.stateTax, tolerance)

    checks.push({
      id: 'api-export-estate-plan',
      pass: exportPass,
      detail: exportPass
        ? `export tax payload aligns with matrix cache`
        : `export gross $${Math.round(exportGross).toLocaleString()} vs cache $${Math.round(params.baseline.grossEstate).toLocaleString()}`,
      grossEstate: exportGross,
      federalTax: exportFederal,
      stateTax: exportState,
    })
  }

  return {
    passed: checks.every((c) => c.pass),
    baseUrl,
    userEmail: params.userEmail,
    checks,
  }
}

export function formatHttpSurfaceResult(result: HttpSurfaceResult): string {
  const lines = ['', `HTTP surface checks (${result.baseUrl})`, '─'.repeat(56)]
  lines.push(`Session: ${result.userEmail}`)
  for (const check of result.checks) {
    lines.push(`${check.pass ? 'PASS' : 'FAIL'} — ${check.id}: ${check.detail}`)
  }
  lines.push('')
  lines.push(result.passed ? 'RESULT: PASS — HTTP surfaces aligned' : 'RESULT: FAIL — HTTP mismatch')
  return lines.join('\n')
}
