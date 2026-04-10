'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { RefOption } from '@/lib/ref-data-fetchers'

/** Matches `real_estate` table columns */
export type RealEstate = {
  id: string
  owner_id: string
  name: string
  property_type: 'primary_residence' | 'rental' | 'vacation' | 'commercial'
  current_value: number
  purchase_price: number | null
  purchase_year: number | null
  mortgage_balance: number
  monthly_payment: number | null
  interest_rate: number | null
  planned_sale_year: number | null
  selling_costs_pct: number | null
  is_primary_residence: boolean
  years_lived_in: number | null
  owner: string
  titling?: string | null
  situs_state?: string | null
  created_at: string
  updated_at: string
}

const PROPERTY_TYPE_LABELS: Record<RealEstate['property_type'], string> = {
  primary_residence: 'Primary residence',
  rental: 'Rental',
  vacation: 'Vacation',
  commercial: 'Commercial',
}

const US_STATES = [
  { value: 'AL', label: 'Alabama' }, { value: 'AK', label: 'Alaska' }, { value: 'AZ', label: 'Arizona' }, { value: 'AR', label: 'Arkansas' },
  { value: 'CA', label: 'California' }, { value: 'CO', label: 'Colorado' }, { value: 'CT', label: 'Connecticut' }, { value: 'DE', label: 'Delaware' },
  { value: 'FL', label: 'Florida' }, { value: 'GA', label: 'Georgia' }, { value: 'HI', label: 'Hawaii' }, { value: 'ID', label: 'Idaho' },
  { value: 'IL', label: 'Illinois' }, { value: 'IN', label: 'Indiana' }, { value: 'IA', label: 'Iowa' }, { value: 'KS', label: 'Kansas' },
  { value: 'KY', label: 'Kentucky' }, { value: 'LA', label: 'Louisiana' }, { value: 'ME', label: 'Maine' }, { value: 'MD', label: 'Maryland' },
  { value: 'MA', label: 'Massachusetts' }, { value: 'MI', label: 'Michigan' }, { value: 'MN', label: 'Minnesota' }, { value: 'MS', label: 'Mississippi' },
  { value: 'MO', label: 'Missouri' }, { value: 'MT', label: 'Montana' }, { value: 'NE', label: 'Nebraska' }, { value: 'NV', label: 'Nevada' },
  { value: 'NH', label: 'New Hampshire' }, { value: 'NJ', label: 'New Jersey' }, { value: 'NM', label: 'New Mexico' }, { value: 'NY', label: 'New York' },
  { value: 'NC', label: 'North Carolina' }, { value: 'ND', label: 'North Dakota' }, { value: 'OH', label: 'Ohio' }, { value: 'OK', label: 'Oklahoma' },
  { value: 'OR', label: 'Oregon' }, { value: 'PA', label: 'Pennsylvania' }, { value: 'RI', label: 'Rhode Island' }, { value: 'SC', label: 'South Carolina' },
  { value: 'SD', label: 'South Dakota' }, { value: 'TN', label: 'Tennessee' }, { value: 'TX', label: 'Texas' }, { value: 'UT', label: 'Utah' },
  { value: 'VT', label: 'Vermont' }, { value: 'VA', label: 'Virginia' }, { value: 'WA', label: 'Washington' }, { value: 'WV', label: 'West Virginia' },
  { value: 'WI', label: 'Wisconsin' }, { value: 'WY', label: 'Wyoming' }, { value: 'DC', label: 'District of Columbia' },
]

const inputClass =
  'block w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500'

function SummaryCard({
  label,
  value,
  sub,
  highlight,
}: {
  label: string
  value: string
  sub?: string
  highlight?: 'green' | 'red' | 'amber'
}) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white px-4 py-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">{label}</p>
      <p
        className={`mt-1 text-xl font-bold ${
          highlight === 'green'
            ? 'text-green-600'
            : highlight === 'red'
              ? 'text-red-600'
              : highlight === 'amber'
                ? 'text-amber-600'
                : 'text-neutral-900'
        }`}
      >
        {value}
      </p>
      {sub && <p className="text-xs text-neutral-400 mt-0.5">{sub}</p>}
    </div>
  )
}

