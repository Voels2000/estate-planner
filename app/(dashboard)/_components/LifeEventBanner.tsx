'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getEventContent } from '@/lib/events/content'
import {
  EVENT_HUB_GROUPS,
  filterEventsByQuery,
  getAllEventContent,
  sortEventsByRelevance,
  type RelevanceHousehold,
} from '@/lib/events/catalog'

export type LifeEvent = {
  id: string
  event_type: string
  source: string
  acknowledged: boolean
  created_at: string
}

export type LoggedLifeEvent = {
  id: string
  event_type: string
  created_at: string
}

type Props = {
  pendingEvents: LifeEvent[]
  loggedEvents?: LoggedLifeEvent[]
  hasAdvisorConnection?: boolean
  relevanceHousehold?: RelevanceHousehold
}

export function LifeEventBanner({
  pendingEvents,
  loggedEvents = [],
  hasAdvisorConnection = false,
  relevanceHousehold = {
    hasBusinessInterests: false,
    hasRealEstate: false,
    primaryAge: null,
  },
}: Props) {
  const router = useRouter()
  const [dismissed, setDismissed] = useState(false)
  const [showPicker, setShowPicker] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const sortedEvents = useMemo(
    () => sortEventsByRelevance(getAllEventContent(), relevanceHousehold),
    [relevanceHousehold],
  )

  const filteredEvents = useMemo(
    () => filterEventsByQuery(sortedEvents, searchQuery),
    [sortedEvents, searchQuery],
  )

  const groupedFiltered = useMemo(() => {
    return EVENT_HUB_GROUPS.map((group) => ({
      ...group,
      events: filteredEvents.filter((event) =>
        (group.categories as readonly string[]).includes(event.category),
      ),
    })).filter((group) => group.events.length > 0)
  }, [filteredEvents])

  const pendingCalendarEvent = pendingEvents.find((e) => e.source === 'calendar_trigger')

  async function handleAcknowledge(id: string) {
    await fetch('/api/consumer/life-events', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    router.refresh()
  }

  async function handleSelectEvent(slug: string) {
    if (submitting) return
    setSubmitting(true)
    try {
      await fetch('/api/consumer/life-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_type: slug }),
      })
      setShowPicker(false)
      setSearchQuery('')
      router.push(`/event/${slug}/assess`)
    } catch {
      // fail silently
    } finally {
      setSubmitting(false)
    }
  }

  function renderLoggedEventsList() {
    if (loggedEvents.length === 0) return null

    return (
      <div className="mt-3">
        <p className="text-xs text-neutral-500 font-medium mb-1">Events you&apos;ve logged</p>
        {loggedEvents.map((event) => {
          const title = getEventContent(event.event_type)?.title ?? event.event_type
          return (
            <div key={event.id} className="flex items-center justify-between py-1">
              <span className="text-sm text-neutral-700">{title}</span>
              <Link
                href={`/event/${event.event_type}`}
                className="text-xs text-indigo-600 hover:underline"
              >
                Review →
              </Link>
            </div>
          )
        })}
      </div>
    )
  }

  if (dismissed) return null

  if (pendingCalendarEvent) {
    const content = getEventContent(pendingCalendarEvent.event_type)
    const label = content?.title ?? pendingCalendarEvent.event_type

    return (
      <div>
        <div className="mt-4 mb-2 flex items-start justify-between gap-3 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3">
          <div className="flex items-start gap-3 min-w-0">
            <span className="mt-0.5 shrink-0 text-base">📅</span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-indigo-900">
                A planning milestone is coming up for you
              </p>
              <p className="mt-0.5 text-xs text-indigo-700">
                Based on your age, {label.toLowerCase()} planning decisions are now relevant.
                Review what may change in your picture.
              </p>
              <Link
                href={`/event/${pendingCalendarEvent.event_type}`}
                className="mt-1.5 inline-flex text-xs font-semibold text-indigo-700 underline-offset-2 hover:underline"
              >
                See what this means for your plan →
              </Link>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              void handleAcknowledge(pendingCalendarEvent.id)
              setDismissed(true)
            }}
            className="shrink-0 text-xs text-indigo-400 hover:text-indigo-600 leading-none"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
        {renderLoggedEventsList()}
      </div>
    )
  }

  if (showPicker) {
    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
        <div
          className="flex max-h-[92vh] sm:max-h-[85vh] w-full sm:max-w-2xl flex-col rounded-t-2xl sm:rounded-2xl border border-neutral-200 bg-white shadow-xl"
          role="dialog"
          aria-modal="true"
          aria-labelledby="life-event-picker-title"
        >
          <div className="flex items-start justify-between gap-3 border-b border-neutral-100 px-4 py-4 sm:px-6">
            <div>
              <h2 id="life-event-picker-title" className="text-base font-semibold text-neutral-900">
                What changed in your life?
              </h2>
              <p className="mt-1 text-xs text-neutral-500">
                Select a situation to open its readiness assessment.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setShowPicker(false)
                setSearchQuery('')
              }}
              className="shrink-0 text-xs text-neutral-400 hover:text-neutral-600 leading-none"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          <div className="border-b border-neutral-100 px-4 py-3 sm:px-6">
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search life events…"
              className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              autoFocus
            />
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 space-y-6">
            {groupedFiltered.length === 0 ? (
              <p className="text-sm text-neutral-500">No events match your search.</p>
            ) : (
              groupedFiltered.map((group) => (
                <section key={group.key}>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-2">
                    {group.label}
                  </h3>
                  <ul className="space-y-2">
                    {group.events.map((event) => (
                      <li key={event.slug}>
                        <button
                          type="button"
                          disabled={submitting}
                          onClick={() => void handleSelectEvent(event.slug)}
                          className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-3 text-left transition-colors hover:border-indigo-200 hover:bg-indigo-50/50 disabled:opacity-50"
                        >
                          <span className="block text-sm font-medium text-neutral-900">
                            {event.title}
                          </span>
                          <span className="mt-1 block text-xs leading-relaxed text-neutral-600">
                            {event.heroLine}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ))
            )}
          </div>

          <div className="border-t border-neutral-100 px-4 py-3 sm:px-6">
            <button
              type="button"
              onClick={() => {
                setShowPicker(false)
                setSearchQuery('')
              }}
              className="w-full rounded-lg border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="mt-4 mb-2 flex items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="shrink-0 text-base">⚡</span>
          <p className="text-sm text-neutral-600">
            Did something change in your life?{' '}
            <button
              type="button"
              onClick={() => setShowPicker(true)}
              className="font-medium text-indigo-600 hover:text-indigo-800 underline-offset-2 hover:underline"
            >
              Log a life event
            </button>
            {' '}and your plan can reflect what may need attention.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="shrink-0 text-xs text-neutral-400 hover:text-neutral-600 leading-none"
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
      {renderLoggedEventsList()}
      {!hasAdvisorConnection && loggedEvents.length > 0 && (
        <p className="mt-2 text-xs text-neutral-500">
          An advisor can help interpret event-specific planning gaps at your asset level.{' '}
          <Link href="/find-advisor" className="text-indigo-600 hover:underline">
            Find one →
          </Link>
        </p>
      )}
    </div>
  )
}
