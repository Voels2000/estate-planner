// Sprint 61 — Life Event Trigger Engine
// Evaluates all active alert_rules against a household's current data.
// Writes new household_alerts rows for triggered rules.
// Resolves alerts where the condition is no longer true.

import { createClient } from '@/lib/supabase/client'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AlertRule {
  id: string
  rule_name: string
  trigger_condition: Record<string, unknown>
  alert_type: 'info' | 'warning' | 'action_required'
  title: string
  body_template: string
  link_path: string | null
  severity: 'low' | 'medium' | 'high'
  applies_to_role: 'consumer' | 'advisor' | 'both'
  is_active: boolean
}

export interface HouseholdAlert {
  id: string
  household_id: string
  rule_id: string | null
  alert_type: string
  severity: string
  title: string
  description: string
  action_href: string | null
  action_label: string | null
  dismissed_at: string | null
  resolved_at: string | null
  is_reviewed: boolean
  context_data: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export interface EvaluationResult {
  triggered: number
  resolved: number
  errors: string[]
}

// ─── Main evaluation function ─────────────────────────────────────────────────

export async function evaluateAlerts(
  householdId: string,
  userId: string,
): Promise<EvaluationResult> {
  const supabase = createClient()
  const result: EvaluationResult = { triggered: 0, resolved: 0, errors: [] }

  // Load all active rules
  const { data: rules, error: rulesError } = await supabase
    .from('alert_rules')
    .select('*')
    .eq('is_active', true)

  if (rulesError || !rules) {
    result.errors.push('Failed to load alert rules')
    return result
  }

  // Load household data needed for evaluation
  const [
    householdRes,
    assetsRes,
    estateDocsRes,
    beneficiariesRes,
  ] = await Promise.all([
    supabase.from('households').select('*').eq('id', householdId).single(),
    supabase.from('assets').select('*').eq('owner_id', userId),
    supabase.from('estate_documents').select('*').eq('household_id', householdId),
    supabase.from('asset_beneficiaries').select('*').eq('owner_id', userId),
  ])

  let domicileRes = await supabase
    .from('domicile_analysis')
    .select('*')
    .eq('household_id', householdId)
    .maybeSingle()

  if (domicileRes.error) {
    domicileRes = await supabase
      .from('domicile_analysis')
      .select('*')
      .eq('owner_id', householdId)
      .maybeSingle()
  }

  const household = householdRes.data
  const assets = assetsRes.data ?? []
  const estateDocs = estateDocsRes.data ?? []
  const beneficiaries = beneficiariesRes.data ?? []
  const domicile = domicileRes.data

  if (!household) {
    result.errors.push('Household not found')
    return result
  }

  // Evaluate each rule
  for (const rule of rules) {
    try {
      const evaluation = evaluateRule(rule, {
        household,
        assets,
        estateDocs,
        beneficiaries,
        domicile,
      })

      if (evaluation.triggered) {
        // Fill in body template with context variables
        const description = fillTemplate(rule.body_template, evaluation.context)

        // Upsert alert via security definer function
        const { error: upsertError } = await supabase.rpc('upsert_household_alert', {
          p_household_id: householdId,
          p_rule_id: rule.id,
          p_alert_type: rule.alert_type,
          p_severity: rule.severity,
          p_title: rule.title,
          p_description: description,
          p_action_href: rule.link_path,
          p_action_label: rule.link_path ? 'Review now' : null,
          p_context_data: evaluation.context,
        })
        if (upsertError) {
          console.error('upsert_household_alert error details:', JSON.stringify(upsertError))
          console.error('upsert params:', JSON.stringify({
            p_household_id: householdId,
            p_rule_id: rule.id,
            p_alert_type: rule.alert_type,
            p_severity: rule.severity,
            p_title: rule.title,
            p_description: description.substring(0, 50),
            p_action_href: rule.link_path,
            p_context_data: evaluation.context,
          }))
        }
        result.triggered++
      } else {
        // Resolve any existing alert for this rule
        await supabase.rpc('resolve_household_alert', {
          p_household_id: householdId,
          p_rule_id: rule.id,
        })
        result.resolved++
      }
    } catch (e) {
      result.errors.push(`Rule ${rule.rule_name}: ${e}`)
    }
  }

  return result
}

// ─── Rule evaluator ───────────────────────────────────────────────────────────

interface HouseholdData {
  household: Record<string, unknown>
  assets: Record<string, unknown>[]
  estateDocs: Record<string, unknown>[]
  beneficiaries: Record<string, unknown>[]
  domicile: Record<string, unknown> | null
}

interface RuleResult {
  triggered: boolean
  context: Record<string, unknown>
}

function evaluateRule(rule: AlertRule, data: HouseholdData): RuleResult {
  const condition = rule.trigger_condition
  const operator = condition.operator as string

  switch (operator) {
    case 'before_year':
      return evalBeforeYear(condition, data)
    case 'years_ago_gt':
      return evalYearsAgoGt(condition, data)
    case 'days_ago_lt':
      return evalDaysAgoLt(condition, data)
    case 'changed_since_doc_date':
      return evalDomicileDocMismatch(condition, data)
    case 'requires_beneficiary_missing':
      return evalMissingBeneficiary(condition, data)
    case 'sum_not_100':
      return evalAllocationNot100(condition, data)
    case 'ira_trust_no_conduit':
      return evalIraTrustNoConduit(condition, data)
    case 'minor_no_custodian':
      return evalMinorNoCustodian(condition, data)
    case 'pod_tod_contradicts_will':
      return evalPodTodConflict(condition, data)
    default:
      return { triggered: false, context: {} }
  }
}

// ─── Individual rule evaluators ───────────────────────────────────────────────

// Rule 1: Document drafted before a given year
function evalBeforeYear(
  condition: Record<string, unknown>,
  data: HouseholdData,
): RuleResult {
  const docTypes = (condition.doc_types as string[]) ?? []
  const beforeYear = condition.value as number

  const matchingDocs = data.estateDocs.filter(doc => {
    if (!docTypes.includes(doc.doc_type as string)) return false
    if (!doc.document_date) return false
    const docYear = new Date(doc.document_date as string).getFullYear()
    return docYear < beforeYear
  })

  if (matchingDocs.length === 0) return { triggered: false, context: {} }

  const doc = matchingDocs[0]
  return {
    triggered: true,
    context: {
      doc_type: doc.doc_type,
      document_date: doc.document_date,
      doc_id: doc.id,
    },
  }
}

// Rule 2: Document not reviewed in N years
function evalYearsAgoGt(
  condition: Record<string, unknown>,
  data: HouseholdData,
): RuleResult {
  const field = condition.field as string
  const yearsThreshold = condition.value as number
  const docTypes = (condition.doc_types as string[] | undefined)

  const now = new Date()

  // Trust review check
  if (field === 'estate_documents.last_reviewed' && docTypes) {
    const matchingDocs = data.estateDocs.filter(doc => {
      if (!docTypes.includes(doc.doc_type as string)) return false
      if (!doc.last_reviewed) return true // never reviewed = always triggers
      const reviewDate = new Date(doc.last_reviewed as string)
      const yearsAgo = (now.getTime() - reviewDate.getTime()) / (1000 * 60 * 60 * 24 * 365)
      return yearsAgo > yearsThreshold
    })

    if (matchingDocs.length === 0) return { triggered: false, context: {} }

    const doc = matchingDocs[0]
    const yearsAgo = doc.last_reviewed
      ? Math.floor((now.getTime() - new Date(doc.last_reviewed as string).getTime()) / (1000 * 60 * 60 * 24 * 365))
      : null

    return {
      triggered: true,
      context: {
        doc_type: doc.doc_type,
        last_reviewed: doc.last_reviewed,
        years_since_review: yearsAgo ?? 'never',
        doc_id: doc.id,
      },
    }
  }

  // POA document age check
  if (field === 'estate_documents.document_date' && docTypes) {
    const matchingDocs = data.estateDocs.filter(doc => {
      if (!docTypes.includes(doc.doc_type as string)) return false
      if (!doc.document_date) return false
      const docDate = new Date(doc.document_date as string)
      const yearsAgo = (now.getTime() - docDate.getTime()) / (1000 * 60 * 60 * 24 * 365)
      return yearsAgo > yearsThreshold
    })

    if (matchingDocs.length === 0) return { triggered: false, context: {} }

    const doc = matchingDocs[0]
    const yearsAgo = Math.floor(
      (now.getTime() - new Date(doc.document_date as string).getTime()) / (1000 * 60 * 60 * 24 * 365)
    )

    return {
      triggered: true,
      context: {
        doc_type: doc.doc_type,
        document_date: doc.document_date,
        years_since_execution: yearsAgo,
        doc_id: doc.id,
      },
    }
  }

  // Beneficiary review check
  if (field === 'household.last_beneficiary_review') {
    const lastReview = data.household.last_beneficiary_review as string | null
    if (!lastReview) return { triggered: true, context: { last_review: null } }
    const yearsAgo = (now.getTime() - new Date(lastReview).getTime()) / (1000 * 60 * 60 * 24 * 365)
    if (yearsAgo <= yearsThreshold) return { triggered: false, context: {} }
    return {
      triggered: true,
      context: { last_review: lastReview, years_ago: Math.floor(yearsAgo) },
    }
  }

  return { triggered: false, context: {} }
}

// Rule 4: Asset added recently not in trust
function evalDaysAgoLt(
  condition: Record<string, unknown>,
  data: HouseholdData,
): RuleResult {
  const daysThreshold = condition.value as number
  const now = new Date()

  const recentUntitledAssets = data.assets.filter(asset => {
    const createdAt = new Date(asset.created_at as string)
    const daysAgo = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24)
    if (daysAgo >= daysThreshold) return false
    // Not trust-owned
    return asset.titling !== 'trust_owned'
  })

