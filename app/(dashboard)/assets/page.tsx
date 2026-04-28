'use client'

// ─────────────────────────────────────────
// Menu: Financial Planning > Assets
// Route: /assets
// ─────────────────────────────────────────

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { displayPersonFirstName } from '@/lib/display-person-name'
import type { RefOption } from '@/lib/ref-data-fetchers'

const US_STATE_CODES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY','DC',
] as const

const SITUS_ASSET_TYPES: { value: string; label: string }[] = [
  { value: 'real_estate', label: 'Real estate' },
  { value: 'financial_account', label: 'Financial account' },
  { value: 'business_interest', label: 'Business interest' },
  { value: 'tangible_personal_property', label: 'Tangible personal property' },
  { value: 'intangible', label: 'Intangible' },
  { value: 'other', label: 'Other' },
]

type AssetType = { value: string; label: string }

type EstateInclusionStatus =
  | 'included'
  | 'excluded_irrevocable'
  | 'excluded_gifted'
  | 'excluded_other'

const ESTATE_INCLUSION_HELPER: Record<EstateInclusionStatus, string> = {
  included: 'This asset is part of your taxable estate.',
  excluded_irrevocable:
    'Assets held in an irrevocable trust are generally outside your taxable estate.',
  excluded_gifted:
    'A completed gift removes this asset from your estate. Gift tax rules may apply.',
  excluded_other:
    'Mark this asset as excluded if it has been transferred outside your estate by another method.',
}

type Asset = {
  id: string
  owner_id: string
  tsowner: string
  owner?: string
  type: string
  name: string
  value: number
  details: Record<string, unknown> | null
  created_at: string
  updated_at: string
  situs_state?: string | null
  situs_asset_type?: string | null
  cost_basis?: number | null
  basis_date?: string | null
  liquidity?: string | null
  titling?: string | null
  institution?: string | null
  account_last4?: string | null
  face_value?: number | null
  is_ilit?: boolean | null
  estate_inclusion_status?: EstateInclusionStatus | string | null
}

const STORAGE_KEY = 'ep_assets_groups'

