import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { loadSocialSecurityData } from '@/lib/social-security/loadSocialSecurityData'

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const data = await loadSocialSecurityData(supabase, user.id)
    if (!data) {
      return NextResponse.json({ error: 'Household not found' }, { status: 404 })
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error('SS route error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
