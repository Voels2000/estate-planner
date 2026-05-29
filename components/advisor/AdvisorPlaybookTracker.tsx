'use client'

import { useEffect } from 'react'
import { markPlaybookStep } from '@/lib/advisor/advisorPlaybookStorage'

type Props = {
  advisorId: string
  step: 1 | 2 | 3
}

/** Marks advisor first-client playbook progress (localStorage). Renders nothing. */
export function AdvisorPlaybookTracker({ advisorId, step }: Props) {
  useEffect(() => {
    if (!advisorId) return
    markPlaybookStep(advisorId, step)
  }, [advisorId, step])

  return null
}

export function markPlaybookRecommendationSent(advisorId: string | undefined): void {
  if (!advisorId) return
  markPlaybookStep(advisorId, 3)
}
