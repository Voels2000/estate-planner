import { test, expect } from '@playwright/test'
import { createAdminClient } from '@/lib/supabase/admin'

let createdEventId: string | null = null

test.describe('Consumer life events', () => {
  test.afterEach(async () => {
    if (!createdEventId || !process.env.SUPABASE_SERVICE_ROLE_KEY) return
    const admin = createAdminClient()
    await admin.from('life_events').delete().eq('id', createdEventId)
    createdEventId = null
  })

  test('POST /api/consumer/life-events logs valid event', async ({ request }) => {
    const res = await request.post('/api/consumer/life-events', {
      data: { event_type: 'serious-diagnosis' },
    })
    expect(res.ok(), await res.text()).toBeTruthy()
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.event?.event_type ?? body.event_type).toBe('serious-diagnosis')
    createdEventId = body.id ?? body.event?.id ?? null
  })

  test('GET /api/consumer/life-events returns list', async ({ request }) => {
    const res = await request.get('/api/consumer/life-events')
    expect(res.ok(), await res.text()).toBeTruthy()
    const body = await res.json()
    expect(Array.isArray(body.events)).toBe(true)
  })
})
