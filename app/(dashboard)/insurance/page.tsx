import { InsuranceClient } from "./_insurance-client"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export default async function InsurancePage() {
  // Former tier billing redirect removed — layout enforces subscription.

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

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
