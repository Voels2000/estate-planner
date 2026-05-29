import type { SupabaseClient } from '@supabase/supabase-js'
import { resolveEstateActionHref } from '@/lib/dashboard/estateUpgradeHref'

export type ChecklistItemStatus =
  | 'complete'
  | 'flagged'
  | 'incomplete'
  | 'not_applicable'

export interface EstateExecutionItem {
  task_key: string
  label: string
  description: string
  status: ChecklistItemStatus
  link: string
  linkLabel: string
  minTier: 1 | 2 | 3
  consumerChecked: boolean
  completedAt?: string | null
}

type EstateDocRow = {
  doc_type?: string | null
  document_type?: string | null
  status?: string | null
  exists?: boolean | null
}

function docOnFile(docs: EstateDocRow[], types: string[]): boolean {
  return docs.some((d) => {
    const type = (d.doc_type ?? d.document_type ?? '').toLowerCase()
    if (!types.some((t) => t === type)) return false
    if (d.status === 'exists' || d.status === 'confirmed') return true
    if (d.exists === true) return true
    return false
  })
}

interface BuildChecklistInput {
  householdId: string
  ownerId: string
  userTier: number
  beneficiaryConflictsCount?: number
  hasMinorChildren?: boolean
  hasBusinessInterests?: boolean
}