function num(v: unknown): number {
  if (typeof v === 'number' && !Number.isNaN(v)) return v
  if (typeof v === 'string' && v !== '') return Number(v) || 0
  return 0
}

function equity(row: RealEstate): number {
  return Math.max(0, num(row.current_value) - num(row.mortgage_balance))
}

/** Net cash after sale: value minus selling costs minus mortgage payoff */
function netProceedsAfterSale(row: RealEstate): number {
  const value = num(row.current_value)
  const mortgage = num(row.mortgage_balance)
  const pct = row.selling_costs_pct != null ? num(row.selling_costs_pct) : 6
  const costs = value * (pct / 100)
  return Math.max(0, value - costs - mortgage)
}

/**
 * Section 121 capital gain exclusion.
 * $500,000 for married filing jointly (mfj / qw), $250,000 for all others.
 * Requires is_primary_residence and at least 2 of last 5 years lived in.
 */
function section121Exclusion(row: RealEstate, filingStatus: string): number {
  if (!row.is_primary_residence) return 0
  const yearsLived = num(row.years_lived_in)
  if (yearsLived < 2) return 0
  // mfj and qualifying widow(er) get the full $500K exclusion
  const isMfj = filingStatus === 'mfj' || filingStatus === 'qw' ||
                filingStatus === 'married_filing_jointly' || filingStatus === 'married_joint'
  return isMfj ? 500_000 : 250_000
}

/**
 * Estimated taxable gain after Section 121 exclusion.
 * Gain = current value - purchase price - selling costs.
 * Taxable gain = max(0, gain - exclusion).
 */
function taxableGain(row: RealEstate, filingStatus: string): number {
  const value = num(row.current_value)
  const basis = row.purchase_price != null ? num(row.purchase_price) : value
  const pct = row.selling_costs_pct != null ? num(row.selling_costs_pct) : 6
  const costs = value * (pct / 100)
  const totalGain = Math.max(0, value - basis - costs)
  const exclusion = section121Exclusion(row, filingStatus)
  return Math.max(0, totalGain - exclusion)
}

