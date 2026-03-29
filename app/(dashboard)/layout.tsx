import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SidebarNav } from './_components/sidebar-nav'
import { TrialBanner } from './_components/trial-banner'
import { getUserAccess } from '@/lib/get-user-access'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_status, role, trial_started_at, consumer_tier, is_admin')
    .eq('id', user.id)
    .single()

  const isAdmin = profile?.role === 'admin' || profile?.is_admin === true
  const isActive = profile?.subscription_status === 'active'

  // Check trial status
  const trialStarted = profile?.trial_started_at
    ? new Date(profile.trial_started_at)
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

  const isAdvisor = profile?.role === 'advisor'

  // Check if user is an advisor client
  let isAdvisorClient = false
  if (!isAdvisor) {
    const { data: clientRow } = await supabase
      .from('advisor_clients')
      .select('id')
      .eq('client_id', user.id)
      .eq('status', 'active')
      .maybeSingle()
    isAdvisorClient = !!clientRow
  }

  const hasAccess = isAdmin || isAdvisor || isAdvisorClient || isActive || trialActive
  if (!hasAccess) {
    redirect('/billing')
  }

  // Get user tier for sidebar gating
  const access = { tier: (isAdvisor || isAdvisorClient) ? 3 : isAdmin ? 3 : (profile?.consumer_tier ?? 1) }
  const showBanner = !isAdmin && !isAdvisor && !isAdvisorClient && !isActive && trialActive

  return (
    <div className="flex min-h-screen bg-neutral-50">
      <SidebarNav
        user={user}
        role={profile?.role}
        tier={access.tier}
        isAdvisor={isAdvisor || isAdvisorClient}
        isAdmin={profile?.is_admin === true}
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
