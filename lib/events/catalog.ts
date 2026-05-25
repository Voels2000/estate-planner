import { EVENT_CONTENT, EVENT_SLUGS } from './content'
import type { EventCategory, EventContent } from './types'

/** Public hub + in-app picker groupings (maps content.ts categories). */
export const EVENT_HUB_GROUPS = [
  {
    key: 'business-wealth',
    label: 'Business & Wealth',
    categories: ['business', 'wealth'] satisfies EventCategory[],
  },
  {
    key: 'family',
    label: 'Family & Relationships',
    categories: ['family'] satisfies EventCategory[],
  },
  {
    key: 'health-retirement',
    label: 'Health & Retirement',
    categories: ['health', 'retirement'] satisfies EventCategory[],
  },
] as const

export function getAllEventContent(): EventContent[] {
  return EVENT_SLUGS.map((slug) => EVENT_CONTENT[slug])
}

export function getEventsGroupedForHub(): Array<{
  key: string
  label: string
  events: EventContent[]
}> {
  return EVENT_HUB_GROUPS.map((group) => ({
    key: group.key,
    label: group.label,
    events: getAllEventContent().filter((event) =>
      (group.categories as readonly EventCategory[]).includes(event.category),
    ),
  }))
}

export type RelevanceHousehold = {
  hasBusinessInterests: boolean
  hasRealEstate: boolean
  primaryAge: number | null
}

export function sortEventsByRelevance(
  events: EventContent[],
  household: RelevanceHousehold,
): EventContent[] {
  const { hasBusinessInterests, hasRealEstate, primaryAge } = household

  const scoreEvent = (event: EventContent): number => {
    let score = 0
    const slug = event.slug

    if (hasBusinessInterests) {
      if (slug.includes('business')) score += 3
    }

    if (hasRealEstate) {
      if (slug.includes('real-estate') || slug.includes('home')) score += 2
    }

    if (primaryAge != null && primaryAge > 55) {
      if (
        slug.includes('retirement') ||
        slug.includes('rmd') ||
        slug.includes('medicare') ||
        slug.includes('social-security')
      ) {
        score += 2
      }
    }

    return score
  }

  return [...events].sort((a, b) => scoreEvent(b) - scoreEvent(a))
}

export function filterEventsByQuery(events: EventContent[], query: string): EventContent[] {
  const q = query.trim().toLowerCase()
  if (!q) return events

  return events.filter(
    (event) =>
      event.title.toLowerCase().includes(q) ||
      event.heroLine.toLowerCase().includes(q) ||
      event.slug.toLowerCase().includes(q),
  )
}
