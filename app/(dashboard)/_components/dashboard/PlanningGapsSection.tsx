'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Recommendation = {
  branch: string
  priority: 'high' | 'moderate' | 'low'
  reason: string
}

export function PlanningGapsSection({
  householdId,
  initialRecommendations,
}: {
  householdId: string
  initialRecommendations?: Recommendation[] | null
}) {
  const [recs, setRecs] = useState<Recommendation[]>(initialRecommendations ?? [])
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

  if (loading) return <div className="text-xs text-neutral-400 py-2">Loading planning gaps...</div>

  if (recs.length === 0) return <div className="text-xs text-neutral-500 py-2">No planning gaps identified.</div>

  const high = recs.filter((r) => r.priority === 'high')
  const moderate = recs.filter((r) => r.priority === 'moderate')

  const branchLabels: Record<string, string> = {
    will: 'Will',
    dpoa: 'Durable Power of Attorney',
    healthcare_directive: 'Healthcare Directive',
    revocable_living_trust: 'Revocable Living Trust',
    pour_over_will: 'Pour-Over Will',
    bypass_trust: 'Bypass Trust (Credit Shelter)',
    ilit: 'Irrevocable Life Insurance Trust (ILIT)',
    gifting_strategy: 'Annual Gifting Strategy',
  }

  const priorityBorder: Record<string, string> = {
    high: 'border-l-red-500',
    moderate: 'border-l-yellow-500',
    low: 'border-l-green-500',
  }

  return (
    <div className="space-y-3">
      {high.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-red-600 uppercase tracking-wide mb-2">High Priority</p>
          <div className="space-y-2">
            {high.map((rec) => (
              <div key={rec.branch} className={`p-3 bg-gray-50 rounded-lg border-l-4 ${priorityBorder[rec.priority]}`}>
                <p className="text-sm font-semibold text-gray-900">{branchLabels[rec.branch] ?? rec.branch}</p>
                <p className="text-sm text-gray-600 mt-0.5">{rec.reason}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      {moderate.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-yellow-600 uppercase tracking-wide mb-2">Moderate Priority</p>
          <div className="space-y-2">
            {moderate.map((rec) => (
              <div key={rec.branch} className={`p-3 bg-gray-50 rounded-lg border-l-4 ${priorityBorder[rec.priority]}`}>
                <p className="text-sm font-semibold text-gray-900">{branchLabels[rec.branch] ?? rec.branch}</p>
                <p className="text-sm text-gray-600 mt-0.5">{rec.reason}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
