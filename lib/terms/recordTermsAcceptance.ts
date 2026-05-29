import { createAdminClient } from '@/lib/supabase/admin'

export async function getTermsVersion(): Promise<string> {
  const admin = createAdminClient()
  const { data: versionRow } = await admin
    .from('app_config')
    .select('value')
    .eq('key', 'terms_version')
    .maybeSingle()

  return versionRow?.value ?? '2026-03-31'
}

export async function recordTermsAcceptance(
  userId: string,
  acceptedAt?: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createAdminClient()
  const termsVersion = await getTermsVersion()
  const payload = {
    terms_accepted_at: acceptedAt ?? new Date().toISOString(),
    terms_version: termsVersion,
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    const { error } = await admin.from('profiles').update(payload).eq('id', userId)
    if (!error) return { ok: true }
    if (attempt < 4) {
      await new Promise((resolve) => setTimeout(resolve, 200))
    } else {
      console.error('terms accept error:', error)
      return { ok: false, error: error.message }
    }
  }

  return { ok: false, error: 'Failed to record acceptance' }
}
