'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { EstateExecutionItem } from '@/lib/dashboard/buildEstateExecutionChecklist'

interface EstateExecutionChecklistProps {
  items: EstateExecutionItem[]
  userTier: number
  onToggle?: (taskKey: string, completed: boolean) => Promise<void>
}

export function EstateExecutionChecklist({
  items,
  onToggle,
}: EstateExecutionChecklistProps) {
  const [toggling, setToggling] = useState<string | null>(null)

  const activeItems = items.filter((i) => i.status !== 'not_applicable')
  const completedCount = activeItems.filter(
    (i) => i.status === 'complete' || i.consumerChecked,
  ).length
  const totalCount = activeItems.length
  const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  const handleToggle = async (item: EstateExecutionItem) => {
    if (!onToggle) return
    setToggling(item.task_key)
    try {
      await onToggle(item.task_key, !item.consumerChecked)
    } finally {
      setToggling(null)
    }
  }

  return (
    <section className="rounded-xl border border-[color:var(--mwm-border)] bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-[color:var(--mwm-navy)]">
            Estate Plan Checklist
          </h2>
          <p className="mt-0.5 text-xs text-[color:var(--mwm-text-muted)]">
            {completedCount} of {totalCount} items complete
          </p>
        </div>
        <p
          className={`text-2xl font-bold ${
            pct === 100
              ? 'text-[color:var(--mwm-sage)]'
              : pct >= 50
                ? 'text-[color:var(--mwm-navy)]'
                : 'text-amber-600'
          }`}
        >
          {pct}%
        </p>
      </div>

      <div className="mb-5 h-1.5 rounded-full bg-neutral-100">
        <div
          className={`h-1.5 rounded-full transition-all ${
            pct === 100
              ? 'bg-[color:var(--mwm-sage)]'
              : pct >= 50
                ? 'bg-[color:var(--mwm-navy)]'
                : 'bg-amber-500'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="space-y-3">
        {items.map((item) => {
          const isDone = item.status === 'complete' || item.consumerChecked
          const isFlagged = item.status === 'flagged' && !isDone
          const isToggling = toggling === item.task_key

          return (
            <div
              key={item.task_key}
              className={`flex items-start gap-3 rounded-lg px-3 py-3 ${
                isFlagged
                  ? 'border border-red-100 bg-red-50/60'
                  : isDone
                    ? 'bg-green-50/40'
                    : 'bg-neutral-50/60'
              }`}
            >
              <button
                type="button"
                onClick={() => void handleToggle(item)}
                disabled={isToggling || !onToggle}
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors ${
                  isDone
                    ? 'border-[color:var(--mwm-sage)] bg-[color:var(--mwm-sage)] text-white'
                    : isFlagged
                      ? 'border-red-400'
                      : 'border-neutral-300 hover:border-[color:var(--mwm-navy)]'
                } ${isToggling ? 'opacity-50' : ''}`}
                aria-label={`Mark ${item.label} as ${isDone ? 'incomplete' : 'complete'}`}
              >
                {isDone && (
                  <svg
                    className="h-3 w-3"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={3}
                    aria-hidden
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
                {isFlagged && !isDone && (
                  <span className="text-xs font-bold text-red-500">!</span>
                )}
              </button>

              <div className="min-w-0 flex-1">
                <p
                  className={`text-sm font-medium ${
                    isDone
                      ? 'text-neutral-400 line-through'
                      : isFlagged
                        ? 'text-red-700'
                        : 'text-neutral-900'
                  }`}
                >
                  {item.label}
                </p>
                {!isDone && (
                  <p className="mt-0.5 text-xs leading-relaxed text-neutral-500">
                    {item.description}
                  </p>
                )}
              </div>

              {!isDone && (
                <Link
                  href={item.link}
                  className={`shrink-0 whitespace-nowrap text-xs font-medium transition-colors ${
                    isFlagged
                      ? 'text-red-600 hover:text-red-800'
                      : 'text-[color:var(--mwm-navy)] hover:text-[color:var(--mwm-gold)]'
                  }`}
                >
                  {item.linkLabel} →
                </Link>
              )}
            </div>
          )
        })}
      </div>

      {pct === 100 && totalCount > 0 && (
        <div className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-center">
          <p className="text-sm font-semibold text-green-700">Estate plan checklist complete</p>
          <p className="mt-0.5 text-xs text-green-600">
            Review annually or after major life events.
          </p>
        </div>
      )}
    </section>
  )
}
