'use server'

import { redirect } from 'next/navigation'
import type { EmailOtpType } from '@supabase/supabase-js'
import { runPostAuthConfirmSideEffects } from '@/lib/auth/runPostAuthConfirmSideEffects'
import { createServerActionClient } from '@/lib/supabase/server'

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
