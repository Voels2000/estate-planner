import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAccessContext } from '@/lib/access/getAccessContext'
import { requireAdminApi } from '@/lib/compliance/requireAdminApi'

export async function PATCH(req: Request) {
  try {
    const auth = await requireAdminApi()
    if (auth instanceof NextResponse) return auth
    const { isSuperuser, user } = await getAccessContext()

    const supabase = await createClient()
    const { id, field, value } = await req.json()
    if (!id || !field) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    const allowedFields = ['is_verified', 'is_active']
    if (!allowedFields.includes(field)) {
      return NextResponse.json({ error: 'Invalid field' }, { status: 400 })
    }
    const { error } = await supabase
      .from('attorney_listings')
      .update({ [field]: value })
      .eq('id', id)
    if (error) throw error
    if (isSuperuser) {
      const admin = createAdminClient()
      await admin.from('superuser_action_log').insert({
        user_id: user.id,
        endpoint: '/api/attorney-directory/admin',
        target_id: id,
        action: 'update',
      })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Admin attorney directory PATCH error:', error)
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const auth = await requireAdminApi()
    if (auth instanceof NextResponse) return auth
    const { isSuperuser, user } = await getAccessContext()

    const { id } = await req.json()
    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    }
    const admin = createAdminClient()
    const { error } = await admin
      .from('attorney_listings')
      .delete()
      .eq('id', id)
    if (error) throw error
    if (isSuperuser) {
      await admin.from('superuser_action_log').insert({
        user_id: user.id,
        endpoint: '/api/attorney-directory/admin',
        target_id: id,
        action: 'delete',
      })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Admin attorney directory DELETE error:', error)
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 })
  }
}
