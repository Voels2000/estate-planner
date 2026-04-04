import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getAccessContext } from '@/lib/access/getAccessContext'
import { AttorneyAccessClient } from './_attorney-access-client'

export default async function AttorneyAccessPage() {
  const { user, isSuperuser } = await getAccessContext()
  if (!user) redirect('/login')

  const supabase = await createClient()

  // ── Confirm caller is a consumer ───────────────────────────
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!isSuperuser) {
    if (profile?.role === 'attorney') redirect('/attorney')
  }

  // ── Get consumer's household ───────────────────────────────
  const { data: household } = await supabase
    .from('households')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (!household) redirect('/profile')

  // ── Fetch all active attorney connections ──────────────────
  const { data: connections } = await supabase
    .from('attorney_clients')
    .select(`
      id,
      attorney_id,
      status,
      granted_at,
      advisor_pdf_access,
      advisor_pdf_access_granted_at
    `)
    .eq('client_id', household.id)
    .in('status', ['active', 'accepted'])
    .order('granted_at', { ascending: false })

  // ── Fetch attorney listing details for each connection ─────
  const attorneyIds = (connections ?? []).map((c) => c.attorney_id).filter(Boolean)

  const { data: attorneyListings } =
    attorneyIds.length > 0
      ? await supabase
          .from('attorney_listings')
          .select('id, contact_name, firm_name, email, state')
          .in('id', attorneyIds)
      : { data: [] }

  // ── Fetch advisor connection for PDF access toggle ─────────
  const { data: advisorConnection } = await supabase
    .from('advisor_clients')
    .select('id, advisor_pdf_access')
    .eq('client_id', user.id)
    .eq('status', 'active')
    .maybeSingle()

  // ── Shape data ─────────────────────────────────────────────
  const attorneyConnections = (connections ?? []).map((conn) => {
    const listing = (attorneyListings ?? []).find((a) => a.id === conn.attorney_id)
    return {
      connection_id: conn.id,
      attorney_id: conn.attorney_id,
      contact_name: listing?.contact_name ?? 'Unknown Attorney',
      firm_name: listing?.firm_name ?? '',
      email: listing?.email ?? '',
      state: listing?.state ?? '',
      granted_at: conn.granted_at,
      advisor_pdf_access: conn.advisor_pdf_access ?? false,
      advisor_pdf_access_granted_at: conn.advisor_pdf_access_granted_at,
    }
  })

  return (
    <div className="max-w-2xl mx-auto py-10 px-4">
      <h1 className="text-2xl font-semibold text-gray-900 mb-1">My Attorney</h1>
      <p className="text-sm text-gray-500 mb-8">
        Manage which attorneys can view your estate plan and documents. You can revoke access at
        any time.
      </p>
      <AttorneyAccessClient
        attorneyConnections={attorneyConnections}
        advisorConnectionId={advisorConnection?.id ?? null}
        advisorPdfAccess={advisorConnection?.advisor_pdf_access ?? false}
        householdId={household.id}
      />
    </div>
  )
}
