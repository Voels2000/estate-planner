import { NextRequest, NextResponse } from 'next/server'
import { getAccessContext } from '@/lib/access/getAccessContext'
import { createClient } from '@/lib/supabase/server'

const BUCKET = 'advisor-branding'
const MAX_BYTES = 2 * 1024 * 1024
const ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp'])

const EXT_BY_TYPE: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
}

function publicLogoUrl(supabaseUrl: string, userId: string, ext: string): string {
  const base = supabaseUrl.replace(/\/$/, '')
  return `${base}/storage/v1/object/public/${BUCKET}/${userId}/logo.${ext}`
}

export async function POST(req: NextRequest) {
  const ctx = await getAccessContext()
  if (!ctx.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!ctx.isAdvisor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const formData = await req.formData()
  const file = formData.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'file is required' }, { status: 400 })
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: 'Logo must be PNG, JPEG, or WebP' }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Logo must be 2 MB or smaller' }, { status: 400 })
  }

  const ext = EXT_BY_TYPE[file.type] ?? 'png'
  const storagePath = `${ctx.user.id}/logo.${ext}`
  const buffer = await file.arrayBuffer()

  const supabase = await createClient()
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, buffer, {
    contentType: file.type,
    upsert: true,
  })

  if (uploadError) {
    console.error('[advisor/profile/logo POST]', uploadError)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!supabaseUrl) {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  }

  const firm_logo_url = publicLogoUrl(supabaseUrl, ctx.user.id, ext)
  const { data, error } = await supabase
    .from('profiles')
    .update({ firm_logo_url })
    .eq('id', ctx.user.id)
    .select('full_name, email, firm_name, phone, firm_logo_url')
    .single()

  if (error || !data) {
    console.error('[advisor/profile/logo POST profile]', error)
    return NextResponse.json({ error: 'Failed to save logo URL' }, { status: 500 })
  }

  return NextResponse.json({ profile: data, firm_logo_url })
}

export async function DELETE() {
  const ctx = await getAccessContext()
  if (!ctx.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!ctx.isAdvisor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const supabase = await createClient()

  const { data: objects } = await supabase.storage.from(BUCKET).list(ctx.user.id)
  const logoObjects = (objects ?? []).filter((o) => o.name?.startsWith('logo.'))
  if (logoObjects.length > 0) {
    const paths = logoObjects.map((o) => `${ctx.user.id}/${o.name}`)
    const { error: removeError } = await supabase.storage.from(BUCKET).remove(paths)
    if (removeError) {
      console.error('[advisor/profile/logo DELETE storage]', removeError)
    }
  }

  const { data, error } = await supabase
    .from('profiles')
    .update({ firm_logo_url: null })
    .eq('id', ctx.user.id)
    .select('full_name, email, firm_name, phone, firm_logo_url')
    .single()

  if (error || !data) {
    console.error('[advisor/profile/logo DELETE profile]', error)
    return NextResponse.json({ error: 'Failed to remove logo' }, { status: 500 })
  }

  return NextResponse.json({ profile: data })
}
