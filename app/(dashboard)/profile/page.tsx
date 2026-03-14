import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { HouseholdProfileForm } from './_household-profile-form'

export default async function ProfilePage() {
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
      'id, person1_name, person1_birth_year, person1_retirement_age, person1_ss_claiming_age, person1_longevity_age, has_spouse, person2_name, person2_birth_year, person2_retirement_age, person2_ss_claiming_age, person2_longevity_age, filing_status, state_primary, state_compare, inflation_rate'
    )
    .eq('owner_id', user.id)
    .maybeSingle()

  const initialValues = household
    ? {
        person1_name: household.person1_name ?? '',
        person1_birth_year: household.person1_birth_year ?? undefined,
        person1_retirement_age: household.person1_retirement_age ?? undefined,
        person1_ss_claiming_age: household.person1_ss_claiming_age ?? undefined,
        person1_longevity_age: household.person1_longevity_age ?? undefined,
        has_spouse: household.has_spouse ?? false,
        person2_name: household.person2_name ?? '',
        person2_birth_year: household.person2_birth_year ?? undefined,
        person2_retirement_age: household.person2_retirement_age ?? undefined,
        person2_ss_claiming_age: household.person2_ss_claiming_age ?? undefined,
        person2_longevity_age: household.person2_longevity_age ?? undefined,
        filing_status: household.filing_status ?? 'single',
        state_primary: household.state_primary ?? '',
        state_compare: household.state_compare ?? '',
        inflation_rate: Number(household.inflation_rate ?? 3),
      }
    : undefined

  return (
    <div className="p-6 md:p-8">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        Household profile
      </h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        Manage your household details for planning and projections.
      </p>
      <HouseholdProfileForm userId={user.id} initialValues={initialValues} />
    </div>
  )
}
