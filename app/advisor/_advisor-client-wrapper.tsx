'use client'

import dynamic from 'next/dynamic'

const AdvisorClient = dynamic(() => import('./_advisor-client'), { ssr: false })

export default AdvisorClient
