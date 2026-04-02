import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AttorneySignOut } from './_components/attorney-sign-out'

export default async function AttorneyLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_attorney')
    .eq('id', user.id)
    .single()

  const isAttorney = profile?.role === 'attorney' || profile?.is_attorney === true

  if (!isAttorney) {
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-neutral-200">
        <h1 className="text-lg font-bold text-neutral-900">Estate Planner</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-neutral-500">{user.email}</span>
          <AttorneySignOut />
        </div>
      </div>
      <main className="flex-1">
        {children}
      </main>
    </div>
  )
}
