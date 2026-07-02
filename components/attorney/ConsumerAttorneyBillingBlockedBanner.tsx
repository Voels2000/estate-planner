'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { ConsumerAttorneyBillingBlockedAlert } from '@/components/attorney/AttorneyConnectionBillingGateModals'

const STORAGE_KEY = 'mwm:attorney_billing_blocked'

export function ConsumerAttorneyBillingBlockedBanner() {
  const searchParams = useSearchParams()
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    const fromStorage = sessionStorage.getItem(STORAGE_KEY)
    if (fromStorage) {
      setMessage(fromStorage)
      sessionStorage.removeItem(STORAGE_KEY)
      return
    }
    if (searchParams.get('attorney_invite') === 'capacity_blocked') {
      setMessage(
        'Your attorney needs to enable client billing before you can connect. Ask them to complete checkout in their attorney portal under Billing (their first client is always free).',
      )
    }
  }, [searchParams])

  if (!message) return null

  return (
    <div className="mb-4">
      <ConsumerAttorneyBillingBlockedAlert message={message} />
    </div>
  )
}
