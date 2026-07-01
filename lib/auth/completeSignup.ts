import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { notifyAdvisorForReferralCode } from '@/lib/advisor/notifyAdvisorOfReferredSignup'
import { shouldSyncFirmStripeOnRosterChange } from '@/lib/billing/firmConnectionBilling'
import { syncFirmStripeQuantity } from '@/lib/stripe/syncFirmQuantity'
import { countFirmRosterSeats, getFirmTierMaxSeats } from '@/lib/firm/firmRoster'
import { recordTermsAcceptance } from '@/lib/terms/recordTermsAcceptance'
import { BETA_SIGNUP_ACCOUNT_SOURCE } from '@/lib/waitlist-mode'
import type { SignupAdmissionPayload, SignupRole } from '@/lib/auth/signupAdmission'

export type CompleteSignupInput = {
  userId: string
  email: string
  fullName: string
  role: SignupRole
  termsAcceptedAt: string
  admission: SignupAdmissionPayload
  referralCode?: string
  referralSlug?: string
  attorneyReferralCode?: string
  attorneyReferralSlug?: string
  betaLabel?: string | null
  betaAccessActive?: boolean
}

export type CompleteSignupResult = {
  nextPath: string
}

/** Advisor firm owner bootstrap — only for admissions that imply a new advisor org. */
const ADVISOR_FIRM_BOOTSTRAP_ADMISSIONS = new Set<SignupAdmissionPayload['type']>([
  'beta_access',
  'waitlist_invite',
  'advisor_connect',
  'open_advisor',
])

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

async function bootstrapAdvisorFirm(
  admin: SupabaseClient,
  userId: string,
  email: string,
): Promise<void> {
  const { data: profile } = await admin
    .from('profiles')
    .select('role, firm_id')
    .eq('id', userId)
    .maybeSingle()

  if (profile?.role !== 'advisor' || profile.firm_id != null) return

  const prefix = email.includes('@')
    ? email.slice(0, email.indexOf('@')).trim()
    : email.trim() || 'Advisor'
  const defaultFirmName = `${prefix} Firm`

  const { data: newFirm, error: firmError } = await admin
    .from('firms')
    .insert({
      name: defaultFirmName,
      owner_id: userId,
      tier: 'starter',
      seat_count: 1,
      subscription_status: null,
    })
    .select('id')
    .single()

  if (firmError || !newFirm?.id) {
    console.error('advisor firm bootstrap error:', firmError)
    return
  }

  const now = new Date().toISOString()
  const { error: memberError } = await admin.from('firm_members').insert({
    firm_id: newFirm.id,
    user_id: userId,
    firm_role: 'owner',
    status: 'active',
    joined_at: now,
  })
  if (memberError) {
    console.error('advisor firm member bootstrap error:', memberError)
    return
  }

  const { error: profileError } = await admin
    .from('profiles')
    .update({ firm_id: newFirm.id, firm_role: 'owner' })
    .eq('id', userId)
  if (profileError) {
    console.error('advisor firm profile bootstrap error:', profileError)
  }
}

async function joinFirmFromInvite(
  admin: SupabaseClient,
  userId: string,
  userEmail: string,
  firmInviteToken: string,
  firmId: string,
): Promise<void> {
  const { data: row, error: lookupError } = await admin
    .from('firm_members')
    .select('id, firm_id, invited_email, status')
    .eq('invite_token', firmInviteToken)
    .eq('firm_id', firmId)
    .maybeSingle()

  if (lookupError || !row || row.status !== 'pending') {
    console.error('firm join after signup: invalid invite', lookupError)
    return
  }

  const invited = row.invited_email
  if (!invited || normalizeEmail(userEmail) !== normalizeEmail(invited)) {
    console.error('firm join after signup: email mismatch')
    return
  }

  const { data: firmRow } = await admin
    .from('firms')
    .select('seat_count, tier, subscription_status')
    .eq('id', firmId)
    .single()

  if (!firmRow) return

  const tierMax = getFirmTierMaxSeats(firmRow.tier)
  const roster = await countFirmRosterSeats(admin, firmId)
  const activeAfterJoin = roster.active + 1
  if (activeAfterJoin > tierMax) {
    console.error('firm join after signup: seat cap exceeded')
    return
  }

  const now = new Date().toISOString()
  await admin
    .from('firm_members')
    .update({ status: 'active', user_id: userId, joined_at: now })
    .eq('id', row.id)

  await admin
    .from('profiles')
    .update({ firm_id: firmId, firm_role: 'member' })
    .eq('id', userId)

  const nextSeatCount = Math.max(activeAfterJoin, firmRow.seat_count ?? 1)
  await admin.from('firms').update({ seat_count: nextSeatCount }).eq('id', firmId)

  if (shouldSyncFirmStripeOnRosterChange()) {
    await syncFirmStripeQuantity(firmId)
  }
}

