'use client'

import { useEffect, useState } from 'react'
import { PlaybookStep } from '@/components/advisor/PlaybookStep'
import {
  dismissPlaybook,
  getPlaybookState,
  type AdvisorPlaybookState,
} from '@/lib/advisor/advisorPlaybookStorage'

type Props = {
  advisorId: string
  clientId: string
  clientName: string
}

export function AdvisorFirstClientPlaybook({ advisorId, clientId, clientName }: Props) {
  const [playbook, setPlaybook] = useState<AdvisorPlaybookState>({
    step1: false,
    step2: false,
    step3: false,
  })

  useEffect(() => {
    setPlaybook(getPlaybookState(advisorId))
    const onStorage = () => setPlaybook(getPlaybookState(advisorId))
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [advisorId])

  if (playbook.dismissed) return null

  function handleDismiss() {
    dismissPlaybook(advisorId)
    setPlaybook(getPlaybookState(advisorId))
  }

  const allDone = playbook.step1 && playbook.step2 && playbook.step3

  return (
    <div className="rounded-xl border border-[color:var(--mwm-gold)] bg-[var(--mwm-gold-pale)] p-5 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-[color:var(--mwm-navy)] text-sm">
          Getting started with {clientName}
        </h3>
        <button
          type="button"
          onClick={handleDismiss}
          className="text-neutral-400 hover:text-neutral-600 text-xs"
        >
          Dismiss
        </button>
      </div>

      <div className="space-y-2">
        <PlaybookStep
          number={1}
          title="Review their estate health score"
          description="See their score, open gaps, and where their plan is strongest."
          href={`/advisor/clients/${clientId}`}
          completed={playbook.step1}
          ctaLabel="Open client view →"
        />
        <PlaybookStep
          number={2}
          title="Model a strategy"
          description="Use the Strategy tab to run a GRAT, gifting analysis, or trust scenario."
          href={`/advisor/clients/${clientId}?tab=strategy`}
          completed={playbook.step2}
          ctaLabel="Open Strategy tab →"
        />
        <PlaybookStep
          number={3}
          title="Send your first recommendation"
          description="Send the client a strategy recommendation they can review and accept in-app."
          href={`/advisor/clients/${clientId}?tab=strategy`}
          completed={playbook.step3}
          ctaLabel="Send recommendation →"
        />
      </div>

      {allDone && (
        <div className="mt-3 pt-3 border-t border-amber-200">
          <p className="text-xs text-emerald-700 font-semibold">
            ✓ You&apos;ve completed the getting started steps. Your client workflow is ready.
          </p>
        </div>
      )}
    </div>
  )
}
