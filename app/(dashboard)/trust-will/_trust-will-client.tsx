'use client'

import { TrustDocumentsPanel } from '@/components/consumer/TrustDocumentsPanel'
import type { TrustRow } from '@/lib/trusts/types'

export type { TrustRow }

export default function TrustWillClient(props: {
  estateValue: number
  recommendations: Parameters<typeof TrustDocumentsPanel>[0]['recommendations']
  checklist: Parameters<typeof TrustDocumentsPanel>[0]['checklist']
  initialTrusts?: TrustRow[]
}) {
  return <TrustDocumentsPanel {...props} embedded={false} />
}
