'use client'

// ─────────────────────────────────────────
// Menu: Estate Planning > Titling & Beneficiaries
// Route: /titling
// ─────────────────────────────────────────

import { useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import AssetTitlingCard from '@/components/titling/AssetTitlingCard'
import VirtualTitlingCardList from '@/components/titling/VirtualTitlingCardList'
import { CollapsibleSection } from '@/components/CollapsibleSection'
import { displayPersonFirstName } from '@/lib/display-person-name'
import { buildTitlingLookups, beneficiaryMatchesEntity } from '@/lib/titling/buildTitlingLookups'
import { buildBeneficiaryPicklist, orderedDescendants } from '@/lib/titling/beneficiaryPicklist'
import { getTitlingWarnings } from '@/lib/titling/getTitlingWarnings'
import type {
  Asset,
  BusinessRow,
  GapItem,
  HouseholdPersonRow,
  InsurancePolicyRow,
  RealEstateItem,
  TitlingCategory,
} from '@/lib/titling/titlingEntityTypes'
import type {
  AnyTitling,
  AssetTitling,
  Beneficiary,
  BusinessTitlingRow,
  InsurancePolicyTitling,
  RealEstateTitling,
  TitlingKind,
} from '@/lib/titling/types'
import {
  buildAssetTitlingOptions,
  groupRowsByOwnerBucket,
  ownerLabel,
  titlingExemptFromBeneficiaryGap,
  titlingFinancialOwnerLabel,
} from '@/lib/titling/titlingDisplayHelpers'

const TitlingModal = dynamic(() => import('@/components/titling/TitlingModal'), { ssr: false })
const BeneficiaryModal = dynamic(() => import('@/components/titling/BeneficiaryModal'), { ssr: false })
const BeneficiaryGapModal = dynamic(() => import('@/components/titling/BeneficiaryGapModal'), { ssr: false })

const PREREQ_BANNER_STORAGE_KEY = 'titling-family-prerequisite-banner-dismissed'

type TitlingClientProps = {
  householdId: string | null
  initialAssets: Asset[]
  initialRealEstate: RealEstateItem[]
  initialAssetTitling: AssetTitling[]
  initialRealEstateTitling: RealEstateTitling[]
  initialBeneficiaries: Beneficiary[]
  initialInsurance: InsurancePolicyRow[]
  initialBusinesses: BusinessRow[]
  initialInsurancePolicyTitling: InsurancePolicyTitling[]
  initialBusinessTitling: BusinessTitlingRow[]
  householdPeople: HouseholdPersonRow[]
  hasSpouse: boolean
  person1LegalName: string | null
  person2LegalName: string | null
  categories: TitlingCategory[]
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function TitlingClient({
  householdId,
  initialAssets,
  initialRealEstate,
  initialAssetTitling,
  initialRealEstateTitling,
  initialBeneficiaries,
  initialInsurance,
  initialBusinesses,
  initialInsurancePolicyTitling,
  initialBusinessTitling,
  householdPeople,
  hasSpouse,
  person1LegalName,
  person2LegalName,
  categories,
}: TitlingClientProps) {
  const router = useRouter()
  const [assets, setAssets] = useState<Asset[]>(initialAssets)
  const [realEstate, setRealEstate] = useState<RealEstateItem[]>(initialRealEstate)
  const [insurance, setInsurance] = useState<InsurancePolicyRow[]>(initialInsurance)
  const [businesses, setBusinesses] = useState<BusinessRow[]>(initialBusinesses)
  const [assetTitling, setAssetTitling] = useState<AssetTitling[]>(initialAssetTitling)
  const [realEstateTitling, setRealEstateTitling] = useState<RealEstateTitling[]>(initialRealEstateTitling)
  const [insurancePolicyTitling, setInsurancePolicyTitling] = useState<InsurancePolicyTitling[]>(initialInsurancePolicyTitling)
  const [businessTitling, setBusinessTitling] = useState<BusinessTitlingRow[]>(initialBusinessTitling)
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>(initialBeneficiaries)
  useEffect(() => {
    setAssets(initialAssets)
    setRealEstate(initialRealEstate)
    setInsurance(initialInsurance)
    setBusinesses(initialBusinesses)
    setAssetTitling(initialAssetTitling)
    setRealEstateTitling(initialRealEstateTitling)
    setInsurancePolicyTitling(initialInsurancePolicyTitling)
    setBusinessTitling(initialBusinessTitling)
    setBeneficiaries(initialBeneficiaries)
  }, [
    initialAssets,
    initialRealEstate,
    initialInsurance,
    initialBusinesses,
    initialAssetTitling,
    initialRealEstateTitling,
    initialInsurancePolicyTitling,
    initialBusinessTitling,
    initialBeneficiaries,
  ])
  const [activeTab, setActiveTab] = useState<string>('assets')
  const [gapModalOpen, setGapModalOpen] = useState(false)
  const [prereqBannerDismissed, setPrereqBannerDismissed] = useState(false)

  const beneficiaryPicklistOptions = useMemo(
    () => buildBeneficiaryPicklist(person1LegalName, person2LegalName, hasSpouse, householdPeople),
    [person1LegalName, person2LegalName, hasSpouse, householdPeople],
  )

  const assetTitlingOptions = useMemo(
    () => buildAssetTitlingOptions(person1LegalName, person2LegalName),
    [person1LegalName, person2LegalName],
  )

  const descendantsOrdered = useMemo(() => orderedDescendants(householdPeople), [householdPeople])

  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage.getItem(PREREQ_BANNER_STORAGE_KEY) === '1') {
        const timeoutId = window.setTimeout(() => setPrereqBannerDismissed(true), 0)
        return () => window.clearTimeout(timeoutId)
      }
    } catch {
      /* ignore */
    }
  }, [])

  // Modal state
  const [titlingModal, setTitlingModal] = useState<{
    kind: TitlingKind
    id: string
    name: string
    existing: AnyTitling | null
    asset: Asset | null
    entityRow: RealEstateItem | InsurancePolicyRow | BusinessRow | null
  } | null>(null)

  const [beneficiaryModal, setBeneficiaryModal] = useState<{
    kind: TitlingKind
    id: string
    name: string
    existing: Beneficiary | null
    beneficiaryType: 'primary' | 'contingent'
  } | null>(null)

  const titlingLookups = useMemo(
    () =>
      buildTitlingLookups({
        assetTitling,
        realEstateTitling,
        insurancePolicyTitling,
        businessTitling,
        beneficiaries,
      }),
    [assetTitling, realEstateTitling, insurancePolicyTitling, businessTitling, beneficiaries],
  )
  const { getTitling: getTitlingFor, getBeneficiaries: getBeneficiariesFor } = titlingLookups

  const warnings = useMemo(
    () =>
      getTitlingWarnings({
        assets,
        realEstate,
        insurance,
        businesses,
        assetTitling,
        realEstateTitling,
        insurancePolicyTitling,
        businessTitling,
        beneficiaries,
      }),
    [
      assets,
      realEstate,
      insurance,
      businesses,
      assetTitling,
      realEstateTitling,
      insurancePolicyTitling,
      businessTitling,
      beneficiaries,
    ],
  )

  const p1First = useMemo(
    () => displayPersonFirstName(person1LegalName, 'Person 1'),
    [person1LegalName],
  )
  const p2First = useMemo(() => displayPersonFirstName(person2LegalName), [person2LegalName])

  const assetOwnerGroups = useMemo(
    () => groupRowsByOwnerBucket(assets, p1First, p2First, 'assets'),
    [assets, p1First, p2First],
  )
  const insuranceOwnerGroups = useMemo(
    () => groupRowsByOwnerBucket(insurance, p1First, p2First, 'insurance'),
    [insurance, p1First, p2First],
  )

  async function refreshTitlingData() {
    router.refresh()
    await refreshConflicts()
  }

  async function handleDeleteBeneficiary(id: string) {
    const res = await fetch('/api/consumer/asset-beneficiaries', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    if (!res.ok) return
    await refreshTitlingData()
  }

  const incompleteBeneficiaryItems: GapItem[] = useMemo(() => {
    const out: GapItem[] = []
    const pushIfIncomplete = (kind: TitlingKind, id: string, name: string, subtitle: string, owner: string | null) => {
      const t = getTitlingFor(kind, id)
      if (titlingExemptFromBeneficiaryGap(t)) return
      const hasPrimary = getBeneficiariesFor(kind, id, 'primary').length > 0
      const hasContingent = getBeneficiariesFor(kind, id, 'contingent').length > 0
      if (hasPrimary && hasContingent) return
      out.push({
        kind,
        id,
        name,
        subtitle,
        owner,
        needsPrimary: !hasPrimary,
        needsContingent: !hasContingent,
      })
    }
    for (const a of assets) {
      pushIfIncomplete('asset', a.id, a.name, a.type.replace(/_/g, ' '), a.owner)
    }
    for (const r of realEstate) {
      pushIfIncomplete('re', r.id, r.name, r.property_type.replace(/_/g, ' '), r.owner)
    }
    for (const pol of insurance) {
      const displayName = pol.policy_name?.trim() || 'Insurance policy'
      const sub = (pol.insurance_type ?? 'policy').replace(/_/g, ' ')
      pushIfIncomplete('insurance', pol.id, displayName, sub, null)
    }
    for (const biz of businesses) {
      pushIfIncomplete('business', biz.id, biz.name, (biz.entity_type ?? 'entity').replace(/_/g, ' '), null)
    }
    return out
  }, [assets, realEstate, insurance, businesses, titlingLookups])

  async function refreshConflicts() {
    try {
      await fetch('/api/estate/refresh-conflicts', { method: 'POST' })
    } catch {
      /* non-fatal */
    }
  }

  // Build tabs dynamically from DB categories
  const WIRED = ['assets', 'real_estate', 'insurance', 'business']
  const tabCounts: Record<string, number> = {
    assets: assets.length,
    real_estate: realEstate.length,
    insurance: insurance.length,
    business: businesses.length,
  }
  const tabs = categories.map(c => ({
    key: c.value,
    label: c.label,
    icon: c.icon,
    count: tabCounts[c.value] ?? null,
    wired: WIRED.includes(c.value),
  }))

  return (
    <div className="mx-auto max-w-7xl px-4 py-12">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[color:var(--mwm-navy)]">Titling & Beneficiaries</h1>
        <p className="mt-1 text-sm text-neutral-600">
          How each asset is titled and who inherits it. Affects estate distribution and probate.
        </p>
      </div>

      {householdPeople.length === 0 && !prereqBannerDismissed && (
        <PrerequisiteFamilyBanner
          onDismiss={() => {
            try {
              window.localStorage.setItem(PREREQ_BANNER_STORAGE_KEY, '1')
            } catch {
              /* ignore */
            }
            setPrereqBannerDismissed(true)
          }}
        />
      )}

      {incompleteBeneficiaryItems.length > 0 && (
        <div className="mb-6 rounded-xl border border-[color:var(--mwm-border)] bg-[var(--mwm-gold-pale)]/80 px-4 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-medium text-[color:var(--mwm-navy)]">
            {incompleteBeneficiaryItems.length} assets are missing beneficiary assignments
          </p>
          <button
            type="button"
            onClick={() => setGapModalOpen(true)}
            className="shrink-0 rounded-lg bg-[var(--mwm-navy-light)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--mwm-navy)] transition"
          >
            Review &amp; Apply Defaults →
          </button>
        </div>
      )}

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
                activeTab === tab.key ? 'bg-[color:var(--mwm-navy)] text-white' : 'bg-neutral-100 text-neutral-500'
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
        <>
          {assets.length === 0 ? (
            <EmptyState icon="🏦" message="No assets found" sub="Add assets on the Assets page first" href="/assets" />
          ) : (
            assetOwnerGroups.map(group => (
              <CollapsibleSection
                key={group.id}
                title={group.title}
                defaultOpen={group.id === 'person1'}
                storageKey={group.storageKey}
              >
                <VirtualTitlingCardList
                  items={group.rows}
                  getItemKey={(asset) => asset.id}
                  renderItem={(asset) => (
                    <AssetTitlingCard
                      name={asset.name}
                      subtitle={asset.type.replace(/_/g, ' ')}
                      value={asset.value}
                      ownerLabel={titlingFinancialOwnerLabel(asset.owner, p1First, p2First)}
                      titling={getTitlingFor('asset', asset.id)}
                      primaryBens={getBeneficiariesFor('asset', asset.id, 'primary')}
                      contingentBens={getBeneficiariesFor('asset', asset.id, 'contingent')}
                      onEditTitling={() => setTitlingModal({
                        kind: 'asset', id: asset.id, name: asset.name,
                        existing: getTitlingFor('asset', asset.id) as AssetTitling | null,
                        asset,
                        entityRow: null,
                      })}
                      onAddBeneficiary={(type) => setBeneficiaryModal({
                        kind: 'asset', id: asset.id, name: asset.name, existing: null, beneficiaryType: type,
                      })}
                      onEditBeneficiary={(ben) => setBeneficiaryModal({
                        kind: 'asset', id: asset.id, name: asset.name, existing: ben, beneficiaryType: ben.beneficiary_type,
                      })}
                      onDeleteBeneficiary={handleDeleteBeneficiary}
                    />
                  )}
                />
              </CollapsibleSection>
            ))
          )}
        </>
      )}

      {/* Real Estate tab */}
      {activeTab === 'real_estate' && (
        <CollapsibleSection
          title="Real Estate"
          defaultOpen={true}
          storageKey="titling-real-estate"
        >
          <div className="space-y-4">
          {realEstate.length === 0 ? (
            <EmptyState icon="🏠" message="No properties found" sub="Add properties on the Real Estate page first" href="/real-estate" />
          ) : (
            <VirtualTitlingCardList
              items={realEstate}
              getItemKey={(re) => re.id}
              renderItem={(re) => (
                <AssetTitlingCard
                  name={re.name}
                  subtitle={re.property_type.replace(/_/g, ' ')}
                  value={re.current_value}
                  ownerLabel={ownerLabel(
                    re.owner,
                    displayPersonFirstName(person1LegalName, 'Person 1'),
                    displayPersonFirstName(person2LegalName),
                  )}
                  titling={getTitlingFor('re', re.id)}
                  primaryBens={getBeneficiariesFor('re', re.id, 'primary')}
                  contingentBens={getBeneficiariesFor('re', re.id, 'contingent')}
                  onEditTitling={() => setTitlingModal({
                    kind: 're', id: re.id, name: re.name,
                    existing: getTitlingFor('re', re.id) as RealEstateTitling | null,
                    asset: null,
                    entityRow: re,
                  })}
                  onAddBeneficiary={(type) => setBeneficiaryModal({
                    kind: 're', id: re.id, name: re.name, existing: null, beneficiaryType: type,
                  })}
                  onEditBeneficiary={(ben) => setBeneficiaryModal({
                    kind: 're', id: re.id, name: re.name, existing: ben, beneficiaryType: ben.beneficiary_type,
                  })}
                  onDeleteBeneficiary={handleDeleteBeneficiary}
                />
              )}
            />
          )}
          </div>
        </CollapsibleSection>
      )}

      {/* Insurance tab */}
      {activeTab === 'insurance' && (
        <>
          {insurance.length === 0 ? (
            <EmptyState icon="🛡️" message="No insurance policies found" sub="Add life, annuity, LTC, or disability coverage on the Insurance page first" href="/insurance" />
          ) : (
            insuranceOwnerGroups.map(group => (
              <CollapsibleSection
                key={group.id}
                title={group.title}
                defaultOpen={group.id === 'person1'}
                storageKey={group.storageKey}
              >
                <VirtualTitlingCardList
                  items={group.rows}
                  getItemKey={(pol) => pol.id}
                  renderItem={(pol) => {
                    const displayName = pol.policy_name?.trim() || 'Insurance policy'
                    const sub = (pol.insurance_type ?? 'policy').replace(/_/g, ' ')
                    return (
                      <AssetTitlingCard
                        name={displayName}
                        subtitle={sub}
                        value={pol.death_benefit ?? 0}
                        ownerLabel={titlingFinancialOwnerLabel(pol.owner, p1First, p2First)}
                        titling={getTitlingFor('insurance', pol.id)}
                        primaryBens={getBeneficiariesFor('insurance', pol.id, 'primary')}
                        contingentBens={getBeneficiariesFor('insurance', pol.id, 'contingent')}
                        onEditTitling={() => setTitlingModal({
                          kind: 'insurance', id: pol.id, name: displayName,
                          existing: getTitlingFor('insurance', pol.id),
                          asset: null,
                          entityRow: pol,
                        })}
                        onAddBeneficiary={(type) => setBeneficiaryModal({
                          kind: 'insurance', id: pol.id, name: displayName, existing: null, beneficiaryType: type,
                        })}
                        onEditBeneficiary={(ben) => setBeneficiaryModal({
                          kind: 'insurance', id: pol.id, name: displayName, existing: ben, beneficiaryType: ben.beneficiary_type,
                        })}
                        onDeleteBeneficiary={handleDeleteBeneficiary}
                      />
                    )
                  }}
                />
              </CollapsibleSection>
            ))
          )}
        </>
      )}

      {/* Business tab */}
      {activeTab === 'business' && (
        <CollapsibleSection
          title="Business Interests"
          defaultOpen={true}
          storageKey="titling-business-interests"
        >
          <div className="space-y-4">
          {businesses.length === 0 ? (
            <EmptyState icon="🏢" message="No business interests found" sub="Add closely-held interests on the Businesses page first" href="/businesses" />
          ) : (
            <VirtualTitlingCardList
              items={businesses}
              getItemKey={(biz) => biz.id}
              renderItem={(biz) => (
                <AssetTitlingCard
                  name={biz.name}
                  subtitle={(biz.entity_type ?? 'entity').replace(/_/g, ' ')}
                  value={biz.estimated_value ?? 0}
                  ownerLabel="—"
                  titling={getTitlingFor('business', biz.id)}
                  primaryBens={getBeneficiariesFor('business', biz.id, 'primary')}
                  contingentBens={getBeneficiariesFor('business', biz.id, 'contingent')}
                  onEditTitling={() => setTitlingModal({
                    kind: 'business', id: biz.id, name: biz.name,
                    existing: getTitlingFor('business', biz.id),
                    asset: null,
                    entityRow: biz,
                  })}
                  onAddBeneficiary={(type) => setBeneficiaryModal({
                    kind: 'business', id: biz.id, name: biz.name, existing: null, beneficiaryType: type,
                  })}
                  onEditBeneficiary={(ben) => setBeneficiaryModal({
                    kind: 'business', id: biz.id, name: biz.name, existing: ben, beneficiaryType: ben.beneficiary_type,
                  })}
                  onDeleteBeneficiary={handleDeleteBeneficiary}
                />
              )}
            />
          )}
          </div>
        </CollapsibleSection>
      )}

      {/* Titling Modal */}
      {titlingModal && (
        <TitlingModal
          kind={titlingModal.kind}
          id={titlingModal.id}
          name={titlingModal.name}
          existing={titlingModal.existing}
          asset={titlingModal.asset}
          entityRow={titlingModal.entityRow}
          titlingOptions={assetTitlingOptions}
          onClose={() => setTitlingModal(null)}
          onSave={async () => { await refreshTitlingData(); setTitlingModal(null) }}
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
            beneficiaryMatchesEntity(beneficiaryModal.kind, beneficiaryModal.id, b) &&
            b.id !== beneficiaryModal.existing?.id
          )}
          picklistOptions={beneficiaryPicklistOptions}
          householdPeopleEmpty={householdPeople.length === 0}
          onClose={() => setBeneficiaryModal(null)}
          onSave={async () => {
            await refreshTitlingData()
            setBeneficiaryModal(null)
          }}
        />
      )}

      {gapModalOpen && (
        <BeneficiaryGapModal
          items={incompleteBeneficiaryItems}
          picklistOptions={beneficiaryPicklistOptions}
          beneficiaries={beneficiaries}
          householdPeople={householdPeople}
          hasSpouse={hasSpouse}
          person1LegalName={person1LegalName}
          person2LegalName={person2LegalName}
          descendantsOrdered={descendantsOrdered}
          onClose={() => setGapModalOpen(false)}
          onApplied={async () => {
            await refreshTitlingData()
            setGapModalOpen(false)
          }}
        />
      )}
    </div>
  )
}

// ─── Prerequisite banner (My Family) ──────────────────────────────────────────

function PrerequisiteFamilyBanner({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="mb-6 flex items-start justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-3">
      <div>
        <p className="text-sm font-medium text-amber-950">
          For accurate beneficiary assignments, add your family members first.
        </p>
        <Link href="/my-family" className="mt-1 inline-block text-sm font-medium text-[color:var(--mwm-navy)] hover:underline">
          Go to My Family →
        </Link>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="text-lg leading-none text-neutral-400 hover:text-neutral-600"
        aria-label="Dismiss"
      >
        ✕
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
      <a href={href} className="mt-3 text-sm text-[color:var(--mwm-navy)] hover:underline">Go there →</a>
    </div>
  )
}
