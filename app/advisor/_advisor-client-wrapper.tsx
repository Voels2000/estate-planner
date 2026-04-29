'use client'

/**
 * Dynamic wrapper for advisor roster client component.
 *
 * Disables SSR for the heavy interactive advisor client table/controls.
 */

import dynamic from 'next/dynamic'

const AdvisorClient = dynamic(() => import('./_advisor-client'), { ssr: false })

export default AdvisorClient
