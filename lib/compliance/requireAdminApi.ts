import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAccessContext } from '@/lib/access/getAccessContext'
import {
  isPrivilegedMfaEnforcementEnabled,
  privilegedMfaSatisfied,
} from '@/lib/security/privilegedMfaPolicy'

/** Returns admin user id, or a NextResponse error to return from the route handler. */
export async function requireAdminApi(): Promise<
  { userId: string } | NextResponse
> {
  const { user, isAdmin, profile } = await getAccessContext()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (isPrivilegedMfaEnforcementEnabled() && profile) {
    const supabase = await createClient()
    const satisfied = await privilegedMfaSatisfied(supabase, profile)
    if (!satisfied) {
      return NextResponse.json(
        { error: 'MFA enrollment required for admin access' },
        { status: 403 },
      )
    }
  }

  return { userId: user.id }
}
