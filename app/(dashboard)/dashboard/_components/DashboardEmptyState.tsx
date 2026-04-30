import { ButtonLink } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

export function DashboardEmptyState() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-12">
      <Card className="flex flex-col items-center justify-center border-dashed border-neutral-300 py-16 text-center">
        <div className="text-4xl mb-3">🏡</div>
        <p className="text-sm font-medium text-neutral-800">My Estate Plan is not set up yet</p>
        <p className="mt-1 max-w-md text-xs text-neutral-500">
          We could not find a household profile for this account. Complete your profile to create your
          estate plan workspace.
        </p>
        <div className="mt-6">
          <ButtonLink href="/profile" size="sm">
            Complete profile setup →
          </ButtonLink>
        </div>
      </Card>
    </div>
  )
}
