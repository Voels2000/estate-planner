import Link from 'next/link'

export function WashingtonEstateTaxArticle() {
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
        Washington State Estate Tax:
        <br />
        What Every $3M+ Household Needs to Know
      </h1>
      <p className="learn-subtitle">
        A plain-language guide for families, financial advisors, and estate planning attorneys
      </p>
      <p className="learn-updated">
        Updated June 2026 &nbsp;·&nbsp; Reflects ESB 6347 signed March 24, 2026
      </p>

      <div className="learn-callout">
        <p>
          <strong>The short version:</strong> Washington is one of only twelve states with its own
          estate tax — completely separate from the federal system. The{' '}
          <strong>WA estate tax exemption</strong> is $3 million per person. Everything above that
          is taxed at rates from 10% to 20%. A married couple with a $6 million estate and no
          planning could owe more than $300,000 in state tax that could have been legally avoided.
        </p>
      </div>

      <h2>1. The basics: what is the Washington estate tax?</h2>
      <p>
        When a Washington resident dies, the state taxes the right to transfer property. It
        doesn&apos;t matter what the assets are — a home, investment accounts, a business, a rental
        portfolio — all of it counts toward the gross estate. The tax is paid by the estate itself
        before anything passes to heirs.
      </p>
      <p>
        This is separate from the federal estate tax. In 2026, the federal exemption is $15 million
        per person, which means most Washington households will never owe federal estate tax.
        Washington&apos;s exemption is five times smaller. The state-level exposure is the issue for
        the $2 million to $15 million household — the exact range most financial advisors work with.
      </p>
      <p>
        Washington has had this tax since 2005 and has no plans to repeal it. The legislature raised
        the exemption in July 2025 (from $2.193 million, which had been frozen since 2018, to $3
        million), but also dramatically raised the rates. A subsequent law — ESB 6347, signed March
        24, 2026 — rolled the top rate back down to 20%, where it had been for years. The exemption
        was effectively frozen at $3 million going forward.
      </p>

      <div className="learn-callout learn-callout-warn">
        <p>
          <strong>2026 is a split year.</strong> For deaths between January 1 and June 30, 2026,
          the exemption is $3,076,000 and rates run up to 35%. For deaths on or after July 1, 2026,
          the exemption resets to $3,000,000 and rates run up to 20%. Estate plans drafted or
          reviewed in early 2026 may need to be revisited in light of the rollback.
        </p>
      </div>

      <h2>2. The rate schedule</h2>
      <p>
        The tax is graduated — like income tax, you don&apos;t pay the top rate on your entire
        taxable estate, only on the slice that falls into each bracket. The brackets below apply to
        deaths on or after July 1, 2026 (the current law). The taxable estate is the gross estate
        minus allowable deductions (debts, funeral costs, administrative expenses, charitable
        bequests, the marital deduction) minus the $3 million exemption.
      </p>

      <table>
        <thead>
          <tr>
            <th>Taxable estate (amount above exemption)</th>
            <th>Rate</th>
            <th>Tax on this bracket</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>$0 – $1,000,000</td>
            <td>10%</td>
            <td className="tax-amt">Up to $100,000</td>
          </tr>
          <tr>
            <td>$1,000,001 – $2,000,000</td>
            <td>14%</td>
            <td className="tax-amt">Up to $140,000</td>
          </tr>
          <tr>
            <td>$2,000,001 – $3,000,000</td>
            <td>15%</td>
            <td className="tax-amt">Up to $150,000</td>
          </tr>
          <tr>
            <td>$3,000,001 – $4,000,000</td>
            <td>16%</td>
            <td className="tax-amt">Up to $160,000</td>
          </tr>
          <tr>
            <td>$4,000,001 – $6,000,000</td>
            <td>18%</td>
            <td className="tax-amt">Up to $360,000</td>
          </tr>
          <tr>
            <td>$6,000,001 – $9,000,000</td>
            <td>19%</td>
            <td className="tax-amt">Up to $570,000</td>
          </tr>
          <tr>
            <td>Over $9,000,000</td>
            <td>20%</td>
            <td className="tax-amt">20% on the excess</td>
          </tr>
        </tbody>
      </table>

      <p>
        Note: Washington&apos;s DOR publishes Table W, the official computation table used to
        calculate the exact tax owed. The rates above are the marginal rates by bracket. Estate
        planning attorneys and tax advisors use Table W directly.
      </p>

      <h2>3. What happens to a $6 million estate with no planning?</h2>
      <p>
        The example below is straightforward: a married couple, combined estate of $6 million — a
        paid-off home in Bellevue worth $1.8 million, investment accounts, retirement accounts, a
        small rental property. No unusual complexity. The first spouse dies, leaving everything to
        the survivor. The survivor dies a few years later. Here&apos;s what the tax bill looks like
        without any planning.
      </p>

      <div className="scenario-grid">
        <div className="scenario-box bad">
          <div className="scenario-label">Without planning</div>
          <h3>Everything passes outright to survivor, then to children</h3>
          <p>
            When Spouse 1 dies, everything passes to Spouse 2 — no tax due because of the unlimited
            marital deduction.
          </p>
          <p>
            When Spouse 2 dies, the entire $6 million estate is subject to WA estate tax. The
            exemption shelters $3 million. The taxable estate is $3 million.
          </p>
          <p>WA tax due:</p>
          <div className="big-number">~$390,000</div>
          <p style={{ fontSize: 13, color: '#8a4e00' }}>
            Paid by the estate before heirs receive anything. They may need to liquidate assets to
            cover it.
          </p>
        </div>
        <div className="scenario-box good">
          <div className="scenario-label">With a bypass trust</div>
          <h3>Each spouse&apos;s exemption is preserved and used</h3>
          <p>
            At Spouse 1&apos;s death, $3 million funds a bypass (credit shelter) trust. Spouse 2
            can benefit from that trust during their lifetime. The remaining $3 million passes
            outright to Spouse 2.
          </p>
          <p>
            When Spouse 2 dies, only their $3 million estate is taxed. The bypass trust is
            sheltered by Spouse 1&apos;s exemption — already used.
          </p>
          <p>WA tax due:</p>
          <div className="big-number">$0</div>
          <p style={{ fontSize: 13, color: '#1a7a40' }}>
            Both exemptions used. Both $3M portions pass to heirs free of Washington estate tax.
          </p>
        </div>
      </div>

      <p>
        The difference between those two outcomes — roughly $390,000 — is not a difference in how
        hard the family worked, how much they saved, or how much they gave to charity. It&apos;s a
        difference in whether their estate plan addressed Washington&apos;s separate state
        exemption.
      </p>

      <div className="learn-callout learn-callout-warn">
        <p>
          <strong>Important: the federal exemption does not help here.</strong> Many Washington
          families — and their advisors — assume that because their estate is well below the $15
          million federal threshold, they have no estate tax exposure. That&apos;s true federally.
          Washington&apos;s $3 million exemption is a completely separate calculation, and a $6
          million estate has a real, six-figure liability if the plan doesn&apos;t account for it.
        </p>
      </div>

      <h2>4. What is a bypass trust, and how does it work?</h2>
      <p>
        A <strong>bypass trust Washington</strong> couples rely on — also called a credit shelter
        trust, family trust, or &quot;B trust&quot; in the traditional A-B trust structure — is
        the primary tool for making sure both spouses&apos; Washington estate tax exemptions get
        used.
      </p>
      <p>
        Here&apos;s the problem it solves: the unlimited marital deduction means assets can pass
        freely from one spouse to another with no immediate estate tax. That sounds good, but it
        means the first spouse&apos;s exemption goes to waste. When the surviving spouse dies with
        the entire combined estate, only one $3 million exemption is available — not two.
      </p>
      <p>
        A bypass trust is set up so that when the first spouse dies, an amount equal to the
        available exemption (currently $3 million) is directed into a trust rather than passing
        outright to the survivor. The survivor can still benefit from the assets — income,
        principal distributions for health, education, maintenance and support — but the trust
        assets are not included in the survivor&apos;s taxable estate when they die.
      </p>

      <div className="trust-diagram">
        <p style={{ fontWeight: 700, fontSize: 14, marginBottom: 16, color: '#0f1f3d' }}>
          How a bypass trust splits a $6M estate at first death
        </p>
        <div className="estate-pool">
          <div className="trust-box bypass">
            <div className="box-label">Bypass Trust (B Trust)</div>
            <div className="box-amt">$3,000,000</div>
            <div className="box-desc">
              Funded with Spouse 1&apos;s exemption. Spouse 2 can benefit during lifetime.
              Sheltered from WA estate tax at Spouse 2&apos;s death.
            </div>
          </div>
          <div className="trust-box survivor">
            <div className="box-label">Survivor&apos;s Share (A Trust or outright)</div>
            <div className="box-amt">$3,000,000</div>
            <div className="box-desc">
              Passes to or remains with Spouse 2. Eligible for Spouse 2&apos;s $3M exemption at
              their death.
            </div>
          </div>
        </div>
        <div className="arrow-down">↓</div>
        <div className="trust-outcome" style={{ marginTop: 12 }}>
          At Spouse 2&apos;s death: both $3M exemptions used &nbsp;·&nbsp; WA estate tax: $0
          &nbsp;·&nbsp; Heirs receive full $6M
        </div>
      </div>

      <p>
        The bypass trust is well-established planning. It&apos;s not aggressive or exotic —
        it&apos;s been used for this purpose for decades, and Washington&apos;s own tax structure
        contemplates it. An estate planning attorney drafts the trust documents, and the financial
        advisor helps ensure assets are titled correctly so the trust actually gets funded at death
        (a step many families miss).
      </p>

      <h2>5. What else is in a Washington estate planner&apos;s toolkit?</h2>
      <p>
        The bypass trust is the most common tool for married couples, but it&apos;s not the only
        approach. Depending on the estate&apos;s composition — real estate, a family business,
        charitable intent, life insurance — other strategies may apply.
      </p>

      <h3>Annual gifting</h3>
      <p>
        Each person can give up to $19,000 per year (2026 federal limit) to any number of recipients
        without gift tax implications. A couple can give $38,000 per year per recipient,
        effectively moving assets out of the taxable estate over time. For families with children
        and grandchildren, this compounds meaningfully over a decade.
      </p>

      <h3>Qualified Personal Residence Trusts (QPRT)</h3>
      <p>
        A QPRT allows the homeowner to transfer a home to a trust while retaining the right to live
        there for a set term. The value transferred for gift tax purposes is discounted because the
        current owner retained an interest. Particularly useful when a primary residence represents
        a large share of the estate — common in Seattle and Bellevue, where home values have pushed
        many families into estate tax territory without recognizing it.
      </p>

      <h3>Irrevocable Life Insurance Trust (ILIT)</h3>
      <p>
        Life insurance proceeds are included in the taxable estate if the deceased owned the policy.
        An ILIT holds the policy outside the estate, so proceeds pass to beneficiaries free of
        estate tax. Often used to provide liquidity to pay estate taxes on illiquid assets —
        particularly useful for business owners or families with rental property who don&apos;t want
        heirs forced to sell in order to pay the tax bill.
      </p>

      <h3>Qualified Family-Owned Business Interest (QFOBI) deduction</h3>
      <p>
        Washington offers a deduction specifically for qualifying family-owned businesses — up to
        $3,076,000 for 2026. Business owners with qualifying interests may be able to substantially
        reduce the taxable estate. The rules are specific and require careful structuring. An estate
        planning attorney with business succession experience is essential here.
      </p>

      <h3>Charitable planning</h3>
      <p>
        Charitable bequests are fully deductible from the Washington taxable estate. For charitably
        inclined families, strategies like Charitable Remainder Trusts (CRTs) can generate income
        during the owners&apos; lifetimes, reduce the taxable estate, and fulfill philanthropic
        goals simultaneously.
      </p>

      <h2>6. Five things that trigger Washington estate tax exposure that many families don&apos;t realize</h2>

      <div className="faq-item">
        <p className="faq-q">
          1. Home appreciation pushed us over the threshold — but we don&apos;t feel wealthy enough
          to have an estate tax problem.
        </p>
        <p>
          The $3 million exemption is not indexed to inflation going forward (the legislature&apos;s
          2026 law effectively froze it). A home purchased in the Seattle suburbs for $400,000 twenty
          years ago may be worth $1.2 million today. Add investment accounts, retirement accounts,
          and a spouse&apos;s assets, and a family that considers itself solidly upper-middle-class
          may have a $4–5 million taxable estate without ever feeling like they do estate planning
          for wealthy people.
        </p>
      </div>

      <div className="faq-item">
        <p className="faq-q">
          2. Retirement accounts count — but you can&apos;t use the marital deduction trick on IRAs
          the same way.
        </p>
        <p>
          IRAs and 401(k)s are included in the gross estate at their full value. While they pass to
          a surviving spouse as a rollover without income tax at that point, they count toward
          Washington&apos;s estate tax calculation at both deaths. Large retirement accounts can
          quietly push an estate well above the threshold.
        </p>
      </div>

      <div className="faq-item">
        <p className="faq-q">
          3. Non-residents who own Washington real estate owe Washington estate tax on that property.
        </p>
        <p>
          If you live in California but own a vacation home in the San Juan Islands, Washington can
          tax the value of that property as part of a Washington-sourced estate. People who own real
          estate in multiple states often have multi-state estate tax exposure that requires careful
          coordination.
        </p>
      </div>

      <div className="faq-item">
        <p className="faq-q">4. An outdated plan may not work anymore.</p>
        <p>
          Plans written before 2025 were drafted when the exemption was $2.193 million. Plans written
          between July 2025 and June 2026 may have been drafted under the higher rate schedule that
          has since been rolled back. Trusts with formula clauses tied to specific dollar amounts may
          not function as intended under the new law. A plan review with an estate planning attorney
          is worth the time.
        </p>
      </div>

      <div className="faq-item">
        <p className="faq-q">5. A will alone is not an estate plan.</p>
        <p>
          A will controls what happens to probate assets but doesn&apos;t address trust funding,
          asset titling, beneficiary designations, or the bypass trust structure. Many Washington
          families have a will but no trust document — which means the bypass trust strategy
          isn&apos;t available to them, because there&apos;s no trust to fund at the first
          spouse&apos;s death. By the time the issue is discovered, the first spouse has already
          died and the exemption has been wasted.
        </p>
      </div>

      <h2>7. What should an advisor or attorney&apos;s client do now?</h2>
      <p>
        If a household&apos;s combined net worth is above $3 million — or within range of $3
        million when accounting for home appreciation and retirement accounts — these are the right
        questions to start with:
      </p>
      <p>
        <strong>Do you have a trust document?</strong> A will doesn&apos;t accomplish the bypass
        trust strategy. The trust needs to exist before the first death, and assets need to be
        titled correctly to fund it.
      </p>
      <p>
        <strong>Has your plan been reviewed since mid-2025?</strong> Washington&apos;s estate tax
        changed significantly in July 2025 (higher exemption, dramatically higher rates) and again
        in March 2026 (rates rolled back, exemption frozen). A plan that was current in 2024 may use
        outdated assumptions.
      </p>
      <p>
        <strong>How are your assets titled?</strong> Joint tenancy, community property with right
        of survivorship, and tenancy in common all have different consequences at death. The title
        structure determines what can flow into the bypass trust and what passes outside of it.
      </p>
      <p>
        <strong>Who are your beneficiaries?</strong> Beneficiary designations on retirement
        accounts, life insurance, and transfer-on-death accounts override the will and the trust.
        They need to be reviewed in light of the overall estate plan — not just set and forgotten.
      </p>
      <p>
        <strong>What is the liquidity picture?</strong> Estate taxes are due nine months after
        death. If the estate is primarily illiquid — real estate, a closely held business, rental
        property — the family may be forced to sell assets under time pressure to pay the bill. Life
        insurance held in an ILIT is often the most efficient solution to this specific problem.
      </p>

      <h2>8. The Washington tax stack in 2026</h2>
      <p>
        Estate tax is the most significant tax most Washington families will face at death, but
        it&apos;s not the only one. Higher-net-worth households should also be aware of:
      </p>
      <p>
        <strong>Washington Capital Gains Tax:</strong> A 7% tax on capital gains above approximately
        $270,000 annually, with a 9.9% rate above $1 million. Unrealized gains in the estate may
        have implications for lifetime planning decisions (Roth conversions, charitable giving, timing
        of business sales).
      </p>
      <p>
        <strong>Washington Income Tax (SB 6346):</strong> Signed in 2026, 9.9% on household income
        above $1 million. This law faces an immediate constitutional challenge and may not survive
        — but planning should account for the possibility that it stands.
      </p>
      <p>
        <strong>Federal Estate Tax:</strong> At $15 million per person in 2026, most Washington
        households won&apos;t reach this threshold. But the federal exemption is set by law and
        subject to change. Families in the $10–15 million range should monitor federal legislative
        developments as part of their planning.
      </p>

      <div className="learn-callout" style={{ marginTop: 48 }}>
        <p>
          <strong>About this guide:</strong> This document is prepared by My Wealth Maps, an estate
          planning intelligence platform for households in the $2 million to $30 million range. My
          Wealth Maps provides estate readiness scoring, state and federal estate tax analysis, and
          collaborative planning tools for financial advisors and estate planning attorneys. This
          guide is for educational purposes only and does not constitute legal or tax advice. Estate
          planning involves individual facts and circumstances that require the guidance of a
          qualified estate planning attorney.
        </p>
      </div>

      <div className="learn-footer">
        <p>
          <strong>Sources:</strong> Washington Department of Revenue
          (dor.wa.gov/taxes-rates/other-taxes/estate-tax); RCW 83.100.040; Engrossed Senate Bill 6347
          (signed March 24, 2026); Internal Revenue Code §§ 2001–2210; IRS Rev. Proc. 2025-61 (2026
          exemption and exclusion amounts).
        </p>
        <br />
        <p>
          © 2026 My Wealth Maps &nbsp;·&nbsp;{' '}
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
