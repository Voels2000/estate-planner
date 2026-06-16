import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, clientIp } from '@/lib/api/simpleRateLimit'
import { createAdminClient } from '@/lib/supabase/admin'
import { completeSignupAfterCreate } from '@/lib/auth/completeSignup'
import {
  inferSignupAdmissionFromClient,
  resolveEffectiveSignupRole,
  resolveEmailConfirmForCreateUser,
  validateSignupAdmission,
  type SignupAdmissionPayload,
  type SignupRole,
} from '@/lib/auth/signupAdmission'
import { sanitizeSignupRedirect, validateSignupPassword } from '@/lib/auth/signupPolicy'
import { isSignupExplicitlyOpen } from '@/lib/waitlist-mode'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const SIGNUP_RATE_LIMIT = { max: 10, windowMs: 60_000 }
// Rate limit: 10/min per client IP (x-forwarded-for). In-memory unless Upstash configured — dampening, not hard cap.

type SignupRequestBody = {
  email?: string
  password?: string
  fullName?: string
  role?: SignupRole
  termsAcceptedAt?: string
  admission?: SignupAdmissionPayload
  referralCode?: string
  referralSlug?: string
  attorneyReferralCode?: string
  attorneyReferralSlug?: string
  betaLabel?: string | null
  betaAccessActive?: boolean
  redirectTo?: string
}

function parseAdmission(body: SignupRequestBody): SignupAdmissionPayload {
  if (body.admission?.type) return body.admission
  return inferSignupAdmissionFromClient({
    betaAccessActive: body.betaAccessActive === true,
    betaAccessToken: body.admission?.access,
    advisorInviteToken: body.admission?.inviteToken,
    firmInviteToken: body.admission?.firmInviteToken,
    firmId: body.admission?.firmId,
    connectToken: body.admission?.connectToken,
    connectionToken: body.admission?.connectionId,
    signupOpen: isSignupExplicitlyOpen(),
  })
}

function isExistingUserError(message: string): boolean {
  const lower = message.toLowerCase()
  return (
    lower.includes('already registered') ||
    lower.includes('already exists') ||
    lower.includes('duplicate')
  )
}

export async function POST(request: NextRequest) {
  const ip = clientIp(request)
  const rate = await checkRateLimit(`signup:${ip}`, SIGNUP_RATE_LIMIT.max, SIGNUP_RATE_LIMIT.windowMs)
  if (!rate.allowed) {
    return NextResponse.json(
      { error: 'Too many signup attempts. Please try again later.' },
      {
        status: 429,
        headers: rate.retryAfterSec
          ? { 'Retry-After': String(rate.retryAfterSec) }
          : undefined,
      },
    )
  }

  let body: SignupRequestBody
  try {
    body = (await request.json()) as SignupRequestBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const email = body.email?.trim() ?? ''
  const password = body.password ?? ''
  const fullName = body.fullName?.trim() ?? ''
  const role = body.role ?? 'consumer'
  const termsAcceptedAt = body.termsAcceptedAt?.trim() ?? ''
  const hostname = request.headers.get('host')

  if (!email || !password || !fullName) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const admission = parseAdmission(body)

  const passwordError = validateSignupPassword(password, admission, role)
  if (passwordError) {
    return NextResponse.json({ error: passwordError }, { status: 400 })
  }

  if (!termsAcceptedAt || Number.isNaN(Date.parse(termsAcceptedAt))) {
    return NextResponse.json({ error: 'Terms acceptance required' }, { status: 400 })
  }
  if (!['consumer', 'advisor', 'attorney'].includes(role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  }

  const admin = createAdminClient()

  const admissionResult = await validateSignupAdmission(admin, admission, {
    email,
    role,
    hostname,
  })
  if (!admissionResult.ok) {
    return NextResponse.json({ error: admissionResult.reason }, { status: admissionResult.status })
  }

  const effectiveRole = resolveEffectiveSignupRole(role, admission)
  const emailConfirm = resolveEmailConfirmForCreateUser(admission, hostname)

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: emailConfirm,
    user_metadata: {
      full_name: fullName,
      role: effectiveRole,
      terms_accepted_at: termsAcceptedAt,
    },
  })

  if (createError || !created.user) {
    const message = createError?.message ?? 'Failed to create account'
    if (isExistingUserError(message)) {
      return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 })
    }
    console.error('admin createUser error:', createError)
    return NextResponse.json({ error: 'Failed to create account' }, { status: 500 })
  }

  const userId = created.user.id

  const completion = await completeSignupAfterCreate({
    userId,
    email,
    fullName,
    role: effectiveRole,
    termsAcceptedAt,
    admission,
    referralCode: body.referralCode,
    referralSlug: body.referralSlug,
    attorneyReferralCode: body.attorneyReferralCode,
    attorneyReferralSlug: body.attorneyReferralSlug,
    betaLabel: body.betaLabel,
    betaAccessActive: body.betaAccessActive,
  })

  let nextPath = completion.nextPath
  const redirectTo = sanitizeSignupRedirect(body.redirectTo)
  if (
    redirectTo &&
    !nextPath.startsWith('/invite/') &&
    !nextPath.startsWith('/advisor/connect/')
  ) {
    nextPath = redirectTo
  }

  if (!emailConfirm) {
    return NextResponse.json(
      { userId, needsEmailConfirmation: true, nextPath },
      { status: 201 },
    )
  }

  const cookieStore = await cookies()
  const cookieMutations: Array<{
    name: string
    value: string
    options: Record<string, unknown>
  }> = []

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookieMutations.push(...cookiesToSet)
        },
      },
    },
  )

  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
  if (signInError) {
    console.error('signup signIn after create:', signInError)
    return NextResponse.json(
      { userId, needsEmailConfirmation: true, nextPath },
      { status: 201 },
    )
  }

  const response = NextResponse.json({ userId, session: true, nextPath }, { status: 201 })
  for (const { name, value, options } of cookieMutations) {
    response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2])
  }
  return response
}
