'use client'

import { InfoTooltip } from '@/components/ui/InfoTooltip'
import {
  ROSTER_NET_WORTH_LABEL,
  ROSTER_NET_WORTH_TOOLTIP,
} from '@/lib/roster/rosterNetWorth'

type Props = {
  className?: string
}

/** Shared advisor + attorney roster column header with definition tooltip. */
export function RosterNetWorthColumnHeader({ className }: Props) {
  return (
    <span className={`inline-flex items-center gap-1 normal-case ${className ?? ''}`}>
      {ROSTER_NET_WORTH_LABEL}
      <InfoTooltip content={ROSTER_NET_WORTH_TOOLTIP} size="sm" />
    </span>
  )
}
