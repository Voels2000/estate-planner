import { redirect } from 'next/navigation'
import { getUserAccess } from '@/lib/get-user-access'
import { MonteCarloClient } from './_monte-carlo-client'

export const metadata = {
  title: 'Monte Carlo Simulations | Estate Planner',
  description: 'Probabilistic retirement outcome modeling',
}

export default async function MonteCarloPage() {
  const access = await getUserAccess()

  if (access.tier < 3) {
    redirect('/pricing')
  }

  return <MonteCarloClient />
}
