import { MonteCarloClient } from './_monte-carlo-client'

export const metadata = {
  title: 'Monte Carlo Simulations | Estate Planner',
  description: 'Probabilistic retirement outcome modeling',
}

export default async function MonteCarloPage() {
  // Former tier billing redirect removed — layout enforces subscription.
  return <MonteCarloClient />
}