function formatDollars(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

type RealEstateClientProps = {
  initialProperties: RealEstate[]
  person1Name: string
  person2Name: string
  /** Filing status short code from households table: mfj | mfs | hoh | qw | single */
  filingStatus: string
  titlingTypes: RefOption[]
}

export default function RealEstateClient({
  initialProperties,
  person1Name,
  person2Name,
  filingStatus,
  titlingTypes,
}: RealEstateClientProps) {
  const router = useRouter()
  const [rows, setRows] = useState<RealEstate[]>(initialProperties)
  const [showModal, setShowModal] = useState(false)
  const [editRow, setEditRow] = useState<RealEstate | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Section 121 exclusion amount label for display
  const isMfj = filingStatus === 'mfj' || filingStatus === 'qw' ||
                filingStatus === 'married_filing_jointly' || filingStatus === 'married_joint'
  const exclusionAmount = isMfj ? 500_000 : 250_000

  async function loadData() {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return
    const { data, error: fetchError } = await supabase
      .from('real_estate')
      .select('*')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false })
    if (fetchError) setError(fetchError.message)
    else setRows((data as RealEstate[]) ?? [])
  }

  async function handleDelete(id: string) {
    const supabase = createClient()
    const { error } = await supabase.from('real_estate').delete().eq('id', id)
    if (error) setError(error.message)
    else setRows((prev) => prev.filter((r) => r.id !== id))
    setConfirmDeleteId(null)
  }

  function ownerLabel(owner: string) {
    if (owner === 'person2') return person2Name
    if (owner === 'joint') return 'Joint'
    return person1Name
  }

  const totalValue = rows.reduce((s, r) => s + num(r.current_value), 0)
  const totalEquity = rows.reduce((s, r) => s + equity(r), 0)
  const totalNetProceeds = rows.reduce((s, r) => s + netProceedsAfterSale(r), 0)

  // Primary residences that qualify for Section 121
  const primaryResidences = rows.filter(r => r.is_primary_residence && num(r.years_lived_in) >= 2)

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Real Estate</h1>
          <p className="mt-1 text-sm text-neutral-600">
            Properties and estimated sale proceeds after costs.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditRow(null)
            setShowModal(true)
          }}
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 transition"
        >
          + Add Property
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <SummaryCard label="Total value" value={formatDollars(totalValue)} sub="Current estimated value" />
        <SummaryCard label="Total equity" value={formatDollars(totalEquity)} sub="Value − mortgage" />
        <SummaryCard
          label="Est. net proceeds"
          value={formatDollars(totalNetProceeds)}
          sub="After selling costs & payoff"
          highlight="green"
        />
      </div>

      {/* Section 121 info banner */}
      {primaryResidences.length > 0 && (
        <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50/40 px-4 py-3 flex items-start gap-3">
          <span className="text-blue-500 mt-0.5">ℹ️</span>
          <div>
            <p className="text-sm font-medium text-blue-800">Section 121 Exclusion</p>
            <p className="text-xs text-blue-600 mt-0.5">
              Based on your <strong>{isMfj ? 'Married Filing Jointly' : 'Single / Other'}</strong> filing status,
              your primary residence exclusion is{' '}
              <strong>{formatDollars(exclusionAmount)}</strong>.
              {' '}You must have lived in the home 2 of the last 5 years to qualify.
            </p>
          </div>
        </div>
      )}

      {error && (
        <p className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</p>
      )}

      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-300 bg-white py-16 text-center">
          <div className="text-4xl mb-3">🏠</div>
          <p className="text-sm font-medium text-neutral-600">No properties yet</p>
          <p className="text-xs text-neutral-400 mt-1">Add your first property to track equity and sale plans</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => {
            const excl = section121Exclusion(row, filingStatus)
            const gain = taxableGain(row, filingStatus)
            return (
              <div key={row.id} className="bg-white rounded-2xl border border-neutral-200 p-5 shadow-sm">
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <h3 className="text-sm font-semibold text-neutral-900 truncate">{row.name}</h3>
                      <span className="text-xs text-neutral-500">
                        {PROPERTY_TYPE_LABELS[row.property_type] ?? row.property_type}
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2">
                      <p className="text-sm text-neutral-600">
                        <span className="text-neutral-500">Value:</span>{' '}
                        <span className="font-medium text-neutral-900">{formatDollars(num(row.current_value))}</span>
                      </p>
                      <p className="text-sm text-neutral-600">
                        <span className="text-neutral-500">Mortgage:</span>{' '}
                        <span className="font-medium text-neutral-900">{formatDollars(num(row.mortgage_balance))}</span>
                      </p>
                      <p className="text-sm text-neutral-600">
                        <span className="text-neutral-500">Equity:</span>{' '}
                        <span className="font-medium text-neutral-900">{formatDollars(equity(row))}</span>
                      </p>
                      <p className="text-sm text-neutral-600">
                        <span className="text-neutral-500">Sec. 121 Excl.:</span>{' '}
                        {excl > 0 ? (
                          <span className="font-medium text-green-600">{formatDollars(excl)}</span>
                        ) : (
                          <span className="text-neutral-400">—</span>
                        )}
                      </p>
                      <p className="text-sm text-neutral-600">
                        <span className="text-neutral-500">Est. Taxable Gain:</span>{' '}
                        {row.purchase_price != null ? (
                          gain > 0 ? (
                            <span className="font-medium text-amber-600">{formatDollars(gain)}</span>
                          ) : (
                            <span className="font-medium text-green-600">$0 (fully excluded)</span>
                          )
                        ) : (
                          <span className="text-neutral-400">—</span>
                        )}
                      </p>
                      <p className="text-sm text-neutral-600">
                        <span className="text-neutral-500">Sale year:</span>{' '}
                        <span className="font-medium text-neutral-900">
                          {row.planned_sale_year != null ? row.planned_sale_year : '—'}
                        </span>
                      </p>
                      <p className="text-sm text-neutral-600">
                        <span className="text-neutral-500">Owner:</span>{' '}
                        <span className="font-medium text-neutral-900">{ownerLabel(row.owner ?? 'person1')}</span>
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex gap-3 mt-3 pt-3 border-t border-neutral-100">
                  {confirmDeleteId === row.id ? (
                    <>
                      <span className="text-xs text-neutral-500 font-medium">Delete?</span>
                      <button
                        type="button"
                        onClick={() => handleDelete(row.id)}
                        className="text-xs text-red-600 hover:underline font-medium"
                      >
                        Yes
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="text-xs text-neutral-500 hover:underline font-medium"
                      >
                        No
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setEditRow(row)
                          setShowModal(true)
                        }}
                        className="text-xs text-indigo-600 hover:underline font-medium"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(row.id)}
                        className="text-xs text-red-500 hover:underline font-medium"
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showModal && (
        <RealEstateModal
          editRow={editRow}
          person1Name={person1Name}
          person2Name={person2Name}
          titlingTypes={titlingTypes}
          onClose={() => {
            setShowModal(false)
            setEditRow(null)
          }}
          onSave={() => {
            setShowModal(false)
            setEditRow(null)
            void loadData()
            router.refresh()
          }}
        />
      )}
    </div>
  )
}

