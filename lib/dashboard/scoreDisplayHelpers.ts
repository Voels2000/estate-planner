// Score-driven dashboard display helpers (presentation only — no score engine changes).

export function getBand(score: number): {
  label: string
  pillBg: string
  pillText: string
  fillColor: string
} {
  if (score >= 80) {
    return {
      label: 'Protected',
      pillBg: '#EAF3DE',
      pillText: '#27500A',
      fillColor: '#639922',
    }
  }
  if (score >= 60) {
    return {
      label: 'On track',
      pillBg: '#E6F1FB',
      pillText: '#0C447C',
      fillColor: '#378ADD',
    }
  }
  if (score >= 40) {
    return {
      label: 'Gaps exist',
      pillBg: '#FAEEDA',
      pillText: '#633806',
      fillColor: '#EF9F27',
    }
  }
  return {
    label: 'Action needed',
    pillBg: '#FCEBEB',
    pillText: '#791F1F',
    fillColor: '#E24B4A',
  }
}

export function getGreeting(score: number, firstName: string): { headline: string; sub: string } {
  if (score >= 80) {
    return {
      headline: `Your estate plan is well-protected, ${firstName}.`,
      sub: 'Keep documents current and review after major life events.',
    }
  }
  if (score >= 60) {
    return {
      headline: `Your household readiness looks strong, ${firstName}.`,
      sub: "One or two gaps to close — you're ahead of most households.",
    }
  }
  if (score >= 40) {
    return {
      headline: `Your plan has gaps worth closing, ${firstName}.`,
      sub: 'Addressing these now protects your family from delays and costs.',
    }
  }
  return {
    headline: `Your estate is not fully protected, ${firstName}.`,
    sub: 'Without basic documents, your family could face significant delays.',
  }
}

export function getAlertCTA(
  severity: string,
  score: number,
): {
  label: string
  bg: string
  text: string
} {
  if (severity === 'high' || score < 40) {
    return {
      label: 'Talk to an advisor today',
      bg: '#E24B4A',
      text: '#fff',
    }
  }
  if (severity === 'medium' || score < 60) {
    return {
      label: 'Learn more',
      bg: '#EF9F27',
      text: '#412402',
    }
  }
  return {
    label: 'Review this item',
    bg: '#378ADD',
    text: '#fff',
  }
}

export function getPctile(score: number): string {
  if (score >= 80) return 'ahead of ~90% of households'
  if (score >= 65) return 'ahead of ~75% of households'
  if (score >= 50) return 'ahead of ~60% of households'
  if (score >= 35) return 'ahead of ~40% of households'
  return 'below the average household'
}

/** Factual consequence for the priority alert (educational, not advice). */
export function getAlertFact(alertTitle: string, grossEstate: number): string | null {
  const t = (alertTitle ?? '').toLowerCase()
  const probateLow = Math.round(grossEstate * 0.02).toLocaleString()
  const probateHigh = Math.round(grossEstate * 0.04).toLocaleString()

  if (t.includes('trust') && (t.includes('no trust') || t.includes('without'))) {
    return `Probate on an estate this size typically costs $${probateLow}–$${probateHigh} in fees and takes 12–24 months.`
  }
  if (t.includes('beneficiary') && !t.includes('contingent')) {
    return `Accounts without a primary beneficiary pass through probate regardless of your will.`
  }
  if (t.includes('contingent')) {
    return `If the primary beneficiary predeceases you, assets with no contingent pass through probate.`
  }
  if (t.includes('titling') || t.includes('sole ownership')) {
    return `Assets in one spouse's name don't automatically flow into your trust — retitling protects them.`
  }
  return null
}

export const ALERT_SEVERITY_ORDER: Record<string, number> = {
  high: 0,
  medium: 1,
  low: 2,
}

export function sortOpenAlerts<
  T extends { severity: string; created_at: string },
>(alerts: T[]): T[] {
  return [...alerts].sort((a, b) => {
    const sa = ALERT_SEVERITY_ORDER[a.severity] ?? 3
    const sb = ALERT_SEVERITY_ORDER[b.severity] ?? 3
    if (sa !== sb) return sa - sb
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })
}
