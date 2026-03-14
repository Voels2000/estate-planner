import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ScenariosView } from './_scenarios-view'

const CURRENT_YEAR = new Date().getFullYear()

export const metadata = {
  title: 'Scenarios',
}

export default async function ScenariosPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: household } = await supabase
    .from('households')
    .select(
      'id, person1_birth_year, person1_retirement_age, person1_ss_claiming_age, state_primary'
    )
    .eq('owner_id', user.id)
    .maybeSingle()

  if (!household?.id) {
    return (
      <div className="p-6 md:p-8">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Scenarios
        </h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          Set up your household profile first to compare projection scenarios.
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

  const person1BirthYear =
    household.person1_birth_year != null
      ? Number(household.person1_birth_year)
      : CURRENT_YEAR - 50

  return (
    <div className="w-full p-6 md:p-8">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        Scenarios
      </h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        Create and compare up to 3 side-by-side projection scenarios by changing
        retirement age, investment return, Social Security claiming age, and
        state of residence.
      </p>
      {household.person1_birth_year == null && (
        <p className="mt-2 text-sm text-amber-600 dark:text-amber-400">
          Using default birth year. Set Person 1 birth year in Profile for
          accurate ages.
        </p>
      )}
      <ScenariosView
        householdId={household.id}
        person1BirthYear={person1BirthYear}
        defaultStatePrimary={household.state_primary}
        defaultRetirementAge={
          household.person1_retirement_age != null
            ? Number(household.person1_retirement_age)
            : null
        }
        defaultSsClaimingAge={
          household.person1_ss_claiming_age != null
            ? Number(household.person1_ss_claiming_age)
            : null
        }
      />
    </div>
  )
}
