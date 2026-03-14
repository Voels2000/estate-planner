import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { runProjection } from '@/lib/calculations/projection'
import type { ProjectionYear } from '@/lib/calculations/projection'
import { ProjectionsView } from './_projections-view'

const CURRENT_YEAR = new Date().getFullYear()

export const metadata = {
  title: 'Projections',
}

export default async function ProjectionsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: household } = await supabase
    .from('households')
    .select('id, person1_birth_year')
    .eq('owner_id', user.id)
    .maybeSingle()

  if (!household?.id) {
    return (
      <div className="p-6 md:p-8">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Projections
        </h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          Set up your household profile first to run financial projections.
        </p>
        <Link
          href="/profile"
          className="mt-4 inline-block rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Go to Profile
        </Link>
      </div>
    )
  }

  let projection: ProjectionYear[] = []
  let error: string | null = null
  const person1BirthYear =
    household.person1_birth_year != null
      ? Number(household.person1_birth_year)
      : CURRENT_YEAR - 50

  try {
    projection = await runProjection(household.id, {
      person1_birth_year: person1BirthYear,
      start_year: CURRENT_YEAR,
      end_year: CURRENT_YEAR + 40,
    })
  } catch (e) {
    error = e instanceof Error ? e.message : 'Failed to run projection'
  }

  return (
    <div className="p-6 md:p-8">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        Projections
      </h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        Year-by-year financial outlook based on your assets, income, and expenses.
      </p>
      {household.person1_birth_year == null && (
        <p className="mt-2 text-sm text-amber-600 dark:text-amber-400">
          Using default birth year for age. Set Person 1 birth year in Profile for accurate ages.
        </p>
      )}
      <ProjectionsView projection={projection} error={error} />
    </div>
  )
}
