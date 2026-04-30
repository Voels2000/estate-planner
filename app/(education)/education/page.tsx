import { listEducationModules } from '@/lib/education/loaders'
import { DisclaimerBanner } from '@/lib/components/DisclaimerBanner'
import EducationModuleCatalog from '@/components/education/EducationModuleCatalog'
import { ButtonLink } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { SectionHeader } from '@/components/ui/SectionHeader'

export default async function EducationGuidePage() {
  const modules = await listEducationModules()

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <SectionHeader
        title="Education Guide"
        subtitle="Learn core planning concepts before making planning decisions."
      />
      <Card className="mt-4 border-indigo-200 bg-indigo-50 px-4 py-3">
        <p className="text-sm font-medium text-indigo-900">
          This guide is educational; your living plan is built in the planning suite.
        </p>
        <p className="mt-1 text-xs text-indigo-900/80">
          Use this education hub to learn and prepare. Then use the planning workflows across financial,
          retirement, and estate areas to build, review, and update your living plan over time.
        </p>
        <div className="mt-3">
          <ButtonLink href="/dashboard" size="sm">Open Planning Suite</ButtonLink>
        </div>
      </Card>

      <div className="mt-4 flex flex-wrap gap-2">
        <ButtonLink href="/education/decision-tree" variant="secondary" size="sm">
          Decision Tree
        </ButtonLink>
        <ButtonLink href="/education/glossary" variant="secondary" size="sm">
          Glossary
        </ButtonLink>
        <ButtonLink href="/education/prep-sheet" variant="secondary" size="sm">
          Advisor Prep Sheet
        </ButtonLink>
      </div>

      <EducationModuleCatalog modules={modules} />

      <div className="mt-8">
        <DisclaimerBanner context="education guide" />
      </div>
    </div>
  )
}

