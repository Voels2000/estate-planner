'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PlanningTopicsList, type PlanningTopicRow } from '@/app/(dashboard)/_components/dashboard/PlanningTopicsList'

export function PlanningGapsSection({
  householdId,
  initialRecommendations,
}: {
  householdId: string
  initialRecommendations?: PlanningTopicRow[] | null
}) {
  const [recs, setRecs] = useState<PlanningTopicRow[]>(initialRecommendations ?? [])
  const [loading, setLoading] = useState(!initialRecommendations)
  const [refreshCount, setRefreshCount] = useState(0)
  void setRefreshCount

  useEffect(() => {
    if (refreshCount === 0) return
    async function load() {
      setLoading(true)
      const supabase = createClient()
      const { data } = await supabase.rpc('generate_estate_recommendations', {
        p_household_id: householdId,
      })
      if (data?.recommendations) setRecs(data.recommendations)
      setLoading(false)
    }
    load()
  }, [householdId, refreshCount])

  if (loading) {
    return <div className="text-xs text-neutral-400 py-2">Loading common planning topics...</div>
  }

  return <PlanningTopicsList topics={recs} />
}