  if (recentUntitledAssets.length === 0) return { triggered: false, context: {} }

  const asset = recentUntitledAssets[0]
  return {
    triggered: true,
    context: {
      asset_name: asset.name,
      asset_id: asset.id,
      asset_type: asset.type,
      created_at: asset.created_at,
    },
  }
}

// Rule 3: Domicile changed since doc date
function evalDomicileDocMismatch(
  condition: Record<string, unknown>,
  data: HouseholdData,
): RuleResult {
  if (!data.domicile) return { triggered: false, context: {} }

  const docTypes = (condition.doc_types as string[]) ?? []
  const currentState = data.domicile.claimed_domicile_state as string | null
  if (!currentState) return { triggered: false, context: {} }

  const householdState = data.household.state_primary as string | null

  // If domicile state differs from household primary state, check docs
  if (currentState === householdState) return { triggered: false, context: {} }

  const matchingDocs = data.estateDocs.filter(doc =>
    docTypes.includes(doc.doc_type as string) && doc.status !== 'none'
  )

  if (matchingDocs.length === 0) return { triggered: false, context: {} }

  return {
    triggered: true,
    context: {
      current_state: currentState,
      household_state: householdState,
      doc_types: docTypes,
    },
  }
}

// Conflict rule: IRA names trust without conduit
function evalIraTrustNoConduit(
  _condition: Record<string, unknown>,
  data: HouseholdData,
): RuleResult {
  const iraBenes = data.beneficiaries.filter(b => {
    const asset = data.assets.find(a => a.id === b.asset_id)
    return asset && ['ira', 'roth_ira', '401k', '403b'].includes(asset.type as string)
      && (b.full_name as string)?.toLowerCase().includes('trust')
  })

  if (iraBenes.length === 0) return { triggered: false, context: {} }

  return {
    triggered: true,
    context: { affected_accounts: iraBenes.map(b => b.asset_id) },
  }
}

