// Sprint 67 — Revocable Trust Strategy Module
// A revocable trust (living trust) does NOT remove assets from the gross estate —
// the grantor retains full control and the trust assets are included at death.
// Primary planning benefits: probate avoidance, privacy, continuity of management.
// This module applies advisory notes and flags when clients have revocable trusts
// but are missing complementary strategies (e.g. no pour-over will, no funding).

import { ProjectionScenario } from '@/lib/types/projection-scenario'

export interface RevocableTrustConfig {
  // Estimated value of assets held in the revocable trust
  trustFundedAmount: number
  // Total gross estate for context
  grossEstate: number
  // Whether a pour-over will exists
  hasPourOverWill: boolean
  // Whether the trust is fully funded (assets retitled)
  isFunded: boolean
  // Whether a successor trustee is named
  hasSuccessorTrustee: boolean
}

export interface RevocableTrustResult {
  // Revocable trust does NOT reduce estate tax — this is always 0
  estateTaxReduction: number
  // Percentage of estate held in trust
  trustFundingPct: number
  // Advisory notes to surface to the advisor
  advisoryNotes: string[]
  // Action items if trust is incomplete
  actionItems: string[]
  // Whether the trust is considered complete for health score purposes
  isComplete: boolean
}

export function applyRevocableTrust(
  scenario: ProjectionScenario,
  config: RevocableTrustConfig
): RevocableTrustResult {
  void scenario

  const {
    trustFundedAmount,
    grossEstate,
    hasPourOverWill,
    isFunded,
    hasSuccessorTrustee,
  } = config

  const advisoryNotes: string[] = []
  const actionItems: string[] = []

  // Core advisory note — always include
  advisoryNotes.push(
    'A revocable living trust does not reduce federal or state estate taxes. ' +
    'Assets in a revocable trust are fully included in the gross estate at death.'
  )

  const trustFundingPct = grossEstate > 0 ? (trustFundedAmount / grossEstate) * 100 : 0

  if (trustFundingPct < 80 && isFunded) {
    advisoryNotes.push(
      `Trust is funded at approximately ${trustFundingPct.toFixed(0)}% of gross estate. ` +
      'Consider retitling remaining assets to ensure full probate avoidance.'
    )
  }

  if (!isFunded) {
    actionItems.push('Trust has not been funded — assets must be retitled to the trust to be effective.')
  }

  if (!hasPourOverWill) {
    actionItems.push('No pour-over will detected. Assets not in the trust at death will pass through probate.')
  }

  if (!hasSuccessorTrustee) {
    actionItems.push('No successor trustee named. Designate a successor trustee to ensure continuity.')
  }

  if (grossEstate > 5_000_000) {
    advisoryNotes.push(
      'For estates above $5M, a revocable trust alone does not address estate tax exposure. ' +
      'Consider combining with an irrevocable trust strategy (CST, SLAT, or ILIT).'
    )
  }

  const isComplete = isFunded && hasPourOverWill && hasSuccessorTrustee

  return {
    estateTaxReduction: 0, // Revocable trust never reduces estate tax
    trustFundingPct,
    advisoryNotes,
    actionItems,
    isComplete,
  }
}
