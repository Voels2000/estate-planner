import { NextResponse } from 'next/server'
import { buildConsumerOpenApiSpec } from '@/lib/api/openapi/buildConsumerOpenApiSpec'
import { discoverConsumerApiRoutes } from '@/lib/api/openapi/discoverConsumerApiRoutes'

export const dynamic = 'force-dynamic'

export async function GET() {
  const routes = discoverConsumerApiRoutes()
  const spec = buildConsumerOpenApiSpec(routes)
  return NextResponse.json(spec)
}
