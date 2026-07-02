'use client'

import { FormEvent, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { formControlClass, formLabelClass } from '@/components/ui/form'

export type ClaimListingPreview = {
  type: 'attorney' | 'advisor'
  token: string
  firm_name: string
  contact_name: string | null
  email: string
  phone: string | null
  website: string | null
  city: string | null
  state: string | null
  bio: string | null
  alreadyClaimed: boolean
  claimedByYou: boolean
}

type Props = {
  listing: ClaimListingPreview
  isLoggedIn: boolean
  userEmail: string | null
}

export function DirectoryClaimClient({ listing, isLoggedIn, userEmail }: Props) {
  const router = useRouter()
  const [contactName, setContactName] = useState(listing.contact_name ?? '')
  const [firmName, setFirmName] = useState(listing.firm_name)
  const [phone, setPhone] = useState(listing.phone ?? '')
  const [website, setWebsite] = useState(listing.website ?? '')
  const [bio, setBio] = useState(listing.bio ?? '')
  const [barNumber, setBarNumber] = useState('')
  const [barState, setBarState] = useState(listing.state ?? 'WA')
  const [crdNumber, setCrdNumber] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(listing.claimedByYou)

  const [magicLinkEmail, setMagicLinkEmail] = useState(listing.email || '')
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [magicLinkLoading, setMagicLinkLoading] = useState(false)
  const [magicLinkSent, setMagicLinkSent] = useState(false)

  const claimPath = `/claim/${listing.token}`
  const loginHref = `/login?redirectTo=${encodeURIComponent(claimPath)}`
  const signupHref = `/signup?redirectTo=${encodeURIComponent(claimPath)}`

  const portalHref =
    listing.type === 'attorney'
      ? '/attorney?claimed=true'
      : '/advisor?claimed=true'

  async function handleMagicLink(e: FormEvent) {
    e.preventDefault()
    const email = magicLinkEmail.trim()
    if (!email) {
      setError('Enter the email address for this listing.')
      return
    }
    if (!termsAccepted) {
      setError('Accept the terms to continue.')
      return
    }

    setError(null)
    setMagicLinkLoading(true)
    try {
      const supabase = createClient()
      const termsAcceptedAt = new Date().toISOString()
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(claimPath)}`,
          data: {
            role: listing.type === 'attorney' ? 'attorney' : 'advisor',
            terms_accepted_at: termsAcceptedAt,
          },
        },
      })
      if (otpError) {
        setError(otpError.message)
        return
      }
      setMagicLinkSent(true)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setMagicLinkLoading(false)
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!isLoggedIn) return
    setError(null)
    setLoading(true)

    try {
      const res = await fetch('/api/directory/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          claimToken: listing.token,
          contact_name: contactName,
          firm_name: firmName,
          phone,
          website,
          bio,
          ...(listing.type === 'attorney'
            ? { bar_number: barNumber || undefined, bar_state: barState }
            : { crd_number: crdNumber || undefined, adv_link: website || undefined }),
        }),
      })
      const data = (await res.json()) as { error?: string; success?: boolean }
      if (!res.ok) {
        setError(data.error ?? 'Could not complete claim.')
        setLoading(false)
        return
      }
      setSuccess(true)
      router.refresh()
    } catch {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  if (listing.alreadyClaimed && !listing.claimedByYou) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
        <Card className="max-w-lg p-8 text-center">
          <h1 className="text-xl font-semibold text-neutral-900">Already claimed</h1>
          <p className="mt-3 text-sm text-neutral-600">
            This listing has been claimed by another account. Contact{' '}
            <a href="mailto:support@mywealthmaps.com" className="text-blue-600 underline">
              support@mywealthmaps.com
            </a>{' '}
            if you believe this is an error.
          </p>
        </Card>
      </div>
    )
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
        <Card className="max-w-lg p-8">
          <h1 className="text-2xl font-semibold text-neutral-900">Listing claimed</h1>
          <p className="mt-3 text-sm text-neutral-600 leading-relaxed">
            Your directory profile is linked to your account. Review how you appear on{' '}
            {listing.type === 'attorney' ? (
              <Link href="/find-attorney" className="text-blue-600 underline">
                Find an Attorney
              </Link>
            ) : (
              <Link href="/find-advisor" className="text-blue-600 underline">
                Find an Advisor
              </Link>
            )}
            . Add or confirm your {listing.type === 'attorney' ? 'bar number' : 'CRD'} anytime — the
            verified badge appears after we confirm it.
          </p>
          <p className="mt-4 text-sm text-neutral-500">
            Interested in trying My Wealth Maps with clients?{' '}
            <Link href="/billing" className="text-blue-600 underline">
              Start a trial when you&apos;re ready
            </Link>{' '}
            — no obligation.
          </p>
          <div className="mt-6">
            <Button onClick={() => router.push(portalHref)}>
              {listing.type === 'attorney' ? 'Go to attorney portal' : 'Go to advisor portal'}
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen justify-center bg-neutral-50 px-4 py-12">
      <Card className="w-full max-w-xl p-8">
        <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
          {listing.type === 'attorney' ? 'Attorney directory' : 'Advisor directory'}
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-neutral-900">Claim your listing</h1>
        <p className="mt-2 text-sm text-neutral-600">
          Here&apos;s how you appear today. Update anything that&apos;s wrong, then claim — it&apos;s free.
        </p>

        {!isLoggedIn && (
          <div className="mt-6 space-y-4">
            {magicLinkSent ? (
              <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-900">
                <p className="font-medium">Check your email</p>
                <p className="mt-1">
                  We sent a sign-in link to <span className="font-medium">{magicLinkEmail}</span>.
                  Click it to return here and finish claiming your listing — no password required.
                </p>
              </div>
            ) : (
              <form onSubmit={handleMagicLink} className="rounded-lg border border-neutral-200 bg-white p-4 space-y-4">
                <div>
                  <p className="font-medium text-neutral-900">Email me a link</p>
                  <p className="mt-1 text-sm text-neutral-600">
                    Use the firm email on this listing. One click signs you in and brings you back
                    to claim — no signup form.
                  </p>
                </div>
                <div>
                  <label className={formLabelClass} htmlFor="magic_link_email">
                    Email address
                  </label>
                  <input
                    id="magic_link_email"
                    type="email"
                    autoComplete="email"
                    required
                    className={formControlClass}
                    value={magicLinkEmail}
                    onChange={(e) => setMagicLinkEmail(e.target.value)}
                    placeholder={listing.email || 'you@firm.com'}
                  />
                </div>
                <label className="flex items-start gap-2 text-sm text-neutral-600">
                  <input
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                    className="mt-1"
                  />
                  <span>
                    I agree to the{' '}
                    <Link href="/terms" className="text-blue-700 underline" target="_blank">
                      Terms of Service
                    </Link>{' '}
                    and{' '}
                    <Link href="/privacy" className="text-blue-700 underline" target="_blank">
                      Privacy Policy
                    </Link>
                    .
                  </span>
                </label>
                <Button type="submit" disabled={magicLinkLoading || !magicLinkEmail.trim()} className="w-full">
                  {magicLinkLoading ? 'Sending…' : 'Email me a link'}
                </Button>
              </form>
            )}
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-700">
              <p className="font-medium text-neutral-900">Already have a password?</p>
              <div className="mt-2 flex flex-wrap gap-3">
                <Link href={loginHref} className="text-blue-700 underline font-medium">
                  Sign in
                </Link>
                <Link href={signupHref} className="text-blue-700 underline font-medium">
                  Create account
                </Link>
              </div>
            </div>
          </div>
        )}

        {isLoggedIn && userEmail && (
          <p className="mt-4 text-sm text-neutral-500">
            Signed in as <span className="font-medium text-neutral-800">{userEmail}</span>
          </p>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className={formLabelClass} htmlFor="firm_name">
              Firm name
            </label>
            <input
              id="firm_name"
              className={formControlClass}
              value={firmName}
              onChange={(e) => setFirmName(e.target.value)}
              required
              disabled={!isLoggedIn}
            />
          </div>
          <div>
            <label className={formLabelClass} htmlFor="contact_name">
              Your name
            </label>
            <input
              id="contact_name"
              className={formControlClass}
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              disabled={!isLoggedIn}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={formLabelClass} htmlFor="phone">
                Phone
              </label>
              <input
                id="phone"
                className={formControlClass}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={!isLoggedIn}
              />
            </div>
            <div>
              <label className={formLabelClass} htmlFor="website">
                Website
              </label>
              <input
                id="website"
                className={formControlClass}
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                disabled={!isLoggedIn}
              />
            </div>
          </div>
          <div>
            <label className={formLabelClass} htmlFor="bio">
              Bio / credentials notes
            </label>
            <textarea
              id="bio"
              className={formControlClass}
              rows={4}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              disabled={!isLoggedIn}
            />
          </div>

          {listing.type === 'attorney' ? (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={formLabelClass} htmlFor="bar_state">
                  Primary bar state
                </label>
                <input
                  id="bar_state"
                  className={formControlClass}
                  value={barState}
                  onChange={(e) => setBarState(e.target.value.toUpperCase())}
                  maxLength={2}
                  disabled={!isLoggedIn}
                />
              </div>
              <div>
                <label className={formLabelClass} htmlFor="bar_number">
                  Bar number (optional)
                </label>
                <input
                  id="bar_number"
                  className={formControlClass}
                  value={barNumber}
                  onChange={(e) => setBarNumber(e.target.value)}
                  placeholder="Add now or later"
                  disabled={!isLoggedIn}
                />
              </div>
            </div>
          ) : (
            <div>
              <label className={formLabelClass} htmlFor="crd_number">
                CRD number (optional)
              </label>
              <input
                id="crd_number"
                className={formControlClass}
                value={crdNumber}
                onChange={(e) => setCrdNumber(e.target.value)}
                placeholder="Add now or later"
                disabled={!isLoggedIn}
              />
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <Button type="submit" disabled={!isLoggedIn || loading} className="w-full">
            {loading ? 'Saving…' : 'Claim this listing'}
          </Button>
        </form>

        <p className="mt-6 text-xs text-neutral-500">
          Wrong person?{' '}
          <a href="mailto:support@mywealthmaps.com" className="underline">
            Email support
          </a>{' '}
          for a manual review.
        </p>
      </Card>
    </div>
  )
}
