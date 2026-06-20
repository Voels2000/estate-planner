import type { DiscoveredConsumerRoute } from './discoverConsumerApiRoutes'

const STANDARD_ERRORS = {
  400: { description: 'Bad request — validation failed' },
  401: { description: 'Unauthorized — no Supabase session cookie' },
  403: { description: 'Forbidden — household access denied' },
  404: { description: 'Not found' },
  500: { description: 'Internal server error' },
} as const

const ROUTE_SUMMARIES: Record<string, string> = {
  '/api/consumer/profile': 'Update profile and household fields (partial PATCH merge)',
  '/api/consumer/growth-assumptions': 'Patch financial growth assumptions on owned household',
  '/api/consumer/strategy-recommendation':
    'Accept (PATCH) or decline (DELETE) advisor strategy line items',
  '/api/consumer/generate-base-case': 'Regenerate base-case scenario for household',
  '/api/consumer/estate-health-check': 'Persist estate health check answers',
  '/api/consumer/privacy-request': 'Submit privacy rights request',
  '/api/consumer/delete-account': 'Schedule self-serve account deletion',
  '/api/consumer/setup-progress': 'Read onboarding setup progress',
  '/api/consumer/estate-checklist': 'Read or update estate execution checklist',
}

function defaultSummary(pathname: string): string {
  const slug = pathname.replace('/api/consumer/', '').replace(/\//g, ' ')
  return `Consumer API — ${slug || 'root'}`
}

function tagFromPath(pathname: string): string {
  const segment = pathname.replace('/api/consumer/', '').split('/')[0] ?? 'consumer'
  return segment.replace(/-/g, ' ')
}

function buildPathItem(route: DiscoveredConsumerRoute) {
  const item: Record<string, unknown> = {}
  for (const method of route.methods) {
    item[method.toLowerCase()] = {
      summary: ROUTE_SUMMARIES[route.path] ?? defaultSummary(route.path),
      tags: [tagFromPath(route.path)],
      security: [{ cookieSession: [] }],
      responses: {
        200: { description: 'Success' },
        201: { description: 'Created' },
        ...STANDARD_ERRORS,
      },
    }
  }
  return item
}

export type ConsumerOpenApiSpec = {
  openapi: '3.0.0'
  info: {
    title: string
    version: string
    description: string
  }
  paths: Record<string, unknown>
  components: {
    securitySchemes: Record<string, unknown>
    schemas: Record<string, unknown>
  }
}

export function buildConsumerOpenApiSpec(
  routes: DiscoveredConsumerRoute[],
): ConsumerOpenApiSpec {
  const paths: Record<string, unknown> = {}

  for (const route of routes) {
    if (route.path === '/api/consumer/openapi') continue
    paths[route.path] = buildPathItem(route)
  }

  return {
    openapi: '3.0.0',
    info: {
      title: 'My Wealth Maps Consumer API',
      version: '1.0.0',
      description:
        'Authenticated consumer dashboard API. Session auth via Supabase SSR cookies (browser) — not Bearer tokens. Most write routes require household ownership or assertHouseholdAccess.',
    },
    paths,
    components: {
      securitySchemes: {
        cookieSession: {
          type: 'apiKey',
          in: 'cookie',
          name: 'sb-auth-token',
          description: 'Supabase session cookie set by SSR auth (project-specific cookie name).',
        },
      },
      schemas: {
        HouseholdIdBody: {
          type: 'object',
          required: ['householdId'],
          properties: {
            householdId: { type: 'string', format: 'uuid' },
          },
        },
        HouseholdIdSnakeBody: {
          type: 'object',
          required: ['household_id'],
          properties: {
            household_id: { type: 'string', format: 'uuid' },
          },
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
    },
  }
}
