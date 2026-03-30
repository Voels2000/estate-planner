import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json() as {
    firm_name?: string
    contact_name?: string
    email?: string
    phone?: string
    city?: string
    state?: string
    bar_number?: string
    fee_structure?: string
    bio?: string
    website?: string
    serves_remote?: boolean
    specializations?: string[]
    states_licensed?: string[]
    languages?: string[]
  }

  if (!body.firm_name || !body.email || !body.state) {
    return NextResponse.json(
      { error: 'Firm name, email, and state are required.' },
      { status: 400 }
    )
  }

  const admin = createAdminClient()

  const { error } = await admin
    .from('attorney_listings')
    .insert({
      firm_name: body.firm_name,
      contact_name: body.contact_name ?? null,
      email: body.email,
      phone: body.phone ?? null,
      city: body.city ?? null,
      state: body.state,
      bar_number: body.bar_number ?? null,
      fee_structure: body.fee_structure ?? null,
      bio: body.bio ?? null,
      website: body.website ?? null,
      serves_remote: body.serves_remote ?? false,
      specializations: body.specializations ?? [],
      states_licensed: body.states_licensed ?? [],
      languages: body.languages ?? [],
      is_active: false,
      is_verified: false,
      submitted_by: user.id,
    })

  if (error) {
    console.error('attorney register:', error)
    return NextResponse.json({ error: 'Failed to submit listing.' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
