'use client'

import Link from 'next/link'
import { useMemo, useState, useEffect } from 'react'
import type { EducationModuleMeta } from '@/lib/education/loaders'
import { fetchCompletedEntries, fetchCompletedModules, type CompletedEntry } from '@/lib/education/progressClient'

const PILLAR_LABEL: Record<string, string> = {
  financial: 'Financial Planning',
  retirement: 'Retirement Planning',
  estate: 'Estate Planning',
}

const BUNDLES = [
  {
    id: 'foundations',
    label: 'Foundations Path',
    moduleSlugs: [
      'financial-foundations',
      'retirement-foundations',
      'estate-foundations',
      'beneficiary-designations',
    ],
  },
  {
    id: 'estate-advanced',
    label: 'Estate Advanced Path',
    moduleSlugs: [
      'trusts-deep-dive',
      'estate-gift-tax-basics',
      'charitable-trusts-overview',
      'qprt-education-overview',
      'flp-fllc-education-overview',
      'asset-protection-education',
      'multi-state-planning-basics',
      'business-succession-education',
    ],
  },
  {
    id: 'scenario',
    label: 'Scenario Path',
    moduleSlugs: [
      'scenario-library-overview',
      'scenario-blended-family',
      'scenario-business-owner',
      'scenario-recent-retiree',
      'scenario-digital-nomad',
    ],
  },
] as const

