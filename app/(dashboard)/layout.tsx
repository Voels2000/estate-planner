import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SidebarNav } from './_components/sidebar-nav'
import { DashboardShell } from './_components/dashboard-shell'
import { TrialBanner } from './_components/trial-banner'
import { InviteAdvisorOnboardingGate } from './_components/invite-advisor-gate'
import { WizardOnboardingGate } from './_components/wizard-onboarding-gate'
import { getDashboardLayoutContext } from '@/lib/access/getDashboardLayoutContext'
import {
  isMinimumViableProfile,
  isWizardComplete,
  isWizardReadyProfile,
} from '@/lib/estate/profileGate'
import { ensureWizardBackfill } from '@/lib/onboarding/ensureWizardBackfill'
import { checkHouseholdHasData } from '@/lib/onboarding/checkHouseholdHasData'
import { shouldRequireWizardOnboarding } from '@/lib/onboarding/shouldRequireWizardOnboarding'
import { CONNECTED_ADVISOR_CLIENT_STATUSES } from '@/lib/advisor/clientConnectionStatus'

function DashboardMain({
  children,
  showBanner,
  trialSecondsLeft,
  trialMinutesLeft,
  trialExpiry,
  needsWizardOnboarding,
  needsInviteAdvisorOnboarding,
}: {
  children: React.ReactNode
  showBanner?: boolean
  trialSecondsLeft?: number
  trialMinutesLeft?: number
  trialExpiry?: Date
  needsWizardOnboarding: boolean
  needsInviteAdvisorOnboarding: boolean
}) {
  return (
    <>
      {showBanner && trialExpiry && (
        <TrialBanner
          secondsLeft={trialSecondsLeft ?? 0}
          minutesLeft={trialMinutesLeft ?? 0}
          expiryTimestamp={trialExpiry.getTime()}
        />
      )}
      <WizardOnboardingGate needsWizard={needsWizardOnboarding} />
      <InviteAdvisorOnboardingGate needsOnboarding={needsInviteAdvisorOnboarding} />
      <main className="flex-1">{children}</main>
    </>
  )
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const layoutContext = await getDashboardLayoutContext()

  if (!layoutContext) redirect('/login')

  const { sessionUser, user, profile, householdRow, unreadNotificationCount, isSuperuser } =
    layoutContext
  const profileFull = profile

  let wizardComplete = isWizardComplete(profileFull)
  if (
    !isSuperuser &&
    profileFull?.role === 'consumer' &&
    !wizardComplete &&
    isWizardReadyProfile(householdRow)
  ) {
    const supabase = await createClient()
    const backfilled = await ensureWizardBackfill(supabase, sessionUser.id)
    if (backfilled) wizardComplete = true
  }

  let hasAnyHouseholdData = false
  if (
    !isSuperuser &&
    profileFull?.role === 'consumer' &&
    !wizardComplete &&
    isWizardReadyProfile(householdRow)
  ) {
    const supabaseForGate = await createClient()
    hasAnyHouseholdData = await checkHouseholdHasData(supabaseForGate, sessionUser.id)
  }

  const needsWizardOnboarding = shouldRequireWizardOnboarding({
    isSuperuser,
    role: profileFull?.role,
    wizardComplete,
    wizardReady: isWizardReadyProfile(householdRow),
    hasAnyData: hasAnyHouseholdData,
  })

  const needsInviteAdvisorOnboarding =
    !isSuperuser &&
    profileFull?.role === 'consumer' &&
    wizardComplete &&
    !profileFull?.onboarding_invite_advisor_completed_at &&
    isMinimumViableProfile(householdRow ?? {}).complete

  const hasHousehold = !!householdRow

  // Superuser: use actual role as primary identity, unlock everything on top
  if (isSuperuser) {
    return (
      <DashboardShell
        sidebar={
          <SidebarNav
            user={sessionUser}
            role={profileFull?.role ?? profile?.role}
            tier={3}
            isAdvisor
            isAdmin
            isAttorney
            isSuperuser
            hasHousehold={hasHousehold}
            initialUnreadCount={unreadNotificationCount}
          />
        }
      >
        <DashboardMain
          needsWizardOnboarding={needsWizardOnboarding}
          needsInviteAdvisorOnboarding={needsInviteAdvisorOnboarding}
        >
          {children}
        </DashboardMain>
      </DashboardShell>
    )
  }

  const isAdminResolved = profileFull?.role === 'admin' || profileFull?.is_admin === true
  const isAdvisorResolved = profileFull?.role === 'advisor'
  const isAttorneyResolved = profileFull?.role === 'attorney' || profileFull?.is_attorney === true
  const isActive = profileFull?.subscription_status === 'active'
  const isAdvisorManaged = profileFull?.subscription_status === 'advisor_managed'

  // Check trial status
  const trialStarted = profileFull?.trial_started_at ? new Date(profileFull.trial_started_at) : null
  const trialExpiry = trialStarted ? new Date(trialStarted.getTime() + 3 * 24 * 60 * 60 * 1000) : null
  const now = new Date()
  const trialActive = trialExpiry ? now < trialExpiry : false
  const trialMinutesLeft = trialExpiry ? Math.max(0, Math.ceil((trialExpiry.getTime() - now.getTime()) / 60000)) : 0
  const trialSecondsLeft = trialExpiry ? Math.max(0, Math.ceil((trialExpiry.getTime() - now.getTime()) / 1000)) : 0

  // Check if user is an advisor client
  let isAdvisorClient = false
  if (!isAdvisorResolved) {
    const supabase = await createClient()
    const { data: clientRow } = await supabase
      .from('advisor_clients')
      .select('id')
      .eq('client_id', sessionUser.id)
      .in('status', [...CONNECTED_ADVISOR_CLIENT_STATUSES])
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
    <DashboardShell
      sidebar={
        <SidebarNav
          user={sessionUser}
          role={profileFull?.role}
          tier={tier}
          isAdvisor={isAdvisorResolved || isAdvisorClient}
          isAdmin={isAdminResolved}
          isAttorney={isAttorneyResolved}
          isSuperuser={isSuperuser}
          hasHousehold={hasHousehold}
          initialUnreadCount={unreadNotificationCount ?? 0}
        />
      }
    >
      <DashboardMain
        showBanner={showBanner}
        trialSecondsLeft={trialSecondsLeft}
        trialMinutesLeft={trialMinutesLeft}
        trialExpiry={trialExpiry ?? undefined}
        needsWizardOnboarding={needsWizardOnboarding}
        needsInviteAdvisorOnboarding={needsInviteAdvisorOnboarding}
      >
        {children}
      </DashboardMain>
    </DashboardShell>
  )
}
