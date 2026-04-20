// Sprint 63 - Create, revoke, and manage beneficiary access grants
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type {
  CreateGrantPayload,
  BeneficiaryAccessGrant,
} from '@/lib/types/beneficiary-grant'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? 'https://estate-planner-gules.vercel.app'

// Create a new beneficiary access grant
export async function createBeneficiaryGrant(
  payload: CreateGrantPayload
): Promise<{ success: boolean; grant?: BeneficiaryAccessGrant; error?: string }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  // Insert without reading back (avoids RLS block on household_id check)
  const { error: insertError } = await supabase
    .from('beneficiary_access_grants')
    .insert({
      household_id:       payload.household_id,
      granted_by_user_id: user.id,
      grantee_email:      payload.grantee_email,
      grantee_name:       payload.grantee_name,
      relationship:       payload.relationship,
      access_level:       payload.access_level,
      expires_at:         payload.expires_at ?? null,
    })

  if (insertError) {
    console.error('createBeneficiaryGrant error:', insertError)
    return { success: false, error: insertError.message }
  }

  // Fetch the grant back using granted_by_user_id (covered by SELECT policy)
  const { data: grant } = await supabase
    .from('beneficiary_access_grants')
    .select('*')
    .eq('granted_by_user_id', user.id)
    .eq('grantee_email', payload.grantee_email)
    .order('granted_at', { ascending: false })
    .limit(1)
    .single()

  if (grant) {
    await sendGrantInviteEmail(grant as BeneficiaryAccessGrant)
  }

  revalidatePath('/advisor/clients')
  return { success: true }
}

// Revoke a grant
export async function revokeBeneficiaryGrant(
  grantId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('revoke_beneficiary_grant', {
    p_grant_id: grantId,
  })

  if (error || !data?.success) {
    return { success: false, error: error?.message ?? data?.error ?? 'Failed to revoke' }
  }

  revalidatePath('/advisor/clients')
  return { success: true }
}

// Fetch all grants for a household
export async function getGrantsForHousehold(
  householdId: string
): Promise<BeneficiaryAccessGrant[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('beneficiary_access_grants')
    .select('*')
    .eq('household_id', householdId)
    .order('granted_at', { ascending: false })

  if (error) {
    console.error('getGrantsForHousehold error:', error)
    return []
  }

  return (data ?? []) as BeneficiaryAccessGrant[]
}

export async function createDigitalAsset(
  payload: {
    household_id: string
    asset_type: string
    platform: string
    description: string | null
    estimated_value: number | null
    wallet_address: string | null
    account_username: string | null
    storage_location: string | null
    access_instructions: string | null
    executor_grantee_email: string | null
    executor_notes: string | null
  }
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const { error } = await supabase
    .from('digital_assets')
    .insert({
      ...payload,
      owner_id: user.id,
      name: payload.platform,
    })

  if (error) {
    console.error('createDigitalAsset error:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/digital-assets')
  return { success: true }
}

export async function deleteGrant(
  grantId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('beneficiary_access_grants')
    .delete()
    .eq('id', grantId)

  if (error) {
    console.error('deleteGrant error:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/advisor/clients')
  return { success: true }
}

// Email helper
async function sendGrantInviteEmail(grant: BeneficiaryAccessGrant): Promise<void> {
  console.log('sendGrantInviteEmail called for:', grant.grantee_email, 'token:', grant.token)
  const viewUrl = `${APP_URL}/beneficiary/${grant.token}`

  try {
    await resend.emails.send({
      from: 'EstatePlanner <noreply@mywealthmaps.com>',
      to: grant.grantee_email,
      subject: 'Your estate plan access has been shared with you',
      html: `
        <p>Hello ${grant.grantee_name},</p>
        <p>An estate plan has been shared with you for viewing.</p>
        <p>
          <a href="${viewUrl}" style="background:#1d4ed8;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;">
            View Estate Plan
          </a>
        </p>
        <p>This link ${
          grant.expires_at
            ? `expires on ${new Date(grant.expires_at).toLocaleDateString()}.`
            : 'does not expire.'
        }</p>
        <p style="font-size:12px;color:#6b7280;">
          If you did not expect this message, you can safely ignore it.
          This information is for viewing purposes only and requires no action.
        </p>
      `,
    })
  } catch (err) {
    // Email failure is non-fatal; grant was still created
    console.error('sendGrantInviteEmail failed:', err)
  }
}
