'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// ─── Types ────────────────────────────────────────────────────────────────────

type Asset = {
  id: string
  name: string
  type: string
  value: number
  owner: string | null
  cost_basis?: number | null
  basis_date?: string | null
  titling?: string | null
  liquidity?: string | null
}

type RealEstateItem = {
  id: string
  name: string
  property_type: string
  current_value: number
  owner: string | null
}

type AssetTitling = {
  id: string
  asset_id: string
  title_type: string
  notes: string | null
}

type RealEstateTitling = {
  id: string
  real_estate_id: string
  title_type: string
  notes: string | null
}

type Beneficiary = {
  id: string
  asset_id: string | null
  real_estate_id: string | null
  beneficiary_type: 'primary' | 'contingent'
  full_name: string
  relationship: string | null
  email: string | null
  phone: string | null
  allocation_pct: number
  is_gst_skip?: boolean
}

type TitlingCategory = {
  value: string
  label: string
  icon: string
  sort_order: number
  is_active: boolean
}

type TitlingClientProps = {
  initialAssets: Asset[]
  initialRealEstate: RealEstateItem[]
  initialAssetTitling: AssetTitling[]
  initialRealEstateTitling: RealEstateTitling[]
  initialBeneficiaries: Beneficiary[]
  person1Name: string
  person2Name: string
  categories: TitlingCategory[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TITLE_TYPES = [
  { value: 'sole',               label: 'Sole Ownership' },
  { value: 'joint_wros',         label: 'Joint Tenancy (WROS)' },
  { value: 'tenants_in_common',  label: 'Tenants in Common' },
  { value: 'community_property', label: 'Community Property' },
  { value: 'tod_pod',            label: 'TOD / POD' },
  { value: 'trust_owned',        label: 'Trust Owned' },
  { value: 'corporate',          label: 'Corporate / LLC' },
]

const TITLING_OPTIONS = [
  { value: '', label: 'Not set' },
  { value: 'individual_p1', label: 'Individual (Person 1)' },
  { value: 'individual_p2', label: 'Individual (Person 2)' },
  { value: 'joint_tenants', label: 'Joint Tenants (JTWROS)' },
  { value: 'tenants_in_common', label: 'Tenants in Common' },
  { value: 'trust', label: 'Trust' },
  { value: 'entity', label: 'Entity (LLC/Corp)' },
  { value: 'pod', label: 'POD / Transfer on Death' },
  { value: 'tod', label: 'TOD (Securities)' },
]

const LIQUIDITY_OPTIONS = [
  { value: '', label: 'Not set' },
  { value: 'liquid', label: 'Liquid (immediate access)' },
  { value: 'semi_liquid', label: 'Semi-liquid (30-90 days)' },
  { value: 'illiquid', label: 'Illiquid (real estate, private)' },
  { value: 'long', label: 'Long-term locked (pension, annuity)' },
]

const RELATIONSHIPS = [
  'Spouse', 'Child', 'Parent', 'Sibling', 'Grandchild',
  'Trust', 'Charity', 'Estate', 'Other',
]

const inputClass =
  'block w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500'

function formatDollars(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

function titleLabel(value: string) {
  return TITLE_TYPES.find(t => t.value === value)?.label ?? value
}

function ownerLabel(owner: string | null, p1: string, p2: string) {
  if (owner === 'person2') return p2
  if (owner === 'joint') return 'Joint'
  return p1
}

// ─── Warning helpers ──────────────────────────────────────────────────────────

function getTitlingWarnings(
  assets: Asset[],
  realEstate: RealEstateItem[],
  assetTitling: AssetTitling[],
  realEstateTitling: RealEstateTitling[],
  beneficiaries: Beneficiary[]
): string[] {
  const warnings: string[] = []

  // Assets missing titling
  const untitledAssets = assets.filter(a => !assetTitling.find(t => t.asset_id === a.id))
  if (untitledAssets.length > 0) {
    warnings.push(`${untitledAssets.length} asset(s) have no title type set`)
  }

  // Real estate missing titling
  const untitledRE = realEstate.filter(r => !realEstateTitling.find(t => t.real_estate_id === r.id))
  if (untitledRE.length > 0) {
    warnings.push(`${untitledRE.length} property(ies) have no title type set`)
  }

  // Assets missing primary beneficiary (excluding joint/community property which pass by title)
  const needsBeneficiary = assets.filter(a => {
    const titling = assetTitling.find(t => t.asset_id === a.id)
    if (titling && ['joint_wros', 'community_property'].includes(titling.title_type)) return false
    return !beneficiaries.find(b => b.asset_id === a.id && b.beneficiary_type === 'primary')
  })
  if (needsBeneficiary.length > 0) {
    warnings.push(`${needsBeneficiary.length} asset(s) have no primary beneficiary`)
  }

  // Beneficiary allocations not summing to 100%
  const allAssetIds = [
    ...assets.map(a => ({ id: a.id, kind: 'asset' as const })),
    ...realEstate.map(r => ({ id: r.id, kind: 're' as const })),
  ]
  for (const item of allAssetIds) {
    for (const btype of ['primary', 'contingent'] as const) {
      const bens = beneficiaries.filter(b =>
        b.beneficiary_type === btype &&
        (item.kind === 'asset' ? b.asset_id === item.id : b.real_estate_id === item.id)
      )
      if (bens.length === 0) continue
      const total = bens.reduce((s, b) => s + Number(b.allocation_pct), 0)
      if (Math.abs(total - 100) > 0.01) {
        warnings.push(`${btype} beneficiary allocations for one or more items don't add up to 100%`)
        break
      }
    }
  }

  return [...new Set(warnings)] // dedupe
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function TitlingClient({
  initialAssets,
  initialRealEstate,
  initialAssetTitling,
  initialRealEstateTitling,
  initialBeneficiaries,
  person1Name,
  person2Name,
  categories,
}: TitlingClientProps) {
  const router = useRouter()
  const [assets] = useState<Asset[]>(initialAssets)
  const [realEstate] = useState<RealEstateItem[]>(initialRealEstate)
  const [assetTitling, setAssetTitling] = useState<AssetTitling[]>(initialAssetTitling)
  const [realEstateTitling, setRealEstateTitling] = useState<RealEstateTitling[]>(initialRealEstateTitling)
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>(initialBeneficiaries)
  const [activeTab, setActiveTab] = useState<string>('assets')

  // Modal state
  const [titlingModal, setTitlingModal] = useState<{
    kind: 'asset' | 're'
    id: string
    name: string
    existing: AssetTitling | RealEstateTitling | null
    asset: Asset | null
  } | null>(null)

  const [beneficiaryModal, setBeneficiaryModal] = useState<{
    kind: 'asset' | 're'
    id: string
    name: string
    existing: Beneficiary | null
    beneficiaryType: 'primary' | 'contingent'
  } | null>(null)

  const warnings = getTitlingWarnings(assets, realEstate, assetTitling, realEstateTitling, beneficiaries)

  async function reloadData() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const [{ data: at }, { data: rt }, { data: bens }] = await Promise.all([
      supabase.from('asset_titling').select('id, asset_id, title_type, notes').eq('owner_id', user.id),
      supabase.from('real_estate_titling').select('id, real_estate_id, title_type, notes').eq('owner_id', user.id),
      supabase.from('asset_beneficiaries').select('id, asset_id, real_estate_id, beneficiary_type, full_name, relationship, email, phone, allocation_pct, is_gst_skip').eq('owner_id', user.id).order('created_at', { ascending: true }),
    ])
    setAssetTitling(at ?? [])
    setRealEstateTitling(rt ?? [])
    setBeneficiaries(bens ?? [])
    router.refresh()
  }

  async function handleDeleteBeneficiary(id: string) {
    const supabase = createClient()
    await supabase.from('asset_beneficiaries').delete().eq('id', id)
    await reloadData()
  }

  function getBeneficiariesFor(kind: 'asset' | 're', id: string, type: 'primary' | 'contingent') {
    return beneficiaries.filter(b =>
      b.beneficiary_type === type &&
      (kind === 'asset' ? b.asset_id === id : b.real_estate_id === id)
    )
  }

  function getTitlingFor(kind: 'asset' | 're', id: string) {
    if (kind === 'asset') return assetTitling.find(t => t.asset_id === id) ?? null
    return realEstateTitling.find(t => t.real_estate_id === id) ?? null
  }

  // Build tabs dynamically from DB categories
  // 'assets' and 'real_estate' are wired — others show Coming Soon
  const WIRED = ['assets', 'real_estate']
  const tabCounts: Record<string, number> = { assets: assets.length, real_estate: realEstate.length }
  const tabs = categories.map(c => ({
    key: c.value,
    label: c.label,
    icon: c.icon,
    count: tabCounts[c.value] ?? null,
    wired: WIRED.includes(c.value),
  }))

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-neutral-900">Account Titling & Beneficiaries</h1>
        <p className="mt-1 text-sm text-neutral-600">
          How each asset is titled and who inherits it. Affects estate distribution and probate.
        </p>
      </div>

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50/50 px-4 py-3">
          <p className="text-sm font-medium text-amber-800 mb-1">⚠️ Action needed</p>
          <ul className="space-y-0.5">
            {warnings.map((w, i) => (
              <li key={i} className="text-xs text-amber-700">• {w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-neutral-200">
        {tabs.map(tab => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-neutral-900 text-neutral-900'
                : 'border-transparent text-neutral-500 hover:text-neutral-700'
            }`}
          >
            <span className="mr-1.5">{tab.icon}</span>
            {tab.label}
            {tab.count !== null && (
              <span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${
                activeTab === tab.key ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-500'
              }`}>
                {tab.count}
              </span>
            )}
            {!tab.wired && (
              <span className="ml-2 rounded-full px-2 py-0.5 text-xs bg-amber-100 text-amber-600">
                Soon
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Assets tab */}
      {activeTab === 'assets' && (
        <div className="space-y-4">
          {assets.length === 0 ? (
            <EmptyState icon="🏦" message="No assets found" sub="Add assets on the Assets page first" href="/assets" />
          ) : (
            assets.map(asset => (
              <AssetTitlingCard
                key={asset.id}
                kind="asset"
                id={asset.id}
                name={asset.name}
                subtitle={asset.type.replace(/_/g, ' ')}
                value={asset.value}
                ownerLabel={ownerLabel(asset.owner, person1Name, person2Name)}
                titling={getTitlingFor('asset', asset.id)}
                primaryBens={getBeneficiariesFor('asset', asset.id, 'primary')}
                contingentBens={getBeneficiariesFor('asset', asset.id, 'contingent')}
                onEditTitling={() => setTitlingModal({
                  kind: 'asset', id: asset.id, name: asset.name,
                  existing: getTitlingFor('asset', asset.id) as AssetTitling | null,
                  asset,
                })}
                onAddBeneficiary={(type) => setBeneficiaryModal({
                  kind: 'asset', id: asset.id, name: asset.name, existing: null, beneficiaryType: type,
                })}
                onEditBeneficiary={(ben) => setBeneficiaryModal({
                  kind: 'asset', id: asset.id, name: asset.name, existing: ben, beneficiaryType: ben.beneficiary_type,
                })}
                onDeleteBeneficiary={handleDeleteBeneficiary}
              />
            ))
          )}
        </div>
      )}

      {/* Real Estate tab */}
      {activeTab === 'real_estate' && (
        <div className="space-y-4">
          {realEstate.length === 0 ? (
            <EmptyState icon="🏠" message="No properties found" sub="Add properties on the Real Estate page first" href="/real-estate" />
          ) : (
            realEstate.map(re => (
              <AssetTitlingCard
                key={re.id}
                kind="re"
                id={re.id}
                name={re.name}
                subtitle={re.property_type.replace(/_/g, ' ')}
                value={re.current_value}
                ownerLabel={ownerLabel(re.owner, person1Name, person2Name)}
                titling={getTitlingFor('re', re.id)}
                primaryBens={getBeneficiariesFor('re', re.id, 'primary')}
                contingentBens={getBeneficiariesFor('re', re.id, 'contingent')}
                onEditTitling={() => setTitlingModal({
                  kind: 're', id: re.id, name: re.name,
                  existing: getTitlingFor('re', re.id) as RealEstateTitling | null,
                  asset: null,
                })}
                onAddBeneficiary={(type) => setBeneficiaryModal({
                  kind: 're', id: re.id, name: re.name, existing: null, beneficiaryType: type,
                })}
                onEditBeneficiary={(ben) => setBeneficiaryModal({
                  kind: 're', id: re.id, name: re.name, existing: ben, beneficiaryType: ben.beneficiary_type,

                })}
                onDeleteBeneficiary={handleDeleteBeneficiary}
              />
            ))
          )}
        </div>
      )}

      {/* Titling Modal */}
      {titlingModal && (
        <TitlingModal
          kind={titlingModal.kind}
          id={titlingModal.id}
          name={titlingModal.name}
          existing={titlingModal.existing}
          asset={titlingModal.asset}
          onClose={() => setTitlingModal(null)}
          onSave={async () => { setTitlingModal(null); await reloadData() }}
        />
      )}

      {/* Beneficiary Modal */}
      {beneficiaryModal && (
        <BeneficiaryModal
          kind={beneficiaryModal.kind}
          id={beneficiaryModal.id}
          name={beneficiaryModal.name}
          existing={beneficiaryModal.existing}
          defaultType={beneficiaryModal.beneficiaryType}
          allBeneficiariesForItem={beneficiaries.filter(b =>
            (beneficiaryModal.kind === 'asset'
              ? b.asset_id === beneficiaryModal.id
              : b.real_estate_id === beneficiaryModal.id) &&
            b.id !== beneficiaryModal.existing?.id
          )}
          onClose={() => setBeneficiaryModal(null)}
          onSave={async () => { setBeneficiaryModal(null); await reloadData() }}
        />
      )}
    </div>
  )
}

// ─── Asset / RE card ──────────────────────────────────────────────────────────

function AssetTitlingCard({
  kind, id, name, subtitle, value, ownerLabel, titling,
  primaryBens, contingentBens,
  onEditTitling, onAddBeneficiary, onEditBeneficiary, onDeleteBeneficiary,
}: {
  kind: 'asset' | 're'
  id: string
  name: string
  subtitle: string
  value: number
  ownerLabel: string
  titling: AssetTitling | RealEstateTitling | null
  primaryBens: Beneficiary[]
  contingentBens: Beneficiary[]
  onEditTitling: () => void
  onAddBeneficiary: (type: 'primary' | 'contingent') => void
  onEditBeneficiary: (ben: Beneficiary) => void
  onDeleteBeneficiary: (id: string) => void
}) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const primaryTotal = primaryBens.reduce((s, b) => s + Number(b.allocation_pct), 0)
  const contingentTotal = contingentBens.reduce((s, b) => s + Number(b.allocation_pct), 0)

  return (
    <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
      {/* Asset header */}
      <div className="px-5 py-4 flex items-center justify-between border-b border-neutral-100">
        <div className="flex items-center gap-3">
          <div>
            <p className="text-sm font-semibold text-neutral-900">{name}</p>
            <p className="text-xs text-neutral-400 capitalize mt-0.5">{subtitle} · {ownerLabel} · {formatDollars(value)}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {titling ? (
            <span className="text-xs font-medium bg-neutral-100 text-neutral-600 rounded-full px-3 py-1">
              {titleLabel(titling.title_type)}
            </span>
          ) : (
            <span className="text-xs font-medium bg-amber-100 text-amber-700 rounded-full px-3 py-1">
              No title set
            </span>
          )}
          <button
            type="button"
            onClick={onEditTitling}
            className="text-xs text-indigo-600 font-medium hover:text-indigo-800"
          >
            {titling ? 'Edit title' : 'Set title'}
          </button>
        </div>
      </div>

      {/* Notes */}
      {titling?.notes && (
        <div className="px-5 py-2 bg-neutral-50 border-b border-neutral-100">
          <p className="text-xs text-neutral-500 italic">{titling.notes}</p>
        </div>
      )}

      {/* Beneficiaries */}
      <div className="px-5 py-4 space-y-4">
        {/* Primary */}
        <BeneficiarySection
          label="Primary Beneficiaries"
          bens={primaryBens}
          total={primaryTotal}
          confirmDeleteId={confirmDeleteId}
          onAdd={() => onAddBeneficiary('primary')}
          onEdit={onEditBeneficiary}
          onDelete={(id) => { setConfirmDeleteId(id) }}
          onConfirmDelete={(id) => { onDeleteBeneficiary(id); setConfirmDeleteId(null) }}
          onCancelDelete={() => setConfirmDeleteId(null)}
        />
        {/* Contingent */}
        <BeneficiarySection
          label="Contingent Beneficiaries"
          bens={contingentBens}
          total={contingentTotal}
          confirmDeleteId={confirmDeleteId}
          onAdd={() => onAddBeneficiary('contingent')}
          onEdit={onEditBeneficiary}
          onDelete={(id) => { setConfirmDeleteId(id) }}
          onConfirmDelete={(id) => { onDeleteBeneficiary(id); setConfirmDeleteId(null) }}
          onCancelDelete={() => setConfirmDeleteId(null)}
        />
      </div>
    </div>
  )
}

// ─── Beneficiary section ──────────────────────────────────────────────────────

function BeneficiarySection({
  label, bens, total, confirmDeleteId,
  onAdd, onEdit, onDelete, onConfirmDelete, onCancelDelete,
}: {
  label: string
  bens: Beneficiary[]
  total: number
  confirmDeleteId: string | null
  onAdd: () => void
  onEdit: (ben: Beneficiary) => void
  onDelete: (id: string) => void
  onConfirmDelete: (id: string) => void
  onCancelDelete: () => void
}) {
  const allocationOk = bens.length === 0 || Math.abs(total - 100) < 0.01

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{label}</p>
          {bens.length > 0 && (
            <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${
              allocationOk ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
            }`}>
              {total.toFixed(0)}%
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onAdd}
          className="text-xs text-indigo-600 font-medium hover:text-indigo-800"
        >
          + Add
        </button>
      </div>

      {bens.length === 0 ? (
        <p className="text-xs text-neutral-400 italic">None added</p>
      ) : (
        <div className="space-y-2">
          {bens.map(ben => (
            <div key={ben.id} className="flex items-center justify-between rounded-lg border border-neutral-100 bg-neutral-50 px-3 py-2">
              <div>
                <p className="text-sm font-medium text-neutral-900">
                  {ben.full_name}
                  {ben.is_gst_skip && (
                    <span className="text-xs bg-purple-100 text-purple-700 rounded-full px-2 py-0.5 ml-1">GST Skip</span>
                  )}
                </p>
                <p className="text-xs text-neutral-400 mt-0.5">
                  {ben.relationship && <span>{ben.relationship}</span>}
                  {ben.relationship && (ben.email || ben.phone) && <span> · </span>}
                  {ben.email && <span>{ben.email}</span>}
                  {ben.email && ben.phone && <span> · </span>}
                  {ben.phone && <span>{ben.phone}</span>}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-neutral-700">{Number(ben.allocation_pct).toFixed(0)}%</span>
                {confirmDeleteId === ben.id ? (
                  <span className="inline-flex items-center gap-2 text-xs">
                    <span className="text-neutral-500">Delete?</span>
                    <button type="button" onClick={() => onConfirmDelete(ben.id)} className="text-red-600 font-medium hover:text-red-800">Yes</button>
                    <button type="button" onClick={onCancelDelete} className="text-neutral-400 hover:text-neutral-600">No</button>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2">
                    <button type="button" onClick={() => onEdit(ben)} className="text-xs text-indigo-600 font-medium hover:text-indigo-800">Edit</button>
                    <button type="button" onClick={() => onDelete(ben.id)} className="text-xs text-red-500 font-medium hover:text-red-700">Delete</button>
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Titling Modal ────────────────────────────────────────────────────────────

function TitlingModal({
  kind, id, name, existing, asset, onClose, onSave,
}: {
  kind: 'asset' | 're'
  id: string
  name: string
  existing: AssetTitling | RealEstateTitling | null
  asset: Asset | null
  onClose: () => void
  onSave: () => void
}) {
  const [titleType, setTitleType] = useState(existing?.title_type ?? 'sole')
  const [assetTitling, setAssetTitling] = useState(asset?.titling ?? '')
  const [liquidity, setLiquidity] = useState(asset?.liquidity ?? '')
  const [costBasis, setCostBasis] = useState(
    asset?.cost_basis == null ? '' : String(asset.cost_basis)
  )
  const [basisDate, setBasisDate] = useState(asset?.basis_date ?? '')
  const [notes, setNotes] = useState(existing?.notes ?? '')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const table = kind === 'asset' ? 'asset_titling' : 'real_estate_titling'
      const fkCol = kind === 'asset' ? 'asset_id' : 'real_estate_id'
      const payload = {
        title_type: titleType,
        notes: notes.trim() || null,
        updated_at: new Date().toISOString(),
      }

      if (existing) {
        const { error } = await supabase.from(table).update(payload).eq('id', existing.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from(table).insert({
          ...payload,
          owner_id: user.id,
          [fkCol]: id,
        })
        if (error) throw error
      }

      if (kind === 'asset') {
        const parsedCostBasis = costBasis.trim() === '' ? null : Number(costBasis)
        if (parsedCostBasis !== null && Number.isNaN(parsedCostBasis)) {
          throw new Error('Cost basis must be a valid number.')
        }
        const { error: assetError } = await supabase
          .from('assets')
          .update({
            titling: assetTitling || null,
            liquidity: liquidity || null,
            cost_basis: parsedCostBasis,
            basis_date: basisDate || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id)
        if (assetError) throw assetError
      }
      onSave()
    } catch (err) {
      setError(err instanceof Error ? err.message : JSON.stringify(err))
      setIsSubmitting(false)
    }
  }

  return (
    <ModalShell title={`Set Title — ${name}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</p>}
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">Title Type</label>
          <select value={titleType} onChange={e => setTitleType(e.target.value)} className={inputClass}>
            {TITLE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <p className="mt-1 text-xs text-neutral-400">{getTitleDescription(titleType)}</p>
        </div>
        {kind === 'asset' && (
          <>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Titling</label>
              <select
                value={assetTitling}
                onChange={e => setAssetTitling(e.target.value)}
                className={inputClass}
              >
                {TITLING_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Liquidity</label>
              <select
                value={liquidity}
                onChange={e => setLiquidity(e.target.value)}
                className={inputClass}
              >
                {LIQUIDITY_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Cost Basis</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={costBasis}
                  onChange={e => setCostBasis(e.target.value)}
                  className={inputClass}
                  placeholder="Optional"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Basis Date</label>
                <input
                  type="date"
                  value={basisDate}
                  onChange={e => setBasisDate(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>
          </>
        )}
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">
            Notes <span className="font-normal text-neutral-400">(optional)</span>
          </label>
          <input
            type="text"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            className={inputClass}
            placeholder="e.g. Trust name, TIC split percentage"
          />
        </div>
        <ModalButtons onClose={onClose} isSubmitting={isSubmitting} isEdit={!!existing} />
      </form>
    </ModalShell>
  )
}

// ─── Beneficiary Modal ────────────────────────────────────────────────────────

function BeneficiaryModal({
  kind, id, name, existing, defaultType, allBeneficiariesForItem, onClose, onSave,
}: {
  kind: 'asset' | 're'
  id: string
  name: string
  existing: Beneficiary | null
  defaultType: 'primary' | 'contingent'
  allBeneficiariesForItem: Beneficiary[]
  onClose: () => void
  onSave: () => void
}) {
  const [beneficiaryType, setBeneficiaryType] = useState<'primary' | 'contingent'>(
    existing?.beneficiary_type ?? defaultType
  )
  const [fullName, setFullName] = useState(existing?.full_name ?? '')
  const [relationship, setRelationship] = useState(existing?.relationship ?? '')
  const [email, setEmail] = useState(existing?.email ?? '')
  const [phone, setPhone] = useState(existing?.phone ?? '')
  const [isGstSkip, setIsGstSkip] = useState(existing?.is_gst_skip ?? false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const calcRemaining = (type: 'primary' | 'contingent') => {
    const allocated = allBeneficiariesForItem
      .filter(b => b.beneficiary_type === type)
      .reduce((s, b) => s + Number(b.allocation_pct), 0)
    return Math.max(0, 100 - allocated)
  }

  const [allocationPct, setAllocationPct] = useState(() => {
    if (existing?.allocation_pct != null) return existing.allocation_pct.toString()
    return String(calcRemaining(existing?.beneficiary_type ?? defaultType))
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)
    const pct = parseFloat(allocationPct)
    const remaining = calcRemaining(beneficiaryType)
    if (isNaN(pct) || pct <= 0 || pct > 100) {
      setError('Allocation must be between 1 and 100.')
      setIsSubmitting(false)
      return
    }
    if (pct > remaining + 0.01) {
      setError(`Only ${remaining.toFixed(0)}% remaining for ${beneficiaryType} beneficiaries.`)
      setIsSubmitting(false)
      return
    }
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const payload = {
        beneficiary_type: beneficiaryType,
        full_name: fullName.trim(),
        relationship: relationship.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        allocation_pct: pct,
        is_gst_skip: isGstSkip,
        updated_at: new Date().toISOString(),
      }
      if (existing) {
        const { error } = await supabase.from('asset_beneficiaries').update(payload).eq('id', existing.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('asset_beneficiaries').insert({
          ...payload,
          owner_id: user.id,
          asset_id: kind === 'asset' ? id : null,
          real_estate_id: kind === 're' ? id : null,
        })
        if (error) throw error
      }
      onSave()
    } catch (err) {
      setError(err instanceof Error ? err.message : JSON.stringify(err))
      setIsSubmitting(false)
    }
  }

  const remaining = calcRemaining(beneficiaryType)
  const alreadyAllocated = 100 - remaining

  return (
    <ModalShell title={`${existing ? 'Edit' : 'Add'} Beneficiary — ${name}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</p>}
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">Type</label>
          <select value={beneficiaryType} onChange={e => setBeneficiaryType(e.target.value as 'primary' | 'contingent')} className={inputClass}>
            <option value="primary">Primary</option>
            <option value="contingent">Contingent</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="gst_skip"
            checked={isGstSkip}
            onChange={e => setIsGstSkip(e.target.checked)}
            className="rounded border-neutral-300"
          />
          <label htmlFor="gst_skip" className="text-sm text-neutral-700">
            GST Skip Person (grandchild or skip generation)
          </label>
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">Full Name</label>
          <input type="text" required value={fullName} onChange={e => setFullName(e.target.value)} className={inputClass} placeholder="e.g. Jane Smith" />
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">Relationship</label>
          <select value={relationship} onChange={e => setRelationship(e.target.value)} className={inputClass}>
            <option value="">Select…</option>
            {RELATIONSHIPS.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} className={inputClass} placeholder="Optional" />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Phone</label>
            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} className={inputClass} placeholder="Optional" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">Allocation (%)</label>
          <input
            type="number"
            required
            min="1"
            max={remaining}
            step="0.01"
            value={allocationPct}
            onChange={e => setAllocationPct(e.target.value)}
            className={inputClass}
            placeholder={remaining.toString()}
          />
          <p className="mt-1 text-xs text-neutral-400">
            {alreadyAllocated > 0
              ? `${alreadyAllocated.toFixed(0)}% already allocated — ${remaining.toFixed(0)}% remaining`
              : 'All beneficiaries of this type should total 100%.'}
          </p>
        </div>
        <ModalButtons onClose={onClose} isSubmitting={isSubmitting} isEdit={!!existing} />
      </form>
    </ModalShell>
  )
}


// ─── Shared modal shell ───────────────────────────────────────────────────────

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md max-h-[90vh] flex flex-col rounded-2xl bg-white shadow-2xl ring-1 ring-neutral-200">
        <div className="flex shrink-0 items-center justify-between border-b border-neutral-200 px-6 py-4">
          <h2 className="text-base font-semibold text-neutral-900">{title}</h2>
          <button type="button" onClick={onClose} className="text-neutral-400 hover:text-neutral-600">✕</button>
        </div>
        <div className="px-6 py-5 overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}

function ModalButtons({ onClose, isSubmitting, isEdit }: { onClose: () => void; isSubmitting: boolean; isEdit: boolean }) {
  return (
    <div className="flex gap-3 pt-2 pb-1">
      <button
        type="button"
        onClick={onClose}
        className="flex-1 rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition"
      >
        Cancel
      </button>
      <button
        type="submit"
        disabled={isSubmitting}
        className="flex-1 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50 transition"
      >
        {isSubmitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Add'}
      </button>
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ icon, message, sub, href }: { icon: string; message: string; sub: string; href: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-300 bg-white py-16 text-center">
      <div className="text-4xl mb-3">{icon}</div>
      <p className="text-sm font-medium text-neutral-600">{message}</p>
      <p className="text-xs text-neutral-400 mt-1">{sub}</p>
      <a href={href} className="mt-3 text-sm text-indigo-600 hover:underline">Go there →</a>
    </div>
  )
}

// ─── Title type descriptions ──────────────────────────────────────────────────

function getTitleDescription(titleType: string): string {
  const descriptions: Record<string, string> = {
    sole:               'Owned by one person. Goes through probate unless TOD/beneficiary is named.',
    joint_wros:         'Co-owners each hold an undivided interest. Survivor inherits automatically — no probate.',
    tenants_in_common:  'Each owner holds a specific share. Their share passes through their estate/will.',
    community_property: 'Property acquired during marriage owned equally by both spouses.',
    tod_pod:            'Transfer/Payable on Death — passes directly to named beneficiary, bypasses probate.',
    trust_owned:        'Held in a trust. Distribution governed by trust terms — typically avoids probate.',
    corporate:          'Owned by a business entity (LLC, corporation, partnership).',
  }
  return descriptions[titleType] ?? ''
}
