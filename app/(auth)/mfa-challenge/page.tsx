'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function MfaChallengeForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirectTo') || '/dashboard'
  const supabase = createClient()

  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleVerify() {
    if (code.length !== 6) return
    setLoading(true)
    setError('')
    try {
      const { data: factors } = await supabase.auth.mfa.listFactors()
      const totpFactor = factors?.totp?.[0]
      if (!totpFactor) {
        setError('No authenticator found. Please contact support.')
        setLoading(false)
        return
      }
      const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
        factorId: totpFactor.id,
        code,
      })
      if (verifyError) {
        setError('Invalid code. Please try again.')
        setLoading(false)
        return
      }
      router.push(redirectTo)
      router.refresh()
    } catch {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#fafaf8',
      fontFamily: 'DM Sans, system-ui, sans-serif',
      display: 'flex', alignItems: 'center',
      justifyContent: 'center', padding: '24px',
    }}>
      <div style={{
        background: 'white', border: '1px solid #e2e8f0',
        borderRadius: 16, padding: '40px 36px',
        maxWidth: 400, width: '100%',
        boxShadow: '0 8px 40px rgba(15,31,61,0.12)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            width: 48, height: 48, background: '#0f1f3d',
            borderRadius: '50%', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px', fontSize: 20,
          }}>🔐</div>
          <h1 style={{
            fontFamily: 'Playfair Display, Georgia, serif',
            fontSize: 22, fontWeight: 500,
            color: '#0f1f3d', marginBottom: 6,
          }}>Two-Factor Authentication</h1>
          <p style={{ fontSize: 13, color: '#718096', lineHeight: 1.6 }}>
            Enter the 6-digit code from your authenticator app to continue.
          </p>
        </div>
        <div style={{ marginBottom: 16 }}>
          <input
            type="text" inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6} placeholder="000000"
            value={code}
            onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
            autoFocus
            style={{
              width: '100%', padding: '14px',
              borderRadius: 8, border: '1.5px solid #e2e8f0',
              fontSize: 28, textAlign: 'center',
              letteracing: '0.3em', fontFamily: 'monospace',
              outline: 'none', color: '#0f1f3d',
            }}
            onKeyDown={e => { if (e.key === 'Enter' && code.length === 6) handleVerify() }}
          />
        </div>
        {error && (
          <div style={{
            background: '#fff5f5', border: '1px solid #fed7d7',
            borderRadius: 6, padding: '10px 14px',
            fontSize: 13, color: '#c53030',
            marginBottom: 16, textAlign: 'center',
          }}>{error}</div>
        )}
        <button
          onClick={handleVerify}
          disabled={code.length !== 6 || loading}
          style={{
            width: '100%', padding: '13px',
            borderRadius: 8, border: 'none',
            background: code.length === 6 ? '#0f1f3d' : '#e2e8f0',
            color: code.length === 6 ? 'white' : '#718096',
            fontSize: 14, fontWeight: 600,
            cursor: code.length === 6 ? 'pointer' : 'not-allowed',
            fontFamily: 'DM Sans, system-ui, sans-serif',
            transition: 'all 0.2s',
          }}
        >{loading ? 'Verifying...' : 'Verify →'}</button>
        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 12, color: '#718096' }}>
          Lost access?{' '}
          <a href="/login" style={{ color: '#0f1f3d' }}>Sign in again</a>
        </div>
      </div>
    </div>
  )
}

export default function MfaChallengePage() {
  return <Suspense><MfaChallengeForm /></Suspense>
}