export default function EducationModuleCatalog({
  modules,
}: {
  modules: EducationModuleMeta[]
}) {
  const [selectedPillar, setSelectedPillar] = useState<'all' | 'financial' | 'retirement' | 'estate'>('all')
  const [selectedComplexity, setSelectedComplexity] = useState<'all' | 'foundation' | 'intermediate' | 'advanced'>('all')
  const [selectedBundle, setSelectedBundle] = useState<'all' | (typeof BUNDLES)[number]['id']>('all')
  const [query, setQuery] = useState('')
  const [completed, setCompleted] = useState<Set<string>>(new Set())
  const [recentCompleted, setRecentCompleted] = useState<CompletedEntry[]>([])

  useEffect(() => {
    let mounted = true
    void fetchCompletedModules().then((set) => {
      if (!mounted) return
      setCompleted(set)
    })
    void fetchCompletedEntries().then((entries) => {
      if (!mounted) return
      setRecentCompleted(entries.slice(0, 3))
    })
    const onProgressChanged = () => {
      void fetchCompletedModules().then((set) => setCompleted(set))
      void fetchCompletedEntries().then((entries) => setRecentCompleted(entries.slice(0, 3)))
    }
    window.addEventListener('education-progress-updated', onProgressChanged)
    return () => {
      mounted = false
      window.removeEventListener('education-progress-updated', onProgressChanged)
    }
  }, [])

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    const activeBundle =
      selectedBundle === 'all' ? null : BUNDLES.find((bundle) => bundle.id === selectedBundle) ?? null
    return modules.filter((module) => {
      const pillarOk = selectedPillar === 'all' || module.pillar === selectedPillar
      const complexityOk = selectedComplexity === 'all' || module.complexity === selectedComplexity
      const bundleOk =
        !activeBundle || activeBundle.moduleSlugs.some((slug) => slug === module.slug)
      const queryOk =
        normalized.length === 0 ||
        module.title.toLowerCase().includes(normalized) ||
        module.summary.toLowerCase().includes(normalized) ||
        module.tags.some((tag) => tag.toLowerCase().includes(normalized))
      return pillarOk && complexityOk && bundleOk && queryOk
    })
  }, [modules, query, selectedBundle, selectedComplexity, selectedPillar])
  const completionPct = modules.length > 0
    ? Math.round((completed.size / modules.length) * 100)
    : 0
  const nextRecommended = modules.find((module) => !completed.has(module.slug))
  const selectedBundleMeta =
    selectedBundle === 'all' ? null : BUNDLES.find((bundle) => bundle.id === selectedBundle) ?? null
  const pathStartModule = useMemo(() => {
    if (!selectedBundleMeta) return null
    const inPath = selectedBundleMeta.moduleSlugs
      .map((slug) => modules.find((m) => m.slug === slug))
      .filter((m): m is EducationModuleMeta => !!m)
    if (inPath.length === 0) return null
    return inPath.find((m) => !completed.has(m.slug)) ?? inPath[0]
  }, [completed, modules, selectedBundleMeta])
  const slugToTitle = useMemo(
    () => new Map(modules.map((module) => [module.slug, module.title])),
    [modules],
  )
  const foundationByPillar = useMemo(() => {
    const pillars: Array<'financial' | 'retirement' | 'estate'> = ['financial', 'retirement', 'estate']
    return pillars.map((pillar) => {
      const firstFoundation = modules.find(
        (module) => module.pillar === pillar && module.complexity === 'foundation',
      )
      const isDone = firstFoundation ? completed.has(firstFoundation.slug) : true
      return {
        pillar,
        firstFoundation,
        isDone,
      }
    })
  }, [completed, modules])
  const nextPillarFocus = foundationByPillar.find((item) => !item.isDone && item.firstFoundation)

  return (
    <div>
      <div className="mt-4 rounded-xl border border-neutral-200 bg-white p-3">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-medium text-neutral-600">
            Progress: {completed.size} of {modules.length} modules completed
          </span>
          <span className="text-xs font-semibold text-neutral-700">{completionPct}%</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-neutral-100">
          <div
            className="h-full rounded-full bg-indigo-600 transition-all"
            style={{ width: `${completionPct}%` }}
          />
        </div>
        {nextRecommended && (
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-neutral-600">
              Next recommended: <span className="font-medium text-neutral-800">{nextRecommended.title}</span>
            </p>
            <Link
              href={`/education/modules/${nextRecommended.slug}`}
              className="inline-flex rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-indigo-700"
            >
              Continue learning
            </Link>
          </div>
        )}
        {nextPillarFocus?.firstFoundation && (
          <p className="mt-2 text-xs text-neutral-500">
            Suggested focus: complete the{' '}
            <span className="font-medium text-neutral-700">
              {PILLAR_LABEL[nextPillarFocus.pillar]}
            </span>{' '}
            foundation module (
            <span className="font-medium text-neutral-700">
              {nextPillarFocus.firstFoundation.title}
            </span>
            ) first.
          </p>
        )}
        {selectedBundleMeta && pathStartModule && (
          <div className="mt-2 flex items-center justify-between gap-2 rounded-md border border-indigo-200 bg-indigo-50 px-2.5 py-2">
            <p className="text-xs text-indigo-900">
              {selectedBundleMeta.label}: start with{' '}
              <span className="font-semibold">{pathStartModule.title}</span>
            </p>
            <Link
              href={`/education/modules/${pathStartModule.slug}`}
              className="inline-flex rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-indigo-700"
            >
              Start this path
            </Link>
          </div>
        )}
        {recentCompleted.length > 0 && (
          <div className="mt-2 border-t border-neutral-100 pt-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">
              Recently completed
            </p>
            <div className="mt-1 flex flex-wrap gap-1">
              {recentCompleted.map((entry) => (
                <span
                  key={`${entry.moduleSlug}-${entry.updatedAt}`}
                  className="rounded-md border border-green-200 bg-green-50 px-2 py-0.5 text-[10px] font-medium text-green-700"
                >
                  {slugToTitle.get(entry.moduleSlug) ?? entry.moduleSlug}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select
          value={selectedBundle}
          onChange={(e) => setSelectedBundle(e.target.value as typeof selectedBundle)}
          className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs text-neutral-700"
        >
          <option value="all">All paths</option>
          {BUNDLES.map((bundle) => (
            <option key={bundle.id} value={bundle.id}>
              {bundle.label}
            </option>
          ))}
        </select>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search modules, topics, tags..."
          className="min-w-[220px] flex-1 rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs text-neutral-700"
        />
        <select
          value={selectedPillar}
          onChange={(e) => setSelectedPillar(e.target.value as typeof selectedPillar)}
          className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs text-neutral-700"
        >
          <option value="all">All pillars</option>
          <option value="financial">Financial</option>
          <option value="retirement">Retirement</option>
          <option value="estate">Estate</option>
        </select>
        <select
          value={selectedComplexity}
          onChange={(e) => setSelectedComplexity(e.target.value as typeof selectedComplexity)}
          className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs text-neutral-700"
        >
          <option value="all">All levels</option>
          <option value="foundation">Foundation</option>
          <option value="intermediate">Intermediate</option>
          <option value="advanced">Advanced</option>
        </select>
        <span className="text-xs text-neutral-500">
          Showing {filtered.length} module{filtered.length === 1 ? '' : 's'}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        {filtered.map((module) => (
          <Link
            key={module.slug}
            href={`/education/modules/${module.slug}`}
            className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm hover:border-neutral-300"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                {PILLAR_LABEL[module.pillar]} · {module.complexity}
              </p>
              {completed.has(module.slug) && (
                <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700">
                  Completed
                </span>
              )}
            </div>
            <h2 className="mt-1 text-lg font-semibold text-neutral-900">{module.title}</h2>
            <p className="mt-2 text-sm text-neutral-600">{module.summary}</p>
            {module.tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1">
                {module.tags.slice(0, 4).map((tag) => (
                  <span
                    key={tag}
                    className="rounded-md border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[10px] text-neutral-600"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
            <p className="mt-3 text-xs text-neutral-500">Estimated time: {module.estimatedTime}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}

