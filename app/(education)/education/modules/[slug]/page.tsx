import { notFound } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import { ButtonLink } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EducationDisclaimer } from '@/components/education/EducationDisclaimer'
import { EducationMetaBadges } from '@/components/education/EducationMetaBadges'
import { getEducationModule, listEducationModules } from '@/lib/education/loaders'
import ModuleProgressToggle from '@/components/education/ModuleProgressToggle'
import ModuleResumeBanner from '@/components/education/ModuleResumeBanner'
import { EducationProse } from '@/components/education/EducationProse'

const PILLAR_LABEL: Record<string, string> = {
  financial: 'Financial Planning',
  retirement: 'Retirement Planning',
  estate: 'Estate Planning',
}

export async function generateStaticParams() {
  const modules = await listEducationModules()
  return modules.map((m) => ({ slug: m.slug }))
}

export default async function EducationModulePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const module = await getEducationModule(slug)
  const modules = await listEducationModules()
  if (!module) notFound()

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <ButtonLink href="/education" variant="link">
        ← Back to Education Guide
      </ButtonLink>

      <Card className="mt-4 overflow-hidden p-0">
        <div className="border-b border-neutral-100 bg-neutral-50/60 px-6 py-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">
              <EducationMetaBadges
                pillarLabel={PILLAR_LABEL[module.pillar]}
                complexity={module.complexity}
                estimatedTime={module.estimatedTime}
              />
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-neutral-900">{module.title}</h1>
            </div>
            <div className="shrink-0">
              <ModuleProgressToggle slug={module.slug} />
            </div>
          </div>
        </div>
        <div className="px-6 py-6">
          <EducationProse>
            <ReactMarkdown>{module.body}</ReactMarkdown>
          </EducationProse>
        </div>
      </Card>
      <ModuleResumeBanner currentSlug={module.slug} modules={modules} />

      <div className="mt-8">
        <EducationDisclaimer />
      </div>
    </div>
  )
}

