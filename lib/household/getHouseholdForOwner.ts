import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'

/** Full household row for dashboard body — deduped within a single request via React.cache(). */
export const getFullHouseholdForOwner = cache(async (ownerId: string) => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('households')
    .select('*')
    .eq('owner_id', ownerId)
    .maybeSingle()

  if (error) {
    console.error('[getFullHouseholdForOwner]', error.message)
    return null
  }

  return data
})
