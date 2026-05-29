'use client'

import { SendIntakeRequestModal } from '@/components/attorney/SendIntakeRequestModal'

type Props = {
  onInviteClick: () => void
  showIntakeModal: boolean
  onOpenIntakeModal: () => void
  onCloseIntakeModal: () => void
}

export function AdvisorEmptyStateCta({
  onInviteClick,
  showIntakeModal,
  onOpenIntakeModal,
  onCloseIntakeModal,
}: Props) {
  return (
    <>
      <div className="max-w-lg mx-auto py-12 px-6 text-center">
        <div className="text-4xl mb-4">🎯</div>
        <h2 className="text-xl font-semibold text-[color:var(--mwm-navy)] mb-2">
          Connect your first client
        </h2>
        <p className="text-neutral-500 text-sm mb-8 leading-relaxed">
          Once a client accepts your invitation, you&apos;ll see their estate health score, open
          gaps, and a full planning workspace here.
        </p>

        <div className="space-y-3 text-left">
          <div className="rounded-lg border border-[color:var(--mwm-gold)] bg-[var(--mwm-gold-pale)] p-4">
            <div className="flex items-start gap-3">
              <span className="text-lg mt-0.5">📋</span>
              <div className="flex-1">
                <p className="font-semibold text-sm text-[color:var(--mwm-navy)]">
                  Send an intake request
                </p>
                <p className="text-xs text-neutral-600 mt-0.5">
                  Client receives a branded email. They complete their profile before your meeting
                  — no back-and-forth.
                </p>
                <button
                  type="button"
                  onClick={onOpenIntakeModal}
                  className="mt-2 text-xs font-semibold text-[color:var(--mwm-navy)] underline"
                >
                  Send intake request →
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-neutral-200 bg-white p-4">
            <div className="flex items-start gap-3">
              <span className="text-lg mt-0.5">✉️</span>
              <div className="flex-1">
                <p className="font-semibold text-sm text-[color:var(--mwm-navy)]">
                  Invite an existing client
                </p>
                <p className="text-xs text-neutral-600 mt-0.5">
                  For clients already on My Wealth Maps — send them a connection invite from the Add
                  Client tab.
                </p>
                <button
                  type="button"
                  onClick={onInviteClick}
                  className="mt-2 text-xs font-semibold text-[color:var(--mwm-navy)] underline"
                >
                  Add client →
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-neutral-200 bg-white p-4">
            <div className="flex items-start gap-3">
              <span className="text-lg mt-0.5">🔍</span>
              <div className="flex-1">
                <p className="font-semibold text-sm text-[color:var(--mwm-navy)]">
                  Run a prospect analysis first
                </p>
                <p className="text-xs text-neutral-600 mt-0.5">
                  Generate a one-page estate opportunity summary for a prospect — no account
                  required.
                </p>
                <a
                  href="/prospect"
                  className="mt-2 text-xs font-semibold text-[color:var(--mwm-navy)] underline block"
                >
                  Open prospect mode →
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      <SendIntakeRequestModal
        open={showIntakeModal}
        onClose={onCloseIntakeModal}
        onSent={() => {}}
        sentThisMonth={0}
        monthlyCap={null}
      />
    </>
  )
}