export default function AssetsPage() {
  const [person1Name, setPerson1Name] = useState('Person 1')
  const [person2Name, setPerson2Name] = useState('Person 2')
  const [assets, setAssets] = useState<Asset[]>([])
  const [assetTypes, setAssetTypes] = useState<AssetType[]>([])
  const [liquidityTypes, setLiquidityTypes] = useState<RefOption[]>([])
  const [titlingTypes, setTitlingTypes] = useState<RefOption[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editAsset, setEditAsset] = useState<Asset | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      return saved ? JSON.parse(saved) : {}
    } catch {
      return {}
    }
  })
  const [error, setError] = useState<string | null>(null)

  const totalValue = assets.reduce((sum, a) => sum + Number(a.value), 0)

  const loadData = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const [
      { data: assetsData, error: assetsError },
      { data: typesData },
      { data: liquidityData },
      { data: titlingData },
      { data: household },
    ] = await Promise.all([
      supabase.from('assets').select('*').eq('owner_id', user.id).order('created_at', { ascending: false }),
      supabase.from('asset_types').select('value, label').eq('is_active', true).order('sort_order'),
      supabase.from('ref_liquidity_types').select('value, label, description').eq('is_active', true).order('sort_order'),
      supabase.from('ref_titling_types').select('value, label, description').eq('is_active', true).order('sort_order'),
      supabase.from('households').select('person1_name, person2_name, has_spouse').eq('owner_id', user.id).single(),
    ])

    if (assetsError) setError(assetsError.message)
    else setAssets(assetsData ?? [])
    setAssetTypes(typesData ?? [])
    setLiquidityTypes(liquidityData ?? [])
    setTitlingTypes(titlingData ?? [])
    if (household?.person1_name) setPerson1Name(displayPersonFirstName(household.person1_name, 'Person 1'))
    if (household?.person2_name) setPerson2Name(displayPersonFirstName(household.person2_name, 'Person 2'))
    setIsLoading(false)
  }, [])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadData()
    }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [loadData])

  async function handleDelete(id: string) {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('assets').delete().eq('id', id)
    if (!error && user?.id) {
      const { data: hh } = await supabase.from('households').select('id').eq('owner_id', user.id).single()
      if (hh?.id) await supabase.from('households').update({ updated_at: new Date().toISOString() }).eq('id', hh.id)
    }
    if (error) setError(error.message)
    else setAssets((prev) => prev.filter((a) => a.id !== id))
    setConfirmDeleteId(null)
  }

  function getTypeLabel(type: string) {
    return assetTypes.find((t) => t.value === type)?.label ?? type
  }

  const grouped = assets.reduce<Record<string, Asset[]>>((acc, asset) => {
    const key = asset.type || 'other'
    if (!acc[key]) acc[key] = []
    acc[key].push(asset)
    return acc
  }, {})

  const groupKeys = Object.keys(grouped).sort((a, b) => getTypeLabel(a).localeCompare(getTypeLabel(b)))

  groupKeys.forEach((key) => {
    grouped[key].sort((a, b) => a.name.localeCompare(b.name))
  })

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(openGroups))
    } catch {}
  }, [openGroups])

  useEffect(() => {
    const hasSaved = (() => {
      try { return !!localStorage.getItem(STORAGE_KEY) } catch { return false }
    })()
    if (!hasSaved && assets.length > 0) {
      const timeoutId = window.setTimeout(() => {
        const allOpen: Record<string, boolean> = {}
        groupKeys.forEach((k) => { allOpen[k] = true })
        setOpenGroups(allOpen)
      }, 0)
      return () => window.clearTimeout(timeoutId)
    }
  }, [assets.length, groupKeys])

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center"><p className="text-neutral-500">Loading...</p></div>
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-12">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Assets</h1>
          <p className="mt-1 text-sm text-neutral-600">
            Total value: <span className="font-semibold text-neutral-900">{formatDollars(totalValue)}</span>
          </p>
        </div>
        <button
          onClick={() => { setEditAsset(null); setShowModal(true) }}
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 transition"
        >
          + Add Asset
        </button>
      </div>

      {error && <p className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</p>}

      {assets.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-300 bg-white py-16 text-center">
          <div className="text-4xl mb-3">🏦</div>
          <p className="text-sm font-medium text-neutral-600">No assets yet</p>
          <p className="text-xs text-neutral-400 mt-1">Add your first asset to get started</p>
        </div>
      ) : (
        groupKeys.map((groupKey) => {
          const groupItems = grouped[groupKey]
          const groupLabel = getTypeLabel(groupKey)
          const groupTotal = groupItems.reduce((s, item) => s + Number(item.value), 0)
          const isOpen = openGroups[groupKey] ?? true

          return (
            <div key={groupKey} className="mb-4">
              <button
                onClick={() => setOpenGroups((prev) => ({ ...prev, [groupKey]: !prev[groupKey] }))}
                className="w-full flex items-center justify-between px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl hover:bg-neutral-100 transition mb-1"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs text-neutral-400 transition-transform duration-200" style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
                  <span className="text-sm font-semibold text-neutral-700">{groupLabel}</span>
                  <span className="text-xs text-neutral-400 bg-neutral-200 px-1.5 py-0.5 rounded-full">
                    {groupItems.length}
                  </span>
                </div>
                <span className="text-sm font-semibold text-neutral-900">{formatDollars(groupTotal)}</span>
              </button>

              {isOpen && (
                <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
                  <table className="min-w-full divide-y divide-neutral-100">
                    <tbody className="divide-y divide-neutral-100">
                      {groupItems.map((asset) => (
                        <tr key={asset.id} className="group hover:bg-neutral-50 transition-colors">
                          <td className="px-4 py-3 text-sm font-medium text-neutral-900">
                            <div className="flex flex-wrap items-center gap-2">
                              <span>{asset.name}</span>
                              {asset.estate_inclusion_status === 'excluded_irrevocable' ? (
                                <span className="text-xs font-medium bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                                  Irrevocable Trust
                                </span>
                              ) : null}
                              {asset.estate_inclusion_status === 'excluded_gifted' ? (
                                <span className="text-xs font-medium bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
                                  Gifted
                                </span>
                              ) : null}
                              {asset.estate_inclusion_status === 'excluded_other' ? (
                                <span className="text-xs font-medium bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                                  Excluded
                                </span>
                              ) : null}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-neutral-500">{getTypeLabel(asset.type)}</td>
                          <td className="px-4 py-3 text-sm text-neutral-500">
                            {(asset.owner ?? 'person1') === 'person1' ? person1Name : (asset.owner ?? 'person1') === 'person2' ? person2Name : 'Joint'}
                          </td>
                          <td className="px-4 py-3 text-sm font-semibold text-neutral-900">{formatDollars(Number(asset.value))}</td>
                          <td className="px-4 py-3 text-right">
                            {confirmDeleteId === asset.id ? (
                              <span className="inline-flex items-center gap-2 text-sm">
                                <span className="text-neutral-500">Delete?</span>
                                <button onClick={() => handleDelete(asset.id)} className="text-red-600 font-medium hover:text-red-800">Yes</button>
                                <button onClick={() => setConfirmDeleteId(null)} className="text-neutral-400 hover:text-neutral-600">No</button>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => { setEditAsset(asset); setShowModal(true) }} className="text-sm text-indigo-600 font-medium hover:text-indigo-800">Edit</button>
                                <button onClick={() => setConfirmDeleteId(asset.id)} className="text-sm text-red-500 font-medium hover:text-red-700">Delete</button>
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )
        })
      )}

      {showModal && (
        <AssetModal
          key={editAsset?.id ?? 'new'}
          editAsset={editAsset}
          assetTypes={assetTypes}
          person1Name={person1Name}
          person2Name={person2Name}
          liquidityTypes={liquidityTypes}
          titlingTypes={titlingTypes}
          onClose={() => { setShowModal(false); setEditAsset(null) }}
          onSave={() => { setShowModal(false); setEditAsset(null); loadData() }}
        />
      )}
    </div>
  )
}

function AssetModal({ editAsset, assetTypes, person1Name, person2Name, liquidityTypes, titlingTypes, onClose, onSave }: {
  editAsset: Asset | null
  assetTypes: AssetType[]
  person1Name: string
  person2Name: string
  liquidityTypes: RefOption[]
  titlingTypes: RefOption[]
  onClose: () => void
  onSave: () => void
}) {
  const sortedAssetTypes = [...assetTypes].sort((a, b) => a.label.localeCompare(b.label))
  const [owner, setOwner] = useState(editAsset?.owner ?? 'person1')
  const [type, setType] = useState(editAsset?.type ?? sortedAssetTypes[0]?.value ?? '')
  const [name, setName] = useState(editAsset?.name ?? '')
  const [value, setValue] = useState(editAsset?.value?.toString() ?? '')
  const [institution, setInstitution] = useState(editAsset?.institution ?? '')
  const [accountLast4, setAccountLast4] = useState(editAsset?.account_last4 ?? '')
  const [costBasis, setCostBasis] = useState(editAsset?.cost_basis?.toString() ?? '')
  const [basisDate, setBasisDate] = useState(editAsset?.basis_date ?? '')
  const [liquidity, setLiquidity] = useState(editAsset?.liquidity ?? '')
  const [titling, setTitling] = useState(editAsset?.titling ?? '')
  const [faceValue, setFaceValue] = useState(editAsset?.face_value?.toString() ?? '')
  const [isIlit, setIsIlit] = useState(editAsset?.is_ilit ?? false)
  const [situsState, setSitusState] = useState(editAsset?.situs_state ?? '')
  const [situsAssetType, setSitusAssetType] = useState(editAsset?.situs_asset_type ?? '')
  const [estateInclusionStatus, setEstateInclusionStatus] = useState<EstateInclusionStatus>(
    (editAsset?.estate_inclusion_status as EstateInclusionStatus | undefined) ?? 'included'
  )
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

      const { data: household } = await supabase
        .from('households')
        .select('id')
        .eq('owner_id', user.id)
        .single()

      const situsPayload = {
        situs_state: situsState.trim() || null,
        situs_asset_type: situsAssetType.trim() || null,
      }

      const estatePayload = { estate_inclusion_status: estateInclusionStatus }

      if (editAsset) {
        const { error } = await supabase
          .from('assets')
          .update({
            owner: owner,
            type,
            name,
            value: parseFloat(value),
            cost_basis: costBasis ? parseFloat(costBasis) : null,
            basis_date: basisDate || null,
            liquidity: liquidity || null,
            titling: titling || null,
            institution: institution || null,
            account_last4: accountLast4 || null,
            face_value: faceValue ? parseFloat(faceValue) : null,
            is_ilit: isIlit,
            ...situsPayload,
            ...estatePayload,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editAsset.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('assets')
          .insert({
            owner_id: user.id,
            owner: owner,
            type,
            name,
            value: parseFloat(value),
            cost_basis: costBasis ? parseFloat(costBasis) : null,
            basis_date: basisDate || null,
            liquidity: liquidity || null,
            titling: titling || null,
            institution: institution || null,
            account_last4: accountLast4 || null,
            face_value: faceValue ? parseFloat(faceValue) : null,
            is_ilit: isIlit,
            ...situsPayload,
            ...estatePayload,
          })
        if (error) throw error
      }
      if (household?.id) {
        await supabase.from('households').update({ updated_at: new Date().toISOString() }).eq('id', household.id)
      }
      onSave()
    } catch (err) {
     setError(err instanceof Error ? err.message : JSON.stringify(err))
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl ring-1 ring-neutral-200">
        <div className="flex items-center justify-between border-b border-neutral-200 px-6 py-4">
          <h2 className="text-base font-semibold text-neutral-900">{editAsset ? 'Edit Asset' : 'Add Asset'}</h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</p>}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Asset Type</label>
            <select value={type} onChange={(e) => setType(e.target.value)} className={inputClass}>
              {sortedAssetTypes.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Owner</label>
            <select value={owner} onChange={(e) => setOwner(e.target.value)} className={inputClass}>
              <option value="person1">{person1Name}</option>
              <option value="person2">{person2Name}</option>
              <option value="joint">Joint</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Asset Name</label>
            <input type="text" required value={name} onChange={(e) => setName(e.target.value)}
              className={inputClass} placeholder="e.g. Primary Home, Fidelity 401k" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Institution / Custodian</label>
              <input type="text" value={institution} onChange={(e) => setInstitution(e.target.value)} className={inputClass} placeholder="e.g. Fidelity, Vanguard, Chase" />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Account Last 4 Digits</label>
              <input type="text" maxLength={4} value={accountLast4} onChange={(e) => setAccountLast4(e.target.value)} className={inputClass} placeholder="e.g. 4821" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Current Value ($)</label>
            <input type="number" min="0" step="0.01" required value={value}
              onChange={(e) => setValue(e.target.value)} className={inputClass} placeholder="0.00" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Cost Basis</label>
              <input type="number" min="0" step="0.01" value={costBasis} onChange={(e) => setCostBasis(e.target.value)} className={inputClass} />
              <p className="mt-1 text-xs text-neutral-500">Original purchase price or tax basis. Used for capital gains calculation.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Basis Date</label>
              <input type="date" value={basisDate} onChange={(e) => setBasisDate(e.target.value)} className={inputClass} />
              <p className="mt-1 text-xs text-neutral-500">Date the asset was acquired at this basis.</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Liquidity</label>
              <select value={liquidity} onChange={(e) => setLiquidity(e.target.value)} className={inputClass}>
                <option value="">Select liquidity...</option>
                {liquidityTypes.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <p className="mt-1 text-xs text-neutral-500">How quickly can this asset be converted to cash?</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Titling / Ownership</label>
              <select value={titling} onChange={(e) => setTitling(e.target.value)} className={inputClass}>
                <option value="">Select titling...</option>
                {titlingTypes
                  .filter((t) => (t.description ?? '').toLowerCase().includes('assets') || !(t.description ?? '').toLowerCase().includes('real_estate'))
                  .map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
              </select>
              <p className="mt-1 text-xs text-neutral-500">How is this asset legally owned? Affects estate planning and probate.</p>
            </div>
          </div>
          <div className="rounded-lg border border-neutral-200 p-4 space-y-3">
            <h3 className="text-sm font-semibold text-neutral-900">Estate Inclusion</h3>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Estate status</label>
              <select
                value={estateInclusionStatus}
                onChange={(e) => setEstateInclusionStatus(e.target.value as EstateInclusionStatus)}
                className={inputClass}
              >
                <option value="included">Included in Estate</option>
                <option value="excluded_irrevocable">Held in Irrevocable Trust</option>
                <option value="excluded_gifted">Gifted (Completed Transfer)</option>
                <option value="excluded_other">Excluded – Other</option>
              </select>
              <p className="mt-2 text-xs text-neutral-500">
                {ESTATE_INCLUSION_HELPER[estateInclusionStatus] ?? ESTATE_INCLUSION_HELPER.included}
              </p>
            </div>
          </div>
          {type === 'life_insurance' && (
            <div className="rounded-lg border border-neutral-200 p-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Death Benefit / Face Value</label>
                <input type="number" min="0" step="0.01" value={faceValue} onChange={(e) => setFaceValue(e.target.value)} className={inputClass} />
                <p className="mt-1 text-xs text-neutral-500">Total death benefit paid to beneficiaries. May differ from cash value.</p>
              </div>
              <label className="flex items-start gap-2">
                <input type="checkbox" checked={isIlit} onChange={(e) => setIsIlit(e.target.checked)} className="mt-1 h-4 w-4 rounded border-neutral-300" />
                <span className="text-sm text-neutral-700">
                  Held in an Irrevocable Life Insurance Trust (ILIT)
                  <span className="block text-xs text-neutral-500 mt-0.5">
                    If held in an ILIT, the death benefit is excluded from your taxable estate.
                  </span>
                </span>
              </label>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Situs state (optional)</label>
            <select
              value={situsState}
              onChange={(e) => setSitusState(e.target.value)}
              className={inputClass}
            >
              <option value="">— Not specified —</option>
              {US_STATE_CODES.map((code) => (
                <option key={code} value={code}>{code}</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-neutral-500">
              Legal location of the asset (e.g. real estate in NY). Used for multi-state estate tax calculations.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Situs asset type (optional)</label>
            <select
              value={situsAssetType}
              onChange={(e) => setSitusAssetType(e.target.value)}
              className={inputClass}
            >
              <option value="">— Not specified —</option>
              {SITUS_ASSET_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-neutral-500">
              Used for multi-state estate tax calculations.
            </p>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting}
              className="flex-1 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50 transition">
              {isSubmitting ? 'Saving...' : editAsset ? 'Save Changes' : 'Add Asset'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const inputClass = "block w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500"

function formatDollars(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}
