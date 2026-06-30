import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyClaimIdentity } from '@/lib/directory/claimIdentity'
import { resolveDirectoryClaimToken } from '@/lib/directory/resolveClaimToken'
import { ensureAttorneyActivationDripStep1 } from '@/lib/attorney/sendAttorneyDripStep'

type ClaimBody = {
  claimToken: string
  contact_name?: string
  firm_name?: string
  phone?: string
  website?: string
  bio?: string
  bar_number?: string
  bar_state?: string
  states_licensed?: string[]
  specializations?: string[]
  serves_remote?: boolean
  crd_number?: string
  credentials?: string[]
  is_fiduciary?: boolean
  fee_structure?: string
  adv_link?: string
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user?.email) {
    return NextResponse.json({ error: 'Sign in to claim your listing.' }, { status: 401 })
  }

  const body = (await req.json()) as ClaimBody
  const claimToken = body.claimToken?.trim()
  if (!claimToken) {
    return NextResponse.json({ error: 'Missing claim token.' }, { status: 400 })
  }

  const admin = createAdminClient()
  const target = await resolveDirectoryClaimToken(admin, claimToken)
  if (!target) {
    return NextResponse.json({ error: 'This claim link is invalid or expired.' }, { status: 404 })
  }

  const listing = target.listing
  const listingEmail = String(listing.email ?? '')
  const listingWebsite = String(listing.website ?? listing.adv_link ?? '')

  const identity = verifyClaimIdentity(user.email, listingEmail, listingWebsite)
  if (!identity.ok) {
    return NextResponse.json({ error: identity.reason, needsReview: identity.needsReview }, { status: 403 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_attorney')
    .eq('id', user.id)
    .single()

  if (target.type === 'attorney') {
    if (profile?.role !== 'attorney' && !profile?.is_attorney) {
      return NextResponse.json(
        { error: 'Sign in with an attorney account to claim this listing.' },
        { status: 403 },
      )
    }
  } else if (profile?.role !== 'advisor') {
    return NextResponse.json(
      { error: 'Sign in with an advisor account to claim this listing.' },
      { status: 403 },
    )
  }

  const existingProfileId = listing.profile_id as string | null
  if (existingProfileId && existingProfileId !== user.id) {
    return NextResponse.json({ error: 'This listing has already been claimed.' }, { status: 409 })
  }

  const now = new Date().toISOString()
  const shared = {
    contact_name: body.contact_name?.trim() || listing.contact_name,
    firm_name: body.firm_name?.trim() || listing.firm_name,
    phone: body.phone?.trim() ?? listing.phone,
    website: body.website?.trim() ?? listing.website,
    bio: body.bio?.trim() ?? listing.bio,
    profile_id: user.id,
    claimed_at: (listing.claimed_at as string | null) ?? now,
  }

  if (target.type === 'attorney') {
    const statesLicensed = body.states_licensed?.length
      ? body.states_licensed
      : (listing.states_licensed as string[] | undefined) ?? []
    const barState = body.bar_state?.trim().toUpperCase() || String(listing.state ?? '')
    const withBarState =
      barState && !statesLicensed.includes(barState) ? [barState, ...statesLicensed] : statesLicensed

    const { error } = await admin
      .from('attorney_listings')
      .update({
        ...shared,
        bar_number: body.bar_number?.trim() || listing.bar_number || null,
        states_licensed: withBarState,
        specializations: body.specializations ?? listing.specializations ?? [],
        serves_remote: body.serves_remote ?? listing.serves_remote ?? false,
      })
      .eq('id', listing.id)

    if (error) {
      console.error('directory claim attorney:', error)
      return NextResponse.json({ error: 'Failed to save claim.' }, { status: 500 })
    }

    await admin.from('profiles').update({ is_attorney: true }).eq('id', user.id)

    void ensureAttorneyActivationDripStep1(admin, user.id).catch((err) => {
      console.error('attorney drip step 1 (directory claim):', err instanceof Error ? err.message : err)
    })

    try {
      await notifyDirectoryClaim({
        type: 'attorney',
        firmName: String(shared.firm_name),
        contactName: shared.contact_name ? String(shared.contact_name) : null,
        userEmail: user.email,
        barNumber: body.bar_number?.trim() || null,
        listingId: listing.id,
      })
    } catch (emailErr) {
      console.error('directory claim notify:', emailErr)
    }
  } else {
    const { error } = await admin
      .from('advisor_directory')
      .update({
        ...shared,
        crd_number: body.crd_number?.trim() || listing.crd_number || null,
        credentials: body.credentials ?? listing.credentials ?? [],
        specializations: body.specializations ?? listing.specializations ?? [],
        is_fiduciary: body.is_fiduciary ?? listing.is_fiduciary ?? false,
        fee_structure: body.fee_structure?.trim() ?? listing.fee_structure,
        adv_link: body.adv_link?.trim() ?? listing.adv_link ?? listing.website,
      })
      .eq('id', listing.id)

    if (error) {
      console.error('directory claim advisor:', error)
      return NextResponse.json({ error: 'Failed to save claim.' }, { status: 500 })
    }

    try {
      await notifyDirectoryClaim({
        type: 'advisor',
        firmName: String(shared.firm_name),
        contactName: shared.contact_name ? String(shared.contact_name) : null,
        userEmail: user.email,
        crdNumber: body.crd_number?.trim() || null,
        listingId: listing.id,
      })
    } catch (emailErr) {
      console.error('directory claim notify:', emailErr)
    }
  }

  return NextResponse.json({
    success: true,
    type: target.type,
    identityMethod: identity.method,
  })
}
