// Sprint 61 — Consumer alert center
// Displays active household alerts grouped by severity.
// High severity first. Dismiss button for info alerts only.
// Mounts below health score on consumer dashboard.

'use client'

import React, { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import type { HouseholdAlert } from '@/lib/alerts/evaluateAlerts'
import { loadHouseholdAlerts, dismissAlert, evaluateAlerts } from '@/lib/alerts/evaluateAlerts'

// ─── Severity config ──────────────────────────────────────────────────────────

const SEVERITY_CONFIG = {
  high: {
    icon: '⚠️',
    badge: 'bg-red-100 text-red-700 border-red-200',
    border: 'border-l-red-500',
    label: 'High priority',
  },
  medium: {
    icon: '○',
    badge: 'bg-amber-100 text-amber-700 border-amber-200',
    border: 'border-l-amber-400',
    label: 'Recommended',
  },
  low: {
    icon: 'ℹ️',
    badge: 'bg-blue-100 text-blue-700 border-blue-200',
    border: 'border-l-blue-300',
    label: 'Information',
  },
}

// ─── Single alert card ────────────────────────────────────────────────────────

function AlertCard({
  alert,
  userId,
  onDismissed,
}: {
  alert: HouseholdAlert
  userId: string
  onDismissed: (id: string) => void
}) {
  const [dismissing, setDismissing] = useState(false)
  const config = SEVERITY_CONFIG[alert.severity as keyof typeof SEVERITY_CONFIG] ?? SEVERITY_CONFIG.low
  const canDismiss = alert.alert_type === 'info'

  const handleDismiss = async () => {
    setDismissing(true)
    const ok = await dismissAlert(alert.id, userId)
    if (ok) onDismissed(alert.id)
    setDismissing(false)
  }

  return (
    <div className={`border-l-4 ${config.border} bg-white px-4 py-4 rounded-r-xl border border-neutral-100`}>
      <div className="flex items-start gap-3">
        <span className="text-lg shrink-0 mt-0.5">{config.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold text-neutral-900">{alert.title}</p>
            <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full border font-medium ${config.badge}`}>
              {config.label}
            </span>
          </div>
          <p className="text-sm text-neutral-600 mt-1 leading-relaxed">{alert.description}</p>
          <div className="flex items-center gap-3 mt-3">
            {alert.action_href && (
              <Link
                href={alert.action_href}
                className="text-xs font-medium text-indigo-600 hover:text-indigo-800 hover:underline"
              >
                {alert.action_label ?? 'Take action'} →
              </Link>
            )}
            {canDismiss && (
              <button
                onClick={handleDismiss}
                disabled={dismissing}
                className="text-xs text-neutral-400 hover:text-neutral-600 disabled:opacity-50"
              >
                {dismissing ? 'Dismissing…' : 'Dismiss'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main alert center ────────────────────────────────────────────────────────

interface Props {
  householdId: string
  userId: string
  runEvaluation?: boolean // set true to trigger evaluation on mount
}

export default function AlertCenter({ householdId, userId, runEvaluation = false }: Props) {
  const [alerts, setAlerts] = useState<HouseholdAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [evaluating, setEvaluating] = useState(false)

  const load = useCallback(async () => {
    const data = await loadHouseholdAlerts(householdId)
    setAlerts(data)
  }, [householdId])

  useEffect(() => {
    async function init() {
      setLoading(true)
      try {
        if (runEvaluation) {
          setEvaluating(true)
          const result = await evaluateAlerts(householdId, userId)
          console.log('Evaluation result:', result)
          setEvaluating(false)
        }
        await load()
      } catch (e) {
        console.error('AlertCenter init error:', e)
      } finally {
        setEvaluating(false)
        setLoading(false)
      }
    }
    init()
  }, [householdId, userId, runEvaluation, load])

  const handleDismissed = (id: string) => {
    setAlerts(prev => prev.filter(a => a.id !== id))
  }

  console.log('AlertCenter state:', { loading, evaluating, alertCount: alerts.length, alerts })

  // Group by severity
  const highAlerts = alerts.filter(a => a.severity === 'high')
  const mediumAlerts = alerts.filter(a => a.severity === 'medium')
  const lowAlerts = alerts.filter(a => a.severity === 'low')

  const totalCount = alerts.length
  const highCount = highAlerts.length

  return (
    <div suppressHydrationWarning>
      {loading || evaluating ? (
        <div className="mb-8 bg-white rounded-2xl border border-neutral-200 shadow-sm p-6">
          <div className="flex items-center gap-2 text-sm text-neutral-400">
            <div className="w-4 h-4 border-2 border-neutral-200 border-t-neutral-400 rounded-full animate-spin" />
            {evaluating ? 'Checking your estate plan…' : 'Loading alerts…'}
          </div>
        </div>
      ) : alerts.length === 0 ? null : (
        <div className="mb-8 bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
          {/* Header */}
          <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-semibold text-neutral-900">Estate Planning Alerts</h2>
              {highCount > 0 && (
                <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700">
                  {highCount} high priority
                </span>
              )}
              {highCount === 0 && totalCount > 0 && (
                <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                  {totalCount} item{totalCount !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={load}
              className="text-xs text-neutral-400 hover:text-neutral-600"
            >
              Refresh
            </button>
          </div>

          {/* Alerts */}
          <div className="p-4 space-y-3">
            {[...highAlerts, ...mediumAlerts, ...lowAlerts].map(alert => (
              <AlertCard
                key={alert.id}
                alert={alert}
                userId={userId}
                onDismissed={handleDismissed}
              />
            ))}
          </div>

          {/* Footer */}
          <div className="px-6 py-3 border-t border-neutral-100 text-xs text-neutral-400">
            High and warning alerts cannot be dismissed — they resolve automatically when the underlying issue is corrected.
          </div>
        </div>
      )}
    </div>
  )
}
