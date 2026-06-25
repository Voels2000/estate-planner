import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SidebarNav } from './_components/sidebar-nav'
import { DashboardShell } from './_components/dashboard-shell'
import { TrialBanner } from './_components/trial-banner'
import { PlanExportEditWindowBanner } from './_components/plan-export-edit-window-banner'
import { InviteAdvisorOnboardingGate } from './_components/invite-advisor-gate'
import { WizardOnboardingGate } from './_components/wizard-onboarding-gate'
import { getDashboardLayoutContext } from '@/lib/access/getDashboardLayoutContext'
import { getUserAccess } from '@/lib/get-user-access'
import {
  isMinimumViableProfile,
  isWizardComplete,
  isWizardReadyProfile,
} from '@/lib/estate/profileGate'
import { ensureWizardBackfill } from '@/lib/onboarding/ensureWizardBackfill'
import { checkHouseholdHasData } from '@/lib/onboarding/checkHouseholdHasData'
import { shouldRequireWizardOnboarding } from '@/lib/onboarding/shouldRequireWizardOnboarding'
import { CONNECTED_ADVISOR_CLIENT_STATUSES } from '@/lib/advisor/clientConnectionStatus'
import { LinkPendingInviteOnMount } from '@/components/advisor/LinkPendingInviteOnMount'
import { AnnualBillingProvider } from '@/lib/billing/AnnualBillingContext'
import { isAnnualBillingConfigured } from '@/lib/billing/stripePrices'
import { isWithinPlanExportFinalWarning } from '@/lib/billing/planExportAccess'
import {
  getUserPlanExportPurchase,
} from '@/lib/billing/oneTimePurchases'
import { createAdminClient } from '@/lib/supabase/admin'

function DashboardMain({
  children,
  showBanner,
  trialExpiry,
  planExportEditWindowEndsAt,
  needsWizardOnboarding,
  needsInviteAdvisorOnboarding,
  linkPendingInvite,
}: {
  children: React.ReactNode
  showBanner?: boolean
  trialExpiry?: Date
  planExportEditWindowEndsAt?: string | null
  needsWizardOnboarding: boolean
  needsInviteAdvisorOnboarding: boolean
  linkPendingInvite?: boolean
}) {
  return (
    <>
      {linkPendingInvite && <LinkPendingInviteOnMount />}
      {showBanner && trialExpiry && (
        <TrialBanner expiryTimestamp={trialExpiry.getTime()} />
      )}
      {planExportEditWindowEndsAt && (
        <div className="px-4 pt-4">
          <PlanExportEditWindowBanner editWindowEndsAt={planExportEditWindowEndsAt} />
        </div>
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
  const userAccess = await getUserAccess()

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

  const annualBillingAvailable = isAnnualBillingConfigured()

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
        <AnnualBillingProvider available={annualBillingAvailable}>
          <DashboardMain
            needsWizardOnboarding={needsWizardOnboarding}
            needsInviteAdvisorOnboarding={needsInviteAdvisorOnboarding}
            linkPendingInvite={profileFull?.role === 'consumer'}
          >
            {children}
          </DashboardMain>
        </AnnualBillingProvider>
      </DashboardShell>
    )
  }

  const isAdminResolved = profileFull?.role === 'admin' || profileFull?.is_admin === true
  const isAdvisorResolved = profileFull?.role === 'advisor'
  const isAttorneyResolved = profileFull?.role === 'attorney' || profileFull?.is_attorney === true
  const isConsumer = profileFull?.role === 'consumer'
  const subscriptionStatus = profileFull?.subscription_status ?? 'none'
  const isActive = subscriptionStatus === 'active'
  const isStripeTrial = subscriptionStatus === 'trialing'
  const isAdvisorManaged = subscriptionStatus === 'advisor_managed'
  const isAttorneyManaged = subscriptionStatus === 'attorney_managed'
  const isProfessionallyManaged = isAdvisorManaged || isAttorneyManaged
  const needsBillingRedirect = subscriptionStatus === 'past_due' || subscriptionStatus === 'unpaid'

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
    isProfessionallyManaged ||
    isActive ||
    isStripeTrial ||
    subscriptionStatus === 'canceling' ||
    isAttorneyResolved ||
    (isConsumer && !needsBillingRedirect)

  if (!hasAccess) redirect('/billing')

  const tier = userAccess.tier
  const isTrial = userAccess.isTrial

  const trialEndsAtDate = userAccess.trialEndsAt
    ? new Date(userAccess.trialEndsAt)
    : null

  const showTrialBanner =
    isTrial &&
    !isAdminResolved &&
    !isAdvisorResolved &&
    !isAdvisorClient &&
    !isAdvisorManaged &&
    trialEndsAtDate != null &&
    trialEndsAtDate.getTime() > Date.now()

  let planExportEditWindowEndsAt: string | null = null
  if (isConsumer && !isAdvisorClient && subscriptionStatus !== 'active') {
    const planExportPurchase = await getUserPlanExportPurchase(
      createAdminClient(),
      sessionUser.id,
    )
    if (
      planExportPurchase &&
      isWithinPlanExportFinalWarning(planExportPurchase.edit_window_ends_at)
    ) {
      planExportEditWindowEndsAt = planExportPurchase.edit_window_ends_at
    }
  }

  return (
    <DashboardShell
      sidebar={
        <SidebarNav
          user={sessionUser}
          role={profileFull?.role}
          tier={tier}
          isTrial={isTrial}
          isAdvisor={isAdvisorResolved || isAdvisorClient}
          isAdmin={isAdminResolved}
          isAttorney={isAttorneyResolved}
          isSuperuser={isSuperuser}
          hasHousehold={hasHousehold}
          initialUnreadCount={unreadNotificationCount ?? 0}
        />
      }
    >
      <AnnualBillingProvider available={annualBillingAvailable}>
        <DashboardMain
          showBanner={showTrialBanner}
          trialExpiry={trialEndsAtDate ?? undefined}
          planExportEditWindowEndsAt={planExportEditWindowEndsAt}
          needsWizardOnboarding={needsWizardOnboarding}
          needsInviteAdvisorOnboarding={needsInviteAdvisorOnboarding}
          linkPendingInvite={isConsumer}
        >
          {children}
        </DashboardMain>
      </AnnualBillingProvider>
    </DashboardShell>
  )
}
