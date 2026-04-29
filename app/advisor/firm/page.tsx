/**
 * Advisor firm management page (server).
 *
 * Validates firm-owner access and loads roster/billing context for the firm client UI.
 */

import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAccessContext } from '@/lib/access/getAccessContext'
import FirmClient from './_firm-client'

export type FirmMemberRow = {
  id: string
  firm_role: string
  status: string
  invited_at: string | null
  joined_at: string | null
  display_email: string
}

export default async function AdvisorFirmPage() {
  const access = await getAccessContext()

  if (!access.user) {
    redirect('/login')
  }
  if (!access.isAdvisor) {
    redirect('/dashboard')
  }
  if (!access.isFirmOwner) {
    redirect('/advisor')
  }

  const firmId = access.firm_id
  const firmName = access.firm_name
  const firmTier = access.firm_tier
  const seatCount = access.seat_count

  if (!firmId) {
    return (
      <div className="rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm text-center max-w-lg mx-auto">
        <p className="text-neutral-700 font-medium">Firm not set up</p>
        <a
          href="/advisor"
          className="mt-4 inline-block text-sm font-medium text-indigo-600 hover:underline"
        >
          ← Back to Advisor Portal
        </a>
      </div>
    )
  }

  const adminClient = createAdminClient()
  const { data: members, error } = await adminClient
    .from('firm_members')
    .select('id, firm_role, status, invited_at, joined_at, user_id, invited_email')
    .eq('firm_id', firmId)
    .neq('status', 'removed')
    .order('joined_at', { ascending: true, nullsFirst: false })

  if (error) {
    console.error('firm_members query error:', JSON.stringify(error))
  }

  let rosterError = false
  if (error) {
    console.error('Failed to load firm members', error)
    rosterError = true
  }

  let memberRows: FirmMemberRow[] = []
  if (!rosterError) {
    const userIds = (members ?? [])
      .map((m) => m.user_id)
      .filter(Boolean) as string[]

    const { data: profileRows } = userIds.length
      ? await adminClient
          .from('profiles')
          .select('id, email')
          .in('id', userIds)
      : { data: [] }

    const emailMap = Object.fromEntries(
      (profileRows ?? []).map((p) => [p.id, p.email]),
    )

    memberRows = (members ?? []).map((m) => ({
      id: m.id,
      firm_role: m.firm_role,
      status: m.status,
      invited_at: m.invited_at,
      joined_at: m.joined_at,
      display_email: emailMap[m.user_id] ?? m.invited_email ?? 'Unknown',
    }))
  }

  return (
    <FirmClient
      firm_name={firmName ?? 'Firm'}
      firmTier={firmTier}
      seatCount={seatCount}
      members={memberRows}
      rosterError={rosterError}
    />
  )
}
