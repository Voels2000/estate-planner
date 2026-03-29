export type ProfileData = {
  estateValue: number          // total assets minus liabilities
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
      description: 'Your estate may be subject to federal estate tax. An irrevocable trust can remove assets from your taxable estate.',
      priority: 'high',
    })
  }

  // Revocable living trust for probate avoidance
  if (profile.domicileRisk === 'high' || profile.domicileRisk === 'critical') {
    recommendations.push({
      title: 'Revocable Living Trust',
      description: 'Your state has a complex or expensive probate process. A revocable living trust allows assets to pass to heirs without going through probate.',
      priority: 'high',
    })
  }

  // Minor children
  if (profile.hasMinorChildren) {
    recommendations.push({
      title: 'Testamentary Trust',
      description: 'You have minor children. A testamentary trust inside your will ensures their inheritance is managed responsibly until they reach adulthood.',
      priority: 'high',
    })
  }

  // Married couples
  if (profile.isMarried) {
    recommendations.push({
      title: 'Pour-Over Will',
      description: 'A pour-over will works alongside a living trust to ensure any assets not yet in your trust are transferred into it upon your death.',
      priority: 'medium',
    })
  }

  // Business interests
  if (profile.hasBusinessInterests) {
    recommendations.push({
      title: 'Business Succession Trust',
      description: 'You have business interests that may need special handling. A succession trust or buy-sell agreement can protect your business and heirs.',
      priority: 'medium',
    })
  }

  // Everyone should have a basic will
  if (!profile.hasExistingTrust) {
    recommendations.push({
      title: 'Last Will & Testament',
      description: 'Every estate plan needs a will as its foundation. It names beneficiaries, appoints an executor, and designates guardians for minor children.',
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
