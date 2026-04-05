import { InsuranceClient } from "./_insurance-client"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { getUserAccess } from "@/lib/get-user-access"
import UpgradeBanner from "@/app/(dashboard)/_components/UpgradeBanner"

export const dynamic = "force-dynamic"

export default async function InsurancePage() {
  const access = await getUserAccess()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  if (access.tier < 2) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="mb-4 text-2xl font-bold text-gray-900">Insurance Gap Analysis</h1>
        <UpgradeBanner
          requiredTier={2}
          moduleName="Insurance Gap Analysis"
          valueProposition="Identify coverage gaps across life, disability, and long-term care policies."
        />
      </div>
    )
  }

  const { data: policies } = await supabase
    .from("insurance_policies")
    .select("*")
    .eq("user_id", user!.id)
    .order("insurance_type", { ascending: true })

  const { data: profile } = await supabase
    .from("profiles")
    .select("annual_income, age, spouse_age, dependents, total_assets, total_debts, monthly_expenses, has_spouse")
    .eq("id", user!.id)
    .single()

  return <InsuranceClient initialPolicies={policies || []} profile={profile} />
}
