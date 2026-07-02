import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { completeIntakeRequestForUser } from '@/lib/attorney/completeIntakeRequest'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { intakeToken } = (await req.json()) as { intakeToken?: string }
  if (!intakeToken?.trim()) {
    return NextResponse.json({ error: 'intakeToken required' }, { status: 400 })
  }

  const result = await completeIntakeRequestForUser(
    supabase,
    user.id,
    user.email,
    intakeToken,
  )

  if (!result.ok) {
    return NextResponse.json(
      {
        error: result.error,
        ...(result.quantity != null ? { quantity: result.quantity } : {}),
        ...(result.currentLimit != null ? { currentLimit: result.currentLimit } : {}),
        ...(result.connected_count != null ? { connected_count: result.connected_count } : {}),
        ...(result.billing_floor != null ? { billing_floor: result.billing_floor } : {}),
      },
      { status: result.status },
    )
  }

  return NextResponse.json({ success: true, listingId: result.listingId })
}
