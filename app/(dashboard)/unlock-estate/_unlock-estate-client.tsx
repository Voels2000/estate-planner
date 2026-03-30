'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { CompletionScore } from '@/lib/get-completion-score'

export function UnlockEstateClient({ score }: { score: CompletionScore }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const pct = Math.round((score.completed / score.total) * 100)
  const canUnlock = score.unlocked

  async function handleUnlock() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/unlock-estate', { method: 'POST' })
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean
        already_unlocked?: boolean
        error?: string
      }
      if (res.ok && (data.success || data.already_unlocked)) {
        router.push('/titling')
        router.refresh()
        return
      }
      setError(
        typeof data.error === 'string'
          ? data.error
          : 'Unable to unlock. Please try again.'
      )
    } catch {
      setError('Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  const remaining = Math.max(0, score.threshold - score.completed)

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-neutral-900">
          Unlock Estate Planning
        </h1>
        <p className="mt-2 text-neutral-500">
          Complete {score.threshold} of {score.total} Retirement Planning steps to unlock Estate Planning features.
        </p>
      </div>

      {/* Progress bar */}
      <div className="mb-8 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium text-neutral-700">
            {score.completed} of {score.total} complete
          </span>
          <span
            className={`text-sm font-semibold ${canUnlock ? 'text-green-600' : 'text-indigo-600'}`}
          >
            {pct}%
          </span>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-neutral-100">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              canUnlock ? 'bg-green-500' : 'bg-indigo-500'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
        {canUnlock && (
          <p className="mt-3 text-sm font-medium text-green-600">
            You&apos;ve met the threshold — Estate Planning is ready to unlock!
          </p>
        )}
      </div>

      {/* Checklist */}
      <div className="mb-8 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
        {score.items.map((item, i) => (
          <div
            key={item.key}
            className={`flex items-start gap-4 px-6 py-4 ${
              i < score.items.length - 1 ? 'border-b border-neutral-100' : ''
            }`}
          >
            <div
              className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                item.completed ? 'bg-green-100 text-green-600' : 'bg-neutral-100 text-neutral-400'
              }`}
            >
              {item.completed ? '✓' : '○'}
            </div>

            <div className="min-w-0 flex-1">
              <p
                className={`text-sm font-medium ${
                  item.completed ? 'text-neutral-900' : 'text-neutral-600'
                }`}
              >
                {item.label}
              </p>
              {!item.completed && (
                <p className="mt-0.5 text-xs text-neutral-400">{item.description}</p>
              )}
            </div>

            {!item.completed && (
              <Link
                href={item.href}
                className="shrink-0 rounded-lg bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-600 transition hover:bg-indigo-100"
              >
                Go →
              </Link>
            )}
          </div>
        ))}
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={() => void handleUnlock()}
        disabled={!canUnlock || loading}
        className={`w-full rounded-xl px-6 py-3 text-sm font-medium transition ${
          canUnlock
            ? 'bg-neutral-900 text-white hover:bg-neutral-700'
            : 'cursor-not-allowed bg-neutral-100 text-neutral-400'
        }`}
      >
        {loading
          ? 'Unlocking…'
          : canUnlock
            ? 'Unlock Estate Planning'
            : `Complete ${remaining} more step${remaining === 1 ? '' : 's'} to unlock`}
      </button>
    </div>
  )
}
