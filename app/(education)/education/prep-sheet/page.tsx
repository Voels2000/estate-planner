import { ButtonAnchor, ButtonLink } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { getUserAccess } from '@/lib/get-user-access'
import { EducationDisclaimer } from '@/components/education/EducationDisclaimer'

export default async function EducationPrepSheetPage() {
  const access = await getUserAccess()
  const canDownload = access.subscriptionStatus === 'active' && access.tier >= 1

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <ButtonLink href="/education" variant="link">
        ← Back to Education Guide
      </ButtonLink>

      <Card className="mt-4 p-6">
        <SectionHeader
          as="h1"
          title="Advisor Prep Sheet"
          subtitle="Use this checklist to prepare for financial, retirement, and estate planning meetings."
        />

        <div className="mt-6 grid gap-4 sm:grid-cols-1">
          <Card className="border-neutral-200 bg-neutral-50/50 p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Financial</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-neutral-700">
              <li>Top 3 near-term money priorities</li>
              <li>Income, expenses, and debt pressure points</li>
              <li>Insurance and risk-management gaps</li>
            </ul>
          </Card>
          <Card className="border-neutral-200 bg-neutral-50/50 p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Retirement</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-neutral-700">
              <li>Target retirement age and income goals</li>
              <li>Social Security and RMD timing questions</li>
              <li>Tax-aware withdrawal sequencing concerns</li>
            </ul>
          </Card>
          <Card className="border-neutral-200 bg-neutral-50/50 p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Estate</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-neutral-700">
              <li>Status of will/trust, POA, healthcare docs</li>
              <li>Beneficiary designation review checklist</li>
              <li>Top transfer and tax concerns for heirs</li>
            </ul>
          </Card>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          {canDownload ? (
            <ButtonAnchor href="/api/education/prep-sheet/download">Download Prep Sheet</ButtonAnchor>
          ) : (
            <Card className="border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <p>
                A paid active subscription is required to download prep sheets. Trial access supports on-screen
                learning only.
              </p>
              <div className="mt-3">
                <ButtonLink href="/billing" size="sm">
                  View subscription options
                </ButtonLink>
              </div>
            </Card>
          )}
        </div>
      </Card>

      <div className="mt-8">
        <EducationDisclaimer />
      </div>
    </div>
  )
}

