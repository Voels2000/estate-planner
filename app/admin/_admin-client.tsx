'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { AdvisorTier } from '@/lib/types'
import DebugTab from './debug-tab'
import TaxRulesTab from './tax-rules-tab'
import TermsTab from './terms-tab'

type Profile = {
  id: string
  email: string
  full_name: string | null
  role: string
  subscription_status: string | null
  subscription_plan: string | null
  created_at: string
}

type Feedback = {
  id: string
  user_id: string | null
  type: string
  message: string
  page: string | null
  created_at: string
}

type AppConfig = {
  key: string
  value: string
  description: string | null
  updated_at: string
}

type CategoryItem = {
  value: string
  label: string
  sort_order: number
  is_active: boolean
}

type CategoryTable = 'asset_types' | 'liability_types' | 'income_types' | 'expense_types'

type TitlingCategory = {
  value: string
  label: string
  icon: string
  sort_order: number
  is_active: boolean
}

type Props = {
  totalUsers: number
  newToday: number
  newThisWeek: number
  newThisMonth: number
  activeSubscriptions: number
  consumerCount: number
  advisorCount: number
  mrr: number
  assetCount: number
  incomeCount: number
  expenseCount: number
  projectionCount: number
  profiles: Profile[]
  feedback: Feedback[]
  appConfig: AppConfig[]
  advisorTiers: AdvisorTier[]
  assetTypes: CategoryItem[]
  liabilityTypes: CategoryItem[]
  incomeTypes: CategoryItem[]
  expenseTypes: CategoryItem[]
  titlingCategories: TitlingCategory[]
  termsVersion:  string
  termsSections: { title: string; body: string }[]
}

type Tab = 'overview' | 'users' | 'usage' | 'feedback' | 'settings' | 'tiers' | 'categories' | 'tax_rules' | 'terms' | 'debug'

