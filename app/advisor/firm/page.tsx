import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAccessContext } from '@/lib/access/getAccessContext'
import FirmClient from './_firm-client'

export type FirmMemberRow = {
  id: string
  firm_role: string
  status: string
  invited_at: string | null
  joined_at: string | null
  email: string | null
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

  const supabase = await createClient()
  const { data: rawMembers, error } = await supabase
    .from('firm_members')
    .select(
      `
      id,
      firm_role,
      status,
      invited_at,
      joined_at,
      invited_email,
      profiles (
        email
      )
    `,
    )
    .eq('firm_id', firmId)
    .neq('status', 'removed')
    .order('joined_at', { ascending: true, nullsFirst: false })

  let rosterError = false
  if (error) {
    console.error('Failed to load firm members', error)
    rosterError = true
  }

  const members: FirmMemberRow[] = rosterError
    ? []
    : (rawMembers ?? []).map((row) => {
    const prof = row.profiles as { email: string | null } | { email: string | null }[] | null
    const emailFromProfile = Array.isArray(prof) ? prof[0]?.email ?? null : prof?.email ?? null
    return {
      id: row.id,
      firm_role: row.firm_role,
      status: row.status,
      invited_at: row.invited_at,
      joined_at: row.joined_at,
      email: emailFromProfile ?? row.invited_email ?? null,
    }
  })

  return (
    <FirmClient
      firm_name={firmName ?? 'Firm'}
      firmTier={firmTier}
      seatCount={seatCount}
      members={members}
      rosterError={rosterError}
    />
  )
}
