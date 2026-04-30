import Link from 'next/link'
import { ButtonAnchor } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { SectionHeader } from '@/components/ui/SectionHeader'
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

      <Card className="mt-4 p-6">
        <SectionHeader
          as="h1"
          title="Advisor Prep Sheet"
          subtitle="Use this checklist to prepare for financial, retirement, and estate planning meetings."
        />

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
            <ButtonAnchor href="/api/education/prep-sheet/download">Download Prep Sheet</ButtonAnchor>
          ) : (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              A paid active subscription is required to download prep sheets. Trial access supports
              on-screen learning only.
            </div>
          )}
        </div>
      </Card>

      <div className="mt-8">
        <DisclaimerBanner context="education guide" />
      </div>
    </div>
  )
}

