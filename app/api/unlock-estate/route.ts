import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCompletionScore } from '@/lib/get-completion-score'

export const dynamic = 'force-dynamic'

export async function POST() {
  // 1. Auth check
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Confirm they're a consumer (not advisor)
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, consumer_tier')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'consumer') {
    return NextResponse.json({ error: 'Not applicable' }, { status: 400 })
  }

  if (profile.consumer_tier >= 3) {
    return NextResponse.json({ already_unlocked: true })
  }

  // 3. Re-run completion check server-side
  const score = await getCompletionScore(user.id)

  if (!score.unlocked) {
    return NextResponse.json({
      error: 'Threshold not met',
      completed: score.completed,
      threshold: score.threshold,
    }, { status: 400 })
  }

  // 4. Upgrade to Tier 3
  const admin = createAdminClient()
  const { error: updateError } = await admin
    .from('profiles')
    .update({ consumer_tier: 3 })
    .eq('id', user.id)

  if (updateError) {
    console.error('unlock-estate: update error', updateError)
    return NextResponse.json({ error: 'Failed to upgrade tier' }, { status: 500 })
  }

  // 5. Fire in-app notification (fire-and-forget)
  ;(async () => {
    try {
      await admin.rpc('create_notification', {
        p_user_id: user.id,
        p_type: 'estate_milestone',
        p_title: '🎉 Estate Planning unlocked!',
        p_body: 'You\'ve completed your Retirement Planning profile. Estate Planning features are now available.',
        p_metadata: { unlocked_tier: 3 },
        p_delivery: 'both',
        p_cooldown: '1 hour',
      })
    } catch (err) {
      console.error('unlock-estate: notification error', err)
    }
  })()

  return NextResponse.json({ success: true, unlocked: true })
}
