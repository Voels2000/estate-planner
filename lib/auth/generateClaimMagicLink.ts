import { getAppUrl } from '@/lib/app-url'
import { createAdminClient } from '@/lib/supabase/admin'

export type ClaimRole = 'attorney' | 'advisor'

/** Supabase redirectTo for generateLink — must stay on allow list. */
export function claimMagicLinkRedirectTo(appUrl: string, claimToken: string): string {
  const origin = appUrl.replace(/\/$/, '')
  return `${origin}/auth/callback?next=${encodeURIComponent(`/claim/${claimToken}`)}`
}

/** One-click claim URL: POST confirm page (scanner-safe) — not GET callback. Role-agnostic. */
export function buildClaimMagicConfirmUrl(tokenHash: string, claimToken: string): string {
  const params = new URLSearchParams({
    token_hash: tokenHash,
    type: 'magiclink',
    next: `/claim/${claimToken}`,
  })
  return `${getAppUrl()}/auth/confirm?${params.toString()}`
}

export async function generateClaimMagicLink(opts: {
  email: string
  claimToken: string
  role: ClaimRole
}): Promise<string> {
  const { email, claimToken, role } = opts
  const redirectTo = claimMagicLinkRedirectTo(getAppUrl(), claimToken)
  const admin = createAdminClient()

  const { data, error } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: {
      redirectTo,
      data: { role },
    },
  })

  const hashedToken = data?.properties?.hashed_token
  if (error || !hashedToken) {
    throw new Error(
      `generateClaimMagicLink failed for ${email}: ${error?.message ?? 'no hashed_token returned'}`,
    )
  }

  return buildClaimMagicConfirmUrl(hashedToken, claimToken)
}
