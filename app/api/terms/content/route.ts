import { getCanonicalTerms } from '@/lib/terms/getCanonicalTerms'
import { NextResponse } from 'next/server'

export async function GET() {
  const { version, sections } = getCanonicalTerms()
  return NextResponse.json({ version, sections })
}
