import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'advisor') {
      return NextResponse.json({ error: 'Only advisors can register listings' }, { status: 403 })
    }

    const body = await req.json()
    const {
      firm_name, contact_name, email, website, city, state, zip_code,
      bio, credentials, specializations, fee_structure, minimum_assets,
      is_fiduciary, serves_remote, languages, adv_link, submitted_by,
    } = body

    if (!firm_name || !email) {
      return NextResponse.json({ error: 'Firm name and email are required' }, { status: 400 })
    }

    const { error } = await supabase
      .from('advisor_directory')
      .insert({
        firm_name, contact_name, email, website, city, state, zip_code,
        bio, credentials, specializations, fee_structure, minimum_assets,
        is_fiduciary, serves_remote, languages, adv_link,
        submitted_by,
        is_verified: false,
        is_active: false, // Requires admin approval before going live
      })

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Advisor register POST error:', error)
    return NextResponse.json({ error: 'Failed to submit listing' }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const {
      existingId, firm_name, contact_name, email, website, city, state, zip_code,
      bio, credentials, specializations, fee_structure, minimum_assets,
      is_fiduciary, serves_remote, languages, adv_link,
    } = body

    if (!existingId || !firm_name || !email) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const { error } = await supabase
      .from('advisor_directory')
      .update({
        firm_name, contact_name, email, website, city, state, zip_code,
        bio, credentials, specializations, fee_structure, minimum_assets,
        is_fiduciary, serves_remote, languages, adv_link,
      })
      .eq('id', existingId)
      .eq('submitted_by', user.id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Advisor register PUT error:', error)
    return NextResponse.json({ error: 'Failed to update listing' }, { status: 500 })
  }
}
