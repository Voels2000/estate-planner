import type { APIRequestContext } from '@playwright/test'

export function parseAccessTokenFromStorage(cookies: { name: string; value: string }[]): string | null {
  const authCookie = cookies.find((c) => c.name.includes('auth-token'))
  if (!authCookie?.value) return null
  try {
    const raw = authCookie.value.replace(/^base64-/, '')
    const parsed = JSON.parse(Buffer.from(raw, 'base64').toString('utf8')) as {
      access_token?: string
    }
    return parsed.access_token ?? null
  } catch {
    return null
  }
}

export async function fetchEstateHealthComputedAt(
  request: APIRequestContext,
  householdId: string,
): Promise<string | null> {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://fnzvlmrqwcqwiqueevux.supabase.co'
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!anonKey) return null

  const storage = await request.storageState()
  const accessToken = parseAccessTokenFromStorage(storage.cookies)
  if (!accessToken) return null

  const res = await request.get(
    `${supabaseUrl}/rest/v1/estate_health_scores?household_id=eq.${householdId}&select=computed_at&limit=1`,
    {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${accessToken}`,
      },
    },
  )
  if (!res.ok()) return null
  const rows = (await res.json()) as { computed_at?: string }[]
  return rows[0]?.computed_at ?? null
}

export async function pollComputedAtChanged(
  request: APIRequestContext,
  householdId: string,
  before: string | null,
  options?: { timeoutMs?: number; intervalMs?: number; errorMessage?: string },
): Promise<string> {
  const timeoutMs = options?.timeoutMs ?? 25_000
  const intervalMs = options?.intervalMs ?? 1500
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const current = await fetchEstateHealthComputedAt(request, householdId)
    if (current && current !== before) return current
    await new Promise((r) => setTimeout(r, intervalMs))
  }
  throw new Error(
    options?.errorMessage ?? 'estate_health_scores.computed_at did not change after household write',
  )
}
