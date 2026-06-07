import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getAccessContext } from '@/lib/access/getAccessContext'
import { requireHouseholdRecord } from '@/lib/estate/requireMinimumProfile'
import { ConsumerDocumentVault } from '@/components/consumer/ConsumerDocumentVault'

export default async function DocumentsVaultPage() {
  const { user, isSuperuser } = await getAccessContext()
  if (!user) redirect('/login')

  const supabase = await createClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, consumer_tier, subscription_status')
    .eq('id', user.id)
    .single()

  if (!isSuperuser && profile?.role === 'attorney') redirect('/attorney')
  if (!isSuperuser && profile?.role === 'advisor') redirect('/advisor')

  const { data: household } = await supabase
    .from('households')
    .select('id')
    .eq('owner_id', user.id)
    .maybeSingle()

  requireHouseholdRecord(household, '/settings/documents')

  const { data: attorneyLink } = await supabase
    .from('attorney_clients')
    .select('attorney_id')
    .eq('client_id', household.id)
    .in('status', ['active', 'accepted'])
    .order('granted_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data: docRows } = await supabase
    .from('legal_documents')
    .select('id, document_type, file_name, version, is_current, uploader_role, created_at')
    .eq('household_id', household.id)
    .eq('is_deleted', false)
    .eq('is_current', true)
    .order('document_type', { ascending: true })

  const documents = (docRows ?? []).map((doc) => ({
    id: doc.id,
    document_type: doc.document_type,
    file_name: doc.file_name,
    version: doc.version,
    is_current: doc.is_current,
    uploader_role: doc.uploader_role,
    uploaded_at: doc.created_at,
  }))

  return (
    <div className="max-w-3xl mx-auto py-10 px-4">
      <h1 className="text-2xl font-semibold text-[color:var(--mwm-navy)] mb-1">Document vault</h1>
      <p className="text-sm text-[color:var(--mwm-text-secondary)] mb-8">
        Upload and manage PDF copies of your estate planning documents.
      </p>
      <ConsumerDocumentVault
        householdId={household.id}
        linkedAttorneyId={attorneyLink?.attorney_id ?? null}
        documents={documents}
        subscriptionStatus={profile?.subscription_status ?? null}
        consumerTier={profile?.consumer_tier ?? null}
      />
    </div>
  )
}
