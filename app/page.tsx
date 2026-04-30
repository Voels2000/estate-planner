import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { ButtonLink } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { SectionHeader } from '@/components/ui/SectionHeader'

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return (
      <main className="min-h-screen bg-neutral-50">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <header className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-neutral-900">PlanWise Guide</h1>
              <p className="text-sm text-neutral-500">Financial, Retirement, and Estate Education</p>
            </div>
            <div className="flex items-center gap-3">
              <ButtonLink href="/login" variant="secondary">Log in</ButtonLink>
              <ButtonLink href="/signup">Create account</ButtonLink>
            </div>
          </header>

          <section className="mt-16 grid grid-cols-1 gap-10 lg:grid-cols-2">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">
                Education first
              </p>
              <h2 className="mt-3 text-4xl font-semibold text-neutral-900">
                Plan with confidence.
                <br />
                Learn before you leap.
              </h2>
              <p className="mt-4 text-base leading-relaxed text-neutral-600">
                Build confidence with plain-English guides across financial, retirement, and estate planning.
                Then move into paid planning workflows when you are ready.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <ButtonLink href="/signup">Start free education</ButtonLink>
                <ButtonLink href="/pricing" variant="secondary">View plans</ButtonLink>
              </div>
              <p className="mt-3 text-xs text-neutral-500">
                Create an account to access the full education guide and track your progress.
              </p>
            </div>

            <Card className="rounded-2xl p-6">
              <h3 className="text-lg font-semibold text-neutral-900">What you get</h3>
              <ul className="mt-4 space-y-3 text-sm text-neutral-700">
                <li>📚 Structured education modules with progress tracking</li>
                <li>🌳 Decision tree paths and glossary for faster learning</li>
                <li>🧭 Advisor prep tools for better professional meetings</li>
                <li>🔓 Upgrade when ready to unlock planning workflows</li>
              </ul>
              <p className="mt-6 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Educational content is informational only and not legal, tax, financial, or investment advice.
              </p>
            </Card>
          </section>

          <section className="mt-10">
            <SectionHeader title="Featured learning modules" />
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              <Card className="rounded-lg px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">Foundation</p>
                <p className="mt-1 text-sm font-semibold text-neutral-900">Financial Planning Foundations</p>
                <p className="mt-1 text-xs text-neutral-600">Understand the six connected pillars of planning.</p>
              </Card>
              <Card className="rounded-lg px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">Intermediate</p>
                <p className="mt-1 text-sm font-semibold text-neutral-900">Probate vs Trust Comparison</p>
                <p className="mt-1 text-xs text-neutral-600">Compare transfer pathways and coordination gaps.</p>
              </Card>
              <Card className="rounded-lg px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">Advanced</p>
                <p className="mt-1 text-sm font-semibold text-neutral-900">Estate and Gift Tax Basics</p>
                <p className="mt-1 text-xs text-neutral-600">Review exemption, basis, and state-level themes.</p>
              </Card>
              <Card className="rounded-lg px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">Advisor prep</p>
                <p className="mt-1 text-sm font-semibold text-neutral-900">Questions to Ask Your Professionals</p>
                <p className="mt-1 text-xs text-neutral-600">Bring better questions into each planning meeting.</p>
              </Card>
            </div>
          </section>

          <section className="mt-12">
            <h3 className="text-xl font-semibold text-neutral-900">Three planning pillars</h3>
            <p className="mt-2 text-sm text-neutral-600">
              Start with education modules and build context before entering paid plan workflows.
            </p>
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
                <p className="text-sm font-semibold text-neutral-900">Financial Planning</p>
                <p className="mt-1 text-xs text-neutral-600">
                  Cash flow, insurance, taxes, and investment foundations.
                </p>
              </div>
              <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
                <p className="text-sm font-semibold text-neutral-900">Retirement Planning</p>
                <p className="mt-1 text-xs text-neutral-600">
                  Income sequencing, RMDs, Social Security, and longevity concepts.
                </p>
              </div>
              <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
                <p className="text-sm font-semibold text-neutral-900">Estate Planning</p>
                <p className="mt-1 text-xs text-neutral-600">
                  Documents, beneficiary coordination, transfer strategy, and tax context.
                </p>
              </div>
            </div>
          </section>

          <section className="mt-12 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
            <h3 className="text-xl font-semibold text-neutral-900">How access works</h3>
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Step 1</p>
                <p className="mt-1 text-sm font-medium text-neutral-900">Create account</p>
                <p className="mt-1 text-xs text-neutral-600">Login required before viewing education modules.</p>
              </div>
              <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Step 2</p>
                <p className="mt-1 text-sm font-medium text-neutral-900">Learn on-screen</p>
                <p className="mt-1 text-xs text-neutral-600">Education, glossary, and decision paths available in-app.</p>
              </div>
              <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Step 3</p>
                <p className="mt-1 text-sm font-medium text-neutral-900">Upgrade when ready</p>
                <p className="mt-1 text-xs text-neutral-600">Paid plan unlocks planning workflows and downloadable artifacts.</p>
              </div>
            </div>
          </section>

          <section className="mt-10 rounded-2xl border border-indigo-200 bg-indigo-50 p-6">
            <h3 className="text-lg font-semibold text-indigo-900">
              Education first. Living plan next.
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-indigo-900/90">
              PlanWise Guide teaches core concepts so you can make informed decisions. When you are ready,
              MyWealthMaps unlocks a connected planning suite to build and maintain a living plan across
              financial, retirement, and estate priorities.
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border border-indigo-200 bg-white px-2.5 py-1 text-indigo-700">
                Educational modules
              </span>
              <span className="rounded-full border border-indigo-200 bg-white px-2.5 py-1 text-indigo-700">
                Guided planning workflows
              </span>
              <span className="rounded-full border border-indigo-200 bg-white px-2.5 py-1 text-indigo-700">
                Ongoing living-plan updates
              </span>
            </div>
          </section>
        </div>
      </main>
    )
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .single()

  if (!profile) {
    redirect('/profile')
  }

  redirect('/education')
}
