import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-neutral-50 py-16 px-4">
      <div className="mx-auto max-w-5xl">
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-neutral-900 tracking-tight">
            Welcome back
          </h1>
          <p className="mt-2 text-neutral-600">
            {user.email}
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <DashboardCard
            title="Income"
            description="Track your income sources"
            href="/income"
            icon="💰"
          />
          <DashboardCard
            title="Projections"
            description="View retirement projections"
            href="/projections"
            icon="📈"
          />
          <DashboardCard
            title="Billing"
            description="Manage your subscription"
            href="/billing"
            icon="💳"
          />
        </div>
      </div>
    </div>
  )
}

function DashboardCard({
  title,
  description,
  href,
  icon,
}: {
  title: string
  description: string
  href: string
  icon: string
}) {
  return (
    <Link
      href={href}
      className="block rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm transition hover:shadow-md"
    >
      <div className="text-3xl mb-3">{icon}</div>
      <h2 className="text-lg font-semibold text-neutral-900">{title}</h2>
      <p className="mt-1 text-sm text-neutral-600">{description}</p>
    </Link>
  )
}
