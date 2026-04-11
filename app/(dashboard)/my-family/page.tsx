// ─────────────────────────────────────────
// Menu: Estate Planning > My Family
// Route: /my-family
// ─────────────────────────────────────────

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { displayPersonFirstName } from '@/lib/display-person-name'
import { getUserAccess } from '@/lib/get-user-access'
import UpgradeBanner from '@/app/(dashboard)/_components/UpgradeBanner'
import MyFamilyClient from './_my-family-client'

export default async function MyFamilyPage() {
  const access = await getUserAccess()
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  if (access.tier < 3) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="mb-4 text-2xl font-bold text-gray-900">My Family</h1>
        <UpgradeBanner
          requiredTier={3}
          moduleName="My Family"
          valueProposition="List family members, relationships, and GST-skip designations to align your estate flow and beneficiary planning."
        />
      </div>
    )
  }

  const { data: household } = await supabase
    .from('households')
    .select('id, person1_name, person2_name, has_spouse')
    .eq('owner_id', user.id)
    .maybeSingle()

  if (!household?.id) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12">
        <p className="text-sm text-neutral-500">No household found. Please complete your profile first.</p>
      </div>
    )
  }

  const { data: householdPeople } = await supabase
    .from('household_people')
    .select('id, full_name, relationship, date_of_birth, is_gst_skip, is_beneficiary, notes')
    .eq('household_id', household.id)
    .order('full_name', { ascending: true })

  return (
    <MyFamilyClient
      householdId={household.id}
      person1Name={household.person1_name != null ? displayPersonFirstName(household.person1_name) : null}
      person2Name={household.person2_name != null ? displayPersonFirstName(household.person2_name) : null}
      hasSpouse={household.has_spouse === true}
      initialPeople={householdPeople ?? []}
    />
  )
}
