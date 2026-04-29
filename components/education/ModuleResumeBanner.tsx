'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import type { EducationModuleMeta } from '@/lib/education/loaders'
import { fetchCompletedModules } from '@/lib/education/progressClient'

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
    <div className="mt-4 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900">
      Resume where you left off:{' '}
      <Link href={`/education/modules/${nextIncomplete.slug}`} className="font-semibold underline">
        {nextIncomplete.title}
      </Link>
    </div>
  )
}

