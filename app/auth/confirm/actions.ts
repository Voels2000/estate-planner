'use server'

import { redirect } from 'next/navigation'
import type { EmailOtpType } from '@supabase/supabase-js'
import { runPostAuthConfirmSideEffects } from '@/lib/auth/runPostAuthConfirmSideEffects'
import { syncOutreachProfessionalRole } from '@/lib/auth/syncOutreachProfessionalRole'
import { createServerActionClient } from '@/lib/supabase/server'

function safeNextPath(raw: string): string {
  const next = raw.trim()
  if (next.startsWith('/') && !next.startsWith('//')) return next
  return '/dashboard'
}

export async function confirmSignup(formData: FormData) {
  const tokenHash = String(formData.get('token_hash') ?? '')
  const type = String(formData.get('type') ?? '') as EmailOtpType

  if (!tokenHash || type !== 'signup') {
    redirect('/auth/confirm-error?reason=missing')
  }

  const supabase = await createServerActionClient()

  const { error } = await supabase.auth.verifyOtp({
    type: 'signup',
    token_hash: tokenHash,
  })

  if (error) {
    redirect('/auth/confirm-error?reason=invalid')
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    await runPostAuthConfirmSideEffects(user)
  }

  redirect('/dashboard')
}

/** Outreach / claim magic link — POST only so Outlook Safe Links cannot burn token_hash. */
export async function confirmMagicLink(formData: FormData) {
  const tokenHash = String(formData.get('token_hash') ?? '')
  const type = String(formData.get('type') ?? '') as EmailOtpType
  const next = safeNextPath(String(formData.get('next') ?? '/dashboard'))

  if (!tokenHash || type !== 'magiclink') {
    redirect('/auth/confirm-error?reason=missing')
  }

  const supabase = await createServerActionClient()

  const { error } = await supabase.auth.verifyOtp({
    type: 'magiclink',
    token_hash: tokenHash,
  })

  if (error) {
    redirect('/auth/confirm-error?reason=invalid')
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    await syncOutreachProfessionalRole(user)
    await runPostAuthConfirmSideEffects(user)
  }

  redirect(next)
}
