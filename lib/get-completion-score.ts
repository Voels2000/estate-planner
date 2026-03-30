import { createAdminClient } from '@/lib/supabase/admin'

export type CompletionItem = {
  key: string
  label: string
  description: string
  href: string
  completed: boolean
}

export type CompletionScore = {
  completed: number
  total: number
  threshold: number
  unlocked: boolean
  items: CompletionItem[]
}

function socialSecurityReviewed(h: {
  person1_ss_claiming_age: number | null
  person2_ss_claiming_age: number | null
  person1_ss_benefit_67: number | null
  person2_ss_benefit_67: number | null
  has_spouse: boolean | null
} | null): boolean {
  if (!h) return false
  if (h.person1_ss_claiming_age != null || (h.person1_ss_benefit_67 != null && h.person1_ss_benefit_67 > 0)) {
    return true
  }
  if (h.has_spouse && (h.person2_ss_claiming_age != null || (h.person2_ss_benefit_67 != null && h.person2_ss_benefit_67 > 0))) {
    return true
  }
  return false
}

export async function getCompletionScore(userId: string): Promise<CompletionScore> {
  const admin = createAdminClient()

  const [
    assets,
    liabilities,
    income,
    expenses,
    retirementAssets,
    insurance,
    householdSs,
  ] = await Promise.all([
    admin.from('assets').select('id', { count: 'exact', head: true }).eq('owner_id', userId),
    admin.from('liabilities').select('id', { count: 'exact', head: true }).eq('owner_id', userId),
    admin.from('income').select('id', { count: 'exact', head: true }).eq('owner_id', userId),
    admin.from('expenses').select('id', { count: 'exact', head: true }).eq('owner_id', userId),
    admin.from('assets').select('id', { count: 'exact', head: true })
      .eq('owner_id', userId)
      .or('type.ilike.%retirement%,type.ilike.%ira%,type.ilike.%401k%,type.ilike.%403b%,type.ilike.%roth%'),
    admin.from('insurance_policies').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    admin.from('households')
      .select('person1_ss_claiming_age, person2_ss_claiming_age, person1_ss_benefit_67, person2_ss_benefit_67, has_spouse')
      .eq('owner_id', userId)
      .maybeSingle(),
  ])

  const items: CompletionItem[] = [
    {
      key: 'assets',
      label: 'Assets entered',
      description: 'Add at least one asset to your financial profile',
      href: '/assets',
      completed: (assets.count ?? 0) > 0,
    },
    {
      key: 'liabilities',
      label: 'Liabilities entered',
      description: 'Add at least one liability such as a mortgage or loan',
      href: '/liabilities',
      completed: (liabilities.count ?? 0) > 0,
    },
    {
      key: 'income',
      label: 'Income entered',
      description: 'Add your income sources',
      href: '/income',
      completed: (income.count ?? 0) > 0,
    },
    {
      key: 'expenses',
      label: 'Expenses entered',
      description: 'Add your monthly expenses',
      href: '/expenses',
      completed: (expenses.count ?? 0) > 0,
    },
    {
      key: 'retirement_account',
      label: 'Retirement account added',
      description: 'Add an IRA, 401(k), 403(b), or Roth account to your assets',
      href: '/assets',
      completed: (retirementAssets.count ?? 0) > 0,
    },
    {
      key: 'insurance',
      label: 'Insurance Gap Analysis completed',
      description: 'Complete your insurance gap analysis',
      href: '/insurance',
      completed: (insurance.count ?? 0) > 0,
    },
    {
      key: 'social_security',
      label: 'Social Security reviewed',
      description: 'Set Social Security claiming ages or benefits in your household profile',
      href: '/social-security',
      completed: socialSecurityReviewed(householdSs.data),
    },
  ]

  const completedCount = items.filter(i => i.completed).length
  const threshold = 5

  return {
    completed: completedCount,
    total: items.length,
    threshold,
    unlocked: completedCount >= threshold,
    items,
  }
}
