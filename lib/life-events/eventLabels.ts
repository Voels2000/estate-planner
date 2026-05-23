import { EVENT_CONTENT } from '@/lib/events/content'

export function formatLifeEventLabel(eventType: string): string {
  return (
    EVENT_CONTENT[eventType]?.shortTitle ??
    EVENT_CONTENT[eventType]?.title ??
    eventType.replace(/-/g, ' ')
  )
}
