import { createAdminClient } from '../lib/supabase/admin'

async function repairAttorneyStripeCustomer() {
  const admin = createAdminClient()
  const { error } = await admin
    .from('profiles')
    .update({ stripe_customer_id: null })
    .eq('email', 'e2e-attorney@mywealthmaps.test')
  if (error) throw error
  console.log('Cleared stale stripe_customer_id for e2e-attorney')
}

repairAttorneyStripeCustomer()
