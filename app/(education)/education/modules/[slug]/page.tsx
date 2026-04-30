import { notFound } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import { ButtonLink } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { DisclaimerBanner } from '@/lib/components/DisclaimerBanner'
import { getEducationModule, listEducationModules } from '@/lib/education/loaders'
import ModuleProgressToggle from '@/components/education/ModuleProgressToggle'
import ModuleResumeBanner from '@/components/education/ModuleResumeBanner'

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

      <Card className="mt-4 p-6">
        <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
          {PILLAR_LABEL[module.pillar]} · {module.complexity} · {module.estimatedTime}
        </p>
        <h1 className="mt-1 text-3xl font-semibold text-neutral-900">{module.title}</h1>
        <div className="mt-4">
          <ModuleProgressToggle slug={module.slug} />
        </div>
        <article className="prose prose-neutral mt-6 max-w-none">
          <ReactMarkdown>{module.body}</ReactMarkdown>
        </article>
      </Card>
      <ModuleResumeBanner currentSlug={module.slug} modules={modules} />

      <div className="mt-8">
        <DisclaimerBanner context="education guide" />
      </div>
    </div>
  )
}

