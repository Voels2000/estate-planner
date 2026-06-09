import { redirect } from 'next/navigation'
import { getAccessContext } from '@/lib/access/getAccessContext'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, isAdmin } = await getAccessContext()

  if (!user) redirect('/login')
  if (!isAdmin) redirect('/dashboard')

  return (
    <div className="min-h-screen bg-[var(--mwm-off-white)]">
      {children}
    </div>
  )
}
