'use client'

import { useRouter } from 'next/navigation'

type AlertCTA = {
  label: string
  bg: string
  text: string
}

type PriorityAlertCardProps = {
  alert: {
    id: string
    title: string | null
    message: string | null
    severity: string
    action_href?: string | null
  }
  fact: string | null
  cta: AlertCTA
  score: number
}

export function PriorityAlertCard({ alert, fact, cta, score }: PriorityAlertCardProps) {
  const router = useRouter()
  const isUrgent = alert.severity === 'high' || score < 40
  const isWarn = alert.severity === 'medium' || score < 60

  const cardBg = isUrgent ? '#FAEEDA' : isWarn ? '#FAEEDA' : '#E6F1FB'
  const cardBorder = isUrgent ? '#EF9F27' : isWarn ? '#EF9F27' : '#85B7EB'
  const badgeBg = isUrgent ? '#FAC775' : isWarn ? '#FAC775' : '#85B7EB'
  const badgeText = isUrgent ? '#412402' : isWarn ? '#412402' : '#042C53'
  const bodyText = isUrgent ? '#412402' : isWarn ? '#412402' : '#042C53'
  const factText = isUrgent ? '#633806' : isWarn ? '#633806' : '#0C447C'
  const badgeLabel = isUrgent ? 'Urgent' : isWarn ? 'Priority gap' : 'Worth noting'

  const href =
    alert.action_href ?? (isUrgent ? '/find-advisor' : '/titling')

  return (
    <div
      className="rounded-[var(--mwm-radius)] p-4"
      style={{ background: cardBg, border: `0.5px solid ${cardBorder}` }}
    >
      <div className="mb-2 flex items-center justify-between">
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-medium"
          style={{ background: badgeBg, color: badgeText }}
        >
          {badgeLabel}
        </span>
      </div>
      <p className="mb-1 text-sm font-medium text-[color:var(--mwm-navy)]">
        {alert.title ?? alert.message}
      </p>
      <p className="text-sm leading-relaxed" style={{ color: bodyText }}>
        {alert.message ?? alert.title}
      </p>
      {fact && (
        <p
          className="mt-2 pt-2 text-xs leading-relaxed"
          style={{ color: factText, borderTop: `0.5px solid ${cardBorder}` }}
        >
          {fact}
        </p>
      )}
      <button
        type="button"
        className="mt-3 rounded px-3 py-1.5 text-xs font-medium"
        style={{ background: cta.bg, color: cta.text }}
        onClick={() => router.push(href)}
      >
        {cta.label} →
      </button>
    </div>
  )
}
