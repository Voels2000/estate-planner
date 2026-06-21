'use client'

import { useState } from 'react'

export default function WaitlistClient() {
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return

    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/email-capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), source: 'waitlist' }),
      })

      if (!res.ok) {
        setError('Something went wrong. Please try again.')
        return
      }

      setSuccess(true)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main
      style={{
        fontFamily: 'DM Sans, system-ui, sans-serif',
        background: '#fafaf8',
        minHeight: 'calc(100vh - 56px)',
      }}
    >
      <WaitlistHero />

      <div style={{ maxWidth: 480, margin: '0 auto', padding: '40px 24px 80px' }}>
        <div
          style={{
            background: 'white',
            border: '1px solid #e2e8f0',
            borderRadius: 12,
            padding: '32px 28px',
            boxShadow: '0 4px 20px rgba(15,31,61,0.08)',
          }}
        >
          {success ? (
            <div
              style={{
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: 8,
                padding: '16px 18px',
                fontSize: 14,
                color: '#16a34a',
                lineHeight: 1.6,
                textAlign: 'center',
              }}
            >
              ✓ You&apos;re on the list — we&apos;ll email you when we launch.
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <p
                style={{
                  fontSize: 12,
                  color: '#718096',
                  lineHeight: 1.5,
                  marginBottom: 14,
                }}
              >
                By submitting your email, you agree we may send you planning tips and
                product updates. See our{' '}
                <a href="/privacy" style={{ color: '#0f1f3d', textDecoration: 'underline' }}>
                  Privacy Policy
                </a>
                . Unsubscribe anytime from any email.
              </p>
              <label
                htmlFor="waitlist-email"
                style={{
                  display: 'block',
                  fontSize: 13,
                  fontWeight: 500,
                  color: '#0f1f3d',
                  marginBottom: 8,
                }}
              >
                Email address
              </label>
              <input
                id="waitlist-email"
                type="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: 8,
                  border: '1.5px solid #e2e8f0',
                  fontSize: 14,
                  marginBottom: 12,
                  fontFamily: 'DM Sans, system-ui, sans-serif',
                  boxSizing: 'border-box',
                }}
              />
              {error && (
                <p style={{ fontSize: 13, color: '#dc2626', marginBottom: 12 }}>{error}</p>
              )}
              <button
                type="submit"
                disabled={submitting}
                style={{
                  width: '100%',
                  padding: '12px 20px',
                  background: submitting ? '#94a3b8' : '#0f1f3d',
                  color: 'white',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  fontFamily: 'DM Sans, system-ui, sans-serif',
                }}
              >
                {submitting ? 'Joining…' : 'Join the waitlist'}
              </button>
            </form>
          )}

          <p
            style={{
              fontSize: 12,
              color: '#718096',
              textAlign: 'center',
              marginTop: 20,
              lineHeight: 1.5,
            }}
          >
            Already have an account?{' '}
            <a href="/login" style={{ color: '#0f1f3d', fontWeight: 500 }}>
              Sign in
            </a>
          </p>
        </div>
      </div>
    </main>
  )
}

function WaitlistHero() {
  return (
    <div
      style={{
        background: 'linear-gradient(150deg, #0f1f3d 0%, #1a3460 55%, #2a4a7f 100%)',
        padding: '52px 32px 44px',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          background: 'rgba(201,168,76,0.15)',
          border: '1px solid rgba(201,168,76,0.35)',
          color: '#e8c97a',
          fontSize: 10,
          fontWeight: 500,
          padding: '5px 16px',
          borderRadius: 40,
          marginBottom: 20,
          textTransform: 'uppercase',
          letterSpacing: '0.8px',
        }}
      >
        Early access
      </div>
      <h1
        style={{
          fontFamily: 'Playfair Display, Georgia, serif',
          fontSize: 'clamp(28px, 5vw, 42px)',
          fontWeight: 500,
          color: 'white',
          lineHeight: 1.2,
          marginBottom: 14,
          maxWidth: 560,
          margin: '0 auto 14px',
        }}
      >
        We&apos;re launching soon
      </h1>
      <p
        style={{
          fontSize: 16,
          color: 'rgba(255,255,255,0.65)',
          maxWidth: 480,
          margin: '0 auto',
          lineHeight: 1.7,
        }}
      >
        Join the waitlist and we&apos;ll notify you when we open.
      </p>
    </div>
  )
}
