import { test, expect } from '@playwright/test'
import { createAdminClient } from '@/lib/supabase/admin'
import { DRIP_SMOKE_EMAIL } from '../../../scripts/e2e-test-identities'
import { initSupabaseEnv } from '../../../scripts/seed-e2e-lib'

/**
 * B4 drip step 1 — DB assert only (no Resend inbox).
 */
test.describe('B4 drip step 1', () => {
  test('e2e-drip capture has drip_step_1_sent_at populated', async () => {
    initSupabaseEnv()
    const admin = createAdminClient()

    const { data, error } = await admin
      .from('email_captures')
      .select('email, drip_step_1_sent_at, drip_step_2_sent_at, drip_step_3_sent_at')
      .eq('email', DRIP_SMOKE_EMAIL)
      .maybeSingle()

    expect(error).toBeNull()
    expect(data, `No email_captures row for ${DRIP_SMOKE_EMAIL} — run npm run seed:e2e`).toBeTruthy()
    expect(data!.drip_step_1_sent_at).toBeTruthy()
  })
})
