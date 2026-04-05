import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getUserAccess } from '@/lib/get-user-access'
import UpgradeBanner from '@/app/(dashboard)/_components/UpgradeBanner'
import {
  getTrustWillRecommendations,
  getTrustWillChecklist,
  type ProfileData,
} from '@/lib/trust-will-rules'

export default async function TrustWillPage() {
  const access = await getUserAccess()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  if (access.tier < 3) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="mb-4 text-2xl font-bold text-gray-900">Trust & Will</h1>
        <UpgradeBanner
          requiredTier={3}
          moduleName="Trust & Will"
          valueProposition="Review your trust and will structure against your current estate complexity."
        />
      </div>
    )
  }

  const admin = createAdminClient()

  // Fetch assets and liabilities for estate value
  const [{ data: assets }, { data: liabilities }, { data: profile }, { data: beneficiaries }] =
    await Promise.all([
      admin.from('assets').select('value').eq('owner_id', user.id),
      admin.from('liabilities').select('amount').eq('owner_id', user.id),
      admin.from('profiles').select('marital_status, is_admin').eq('id', user.id).single(),
      admin.from('beneficiaries').select('date_of_birth').eq('owner_id', user.id),
    ])

  const totalAssets = (assets ?? []).reduce((sum, a) => sum + (a.value ?? 0), 0)
  const totalLiabilities = (liabilities ?? []).reduce((sum, l) => sum + (l.amount ?? 0), 0)
  const estateValue = totalAssets - totalLiabilities

  const now = new Date()
  const hasMinorChildren = (beneficiaries ?? []).some((b) => {
    if (!b.date_of_birth) return false
    const age = now.getFullYear() - new Date(b.date_of_birth).getFullYear()
    return age < 18
  })

  // Fetch domicile risk from domicile_analyses if available
  const { data: domicile } = await admin
    .from('domicile_analyses')
    .select('risk_score')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const riskScore = domicile?.risk_score ?? 0
  const domicileRisk =
    riskScore >= 71 ? 'critical' :
    riskScore >= 46 ? 'high' :
    riskScore >= 21 ? 'moderate' : 'low'

  // Check for existing trust in titling
  const { data: titling } = await admin
    .from('asset_titling')
    .select('title_type')
    .eq('owner_id', user.id)

  const hasExistingTrust = (titling ?? []).some((t) =>
    t.title_type?.toLowerCase().includes('trust')
  )

  // Check for business assets
  const { data: businessAssets } = await admin
    .from('assets')
    .select('type')
    .eq('owner_id', user.id)
    .ilike('type', '%business%')

  const hasBusinessInterests = (businessAssets ?? []).length > 0

  const profileData: ProfileData = {
    estateValue,
    isMarried: profile?.marital_status === 'married',
    hasMinorChildren,
    domicileRisk,
    hasExistingTrust,
    hasBusinessInterests,
  }

  const recommendations = getTrustWillRecommendations(profileData)
  const checklist = getTrustWillChecklist(profileData)

  const priorityColors = {
    high: 'bg-red-50 border-red-200 text-red-700',
    medium: 'bg-amber-50 border-amber-200 text-amber-700',
    low: 'bg-blue-50 border-blue-200 text-blue-700',
  }

  const priorityLabels = {
    high: 'High Priority',
    medium: 'Medium Priority',
    low: 'Good to Have',
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-10 space-y-10">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Trust & Will Guidance</h1>
        <p className="mt-2 text-sm text-neutral-500">
          Personalized recommendations based on your estate profile. This is guidance only —
          please consult a qualified estate planning attorney before taking action.
        </p>
      </div>

      {/* Estate Value Summary */}
      <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-6 py-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
          Estimated Estate Value
        </p>
        <p className="mt-1 text-2xl font-bold text-neutral-900">
          ${estateValue.toLocaleString()}
        </p>
      </div>

      {/* Recommendations */}
      <div>
        <h2 className="text-lg font-semibold text-neutral-900 mb-4">
          Recommended Documents
        </h2>
        {recommendations.length === 0 ? (
          <p className="text-sm text-neutral-500">
            No specific recommendations at this time. Ensure your basic will is up to date.
          </p>
        ) : (
          <div className="space-y-3">
            {recommendations.map((rec) => (
              <div
                key={rec.title}
                className={`rounded-xl border px-5 py-4 ${priorityColors[rec.priority]}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <p className="font-semibold text-sm">{rec.title}</p>
                  <span className="text-xs font-medium opacity-70">
                    {priorityLabels[rec.priority]}
                  </span>
                </div>
                <p className="text-sm opacity-80">{rec.description}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Checklist */}
      <div>
        <h2 className="text-lg font-semibold text-neutral-900 mb-4">
          Action Checklist
        </h2>
        <div className="rounded-xl border border-neutral-200 bg-white divide-y divide-neutral-100">
          {checklist.map((item, i) => (
            <div key={i} className="flex items-start gap-3 px-5 py-3">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-neutral-300 text-neutral-900"
                defaultChecked={item.completed}
              />
              <p className="text-sm text-neutral-700">{item.task}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Disclaimer */}
      <p className="text-xs text-neutral-400 border-t border-neutral-100 pt-6">
        This guidance is generated based on information you have entered into Estate Planner.
        It is not legal advice. Always consult a licensed estate planning attorney in your state
        before making decisions about trusts, wills, or estate documents.
      </p>
    </div>
  )
}
