/**
 * Import API integration tests — Sprint F-2
 * Tests 3 (inline edit), 4 (duplicate detection), 5 (traceability)
 * Plus API coverage for Tests 1 and 6.
 *
 * Requires: .env.test, consumer-setup, tier 2+ user, F-2 migration on test DB.
 * Run: npm run test:import:api
 */
import { test, expect, type APIRequestContext } from '@playwright/test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { E2E_IDENTITIES } from '../../../scripts/e2e-test-identities'
import { resolveE2eEmail } from '../helpers/e2e-auth'

const FIXTURES = path.join(process.cwd(), 'tests/fixtures/import')

const PLAYWRIGHT_IMPORT_PREFIX = 'Playwright Import'

test.describe.configure({ mode: 'serial' })

async function ingestFile(
  request: APIRequestContext,
  filename: string,
  extraFields?: Record<string, string>,
) {
  const filePath = path.join(FIXTURES, filename)
  const fileBuffer = fs.readFileSync(filePath)
  const mimeType =
    filename.endsWith('.xlsx') || filename.endsWith('.xls')
      ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      : 'text/csv'

  const res = await request.post('/api/ingest', {
    multipart: {
      file: {
        name: filename,
        mimeType,
        buffer: fileBuffer,
      },
      ...extraFields,
    },
  })
  const body = await res.json()
  return { res, body }
}

async function commitJob(
  request: APIRequestContext,
  params: {
    job_id: string
    target_table: string
    field_map: Record<string, string>
    rows: Record<string, string>[]
    skip_duplicates?: boolean
    force_all?: boolean
  },
) {
  const res = await request.post('/api/import/commit', {
    data: params,
  })
  const body = await res.json()
  return { res, body }
}

async function resolveConsumerOwnerId(
  admin: SupabaseClient,
  email: string,
): Promise<string | null> {
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 500 })
  if (error) return null
  const user = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())
  return user?.id ?? null
}

/** Delete assets whose names start with "Playwright Import" (service role when available). */
async function cleanupPlaywrightImportAssets() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  const email = resolveE2eEmail(
    process.env.PLAYWRIGHT_CONSUMER_EMAIL,
    E2E_IDENTITIES.consumer.email,
  )
  if (!url || !key || !email) return

  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const ownerId = await resolveConsumerOwnerId(admin, email)
  if (!ownerId) return

  await admin
    .from('assets')
    .delete()
    .eq('owner_id', ownerId)
    .like('name', `${PLAYWRIGHT_IMPORT_PREFIX}%`)
}

test.beforeAll(async () => {
  await cleanupPlaywrightImportAssets()
})

test.afterAll(async () => {
  await cleanupPlaywrightImportAssets()
})

test.describe('Import API — inline edit commit (Test 3)', () => {
  test('commits edited rows and skipped rows correctly', async ({ request }) => {
    const { res, body } = await ingestFile(request, 'import-sample.csv')
    expect(res.ok(), await res.text()).toBeTruthy()
    expect(body.rows).toHaveLength(2)

    const editedRows = [{ ...body.rows[0], value: '999000' }]

    const { res: commitRes, body: commitBody } = await commitJob(request, {
      job_id: body.job_id,
      target_table: 'assets',
      field_map: body.field_map,
      rows: editedRows,
      skip_duplicates: true,
    })

    expect(commitRes.ok(), await commitRes.text()).toBeTruthy()
    expect(commitBody.inserted_count).toBe(1)
  })
})

