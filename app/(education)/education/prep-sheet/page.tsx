import Link from 'next/link'
import { getUserAccess } from '@/lib/get-user-access'
import { DisclaimerBanner } from '@/lib/components/DisclaimerBanner'

export default async function EducationPrepSheetPage() {
  const access = await getUserAccess()
  const canDownload = access.subscriptionStatus === 'active' && access.tier >= 1

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link href="/education" className="text-sm text-indigo-600 hover:text-indigo-700">
        ← Back to Education Guide
      </Link>

      <div className="mt-4 rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-neutral-900">Advisor Prep Sheet</h1>
        <p className="mt-2 text-sm text-neutral-600">
          Use this checklist to prepare for financial, retirement, and estate planning meetings.
        </p>

        <div className="mt-5 space-y-4 text-sm text-neutral-700">
          <section>
            <h2 className="font-semibold text-neutral-900">Financial</h2>
            <ul className="mt-1 list-disc pl-5">
              <li>Top 3 near-term money priorities</li>
              <li>Income, expenses, and debt pressure points</li>
              <li>Insurance and risk-management gaps</li>
            </ul>
          </section>
          <section>
            <h2 className="font-semibold text-neutral-900">Retirement</h2>
            <ul className="mt-1 list-disc pl-5">
              <li>Target retirement age and income goals</li>
              <li>Social Security and RMD timing questions</li>
              <li>Tax-aware withdrawal sequencing concerns</li>
            </ul>
          </section>
          <section>
            <h2 className="font-semibold text-neutral-900">Estate</h2>
            <ul className="mt-1 list-disc pl-5">
              <li>Status of will/trust, POA, healthcare docs</li>
              <li>Beneficiary designation review checklist</li>
              <li>Top transfer and tax concerns for heirs</li>
            </ul>
          </section>
        </div>

        <div className="mt-6">
          {canDownload ? (
            <a
              href="/api/education/prep-sheet/download"
              className="inline-flex rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Download Prep Sheet
            </a>
          ) : (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              A paid active subscription is required to download prep sheets. Trial access supports
              on-screen learning only.
            </div>
          )}
        </div>
      </div>

      <div className="mt-8">
        <DisclaimerBanner context="education guide" />
      </div>
    </div>
  )
}

