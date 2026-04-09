// Sprint 63 - Advisor panel to manage beneficiary access grants
'use client'

import { useState, useEffect, useTransition } from 'react'
import {
  createBeneficiaryGrant,
  revokeBeneficiaryGrant,
  getGrantsForHousehold,
} from '@/app/actions/beneficiary-grant-actions'
import type {
  BeneficiaryAccessGrant,
  BeneficiaryRelationship,
  AccessLevel,
} from '@/lib/types/beneficiary-grant'

const RELATIONSHIP_OPTIONS: BeneficiaryRelationship[] = [
  'child',
  'grandchild',
  'spouse',
  'domestic_partner',
  'sibling',
  'trustee',
  'executor',
  'other',
]

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? 'https://estate-planner-gules.vercel.app'

interface Props {
  householdId: string
  initialGrants: BeneficiaryAccessGrant[]
}

export default function BeneficiaryGrantPanel({ householdId, initialGrants }: Props) {
  const [grants, setGrants] = useState<BeneficiaryAccessGrant[]>(initialGrants)
  const [showForm, setShowForm] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [form, setForm] = useState({
    grantee_email: '',
    grantee_name: '',
    relationship: 'child' as BeneficiaryRelationship,
    access_level: 'view' as AccessLevel,
    expires_days: '365',
  })
  const [formMsg, setFormMsg] = useState<string | null>(null)
  const [reloadTick, setReloadTick] = useState(0)

  useEffect(() => {
    setGrants(initialGrants)
  }, [initialGrants])

  useEffect(() => {
    if (reloadTick === 0) return
    let active = true
    getGrantsForHousehold(householdId).then((data) => {
      if (active) setGrants(data)
    })
    return () => {
      active = false
    }
  }, [householdId, reloadTick])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setFormMsg(null)

    const expiresAt = form.expires_days
      ? new Date(Date.now() + Number(form.expires_days) * 86_400_000).toISOString()
      : null

    startTransition(async () => {
      const result = await createBeneficiaryGrant({
        household_id: householdId,
        grantee_email: form.grantee_email,
        grantee_name: form.grantee_name,
        relationship: form.relationship,
        access_level: form.access_level,
        expires_at: expiresAt,
      })

      if (result.success) {
        setFormMsg('Grant created and invitation email sent.')
        setShowForm(false)
        setForm({
          grantee_email: '',
          grantee_name: '',
          relationship: 'child',
          access_level: 'view',
          expires_days: '365',
        })
        setReloadTick((v) => v + 1)
      } else {
        setFormMsg(result.error ?? 'Failed to create grant.')
      }
    })
  }

  async function handleRevoke(grantId: string, granteeName: string) {
    if (
      !confirm(
        `Revoke access for ${granteeName}? They will no longer be able to view the estate plan.`
      )
    )
      return
    startTransition(async () => {
      await revokeBeneficiaryGrant(grantId)
      setReloadTick((v) => v + 1)
    })
  }

  const activeGrants = grants.filter(
    (g) => !g.revoked_at && (!g.expires_at || new Date(g.expires_at) > new Date())
  )
  const expiredGrants = grants.filter(
    (g) => g.revoked_at || (g.expires_at && new Date(g.expires_at) <= new Date())
  )

  return (
    <div className="bg-white rounded-xl border shadow-sm p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Beneficiary Access Grants</h2>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors"
        >
          + Grant Access
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="border rounded-lg p-4 space-y-3 bg-gray-50">
          <h3 className="text-sm font-semibold text-gray-800">New Beneficiary Grant</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Name *</label>
              <input
                required
                value={form.grantee_name}
                onChange={(e) => setForm((f) => ({ ...f, grantee_name: e.target.value }))}
                placeholder="Jane Johnson"
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Email *</label>
              <input
                required
                type="email"
                value={form.grantee_email}
                onChange={(e) => setForm((f) => ({ ...f, grantee_email: e.target.value }))}
                placeholder="jane@example.com"
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Relationship *
              </label>
              <select
                value={form.relationship}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    relationship: e.target.value as BeneficiaryRelationship,
                  }))
                }
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              >
                {RELATIONSHIP_OPTIONS.map((r) => (
                  <option key={r} value={r}>
                    {r.replace('_', ' ')}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Access Level</label>
              <select
                value={form.access_level}
                onChange={(e) =>
                  setForm((f) => ({ ...f, access_level: e.target.value as AccessLevel }))
                }
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              >
                <option value="view">View only</option>
                <option value="full">Full (includes digital assets)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Expires in (days)
              </label>
              <input
                type="number"
                min="1"
                value={form.expires_days}
                onChange={(e) => setForm((f) => ({ ...f, expires_days: e.target.value }))}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              />
            </div>
          </div>

          {formMsg && (
            <p className="text-sm text-gray-600 bg-white border rounded px-3 py-2">{formMsg}</p>
          )}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isPending}
              className="bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-60"
            >
              {isPending ? 'Sending...' : 'Create & Send Invite'}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="text-sm text-gray-600 px-4 py-2 rounded-lg border hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {activeGrants.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Active</h3>
          <div className="space-y-2">
            {activeGrants.map((grant) => (
              <GrantRow
                key={grant.id}
                grant={grant}
                onRevoke={() => handleRevoke(grant.id, grant.grantee_name)}
                isPending={isPending}
              />
            ))}
          </div>
        </div>
      )}

      {activeGrants.length === 0 && !showForm && (
        <p className="text-sm text-gray-500">
          No active grants. Click &quot;+ Grant Access&quot; to share the estate plan with a
          beneficiary.
        </p>
      )}

      {expiredGrants.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
            Expired / Revoked
          </h3>
          <div className="space-y-2">
            {expiredGrants.map((grant) => (
              <GrantRow key={grant.id} grant={grant} expired />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function GrantRow({
  grant,
  onRevoke,
  isPending,
  expired = false,
}: {
  grant: BeneficiaryAccessGrant
  onRevoke?: () => void
  isPending?: boolean
  expired?: boolean
}) {
  const viewUrl = `${APP_URL}/beneficiary/${grant.token}`

  return (
    <div
      className={`flex items-center justify-between rounded-lg border px-4 py-3 text-sm ${
        expired ? 'opacity-50 bg-gray-50' : 'bg-white'
      }`}
    >
      <div className="min-w-0">
        <p className="font-medium text-gray-900 truncate">{grant.grantee_name}</p>
        <p className="text-gray-500 text-xs truncate">
          {grant.grantee_email} · <span className="capitalize">{grant.relationship}</span> ·{' '}
          {grant.access_level}
        </p>
        {grant.expires_at && !expired && (
          <p className="text-xs text-amber-600 mt-0.5">
            Expires {new Date(grant.expires_at).toLocaleDateString()}
          </p>
        )}
        {grant.revoked_at && (
          <p className="text-xs text-red-500 mt-0.5">
            Revoked {new Date(grant.revoked_at).toLocaleDateString()}
          </p>
        )}
      </div>
      {!expired && onRevoke && (
        <div className="flex items-center gap-2 ml-4 shrink-0">
          <button
            onClick={() => navigator.clipboard.writeText(viewUrl)}
            className="text-xs text-blue-600 hover:underline"
          >
            Copy link
          </button>
          <button
            onClick={onRevoke}
            disabled={isPending}
            className="text-xs text-red-600 hover:underline disabled:opacity-40"
          >
            Revoke
          </button>
        </div>
      )}
    </div>
  )
}