export function AdminClient({
  appConfig,
  advisorTiers,
  assetTypes: initialAssetTypes,
  liabilityTypes: initialLiabilityTypes,
  incomeTypes: initialIncomeTypes,
  expenseTypes: initialExpenseTypes,
  titlingCategories: initialTitlingCategories,
  termsVersion,
  termsSections,
  ...rest
}: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [feedbackFilter, setFeedbackFilter] = useState<string>('all')
  const [configValues, setConfigValues] = useState<Record<string, string>>(
    Object.fromEntries(appConfig.map(c => [c.key, c.value]))
  )
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [savedKey, setSavedKey] = useState<string | null>(null)
  const [configError, setConfigError] = useState<string | null>(null)

  const [tiers, setTiers] = useState<AdvisorTier[]>(advisorTiers)
  const [savingTierId, setSavingTierId] = useState<string | null>(null)
  const [savedTierId, setSavedTierId] = useState<string | null>(null)
  const [tierError, setTierError] = useState<string | null>(null)

  const [categories, setCategories] = useState<Record<CategoryTable, CategoryItem[]>>({
    asset_types: initialAssetTypes,
    liability_types: initialLiabilityTypes,
    income_types: initialIncomeTypes,
    expense_types: initialExpenseTypes,
  })
  const [savingCategory, setSavingCategory] = useState<string | null>(null)
  const [savedCategory, setSavedCategory] = useState<string | null>(null)
  const [titlingCategories, setTitlingCategories] = useState<TitlingCategory[]>(initialTitlingCategories)
  const [categoryError, setCategoryError] = useState<string | null>(null)
  const [addingTo, setAddingTo] = useState<CategoryTable | null>(null)
  const [newLabel, setNewLabel] = useState('')
  const [newValue, setNewValue] = useState('')

  function updateCategory(table: CategoryTable, value: string, field: keyof CategoryItem, newVal: string | boolean | number) {
    setCategories(prev => ({
      ...prev,
      [table]: prev[table].map(item =>
        item.value === value ? { ...item, [field]: newVal } : item
      )
    }))
  }

  async function handleSaveCategory(table: CategoryTable, item: CategoryItem) {
    const key = `${table}:${item.value}`
    setSavingCategory(key)
    setCategoryError(null)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from(table)
        .update({ label: item.label, sort_order: item.sort_order, is_active: item.is_active })
        .eq('value', item.value)
      if (error) throw error
      setSavedCategory(key)
      setTimeout(() => setSavedCategory(null), 2000)
    } catch (err) {
      setCategoryError(err instanceof Error ? err.message : 'Failed to save.')
    } finally {
      setSavingCategory(null)
    }
  }

  async function handleAddCategory(table: CategoryTable) {
    if (!newLabel.trim()) return
    const slug = newValue.trim()
      ? newValue.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
      : newLabel.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
    if (!slug) return
    setCategoryError(null)
    const maxOrder = Math.max(0, ...categories[table].map(i => i.sort_order))
    const newItem: CategoryItem = { value: slug, label: newLabel.trim(), sort_order: maxOrder + 10, is_active: true }
    try {
      const supabase = createClient()
      const { error } = await supabase.from(table).insert(newItem)
      if (error) throw error
      setCategories(prev => ({ ...prev, [table]: [...prev[table], newItem].sort((a, b) => a.sort_order - b.sort_order) }))
      setAddingTo(null)
      setNewLabel('')
      setNewValue('')
    } catch (err) {
      setCategoryError(err instanceof Error ? err.message : 'Failed to add category.')
    }
  }

  async function handleDeleteTitlingCategory(value: string) {
    setCategoryError(null)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('titling_asset_categories')
        .delete()
        .eq('value', value)
      if (error) throw error
      setTitlingCategories(prev => prev.filter(c => c.value !== value))
    } catch (err) {
      setCategoryError(err instanceof Error ? err.message : 'Failed to delete.')
    }
  }

  function updateTitlingCategory(value: string, field: keyof TitlingCategory, newVal: string | boolean | number) {
    setTitlingCategories(prev => prev.map(item =>
      item.value === value ? { ...item, [field]: newVal } : item
    ))
  }

  async function handleSaveTitlingCategory(item: TitlingCategory) {
    setCategoryError(null)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('titling_asset_categories')
        .update({ label: item.label, icon: item.icon, sort_order: item.sort_order, is_active: item.is_active })
        .eq('value', item.value)
      if (error) throw error
    } catch (err) {
      setCategoryError(err instanceof Error ? err.message : 'Failed to save.')
    }
  }

  async function handleAddTitlingCategory(label: string, value: string, icon: string) {
    if (!label.trim()) return
    const slug = value.trim()
      ? value.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
      : label.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
    if (!slug) return
    setCategoryError(null)
    const maxOrder = Math.max(0, ...titlingCategories.map(i => i.sort_order))
    const newItem: TitlingCategory = { value: slug, label: label.trim(), icon: icon.trim() || '📄', sort_order: maxOrder + 10, is_active: true }
    try {
      const supabase = createClient()
      const { error } = await supabase.from('titling_asset_categories').insert(newItem)
      if (error) throw error
      setTitlingCategories(prev => [...prev, newItem].sort((a, b) => a.sort_order - b.sort_order))
    } catch (err) {
      setCategoryError(err instanceof Error ? err.message : 'Failed to add.')
    }
  }

  function updateTier(id: string, field: keyof AdvisorTier, value: string | boolean | number | null) {
    setTiers(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t))
  }

  async function handleSaveTier(tier: AdvisorTier) {
    setSavingTierId(tier.id)
    setTierError(null)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('advisor_tiers')
        .update({ name: tier.name, price_monthly: tier.price_monthly, client_limit: tier.client_limit, is_active: tier.is_active })
        .eq('id', tier.id)
      if (error) throw error
      setSavedTierId(tier.id)
      setTimeout(() => setSavedTierId(null), 2000)
    } catch (err) {
      setTierError(err instanceof Error ? err.message : 'Failed to save.')
    } finally {
      setSavingTierId(null)
    }
  }

  const filteredFeedback = feedbackFilter === 'all'
    ? rest.feedback
    : rest.feedback.filter(f => f.type === feedbackFilter)

  async function handleSaveConfig(key: string) {
    setSavingKey(key)
    setConfigError(null)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('app_config')
        .update({ value: configValues[key], updated_at: new Date().toISOString() })
        .eq('key', key)
      if (error) throw error
      setSavedKey(key)
      setTimeout(() => setSavedKey(null), 2000)
    } catch (err) {
      setConfigError(err instanceof Error ? err.message : 'Failed to save.')
    } finally {
      setSavingKey(null)
    }
  }

  const TABS: { key: Tab; label: string; icon: string }[] = [
    { key: 'overview',   label: 'Overview',       icon: '📊' },
    { key: 'users',      label: 'Users',           icon: '👥' },
    { key: 'usage',      label: 'Usage',           icon: '📈' },
    { key: 'feedback',   label: 'Feedback',        icon: '💬' },
    { key: 'settings',   label: 'Settings',        icon: '⚙️' },
    { key: 'tiers',      label: 'Advisor Tiers',   icon: '🏷️' },
    { key: 'categories', label: 'Categories',      icon: '🗂️' },
    { key: 'tax_rules',  label: 'Tax Rules',       icon: '🏛️' },
    { key: 'terms',      label: 'T&C',             icon: '📋' },
    { key: 'debug',      label: 'Debug',           icon: '🐛' },
  ]

  const CATEGORY_SECTIONS: { table: CategoryTable; label: string; description: string }[] = [
    { table: 'asset_types',     label: 'Asset Types',         description: 'Categories shown in the asset owner dropdown.' },
    { table: 'liability_types', label: 'Liability Types',     description: 'Categories shown in the liabilities dropdown.' },
    { table: 'income_types',    label: 'Income Types',        description: 'Categories shown in the income source dropdown.' },
    { table: 'expense_types',   label: 'Expense Categories',  description: 'Categories shown in the expenses dropdown.' },
  ]

  const CONFIG_LABELS: Record<string, { label: string; description: string; type: 'number' | 'text' }> = {
    trial_duration_minutes: {
      label: 'Free Trial Duration',
      description: 'How many minutes new signups get before being asked to subscribe.',
      type: 'number',
    },
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-neutral-900">Admin Dashboard</h1>
        <p className="mt-1 text-sm text-neutral-600">Monitor your app&apos;s growth, usage and feedback</p>
      </div>

      <div className="flex gap-1 border-b border-neutral-200 mb-8 flex-wrap">
        {TABS.map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors ${
              activeTab === tab.key
                ? 'border-b-2 border-neutral-900 text-neutral-900'
                : 'text-neutral-500 hover:text-neutral-700'
            }`}>
            <span>{tab.icon}</span>{tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="space-y-8">
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400 mb-4">User Growth</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label="Total Users" value={String(rest.totalUsers)} icon="👥" />
              <StatCard label="New Today" value={String(rest.newToday)} icon="🆕" />
              <StatCard label="New This Week" value={String(rest.newThisWeek)} icon="📅" />
              <StatCard label="New This Month" value={String(rest.newThisMonth)} icon="📆" />
            </div>
          </section>
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400 mb-4">Revenue</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label="Est. MRR" value={`$${rest.mrr.toLocaleString()}`} icon="💵" highlight="green" />
              <StatCard label="Active Subscriptions" value={String(rest.activeSubscriptions)} icon="✅" />
              <StatCard label="Consumer Plan" value={String(rest.consumerCount)} icon="👤" />
              <StatCard label="Advisor Plan" value={String(rest.advisorCount)} icon="🏦" />
            </div>
          </section>
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400 mb-4">Product Usage</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label="Assets Added" value={String(rest.assetCount)} icon="🏦" />
              <StatCard label="Income Sources" value={String(rest.incomeCount)} icon="💰" />
              <StatCard label="Expenses Added" value={String(rest.expenseCount)} icon="💸" />
              <StatCard label="Projections Run" value={String(rest.projectionCount)} icon="📈" />
            </div>
          </section>
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400 mb-4">Recent Feedback</h2>
            {rest.feedback.length === 0 ? (
              <EmptyState icon="💬" message="No feedback yet" />
            ) : (
              <div className="space-y-3">
                {rest.feedback.slice(0, 5).map(f => <FeedbackCard key={f.id} feedback={f} profiles={rest.profiles} />)}
                {rest.feedback.length > 5 && (
                  <button onClick={() => setActiveTab('feedback')} className="text-sm text-indigo-600 hover:underline">
                    View all {rest.feedback.length} feedback items →
                  </button>
                )}
              </div>
            )}
          </section>
        </div>
      )}

      {activeTab === 'users' && (
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
          <table className="min-w-full divide-y divide-neutral-100">
            <thead className="bg-neutral-50">
              <tr>
                {['Name', 'Email', 'Role', 'Plan', 'Status', 'Joined'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {rest.profiles.map(profile => (
                <tr key={profile.id} className="hover:bg-neutral-50">
                  <td className="px-4 py-3 text-sm font-medium text-neutral-900">{profile.full_name ?? '—'}</td>
                  <td className="px-4 py-3 text-sm text-neutral-500">{profile.email}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      profile.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                      profile.role === 'advisor' ? 'bg-blue-100 text-blue-700' :
                      'bg-neutral-100 text-neutral-600'
                    }`}>{profile.role}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-neutral-500 capitalize">{profile.subscription_plan ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      profile.subscription_status === 'active' ? 'bg-green-100 text-green-700' :
                      profile.subscription_status === 'trialing' ? 'bg-yellow-100 text-yellow-700' :
                      profile.subscription_status === 'canceled' ? 'bg-red-100 text-red-700' :
                      'bg-neutral-100 text-neutral-600'
                    }`}>{profile.subscription_status ?? 'none'}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-neutral-500">
                    {new Date(profile.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'usage' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Total Assets" value={String(rest.assetCount)} icon="🏦" />
            <StatCard label="Income Sources" value={String(rest.incomeCount)} icon="💰" />
            <StatCard label="Expenses" value={String(rest.expenseCount)} icon="💸" />
            <StatCard label="Projections" value={String(rest.projectionCount)} icon="📈" />
          </div>
          <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-6">
            <h3 className="text-sm font-semibold text-neutral-900 mb-4">Average per User</h3>
            <div className="space-y-3">
              <UsageBar label="Assets per user" value={rest.totalUsers > 0 ? rest.assetCount / rest.totalUsers : 0} max={10} />
              <UsageBar label="Income sources per user" value={rest.totalUsers > 0 ? rest.incomeCount / rest.totalUsers : 0} max={10} />
              <UsageBar label="Expenses per user" value={rest.totalUsers > 0 ? rest.expenseCount / rest.totalUsers : 0} max={10} />
              <UsageBar label="Projections per user" value={rest.totalUsers > 0 ? rest.projectionCount / rest.totalUsers : 0} max={5} />
            </div>
          </div>
        </div>
      )}

      {activeTab === 'feedback' && (
        <div className="space-y-4">
          <div className="flex gap-2">
            {['all', 'bug', 'suggestion', 'general'].map(f => (
              <button key={f} onClick={() => setFeedbackFilter(f)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition capitalize ${
                  feedbackFilter === f ? 'bg-neutral-900 text-white' : 'bg-white border border-neutral-200 text-neutral-600 hover:border-neutral-300'
                }`}>
                {f === 'all' ? `All (${rest.feedback.length})` : f}
              </button>
            ))}
          </div>
          {filteredFeedback.length === 0
            ? <EmptyState icon="💬" message="No feedback yet" />
            : <div className="space-y-3">{filteredFeedback.map(f => <FeedbackCard key={f.id} feedback={f} profiles={rest.profiles} />)}</div>
          }
        </div>
      )}

      {activeTab === 'tiers' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-6">
            <h2 className="text-base font-semibold text-neutral-900 mb-1">Advisor Tiers</h2>
            <p className="text-sm text-neutral-500 mb-6">Edit tier names, prices, client limits and active status. Stripe price IDs are read-only.</p>
            {tierError && <p className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{tierError}</p>}
            <div className="space-y-4">
              {[...tiers].sort((a, b) => a.display_order - b.display_order).map(tier => (
                <div key={tier.id} className="rounded-xl border border-neutral-200 p-4 space-y-3">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-neutral-500 mb-1">Name</label>
                      <input type="text" value={tier.name} onChange={e => updateTier(tier.id, 'name', e.target.value)} className={inputClass} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-500 mb-1">Price ($/month)</label>
                      <input type="number" value={tier.price_monthly} onChange={e => updateTier(tier.id, 'price_monthly', Number(e.target.value))} className={inputClass} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-500 mb-1">Client Limit (blank = unlimited)</label>
                      <input type="number" value={tier.client_limit ?? ''} onChange={e => updateTier(tier.id, 'client_limit', e.target.value === '' ? null : Number(e.target.value))} className={inputClass} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-500 mb-1">Active</label>
                      <select value={tier.is_active ? 'true' : 'false'} onChange={e => updateTier(tier.id, 'is_active', e.target.value === 'true')} className={inputClass}>
                        <option value="true">Active</option>
                        <option value="false">Inactive</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-neutral-400 font-mono">{tier.stripe_price_id}</p>
                    <button onClick={() => handleSaveTier(tier)} disabled={savingTierId === tier.id}
                      className="rounded-lg bg-neutral-900 px-4 py-2 text-xs font-medium text-white hover:bg-neutral-800 disabled:opacity-50 transition">
                      {savingTierId === tier.id ? 'Saving…' : savedTierId === tier.id ? '✓ Saved' : 'Save'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {tiers.length === 0 && <p className="mt-4 text-sm text-neutral-500">No advisor tiers configured.</p>}
          </div>
        </div>
      )}

      {activeTab === 'categories' && (
        <div className="space-y-8">
          {categoryError && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{categoryError}</p>}
          {CATEGORY_SECTIONS.map(({ table, label, description }) => (
            <div key={table} className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-6">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-base font-semibold text-neutral-900">{label}</h2>
                <button onClick={() => { setAddingTo(table); setNewLabel(''); setNewValue('') }}
                  className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-800 transition">
                  + Add
                </button>
              </div>
              <p className="text-sm text-neutral-500 mb-5">{description}</p>
              {addingTo === table && (
                <div className="mb-4 rounded-xl border border-indigo-200 bg-indigo-50 p-4">
                  <p className="text-xs font-semibold text-indigo-700 mb-3">New Category</p>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="block text-xs font-medium text-neutral-600 mb-1">Display Label</label>
                      <input type="text" placeholder="e.g. Real Estate" value={newLabel}
                        onChange={e => setNewLabel(e.target.value)} className={inputClass} autoFocus />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-600 mb-1">Value / Slug (auto-generated)</label>
                      <input type="text" placeholder="e.g. real_estate"
                        value={newValue || newLabel.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')}
                        onChange={e => setNewValue(e.target.value)} className={inputClass} />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleAddCategory(table)}
                      className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700 transition">
                      Add Category
                    </button>
                    <button onClick={() => setAddingTo(null)}
                      className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-xs font-medium text-neutral-600 hover:bg-neutral-50 transition">
                      Cancel
                    </button>
                  </div>
                </div>
              )}
              <div className="space-y-2">
                {[...categories[table]].sort((a, b) => a.sort_order - b.sort_order).map(item => {
                  const key = `${table}:${item.value}`
                  return (
                    <div key={item.value} className="rounded-xl border border-neutral-200 p-3">
                      <div className="grid grid-cols-12 gap-3 items-center">
                        <div className="col-span-4">
                          <label className="block text-xs font-medium text-neutral-500 mb-1">Label</label>
                          <input type="text" value={item.label}
                            onChange={e => updateCategory(table, item.value, 'label', e.target.value)} className={inputClass} />
                        </div>
                        <div className="col-span-3">
                          <label className="block text-xs font-medium text-neutral-500 mb-1">Value (slug)</label>
                          <p className="text-sm font-mono text-neutral-400 py-2 px-1">{item.value}</p>
                        </div>
                        <div className="col-span-2">
                          <label className="block text-xs font-medium text-neutral-500 mb-1">Sort Order</label>
                          <input type="number" value={item.sort_order}
                            onChange={e => updateCategory(table, item.value, 'sort_order', Number(e.target.value))} className={inputClass} />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-xs font-medium text-neutral-500 mb-1">Active</label>
                          <select value={item.is_active ? 'true' : 'false'}
                            onChange={e => updateCategory(table, item.value, 'is_active', e.target.value === 'true')} className={inputClass}>
                            <option value="true">Active</option>
                            <option value="false">Inactive</option>
                          </select>
                        </div>
                        <div className="col-span-1 pt-5">
                          <button onClick={() => handleSaveCategory(table, item)} disabled={savingCategory === key}
                            className="w-full rounded-lg bg-neutral-900 px-2 py-2 text-xs font-medium text-white hover:bg-neutral-800 disabled:opacity-50 transition">
                            {savingCategory === key ? '…' : savedCategory === key ? '✓' : 'Save'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
                {categories[table].length === 0 && (
                  <p className="text-sm text-neutral-400 py-4 text-center">No categories yet. Add one above.</p>
                )}
              </div>
            </div>
          ))}

          {/* Titling Asset Categories */}
          <TitlingCategoriesSection
            categories={titlingCategories}
            error={categoryError}
            onUpdate={updateTitlingCategory}
            onSave={handleSaveTitlingCategory}
            onAdd={handleAddTitlingCategory}
            onDelete={handleDeleteTitlingCategory}
          />
        </div>
      )}

      {activeTab === 'tax_rules' && <TaxRulesTab />}

      {activeTab === 'terms' && (
        <TermsTab
          initialVersion={termsVersion}
          initialSections={termsSections}
        />
      )}
      {activeTab === 'debug' && <DebugTab profiles={rest.profiles} />}

      {activeTab === 'settings' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-6">
            <h2 className="text-base font-semibold text-neutral-900 mb-1">App Configuration</h2>
            <p className="text-sm text-neutral-500 mb-6">Changes take effect immediately for new sessions.</p>
            {configError && <p className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{configError}</p>}
            <div className="space-y-6">
              {appConfig.map(config => {
                const meta = CONFIG_LABELS[config.key]
                return (
                  <div key={config.key} className="flex items-start justify-between gap-6 pb-6 border-b border-neutral-100 last:border-0 last:pb-0">
                    <div className="flex-1">
                      <label className="block text-sm font-semibold text-neutral-800">{meta?.label ?? config.key}</label>
                      {meta?.description && <p className="text-xs text-neutral-500 mt-0.5">{meta.description}</p>}
                      <p className="text-xs text-neutral-400 mt-1">
                        Last updated: {new Date(config.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <input type={meta?.type ?? 'text'} value={configValues[config.key] ?? config.value}
                        onChange={(e) => setConfigValues(prev => ({ ...prev, [config.key]: e.target.value }))}
                        className="w-24 rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 text-center focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500" />
                      {config.key === 'trial_duration_minutes' && <span className="text-xs text-neutral-400">minutes</span>}
                      <button onClick={() => handleSaveConfig(config.key)} disabled={savingKey === config.key}
                        className="rounded-lg bg-neutral-900 px-3 py-2 text-xs font-medium text-white hover:bg-neutral-800 disabled:opacity-50 transition">
                        {savingKey === config.key ? 'Saving…' : savedKey === config.key ? '✓ Saved' : 'Save'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const inputClass = "block w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500"

function StatCard({ label, value, icon, highlight }: { label: string; value: string; icon: string; highlight?: 'green' }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white px-4 py-4 shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-lg">{icon}</span>
        <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">{label}</p>
      </div>
      <p className={`text-2xl font-bold ${highlight === 'green' ? 'text-green-600' : 'text-neutral-900'}`}>{value}</p>
    </div>
  )
}

function UsageBar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = Math.min((value / max) * 100, 100)
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-neutral-600">{label}</span>
        <span className="font-semibold text-neutral-900">{value.toFixed(1)}</span>
      </div>
      <div className="w-full bg-neutral-100 rounded-full h-2">
        <div className="bg-neutral-900 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function FeedbackCard({ feedback, profiles }: { feedback: Feedback; profiles: Profile[] }) {
  const user = profiles.find(p => p.id === feedback.user_id)
  const typeColors: Record<string, string> = {
    bug: 'bg-red-100 text-red-700',
    suggestion: 'bg-blue-100 text-blue-700',
    general: 'bg-neutral-100 text-neutral-600',
  }
  return (
    <div className="bg-white rounded-xl border border-neutral-200 shadow-sm p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${typeColors[feedback.type] ?? typeColors.general}`}>
          {feedback.type}
        </span>
        {feedback.page && <span className="text-xs text-neutral-400">on {feedback.page}</span>}
      </div>
      <p className="text-sm text-neutral-800">{feedback.message}</p>
      <div className="flex items-center gap-3 mt-2">
        <span className="text-xs text-neutral-400">{user ? (user.full_name ?? user.email) : 'Anonymous'}</span>
        <span className="text-xs text-neutral-300">•</span>
        <span className="text-xs text-neutral-400">
          {new Date(feedback.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </span>
      </div>
    </div>
  )
}

function EmptyState({ icon, message }: { icon: string; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-300 bg-white py-16 text-center">
      <div className="text-4xl mb-3">{icon}</div>
      <p className="text-sm font-medium text-neutral-600">{message}</p>
    </div>
  )
}

// ─── Titling Categories Section ───────────────────────────────────────────────

function TitlingCategoriesSection({
  categories, error, onUpdate, onSave, onAdd, onDelete,
}: {
  categories: TitlingCategory[]
  error: string | null
  onUpdate: (value: string, field: keyof TitlingCategory, newVal: string | boolean | number) => void
  onSave: (item: TitlingCategory) => void
  onAdd: (label: string, value: string, icon: string) => void
  onDelete: (value: string) => void
}) {
  const [adding, setAdding] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [newValue, setNewValue] = useState('')
  const [newIcon, setNewIcon] = useState('📄')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const iClass = 'block w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500'

  return (
    <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-6">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-base font-semibold text-neutral-900">Titling Asset Categories</h2>
        <button
          onClick={() => { setAdding(true); setNewLabel(''); setNewValue(''); setNewIcon('📄') }}
          className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-800 transition">
          + Add
        </button>
      </div>
      <p className="text-sm text-neutral-500 mb-5">
        Categories shown as tabs on the Titling page. Add new asset classes here and they appear automatically.
      </p>
      {error && <p className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</p>}
      {adding && (
        <div className="mb-4 rounded-xl border border-indigo-200 bg-indigo-50 p-4">
          <p className="text-xs font-semibold text-indigo-700 mb-3">New Category</p>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">Display Label</label>
              <input type="text" placeholder="e.g. Insurance" value={newLabel}
                onChange={e => setNewLabel(e.target.value)} className={iClass} autoFocus />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">Value / Slug</label>
              <input type="text" placeholder="e.g. insurance"
                value={newValue || newLabel.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')}
                onChange={e => setNewValue(e.target.value)} className={iClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">Icon (emoji)</label>
              <input type="text" placeholder="📄" value={newIcon}
                onChange={e => setNewIcon(e.target.value)} className={iClass} />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                if (!newLabel.trim()) return
                onAdd(newLabel, newValue, newIcon)
                setAdding(false)
                setNewLabel('')
                setNewValue('')
                setNewIcon('📄')
              }}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700 transition">
              Add Category
            </button>
            <button
              onClick={() => setAdding(false)}
              className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-xs font-medium text-neutral-600 hover:bg-neutral-50 transition">
              Cancel
            </button>
          </div>
        </div>
      )}
      {/* Column headers */}
      {categories.length > 0 && (
        <div className="grid grid-cols-[2rem_1fr_1fr_1fr_5rem_4rem] gap-3 px-4 mb-1">
          <div />
          <p className="text-xs font-medium text-neutral-400">Label</p>
          <p className="text-xs font-medium text-neutral-400">Icon</p>
          <p className="text-xs font-medium text-neutral-400">Sort Order</p>
          <p className="text-xs font-medium text-neutral-400">Active</p>
          <div />
        </div>
      )}
      <div className="space-y-2">
        {categories.map(item => (
          <div key={item.value} className="flex items-center gap-3 rounded-xl border border-neutral-100 bg-neutral-50 px-4 py-3">
            <span className="text-xl w-8 text-center">{item.icon}</span>
            <div className="flex-1 grid grid-cols-3 gap-3">
              <input type="text" value={item.label}
                onChange={e => onUpdate(item.value, 'label', e.target.value)}
                className={iClass} />
              <input type="text" value={item.icon} placeholder="emoji"
                onChange={e => onUpdate(item.value, 'icon', e.target.value)}
                className={iClass} />
              <input type="number" value={isNaN(item.sort_order) ? '' : item.sort_order}
                onChange={e => onUpdate(item.value, 'sort_order', parseInt(e.target.value) || 0)}
                className={iClass} />
            </div>
            <label className="flex items-center gap-1.5 text-xs text-neutral-500 whitespace-nowrap">
              <input type="checkbox" checked={item.is_active}
                onChange={e => onUpdate(item.value, 'is_active', e.target.checked)}
                className="h-4 w-4 rounded border-neutral-300" />
              Active
            </label>
            {confirmDelete === item.value ? (
              <span className="inline-flex items-center gap-1 text-xs whitespace-nowrap">
                <button onClick={() => { onDelete(item.value); setConfirmDelete(null) }}
                  className="text-red-600 font-medium hover:text-red-800">Yes</button>
                <span className="text-neutral-300">|</span>
                <button onClick={() => setConfirmDelete(null)}
                  className="text-neutral-4 hover:text-neutral-600">No</button>
              </span>
            ) : (
              <span className="inline-flex items-center gap-2 whitespace-nowrap">
                <button onClick={() => onSave(item)}
                  className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-800 transition">
                  Save
                </button>
                <button onClick={() => setConfirmDelete(item.value)}
                  className="text-xs text-red-500 font-medium hover:text-red-700">
                  Delete
                </button>
              </span>
            )}
          </div>
        ))}
        {categories.length === 0 && (
          <p className="text-sm text-neutral-400 py-4 text-center">No categories yet.</p>
        )}
      </div>
    </div>
  )
}
