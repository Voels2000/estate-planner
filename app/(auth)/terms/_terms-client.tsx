'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const TERMS_VERSION = '2026-03-31'

const TERMS_SECTIONS = [
  {
    title: '1. Acceptance of Terms',
    body: `By creating an account and using Estate Planner ("the Platform"), you agree to be bound by these Terms and Conditions ("Terms"). If you do not agree to these Terms, you may not access or use the Platform. These Terms constitute a legally binding agreement between you and Estate Planner.`,
  },
  {
    title: '2. Financial Disclaimer',
    body: `Estate Planner is an informational and organizational tool only. Nothing on the Platform constitutes financial, legal, tax, or investment advice. The Platform does not recommend or endorse any specific financial product, investment strategy, attorney, or advisor. Any information provided is for general educational purposes only. You should consult a qualified financial advisor, attorney, or tax professional before making any financial or legal decisions. Estate Planner is not a registered investment advisor, broker-dealer, or law firm.`,
  },
  {
    title: '3. Data Privacy & Storage',
    body: `Estate Planner collects and stores personal and financial information you provide in order to deliver the Platform's services. Your data is stored securely using industry-standard encryption at rest and in transit. We do not sell your personal information to third parties. We may share data with service providers necessary to operate the Platform (such as payment processors and email providers) under strict confidentiality obligations. You may request deletion of your account and associated data at any time by contacting support. By using the Platform you consent to the collection and use of your data as described in our Privacy Policy, which is incorporated into these Terms by reference.`,
  },
  {
    title: '4. Subscription & Billing',
    body: `Access to certain features of the Platform requires a paid subscription. Subscription fees are billed in advance on a monthly or annual basis depending on the plan selected. All fees are non-refundable except as required by law or as expressly stated in our refund policy. Estate Planner reserves the right to change pricing with thirty (30) days notice. If your payment fails, access to paid features may be suspended until payment is resolved. Subscriptions may be cancelled at any time; cancellation takes effect at the end of the current billing period. If your account is managed by an advisor, billing terms may differ as outlined during onboarding.`,
  },
  {
    title: '5. User Responsibilities',
    body: `You are responsible for maintaining the confidentiality of your account credentials and for all activity that occurs under your account. You agree to provide accurate, current, and complete information and to update it as necessary. You agree not to use the Platform for any unlawful purpose or in any way that could damage, disable, or impair the Platform. You may not attempt to gain unauthorized access to any part of the Platform or its related systems. You are solely responsible for the accuracy of any financial or personal data you enter into the Platform.`,
  },
  {
    title: '6. Limitation of Liability',
    body: `To the fullest extent permitted by applicable law, Estate Planner and its officers, directors, employees, and agents shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising out of or related to your use of the Platform, even if advised of the possibility of such damages. In no event shall Estate Planner's total liability to you for all claims exceed the greater of (a) the amount you paid to Estate Planner in the twelve (12) months preceding the claim, or (b) one hundred dollars ($100). Some jurisdictions do not allow the exclusion of certain warranties or limitations of liability, so some of the above limitations may not apply to you.`,
  },
  {
    title: '7. Governing Law',
    body: `These Terms shall be governed by and construed in accordance with the laws of the State of Washington, without regard to its conflict of law provisions. Any dispute arising under or related to these Terms shall be subject to the exclusive jurisdiction of the state and federal courts located in Washington State. You consent to personal jurisdiction in such courts and waive any objection to venue.`,
  },
  {
    title: '8. Changes to These Terms',
    body: `Estate Planner reserves the right to modify these Terms at any time. When we make material changes, we will update the version date and require you to re-accept the Terms before continuing to use the Platform. Your continued use of the Platform after any changes constitutes acceptance of the revised Terms. The current version of these Terms is always available at ${process.env.NEXT_PUBLIC_APP_URL}/terms.`,
  },
]

export default function TermsClient() {
  const router = useRouter()
  const [accepting, setAccepting] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
            Version {TERMS_VERSION} · Please read carefully before continuing
          </p>
        </div>

        {/* T&C Content */}
        <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
          <div className="divide-y divide-neutral-100">
            {TERMS_SECTIONS.map((section) => (
              <div key={section.title} className="px-6 py-5">
                <h2 className="mb-2 text-sm font-semibold text-neutral-900">
                  {section.title}
                </h2>
                <p className="text-sm leading-relaxed text-neutral-600">
                  {section.body}
                </p>
              </div>
            ))}
          </div>

          {/* Accept footer */}
          <div className="rounded-b-2xl border-t border-neutral-200 bg-neutral-50 px-6 py-5">
            <p className="mb-4 text-xs text-neutral-500">
              By clicking Accept, you agree to the Estate Planner Terms & Conditions
              version {TERMS_VERSION}. The date and version of your acceptance will
              be recorded on your account.
            </p>
            {error && (
              <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                {error}
              </p>
            )}
            <button
              onClick={handleAccept}
              disabled={accepting}
              className="w-full rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50 transition"
            >
              {accepting ? 'Recording acceptance...' : 'I Accept the Terms & Conditions'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
