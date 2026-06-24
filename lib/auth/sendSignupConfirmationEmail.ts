/**
 * Supabase admin.createUser does not send confirmation mail; trigger the same
 * /auth/v1/resend signup flow the confirm-email page uses.
 */
export async function sendSignupConfirmationEmail(
  email: string,
  emailRedirectTo: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  if (!supabaseUrl || !anonKey) {
    return { ok: false, error: 'Missing Supabase configuration' }
  }

  const res = await fetch(`${supabaseUrl}/auth/v1/resend`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
    body: JSON.stringify({
      type: 'signup',
      email: email.trim(),
      options: { emailRedirectTo },
    }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    return { ok: false, error: text || `resend failed (${res.status})` }
  }

  return { ok: true }
}
