import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserAccess } from '@/lib/get-user-access'
import { hasFeatureAccess } from '@/lib/tiers'

const DELETABLE_STATUSES = new Set(['pending', 'mapped', 'failed'])

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const access = await getUserAccess()
    if (!hasFeatureAccess('import', access.tier, access.isAdvisor, access.isTrial)) {
      return NextResponse.json(
        { error: 'Import requires a Retirement or Estate plan' },
        { status: 403 },
      )
    }

    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: 'Job id required' }, { status: 400 })
    }

    const { data: job, error: fetchError } = await supabase
      .from('ingestion_jobs')
      .select('id, status')
      .eq('id', id)
      .eq('owner_id', user.id)
      .maybeSingle()

    if (fetchError) {
      console.error('ingestion_jobs fetch error:', fetchError)
      return NextResponse.json({ error: 'Failed to load import job' }, { status: 500 })
    }
    if (!job) {
      return NextResponse.json({ error: 'Import job not found' }, { status: 404 })
    }
    if (!DELETABLE_STATUSES.has(job.status)) {
      return NextResponse.json(
        { error: 'Only pending or failed imports can be removed' },
        { status: 400 },
      )
    }

    const { error: deleteError } = await supabase
      .from('ingestion_jobs')
      .delete()
      .eq('id', id)
      .eq('owner_id', user.id)

    if (deleteError) {
      console.error('ingestion_jobs delete error:', deleteError)
      return NextResponse.json({ error: 'Failed to delete import job' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Import job DELETE error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Delete failed' },
      { status: 500 },
    )
  }
}