function RealEstateModal({
  editRow,
  person1Name,
  person2Name,
  titlingTypes,
  onClose,
  onSave,
}: {
  editRow: RealEstate | null
  person1Name: string
  person2Name: string
  titlingTypes: RefOption[]
  onClose: () => void
  onSave: () => void
}) {
  const currentYear = new Date().getFullYear()
  const [name, setName] = useState(editRow?.name ?? '')
  const [propertyType, setPropertyType] = useState<RealEstate['property_type']>(
    editRow?.property_type ?? 'primary_residence',
  )
  const [currentValue, setCurrentValue] = useState(editRow?.current_value?.toString() ?? '')
  const [purchasePrice, setPurchasePrice] = useState(editRow?.purchase_price?.toString() ?? '')
  const [purchaseYear, setPurchaseYear] = useState(editRow?.purchase_year?.toString() ?? '')
  const [mortgageBalance, setMortgageBalance] = useState(
    editRow != null ? String(editRow.mortgage_balance ?? 0) : '0',
  )
  const [monthlyPayment, setMonthlyPayment] = useState(editRow?.monthly_payment?.toString() ?? '')
  const [interestRate, setInterestRate] = useState(editRow?.interest_rate?.toString() ?? '')
  const [plannedSaleYear, setPlannedSaleYear] = useState(editRow?.planned_sale_year?.toString() ?? '')
  const [sellingCostsPct, setSellingCostsPct] = useState(
    editRow?.selling_costs_pct != null ? String(editRow.selling_costs_pct) : '6',
  )
  const [isPrimaryResidence, setIsPrimaryResidence] = useState(editRow?.is_primary_residence ?? false)
  const [yearsLivedIn, setYearsLivedIn] = useState(editRow?.years_lived_in?.toString() ?? '')
  const [owner, setOwner] = useState(editRow?.owner ?? 'person1')
  const [titling, setTitling] = useState(editRow?.titling ?? '')
  const [situsState, setSitusState] = useState(editRow?.situs_state ?? '')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    setIsSubmitting(true)

    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const payload = {
        name: name.trim(),
        property_type: propertyType,
        current_value: parseFloat(currentValue) || 0,
        purchase_price: purchasePrice === '' ? null : parseFloat(purchasePrice),
        purchase_year: purchaseYear === '' ? null : parseInt(purchaseYear, 10),
        mortgage_balance: parseFloat(mortgageBalance) || 0,
        monthly_payment: monthlyPayment === '' ? null : parseFloat(monthlyPayment),
        interest_rate: interestRate === '' ? null : parseFloat(interestRate),
        planned_sale_year: plannedSaleYear === '' ? null : parseInt(plannedSaleYear, 10),
        selling_costs_pct: sellingCostsPct === '' ? 6 : parseFloat(sellingCostsPct),
        is_primary_residence: isPrimaryResidence,
        years_lived_in: yearsLivedIn === '' ? null : parseInt(yearsLivedIn, 10),
        owner,
        titling: titling || null,
        situs_state: situsState || null,
        updated_at: new Date().toISOString(),
      }

      if (editRow) {
        const { error } = await supabase.from('real_estate').update(payload).eq('id', editRow.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('real_estate').insert({
          ...payload,
          owner_id: user.id,
        })
        if (error) throw error
      }
      onSave()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : JSON.stringify(err))
      setIsSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-lg max-h-[90vh] flex flex-col rounded-2xl bg-white shadow-2xl ring-1 ring-neutral-200">
        <div className="flex shrink-0 items-center justify-between border-b border-neutral-200 px-6 py-4">
          <h2 className="text-base font-semibold text-neutral-900">
            {editRow ? 'Edit Property' : 'Add Property'}
          </h2>
          <button type="button" onClick={onClose} className="text-neutral-400 hover:text-neutral-600">
            ✕
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4 overflow-y-auto">
          {formError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{formError}</p>
          )}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
              placeholder="e.g. Main Street home"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Property type</label>
            <select
              value={propertyType}
              onChange={(e) => setPropertyType(e.target.value as RealEstate['property_type'])}
              className={inputClass}
            >
              <option value="primary_residence">Primary residence</option>
              <option value="rental">Rental</option>
              <option value="vacation">Vacation</option>
              <option value="commercial">Commercial</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Titling / Ownership</label>
            <select value={titling} onChange={(e) => setTitling(e.target.value)} className={inputClass}>
              <option value="">Select titling...</option>
              {titlingTypes
                .filter((t) => (t.description ?? '').toLowerCase().includes('real_estate') || !(t.description ?? '').toLowerCase().includes('assets'))
                .map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
            </select>
            <p className="mt-1 text-xs text-neutral-500">
              How is this property legally titled? Critical for estate planning and probate avoidance.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">State Where Property is Located</label>
            <select value={situsState} onChange={(e) => setSitusState(e.target.value)} className={inputClass}>
              <option value="">Select state...</option>
              {US_STATES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-neutral-500">
              The state where the property is physically located. Used for state estate tax calculation.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Current value ($)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                required
                value={currentValue}
                onChange={(e) => setCurrentValue(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Purchase price ($)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={purchasePrice}
                onChange={(e) => setPurchasePrice(e.target.value)}
                className={inputClass}
                placeholder="Optional"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Purchase year</label>
            <input
              type="number"
              min="1900"
              max={currentYear + 1}
              value={purchaseYear}
              onChange={(e) => setPurchaseYear(e.target.value)}
              className={inputClass}
              placeholder="Optional"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Mortgage balance ($)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={mortgageBalance}
                onChange={(e) => setMortgageBalance(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Monthly payment ($)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={monthlyPayment}
                onChange={(e) => setMonthlyPayment(e.target.value)}
                className={inputClass}
                placeholder="Optional"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Interest rate (% annual)</label>
            <input
              type="number"
              min="0"
              max="30"
              step="0.001"
              value={interestRate}
              onChange={(e) => setInterestRate(e.target.value)}
              className={inputClass}
              placeholder="e.g. 6.5"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Planned sale year</label>
              <input
                type="number"
                min={currentYear}
                max="2100"
                value={plannedSaleYear}
                onChange={(e) => setPlannedSaleYear(e.target.value)}
                className={inputClass}
                placeholder="Optional"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Selling costs (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={sellingCostsPct}
                onChange={(e) => setSellingCostsPct(e.target.value)}
                className={inputClass}
                placeholder="6"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              id="isPrimaryResidence"
              type="checkbox"
              checked={isPrimaryResidence}
              onChange={(e) => setIsPrimaryResidence(e.target.checked)}
              className="h-4 w-4 rounded border-neutral-300"
            />
            <label htmlFor="isPrimaryResidence" className="text-sm text-neutral-700">
              Is primary residence
            </label>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Years lived in
              {isPrimaryResidence && (
                <span className="ml-1 text-xs font-normal text-blue-600">(2+ years required for Section 121)</span>
              )}
            </label>
            <input
              type="number"
              min="0"
              max="100"
              value={yearsLivedIn}
              onChange={(e) => setYearsLivedIn(e.target.value)}
              className={inputClass}
              placeholder="For Section 121 exclusion"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Owner</label>
            <select value={owner} onChange={(e) => setOwner(e.target.value)} className={inputClass}>
              <option value="person1">{person1Name}</option>
              <option value="person2">{person2Name}</option>
              <option value="joint">Joint</option>
            </select>
          </div>
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
              {isSubmitting ? 'Saving...' : editRow ? 'Save Changes' : 'Add Property'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
