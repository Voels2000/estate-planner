import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { calculateProspectSummary } from '@/lib/prospect/calculateProspectSummary'
import {
  fmtProspectDollars,
  PROSPECT_RANGE_LABELS,
} from '@/lib/prospect/constants'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'advisor') {
    return new NextResponse('Advisor role required', { status: 403 })
  }

  const url = new URL(req.url)
  const state = url.searchParams.get('state') ?? 'CA'
  const range = url.searchParams.get('range') ?? 'md'
  const marital = (url.searchParams.get('marital') ?? 'married') as 'single' | 'married'
  const biz = url.searchParams.get('biz') === '1'
  const age = parseInt(url.searchParams.get('age') ?? '55', 10)
  const prospectName = url.searchParams.get('name')?.trim() || 'Prospect'

  const summary = await calculateProspectSummary(supabase, {
    state,
    range,
    marital,
    businessOwner: biz,
    age,
  })

  const isMarried = marital === 'married'
  const generatedAt = new Date().toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  const safeName = escapeHtml(prospectName)
  const safeAdvisor = escapeHtml(profile.full_name ?? 'Your Advisor')
  const safeState = escapeHtml(state)
  const safeRange = escapeHtml(PROSPECT_RANGE_LABELS[range] ?? range)

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Estate Planning Opportunity Summary — ${safeName}</title>
<style>
  @page { size: letter; margin: 0.75in; }
  @media print { body { -webkit-print-color-adjust: exact; } }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Georgia, serif; font-size: 11pt; color: #1f2937; line-height: 1.5; }

  .header { background: #0F1B3C; color: white; padding: 22px 28px; margin: -0.75in -0.75in 24px; display: flex; justify-content: space-between; align-items: flex-end; }
  .header h1 { font-size: 18pt; font-weight: 400; color: white; }
  .header .label { color: #C9A84C; font-size: 9pt; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 4px; }
  .header .meta { text-align: right; font-size: 9pt; color: #94a3b8; }

  .profile-bar { display: flex; gap: 24px; flex-wrap: wrap; background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 6px; padding: 12px 16px; margin-bottom: 20px; font-size: 10pt; color: #374151; }
  .profile-bar span { font-weight: 600; }

  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px; }
  .tax-card { border: 1px solid #e5e7eb; border-radius: 6px; padding: 14px 16px; }
  .tax-card .card-label { font-size: 8pt; text-transform: uppercase; letter-spacing: 0.06em; color: #6b7280; margin-bottom: 6px; }
  .tax-card .card-value { font-size: 20pt; font-weight: 700; color: #0F1B3C; }
  .tax-card .card-sub { font-size: 9pt; color: #6b7280; margin-top: 2px; }
  .tax-card.highlight { border-color: #C9A84C; background: #fffbeb; }
  .tax-card.highlight .card-value { color: #92400e; }

  .delta-banner { background: #fef3c7; border: 1px solid #f59e0b; border-radius: 6px; padding: 10px 14px; margin-bottom: 20px; font-size: 10pt; }
  .delta-banner strong { color: #92400e; }

  section { margin-bottom: 20px; }
  section h2 { font-size: 10pt; text-transform: uppercase; letter-spacing: 0.08em; color: #C9A84C; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; margin-bottom: 10px; }
  .gap-item { display: flex; gap: 8px; margin-bottom: 6px; font-size: 10pt; }
  .gap-dot { width: 6px; height: 6px; border-radius: 50%; background: #f59e0b; flex-shrink: 0; margin-top: 5px; }
  .look-item { display: flex; gap: 8px; margin-bottom: 5px; font-size: 10pt; color: #374151; }
  .look-num { font-weight: 700; color: #0F1B3C; flex-shrink: 0; min-width: 16px; }

  .cta-box { background: #0F1B3C; color: white; border-radius: 6px; padding: 16px 20px; margin-top: 20px; display: flex; justify-content: space-between; align-items: center; gap: 16px; }
  .cta-box p { font-size: 10pt; color: #cbd5e1; }
  .cta-box .cta-url { font-size: 10pt; font-weight: 700; color: #C9A84C; white-space: nowrap; }

  .disclaimer { margin-top: 16px; padding-top: 10px; border-top: 1px solid #e5e7eb; font-size: 8pt; color: #9ca3af; line-height: 1.5; }
</style>
</head>
<body>
  <div class="header">
    <div>
      <div class="label">My Wealth Maps — Estate Planning Opportunity Summary</div>
      <h1>${safeName}</h1>
    </div>
    <div class="meta">
      <p>Prepared ${generatedAt}</p>
      <p>Prepared by ${safeAdvisor}</p>
      <p>Confidential</p>
    </div>
  </div>

  <div class="profile-bar">
    <div>State: <span>${safeState}</span></div>
    <div>Assets: <span>${safeRange}</span></div>
    <div>Filing status: <span>${isMarried ? 'Married' : 'Single'}</span></div>
    ${biz ? '<div>Business owner: <span>Yes</span></div>' : ''}
    <div>Approx. age: <span>${age}</span></div>
  </div>

  <div class="grid-2">
    <div class="tax-card">
      <div class="card-label">Federal tax — Current law</div>
      <div class="card-value">${fmtProspectDollars(summary.federalTaxCurrent)}</div>
      <div class="card-sub">Exemption: ${fmtProspectDollars(summary.exemptionCurrent)}</div>
    </div>
    <div class="tax-card highlight">
      <div class="card-label">Federal tax — After sunset</div>
      <div class="card-value">${fmtProspectDollars(summary.federalTaxSunset)}</div>
      <div class="card-sub">Exemption: ${fmtProspectDollars(summary.exemptionSunset)}</div>
    </div>
    ${
      summary.stateTax > 0
        ? `
    <div class="tax-card">
      <div class="card-label">${safeState} state estate tax</div>
      <div class="card-value">${fmtProspectDollars(summary.stateTax)}</div>
      <div class="card-sub">Based on current state rules</div>
    </div>
    `
        : ''
    }
    <div class="tax-card">
      <div class="card-label">Total exposure (sunset + state)</div>
      <div class="card-value">${fmtProspectDollars(summary.federalTaxSunset + summary.stateTax)}</div>
      <div class="card-sub">Worst-case combined estimate</div>
    </div>
  </div>

  ${
    summary.sunsetDelta > 0
      ? `
  <div class="delta-banner">
    If the federal exemption sunsets to pre-TCJA levels, this estate's federal tax exposure increases by
    <strong>${fmtProspectDollars(summary.sunsetDelta)}</strong>. Planning while the higher exemption remains
    in effect could preserve significant wealth.
  </div>
  `
      : ''
  }

  <section>
    <h2>Planning Gaps to Address</h2>
    ${summary.planningGaps
      .map(
        (g) => `
      <div class="gap-item">
        <div class="gap-dot"></div>
        <div>${escapeHtml(g)}</div>
      </div>
    `,
      )
      .join('')}
  </section>

  <section>
    <h2>What We Would Look at Together</h2>
    ${summary.whatWeWouldLookAt
      .map(
        (item, i) => `
      <div class="look-item">
        <div class="look-num">${i + 1}.</div>
        <div>${escapeHtml(item)}</div>
      </div>
    `,
      )
      .join('')}
  </section>

  <div class="cta-box">
    <div>
      <p>Ready to build a complete picture of your estate?</p>
      <p style="margin-top:4px;font-size:9pt;color:#94a3b8">
        Create a free account — complete your profile and your advisor
        can start working with your real data immediately.
      </p>
    </div>
    <div class="cta-url">mywealthmaps.com</div>
  </div>

  <div class="disclaimer">
    This summary was prepared using approximate inputs and is intended for
    illustrative purposes only. It is not financial, legal, or tax advice.
    Actual estate tax liability depends on asset values, titling, applicable
    law, and other factors specific to your situation. Consult qualified
    professionals before making planning decisions.
    © My Wealth Maps LLC ${new Date().getFullYear()}
  </div>

  <script>setTimeout(() => window.print(), 500)</script>
</body>
</html>`

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html' },
  })
}
