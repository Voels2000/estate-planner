import type { SupabaseClient } from '@supabase/supabase-js'
import { timingSafeEqual } from 'crypto'
import {
  isProductionMarketingHost,
  isSignupExplicitlyOpen,
  isValidBetaSignupAccessToken,
} from '@/lib/waitlist-mode'

export type SignupRole = 'consumer' | 'advisor' | 'attorney'

export type SignupAdmissionType =
  | 'open_consumer'
  | 'open_advisor'
  | 'open_attorney'
  | 'beta_access'
  | 'waitlist_invite'
  | 'advisor_client_invite'
  | 'firm_member_invite'
  | 'advisor_connect'
  | 'attorney_connection'

export type SignupAdmissionPayload = {
  type: SignupAdmissionType
  access?: string
  inviteToken?: string
  firmInviteToken?: string
  firmId?: string
  connectToken?: string
  connectionId?: string
}

export type SignupAdmissionContext = {
  email: string
  role: SignupRole
  hostname?: string | null
}

export type SignupAdmissionResult =
  | { ok: true }
  | { ok: false; reason: string; status: 400 | 403 }

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

function emailsMatch(a: string, b: string | null | undefined): boolean {
  if (!b) return false
  return normalizeEmail(a) === normalizeEmail(b)
}

export function resolveEffectiveSignupRole(
  role: SignupRole,
  admission: SignupAdmissionPayload,
): SignupRole {
  if (admission.type === 'advisor_client_invite') return 'consumer'
  return role
}

export async function validateSignupAdmission(
  admin: SupabaseClient,
  admission: SignupAdmissionPayload,
  ctx: SignupAdmissionContext,
): Promise<SignupAdmissionResult> {
  const email = normalizeEmail(ctx.email)
  if (!email.includes('@')) {
    return { ok: false, reason: 'Invalid email', status: 400 }
  }

  switch (admission.type) {
    case 'open_consumer': {
      if (!isSignupExplicitlyOpen()) {
        return { ok: false, reason: 'Public signup is not open', status: 403 }
      }
      if (ctx.role !== 'consumer') {
        return { ok: false, reason: 'Only consumer self-serve signup is open', status: 403 }
      }
      return { ok: true }
    }

    case 'open_advisor':
    case 'open_attorney': {
      if (!isSignupExplicitlyOpen()) {
        return { ok: false, reason: 'Public signup is not open', status: 403 }
      }
      return { ok: true }
    }

    case 'beta_access': {
      const token = admission.access?.trim() ?? ''
      if (!isValidBetaSignupAccessToken(token)) {
        return { ok: false, reason: 'Invalid or missing beta access token', status: 403 }
      }
      return { ok: true }
    }

    case 'waitlist_invite': {
      const { data } = await admin
        .from('email_captures')
        .select('id, invited_at')
        .eq('email', email)
        .not('invited_at', 'is', null)
        .order('invited_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (!data?.invited_at) {
        return { ok: false, reason: 'No waitlist invitation for this email', status: 403 }
      }
      return { ok: true }
    }

    case 'advisor_client_invite': {
      const token = admission.inviteToken?.trim() ?? ''
      if (!token) {
        return { ok: false, reason: 'Missing advisor invite token', status: 400 }
      }
      const { data: invite } = await admin
        .from('advisor_clients')
        .select('id, invited_email, status, invite_expires_at')
        .eq('invite_token', token)
        .eq('status', 'pending')
        .maybeSingle()

      if (!invite) {
        return { ok: false, reason: 'Invalid or expired advisor invite', status: 403 }
      }
      if (invite.invite_expires_at && new Date(invite.invite_expires_at) < new Date()) {
        return { ok: false, reason: 'Advisor invite has expired', status: 403 }
      }
      if (!emailsMatch(email, invite.invited_email)) {
        return { ok: false, reason: 'Email does not match invitation', status: 403 }
      }
      return { ok: true }
    }

    case 'firm_member_invite': {
      const inviteToken = admission.firmInviteToken?.trim() ?? ''
      const firmId = admission.firmId?.trim() ?? ''
      if (!inviteToken || !firmId) {
        return { ok: false, reason: 'Missing firm invite parameters', status: 400 }
      }
      const { data: row } = await admin
        .from('firm_members')
        .select('id, invited_email, status')
        .eq('invite_token', inviteToken)
        .eq('firm_id', firmId)
        .maybeSingle()

      if (!row || row.status !== 'pending') {
        return { ok: false, reason: 'Invalid or already used firm invite', status: 403 }
      }
      if (!emailsMatch(email, row.invited_email)) {
        return { ok: false, reason: 'Email does not match firm invitation', status: 403 }
      }
      return { ok: true }
    }

    case 'advisor_connect': {
      const token = admission.connectToken?.trim() ?? ''
      if (!token) {
        return { ok: false, reason: 'Missing connect token', status: 400 }
      }
      if (ctx.role !== 'advisor') {
        return { ok: false, reason: 'Advisor role required for connect signup', status: 403 }
      }
      const { data: row } = await admin
        .from('advisor_clients')
        .select('id, invited_email, status, invite_expires_at, advisor_id')
        .eq('invite_token', token)
        .eq('status', 'consumer_requested')
        .maybeSingle()

      if (!row) {
        return { ok: false, reason: 'Invalid or claimed connect invitation', status: 403 }
      }
      if (row.invite_expires_at && new Date(row.invite_expires_at) < new Date()) {
        return { ok: false, reason: 'Connect invitation has expired', status: 403 }
      }
      if (!emailsMatch(email, row.invited_email)) {
        return { ok: false, reason: 'Email does not match connect invitation', status: 403 }
      }
      if (row.advisor_id) {
        return { ok: false, reason: 'Connect invitation already claimed', status: 403 }
      }
      return { ok: true }
    }

    case 'attorney_connection': {
      const connectionId = admission.connectionId?.trim() ?? ''
      if (!connectionId) {
        return { ok: false, reason: 'Missing connection id', status: 400 }
      }
      if (ctx.role !== 'attorney') {
        return { ok: false, reason: 'Attorney role required', status: 403 }
      }
      const { data: connection } = await admin
        .from('attorney_clients')
        .select('id, attorney_id, status')
        .eq('id', connectionId)
        .maybeSingle()

      if (!connection) {
        return { ok: false, reason: 'Invalid attorney connection', status: 403 }
      }

      const { data: listing } = await admin
        .from('attorney_listings')
        .select('id, email, profile_id')
        .eq('id', connection.attorney_id)
        .maybeSingle()

      if (!listing) {
        return { ok: false, reason: 'Attorney listing not found', status: 403 }
      }
      if (listing.profile_id) {
        return { ok: false, reason: 'Attorney already has an account', status: 403 }
      }
      if (!emailsMatch(email, listing.email)) {
        return { ok: false, reason: 'Email does not match attorney invitation', status: 403 }
      }
      return { ok: true }
    }

    default: {
      const _exhaustive: never = admission.type
      return { ok: false, reason: `Unknown admission type: ${_exhaustive}`, status: 400 }
    }
  }
}

