import Link from 'next/link'
import type { StateEstateTaxData } from '@/lib/learn/state-estate-tax-types'
import { getStaleness } from '@/lib/learn/state-estate-tax-types'

const dollarFmt = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

function formatExemptionMillions(amount: number): string {
  const m = amount / 1_000_000
  return m >= 1 ? `$${m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)}M` : dollarFmt.format(amount)
}

function formatBracketRange(min: number, max: number | null): string {
  if (max === null) {
    return `${dollarFmt.format(min)}+`
  }
  return `${dollarFmt.format(min)} – ${dollarFmt.format(max)}`
}

function formatReviewMonth(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

export function StateEstateTaxArticle({ data }: { data: StateEstateTaxData }) {
  const staleness = getStaleness(data.last_reviewed)
  const thresholdLabel = formatExemptionMillions(data.exemption_amount)
  const portabilityLabel = data.portability
    ? 'portability is available with a timely election'
    : 'no spousal portability — both exemptions require trust planning'

  return (
    <article className="learn-article">
      <div
        style={{
          borderTop: '4px solid #0f1f3d',
          paddingTop: 20,
          marginBottom: 40,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: '#0f1f3d',
          }}
        >
          My Wealth Maps
        </span>
        <span
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 11,
            color: '#666',
            letterSpacing: '0.05em',
          }}
        >
          Estate Planning Intelligence
        </span>
      </div>

      <h1>
        {data.state_name} Estate Tax:
        <br />
        What Every {thresholdLabel}+ Household Needs to Know
      </h1>
      <p className="learn-subtitle">
        A plain-language guide for families, financial advisors, and estate planning attorneys
      </p>
      <p className="learn-updated">
        Law effective {formatReviewMonth(data.law_effective_date)} &nbsp;·&nbsp; Last reviewed{' '}
        {formatReviewMonth(data.last_reviewed)}
      </p>

      <div className="learn-callout">
        <p>
          <strong>The short version:</strong> {data.state_name} has its own estate tax — separate
          from the federal system. The exemption is {dollarFmt.format(data.exemption_amount)} per
          person ({data.exemption_indexed ? 'indexed to inflation' : 'not indexed to inflation'}).
          Taxable amounts above the exemption are taxed at rates up to {data.top_rate_pct}%.{' '}
          {data.portability
            ? 'This state offers spousal portability, but a timely election is required.'
            : 'Without bypass trust planning, a married couple can forfeit one spouse\'s exemption entirely.'}
        </p>
      </div>

      <h2>1. The basics: what is the {data.state_name} estate tax?</h2>
      <p>
        When a {data.state_name} resident dies, the state taxes the right to transfer property. Homes,
        investment accounts, businesses, and retirement assets all count toward the gross estate. The
        tax is generally paid by the estate before distributions pass to heirs.
      </p>
      <p>
        This is separate from the federal estate tax. Most households will never owe federal estate
        tax at current exemption levels — but {data.state_name}&apos;s{' '}
        {dollarFmt.format(data.exemption_amount)} exemption creates real exposure for households in
        the $2M–$15M range, which is where most financial advisors and estate attorneys focus.
      </p>

      {data.has_cliff_effect && (
        <div className="learn-callout learn-callout-warn">
          <p>
            <strong>Cliff effect warning:</strong> {data.state_name} has a cliff effect — estates
            modestly above the exemption may owe tax on the <em>entire</em> estate, not just the
            amount over the exemption. Planning before the first death is critical.
          </p>
        </div>
      )}

      <h2>2. The rate schedule</h2>
      <p>
        The tax is graduated on the taxable estate (gross estate minus deductions and the{' '}
        {dollarFmt.format(data.exemption_amount)} exemption). Rates below apply to amounts above the
        exemption.
      </p>

      <table>
        <thead>
          <tr>
            <th>Taxable estate (amount above exemption)</th>
            <th>Rate</th>
            <th>Base tax at bracket floor</th>
          </tr>
        </thead>
        <tbody>
          {data.brackets.map((b, i) => (
            <tr key={i}>
              <td>{formatBracketRange(b.min, b.max)}</td>
              <td>{b.rate_pct}%</td>
              <td className="tax-amt">{dollarFmt.format(b.base_tax)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>3. What happens without planning?</h2>
      {data.scenario_estate_value != null &&
      data.scenario_tax_no_plan != null &&
      data.scenario_tax_with_plan != null ? (
        <>
          {data.scenario_notes && <p>{data.scenario_notes}</p>}
          <div className="scenario-grid">
            <div className="scenario-box bad">
              <div className="scenario-label">Without planning</div>
              <h3>Everything passes outright to survivor, then to heirs</h3>
              <p>
                When the first spouse dies, assets pass to the survivor under the marital deduction
                — often no immediate tax. When the survivor dies, the full combined estate faces a
                single {dollarFmt.format(data.exemption_amount)} exemption.
              </p>
              <p>Estate value:</p>
              <div className="big-number">{dollarFmt.format(data.scenario_estate_value)}</div>
              <p>{data.state_name} tax due:</p>
              <div className="big-number">{dollarFmt.format(data.scenario_tax_no_plan)}</div>
              <p style={{ fontSize: 13, color: '#8a4e00' }}>
                Paid by the estate before heirs receive anything.
              </p>
            </div>
            <div className="scenario-box good">
              <div className="scenario-label">With a bypass trust</div>
              <h3>Each spouse&apos;s exemption is preserved and used</h3>
              <p>
                At the first death, an amount equal to the exemption funds a bypass (credit shelter)
                trust. The survivor can benefit during life; trust assets are sheltered at the second
                death.
              </p>
              <p>{data.state_name} tax due:</p>
              <div className="big-number">{dollarFmt.format(data.scenario_tax_with_plan)}</div>
              <p style={{ fontSize: 13, color: '#1a7a40' }}>
                Both exemptions used. Full estate passes to heirs free of {data.state_name} estate
                tax.
              </p>
            </div>
          </div>
        </>
      ) : (
        <p>
          Contact an estate planning attorney for a scenario specific to your situation and asset
          composition.
        </p>
      )}

      <div className="learn-callout learn-callout-warn">
        <p>
          <strong>Important: the federal exemption does not eliminate state exposure.</strong> Many
          families assume that because their estate is below the federal threshold, they have no
          estate tax risk. {data.state_name}&apos;s {dollarFmt.format(data.exemption_amount)}{' '}
          exemption is a completely separate calculation ({portabilityLabel}).
        </p>
      </div>

      <h2>4. What is a bypass trust, and how does it work?</h2>
      <p>
        A bypass trust — also called a credit shelter trust, family trust, or &quot;B trust&quot; in
        the traditional A-B trust structure — is the primary tool for making sure both spouses&apos;{' '}
        {data.state_name} estate tax exemptions get used when portability is unavailable or not
        elected.
      </p>
      <p>
        The unlimited marital deduction means assets can pass freely between spouses with no immediate
        estate tax — but it means the first spouse&apos;s exemption often goes unused. When the
        surviving spouse dies with the entire combined estate, only one exemption may remain.
      </p>
      <p>
        A bypass trust directs an amount equal to the available exemption into a trust at the first
        death rather than passing outright to the survivor. The survivor can still benefit from trust
        assets, but those assets are generally not included in the survivor&apos;s taxable estate.
      </p>

      {data.scenario_estate_value != null && (
        <div className="trust-diagram">
          <p style={{ fontWeight: 700, fontSize: 14, marginBottom: 16, color: '#0f1f3d' }}>
            How a bypass trust splits a {formatExemptionMillions(data.scenario_estate_value)} estate
            at first death
          </p>
          <div className="estate-pool">
            <div className="trust-box bypass">
              <div className="box-label">Bypass Trust (B Trust)</div>
              <div className="box-amt">{dollarFmt.format(data.exemption_amount)}</div>
              <div className="box-desc">
                Funded with Spouse 1&apos;s exemption. Spouse 2 can benefit during lifetime.
                Sheltered from {data.state_name} estate tax at Spouse 2&apos;s death.
              </div>
            </div>
            <div className="trust-box survivor">
              <div className="box-label">Survivor&apos;s Share (A Trust or outright)</div>
              <div className="box-amt">
                {dollarFmt.format(
                  Math.max(0, data.scenario_estate_value - data.exemption_amount),
                )}
              </div>
              <div className="box-desc">
                Remains with Spouse 2. Eligible for Spouse 2&apos;s{' '}
                {formatExemptionMillions(data.exemption_amount)} exemption at their death.
              </div>
            </div>
          </div>
          <div className="arrow-down">↓</div>
          <div className="trust-outcome" style={{ marginTop: 12 }}>
            At Spouse 2&apos;s death: both exemptions used &nbsp;·&nbsp; {data.state_name} estate tax
            minimized &nbsp;·&nbsp; Heirs receive full estate
          </div>
        </div>
      )}

      <p>
        The bypass trust is well-established planning — not aggressive or exotic. An estate planning
        attorney drafts the trust documents; the financial advisor helps ensure assets are titled
        correctly so the trust actually gets funded at death.
      </p>

      {data.quirks.length > 0 && (
        <>
          <h2>5. {data.state_name}-specific planning considerations</h2>
          {data.quirks.map((q) => (
            <div key={q.label} className="learn-callout" style={{ marginBottom: 16 }}>
              <p>
                <strong>{q.label}:</strong> {q.description}
              </p>
            </div>
          ))}
        </>
      )}

      <h2>{data.quirks.length > 0 ? '6' : '5'}. What should you do now?</h2>
      <p>
        If a household&apos;s combined net worth is above{' '}
        {formatExemptionMillions(data.exemption_amount)} — or approaching it when accounting for home
        appreciation and retirement accounts — start with these questions:
      </p>
      <p>
        <strong>Do you have a trust document?</strong> A will alone does not accomplish the bypass
        trust strategy. The trust must exist before the first death, and assets must be titled
        correctly to fund it.
      </p>
      <p>
        <strong>Has your plan been reviewed recently?</strong> {data.state_name} estate tax law can
        change — verify your plan reflects current exemption amounts and rate schedules.
      </p>
      <p>
        <strong>How are your assets titled?</strong> Joint tenancy, community property, and tenancy
        in common all have different consequences at death. Title structure determines what can flow
        into the bypass trust.
      </p>
      <p>
        <strong>Who are your beneficiaries?</strong> Beneficiary designations on retirement accounts,
        life insurance, and transfer-on-death accounts override the will and trust — review them with
        your overall plan.
      </p>
      <p>
        <strong>What is the liquidity picture?</strong> Estate taxes are generally due within months
        of death. Illiquid estates may force asset sales under time pressure.
      </p>

      <p
        style={{
          fontSize: 13,
          color: staleness === 'overdue' ? '#c53030' : staleness === 'review_due' ? '#c87000' : '#888',
          marginTop: 32,
        }}
      >
        Data current as of {formatReviewMonth(data.last_reviewed)}. {data.state_name} estate tax law
        can change — verify with a qualified estate planning attorney.
      </p>

      <div className="learn-callout" style={{ marginTop: 48 }}>
        <p>
          <strong>About this guide:</strong> This document is prepared by My Wealth Maps, an estate
          planning intelligence platform for households in the $2 million to $30 million range. My
          Wealth Maps provides estate readiness scoring, state and federal estate tax analysis, and
          collaborative planning tools for financial advisors and estate planning attorneys. This
          guide is for educational purposes only and does not constitute legal or tax advice.
        </p>
      </div>

      <div className="learn-footer">
        <p>
          © {new Date().getFullYear()} My Wealth Maps LLC &nbsp;·&nbsp;{' '}
          <Link href="/" style={{ color: '#888' }}>
            mywealthmaps.com
          </Link>{' '}
          &nbsp;·&nbsp; This document may be shared with clients and professional contacts. Not for
          resale.
        </p>
      </div>
    </article>
  )
}
