'use client'

import { createContext, useContext } from 'react'

const AnnualBillingContext = createContext(false)

export function AnnualBillingProvider({
  available,
  children,
}: {
  available: boolean
  children: React.ReactNode
}) {
  return (
    <AnnualBillingContext.Provider value={available}>{children}</AnnualBillingContext.Provider>
  )
}

/** Server-resolved annual billing flag — do not call hasPriceConfig in client for this. */
export function useAnnualBillingAvailable(): boolean {
  return useContext(AnnualBillingContext)
}
