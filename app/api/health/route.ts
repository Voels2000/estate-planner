import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** Lightweight liveness probe — no auth, no Supabase. */
export async function GET() {
  return NextResponse.json({ ok: true, ts: Date.now() })
}
