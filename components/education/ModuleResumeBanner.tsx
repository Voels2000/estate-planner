'use client'

import { useEffect, useMemo, useState } from 'react'
import type { EducationModuleMeta } from '@/lib/education/loaders'
import { fetchCompletedModules } from '@/lib/education/progressClient'
import { ButtonLink } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

export default function ModuleResumeBanner({
  currentSlug,
  modules,
}: {
  currentSlug: string
  modules: EducationModuleMeta[]
}) {
  const [completed, setCompleted] = useState<Set<string>>(new Set())

  useEffect(() => {
    let mounted = true
    void fetchCompletedModules().then((set) => {
      if (!mounted) return
      setCompleted(set)
    })
    const onProgressChanged = () => {
      void fetchCompletedModules().then((set) => setCompleted(set))
    }
    window.addEventListener('education-progress-updated', onProgressChanged)
    return () => {
      mounted = false
      window.removeEventListener('education-progress-updated', onProgressChanged)
    }
  }, [])

  const nextIncomplete = useMemo(
    () => modules.find((module) => !completed.has(module.slug)),
    [completed, modules],
  )

  if (!nextIncomplete || nextIncomplete.slug === currentSlug) return null

  return (
    <Card className="mt-4 border-indigo-200 bg-indigo-50 px-4 py-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <p className="text-sm text-indigo-900">
          Resume where you left off:{' '}
          <ButtonLink
            href={`/education/modules/${nextIncomplete.slug}`}
            variant="link"
            className="font-semibold text-indigo-900 hover:text-indigo-950"
          >
            {nextIncomplete.title}
          </ButtonLink>
        </p>
        <ButtonLink href={`/education/modules/${nextIncomplete.slug}`} size="sm">
          Continue
        </ButtonLink>
      </div>
    </Card>
  )
}

