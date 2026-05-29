import { NextRequest, NextResponse } from 'next/server'
import { notifyAdvisorForReferralCode } from '@/lib/advisor/notifyAdvisorOfReferredSignup'

export async function POST(req: NextRequest) {
  try {
    const { referralCode, consumerName, consumerEmail } = (await req.json()) as {
      referralCode?: string
      consumerName?: string | null
      consumerEmail?: string
    }

    if (!referralCode?.trim() || !consumerEmail?.trim()) {
      return NextResponse.json({ error: 'referralCode and consumerEmail required' }, { status: 400 })
    }

    void notifyAdvisorForReferralCode({
      referralCode: referralCode.trim(),
      consumerName: consumerName ?? null,
      consumerEmail: consumerEmail.trim(),
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('notify-referral-signup error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
