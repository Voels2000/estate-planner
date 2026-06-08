import { redirect } from 'next/navigation'
import { cookies, headers } from 'next/headers'
import { Suspense } from 'react'
import {
  isLocalDevHost,
  isWaitlistMode,
  shouldBypassWaitlistForSignup,
  BETA_SIGNUP_ACCESS_COOKIE,
  BETA_SIGNUP_ACCESS_LABEL_COOKIE,
  isBetaSignupAccessActive,
  getBetaSignupAccessLabel,
} from '@/lib/waitlist-mode'
import { SignupForm } from './_signup-form'
import { BetaSignupViewTracker } from './_beta-signup-tracker'

export const dynamic = 'force-dynamic'

function SignupFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4 font-sans dark:bg-zinc-950">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm ring-1 ring-neutral-200 dark:bg-zinc-900 dark:ring-zinc-800">
        <div className="h-9 w-48 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
        <div className="mt-2 h-4 w-64 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
        <div className="mt-6 space-y-5">
          <div className="h-10 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
          <div className="h-10 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
          <div className="h-10 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
          <div className="h-10 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-700" />
        </div>
      </div>
    </div>
  )
}

type SignupPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const params = await searchParams
  const urlSearchParams = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string') urlSearchParams.set(key, value)
    else if (Array.isArray(value) && value[0]) urlSearchParams.set(key, value[0])
  }

  const hostHeader = (await headers()).get('host') ?? ''
  const isLocalhost = isLocalDevHost(hostHeader)
  const cookieStore = await cookies()
  const betaAccessCookie = cookieStore.get(BETA_SIGNUP_ACCESS_COOKIE)?.value ?? null
  const betaLabelCookie = cookieStore.get(BETA_SIGNUP_ACCESS_LABEL_COOKIE)?.value ?? null

  const betaAccessActive = isBetaSignupAccessActive(urlSearchParams, betaAccessCookie)
  const betaLabel =
    getBetaSignupAccessLabel(urlSearchParams) ?? betaLabelCookie

  if (
    !isLocalhost &&
    isWaitlistMode({ hostname: hostHeader }) &&
    !shouldBypassWaitlistForSignup(urlSearchParams, { betaAccessCookie })
  ) {
    redirect('/waitlist')
  }

  return (
    <Suspense fallback={<SignupFallback />}>
      <BetaSignupViewTracker
        betaAccessActive={betaAccessActive}
        betaLabel={betaLabel}
      />
      <SignupForm betaAccessActive={betaAccessActive} betaLabel={betaLabel} />
    </Suspense>
  )
}