// Conflict rule: Minor as direct beneficiary
function evalMinorNoCustodian(
  _condition: Record<string, unknown>,
  data: HouseholdData,
): RuleResult {
  const minorBenes = data.beneficiaries.filter(b => {
    const hasDistributionAge = b.distribution_age && (b.distribution_age as number) < 18
    const nameHasMinor = (b.full_name as string)?.toLowerCase().includes('minor')
    return hasDistributionAge || nameHasMinor
  })

  if (minorBenes.length === 0) return { triggered: false, context: {} }

  return {
    triggered: true,
    context: { minor_beneficiaries: minorBenes.map(b => b.full_name) },
  }
}

// Conflict rule: Missing beneficiary designation
function evalMissingBeneficiary(
  _condition: Record<string, unknown>,
  data: HouseholdData,
): RuleResult {
  const requiresBene = ['ira', 'roth_ira', '401k', '403b', 'life_insurance']
  const assetsMissingBene = data.assets.filter(asset => {
    if (!requiresBene.includes(asset.type as string)) return false
    const hasBene = data.beneficiaries.some(b => b.asset_id === asset.id)
    return !hasBene
  })

  if (assetsMissingBene.length === 0) return { triggered: false, context: {} }

  return {
    triggered: true,
    context: { missing_accounts: assetsMissingBene.map(a => ({ id: a.id, name: a.name })) },
  }
}

