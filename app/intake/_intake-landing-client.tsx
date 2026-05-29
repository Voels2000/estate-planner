'use client'

import Link from 'next/link'
import { storeIntakeToken } from '@/lib/attorney/intakeTokenSession'

type Props = {
  token: string
  attorneyName: string
  firm: string | null
}

export function IntakeLandingClient({ token, attorneyName, firm }: Props) {
  const signupHref = `/signup?intake_token=${encodeURIComponent(token)}&attorney=${encodeURIComponent(attorneyName)}`
  const loginHref = `/login?intake_token=${encodeURIComponent(token)}`

  function handleNavigate(href: string) {
    storeIntakeToken(token)
    window.location.href = href
  }

  return (
    <div className="min-h-screen bg-[#0F1B3C] flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-2xl overflow-hidden">
        <div className="bg-[#0F1B3C] px-8 py-6">
          <p className="text-[#C9A84C] text-xs font-semibold uppercase tracking-widest mb-2">
            My Wealth Maps
          </p>
          <h1 className="text-white text-2xl font-light leading-tight">
            {attorneyName} has invited you to complete your estate planning profile
          </h1>
          {firm && <p className="text-slate-400 text-sm mt-2">{firm}</p>}
        </div>
        <div className="px-8 py-6">
          <p className="text-gray-600 text-sm leading-relaxed mb-4">
            Complete a short profile before your meeting. It typically takes 15–20 minutes
            and replaces the paper intake form.
          </p>
          <ul className="space-y-2 mb-6">
            {[
              'Your assets and liabilities',
              'Beneficiary designations',
              'Existing estate documents',
              'Estate tax exposure estimate',
            ].map((item) => (
              <li key={item} className="flex items-center gap-2 text-sm text-gray-700">
                <span className="text-amber-500">✓</span> {item}
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => handleNavigate(signupHref)}
            className="block w-full text-center bg-[#C9A84C] text-[#0F1B3C] font-bold py-3.5 rounded-lg text-sm hover:bg-amber-500 transition-colors"
          >
            Get started →
          </button>
          <p className="text-gray-400 text-xs text-center mt-4">
            Already have an account?{' '}
            <button
              type="button"
              onClick={() => handleNavigate(loginHref)}
              className="text-[#0F1B3C] underline"
            >
              Log in instead
            </button>
          </p>
          <p className="text-gray-400 text-xs text-center mt-3">
            <Link href="/" className="underline">
              Back to homepage
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
