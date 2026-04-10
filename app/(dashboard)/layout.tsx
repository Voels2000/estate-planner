import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SidebarNav } from './_components/sidebar-nav'
import { TrialBanner } from './_components/trial-banner'
import { getAccessContext } from '@/lib/access/getAccessContext'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const {
    user,
    isSuperuser,
    isAdmin,
    isAdvisor,
    isAttorney,
    isConsumer,
    hasActiveSubscription,
    profile,
  } = await getAccessContext()
  void isAdmin
  void isAdvisor
  void isAttorney
  void isConsumer
  void hasActiveSubscription
  if (!user) {
    redirect('/login')
  }

  if (isSuperuser) {
    const supabase = await createClient()
    const {
      data: { user: fullUser },
    } = await supabase.auth.getUser()
    if (!fullUser) {
      redirect('/login')
    }
    const { data: profileRow } = await supabase
      .from('profiles')
      .select('role, consumer_tier, is_admin, is_attorney')
      .eq('id', fullUser.id)
      .single()
    const { data: householdRow } = await supabase
      .from('households')
      .select('id')
      .eq('owner_id', user.id)
      .maybeSingle()
    const hasHousehold = !!householdRow
    const isAttorneyRow =
      profileRow?.role === 'attorney' || profileRow?.is_attorney === true
    const tier = profileRow?.consumer_tier ?? profile?.consumer_tier ?? 3
    return (
      <div className="flex min-h-screen bg-neutral-50">
        <SidebarNav
          user={fullUser}
          role={profileRow?.role ?? profile?.role}
          tier={tier}
          isAdvisor={profileRow?.role === 'advisor'}
          isAdmin={profileRow?.is_admin === true}
          isAttorney={isAttorneyRow}
          isSuperuser
          hasHousehold={hasHousehold}
        />
        <div className="flex flex-1 flex-col overflow-y-auto">
          <main className="flex-1">{children}</main>
        </div>
      </div>
    )
  }

  const supabase = await createClient()
  const {
    data: { user: sessionUser },
  } = await supabase.auth.getUser()
  if (!sessionUser) {
    redirect('/login')
  }

  const { data: profileFull } = await supabase
    .from('profiles')
    .select('subscription_status, role, trial_started_at, consumer_tier, is_admin, is_attorney')
    .eq('id', sessionUser.id)
    .single()

  const { data: householdRow } = await supabase
    .from('households')
    .select('id')
    .eq('owner_id', user.id)
    .maybeSingle()
  console.log('[layout] user.id:', user.id, 'householdRow:', householdRow)
  const hasHousehold = !!householdRow

  const isAdminResolved = profileFull?.role === 'admin' || profileFull?.is_admin === true
  const isActive = profileFull?.subscription_status === 'active'
  const isAdvisorManagedProfile =
    profileFull?.subscription_status === 'advisor_managed'

  // Check trial status
  const trialStarted = profileFull?.trial_started_at
    ? new Date(profileFull.trial_started_at)
    : null
  const trialExpiry = trialStarted
    ? new Date(trialStarted.getTime() + 15 * 60 * 1000)
    : null
  const now = new Date()
  const trialActive = trialExpiry ? now < trialExpiry : false
  const trialMinutesLeft = trialExpiry
    ? Math.max(0, Math.ceil((trialExpiry.getTime() - now.getTime()) / 60000))
    : 0
  const trialSecondsLeft = trialExpiry
    ? Math.max(0, Math.ceil((trialExpiry.getTime() - now.getTime()) / 1000))
    : 0

  const isAdvisorResolved = profileFull?.role === 'advisor'
  const isAttorneyResolved =
    profileFull?.role === 'attorney' || profileFull?.is_attorney === true

  // Check if user is an advisor client
  let isAdvisorClient = false
  if (!isAdvisorResolved) {
    const { data: clientRow } = await supabase
      .from('advisor_clients')
      .select('id')
      .eq('client_id', sessionUser.id)
      .in('status', ['active', 'accepted'])
      .maybeSingle()
    isAdvisorClient = !!clientRow
  }

  const hasAccess =
    isAdminResolved ||
    isAdvisorResolved ||
    isAdvisorClient ||
    isAdvisorManagedProfile ||
    isActive ||
    trialActive ||
    isAttorneyResolved
  if (!hasAccess) {
    redirect('/billing')
  }

  // Get user tier for sidebar gating
  const access = {
    tier:
      isAdvisorResolved || isAdvisorClient || isAdvisorManagedProfile
        ? 3
        : isAdminResolved
          ? 3
          : (profileFull?.consumer_tier ?? 1),
  }
  const showBanner =
    !isAdminResolved &&
    !isAdvisorResolved &&
    !isAdvisorClient &&
    !isAdvisorManagedProfile &&
    !isActive &&
    trialActive

  return (
    <div className="flex min-h-screen bg-neutral-50">
      <SidebarNav
        user={sessionUser}
        role={profileFull?.role}
        tier={access.tier}
        isAdvisor={isAdvisorResolved || isAdvisorClient}
        isAdmin={profileFull?.is_admin === true}
        isAttorney={isAttorneyResolved}
        hasHousehold={hasHousehold}
      />
      <div className="flex flex-1 flex-col overflow-y-auto">
        {showBanner && (
          <TrialBanner
            secondsLeft={trialSecondsLeft}
            minutesLeft={trialMinutesLeft}
            expiryTimestamp={trialExpiry!.getTime()}
          />
        )}
        <main className="flex-1">
          {children}
        </main>
      </div>
    </div>
  )
}
