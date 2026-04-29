type DownloadAccessProfile = {
  role: string | null
  consumer_tier: number | null
  subscription_status: string | null
}

export function hasPaidDownloadAccess(
  profile: DownloadAccessProfile,
  minimumTier: 1 | 2 | 3 = 1,
): boolean {
  // Policy scope: consumer downloads require paid active status.
  // Advisors/admin/attorneys follow their existing access controls.
  if (profile.role !== 'consumer') return true

  const tier = profile.consumer_tier ?? 1
  const isPaidActive = profile.subscription_status === 'active'
  return isPaidActive && tier >= minimumTier
}

