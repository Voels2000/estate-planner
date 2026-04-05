import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LoginForm } from './_login-form'

function LoginFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 font-sans dark:bg-zinc-950">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
        <div className="h-9 w-48 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
        <div className="mt-2 h-4 w-64 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
        <div className="mt-6 space-y-5">
          <div className="h-10 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
          <div className="h-10 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
          <div className="h-10 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-700" />
        </div>
      </div>
    </div>
  )
}

export default async function LoginPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, subscription_status, firm_role, is_superuser')
      .eq('id', user.id)
      .single()

    if (profile?.is_superuser) redirect('/dashboard')

    if (profile?.role === 'attorney') redirect('/attorney')

    if (profile?.role === 'advisor') {
      if (profile?.firm_role === 'member') redirect('/advisor')
      const hasActiveSub = ['active', 'trialing', 'canceling'].includes(
        profile?.subscription_status ?? ''
      )
      redirect(hasActiveSub ? '/advisor' : '/billing')
    }

    redirect('/dashboard')
  }

  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginForm />
    </Suspense>
  )
}
