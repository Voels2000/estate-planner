import { test, expect, type APIRequestContext } from '@playwright/test'

const GIFT_API = '/api/consumer/gift-history'
const TAX_YEAR = new Date().getFullYear()
const RECIPIENT_PREFIX = 'Playwright Gift History'

function uniqueRecipient(suffix: string) {
  return `${RECIPIENT_PREFIX} ${suffix} ${Date.now()}`
}

function baseAnnualPayload(recipientName: string, amount = 1000) {
  return {
    tax_year: TAX_YEAR,
    amount,
    recipient_name: recipientName,
    gift_type: 'annual' as const,
    donor_person: 'person1' as const,
  }
}

function parseAccessTokenFromStorage(cookies: { name: string; value: string }[]): string | null {
  const authCookie = cookies.find((c) => c.name.includes('auth-token'))
  if (!authCookie?.value) return null
  try {
    const raw = authCookie.value.replace(/^base64-/, '')
    const parsed = JSON.parse(Buffer.from(raw, 'base64').toString('utf8')) as {
      access_token?: string
    }
    return parsed.access_token ?? null
  } catch {
    return null
  }
}

async function fetchEstateHealthComputedAt(
  request: APIRequestContext,
  householdId: string,
): Promise<string | null> {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://fnzvlmrqwcqwiqueevux.supabase.co'
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!anonKey) return null

  const storage = await request.storageState()
  const accessToken = parseAccessTokenFromStorage(storage.cookies)
  if (!accessToken) return null

  const res = await request.get(
    `${supabaseUrl}/rest/v1/estate_health_scores?household_id=eq.${householdId}&select=computed_at&limit=1`,
    {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${accessToken}`,
      },
    },
  )
  if (!res.ok()) return null
  const rows = (await res.json()) as { computed_at?: string }[]
  return rows[0]?.computed_at ?? null
}

async function pollComputedAtChanged(
  request: APIRequestContext,
  householdId: string,
  before: string | null,
  timeoutMs = 25_000,
): Promise<string> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const current = await fetchEstateHealthComputedAt(request, householdId)
    if (current && current !== before) return current
    await new Promise((r) => setTimeout(r, 1500))
  }
  throw new Error('estate_health_scores.computed_at did not change after gift write')
}

test.describe('Consumer gift-history API', () => {
  test('POST annual gift returns 201 and persisted row', async ({ request }) => {
    const recipient = uniqueRecipient('annual')
    const res = await request.post(GIFT_API, {
      data: baseAnnualPayload(recipient, 5000),
    })
    expect(res.status(), await res.text()).toBe(201)
    const body = await res.json()
    expect(body.id).toBeTruthy()
    expect(body.recipient_name).toBe(recipient)
    expect(body.gift_type).toBe('annual')
    expect(body.donor_person).toBe('person1')

    await request.delete(GIFT_API, { data: { id: body.id } })
  })

  test('POST lifetime gift returns 201 with gift_type lifetime', async ({ request }) => {
    const recipient = uniqueRecipient('lifetime')
    const res = await request.post(GIFT_API, {
      data: {
        ...baseAnnualPayload(recipient, 25000),
        gift_type: 'lifetime',
        form_709_filed: true,
      },
    })
    expect(res.status(), await res.text()).toBe(201)
    const body = await res.json()
    expect(body.gift_type).toBe('lifetime')

    await request.delete(GIFT_API, { data: { id: body.id } })
  })

  test('PATCH amount returns 200 with updated value', async ({ request }) => {
    const recipient = uniqueRecipient('patch')
    const createRes = await request.post(GIFT_API, {
      data: baseAnnualPayload(recipient, 1000),
    })
    expect(createRes.status()).toBe(201)
    const created = await createRes.json()

    const patchRes = await request.patch(GIFT_API, {
      data: { id: created.id, amount: 7500 },
    })
    expect(patchRes.status(), await patchRes.text()).toBe(200)
    const patched = await patchRes.json()
    expect(patched.amount).toBe(7500)

    await request.delete(GIFT_API, { data: { id: created.id } })
  })

  test('DELETE returns 200 with success true', async ({ request }) => {
    const recipient = uniqueRecipient('delete')
    const createRes = await request.post(GIFT_API, {
      data: baseAnnualPayload(recipient, 1000),
    })
    expect(createRes.status()).toBe(201)
    const created = await createRes.json()

    const deleteRes = await request.delete(GIFT_API, { data: { id: created.id } })
    expect(deleteRes.status(), await deleteRes.text()).toBe(200)
    const body = await deleteRes.json()
    expect(body.success).toBe(true)
  })

  test('POST missing recipient_name returns 400', async ({ request }) => {
    const res = await request.post(GIFT_API, {
      data: {
        tax_year: TAX_YEAR,
        amount: 1000,
        gift_type: 'annual',
        donor_person: 'person1',
      },
    })
    expect(res.status()).toBe(400)
  })

  test('POST missing tax_year returns 400', async ({ request }) => {
    const res = await request.post(GIFT_API, {
      data: {
        amount: 1000,
        recipient_name: uniqueRecipient('no-year'),
        gift_type: 'annual',
        donor_person: 'person1',
      },
    })
    expect(res.status()).toBe(400)
  })

  test('POST missing amount returns 400', async ({ request }) => {
    const res = await request.post(GIFT_API, {
      data: {
        tax_year: TAX_YEAR,
        recipient_name: uniqueRecipient('no-amount'),
        gift_type: 'annual',
        donor_person: 'person1',
      },
    })
    expect(res.status()).toBe(400)
  })

  test('POST gift triggers estate health recompute (computed_at advances)', async ({
    request,
  }) => {
    const householdId = process.env.PLAYWRIGHT_HOUSEHOLD_ID
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    test.skip(
      !householdId || !anonKey,
      'Set PLAYWRIGHT_HOUSEHOLD_ID and NEXT_PUBLIC_SUPABASE_ANON_KEY for recompute verification',
    )

    const before = await fetchEstateHealthComputedAt(request, householdId!)

    const recipient = uniqueRecipient('recompute')
    const createRes = await request.post(GIFT_API, {
      data: baseAnnualPayload(recipient, 1200),
    })
    expect(createRes.status(), await createRes.text()).toBe(201)
    const created = await createRes.json()

    const after = await pollComputedAtChanged(request, householdId!, before)
    expect(after).toBeTruthy()

    await request.delete(GIFT_API, { data: { id: created.id } })
  })

  test('POST without donor_person defaults donor_person to person1', async ({ request }) => {
    const recipient = uniqueRecipient('donor-default')
    const res = await request.post(GIFT_API, {
      data: {
        tax_year: TAX_YEAR,
        amount: 1500,
        recipient_name: recipient,
        gift_type: 'annual',
      },
    })
    expect(res.status(), await res.text()).toBe(201)
    const body = await res.json()
    expect(body.donor_person).toBe('person1')

    await request.delete(GIFT_API, { data: { id: body.id } })
  })
})