export async function buildEstateExecutionChecklist(
  supabase: SupabaseClient,
  input: BuildChecklistInput,
): Promise<EstateExecutionItem[]> {
  const {
    householdId,
    ownerId,
    userTier,
    beneficiaryConflictsCount = 0,
    hasMinorChildren = false,
    hasBusinessInterests = false,
  } = input

  const tierLink = (href: string, label: string) => ({
    link: resolveEstateActionHref(href, userTier),
    linkLabel: userTier >= 3 ? label : 'Upgrade to access',
  })

  const [docsByHousehold, docsByOwner, trustsResult, healthCheckResult, checklistItemsResult] =
    await Promise.all([
      supabase.from('estate_documents').select('doc_type, status').eq('household_id', householdId),
      supabase
        .from('estate_documents')
        .select('document_type, exists')
        .eq('owner_id', ownerId),
      supabase.from('trusts').select('status').eq('owner_id', ownerId),
      supabase
        .from('estate_health_check')
        .select('has_will, has_trust, has_poa, has_hcd, beneficiaries_current')
        .eq('household_id', householdId)
        .maybeSingle(),
      supabase
        .from('estate_checklist_items')
        .select('task_key, completed, completed_at')
        .eq('household_id', householdId),
    ])

  const estateDocs: EstateDocRow[] = [
    ...(docsByHousehold.data ?? []),
    ...(docsByOwner.data ?? []),
  ]
  const trusts = trustsResult.data ?? []
  const healthCheck = healthCheckResult.data
  const checklistItems = checklistItemsResult.data ?? []

  const consumerChecked = Object.fromEntries(
    checklistItems.map((i) => [
      i.task_key,
      { completed: i.completed, completedAt: i.completed_at as string | null },
    ]),
  )

  const hasFundedTrust = trusts.some(
    (t) => t.status === 'funded' || t.status === 'existing',
  )

  const hasWillOnFile =
    docOnFile(estateDocs, ['will', 'trust', 'revocable_trust', 'revocable']) ||
    healthCheck?.has_will === true ||
    healthCheck?.has_trust === true

  const hasDpoa =
    docOnFile(estateDocs, ['dpoa', 'poa']) || healthCheck?.has_poa === true

  const hasHealthcare =
    docOnFile(estateDocs, [
      'medical_poa',
      'advance_directive',
      'living_will',
      'healthcare_directive',
    ]) || healthCheck?.has_hcd === true

  function itemStatus(
    taskKey: string,
    autoComplete: boolean,
    hasConflict = false,
  ): ChecklistItemStatus {
    if (consumerChecked[taskKey]?.completed || autoComplete) return 'complete'
    if (hasConflict) return 'flagged'
    return 'incomplete'
  }

  const conflictSuffix =
    beneficiaryConflictsCount > 0 ? ` (${beneficiaryConflictsCount} issues)` : ''

  const items: EstateExecutionItem[] = [
    {
      task_key: 'will_on_file',
      label: 'Will or trust on file',
      description:
        'Confirm your estate attorney has a current will or trust on file.',
      status: itemStatus('will_on_file', hasWillOnFile),
      ...tierLink('/my-estate-trust-strategy?tab=trusts', 'Go to Trusts & Documents'),
      minTier: 3,
      consumerChecked: consumerChecked['will_on_file']?.completed ?? false,
      completedAt: consumerChecked['will_on_file']?.completedAt,
    },
    {
      task_key: 'dpoa_on_file',
      label: 'Durable power of attorney signed',
      description:
        'Ensure a DPOA is signed so someone can manage your finances if needed.',
      status: itemStatus('dpoa_on_file', hasDpoa),
      ...tierLink('/incapacity-planning', 'Go to Incapacity Planning'),
      minTier: 3,
      consumerChecked: consumerChecked['dpoa_on_file']?.completed ?? false,
      completedAt: consumerChecked['dpoa_on_file']?.completedAt,
    },
    {
      task_key: 'healthcare_directive',
      label: 'Healthcare directive signed',
      description:
        'Document your medical wishes with a healthcare directive or living will.',
      status: itemStatus('healthcare_directive', hasHealthcare),
      ...tierLink('/incapacity-planning', 'Go to Incapacity Planning'),
      minTier: 3,
      consumerChecked: consumerChecked.healthcare_directive?.completed ?? false,
      completedAt: consumerChecked.healthcare_directive?.completedAt,
    },
    {
      task_key: 'beneficiaries_updated',
      label: 'Beneficiaries reviewed and current',
      description:
        'Review primary and contingent beneficiaries on all accounts.',
      status: itemStatus(
        'beneficiaries_updated',
        healthCheck?.beneficiaries_current === true && beneficiaryConflictsCount === 0,
        beneficiaryConflictsCount > 0,
      ),
      ...tierLink(
        '/titling',
        beneficiaryConflictsCount > 0
          ? `Review${conflictSuffix}`
          : 'Review beneficiaries',
      ),
      minTier: 3,
      consumerChecked: consumerChecked['beneficiaries_updated']?.completed ?? false,
      completedAt: consumerChecked['beneficiaries_updated']?.completedAt,
    },
    ...(trusts.length > 0
      ? [
          {
            task_key: 'trust_funded',
            label: 'Trust funded',
            description:
              'Assets have been transferred into the trust to activate its protections.',
            status: itemStatus('trust_funded', hasFundedTrust),
            ...tierLink('/my-estate-trust-strategy?tab=trusts', 'Go to Trusts & Documents'),
            minTier: 3 as const,
            consumerChecked: consumerChecked['trust_funded']?.completed ?? false,
            completedAt: consumerChecked['trust_funded']?.completedAt,
          },
        ]
      : []),
    {
      task_key: 'titling_reviewed',
      label: 'Asset titling reviewed',
      description:
        'Confirm asset titles align with your estate plan (trusts, joint, TOD).',
      status: itemStatus('titling_reviewed', false),
      ...tierLink('/titling', 'Review titling'),
      minTier: 3,
      consumerChecked: consumerChecked['titling_reviewed']?.completed ?? false,
      completedAt: consumerChecked['titling_reviewed']?.completedAt,
    },
    ...(hasMinorChildren
      ? [
          {
            task_key: 'guardian_named',
            label: 'Guardian named for minor children',
            description: 'Designate a guardian in your will for children under 18.',
            status: itemStatus('guardian_named', false),
            ...tierLink('/my-estate-trust-strategy?tab=trusts', 'Go to Trusts & Documents'),
            minTier: 3 as const,
            consumerChecked: consumerChecked['guardian_named']?.completed ?? false,
            completedAt: consumerChecked['guardian_named']?.completedAt,
          },
        ]
      : []),
    ...(hasBusinessInterests
      ? [
          {
            task_key: 'annual_gifts_logged',
            label: 'Annual gifting documented',
            description:
              'Track annual exclusion gifts to reduce your taxable estate over time.',
            status: itemStatus('annual_gifts_logged', false),
            ...tierLink('/my-estate-trust-strategy?tab=gifting', 'Go to Annual Gifting'),
            minTier: 3 as const,
            consumerChecked: consumerChecked['annual_gifts_logged']?.completed ?? false,
            completedAt: consumerChecked['annual_gifts_logged']?.completedAt,
          },
        ]
      : []),
  ]

  const order: Record<ChecklistItemStatus, number> = {
    flagged: 0,
    incomplete: 1,
    not_applicable: 2,
    complete: 3,
  }

  return items.sort((a, b) => order[a.status] - order[b.status])
}
