'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const EVENT_OPTIONS = [
  { value: 'selling-a-business', label: 'Selling a business' },
  { value: 'death-of-spouse', label: 'Death of a spouse' },
  { value: 'serious-diagnosis', label: 'Serious health diagnosis' },
  { value: 'receiving-inheritance', label: 'Receiving an inheritance' },
  { value: 'divorce', label: 'Divorce' },
  { value: 'approaching-retirement', label: 'Approaching retirement' },
  { value: 'large-rsu-vest', label: 'Large RSU vest or liquidity event' },
  { value: 'new-child-grandchild', label: 'New child or grandchild' },
]

export type LifeEvent = {
  id: string
  event_type: string
  source: string
  acknowledged: boolean
  created_at: string
}

type Props = {
  pendingEvents: LifeEvent[]
}

export function LifeEventBanner({ pendingEvents }: Props) {
  const router = useRouter()
  const [dismissed, setDismissed] = useState(false)
  const [showPicker, setShowPicker] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const pendingCalendarEvent = pendingEvents.find(e => e.source === 'calendar_trigger')

  async function handleAcknowledge(id: string) {
    await fetch('/api/consumer/life-events', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    router.refresh()
  }

  async function handleSubmit() {
    if (!selectedEvent) return
    setSubmitting(true)
    try {
      await fetch('/api/consumer/life-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_type: selectedEvent }),
      })
      setSubmitted(true)
      setShowPicker(false)
      router.refresh()
    } catch {
      // fail silently
    } finally {
      setSubmitting(false)
    }
  }

  if (dismissed) return null

  if (pendingCalendarEvent) {
    const label = EVENT_OPTIONS.find(
      e => e.value === pendingCalendarEvent.event_type,
    )?.label ?? pendingCalendarEvent.event_type

    return (
      <div className="mt-4 mb-2 flex items-start justify-between gap-3 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3">
        <div className="flex items-start gap-3 min-w-0">
          <span className="mt-0.5 shrink-0 text-base">📅</span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-indigo-900">
              A planning milestone is coming up for you
            </p>
            <p className="mt-0.5 text-xs text-indigo-700">
              Based on your age, {label.toLowerCase()} planning decisions
              are now relevant. Review what changes and what to do next.
            </p>
            <a
              href={`/event/${pendingCalendarEvent.event_type}`}
              className="mt-1.5 inline-flex text-xs font-semibold text-indigo-700 underline-offset-2 hover:underline"
            >
              See your action plan →
            </a>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            handleAcknowledge(pendingCalendarEvent.id)
            setDismissed(true)
          }}
          className="shrink-0 text-xs text-indigo-400 hover:text-indigo-600 leading-none"
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
    )
  }

  if (submitted) {
    const label = EVENT_OPTIONS.find(e => e.value === selectedEvent)?.label ?? selectedEvent
    return (
      <div className="mt-4 mb-2 flex items-start justify-between gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
        <div className="flex items-start gap-3 min-w-0">
          <span className="mt-0.5 shrink-0 text-base">✓</span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-green-900">
              Life event logged: {label}
            </p>
            <p className="mt-0.5 text-xs text-green-700">
              Your plan will reflect this event. See what changes and
              what to do next.
            </p>
            <a
              href={`/event/${selectedEvent}`}
              className="mt-1.5 inline-flex text-xs font-semibold text-green-700 underline-offset-2 hover:underline"
            >
              See your action plan →
            </a>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="shrink-0 text-xs text-green-400 hover:text-green-600 leading-none"
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
    )
  }

  if (showPicker) {
    return (
      <div className="mt-4 mb-2 rounded-xl border border-neutral-200 bg-white px-4 py-4 shadow-sm">
        <div className="flex items-start justify-between gap-3 mb-3">
          <p className="text-sm font-semibold text-neutral-900">
            What changed in your life?
          </p>
          <button
            type="button"
            onClick={() => setShowPicker(false)}
            className="shrink-0 text-xs text-neutral-400 hover:text-neutral-600 leading-none"
            aria-label="Cancel"
          >
            ✕
          </button>
        </div>
        <select
          value={selectedEvent}
          onChange={e => setSelectedEvent(e.target.value)}
          className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-900 mb-3 focus:outline-none focus:ring-2 focus:ring-indigo-400"
        >
          <option value="">Select a life event…</option>
          {EVENT_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!selectedEvent || submitting}
            className="inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? 'Saving…' : 'Log this event'}
          </button>
          <button
            type="button"
            onClick={() => setShowPicker(false)}
            className="inline-flex items-center rounded-lg border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
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
          {' '}and we&apos;ll update what needs attention in your plan.
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
  )
}
