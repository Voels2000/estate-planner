'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { DisclaimerBanner } from '@/lib/components/DisclaimerBanner'

type Answer = 'yes' | 'no' | null

const QUESTIONS = [
  {
    key: 'has_will' as const,
    question: 'Do you have a current will?',
    description: 'A will directs how your assets are distributed after your death.',
    icon: '📜',
  },
  {
    key: 'has_trust' as const,
    question: 'Do you have a living trust?',
    description: 'A revocable living trust helps your estate avoid probate.',
    icon: '🏛️',
  },
  {
    key: 'has_poa' as const,
    question: 'Do you have a durable power of attorney?',
    description: 'A POA designates someone to manage your finances if you become incapacitated.',
    icon: '✍️',
  },
  {
    key: 'has_hcd' as const,
    question: 'Do you have a healthcare directive?',
    description: 'Also called a living will - directs your medical care if you cannot speak for yourself.',
    icon: '🏥',
  },
  {
    key: 'beneficiaries_current' as const,
    question: 'Are your beneficiary designations up to date?',
    description: 'Beneficiaries on retirement accounts and insurance policies override your will.',
    icon: '👥',
  },
]

type Answers = Record<(typeof QUESTIONS)[number]['key'], Answer>

export default function HealthCheckPage() {
  const router = useRouter()
  const [answers, setAnswers] = useState<Answers>({
    has_will: null,
    has_trust: null,
    has_poa: null,
    has_hcd: null,
    beneficiaries_current: null,
  })
  const [current, setCurrent] = useState(0)
  const [saving, setSaving] = useState(false)
  const [householdId, setHouseholdId] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      const { data: household } = await supabase.from('households').select('id').eq('owner_id', user.id).single()
      if (!household) {
        router.push('/profile')
        return
      }
      setHouseholdId(household.id)
    }
    void load()
  }, [router])

  function answer(val: Answer) {
    const q = QUESTIONS[current]
    setAnswers((prev) => ({ ...prev, [q.key]: val }))
    if (current < QUESTIONS.length - 1) {
      setTimeout(() => setCurrent((c) => c + 1), 300)
    }
  }

  const allAnswered = Object.values(answers).every((a) => a !== null)

  async function handleSubmit() {
    if (!householdId || !allAnswered) return
    setSaving(true)
    const supabase = createClient()
    await supabase
      .from('estate_health_check')
      .upsert(
        {
          household_id: householdId,
          has_will: answers.has_will === 'yes',
          has_trust: answers.has_trust === 'yes',
          has_poa: answers.has_poa === 'yes',
          has_hcd: answers.has_hcd === 'yes',
          beneficiaries_current: answers.beneficiaries_current === 'yes',
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'household_id' },
      )
    router.push('/dashboard')
    router.refresh()
  }

  const q = QUESTIONS[current]
  const progress = ((current + 1) / QUESTIONS.length) * 100

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center px-4">
      <div className="w-full max-w-lg">
        <div className="mb-8">
          <div className="flex items-center justify-between text-xs text-neutral-500 mb-2">
            <span>Estate Health Check</span>
            <span>
              {current + 1} of {QUESTIONS.length}
            </span>
          </div>
          <div className="w-full bg-neutral-200 rounded-full h-1.5">
            <div
              className="bg-neutral-900 h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-8 mb-4">
          <div className="text-4xl mb-4">{q.icon}</div>
          <h2 className="text-xl font-bold text-neutral-900 mb-2">{q.question}</h2>
          <p className="text-sm text-neutral-500 mb-8">{q.description}</p>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => answer('yes')}
              className={`rounded-xl border-2 px-6 py-4 text-sm font-semibold transition-all ${
                answers[q.key] === 'yes'
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                  : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50'
              }`}
            >
              ✓ Yes
            </button>
            <button
              onClick={() => answer('no')}
              className={`rounded-xl border-2 px-6 py-4 text-sm font-semibold transition-all ${
                answers[q.key] === 'no'
                  ? 'border-red-400 bg-red-50 text-red-700'
                  : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50'
              }`}
            >
              ✗ Not yet
            </button>
          </div>
        </div>

        {current > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {QUESTIONS.slice(0, current).map((question, i) => (
              <button
                key={question.key}
                onClick={() => setCurrent(i)}
                className="text-xs rounded-full border border-neutral-200 bg-white px-3 py-1 text-neutral-500 hover:border-neutral-300"
              >
                {question.icon} {answers[question.key] === 'yes' ? '✓' : '✗'}
              </button>
            ))}
          </div>
        )}

        {allAnswered && (
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="w-full rounded-xl bg-neutral-900 px-6 py-4 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-50 transition"
          >
            {saving ? 'Saving...' : 'See My Estate Readiness Score →'}
          </button>
        )}

        <button
          onClick={() => router.push('/dashboard')}
          className="w-full mt-3 text-xs text-neutral-400 hover:text-neutral-600 text-center transition"
        >
          Skip for now
        </button>

        <div className="mt-8">
          <DisclaimerBanner context="estate health check" />
        </div>
      </div>
    </div>
  )
}