// Conflict rule: Allocation not 100%
function evalAllocationNot100(
  _condition: Record<string, unknown>,
  data: HouseholdData,
): RuleResult {
  // Group beneficiaries by asset
  const byAsset = new Map<string, number>()
  for (const b of data.beneficiaries) {
    const assetId = b.asset_id as string
    if (!assetId) continue
    byAsset.set(assetId, (byAsset.get(assetId) ?? 0) + (b.allocation_pct as number))
  }

  const offAssets: string[] = []
  for (const [assetId, total] of byAsset) {
    if (Math.abs(total - 100) > 0.5) offAssets.push(assetId)
  }

  if (offAssets.length === 0) return { triggered: false, context: {} }

  return {
    triggered: true,
    context: { off_assets: offAssets },
  }
}

// Conflict rule: POD/TOD contradicts will
function evalPodTodConflict(
  _condition: Record<string, unknown>,
  data: HouseholdData,
): RuleResult {
  const podTodAssets = data.assets.filter(a =>
    a.titling === 'pod' || a.titling === 'tod'
  )

  const hasWill = data.estateDocs.some(
    d => d.doc_type === 'will' && d.status !== 'none'
  )

  if (podTodAssets.length === 0 || !hasWill) return { triggered: false, context: {} }

  return {
    triggered: true,
    context: { pod_tod_assets: podTodAssets.map(a => ({ id: a.id, name: a.name })) },
  }
}

// ─── Template filler ──────────────────────────────────────────────────────────

function fillTemplate(
  template: string,
  context: Record<string, unknown>,
): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    const val = context[key]
    return val !== undefined && val !== null ? String(val) : `{${key}}`
  })
}

// ─── Load active alerts for a household ──────────────────────────────────────

export async function loadHouseholdAlerts(
  householdId: string,
): Promise<HouseholdAlert[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('household_alerts')
    .select('*')
    .eq('household_id', householdId)
    .is('resolved_at', null)
    .is('dismissed_at', null)
    .order('severity', { ascending: false })
    .order('created_at', { ascending: false })

  if (error || !data) return []
  return data as HouseholdAlert[]
}

// ─── Dismiss an alert (consumer action, info only) ────────────────────────────

export async function dismissAlert(
  alertId: string,
  userId: string,
): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase.rpc('dismiss_household_alert', {
    p_alert_id: alertId,
    p_user_id: userId,
  })
  return !error
}

// ─── Mark alert as reviewed (advisor action) ──────────────────────────────────

export async function markAlertReviewed(alertId: string): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase
    .from('household_alerts')
    .update({ is_reviewed: true, updated_at: new Date().toISOString() })
    .eq('id', alertId)
  return !error
}
