'use client'

type Props = {
  onInviteClick: () => void
}

export function AdvisorEmptyStateCta({ onInviteClick }: Props) {
  return (
    <div className="rounded-2xl border border-dashed border-[color:var(--mwm-border)] bg-white p-8 text-center">
      <div className="text-4xl mb-3">👥</div>
      <h2 className="text-lg font-semibold text-[color:var(--mwm-navy)]">Invite your first client</h2>
      <p className="mt-2 text-sm text-neutral-600 max-w-md mx-auto leading-relaxed">
        Clients get free Estate access when connected to your practice. Send a secure email invite — they
        can accept in one click after signup.
      </p>
      <ol className="mt-6 text-left max-w-sm mx-auto space-y-2 text-sm text-neutral-700">
        <li>1. Enter your client&apos;s email on the Add Client tab</li>
        <li>2. They accept the invite and connect to your portal</li>
        <li>3. Review their plan, send recommendations, and export meeting prep</li>
      </ol>
      <button
        type="button"
        onClick={onInviteClick}
        className="mt-6 inline-flex items-center rounded-lg bg-[var(--mwm-navy)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[var(--mwm-navy-light)] transition"
      >
        Invite your first client →
      </button>
    </div>
  )
}
