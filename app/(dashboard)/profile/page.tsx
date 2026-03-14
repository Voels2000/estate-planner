'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const RISK_OPTIONS = ['Conservative', 'Moderate', 'Aggressive']

export default function ProfilePage() {
  const router = useRouter()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [currentAge, setCurrentAge] = useState('')
  const [retirementAge, setRetirementAge] = useState('')
  const [riskTolerance, setRiskTolerance] = useState('Moderate')
  const [dependents, setDependents] = useState('')
  const [maritalStatus, setMaritalStatus] = useState('Single')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }

      const { error: upsertError } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          full_name: fullName,
          email,
          phone,
          current_age: parseInt(currentAge),
          retirement_age: parseInt(retirementAge),
          risk_tolerance: riskTolerance,
          dependents: parseInt(dependents) || 0,
          marital_status: maritalStatus,
          updated_at: new Date().toISOString(),
        })

      if (upsertError) throw upsertError

      router.push('/dashboard')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
      setIsSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-neutral-900">Your Profile</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Complete your profile to get personalized estate and retirement planning.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 bg-white rounded-2xl border border-neutral-200 p-8 shadow-sm">
        {/* Personal Info */}
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500 mb-4">
            Personal Information
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Full Name</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="block w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500"
                placeholder="Jane Doe"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="block w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Phone</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="block w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500"
                placeholder="(555) 000-0000"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Marital Status</label>
              <select
                value={maritalStatus}
                onChange={(e) => setMaritalStatus(e.target.value)}
                className="block w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500"
              >
                {['Single', 'Married', 'Divorced', 'Widowed'].map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Number of Dependents</label>
              <input
                type="number"
                min="0"
                value={dependents}
                onChange={(e) => setDependents(e.target.value)}
                className="block w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500"
                placeholder="0"
              />
            </div>
          </div>
        </div>

        {/* Retirement Info */}
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500 mb-4">
            Retirement Planning
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Current Age</label>
              <input
                type="number"
                min="18"
                max="100"
                required
                value={currentAge}
                onChange={(e) => setCurrentAge(e.target.value)}
                className="block w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500"
                placeholder="45"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Target Retirement Age</label>
              <input
                type="number"
                min="40"
                max="100"
                required
                value={retirementAge}
                onChange={(e) => setRetirementAge(e.target.value)}
                className="block w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500"
                placeholder="65"
              />
            </div>
          </div>
        </div>

        {/* Risk Tolerance */}
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500 mb-4">
            Risk Tolerance
          </h2>
          <div className="grid grid-cols-3 gap-3">
            {RISK_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setRiskTolerance(option)}
                className={`rounded-lg border px-4 py-3 text-sm font-medium transition ${
                  riskTolerance === option
                    ? 'border-neutral-900 bg-neutral-900 text-white'
                    : 'border-neutral-300 bg-white text-neutral-700 hover:border-neutral-400'
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-lg bg-neutral-900 px-4 py-3 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {isSubmitting ? 'Saving...' : 'Save Profile'}
        </button>
      </form>
    </div>
  )
}
