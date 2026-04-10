// lib/estate-flow/generateEstateFlow.ts
// Sprint 60 — Estate Flow Visualizer engine
// Produces a structured node/edge graph consumed by the diagram renderer.
// Reads from: assets, real_estate, digital_assets, trusts,
//             (insurance skipped — no client table in env),
//             business_interests, asset_beneficiaries, estate_documents,
//             households, projection_scenarios, household_people

import { createClient } from '@/lib/supabase/client'

// ─── Node types ──────────────────────────────────────────────────────────────

export type NodeType =
  | 'person'         // the estate owner(s)
  | 'asset'          // financial asset
  | 'real_estate'    // real property
  | 'digital_asset'  // crypto, online accounts, etc.
  | 'business'       // business interest
  | 'insurance'      // life insurance policy
  | 'trust'          // any trust vehicle
  | 'probate'        // estate / probate box
  | 'beneficiary'    // named beneficiary
  | 'tax_deduction'  // federal / state estate tax
  | 'digital_executor' // digital executor designation

export type NodeCategory = 'owner' | 'asset' | 'vehicle' | 'recipient' | 'tax'

export interface FlowNode {
  id: string
  type: NodeType
  category: NodeCategory
  label: string            // plain-English label for consumer view
  technicalLabel: string   // full label for advisor view
  value: number            // dollar value (0 if unknown)
  metadata: Record<string, unknown>
}

// ─── Edge types ───────────────────────────────────────────────────────────────

export type EdgeType =
  | 'owns'           // person → asset
  | 'transfers_to'   // asset → trust or estate at death
  | 'distributes_to' // trust → beneficiary
  | 'probate_to'     // probate → beneficiary via will
  | 'tax_deducted'   // estate → tax deduction node
  | 'bypasses'       // asset → beneficiary directly (POD/TOD/beneficiary designation)

export interface FlowEdge {
  id: string
  source: string      // node id
  target: string      // node id
  type: EdgeType
  label: string       // transfer amount or description
  value: number       // dollar amount (0 if not applicable)
  metadata: Record<string, unknown>
}

// ─── Full graph ───────────────────────────────────────────────────────────────

export type DeathView = 'first_death' | 'second_death'

export interface EstateFlowGraph {
  household_id: string
  scenario_id: string | null
  death_view: DeathView
  generated_at: string
  nodes: FlowNode[]
  edges: FlowEdge[]
  summary: {
    gross_estate: number
    estate_tax_federal: number
    estate_tax_state: number
    net_to_heirs: number
    has_trust: boolean
    has_business: boolean
    has_digital_assets: boolean
    has_insurance: boolean
    probate_assets_value: number  // assets that would go through probate
    trust_assets_value: number    // assets that bypass probate via trust
    direct_transfer_value: number // assets with beneficiary designations
  }
}

// ─── Raw data shapes from Supabase ───────────────────────────────────────────

interface RawAsset {
  id: string
  name: string
  type: string
  value: number
  titling: string | null
  liquidity: string | null
  owner: string
  details: Record<string, unknown> | null
}

interface RawRealEstate {
  id: string
  name: string
  current_value: number
  titling_type?: string | null
  state?: string | null
}

interface RawDigitalAsset {
  id: string
  name: string
  asset_type: string
  estimated_value: number | null
}

interface RawTrust {
  id: string
  name: string
  trust_type: string
  estimated_value?: number | null
}

interface RawInsurance {
  id: string
  policy_type?: string
  description?: string
  face_value?: number
  death_benefit?: number
  owner?: string
}

interface RawBusiness {
  id: string
  name?: string
  entity_type?: string
  estimated_value?: number
}

interface RawBeneficiary {
  id: string
  asset_id: string | null
  real_estate_id: string | null
  beneficiary_type: string
  full_name: string
  relationship: string | null
  email: string | null
  phone: string | null
  allocation_pct: number
  distribution_age: number | null
  incentive_conditions: string | null
}

interface RawHouseholdPerson {
  id: string
  full_name: string
  relationship: string
  date_of_birth: string | null
  is_gst_skip: boolean
  is_beneficiary: boolean
  notes: string | null
}

