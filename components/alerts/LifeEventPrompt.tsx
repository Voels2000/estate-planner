// Sprint 61 — Life event intake prompts
// Contextual prompts triggered by profile changes:
//   - State change → domicile alert
//   - Marital status change → beneficiary review prompt
// Each prompt writes a household_alert row and shows inline.

'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

// ─── Types ────────────────────────────────────────────────────────────────────

type PromptType = 'state_change' | 'marital_status_change' | 'new_child'

interface LifeEventPromptProps {
  type: PromptType
  householdId: string
  context?: {
    priorState?: string
    newState?: string
    newMaritalStatus?: string
  }
  onDismiss?: () => void
}

// ─── Prompt content by type ───────────────────────────────────────────────────

function getPromptContent(type: PromptType, context: LifeEventPromptProps['context'] = {}) {
  switch (type) {
    case 'state_change':
      return {
        icon: '🏠',
        title: 'Your state has changed',
        body: `Your estate plan may reference ${context.priorState ?? 'your prior state'} law. Moving to ${context.newState ?? 'a new state'} can affect your estate tax exposure and document requirements. Here's what to review.`,
        actions: [
          { label: 'Review estate tax impact', href: '/estate-tax' },
          { label: 'Update domicile analysis', href: '/domicile-analysis' },
        ],
        alertRuleName: 'domicile_state_document_mismatch',
      }
    case 'marital_status_change':
      return {
        icon: '💍',
        title: 'Congratulations on your marriage',
        body: 'Would you like to review your beneficiary designations and trust structure for your new spouse? Outdated designations can cause unintended distributions.',
        actions: [
          { label: 'Review beneficiary designations', href: '/titling' },
          { label: 'Review trust structure', href: '/trust-will' },
        ],
        alertRuleName: 'beneficiary_review_overdue',
      }
    case 'new_child':
      return {
        icon: '👶',
        title: 'Update your estate plan for your new family member',
        body: 'You may want to review beneficiary designations and trust distribution provisions for your new family member. Trusts can include provisions for minors.',
        actions: [
          { label: 'Review beneficiary designations', href: '/titling' },
          { label: 'Review trust provisions', href: '/trust-will' },
        ],
        alertRuleName: 'beneficiary_review_overdue',
      }
  }
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function LifeEventPrompt({
  type,
  householdId,
  context = {},
  onDismiss,
}: LifeEventPromptProps) {
  const [dismissed, setDismissed] = useState(false)
  const [writing, setWriting] = useState(false)

  const content = getPromptContent(type, context)

  const handleWriteAlert = async () => {
    setWriting(true)
    const supabase = createClient()

    // Find the rule ID for this life event
    const { data: rule } = await supabase
      .from('alert_rules')
      .select('id')
      .eq('rule_name', content.alertRuleName)
      .single()

    if (rule) {
      await supabase.rpc('upsert_household_alert', {
        p_household_id: householdId,
        p_rule_id: rule.id,
        p_alert_type: 'action_required',
        p_severity: 'high',
        p_title: content.title,
        p_description: content.body,
        p_action_href: content.actions[0]?.href ?? null,
        p_action_label: content.actions[0]?.label ?? null,
        p_context_data: context,
      })
    }

    setWriting(false)
    setDismissed(true)
    onDismiss?.()
  }

  if (dismissed) return null

  return (
    <div className="mb-6 bg-indigo-50 border border-indigo-200 rounded-2xl p-5 shadow-sm">
      <div className="flex items-start gap-4">
        <span className="text-2xl shrink-0">{content.icon}</span>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-indigo-900 mb-1">{content.title}</h3>
          <p className="text-sm text-indigo-700 leading-relaxed mb-3">{content.body}</p>
          <div className="flex flex-wrap items-center gap-3">
            {content.actions.map(action => (
              <Link
                key={action.href}
                href={action.href}
                className="text-xs font-medium text-indigo-600 hover:text-indigo-800 border border-indigo-200 bg-white px-3 py-1.5 rounded-lg hover:bg-indigo-50 transition"
              >
                {action.label} →
              </Link>
            ))}
            <button
              onClick={handleWriteAlert}
              disabled={writing}
              className="text-xs text-indigo-400 hover:text-indigo-600 disabled:opacity-50"
            >
              {writing ? 'Saving…' : 'Add to my alerts'}
            </button>
            <button
              onClick={() => { setDismissed(true); onDismiss?.() }}
              className="text-xs text-neutral-400 hover:text-neutral-600 ml-auto"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Hook: detect life events from profile changes ────────────────────────────
// Use this in settings/profile pages to show the appropriate prompt
// after a save.

export function useLifeEventDetection() {
  const [pendingPrompt, setPendingPrompt] = useState<{
    type: PromptType
    context: LifeEventPromptProps['context']
  } | null>(null)

  const checkStateChange = (priorState: string | null, newState: string | null) => {
    if (priorState && newState && priorState !== newState) {
      setPendingPrompt({
        type: 'state_change',
        context: { priorState, newState },
      })
    }
  }

  const checkMaritalStatusChange = (priorStatus: string | null, newStatus: string | null) => {
    if (
      priorStatus !== 'married' &&
      (newStatus === 'married' || newStatus === 'mfj')
    ) {
      setPendingPrompt({
        type: 'marital_status_change',
        context: { newMaritalStatus: newStatus ?? undefined },
      })
    }
  }

  const clearPrompt = () => setPendingPrompt(null)

  return { pendingPrompt, checkStateChange, checkMaritalStatusChange, clearPrompt }
}
