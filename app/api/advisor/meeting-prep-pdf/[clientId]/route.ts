import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { CONNECTED_ADVISOR_CLIENT_STATUSES } from '@/lib/advisor/clientConnectionStatus'
import { loadAdvisorExportWiringForClient } from '@/lib/advisor/loadAdvisorExportWiring'
import { generatePDFHTML } from '@/lib/export/generatePDFReport'

interface RouteParams {
  params: Promise<{ clientId: string }>
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function fmt(n: number | null): string {
  if (n == null || Number.isNaN(n)) return '—'
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${Math.round(n).toLocaleString()}`
}

async function renderMeetingBriefHtml(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clientId: string,
  advisorUserId: string,
): Promise<string | null> {
  const { data: clientAccess } = await supabase
    .from('advisor_clients')
    .select('id, client_id')
    .eq('advisor_id', advisorUserId)
    .eq('client_id', clientId)
    .in('status', [...CONNECTED_ADVISOR_CLIENT_STATUSES])
    .maybeSingle()

  if (!clientAccess) return null

  const { data: household } = await supabase
    .from('households')
    .select('id')
    .eq('owner_id', clientId)
    .maybeSingle()

  const householdId = household?.id
  if (!householdId) return null

  const [clientProfileRes, healthScoreRes, alertsRes, projectionRes, noteRes, compositionRes] =
    await Promise.all([
      supabase.from('profiles').select('full_name, email').eq('id', clientId).single(),
      supabase
        .from('estate_health_scores')
        .select('score, computed_at')
        .eq('household_id', householdId)
        .maybeSingle(),
      supabase
        .from('household_alerts')
        .select('title, severity, description')
        .eq('household_id', householdId)
        .is('resolved_at', null)
        .is('dismissed_at', null)
        .order('severity', { ascending: false })
        .limit(3),
      supabase
        .from('projection_scenarios')
        .select('outputs_s1_first, status')
        .eq('household_id', householdId)
        .eq('status', 'saved')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('advisor_notes')
        .select('content, created_at')
        .eq('client_id', clientId)
        .eq('advisor_id', advisorUserId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('estate_composition_cache')
        .select('composition')
        .eq('household_id', householdId)
        .maybeSingle(),
    ])

  const scoreToday = healthScoreRes.data?.score ?? null
  const clientName = clientProfileRes.data?.full_name ?? 'Client'
  const alerts = alertsRes.data ?? []
  const lastNote = noteRes.data

  let grossEstate: number | null = null
  let estateTax: number | null = null
  let netToHeirs: number | null = null

  const composition = compositionRes.data?.composition as Record<string, unknown> | null
  if (composition) {
    grossEstate = Number(composition.gross_estate ?? 0) || null
    estateTax = Number(composition.estimated_tax_federal ?? composition.estimated_tax ?? 0) || null
    if (grossEstate != null && estateTax != null) {
      netToHeirs = grossEstate - estateTax
    }
  }

  if (projectionRes.data?.outputs_s1_first) {
    const outputs = projectionRes.data.outputs_s1_first as Record<string, number>[]
    const lastYear = outputs[outputs.length - 1]
    if (lastYear) {
      grossEstate = lastYear.estate_incl_home ?? lastYear.assets_total ?? grossEstate
      estateTax = lastYear.estate_tax_total ?? estateTax
      if (grossEstate != null && estateTax != null) {
        netToHeirs = grossEstate - estateTax
      }
    }
  }

  const generatedAt = new Date().toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  const alertsHtml =
    alerts.length > 0
      ? `
  <section>
    <h2>Top Planning Gaps</h2>
    ${alerts
      .map(
        (a) => `
      <div class="alert">
        <div class="alert-dot ${escapeHtml(a.severity ?? 'medium')}"></div>
        <div>
          <div class="alert-title">${escapeHtml(a.title ?? '')}</div>
          <div class="alert-desc">${escapeHtml(a.description ?? '')}</div>
        </div>
      </div>
    `,
      )
      .join('')}
  </section>
  `
      : ''

  const noteHtml = lastNote
    ? `
  <section>
    <h2>Last Advisor Note</h2>
    <div class="note-box">${escapeHtml(lastNote.content ?? '')}</div>
    <p style="font-size:9pt;color:#9ca3af;margin-top:6px">
      ${new Date(lastNote.created_at).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })}
    </p>
  </section>
  `
    : ''

  const focusCopy =
    alerts.length > 0
      ? `Review the ${alerts.length} open planning gap${alerts.length > 1 ? 's' : ''} above.${
          scoreToday != null && scoreToday < 60
            ? ' Estate health score indicates significant room for improvement — prioritize the critical and high-severity items.'
            : ''
        }`
      : 'No open alerts. Consider reviewing beneficiary designations and document staleness if not recently updated.'

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Meeting Brief — ${escapeHtml(clientName)}</title>
<style>
  @page { size: letter; margin: 0.75in; }
  @media print { body { -webkit-print-color-adjust: exact; } }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Georgia, serif; font-size: 11pt; color: #1f2937; line-height: 1.5; }
  .header { background: #0F1B3C; color: white; padding: 20px 24px; margin: -0.75in -0.75in 24px; display: flex; justify-content: space-between; align-items: flex-end; }
  .header-left h1 { font-size: 20pt; font-weight: 400; }
  .header-left p  { color: #C9A84C; font-size: 9pt; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 4px; }
  .header-right   { text-align: right; font-size: 9pt; color: #94a3b8; }
  .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 20px; }
  .stat-card { border: 1px solid #e5e7eb; border-radius: 6px; padding: 12px 16px; }
  .stat-card .label { font-size: 8pt; text-transform: uppercase; letter-spacing: 0.06em; color: #6b7280; margin-bottom: 4px; }
  .stat-card .value { font-size: 18pt; font-weight: 700; color: #0F1B3C; }
  .stat-card .delta { font-size: 9pt; color: #6b7280; }
  section { margin-bottom: 20px; }
  section h2 { font-size: 10pt; text-transform: uppercase; letter-spacing: 0.08em; color: #C9A84C; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; margin-bottom: 12px; }
  .alert { display: flex; gap: 10px; margin-bottom: 8px; }
  .alert-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; margin-top: 4px; }
  .alert-dot.critical { background: #dc2626; }
  .alert-dot.high     { background: #f59e0b; }
  .alert-dot.medium   { background: #3b82f6; }
  .alert-dot.low      { background: #6b7280; }
  .alert-title { font-size: 10pt; font-weight: 600; }
  .alert-desc  { font-size: 9pt; color: #6b7280; }
  .note-box { background: #f9fafb; border-left: 3px solid #C9A84C; padding: 10px 14px; border-radius: 0 4px 4px 0; font-size: 10pt; color: #374151; white-space: pre-wrap; }
  .disclaimer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #e5e7eb; font-size: 8pt; color: #9ca3af; line-height: 1.5; }
</style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <p>My Wealth Maps — Meeting Brief</p>
      <h1>${escapeHtml(clientName)}</h1>
    </div>
    <div class="header-right">
      <p>Prepared ${generatedAt}</p>
      <p>Confidential — Advisor use only</p>
    </div>
  </div>

  <div class="grid-3">
    <div class="stat-card">
      <div class="label">Estate Health Score</div>
      <div class="value">${scoreToday ?? '—'}<span style="font-size:12pt;color:#6b7280">/100</span></div>
      <div class="delta">${scoreToday != null ? 'Current score' : 'Not yet calculated'}</div>
    </div>
    <div class="stat-card">
      <div class="label">Projected Estate</div>
      <div class="value">${fmt(grossEstate)}</div>
      <div class="delta">At retirement</div>
    </div>
    <div class="stat-card">
      <div class="label">Est. Tax Exposure</div>
      <div class="value">${fmt(estateTax)}</div>
      <div class="delta">Net to heirs: ${fmt(netToHeirs)}</div>
    </div>
  </div>

  ${alertsHtml}
  ${noteHtml}

  <section>
    <h2>Recommended Conversation Focus</h2>
    <p style="font-size:10pt;color:#374151">${escapeHtml(focusCopy)}</p>
  </section>

  <div class="disclaimer">
    This brief was generated by My Wealth Maps and is intended for advisor use only.
    It reflects data entered by the client and is for planning preparation purposes —
    not financial, tax, or legal advice. Consult qualified professionals before acting
    on any information in this report. © My Wealth Maps ${new Date().getFullYear()}
  </div>

  <script>window.onload = () => setTimeout(() => window.print(), 500)</script>
</body>
</html>`
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const { clientId } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const reportType = req.nextUrl.searchParams.get('type') ?? 'report'

  if (reportType === 'report') {
    const wiring = await loadAdvisorExportWiringForClient(supabase, {
      advisorUserId: user.id,
      clientId,
    })
    if (!wiring) {
      return new NextResponse('Access denied', { status: 403 })
    }

    const html =
      generatePDFHTML(wiring.exportPdfData) +
      '<script>window.onload = () => setTimeout(() => window.print(), 500)</script>'

    const clientName = wiring.exportPdfData.clientName
    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `inline; filename="estate-report-${clientName.replace(/\s+/g, '-').toLowerCase()}.html"`,
      },
    })
  }

  const briefHtml = await renderMeetingBriefHtml(supabase, clientId, user.id)
  if (!briefHtml) {
    return new NextResponse('Access denied', { status: 403 })
  }

  return new NextResponse(briefHtml, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Disposition': 'inline; filename="meeting-brief.html"',
    },
  })
}