interface RawEstateDocs {
  doc_type: string
  status: string
}

interface RawHousehold {
  id: string
  owner_id: string
  person1_name: string | null
  person2_name: string | null
  has_spouse: boolean | null
  filing_status: string | null
  state_primary: string | null
}

// ─── Main generator ───────────────────────────────────────────────────────────

export async function generateEstateFlow(
  householdId: string,
  scenarioId: string | null,
  deathView: DeathView = 'first_death',
  supabase?: ReturnType<typeof createClient>,
  hasCSTStrategy = false,
): Promise<EstateFlowGraph> {
  if (!supabase) {
    supabase = createClient()
  }

  const householdRes = await supabase.from('households').select('*').eq('id', householdId).single()

  if (!householdRes.data) {
    throw new Error(`Household ${householdId} not found`)
  }

  const household = householdRes.data as RawHousehold | null
  if (!household) throw new Error(`Household ${householdId} not found`)

  const userId = household.owner_id

  const scenarioMetaPromise = scenarioId
    ? supabase
        .from('projection_scenarios')
        .select('id, label, status, calculated_at, outputs, outputs_s1_first')
        .eq('id', scenarioId)
        .single()
    : Promise.resolve({ data: null, error: null })

  const scenarioS2Promise = scenarioId
    ? supabase.rpc('get_scenario_s2_outputs', { p_scenario_id: scenarioId })
    : Promise.resolve({ data: null, error: null })

  // Fetch remaining data in parallel
  const [
    assetsRes,
    realEstateRes,
    digitalAssetsRes,
    trustsRes,
    insuranceRes,
    businessRes,
    beneficiariesRes,
    householdPeopleRes,
    estateDocsRes,
    scenarioMetaRes,
    scenarioS2Res,
  ] = await Promise.all([
    supabase.from('assets').select('*').eq('owner_id', userId),
    supabase.from('real_estate').select('*').eq('owner_id', userId),
    supabase.from('digital_assets').select('*').eq('household_id', householdId),
    supabase.from('trusts').select('*').eq('owner_id', userId),
    // insurance_policies table not present — skip
    Promise.resolve({ data: [], error: null }),
    supabase.from('business_interests').select('*').eq('owner_id', userId),
    supabase.from('asset_beneficiaries').select('*').eq('owner_id', userId),
    supabase
      .from('household_people')
      .select('id, full_name, relationship, date_of_birth, is_gst_skip, is_beneficiary, notes')
      .eq('household_id', householdId)
      .eq('is_beneficiary', true),
    supabase.from('estate_documents').select('doc_type,status').eq('household_id', householdId),
    scenarioMetaPromise,
    scenarioS2Promise,
  ])

  console.log('households error:', householdRes.error)
  console.log('assets error:', assetsRes.error)
  console.log('real_estate error:', realEstateRes.error)
  console.log('digital_assets error:', digitalAssetsRes.error)
  console.log('trusts error:', trustsRes.error)
  console.log('business_interests error:', businessRes.error)
  console.log('asset_beneficiaries error:', beneficiariesRes.error)
  console.log('household_people error:', householdPeopleRes.error)
  console.log('estate_documents error:', estateDocsRes.error)
  console.log('scenario meta error:', scenarioMetaRes.error)
  console.log('scenario s2 error:', scenarioS2Res.error)
  console.log('scenario meta data:', scenarioMetaRes.data)

  const assets = (assetsRes.data ?? []) as RawAsset[]
  const realEstate = (realEstateRes.data ?? []) as RawRealEstate[]
  const digitalAssets = (digitalAssetsRes.data ?? []) as RawDigitalAsset[]
  const trusts = (trustsRes.data ?? []) as RawTrust[]
  const insurance = (insuranceRes.data ?? []) as RawInsurance[]
  const businesses = (businessRes.data ?? []) as RawBusiness[]
  const beneficiaries = (beneficiariesRes.data ?? []) as RawBeneficiary[]
  const householdPeople = (householdPeopleRes.data ?? []) as RawHouseholdPerson[]
  const estateDocs = (estateDocsRes.data ?? []) as RawEstateDocs[]
  const scenario = scenarioMetaRes.data
    ? {
        ...scenarioMetaRes.data,
        outputs_s2_first: scenarioS2Res.data ?? null,
      }
    : null
  console.log('scenario keys:', Object.keys(scenario ?? {}))
  console.log('s2_first length:', scenario?.outputs_s2_first?.length)
  console.log('s2 via RPC length:', Array.isArray(scenarioS2Res.data) ? scenarioS2Res.data.length : 'not array')

  // Pull tax amounts from scenario
  const rawOutputs = deathView === 'second_death'
    ? (scenario?.outputs_s2_first ?? scenario?.outputs_s1_first ?? scenario?.outputs ?? [])
    : (scenario?.outputs_s1_first ?? scenario?.outputs ?? [])
  const outputs = Array.isArray(rawOutputs) ? rawOutputs : []

  console.log('deathView:', deathView, 'rawOutputs length:', rawOutputs?.length)
  const lastOutput = outputs.length > 0 ? outputs[outputs.length - 1] : null

  console.log('EstateFlow scenario:', scenario?.id, 'outputs length:', outputs.length, 'lastOutput:', lastOutput)

  const estateTaxFederal = Number(lastOutput?.estate_tax_federal ?? 0)
  const estateTaxState = Number(lastOutput?.estate_tax_state ?? 0)
  const netToHeirs = Number(lastOutput?.net_to_heirs ?? 0)
  const grossEstate = Number(lastOutput?.estate_incl_home ?? 0)

  // Determine which documents exist
  const hasTrust = trusts.length > 0 ||
    estateDocs.some(d => ['revocable_trust', 'irrevocable_trust'].includes(d.doc_type) && d.status !== 'none')
  const hasWill = estateDocs.some(d => d.doc_type === 'will' && d.status !== 'none')
  const hasInsurance = insurance.length > 0
  const hasBusiness = businesses.length > 0
  const hasDigital = digitalAssets.length > 0

  // Build beneficiary lookup by asset/real_estate id
  const beneByAsset = new Map<string, RawBeneficiary[]>()
  const beneByRealEstate = new Map<string, RawBeneficiary[]>()
  for (const b of beneficiaries) {
    if (b.asset_id) {
      const arr = beneByAsset.get(b.asset_id) ?? []
      arr.push(b)
      beneByAsset.set(b.asset_id, arr)
    }
    if (b.real_estate_id) {
      const arr = beneByRealEstate.get(b.real_estate_id) ?? []
      arr.push(b)
      beneByRealEstate.set(b.real_estate_id, arr)
    }
  }

  const nodes: FlowNode[] = []
  const edges: FlowEdge[] = []
  let bypassTrustNodeId: string | null = null

  // Unique beneficiary node registry (to avoid duplicates)
  const beneNodeMap = new Map<string, string>() // name → node id

  function getOrCreateBeneNode(bene: RawBeneficiary): string {
    const key = bene.full_name.toLowerCase().trim()
    if (beneNodeMap.has(key)) return beneNodeMap.get(key)!
    const nodeId = `bene_${beneNodeMap.size}`
    nodes.push({
      id: nodeId,
      type: 'beneficiary',
      category: 'recipient',
      label: bene.full_name,
      technicalLabel: `${bene.full_name}${bene.relationship ? ` (${bene.relationship})` : ''}`,
      value: 0,
      metadata: { relationship: bene.relationship, beneficiary_type: bene.beneficiary_type },
    })
    beneNodeMap.set(key, nodeId)
    return nodeId
  }

  // ── 1. Owner node(s) ────────────────────────────────────────────────────────
  const person1Name = household.person1_name ?? 'Person 1'
  const person2Name = household.person2_name ?? 'Spouse'

  // For first_death: person1 is the deceased, person2 is surviving spouse
  // For second_death: person2 is the deceased, person1 is the surviving spouse
  const deceasedName = deathView === 'first_death' ? person1Name : person2Name
  const survivorName = deathView === 'first_death' ? person2Name : person1Name

  nodes.push({
    id: 'owner_p1',
    type: 'person',
    category: 'owner',
    label: deceasedName,
    technicalLabel: `${deceasedName} (Deceased)`,
    value: grossEstate,
    metadata: { death_view: deathView, role: 'deceased' },
  })

  const hasSpouse = Boolean(household.has_spouse)
  if (hasSpouse) {
    nodes.push({
      id: 'owner_p2',
      type: 'person',
      category: 'owner',
      label: survivorName,
      technicalLabel: `${survivorName} (Surviving Spouse)`,
      value: 0,
      metadata: { role: 'surviving_spouse' },
    })
  }

  if (bypassTrustNodeId) {
    const cstFundingAmount = grossEstate * 0.5
    const spouseRemainder = Math.max(0, grossEstate - cstFundingAmount)

    const bypassNode = nodes.find((n) => n.id === bypassTrustNodeId)
    if (bypassNode) bypassNode.value = cstFundingAmount

    edges.push({
      id: 'e_cst_funding',
      source: 'owner_p1',
      target: bypassTrustNodeId,
      type: 'transfers_to',
      label: `${fmt(cstFundingAmount)} (up to exemption)`,
      value: cstFundingAmount,
      metadata: { strategy: 'credit_shelter_trust' },
    })

    if (hasSpouse) {
      edges.push({
        id: 'e_cst_spouse_remainder',
        source: 'owner_p1',
        target: 'owner_p2',
        type: 'transfers_to',
        label: `${fmt(spouseRemainder)} to surviving spouse`,
        value: spouseRemainder,
        metadata: { strategy: 'credit_shelter_trust' },
      })
    }
  }

  // ── 2. Trust nodes ───────────────────────────────────────────────────────────
  const trustNodeIds: string[] = []
  for (const t of trusts) {
    const nodeId = `trust_${t.id}`
    trustNodeIds.push(nodeId)
    nodes.push({
      id: nodeId,
      type: 'trust',
      category: 'vehicle',
      label: t.name ?? 'Revocable Trust',
      technicalLabel: `${t.name ?? 'Trust'} (${t.trust_type ?? 'Revocable'})`,
      value: t.estimated_value ?? 0,
      metadata: { trust_type: t.trust_type },
    })
  }

  // ── 3. Probate/estate node (if will exists or no trust) ─────────────────────
  let probateNodeId: string | null = null
  if (hasWill || !hasTrust) {
    probateNodeId = 'probate_estate'
    nodes.push({
      id: probateNodeId,
      type: 'probate',
      category: 'vehicle',
      label: 'Your estate (probate)',
      technicalLabel: 'Probate Estate',
      value: 0,
      metadata: { has_will: hasWill },
    })
  }

  if (hasCSTStrategy) {
    bypassTrustNodeId = 'trust_bypass'
    nodes.push({
      id: bypassTrustNodeId,
      type: 'trust',
      category: 'vehicle',
      label: 'Bypass Trust',
      technicalLabel: 'Credit Shelter Trust (Bypass Trust)',
      value: 0,
      metadata: { strategy: 'credit_shelter_trust' },
    })
  }

  // ── 4. Tax deduction nodes ───────────────────────────────────────────────────
  if (estateTaxFederal > 0) {
    nodes.push({
      id: 'tax_federal',
      type: 'tax_deduction',
      category: 'tax',
      label: `Federal estate tax: ${fmt(estateTaxFederal)}`,
      technicalLabel: `Federal Estate Tax: ${fmt(estateTaxFederal)}`,
      value: estateTaxFederal,
      metadata: { tax_type: 'federal' },
    })
  }
  if (estateTaxState > 0) {
    nodes.push({
      id: 'tax_state',
      type: 'tax_deduction',
      category: 'tax',
      label: `State estate tax: ${fmt(estateTaxState)}`,
      technicalLabel: `State Estate Tax (${household.state_primary ?? ''}): ${fmt(estateTaxState)}`,
      value: estateTaxState,
      metadata: { tax_type: 'state', state: household.state_primary },
    })
  }

  // ── 5. Financial assets ──────────────────────────────────────────────────────
  let probateAssetsValue = 0
  let trustAssetsValue = 0
  let directTransferValue = 0

  for (const asset of assets) {
    const nodeId = `asset_${asset.id}`
    const assetBenes = beneByAsset.get(asset.id) ?? []
    const hasBene = assetBenes.length > 0
    const isTrustOwned = asset.titling === 'trust_owned'
    const isPOD = asset.titling === 'pod' || asset.titling === 'tod'

    nodes.push({
      id: nodeId,
      type: 'asset',
      category: 'asset',
      label: friendlyAssetLabel(asset.name, asset.type),
      technicalLabel: `${asset.name} (${asset.type}) — ${fmt(asset.value)}`,
      value: asset.value,
      metadata: {
        asset_type: asset.type,
        titling: asset.titling,
        liquidity: asset.liquidity,
        owner: asset.owner,
      },
    })

    // Edge: owner → asset
    edges.push({
      id: `e_own_${asset.id}`,
      source: 'owner_p1',
      target: nodeId,
      type: 'owns',
      label: fmt(asset.value),
      value: asset.value,
      metadata: {},
    })

    // Edge: asset → destination at death
    if (isTrustOwned && trustNodeIds.length > 0) {
      // Goes to trust
      edges.push({
        id: `e_trust_${asset.id}`,
        source: nodeId,
        target: trustNodeIds[0],
        type: 'transfers_to',
        label: fmt(asset.value),
        value: asset.value,
        metadata: { reason: 'trust owned' },
      })
      trustAssetsValue += asset.value
    } else if (isPOD || hasBene) {
      // Direct beneficiary designation — bypasses probate
      for (const bene of assetBenes) {
        const beneNodeId = getOrCreateBeneNode(bene)
        const transferAmt = Math.round((asset.value * bene.allocation_pct) / 100)
        edges.push({
          id: `e_bene_${asset.id}_${bene.id}`,
          source: nodeId,
          target: beneNodeId,
          type: 'bypasses',
          label: `${bene.allocation_pct}% — ${fmt(transferAmt)}`,
          value: transferAmt,
          metadata: { allocation_pct: bene.allocation_pct },
        })
      }
      directTransferValue += asset.value
    } else if (probateNodeId) {
      // Goes through probate
      edges.push({
        id: `e_prob_${asset.id}`,
        source: nodeId,
        target: probateNodeId,
        type: 'transfers_to',
        label: fmt(asset.value),
        value: asset.value,
        metadata: { reason: 'no trust or beneficiary designation' },
      })
      probateAssetsValue += asset.value
    }
  }

  // ── 6. Real estate ───────────────────────────────────────────────────────────
  for (const re of realEstate) {
    const nodeId = `re_${re.id}`
    const reBenes = beneByRealEstate.get(re.id) ?? []
    const hasBene = reBenes.length > 0
    const isTrustOwned = re.titling_type === 'trust_owned'

    nodes.push({
      id: nodeId,
      type: 'real_estate',
      category: 'asset',
      label: shortAddress(re.name),
      technicalLabel: `${re.name} — ${fmt(re.current_value)}`,
      value: re.current_value,
      metadata: { name: re.name, titling_type: re.titling_type, state: re.state },
    })

    edges.push({
      id: `e_own_re_${re.id}`,
      source: 'owner_p1',
      target: nodeId,
      type: 'owns',
      label: fmt(re.current_value),
      value: re.current_value,
      metadata: {},
    })

    if (isTrustOwned && trustNodeIds.length > 0) {
      edges.push({
        id: `e_trust_re_${re.id}`,
        source: nodeId,
        target: trustNodeIds[0],
        type: 'transfers_to',
        label: fmt(re.current_value),
        value: re.current_value,
        metadata: {},
      })
      trustAssetsValue += re.current_value
    } else if (hasBene) {
      for (const bene of reBenes) {
        const beneNodeId = getOrCreateBeneNode(bene)
        const transferAmt = Math.round((re.current_value * bene.allocation_pct) / 100)
        edges.push({
          id: `e_bene_re_${re.id}_${bene.id}`,
          source: nodeId,
          target: beneNodeId,
          type: 'bypasses',
          label: `${bene.allocation_pct}% — ${fmt(transferAmt)}`,
          value: transferAmt,
          metadata: {},
        })
      }
      directTransferValue += re.current_value
    } else if (probateNodeId) {
      edges.push({
        id: `e_prob_re_${re.id}`,
        source: nodeId,
        target: probateNodeId,
        type: 'transfers_to',
        label: fmt(re.current_value),
        value: re.current_value,
        metadata: {},
      })
      probateAssetsValue += re.current_value
    }
  }

  // ── 7. Digital assets ─────────────────────────────────────────────────────
  if (digitalAssets.length > 0) {
    const totalDigital = digitalAssets.reduce((s, d) => s + (d.estimated_value ?? 0), 0)
    const digitalNodeId = 'digital_assets_group'
    nodes.push({
      id: digitalNodeId,
      type: 'digital_asset',
      category: 'asset',
      label: `Digital assets (${digitalAssets.length})`,
      technicalLabel: `Digital Assets — ${fmt(totalDigital)}`,
      value: totalDigital,
      metadata: { count: digitalAssets.length, items: digitalAssets.map(d => d.name) },
    })

    edges.push({
      id: 'e_own_digital',
      source: 'owner_p1',
      target: digitalNodeId,
      type: 'owns',
      label: fmt(totalDigital),
      value: totalDigital,
      metadata: {},
    })

    // Digital assets go through probate unless a digital executor is designated
    if (probateNodeId) {
      edges.push({
        id: 'e_prob_digital',
        source: digitalNodeId,
        target: probateNodeId,
        type: 'transfers_to',
        label: fmt(totalDigital),
        value: totalDigital,
        metadata: {},
      })
      probateAssetsValue += totalDigital
    }
  }

  // ── 8. Insurance policies ─────────────────────────────────────────────────
  for (const pol of insurance) {
    const nodeId = `ins_${pol.id}`
    const benefit = pol.death_benefit ?? pol.face_value ?? 0
    nodes.push({
      id: nodeId,
      type: 'insurance',
      category: 'asset',
      label: `Life insurance — ${fmt(benefit)} death benefit`,
      technicalLabel: `${pol.description ?? 'Life Insurance Policy'} (${pol.policy_type ?? ''}) — ${fmt(benefit)} death benefit`,
      value: benefit,
      metadata: { policy_type: pol.policy_type, owner: pol.owner },
    })

    edges.push({
      id: `e_own_ins_${pol.id}`,
      source: 'owner_p1',
      target: nodeId,
      type: 'owns',
      label: fmt(benefit),
      value: benefit,
      metadata: {},
    })

    // Insurance typically bypasses probate — goes to named bene or estate
    if (probateNodeId) {
      edges.push({
        id: `e_prob_ins_${pol.id}`,
        source: nodeId,
        target: probateNodeId,
        type: 'transfers_to',
        label: `Death benefit: ${fmt(benefit)}`,
        value: benefit,
        metadata: { note: 'if no named beneficiary' },
      })
    }
  }

  // ── 9. Business interests ─────────────────────────────────────────────────
  for (const biz of businesses) {
    const nodeId = `biz_${biz.id}`
    const val = biz.estimated_value ?? 0
    nodes.push({
      id: nodeId,
      type: 'business',
      category: 'asset',
      label: biz.name ?? 'Business interest',
      technicalLabel: `${biz.name ?? 'Business'} (${biz.entity_type ?? ''}) — ${fmt(val)}`,
      value: val,
      metadata: { entity_type: biz.entity_type },
    })

    edges.push({
      id: `e_own_biz_${biz.id}`,
      source: 'owner_p1',
      target: nodeId,
      type: 'owns',
      label: fmt(val),
      value: val,
      metadata: {},
    })

    // Business interests typically flow to trust or probate
    if (trustNodeIds.length > 0) {
      edges.push({
        id: `e_trust_biz_${biz.id}`,
        source: nodeId,
        target: trustNodeIds[0],
        type: 'transfers_to',
        label: fmt(val),
        value: val,
        metadata: {},
      })
    } else if (probateNodeId) {
      edges.push({
        id: `e_prob_biz_${biz.id}`,
        source: nodeId,
        target: probateNodeId,
        type: 'transfers_to',
        label: fmt(val),
        value: val,
        metadata: {},
      })
      probateAssetsValue += val
    }
  }

  // ── 10. Trust → beneficiary distribution edges ────────────────────────────
  // Pull unique beneficiaries from all asset_beneficiaries (trust distributions)
  const trustBenes = beneficiaries.filter(b => b.beneficiary_type === 'primary' || b.beneficiary_type === 'contingent')
  const seenTrustBene = new Set<string>()

  for (const bene of trustBenes) {
    const key = bene.full_name.toLowerCase().trim()
    if (seenTrustBene.has(key)) continue
    seenTrustBene.add(key)

    if (trustNodeIds.length > 0) {
      const beneNodeId = getOrCreateBeneNode(bene)
      edges.push({
        id: `e_trust_dist_${bene.id}`,
        source: trustNodeIds[0],
        target: beneNodeId,
        type: 'distributes_to',
        label: `${bene.allocation_pct}% per trust terms`,
        value: Math.round((trustAssetsValue * bene.allocation_pct) / 100),
        metadata: { distribution_age: bene.distribution_age, conditions: bene.incentive_conditions },
      })
    }

    if (bypassTrustNodeId) {
      const beneNodeId = getOrCreateBeneNode(bene)
      edges.push({
        id: `e_cst_dist_${bene.id}`,
        source: bypassTrustNodeId,
        target: beneNodeId,
        type: 'distributes_to',
        label: `${bene.allocation_pct}% per CST terms`,
        value: Math.round((grossEstate * 0.5 * bene.allocation_pct) / 100),
        metadata: { strategy: 'credit_shelter_trust' },
      })
    }
  }

  // ── 10a. Household people → beneficiary nodes
  for (const person of householdPeople) {
    const key = person.full_name.toLowerCase().trim()
    const isOwner =
      key === (household.person1_name ?? '').toLowerCase().trim() ||
      key === (household.person2_name ?? '').toLowerCase().trim()
    if (isOwner) continue
    if (beneNodeMap.has(key)) {
      const existingNodeId = beneNodeMap.get(key)!
      const existingNode = nodes.find(n => n.id === existingNodeId)
      if (existingNode && person.is_gst_skip) {
        existingNode.metadata = { ...existingNode.metadata, is_gst_skip: true }
      }
      continue
    }
    const nodeId = `person_${person.id}`
    nodes.push({
      id: nodeId,
      type: 'beneficiary',
      category: 'recipient',
      label: person.full_name,
      technicalLabel: `${person.full_name} (${person.relationship}${person.is_gst_skip ? ' — GST Skip' : ''})`,
      value: 0,
      metadata: {
        relationship: person.relationship,
        is_gst_skip: person.is_gst_skip,
        date_of_birth: person.date_of_birth,
        source: 'household_people',
      },
    })
    beneNodeMap.set(key, nodeId)
  }

  // ── 10b. Post-process beneficiaries: death sequence ───────────────────────
  // Relabel surviving spouse beneficiary based on death sequence.
  // When person1 dies first: person2 is survivor — she/he appears as recipient.
  // When person2 dies first: person1 is survivor — he/she appears as recipient.
  // Remove the deceased person from the beneficiary recipient layer.
  const deceasedNameNormalized = deceasedName.toLowerCase().trim()
  const survivorNameNormalized = survivorName.toLowerCase().trim()

  const deceasedBeneNodeIds = new Set<string>()
  for (const [name, nodeId] of [...beneNodeMap.entries()]) {
    if (name === deceasedNameNormalized) {
      deceasedBeneNodeIds.add(nodeId)
      beneNodeMap.delete(name)
    }
  }
  for (const nodeId of deceasedBeneNodeIds) {
    const idx = nodes.findIndex(n => n.id === nodeId)
    if (idx !== -1) nodes.splice(idx, 1)
  }
  for (let i = edges.length - 1; i >= 0; i--) {
    if (deceasedBeneNodeIds.has(edges[i].target)) edges.splice(i, 1)
  }

  if (hasSpouse) {
    const spousePlaceholderKeys = new Set(['spouse', 'surviving spouse'])
    for (const [key, nodeId] of [...beneNodeMap.entries()]) {
      const shouldRelabel = key === survivorNameNormalized || spousePlaceholderKeys.has(key)
      if (!shouldRelabel) continue
      const node = nodes.find(n => n.id === nodeId)
      if (node?.type !== 'beneficiary') continue
      const rel = node.metadata.relationship
      const relStr = typeof rel === 'string' && rel ? rel : 'Spouse'
      node.label = survivorName
      node.technicalLabel = `${survivorName} (${relStr})`
      if (key !== survivorNameNormalized) {
        beneNodeMap.delete(key)
        if (!beneNodeMap.has(survivorNameNormalized)) beneNodeMap.set(survivorNameNormalized, nodeId)
      }
    }
  }

  // ── 11. Probate → beneficiaries (via will) ────────────────────────────────
  if (probateNodeId && hasWill && beneNodeMap.size > 0) {
    // For each unique beneficiary already on the graph, route probate to them
    for (const [, beneNodeId] of beneNodeMap) {
      edges.push({
        id: `e_will_${beneNodeId}`,
        source: probateNodeId,
        target: beneNodeId,
        type: 'probate_to',
        label: 'Per will',
        value: 0,
        metadata: {},
      })
    }
  } else if (probateNodeId && !hasWill) {
    // Intestacy — no will
    nodes.push({
      id: 'bene_intestate',
      type: 'beneficiary',
      category: 'recipient',
      label: 'Heirs (state intestacy law)',
      technicalLabel: 'Heirs — Distributed per state intestacy law',
      value: 0,
      metadata: {},
    })
    edges.push({
      id: 'e_intestate',
      source: probateNodeId,
      target: 'bene_intestate',
      type: 'probate_to',
      label: 'Per state law (no will)',
      value: probateAssetsValue,
      metadata: {},
    })
  }

  // ── 12. Tax edges ─────────────────────────────────────────────────────────
  const taxSourceId = probateNodeId ?? (trustNodeIds[0] ?? 'owner_p1')
  if (estateTaxFederal > 0) {
    edges.push({
      id: 'e_tax_federal',
      source: taxSourceId,
      target: 'tax_federal',
      type: 'tax_deducted',
      label: fmt(estateTaxFederal),
      value: estateTaxFederal,
      metadata: {},
    })
  }
  if (estateTaxState > 0) {
    edges.push({
      id: 'e_tax_state',
      source: taxSourceId,
      target: 'tax_state',
      type: 'tax_deducted',
      label: fmt(estateTaxState),
      value: estateTaxState,
      metadata: {},
    })
  }

  return {
    household_id: householdId,
    scenario_id: scenarioId,
    death_view: deathView,
    generated_at: new Date().toISOString(),
    nodes,
    edges,
    summary: {
      gross_estate: grossEstate,
      estate_tax_federal: estateTaxFederal,
      estate_tax_state: estateTaxState,
      net_to_heirs: netToHeirs,
      has_trust: hasTrust,
      has_business: hasBusiness,
      has_digital_assets: hasDigital,
      has_insurance: hasInsurance,
      probate_assets_value: probateAssetsValue,
      trust_assets_value: trustAssetsValue,
      direct_transfer_value: directTransferValue,
    },
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (n === 0) return '$0'
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toLocaleString()}`
}

function shortAddress(address: string): string {
  // Return just the street address without city/state
  const parts = address.split(',')
  return parts[0]?.trim() ?? address
}

function friendlyAssetLabel(name: string, type: string): string {
  const typeMap: Record<string, string> = {
    brokerage: 'Investment account',
    ira: 'IRA',
    roth_ira: 'Roth IRA',
    '401k': '401(k)',
    checking: 'Checking account',
    savings: 'Savings account',
    crypto: 'Cryptocurrency',
    annuity: 'Annuity',
  }
  return name || typeMap[type] || type
}
