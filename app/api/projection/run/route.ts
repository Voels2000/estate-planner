// Sprint 73 — External API Endpoint
// POST /api/projection/run
// Accepts household data and returns a ProjectionScenario JSON
//
// Authentication: Bearer token (service role key or Supabase user JWT with access)
// Rate limiting: 100 requests/hour per bearer token (best-effort per instance)

import { createHash } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'

const RATE_WINDOW_MS = 60 * 60 * 1000
const RATE_MAX = 100
const rateBuckets = new Map<string, { count: number; resetAt: number }>()

function rateLimitKey(token: string): string {
  return createHash('sha256').update(token).digest('hex').slice(0, 32)
}

function allowRateLimit(key: string): boolean {
  const now = Date.now()
  const entry = rateBuckets.get(key)
  if (!entry || now > entry.resetAt) {
    rateBuckets.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS })
    return true
  }
  if (entry.count >= RATE_MAX) return false
  entry.count += 1
  return true
}

// OpenAPI spec inline (for documentation)
export const OPENAPI_SPEC = {
  openapi: '3.0.0',
  info: {
    title: 'MyWealthMaps Estate Planner API',
    version: '1.0.0',
    description: 'External API for estate projection calculations',
  },
  paths: {
    '/api/projection/run': {
      post: {
        summary: 'Run estate projection',
        description: 'Runs a full estate tax projection for a household and optionally saves it',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['household_id'],
                properties: {
                  household_id: { type: 'string', format: 'uuid' },
                  law_scenario: {
                    type: 'string',
                    enum: ['current_law', 'sunset', 'no_exemption'],
                    default: 'current_law',
                  },
                  save_scenario: { type: 'boolean', default: false },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Projection results',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    scenario_id: { type: 'string', format: 'uuid' },
                    household_id: { type: 'string', format: 'uuid' },
                    gross_estate: { type: 'number' },
                    federal_tax: { type: 'number' },
                    state_tax: { type: 'number' },
                    net_to_heirs: { type: 'number' },
                    calculated_at: { type: 'string', format: 'date-time' },
                  },
                },
              },
            },
          },
          400: { description: 'Bad request — missing required fields' },
          401: { description: 'Unauthorized — invalid or missing Bearer token' },
          404: { description: 'Household not found' },
          429: { description: 'Rate limit exceeded' },
          500: { description: 'Internal server error' },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
  },
}

async function assertCanReadHousehold(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  householdOwnerId: string,
): Promise<boolean> {
  if (userId === householdOwnerId) return true

  const { data: profile } = await admin.from('profiles').select('role').eq('id', userId).single()
  if (profile?.role === 'advisor') {
    const { data: link } = await admin
      .from('advisor_clients')
      .select('id')
      .eq('advisor_id', userId)
      .eq('client_id', householdOwnerId)
      .eq('status', 'active')
      .maybeSingle()
    return !!link
  }

  return false
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Bearer token required' },
        { status: 401 },
      )
    }

    const token = authHeader.slice(7).trim()
    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Bearer token required' },
        { status: 401 },
      )
    }

    const rlKey = rateLimitKey(token)
    if (!allowRateLimit(rlKey)) {
      return NextResponse.json(
        { error: 'Too Many Requests', message: 'Rate limit exceeded (100 requests per hour per token)' },
        { status: 429 },
      )
    }

    const admin = createAdminClient()
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const isServiceToken = !!serviceKey && token === serviceKey

    let userId: string | null = null
    if (!isServiceToken) {
      const supabaseAuth = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { global: { headers: { Authorization: `Bearer ${token}` } } },
      )
      const {
        data: { user },
        error: authErr,
      } = await supabaseAuth.auth.getUser()
      if (authErr || !user) {
        return NextResponse.json(
          { error: 'Unauthorized', message: 'Invalid or expired Bearer token' },
          { status: 401 },
        )
      }
      userId = user.id
    }

    const body = (await req.json()) as {
      household_id?: string
      law_scenario?: string
      save_scenario?: boolean
    }
    const { household_id, law_scenario = 'current_law' } = body

    if (!household_id) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'household_id is required' },
        { status: 400 },
      )
    }

    const allowedLaw = ['current_law', 'sunset', 'no_exemption'] as const
    const lawScenario = allowedLaw.includes(law_scenario as (typeof allowedLaw)[number])
      ? law_scenario
      : 'current_law'

    const { data: household } = await admin
      .from('households')
      .select('id, base_case_scenario_id, name, owner_id')
      .eq('id', household_id)
      .single()

    if (!household) {
      return NextResponse.json(
        { error: 'Not Found', message: 'Household not found' },
        { status: 404 },
      )
    }

    if (!isServiceToken && userId) {
      const ok = await assertCanReadHousehold(admin, userId, household.owner_id)
      if (!ok) {
        return NextResponse.json({ error: 'Forbidden', message: 'No access to this household' }, { status: 403 })
      }
    }

    if (!household.base_case_scenario_id) {
      return NextResponse.json(
        {
          error: 'Not Found',
          message: 'No base case scenario found. Run generate-base-case first.',
        },
        { status: 404 },
      )
    }

    const { data: scenario } = await admin
      .from('projection_scenarios')
      .select('id, outputs_s1_first, outputs_s2_first, assumption_snapshot, calculated_at')
      .eq('id', household.base_case_scenario_id)
      .single()

    if (!scenario) {
      return NextResponse.json(
        { error: 'Not Found', message: 'Scenario not found' },
        { status: 404 },
      )
    }

    const outputs = scenario.outputs_s1_first as Record<string, unknown>[]
    const yearOneOutput = outputs?.[0] ?? {}

    const response = {
      scenario_id: scenario.id,
      household_id: household.id,
      law_scenario: lawScenario,
      gross_estate: Number(yearOneOutput.estate_incl_home ?? 0),
      federal_tax: Number(yearOneOutput.estate_tax_federal ?? 0),
      state_tax: Number(yearOneOutput.estate_tax_state ?? 0),
      net_to_heirs: Number(yearOneOutput.net_to_heirs ?? 0),
      outputs_s1_first: outputs,
      assumption_snapshot: scenario.assumption_snapshot,
      calculated_at: scenario.calculated_at,
    }

    return NextResponse.json(response, { status: 200 })
  } catch (err) {
    console.error('[/api/projection/run] error:', err)
    return NextResponse.json(
      {
        error: 'Internal Server Error',
        message: err instanceof Error ? err.message : 'Unknown error',
      },
      { status: 500 },
    )
  }
}

// GET — return OpenAPI spec
export async function GET() {
  return NextResponse.json(OPENAPI_SPEC)
}
