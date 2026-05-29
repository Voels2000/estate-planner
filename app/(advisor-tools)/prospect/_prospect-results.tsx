'use client'

import { useState } from 'react'
import { DisclaimerBanner } from '@/lib/components/DisclaimerBanner'
import { fmtProspectDollars } from '@/lib/prospect/constants'
import type { ProspectSummary } from '@/lib/prospect/calculateProspectSummary'

type Props = {
  summary: ProspectSummary
  pdfUrl: string
  prospectName: string
}

export function ProspectResults({ summary, pdfUrl, prospectName }: Props) {
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [intakeMessage, setIntakeMessage] = useState<string | null>(null)
  const [intakeError, setIntakeError] = useState<string | null>(null)

  const displayName = prospectName.trim() || 'your prospect'

  async function handleSendIntake() {
    if (!email.includes('@')) {
      setIntakeError('Enter a valid email address.')
      return
    }

    setSending(true)
    setIntakeMessage(null)
    setIntakeError(null)

    try {
      const res = await fetch('/api/attorney/send-intake-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientEmail: email.trim(),
          clientName: prospectName.trim() || undefined,
        }),
      })

      const data = (await res.json()) as { error?: string; success?: boolean }

      if (!res.ok) {
        setIntakeError(data.error ?? 'Failed to send invitation.')
        return
      }

      setIntakeMessage(
        "Invitation sent — they'll receive an email with your name and a link to complete their profile.",
      )
      setEmail('')
    } catch {
      setIntakeError('Unexpected error — please try again.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-neutral-900">
          Estate Planning Opportunity Summary
        </h2>
        <a
          href={pdfUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center rounded-lg border border-[color:var(--mwm-gold)] bg-[var(--mwm-gold-pale)] px-4 py-2 text-xs font-semibold text-[color:var(--mwm-navy)] hover:bg-amber-100 transition"
        >
          Download opportunity summary →
        </a>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="bg-white rounded-xl border border-neutral-200 p-4">
          <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">
            Federal — Current law
          </h3>
          <p className="text-2xl font-bold text-[color:var(--mwm-navy)]">
            {fmtProspectDollars(summary.federalTaxCurrent)}
          </p>
          <p className="text-xs text-neutral-500 mt-1">
            Exemption: {fmtProspectDollars(summary.exemptionCurrent)}
          </p>
        </div>
        <div className="bg-amber-50 rounded-xl border border-amber-200 p-4">
          <h3 className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-2">
            Federal — After sunset
          </h3>
          <p className="text-2xl font-bold text-amber-900">
            {fmtProspectDollars(summary.federalTaxSunset)}
          </p>
          <p className="text-xs text-amber-700 mt-1">
            Exemption: {fmtProspectDollars(summary.exemptionSunset)}
          </p>
        </div>
      </div>

      {summary.sunsetDelta > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          If the federal exemption sunsets, federal tax exposure increases by{' '}
          <strong>{fmtProspectDollars(summary.sunsetDelta)}</strong>.
        </div>
      )}

      {(summary.stateTax > 0 || summary.planningGaps.length > 0) && (
        <div className="bg-white rounded-xl border border-neutral-200 p-4 space-y-2">
          <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">
            Tax exposure
          </h3>
          {summary.stateTax > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-neutral-600">{summary.selectedState} state estate tax</span>
              <span className="font-semibold text-amber-700">
                {fmtProspectDollars(summary.stateTax)}
              </span>
            </div>
          )}
        </div>
      )}

      {summary.planningGaps.length > 0 && (
        <div className="bg-white rounded-xl border border-neutral-200 p-4">
          <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-3">
            Top Planning Gaps
          </h3>
          <div className="space-y-2">
            {summary.planningGaps.map((gap, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="text-amber-500 shrink-0">○</span>
                <span className="text-sm text-neutral-700">{gap}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-[var(--mwm-gold-pale)] rounded-xl border border-[color:var(--mwm-border)] p-4">
        <h3 className="text-xs font-semibold text-[color:var(--mwm-navy)] uppercase tracking-wide mb-3">
          What we would look at together
        </h3>
        <div className="space-y-2">
          {summary.whatWeWouldLookAt.map((item, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="text-[color:var(--mwm-text-muted)] font-bold text-xs mt-0.5">
                {i + 1}.
              </span>
              <span className="text-sm text-[color:var(--mwm-navy)]">{item}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-neutral-200 bg-white p-5 space-y-4">
        <div>
          <p className="text-sm font-semibold text-neutral-900">Ready to build their full plan?</p>
          <p className="text-sm text-neutral-600 mt-1">
            Send {displayName} an invitation to complete their profile on My Wealth Maps. Their real
            data replaces these estimates automatically.
          </p>
        </div>
        <div>
          <label htmlFor="prospect-email" className="block text-xs font-medium text-neutral-600 mb-1.5">
            Prospect email
          </label>
          <input
            id="prospect-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="prospect@example.com"
            className="w-full px-3 py-2.5 border border-neutral-200 rounded-lg text-sm"
          />
        </div>
        {intakeError && <p className="text-sm text-red-600">{intakeError}</p>}
        {intakeMessage && <p className="text-sm text-green-700 font-medium">{intakeMessage}</p>}
        <button
          type="button"
          onClick={() => void handleSendIntake()}
          disabled={sending}
          className="w-full sm:w-auto rounded-xl bg-[color:var(--mwm-navy)] px-5 py-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition"
        >
          {sending ? 'Sending…' : 'Send intake invitation →'}
        </button>
      </div>

      <DisclaimerBanner context="prospect analysis" />
    </div>
  )
}
