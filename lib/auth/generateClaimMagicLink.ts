import { getAppUrl } from '@/lib/app-url'
import { createAdminClient } from '@/lib/supabase/admin'

export type ClaimRole = 'attorney' | 'advisor'

export function claimMagicLinkRedirectTo(appUrl: string, claimToken: string): string {
  const origin = appUrl.replace(/\/$/, '')
  return `${origin}/auth/callback?next=${encodeURIComponent(`/claim/${claimToken}`)}`
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

  if (error || !data?.properties?.action_link) {
    throw new Error(
      `generateClaimMagicLink failed for ${email}: ${error?.message ?? 'no action_link returned'}`,
    )
  }

  return data.properties.action_link
}
