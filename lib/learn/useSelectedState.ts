'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { STATE_SLUG_MAP } from './state-estate-tax-slugs'

const LS_KEY = 'mwm_selected_state'

const ESTATE_TAX_STATE_CODES = new Set(Object.values(STATE_SLUG_MAP))

/**
 * Manages selected state with priority: household.state_primary → localStorage → null.
 * Writes localStorage only — does not update household profile.
 */
export function useSelectedState(householdState?: string | null) {
  const [selectedState, setSelectedStateInternal] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (householdState === undefined) return

    if (householdState) {
      setSelectedStateInternal(householdState.toUpperCase())
      setReady(true)
      return
    }

    try {
      const stored = localStorage.getItem(LS_KEY)
      setSelectedStateInternal(stored ? stored.toUpperCase() : null)
    } catch {
      setSelectedStateInternal(null)
    }
    setReady(true)
  }, [householdState])

  const setSelectedState = useCallback((code: string) => {
    const upper = code ? code.toUpperCase() : null
    setSelectedStateInternal(upper)
    try {
      if (upper) {
        localStorage.setItem(LS_KEY, upper)
      } else {
        localStorage.removeItem(LS_KEY)
      }
    } catch {
      // localStorage unavailable
    }
  }, [])

  const isEstateTaxState = useMemo(
    () => (selectedState ? ESTATE_TAX_STATE_CODES.has(selectedState) : false),
    [selectedState],
  )

  return { selectedState, setSelectedState, isEstateTaxState, ready }
}
