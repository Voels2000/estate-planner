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
  const { user, isSuperuser, profile } = await getAccessContext()

  if (!user) redirect('/login')

  const supabase = await createClient()
  const { data: { user: sessionUser } } = await supabase.auth.getUser()
  if (!sessionUser) redirect('/login')

  const { data: profileFull } = await supabase
    .from('profiles')
    .select('role, subscription_status, trial_started_at, consumer_tier, is_admin, is_attorney, is_superuser')
    .eq('id', sessionUser.id)
    .single()

  const { data: householdRow } = await supabase
    .from('households')
    .select('id')
    .eq('owner_id', user.id)
    .maybeSingle()

  const hasHousehold = !!householdRow

  // Superuser: use actual role as primary identity, unlock everything on top
  if (isSuperuser) {
    return (
      <div className="flex min-h-screen bg-neutral-50">
        <SidebarNav
          user={sessionUser}
          role={profileFull?.role ?? profile?.role}
          tier={3}
          isAdvisor={profileFull?.role === 'advisor'}
          isAdmin
          isAttorney
          isSuperuser
          hasHousehold={hasHousehold}
        />
        <div className="flex flex-1 flex-col overflow-y-auto">
          <main className="flex-1">{children}</main>
        </div>
      </div>
    )
  }

  const isAdminResolved = profileFull?.role === 'admin' || profileFull?.is_admin === true
  const isAdvisorResolved = profileFull?.role === 'advisor'
  const isAttorneyResolved = profileFull?.role === 'attorney' || profileFull?.is_attorney === true
  const isActive = profileFull?.subscription_status === 'active'
  const isAdvisorManaged = profileFull?.subscription_status === 'advisor_managed'

  // Check trial status
  const trialStarted = profileFull?.trial_started_at ? new Date(profileFull.trial_started_at) : null
  const trialExpiry = trialStarted ? new Date(trialStarted.getTime() + 15 * 60 * 1000) : null
  const now = new Date()
  const trialActive = trialExpiry ? now < trialExpiry : false
  const trialMinutesLeft = trialExpiry ? Math.max(0, Math.ceil((trialExpiry.getTime() - now.getTime()) / 60000)) : 0
  const trialSecondsLeft = trialExpiry ? Math.max(0, Math.ceil((trialExpiry.getTime() - now.getTime()) / 1000)) : 0

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
    isAdvisorManaged ||
    isActive ||
    trialActive ||
    isAttorneyResolved
  if (!hasAccess) redirect('/billing')

  const tier =
    isAdvisorResolved || isAdvisorClient || isAdvisorManaged || isAdminResolved
      ? 3
      : (profileFull?.consumer_tier ?? 1)

  const showBanner =
    !isAdminResolved &&
    !isAdvisorResolved &&
    !isAdvisorClient &&
    !isAdvisorManaged &&
    !isActive &&
    trialActive

  return (
    <div className="flex min-h-screen bg-neutral-50">
      <SidebarNav
        user={sessionUser}
        role={profileFull?.role}
        tier={tier}
        isAdvisor={isAdvisorResolved || isAdvisorClient}
        isAdmin={isAdminResolved}
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
        <main className="flex-1">{children}</main>
      </div>
    </div>
  )
}
