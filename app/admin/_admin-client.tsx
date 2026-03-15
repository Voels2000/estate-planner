'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

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
}

type Tab = 'overview' | 'users' | 'usage' | 'feedback' | 'settings'

export function AdminClient({
  totalUsers, newToday, newThisWeek, newThisMonth,
  activeSubscriptions, consumerCount, advisorCount, mrr,
  assetCount, incomeCount, expenseCount, projectionCount,
  profiles, feedback, appConfig,
}: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [feedbackFilter, setFeedbackFilter] = useState<string>('all')
  const [configValues, setConfigValues] = useState<Record<string, string>>(
    Object.fromEntries(appConfig.map(c => [c.key, c.value]))
  )
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [savedKey, setSavedKey] = useState<string | null>(null)
  const [configError, setConfigError] = useState<string | null>(null)

  const filteredFeedback = feedbackFilter === 'all'
    ? feedback
    : feedback.filter(f => f.type === feedbackFilter)

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
    { key: 'overview', label: 'Overview', icon: '📊' },
    { key: 'users', label: 'Users', icon: '👥' },
    { key: 'usage', label: 'Usage', icon: '📈' },
    { key: 'feedback', label: 'Feedback', icon: '💬' },
    { key: 'settings', label: 'Settings', icon: '⚙️' },
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

      <div className="flex gap-1 border-b border-neutral-200 mb-8">
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

      {/* Overview */}
      {activeTab === 'overview' && (
        <div className="space-y-8">
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400 mb-4">User Growth</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label="Total Users" value={String(totalUsers)} icon="👥" />
              <StatCard label="New Today" value={String(newToday)} icon="🆕" />
              <StatCard label="New This Week" value={String(newThisWeek)} icon="📅" />
              <StatCard label="New This Month" value={String(newThisMonth)} icon="📆" />
            </div>
          </section>
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400 mb-4">Revenue</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label="Est. MRR" value={`$${mrr.toLocaleString()}`} icon="💵" highlight="green" />
              <StatCard label="Active Subscriptions" value={String(activeSubscriptions)} icon="✅" />
              <StatCard label="Consumer Plan" value={String(consumerCount)} icon="👤" />
              <StatCard label="Advisor Plan" value={String(advisorCount)} icon="🏦" />
            </div>
          </section>
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400 mb-4">Product Usage</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label="Assets Added" value={String(assetCount)} icon="🏦" />
              <StatCard label="Income Sources" value={String(incomeCount)} icon="💰" />
              <StatCard label="Expenses Added" value={String(expenseCount)} icon="💸" />
              <StatCard label="Projections Run" value={String(projectionCount)} icon="📈" />
            </div>
          </section>
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400 mb-4">Recent Feedback</h2>
            {feedback.length === 0 ? (
              <EmptyState icon="💬" message="No feedback yet" />
            ) : (
              <div className="space-y-3">
                {feedback.slice(0, 5).map(f => <FeedbackCard key={f.id} feedback={f} profiles={profiles} />)}
                {feedback.length > 5 && (
                  <button onClick={() => setActiveTab('feedback')} className="text-sm text-indigo-600 hover:underline">
                    View all {feedback.length} feedback items →
                  </button>
                )}
              </div>
            )}
          </section>
        </div>
      )}

      {/* Users */}
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
              {profiles.map(profile => (
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

      {/* Usage */}
      {activeTab === 'usage' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Total Assets" value={String(assetCount)} icon="🏦" />
            <StatCard label="Income Sources" value={String(incomeCount)} icon="💰" />
            <StatCard label="Expenses" value={String(expenseCount)} icon="💸" />
            <StatCard label="Projections" value={String(projectionCount)} icon="📈" />
          </div>
          <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-6">
            <h3 className="text-sm font-semibold text-neutral-900 mb-4">Average per User</h3>
            <div className="space-y-3">
              <UsageBar label="Assets per user" value={totalUsers > 0 ? assetCount / totalUsers : 0} max={10} />
              <UsageBar label="Income sources per user" value={totalUsers > 0 ? incomeCount / totalUsers : 0} max={10} />
              <UsageBar label="Expenses per user" value={totalUsers > 0 ? expenseCount / totalUsers : 0} max={10} />
              <UsageBar label="Projections per user" value={totalUsers > 0 ? projectionCount / totalUsers : 0} max={5} />
            </div>
          </div>
        </div>
      )}

      {/* Feedback */}
      {activeTab === 'feedback' && (
        <div className="space-y-4">
          <div className="flex gap-2">
            {['all', 'bug', 'suggestion', 'general'].map(f => (
              <button key={f} onClick={() => setFeedbackFilter(f)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition capitalize ${
                  feedbackFilter === f ? 'bg-neutral-900 text-white' : 'bg-white border border-neutral-200 text-neutral-600 hover:border-neutral-300'
                }`}>
                {f === 'all' ? `All (${feedback.length})` : f}
              </button>
            ))}
          </div>
          {filteredFeedback.length === 0
            ? <EmptyState icon="💬" message="No feedback yet" />
            : <div className="space-y-3">{filteredFeedback.map(f => <FeedbackCard key={f.id} feedback={f} profiles={profiles} />)}</div>
          }
        </div>
      )}

      {/* Settings */}
      {activeTab === 'settings' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-6">
            <h2 className="text-base font-semibold text-neutral-900 mb-1">App Configuration</h2>
            <p className="text-sm text-neutral-500 mb-6">Changes take effect immediately for new sessions.</p>

            {configError && (
              <p className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{configError}</p>
            )}

            <div className="space-y-6">
              {appConfig.map(config => {
                const meta = CONFIG_LABELS[config.key]
                return (
                  <div key={config.key} className="flex items-start justify-between gap-6 pb-6 border-b border-neutral-100 last:border-0 last:pb-0">
                    <div className="flex-1">
                      <label className="block text-sm font-semibold text-neutral-800">
                        {meta?.label ?? config.key}
                      </label>
                      {meta?.description && (
                        <p className="text-xs text-neutral-500 mt-0.5">{meta.description}</p>
                      )}
                      <p className="text-xs text-neutral-400 mt-1">
                        Last updated: {new Date(config.updated_at).toLocaleDateString('en-US', {
                          month: 'short', day: 'numeric', year: 'numeric',
                          hour: 'numeric', minute: '2-digit'
                        })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <input
                        type={meta?.type ?? 'text'}
                        value={configValues[config.key] ?? config.value}
                        onChange={(e) => setConfigValues(prev => ({ ...prev, [config.key]: e.target.value }))}
                        className="w-24 rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 text-center focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500"
                      />
                      {config.key === 'trial_duration_minutes' && (
                        <span className="text-xs text-neutral-400">minutes</span>
                      )}
                      <button
                        onClick={() => handleSaveConfig(config.key)}
                        disabled={savingKey === config.key}
                        className="rounded-lg bg-neutral-900 px-3 py-2 text-xs font-medium text-white hover:bg-neutral-800 disabled:opacity-50 transition"
                      >
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
          {new Date(feedback.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
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
