import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/** Throw a test error for Sentry preview verification — disabled in production. */
export async function GET() {
  if (process.env.VERCEL_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  throw new Error('sentry preview test ' + Date.now())
}
