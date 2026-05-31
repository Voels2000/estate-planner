import { CollapsibleSection } from '@/components/CollapsibleSection'
import EstateCompositionCard from '@/components/estate/EstateCompositionCard'
import type { EstateComposition } from '@/lib/estate/types'
import { fmtExact } from '@/app/(dashboard)/_components/dashboard/formatters'
import { hasEstateData } from '@/app/(dashboard)/_components/dashboard/state-helpers'

type EstateSummarySectionProps = {
  storageKey: string
  totalAssets: number
  netWorth: number
  composition?: EstateComposition | null
}

export function EstateSummarySection(props: EstateSummarySectionProps) {
  return (
    <CollapsibleSection
      title="Estate Summary"
      subtitle={
        hasEstateData({ totalAssets: props.totalAssets })
          ? `${fmtExact(props.netWorth)} net worth · estate composition`
          : 'Add assets to see your estate summary'
      }
      defaultOpen={false}
      storageKey={props.storageKey}
      locked={!hasEstateData({ totalAssets: props.totalAssets })}
      lockedMessage="Add your assets to see your estate composition."
      lockedHref="/assets"
      lockedHrefLabel="Add assets"
    >
      {props.composition && (
        <EstateCompositionCard composition={props.composition} label="Your Estate" snapshotLabel="Current snapshot" />
      )}
    </CollapsibleSection>
  )
}
