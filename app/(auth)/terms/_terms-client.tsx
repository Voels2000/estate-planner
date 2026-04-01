'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

type Section = {
  title: string
  body:  string
}

export default function TermsClient() {
  const router = useRouter()
  const [accepting, setAccepting]   = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [version, setVersion]       = useState<string>('...')
  const [sections, setSections]     = useState<Section[]>([])
  const [loading, setLoading]       = useState(true)

  // ── Fetch live T&C content from app_config ─────────────────
  useEffect(() => {
    async function fetchTerms() {
      try {
        const res  = await fetch('/api/terms/content')
        const data = await res.json()
        if (data.version)  setVersion(data.version)
        if (data.sections) setSections(data.sections)
      } catch {
        // Fall back to showing accept button even if fetch fails
      } finally {
        setLoading(false)
      }
    }
    fetchTerms()
  }, [])

  async function handleAccept() {
    setAccepting(true)
    setError(null)
    try {
      const res = await fetch('/api/terms/accept', { method: 'POST' })
      if (!res.ok) {
        setError('Something went wrong. Please try again.')
        return
      }
      router.push('/dashboard')
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setAccepting(false)
    }
  }

  return (
    <div className="min-h-screen bg-neutral-50 px-4 py-12">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-neutral-900">Terms & Conditions</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Version {version} · Please read carefully before continuing
          </p>
        </div>

        {/* T&C Content */}
        <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
          <div className="divide-y divide-neutral-100">
            {loading ? (
              <div className="px-6 py-10 text-center text-sm text-neutral-400">
                Loading terms...
              </div>
            ) : sections.length > 0 ? (
              sections.map((section) => (
                <div key={section.title} className="px-6 py-5">
                  <h2 className="mb-2 text-sm font-semibold text-neutral-900">
                    {section.title}
                  </h2>
                  <p className="text-sm leading-relaxed text-neutral-600">
                    {section.body}
                  </p>
                </div>
              ))
            ) : (
              <div className="px-6 py-10 text-center text-sm text-neutral-400">
                Terms content unavailable. Please contact support.
              </div>
            )}
          </div>

          {/* Accept footer */}
          <div className="rounded-b-2xl border-t border-neutral-200 bg-neutral-50 px-6 py-5">
            <p className="mb-4 text-xs text-neutral-500">
              By clicking Accept, you agree to the Estate Planner Terms & Conditions
              version {version}. The date and version of your acceptance will
              be recorded on your account.
            </p>
            {error && (
              <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                {error}
              </p>
            )}
            <button
              onClick={handleAccept}
              disabled={accepting || loading}
              className="w-full rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-medium
                         text-white hover:bg-neutral-800 disabled:opacity-50 transition"
            >
              {accepting ? 'Recording acceptance...' : 'I Accept the Terms & Conditions'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
