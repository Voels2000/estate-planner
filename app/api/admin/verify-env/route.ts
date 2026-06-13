import { NextRequest, NextResponse } from 'next/server'
import { verifyEnvironment } from '@/lib/env/verifyEnv'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function isTokenAuthorized(request: NextRequest): boolean {
  const expected = process.env.ADMIN_VERIFY_TOKEN?.trim()
  if (!expected) return false
  const provided = request.headers.get('x-admin-token')?.trim()
  return provided === expected
}

export async function GET(request: NextRequest) {
  if (!isTokenAuthorized(request)) {
    return new NextResponse(null, { status: 404 })
  }

  const live = request.nextUrl.searchParams.get('live') === '1'
  const report = await verifyEnvironment({ live })

  return NextResponse.json(report, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  })
}
