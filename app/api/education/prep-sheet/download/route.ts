import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { hasPaidDownloadAccess } from '@/lib/access/requirePaidDownloadAccess'

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, consumer_tier, subscription_status')
    .eq('id', user.id)
    .single()

  if (
    !hasPaidDownloadAccess(
      {
        role: profile?.role ?? null,
        consumer_tier: profile?.consumer_tier ?? null,
        subscription_status: profile?.subscription_status ?? null,
      },
      1,
    )
  ) {
    return NextResponse.json(
      { error: 'Paid active subscription required to download prep sheets' },
      { status: 403 },
    )
  }

  const today = new Date().toISOString().slice(0, 10)
  const contents = [
    'PlanWise Advisor Prep Sheet',
    `Generated: ${today}`,
    '',
    '1) Financial Priorities',
    '- Cash flow and emergency reserves',
    '- Debt, insurance, and tax review',
    '',
    '2) Retirement Priorities',
    '- Income sources and withdrawal sequencing',
    '- RMD and Roth conversion questions',
    '',
    '3) Estate Priorities',
    '- Core document status and beneficiary review',
    '- Titling and transfer coordination',
    '',
    'Educational use only. Not legal, tax, or investment advice.',
  ].join('\n')

  return new NextResponse(contents, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': `attachment; filename="advisor-prep-sheet-${today}.txt"`,
    },
  })
}

