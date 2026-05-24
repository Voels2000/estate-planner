import { notFound } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import { createClient } from '@/lib/supabase/server'
import { ButtonLink } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
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
  const educationModules = await listEducationModules()
  return educationModules.map((m) => ({ slug: m.slug }))
}

export default async function EducationModulePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const educationModule = await getEducationModule(slug)
  const educationModules = await listEducationModules()
  if (!educationModule) notFound()

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <ButtonLink href="/education" variant="link" className="text-[color:var(--navy)]">
        ← Back to Education Guide
      </ButtonLink>

      <Card className="card-surface mt-4 overflow-hidden p-0">
        <div className="module-header px-6 py-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">
              <EducationMetaBadges
                pillarLabel={PILLAR_LABEL[educationModule.pillar]}
                complexity={educationModule.complexity}
                estimatedTime={educationModule.estimatedTime}
              />
              <h1 className="mt-3 text-3xl font-semibold tracking-tight">{educationModule.title}</h1>
            </div>
            <div className="shrink-0">
              {user ? <ModuleProgressToggle slug={educationModule.slug} /> : null}
            </div>
          </div>
        </div>
        <div className="px-6 py-6">
          <EducationProse>
            <ReactMarkdown>{educationModule.body}</ReactMarkdown>
          </EducationProse>
        </div>
      </Card>
      <ModuleResumeBanner currentSlug={educationModule.slug} modules={educationModules} />

    </div>
  )
}

