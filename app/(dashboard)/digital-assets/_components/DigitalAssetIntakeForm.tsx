// Sprint 63 - Consumer intake form for all 5 digital asset types
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { DigitalAssetType } from '@/lib/types/beneficiary-grant'

const ASSET_TYPES: { value: DigitalAssetType; label: string; description: string }[] = [
  { value: 'crypto', label: 'Cryptocurrency', description: 'Bitcoin, Ethereum, other tokens' },
  { value: 'nft', label: 'NFT / Digital Collectible', description: 'Non-fungible tokens, digital art' },
  { value: 'online_account', label: 'Online Account', description: 'Bank, brokerage, email, social media' },
  { value: 'domain', label: 'Domain Name', description: 'Registered web domains' },
  { value: 'digital_media', label: 'Digital Media', description: 'Streaming subscriptions, purchased media' },
]

interface Props {
  householdId: string
  userId: string
  onSaved?: () => void
}

const BLANK = {
  asset_type: 'crypto' as DigitalAssetType,
  platform: '',
  description: '',
  estimated_value: '',
  wallet_address: '',
  account_username: '',
  storage_location: '',
  access_instructions: '',
  executor_grantee_email: '',
  executor_notes: '',
}

export default function DigitalAssetIntakeForm({ householdId, userId, onSaved }: Props) {
  const [form, setForm] = useState(BLANK)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  function update(field: keyof typeof BLANK, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMessage(null)

    const supabase = createClient()
    const { error } = await supabase.from('digital_assets').insert({
      household_id: householdId,
      owner_id: userId,
      asset_type: form.asset_type,
      platform: form.platform,
      description: form.description,
      estimated_value: form.estimated_value ? Number(form.estimated_value) : null,
      wallet_address: form.wallet_address || null,
      account_username: form.account_username || null,
      storage_location: form.storage_location || null,
      access_instructions: form.access_instructions || null,
      executor_grantee_email: form.executor_grantee_email || null,
      executor_notes: form.executor_notes || null,
    })

    setSaving(false)

    if (error) {
      setMessage({ type: 'error', text: error.message })
    } else {
      setMessage({ type: 'success', text: 'Digital asset saved.' })
      setForm(BLANK)
      onSaved?.()
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border shadow-sm p-6 space-y-5">
      <h2 className="text-lg font-semibold text-gray-900">Add Digital Asset</h2>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Asset Type</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {ASSET_TYPES.map((type) => (
            <button
              key={type.value}
              type="button"
              onClick={() => update('asset_type', type.value)}
              className={`text-left rounded-lg border p-3 transition-colors ${
                form.asset_type === type.value
                  ? 'border-blue-600 bg-blue-50 text-blue-800'
                  : 'border-gray-200 hover:border-gray-300 text-gray-700'
              }`}
            >
              <p className="text-sm font-medium">{type.label}</p>
              <p className="text-xs text-gray-500 mt-0.5">{type.description}</p>
            </button>
          ))}
        </div>
      </div>

      <Field label="Platform / Institution" required>
        <input
          required
          value={form.platform}
          onChange={(e) => update('platform', e.target.value)}
          placeholder={
            form.asset_type === 'crypto' ? 'e.g. Coinbase, Ledger wallet' : 'e.g. Chase, Gmail, GoDaddy'
          }
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </Field>

      <Field label="Description">
        <textarea
          rows={2}
          value={form.description}
          onChange={(e) => update('description', e.target.value)}
          placeholder="Brief description of the asset"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </Field>

      <Field label="Estimated Value (USD)">
        <input
          type="number"
          min="0"
          step="1"
          value={form.estimated_value}
          onChange={(e) => update('estimated_value', e.target.value)}
          placeholder="0"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </Field>

      {form.asset_type === 'crypto' && (
        <Field label="Wallet Address / Identifier">
          <input
            value={form.wallet_address}
            onChange={(e) => update('wallet_address', e.target.value)}
            placeholder="0x... or xpub..."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </Field>
      )}

      {(form.asset_type === 'online_account' || form.asset_type === 'domain') && (
        <Field label="Username / Account ID">
          <input
            value={form.account_username}
            onChange={(e) => update('account_username', e.target.value)}
            placeholder="Username or account number"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </Field>
      )}

      <Field label="Where are credentials stored?">
        <input
          value={form.storage_location}
          onChange={(e) => update('storage_location', e.target.value)}
          placeholder="e.g. LastPass vault, hardware wallet in home safe"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </Field>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-3">
        <p className="text-sm font-medium text-amber-900">Digital Executor Designation (optional)</p>
        <Field label="Executor Email">
          <input
            type="email"
            value={form.executor_grantee_email}
            onChange={(e) => update('executor_grantee_email', e.target.value)}
            placeholder="executor@example.com"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </Field>
        <Field label="Instructions for Executor">
          <textarea
            rows={2}
            value={form.executor_notes}
            onChange={(e) => update('executor_notes', e.target.value)}
            placeholder="What should they do with this asset?"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </Field>
      </div>

      {message && (
        <div
          className={`rounded-lg px-4 py-3 text-sm ${
            message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
          }`}
        >
          {message.text}
        </div>
      )}

      <button
        type="submit"
        disabled={saving}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-medium py-2.5 px-4 rounded-lg transition-colors"
      >
        {saving ? 'Saving...' : 'Save Digital Asset'}
      </button>
    </form>
  )
}

function Field({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}
