import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()

  const { data: rows } = await supabase
    .from('app_config')
    .select('key, value')
    .in('key', ['terms_version', 'terms_sections'])

  const versionRow  = rows?.find(r => r.key === 'terms_version')
  const sectionsRow = rows?.find(r => r.key === 'terms_sections')

  const version = versionRow?.value ?? '2026-03-31'
  const sections = (() => {
    try { return JSON.parse(sectionsRow?.value ?? '[]') } catch { return [] }
  })()

  return NextResponse.json({ version, sections })
}
