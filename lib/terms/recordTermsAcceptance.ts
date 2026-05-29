import { TERMS_OF_SERVICE_VERSION } from '@/lib/legal/terms-of-service-sections'
import { createAdminClient } from '@/lib/supabase/admin'

export function getTermsVersion(): string {
  return TERMS_OF_SERVICE_VERSION
}

export async function recordTermsAcceptance(
  userId: string,
  acceptedAt?: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createAdminClient()
  const termsVersion = getTermsVersion()
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
