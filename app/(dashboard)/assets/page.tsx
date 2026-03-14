import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AssetsClient } from './_assets-client'

export default async function AssetsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: assets } = await supabase
    .from('assets')
    .select('id, owner_id, type, name, value, details, created_at, updated_at')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false })

  const rows = (assets ?? []).map((row) => ({
    id: row.id,
    owner_id: row.owner_id,
    type: row.type,
    name: row.name ?? '',
    value: Number(row.value ?? 0),
    details: row.details as Record<string, unknown> | null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }))

  return (
    <div className="p-6 md:p-8">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        Assets
      </h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        View and manage your assets.
      </p>
      <AssetsClient assets={rows} ownerId={user.id} />
    </div>
  )
}
