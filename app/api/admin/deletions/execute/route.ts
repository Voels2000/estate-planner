import { NextRequest, NextResponse } from 'next/server'
import {
  deleteUserData,
  type DeletionReason,
} from '@/lib/compliance/deleteUser'
import { requireAdminApi } from '@/lib/compliance/requireAdminApi'

const VALID_REASONS = new Set<DeletionReason>([
  'user_request',
  'subscription_cancelled',
  'admin_initiated',
  'account_closed',
])

export async function POST(request: NextRequest) {
  const auth = await requireAdminApi()
  if (auth instanceof NextResponse) return auth

  const body = await request.json()
  const {
    userId,
    email,
    reason,
    dryRun = false,
  }: {
    userId?: string
    email?: string
    reason?: string
    dryRun?: boolean
  } = body

  if (!userId || !email || !reason) {
    return NextResponse.json(
      { error: 'userId, email, and reason are required' },
      { status: 400 },
    )
  }

  if (!VALID_REASONS.has(reason as DeletionReason)) {
    return NextResponse.json({ error: 'Invalid reason' }, { status: 400 })
  }

  const result = await deleteUserData({
    userId,
    email,
    reason: reason as DeletionReason,
    initiatedBy: auth.userId,
    dryRun: Boolean(dryRun),
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  })

  return NextResponse.json(result, {
    status: result.success ? 200 : 500,
  })
}
