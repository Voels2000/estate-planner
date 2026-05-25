import { NextResponse } from 'next/server'
import { getAccessContext } from '@/lib/access/getAccessContext'

/** Returns admin user id, or a NextResponse error to return from the route handler. */
export async function requireAdminApi(): Promise<
  { userId: string } | NextResponse
> {
  const { user, isAdmin } = await getAccessContext()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  return { userId: user.id }
}
