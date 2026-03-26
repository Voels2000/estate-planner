'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const FEEDBACK_TYPES = [
  { value: 'bug', label: '🐛 Bug Report' },
  { value: 'suggestion', label: '💡 Suggestion' },
  { value: 'general', label: '💬 General Feedback' },
]

export function FeedbackButton({ userId }: { userId: string }) {
  const [isOpen, setIsOpen] = useState(false)
  const [type, setType] = useState('general')
  const [message, setMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      const supabase = createClient()
      const page = window.location.pathname

      const { error } = await supabase.from('feedback').insert({
        user_id: userId,
        type,
        message,
        page,
      })

      if (error) throw error

      setSuccess(true)
      setMessage('')
      setTimeout(() => {
        setSuccess(false)
        setIsOpen(false)
      }, 2000)
    } catch (err) {
     setError(err instanceof Error ? err.message : JSON.stringify(err))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-30 flex items-center gap-2 rounded-full bg-neutral-900 px-4 py-3 text-sm font-medium text-white shadow-lg hover:bg-neutral-800 transition-all hover:scale-105"
      >
        <span>💬</span>
        <span>Feedback</span>
      </button>

      {/* Modal */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={(e) => e.target === e.currentTarget && setIsOpen(false)}
        >
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl ring-1 ring-neutral-200">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-neutral-200 px-6 py-4">
              <div>
                <h2 className="text-base font-semibold text-neutral-900">Share Feedback</h2>
                <p className="text-xs text-neutral-500 mt-0.5">Help us improve Estate Planner</p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-neutral-400 hover:text-neutral-600 text-lg"
              >
                ✕
              </button>
            </div>

            {success ? (
              <div className="px-6 py-12 text-center">
                <div className="text-4xl mb-3">🙏</div>
                <p className="font-semibold text-neutral-900">Thank you!</p>
                <p className="text-sm text-neutral-500 mt-1">Your feedback has been received.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
                {error && (
                  <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</p>
                )}

                {/* Type selector */}
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">Type</label>
                  <div className="grid grid-cols-3 gap-2">
                    {FEEDBACK_TYPES.map((t) => (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => setType(t.value)}
                        className={`rounded-lg border px-2 py-2 text-xs font-medium transition text-center ${
                          type === t.value
                            ? 'border-neutral-900 bg-neutral-900 text-white'
                            : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300'
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Message */}
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Message
                  </label>
                  <textarea
                    required
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={4}
                    placeholder={
                      type === 'bug'
                        ? 'Describe the bug and what you were doing when it happened...'
                        : type === 'suggestion'
                        ? 'What feature or improvement would you like to see?'
                        : 'Share your thoughts...'
                    }
                    className="block w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 placeholder-neutral-400 focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500 resize-none"
                  />
                </div>

                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="flex-1 rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50 transition"
                  >
                    {isSubmitting ? 'Sending...' : 'Send Feedback'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  )
}
