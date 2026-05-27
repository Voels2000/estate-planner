'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

type Props = {
  initial: {
    succession_plan_in_place: boolean | null
    succession_key_person_identified: boolean | null
    succession_buy_sell_in_place: boolean | null
  }
}

function triState(value: boolean | null): 'yes' | 'no' | '' {
  if (value === true) return 'yes'
  if (value === false) return 'no'
  return ''
}

export default function BusinessSuccessionClient({ initial }: Props) {
  const router = useRouter()
  const [planInPlace, setPlanInPlace] = useState(triState(initial.succession_plan_in_place))
  const [keyPerson, setKeyPerson] = useState(triState(initial.succession_key_person_identified))
  const [buySell, setBuySell] = useState(triState(initial.succession_buy_sell_in_place))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!planInPlace || !keyPerson || !buySell) {
      setError('Please answer all three questions.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/consumer/succession-intake', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          succession_plan_in_place: planInPlace === 'yes',
          succession_key_person_identified: keyPerson === 'yes',
          succession_buy_sell_in_place: buySell === 'yes',
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Failed to save')
      }
      setSaved(true)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const showConflict = planInPlace === 'no'

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[color:var(--mwm-navy)]">Business Succession</h1>
        <p className="mt-1 text-sm text-gray-600">
          A quick check on continuity planning for your business interests. Add detail on{' '}
          <Link href="/businesses" className="font-medium text-blue-700 underline-offset-2 hover:underline">
            Business Interests
          </Link>{' '}
          anytime.
        </p>
      </div>

      {showConflict && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-semibold">No documented succession plan</p>
          <p className="mt-1 text-amber-800">
            Business owners without a succession plan often face valuation discounts, key-person risk, and
            family conflict at transition. Consider documenting at least a high-level plan with your advisor
            or attorney.
          </p>
        </div>
      )}

      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-gray-900">
              Do you have a documented business succession plan?
            </legend>
            <div className="flex gap-4">
              {(['yes', 'no'] as const).map((v) => (
                <label key={v} className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="radio"
                    name="plan"
                    value={v}
                    checked={planInPlace === v}
                    onChange={() => setPlanInPlace(v)}
                  />
                  {v === 'yes' ? 'Yes' : 'No'}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-gray-900">
              Have you identified key-person dependency (someone the business relies on)?
            </legend>
            <div className="flex gap-4">
              {(['yes', 'no'] as const).map((v) => (
                <label key={v} className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="radio"
                    name="keyPerson"
                    value={v}
                    checked={keyPerson === v}
                    onChange={() => setKeyPerson(v)}
                  />
                  {v === 'yes' ? 'Yes' : 'No'}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-gray-900">
              Is a buy-sell agreement (or equivalent) in place?
            </legend>
            <div className="flex gap-4">
              {(['yes', 'no'] as const).map((v) => (
                <label key={v} className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="radio"
                    name="buySell"
                    value={v}
                    checked={buySell === v}
                    onChange={() => setBuySell(v)}
                  />
                  {v === 'yes' ? 'Yes' : 'No'}
                </label>
              ))}
            </div>
          </fieldset>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {saved && <p className="text-sm text-[color:var(--mwm-sage)]">Saved.</p>}

          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save answers'}
          </Button>
        </form>
      </Card>

    </div>
  )
}
