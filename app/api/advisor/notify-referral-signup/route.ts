import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { notifyAdvisorForReferralCode } from '@/lib/advisor/notifyAdvisorOfReferredSignup'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { referralCode, consumerName, consumerEmail } = (await req.json()) as {
      referralCode?: string
      consumerName?: string | null
      consumerEmail?: string
    }

    if (!referralCode?.trim() || !consumerEmail?.trim()) {
      return NextResponse.json({ error: 'referralCode and consumerEmail required' }, { status: 400 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('referral_code, email, full_name')
      .eq('id', user.id)
      .single()

    const normalizedEmail = consumerEmail.trim().toLowerCase()
    if (
      !profile?.referral_code ||
      profile.referral_code.trim() !== referralCode.trim() ||
      (profile.email?.trim().toLowerCase() ?? '') !== normalizedEmail
    ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    void notifyAdvisorForReferralCode({
      referralCode: referralCode.trim(),
      consumerName: consumerName ?? profile.full_name ?? null,
      consumerEmail: normalizedEmail,
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('notify-referral-signup error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
