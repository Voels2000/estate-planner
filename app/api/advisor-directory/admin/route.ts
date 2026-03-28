import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function verifyAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  return profile?.role === 'admin'
}

export async function PATCH(req: Request) {
  try {
    const supabase = await createClient()
    if (!await verifyAdmin(supabase)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { id, field, value } = await req.json()
    if (!id || !field) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    const allowedFields = ['is_verified', 'is_active']
    if (!allowedFields.includes(field)) {
      return NextResponse.json({ error: 'Invalid field' }, { status: 400 })
    }
    const { error } = await supabase
      .from('advisor_directory')
      .update({ [field]: value })
      .eq('id', id)
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Admin advisor directory PATCH error:', error)
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const supabase = await createClient()
    if (!await verifyAdmin(supabase)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { id } = await req.json()
    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    }
    const { error } = await supabase
      .from('advisor_directory')
      .delete()
      .eq('id', id)
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Admin advisor directory DELETE error:', error)
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 })
  }
}
