import type { Metadata } from 'next'
import Link from 'next/link'
import { ButtonLink } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { getEventsGroupedForHub } from '@/lib/events/catalog'

export const metadata: Metadata = {
  title: 'Life Events | My Wealth Maps',
  description:
    'Major life events create planning needs that most households are not prepared for. Browse situations that may affect your financial, retirement, and estate picture.',
}

export default function EventsHubPage() {
  const groups = getEventsGroupedForHub()

  return (
    <div className="px-7 py-7">
      <Card className="hero card-surface border p-8 text-center">
        <div className="hero-badge">Life Events</div>
        <h1 className="education-title mt-5 text-4xl leading-tight">
          Life events that change your financial picture
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-[color:var(--text-secondary)]">
          Major life events create planning needs that most people aren&apos;t prepared for.
          Find your situation below.
        </p>
      </Card>

      <div className="divider mt-8" />

      {groups.map((group) => (
        <section key={group.key} className="pt-8 first:pt-0">
          <SectionHeader title={group.label} className="mb-6" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {group.events.map((event) => (
              <Card
                key={event.slug}
                className="flex h-full flex-col border p-5 transition-shadow hover:shadow-md"
              >
                <h2 className="text-base font-semibold text-[color:var(--text-primary)]">
                  {event.title}
                </h2>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-[color:var(--text-secondary)]">
                  {event.heroLine}
                </p>
                <Link
                  href={`/event/${event.slug}`}
                  className="mt-4 text-sm font-medium text-indigo-600 underline-offset-2 hover:underline"
                >
                  See what this means for your plan →
                </Link>
              </Card>
            ))}
          </div>
        </section>
      ))}

      <Card className="mt-10 border p-6 text-center">
        <p className="text-sm text-[color:var(--text-secondary)]">
          Not sure which applies?{' '}
          <ButtonLink href="/assess" variant="link" className="inline p-0 text-sm">
            Take our planning assessment →
          </ButtonLink>
        </p>
      </Card>
    </div>
  )
}
