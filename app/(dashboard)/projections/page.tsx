/**
 * Consumer projections page — server-prefetched data.
 * Route: `/projections`
 */

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { loadProjectionData } from '@/lib/projections/loadProjectionData'
import { mapProjectionRows } from '@/lib/projections/mappers/mapProjectionRows'
import type { HouseholdProjectionProfile } from '@/lib/projections/types'
import { ProjectionsClient } from './_projections-client'

export default async function ProjectionsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ household, rows }, { count: reCount }, { count: bizCount }] = await Promise.all([
    loadProjectionData(supabase, user.id),
    supabase.from('real_estate').select('id', { count: 'exact', head: true }).eq('owner_id', user.id),
    supabase.from('businesses').select('id', { count: 'exact', head: true }).eq('owner_id', user.id),
  ])
  const projections = household
    ? mapProjectionRows(rows, household as unknown as HouseholdProjectionProfile)
    : []

  return (
    <ProjectionsClient
      initialHousehold={(household as unknown as HouseholdProjectionProfile) ?? null}
      initialProjections={projections}
      hasRealEstate={(reCount ?? 0) > 0}
      hasBusiness={(bizCount ?? 0) > 0}
    />
  )
}