export function inferSignupAdmissionFromClient(input: {
  betaAccessActive: boolean
  betaAccessToken?: string | null
  advisorInviteToken?: string
  firmInviteToken?: string
  firmId?: string
  connectToken?: string
  connectionToken?: string
  signupOpen: boolean
}): SignupAdmissionPayload {
  if (input.betaAccessActive && input.betaAccessToken?.trim()) {
    return { type: 'beta_access', access: input.betaAccessToken.trim() }
  }
  if (input.advisorInviteToken?.trim()) {
    return { type: 'advisor_client_invite', inviteToken: input.advisorInviteToken.trim() }
  }
  if (input.firmInviteToken?.trim() && input.firmId?.trim()) {
    return {
      type: 'firm_member_invite',
      firmInviteToken: input.firmInviteToken.trim(),
      firmId: input.firmId.trim(),
    }
  }
  if (input.connectToken?.trim()) {
    return { type: 'advisor_connect', connectToken: input.connectToken.trim() }
  }
  if (input.connectionToken?.trim()) {
    return { type: 'attorney_connection', connectionId: input.connectionToken.trim() }
  }
  if (input.signupOpen) {
    return { type: 'open_consumer' }
  }
  return { type: 'open_consumer' }
}

export function shouldRequireEmailConfirmation(
  admission: SignupAdmissionPayload,
  hostname?: string | null,
): boolean {
  return !resolveEmailConfirmForCreateUser(admission, hostname)
}

/**
 * `email_confirm` flag for admin.auth.admin.createUser.
 * - open_consumer: false (require verification) on prod marketing; false by default everywhere
 *   unless SIGNUP_SKIP_EMAIL_CONFIRM=true (staging E2E only).
 * - invite/token admissions: true (immediate session; email matched to invite row).
 */
export function resolveEmailConfirmForCreateUser(
  admission: SignupAdmissionPayload,
  hostname?: string | null,
): boolean {
  if (admission.type !== 'open_consumer') {
    return true
  }
  if (process.env.SIGNUP_SKIP_EMAIL_CONFIRM === 'true') {
    return true
  }
  if (isProductionMarketingHost(hostname)) {
    return false
  }
  // Non-prod: still require confirm for open_consumer unless explicit E2E skip above
  return false
}

/** @internal constant-time string compare for tests */
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  return timingSafeEqual(Buffer.from(a), Buffer.from(b))
}
