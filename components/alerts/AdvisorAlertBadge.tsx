// Sprint 61 — Advisor client list alert badge + side panel
// Shows count of active high-severity alerts per client.
// Clicking opens a side panel with alert details and Review button.

'use client'

import React, { useState, useEffect } from 'react'
import type { HouseholdAlert } from '@/lib/alerts/evaluateAlerts'
import { loadHouseholdAlerts, markAlertReviewed } from '@/lib/alerts/evaluateAlerts'

// ─── Badge (for use in client list table) ────────────────────────────────────

interface BadgeProps {
  householdId: string
  onClick?: () => void
}

export function AdvisorAlertBadge({ householdId, onClick }: BadgeProps) {
  const [counts, setCounts] = useState<{ high: number; medium: number } | null>(null)

  useEffect(() => {
    loadHouseholdAlerts(householdId).then(alerts => {
      setCounts({
        high: alerts.filter(a => a.severity === 'high').length,
        medium: alerts.filter(a => a.severity === 'medium').length,
      })
    })
  }, [householdId])

  if (!counts) return null
  if (counts.high === 0 && counts.medium === 0) return null

  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1"
    >
      {counts.high > 0 && (
        <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-red-100 text-red-700 text-xs font-bold border border-red-200">
          {counts.high}
        </span>
      )}
      {counts.medium > 0 && (
        <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-amber-100 text-amber-700 text-xs font-bold border border-amber-200">
          {counts.medium}
        </span>
      )}
    </button>
  )
}

// ─── Alert side panel ─────────────────────────────────────────────────────────

interface PanelProps {
  householdId: string
  clientName: string
  onClose: () => void
}

export function AdvisorAlertPanel({ householdId, clientName, onClose }: PanelProps) {
  const [alerts, setAlerts] = useState<HouseholdAlert[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadHouseholdAlerts(householdId).then(data => {
      setAlerts(data)
      setLoading(false)
    })
  }, [householdId])

  const handleReview = async (alertId: string) => {
    await markAlertReviewed(alertId)
    setAlerts(prev => prev.map(a =>
      a.id === alertId ? { ...a, is_reviewed: true } : a
    ))
  }

  const activeAlerts = alerts.filter(a => !a.is_reviewed)
  const reviewedAlerts = alerts.filter(a => a.is_reviewed)

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white shadow-2xl border-l border-neutral-200 flex flex-col">
      {/* Header */}
      <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-sm font-semibold text-neutral-900">Client Alerts</h2>
          <p className="text-xs text-neutral-500 mt-0.5">{clientName}</p>
        </div>
        <button
          onClick={onClose}
          className="text-neutral-400 hover:text-neutral-600 text-xl leading-none"
        >
          ×
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-neutral-400 py-8 justify-center">
            <div className="w-4 h-4 border-2 border-neutral-200 border-t-neutral-400 rounded-full animate-spin" />
            Loading alerts…
          </div>
        ) : activeAlerts.length === 0 && reviewedAlerts.length === 0 ? (
          <div className="text-center py-8 text-sm text-neutral-400">
            No active alerts for this client.
          </div>
        ) : (
          <div className="space-y-4">
            {/* Active alerts */}
            {activeAlerts.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">
                  Needs attention ({activeAlerts.length})
                </h3>
                <div className="space-y-3">
                  {activeAlerts.map(alert => (
                    <AlertRow
                      key={alert.id}
                      alert={alert}
                      onReview={handleReview}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Reviewed alerts */}
            {reviewedAlerts.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wide mb-2 mt-4">
                  Reviewed ({reviewedAlerts.length})
                </h3>
                <div className="space-y-2 opacity-60">
                  {reviewedAlerts.map(alert => (
                    <AlertRow key={alert.id} alert={alert} reviewed />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Alert row ────────────────────────────────────────────────────────────────

function AlertRow({
  alert,
  onReview,
  reviewed = false,
}: {
  alert: HouseholdAlert
  onReview?: (id: string) => void
  reviewed?: boolean
}) {
  const [marking, setMarking] = useState(false)

  const severityColors = {
    high: 'text-red-600 bg-red-50 border-red-200',
    medium: 'text-amber-600 bg-amber-50 border-amber-200',
    low: 'text-blue-600 bg-blue-50 border-blue-200',
  }

  const colorClass = severityColors[alert.severity as keyof typeof severityColors] ?? severityColors.low

  const handleReview = async () => {
    if (!onReview) return
    setMarking(true)
    await onReview(alert.id)
    setMarking(false)
  }

  return (
    <div className={`rounded-xl border p-3.5 ${colorClass}`}>
      <div className="flex items-start justify-between gap-2 mb-1">
        <p className="text-sm font-semibold text-neutral-900">{alert.title}</p>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${colorClass} shrink-0`}>
          {alert.severity}
        </span>
      </div>
      <p className="text-xs text-neutral-600 leading-relaxed mb-2">{alert.description}</p>
      {!reviewed && onReview && (
        <button
          onClick={handleReview}
          disabled={marking}
          className="text-xs font-medium text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
        >
          {marking ? 'Marking…' : '✓ Mark as reviewed'}
        </button>
      )}
      {reviewed && (
        <span className="text-xs text-neutral-400">✓ Reviewed</span>
      )}
    </div>
  )
}
