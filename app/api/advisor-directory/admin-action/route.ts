import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

async function verifyAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_admin')
    .eq('id', user.id)
    .single()
  return profile?.role === 'admin' || profile?.is_admin === true
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    if (!await verifyAdmin(supabase)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { listing_id, action } = await req.json()
    if (!listing_id || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'listing_id and action (approve|reject) are required' }, { status: 400 })
    }

    const admin = createAdminClient()

    // Fetch the listing
    const { data: listing, error: fetchError } = await admin
      .from('advisor_directory')
      .select('id, firm_name, email, contact_name')
      .eq('id', listing_id)
      .single()

    if (fetchError || !listing) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
    }

    if (action === 'approve') {
      const { error: updateError } = await admin
        .from('advisor_directory')
        .update({ is_active: true, is_verified: true })
        .eq('id', listing_id)

      if (updateError) throw updateError

      // Email advisor — approval notification
      try {
        await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/email/advisor-notify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: listing.email,
            advisorName: listing.contact_name ?? listing.firm_name,
            subject: 'Your advisor listing has been approved',
            message: `Your listing for ${listing.firm_name} has been approved and is now live in the advisor directory.`,
            bcc: 'avoels@comcast.net',
          }),
        })
      } catch (emailError) {
        console.error('admin-action approve email error:', emailError)
      }

      return NextResponse.json({ success: true, action: 'approved' })
    }

    if (action === 'reject') {
      // Email advisor before deleting
      try {
        await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/email/advisor-notify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: listing.email,
            advisorName: listing.contact_name ?? listing.firm_name,
            subject: 'Your advisor listing was not approved',
            message: `We reviewed the listing submission for ${listing.firm_name} and were unable to approve it at this time. Please contact us if you have questions.`,
            bcc: 'avoels@comcast.net',
          }),
        })
      } catch (emailError) {
        console.error('admin-action reject email error:', emailError)
      }

      const { error: deleteError } = await admin
        .from('advisor_directory')
        .delete()
        .eq('id', listing_id)

      if (deleteError) throw deleteError

      return NextResponse.json({ success: true, action: 'rejected' })
    }

  } catch (error) {
    console.error('advisor admin-action error:', error)
    return NextResponse.json({ error: 'Action failed' }, { status: 500 })
  }
}