test.describe('Import API — duplicate detection (Test 4)', () => {
  test('returns 409 on duplicate import, then skips on second attempt', async ({ request }) => {
    await cleanupPlaywrightImportAssets()

    const { body: parseBody } = await ingestFile(request, 'import-sample.csv')
    const commitParams = {
      job_id: parseBody.job_id,
      target_table: 'assets',
      field_map: parseBody.field_map,
      rows: parseBody.rows,
    }

    const { res: firstCommit } = await commitJob(request, commitParams)
    expect(firstCommit.ok(), await firstCommit.text()).toBeTruthy()

    const { body: parseBody2 } = await ingestFile(request, 'import-sample.csv')
    const { res: dupRes, body: dupBody } = await commitJob(request, {
      ...commitParams,
      job_id: parseBody2.job_id,
    })

    expect(dupRes.status()).toBe(409)
    expect(dupBody.error).toBe('duplicates_found')
    expect(dupBody.duplicate_count).toBeGreaterThan(0)

    const { res: skipRes, body: skipBody } = await commitJob(request, {
      ...commitParams,
      job_id: parseBody2.job_id,
      skip_duplicates: true,
    })
    expect(skipRes.ok(), await skipRes.text()).toBeTruthy()
    expect(skipBody.inserted_count).toBe(0)
  })
})

test.describe('Import API — traceability (Test 5)', () => {
  test('commit response includes job_id for tracking', async ({ request }) => {
    const { body: parseBody } = await ingestFile(request, 'import-sample.csv')

    const { res, body } = await commitJob(request, {
      job_id: parseBody.job_id,
      target_table: 'assets',
      field_map: parseBody.field_map,
      rows: parseBody.rows,
      skip_duplicates: true,
    })

    expect(res.ok(), await res.text()).toBeTruthy()
    expect(body.job_id).toBe(parseBody.job_id)
    expect(body.job_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    )
  })

  test('committed rows have ingestion_job_id when service role available', async ({ request }) => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    const email = resolveE2eEmail(
      process.env.PLAYWRIGHT_CONSUMER_EMAIL,
      E2E_IDENTITIES.consumer.email,
    )
    test.skip(!url || !key || !email, 'SUPABASE_SERVICE_ROLE_KEY required for DB traceability assert')

    await cleanupPlaywrightImportAssets()

    const { body: parseBody } = await ingestFile(request, 'import-sample.csv')
    const { res, body } = await commitJob(request, {
      job_id: parseBody.job_id,
      target_table: 'assets',
      field_map: parseBody.field_map,
      rows: parseBody.rows,
      skip_duplicates: true,
    })
    expect(res.ok(), await res.text()).toBeTruthy()
    expect(body.inserted_count).toBeGreaterThan(0)

    const admin = createClient(url!, key!, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const ownerId = await resolveConsumerOwnerId(admin, email!)
    expect(ownerId).toBeTruthy()

    const { data: rows } = await admin
      .from('assets')
      .select('name, ingestion_job_id')
      .eq('owner_id', ownerId!)
      .eq('ingestion_job_id', parseBody.job_id)

    expect(rows?.length).toBeGreaterThan(0)
    for (const row of rows ?? []) {
      expect(row.name.startsWith(PLAYWRIGHT_IMPORT_PREFIX)).toBeTruthy()
    }
  })
})

test.describe('Import API — preamble CSV (Test 1 via API)', () => {
  test('parses preamble CSV correctly via API', async ({ request }) => {
    const { res, body } = await ingestFile(request, 'preamble.csv')
    expect(res.ok(), await res.text()).toBeTruthy()
    expect(body.header_row_index).toBe(3)
    expect(body.rows).toHaveLength(1)
    expect(body.rows[0].name).toBe('Primary Residence')
  })
})

test.describe('Import API — alias headers (Test 6 via API)', () => {
  test('auto-maps broker-style headers via API', async ({ request }) => {
    const { res, body } = await ingestFile(request, 'broker-aliases.csv')
    expect(res.ok(), await res.text()).toBeTruthy()
    expect(body.field_map['Current Market Value ($)']).toBe('value')
    expect(body.field_map['Account Name']).toBe('name')
    expect(body.field_map['Asset Category']).toBe('type')
  })
})

test.describe('Import API — Excel sheet (Test 2 via API)', () => {
  test('parses Assets sheet via sheet_name param', async ({ request }) => {
    const { res, body } = await ingestFile(request, 'two-sheets.xlsx', {
      sheet_name: 'Assets',
    })
    expect(res.ok(), await res.text()).toBeTruthy()
    expect(body.selected_sheet).toBe('Assets')
    expect(body.rows.some((r: Record<string, string>) => r.name === 'Playwright XLSX Asset')).toBeTruthy()
  })
})
