import { EVENT_SLUGS } from '@/lib/events/content'

export const VALID_LIFE_EVENT_TYPES = new Set<string>(EVENT_SLUGS)

export function isValidLifeEventType(eventType: string): boolean {
  return VALID_LIFE_EVENT_TYPES.has(eventType)
}