async function claimAdvisorConnectInvite(
  admin: SupabaseClient,
  userId: string,
  userEmail: string,
  connectToken: string,
): Promise<void> {
  const { data: row } = await admin
    .from('advisor_clients')
    .select('id, invited_email, status, invite_expires_at, advisor_id, client_id')
    .eq('invite_token', connectToken)
    .eq('status', 'consumer_requested')
    .maybeSingle()

  if (!row) return
  if (row.invite_expires_at && new Date(row.invite_expires_at) < new Date()) return
  const invitedEmail = row.invited_email?.trim().toLowerCase()
  const userNorm = userEmail.trim().toLowerCase()
  if (invitedEmail && userNorm && invitedEmail !== userNorm) return
  if (row.advisor_id && row.advisor_id !== userId) return

  await admin.from('advisor_clients').update({ advisor_id: userId }).eq('id', row.id)

  try {
    await admin.rpc('create_notification', {
      p_user_id: row.client_id,
      p_type: 'consumer_connection_request_sent',
      p_title: 'Your advisor joined My Wealth Maps',
      p_body: 'Your advisor created an account and can now accept your connection request.',
      p_delivery: 'both',
      p_metadata: { advisor_id: userId },
      p_cooldown: '1 hour',
    })
  } catch (err) {
    console.error('claim connect notification error:', err)
  }
}

async function recordAccountCreatedFunnel(
  admin: SupabaseClient,
  input: CompleteSignupInput,
): Promise<void> {
  const properties: Record<string, unknown> = {
    role: input.role,
  }
  if (input.betaAccessActive) {
    properties.signup_source = BETA_SIGNUP_ACCOUNT_SOURCE
    if (input.betaLabel) properties.beta_label = input.betaLabel
  }
  if (input.referralCode) properties.advisor_referral_code = input.referralCode
  if (input.attorneyReferralCode) properties.attorney_referral_code = input.attorneyReferralCode

  await admin.from('funnel_events').insert({
    event_name: 'account_created',
    user_id: input.userId,
    event_slug: input.referralSlug ?? input.attorneyReferralSlug ?? null,
    referral_code: input.referralCode ?? input.attorneyReferralCode ?? null,
    properties,
  })
}

export async function completeSignupAfterCreate(
  input: CompleteSignupInput,
): Promise<CompleteSignupResult> {
  const admin = createAdminClient()

  await recordTermsAcceptance(input.userId, input.termsAcceptedAt)

  if (
    input.role === 'advisor' &&
    ADVISOR_FIRM_BOOTSTRAP_ADMISSIONS.has(input.admission.type)
  ) {
    await bootstrapAdvisorFirm(admin, input.userId, input.email)
  }

  if (input.admission.type === 'firm_member_invite') {
    const firmInviteToken = input.admission.firmInviteToken?.trim() ?? ''
    const firmId = input.admission.firmId?.trim() ?? ''
    if (!firmInviteToken || !firmId) {
      console.error('firm join after signup: missing validated invite fields')
    } else {
      await joinFirmFromInvite(admin, input.userId, input.email, firmInviteToken, firmId)
    }
  }

  if (input.referralCode || input.attorneyReferralCode) {
    await admin
      .from('profiles')
      .update({
        ...(input.referralCode ? { referral_code: input.referralCode } : {}),
        ...(input.attorneyReferralCode ? { attorney_referral_code: input.attorneyReferralCode } : {}),
      })
      .eq('id', input.userId)

    if (input.referralCode && input.role === 'consumer') {
      void notifyAdvisorForReferralCode({
        referralCode: input.referralCode,
        consumerName: input.fullName.trim(),
        consumerEmail: input.email.trim(),
      })
    }
  }

  if (input.admission.type === 'advisor_connect' && input.admission.connectToken) {
    await claimAdvisorConnectInvite(
      admin,
      input.userId,
      input.email,
      input.admission.connectToken,
    )
  }

  await recordAccountCreatedFunnel(admin, input)

  if (input.admission.type === 'advisor_client_invite' && input.admission.inviteToken) {
    return { nextPath: `/invite/${input.admission.inviteToken}` }
  }
  if (input.admission.type === 'advisor_connect' && input.admission.connectToken) {
    return { nextPath: `/advisor/connect/${input.admission.connectToken}` }
  }

  return { nextPath: `/auth/confirm-email?email=${encodeURIComponent(input.email)}` }
}
