import { listEducationModules } from '@/lib/education/loaders'
import { EducationDisclaimer } from '@/components/education/EducationDisclaimer'
import EducationModuleCatalog from '@/components/education/EducationModuleCatalog'
import { ButtonLink } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { SectionHeader } from '@/components/ui/SectionHeader'

export default async function EducationGuidePage() {
  const modules = await listEducationModules()

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Card className="education-hero rounded-xl p-8 text-center">
        <div className="education-hero-badge inline-flex items-center rounded-full px-4 py-1 text-[11px] font-medium uppercase tracking-wide">
          Educational Platform
        </div>
        <h1 className="education-title mt-5 text-4xl leading-tight">
          Plan with Confidence.
          <br />
          Learn Before You Leap.
        </h1>
        <p className="education-subtitle mx-auto mt-4 max-w-2xl text-base leading-relaxed">
          Understand financial, retirement, and estate planning concepts in plain English. Explore options
          without pressure and prepare for informed conversations with licensed professionals.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-2">
          <ButtonLink href="/education/decision-tree" className="education-primary-btn border-transparent">
            Take the Decision Tree
          </ButtonLink>
          <ButtonLink href="/education/glossary" variant="secondary">
            Browse Glossary
          </ButtonLink>
          <ButtonLink href="/education/prep-sheet" variant="secondary">
            Advisor Prep Sheet
          </ButtonLink>
        </div>
      </Card>

      <div className="mt-10 border-t border-neutral-200 pt-8">
        <SectionHeader
          title="Educational Modules"
          subtitle="Explore key concepts across financial, retirement, and estate planning pillars."
          className="mb-6"
        />
      </div>

      <EducationModuleCatalog modules={modules} />

      <div className="mt-8">
        <EducationDisclaimer />
      </div>
    </div>
  )
}

