'use client'

import { useEffect, useState } from 'react'
import {
  ATTORNEY_EVENT_REFERRAL_GROUPS,
  ATTORNEY_MARKETING_FRAMING,
  attorneyEventReferralLabel,
  attorneyEventReferralUsageTip,
  buildAttorneyNewsletterEmailCopy,
  buildAttorneyNewsletterPlainTextCopy,
} from '@/lib/attorney/attorneyEventReferralKit'
import type { AttorneyReferralStats } from '@/lib/attorney/attorneyReferralStats'

type Props = {
  referralCode: string
  eventReferralUrls: Record<string, string>
  initialStats?: AttorneyReferralStats | null
}

const EMPTY_STATS: AttorneyReferralStats = {
  totalClicksAllTime: 0,
  clicksLast30Days: 0,
  clicksBySlug: {},
  clicksByCategory: {},
  topSlugsByClicks: [],
  newsletterBundleSlugs: [],
  mostClickedSlug: null,
}

export function AttorneyMarketingKit({
  referralCode,
  eventReferralUrls,
  initialStats = null,
}: Props) {
  const [newsletterTab, setNewsletterTab] = useState<'links' | 'email' | 'text'>('links')
  const [copiedNewsletter, setCopiedNewsletter] = useState(false)
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null)
  const [copiedBundle, setCopiedBundle] = useState(false)
  const [stats, setStats] = useState<AttorneyReferralStats>(initialStats ?? EMPTY_STATS)

  useEffect(() => {
    if (initialStats) return
    void (async () => {
      try {
        const res = await fetch('/api/attorney/referral-stats')
        if (!res.ok) return
        const data = (await res.json()) as AttorneyReferralStats
        setStats(data)
      } catch {
        // non-fatal
      }
    })()
  }, [initialStats])

  const emailCopy = buildAttorneyNewsletterEmailCopy(referralCode, eventReferralUrls)
  const textCopy = buildAttorneyNewsletterPlainTextCopy(referralCode, eventReferralUrls)

  const bundleLines = stats.newsletterBundleSlugs
    .filter((slug) => eventReferralUrls[slug])
    .map((slug) => `${attorneyEventReferralLabel(slug)}: ${eventReferralUrls[slug]}`)

  const bundleCopy = [
    'A few life-event resources my clients find useful:',
    '',
    ...bundleLines,
    '',
    `Attorney ref: ${referralCode}`,
  ].join('\n')

  const mostClickedLabel = stats.mostClickedSlug
    ? attorneyEventReferralLabel(stats.mostClickedSlug)
    : '—'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[color:var(--mwm-navy)]">Marketing</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-600">
          {ATTORNEY_MARKETING_FRAMING}
        </p>
        <p className="mt-2 text-sm text-neutral-500">
          Your referral code:{' '}
          <span className="font-mono font-semibold text-neutral-900">{referralCode}</span>
          {' · '}
          Links use <span className="font-mono">?aref=</span> for attribution.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total link clicks" value={stats.totalClicksAllTime} />
        <StatCard label="Last 30 days" value={stats.clicksLast30Days} />
        <StatCard label="Most clicked" value={mostClickedLabel} isText />
      </div>

      {bundleLines.length > 0 && (
        <div className="rounded-2xl border border-[color:var(--mwm-gold)]/30 bg-[color:var(--mwm-gold-pale)]/40 p-6">
          <h2 className="text-sm font-semibold text-[color:var(--mwm-navy)]">
            This quarter&apos;s newsletter
          </h2>
          <p className="mt-1 text-xs text-neutral-600">
            {stats.topSlugsByClicks.length > 0
              ? 'Your three most-clicked links — ready to drop into your next client email.'
              : 'A starter set of high-relevance events until your click history builds.'}
          </p>
          <ul className="mt-4 space-y-2 text-sm text-neutral-800">
            {stats.newsletterBundleSlugs
              .filter((slug) => eventReferralUrls[slug])
              .map((slug) => (
                <li key={slug}>
                  <span className="font-medium">{attorneyEventReferralLabel(slug)}</span>
                  {stats.clicksBySlug[slug] != null && stats.clicksBySlug[slug] > 0 && (
                    <span className="ml-2 text-xs text-neutral-500">
                      {stats.clicksBySlug[slug]} click{stats.clicksBySlug[slug] === 1 ? '' : 's'}
                    </span>
                  )}
                </li>
              ))}
          </ul>
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(bundleCopy)
                setCopiedBundle(true)
                setTimeout(() => setCopiedBundle(false), 2000)
              } catch {
                window.prompt('Copy this text:', bundleCopy)
              }
            }}
            className="mt-4 rounded-lg bg-[color:var(--mwm-navy)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition"
          >
            {copiedBundle ? '✓ Copied bundle' : 'Copy newsletter snippet'}
          </button>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <div className="border-b border-neutral-100 px-6 pb-4 pt-6">
          <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Life-event link kit
          </h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {(
              [
                { key: 'links' as const, label: '🔗 All Links' },
                { key: 'email' as const, label: '✉️ Email Copy' },
                { key: 'text' as const, label: '📱 Plain Text' },
              ] as const
            ).map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setNewsletterTab(t.key)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  newsletterTab === t.key
                    ? 'bg-[color:var(--mwm-navy)] text-white'
                    : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {newsletterTab === 'links' && (
          <div className="space-y-6 p-6">
            {ATTORNEY_EVENT_REFERRAL_GROUPS.map((group) => {
              const groupSlugs = group.slugs.filter((s) => eventReferralUrls[s])
              if (groupSlugs.length === 0) return null
              const categoryClicks = stats.clicksByCategory[group.label] ?? 0
              return (
                <div key={group.label}>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                      {group.label}
                    </p>
                    {categoryClicks > 0 && (
                      <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-medium text-neutral-600">
                        {categoryClicks} click{categoryClicks === 1 ? '' : 's'}
                      </span>
                    )}
                  </div>
                  <div className="space-y-2">
                    {groupSlugs.map((slug) => {
                      const url = eventReferralUrls[slug]
                      const tip = attorneyEventReferralUsageTip(slug)
                      const slugClicks = stats.clicksBySlug[slug] ?? 0
                      return (
                        <div
                          key={slug}
                          className="rounded-lg border border-neutral-100 bg-neutral-50 px-3 py-2.5"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-medium text-neutral-800">
                                  {attorneyEventReferralLabel(slug)}
                                </span>
                                {slugClicks > 0 && (
                                  <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-neutral-500 ring-1 ring-neutral-200">
                                    {slugClicks} click{slugClicks === 1 ? '' : 's'}
                                  </span>
                                )}
                              </div>
                              {tip && (
                                <p className="mt-1 text-xs leading-relaxed text-neutral-500">{tip}</p>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  await navigator.clipboard.writeText(url)
                                  setCopiedSlug(slug)
                                  setTimeout(() => setCopiedSlug(null), 2000)
                                } catch {
                                  window.prompt('Copy this link:', url)
                                }
                              }}
                              className="shrink-0 whitespace-nowrap text-xs font-medium text-[color:var(--mwm-navy)] hover:text-[color:var(--mwm-navy-light)]"
                            >
                              {copiedSlug === slug ? '✓ Copied' : 'Copy'}
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {newsletterTab === 'email' && (
          <CopyBlock
            title="Email template"
            text={emailCopy}
            copied={copiedNewsletter}
            onCopy={async () => {
              try {
                await navigator.clipboard.writeText(emailCopy)
                setCopiedNewsletter(true)
                setTimeout(() => setCopiedNewsletter(false), 2000)
              } catch {
                window.prompt('Copy this text:', emailCopy)
              }
            }}
            mono={false}
          />
        )}

        {newsletterTab === 'text' && (
          <CopyBlock
            title="Plain text"
            text={textCopy}
            copied={copiedNewsletter}
            onCopy={async () => {
              try {
                await navigator.clipboard.writeText(textCopy)
                setCopiedNewsletter(true)
                setTimeout(() => setCopiedNewsletter(false), 2000)
              } catch {
                window.prompt('Copy this text:', textCopy)
              }
            }}
            mono
          />
        )}
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  isText = false,
}: {
  label: string
  value: number | string
  isText?: boolean
}) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">{label}</p>
      <p
        className={`mt-1 text-[color:var(--mwm-navy)] ${isText ? 'text-sm font-semibold leading-snug' : 'text-2xl font-bold'}`}
      >
        {value}
      </p>
    </div>
  )
}

function CopyBlock({
  title,
  text,
  copied,
  onCopy,
  mono,
}: {
  title: string
  text: string
  copied: boolean
  onCopy: () => void | Promise<void>
  mono: boolean
}) {
  return (
    <div className="p-6">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">{title}</p>
        <button
          type="button"
          onClick={() => void onCopy()}
          className="text-xs font-medium text-[color:var(--mwm-navy)] hover:text-[color:var(--mwm-navy-light)]"
        >
          {copied ? '✓ Copied' : 'Copy all'}
        </button>
      </div>
      <pre
        className={`max-h-[480px] overflow-auto overflow-x-auto rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-xs leading-relaxed text-neutral-700 whitespace-pre-wrap ${
          mono ? 'font-mono' : 'font-sans'
        }`}
      >
        {text}
      </pre>
    </div>
  )
}
