import { getAccessContext } from '@/lib/access/getAccessContext'
import { createClient } from '@/lib/supabase/server'

export default async function DebugHouseholdPage() {
  const { user } = await getAccessContext()

  let householdRow: { id: string } | null = null
  if (user) {
    const supabase = await createClient()
    const { data } = await supabase
      .from('households')
      .select('id')
      .eq('owner_id', user.id)
      .maybeSingle()
    householdRow = data
  }

  const body = {
    user: user ? { id: user.id } : null,
    householdRow,
    hasHousehold: householdRow != null,
  }

  return (
    <pre className="p-4 font-mono text-sm">
      {JSON.stringify(body, null, 2)}
    </pre>
  )
}
