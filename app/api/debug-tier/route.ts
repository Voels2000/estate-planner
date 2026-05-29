
import { getUserAccess } from '@/lib/get-user-access'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  if (process.env.VERCEL_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const access = await getUserAccess()
  return NextResponse.json(access)
}
