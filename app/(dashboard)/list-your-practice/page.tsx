import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function ListYourPracticePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_admin')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'advisor' && profile?.is_admin !== true) redirect('/dashboard')

  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <div className="mb-10 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-neutral-900">
          List Your Practice
        </h1>
        <p className="mt-3 text-neutral-500">
          Choose the type of practice you'd like to list. Each directory
          serves a different audience on the platform.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {/* Advisor card */}
        <Link
          href="/advisor-directory/register"
          className="group rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm
                     hover:border-indigo-300 hover:shadow-md transition-all"
        >
          <div className="mb-4 text-4xl">💼</div>
          <h2 className="text-lg font-semibold text-neutral-900 group-hover:text-indigo-700 transition-colors">
            Financial Advisor
          </h2>
          <p className="mt-2 text-sm text-neutral-500">
            List your advisory practice in the advisor directory. Consumers
            searching for financial guidance will be able to find and
            connect with you.
          </p>
          <span className="mt-6 inline-block text-sm font-medium text-indigo-600 group-hover:underline">
            Get listed as an advisor →
          </span>
        </Link>

        {/* Attorney card */}
        <Link
          href="/attorney-directory/register"
          className="group rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm
                     hover:border-indigo-300 hover:shadow-md transition-all"
        >
          <div className="mb-4 text-4xl">⚖️</div>
          <h2 className="text-lg font-semibold text-neutral-900 group-hover:text-indigo-700 transition-colors">
            Attorney
          </h2>
          <p className="mt-2 text-sm text-neutral-500">
            List your law practice in the attorney directory. Consumers
            needing estate planning legal services will be able to find
            and request referrals to your firm.
          </p>
          <span className="mt-6 inline-block text-sm font-medium text-indigo-600 group-hover:underline">
            Get listed as an attorney →
          </span>
        </Link>
      </div>
    </div>
  )
}
