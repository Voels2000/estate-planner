import Link from 'next/link'
import { listEducationModules } from '@/lib/education/loaders'
import { DisclaimerBanner } from '@/lib/components/DisclaimerBanner'
import EducationModuleCatalog from '@/components/education/EducationModuleCatalog'

export default async function EducationGuidePage() {
  const modules = await listEducationModules()

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-3xl font-semibold text-neutral-900">Education Guide</h1>
      <p className="mt-2 text-sm text-neutral-600">
        Learn core planning concepts before making planning decisions. This area is educational and
        intended to help you prepare for better conversations with professionals.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href="/education/decision-tree"
          className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
        >
          Decision Tree
        </Link>
        <Link
          href="/education/glossary"
          className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
        >
          Glossary
        </Link>
        <Link
          href="/education/prep-sheet"
          className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
        >
          Advisor Prep Sheet
        </Link>
      </div>

      <EducationModuleCatalog modules={modules} />

      <div className="mt-8">
        <DisclaimerBanner context="education guide" />
      </div>
    </div>
  )
}

