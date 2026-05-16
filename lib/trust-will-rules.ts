export type ProfileData = {
  /** Gross estate: financial assets + RE equity + business + non-ILIT insurance (aligned with dashboard). */
  estateValue: number
  isMarried: boolean
  hasMinorChildren: boolean
  domicileRisk: 'low' | 'moderate' | 'high' | 'critical'
  hasExistingTrust: boolean
  hasBusinessInterests: boolean
}

export type Recommendation = {
  title: string
  description: string
  priority: 'high' | 'medium' | 'low'
}

export type ChecklistItem = {
  task: string
  completed: boolean
}

export function getTrustWillRecommendations(profile: ProfileData): Recommendation[] {
  const recommendations: Recommendation[] = []

  // Estate tax exposure
  if (profile.estateValue >= 13_610_000) {
    recommendations.push({
      title: 'Irrevocable Trust',
      description:
        'Estates above the federal exemption often discuss irrevocable trusts with counsel to explore whether moving assets out of the taxable estate may be appropriate.',
      priority: 'high',
    })
  }

  // Revocable living trust for probate avoidance
  if (profile.domicileRisk === 'high' || profile.domicileRisk === 'critical') {
    recommendations.push({
      title: 'Revocable Living Trust',
      description:
        'In states with complex or costly probate, many families review a revocable living trust with an attorney as one way assets may pass outside probate.',
      priority: 'high',
    })
  }

  // Minor children
  if (profile.hasMinorChildren) {
    recommendations.push({
      title: 'Testamentary Trust',
      description:
        'Families with minor children often discuss testamentary trusts in a will so inheritance can be managed until children reach adulthood.',
      priority: 'high',
    })
  }

  // Married couples
  if (profile.isMarried) {
    recommendations.push({
      title: 'Pour-Over Will',
      description:
        'Married couples commonly pair a living trust with a pour-over will so assets not yet titled to the trust may be directed into it at death.',
      priority: 'medium',
    })
  }

  // Business interests
  if (profile.hasBusinessInterests) {
    recommendations.push({
      title: 'Business Succession Trust',
      description:
        'When business interests are present, owners often review succession trusts or buy-sell agreements with counsel to address continuity and heirs.',
      priority: 'medium',
    })
  }

  // Everyone should have a basic will
  if (!profile.hasExistingTrust) {
    recommendations.push({
      title: 'Last Will & Testament',
      description:
        'A last will and testament is a foundational document many estate plans include—for beneficiaries, an executor, and guardians when applicable.',
      priority: recommendations.length === 0 ? 'high' : 'low',
    })
  }

  return recommendations.sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 }
    return order[a.priority] - order[b.priority]
  })
}

export function getTrustWillChecklist(profile: ProfileData): ChecklistItem[] {
  const items: ChecklistItem[] = [
    { task: 'Schedule a consultation with an estate planning attorney', completed: false },
    { task: 'Gather a complete list of all assets and their current titling', completed: false },
    { task: 'Review and update all beneficiary designations', completed: false },
    { task: 'Decide on an executor for your will', completed: false },
  ]

  if (profile.hasMinorChildren) {
    items.push({ task: 'Name a guardian for your minor children in your will', completed: false })
  }

  if (profile.isMarried) {
    items.push({ task: 'Review joint ownership arrangements with your spouse', completed: false })
  }

  if (profile.hasBusinessInterests) {
    items.push({ task: 'Review business ownership documents and succession plan', completed: false })
  }

  items.push({ task: 'Execute a Healthcare Proxy and Power of Attorney', completed: false })
  items.push({ task: 'Store all documents in a secure, accessible location', completed: false })

  return items
}
