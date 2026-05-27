'use client'

import type { AdvisorStrategyLineItemSummary } from '@/lib/estate/strategyLedger'
import type { StrategyQuestionNotification } from '@/components/advisor/ClientStrategyQuestionsCard'
import { AddRecommendationButton } from '@/components/advisor/strategy/AddRecommendationButton'

const MONEY = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

function formatStrategySource(source: string): string {
  const names: Record<string, string> = {
    grat: 'GRAT',
    slat: 'SLAT',
    ilit: 'ILIT',
    credit_shelter_trust: 'Credit Shelter Trust',
    cst: 'Credit Shelter Trust',
    daf: 'DAF',
    charitable: 'Charitable Strategy',
    annual_gifting: 'Annual Gifting Program',
    liquidity: 'Liquidity Strategy',
    roth: 'Roth Conversion',
    gifting: 'Gifting Strategy',
    revocable_trust: 'Revocable Trust',
  }
  return names[source] ?? source.replace(/_/g, ' ')
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function RecommendationRow({
  row,
  status,
}: {
  row: AdvisorStrategyLineItemSummary
  status: 'pending' | 'accepted' | 'declined'
}) {
  const statusConfig = {
    pending: { label: 'Awaiting response', color: 'text-amber-600 bg-amber-50 border-amber-200' },
    accepted: { label: 'Accepted', color: 'text-green-700 bg-green-50 border-green-200' },
    declined: { label: 'Declined', color: 'text-gray-500 bg-gray-50 border-gray-200' },
  }[status]

  const respondedAt = row.accepted_at ?? row.rejected_at

  return (
    <div className="flex items-center justify-between rounded-lg border border-gray-100 bg-white px-4 py-3">
      <div>
        <p className="text-sm font-medium text-gray-900">
          {formatStrategySource(row.strategy_source)}
        </p>
        <p className="mt-0.5 text-xs text-gray-400">
          {row.amount ? MONEY.format(row.amount) : 'Amount not specified'}
          {respondedAt ? ` · Responded ${formatDate(respondedAt)}` : ''}
        </p>
      </div>
      <span className={`rounded-full border px-3 py-1 text-xs font-medium ${statusConfig.color}`}>
        {statusConfig.label}
      </span>
    </div>
  )
}

interface RecommendationsPanelProps {
  strategyLineItems: AdvisorStrategyLineItemSummary[]
  strategyQuestions?: StrategyQuestionNotification[]
  onAddRecommendation: () => void
}

export function RecommendationsPanel({
  strategyLineItems,
  strategyQuestions = [],
  onAddRecommendation,
}: RecommendationsPanelProps) {
  const advisorRows = strategyLineItems.filter((r) => r.source_role === 'advisor')
  const pendingRows = advisorRows.filter((r) => !r.consumer_accepted && !r.consumer_rejected)
  const acceptedRows = advisorRows.filter((r) => r.consumer_accepted)
  const rejectedRows = advisorRows.filter((r) => r.consumer_rejected)

  return (
    <div className="space-y-4">
      {strategyQuestions.length > 0 && (
        <div className="mb-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-gray-400">
            Client Strategy Questions
          </p>
          <div className="space-y-2 rounded-lg border border-blue-100 bg-blue-50/40 px-4 py-3">
            {strategyQuestions.map((q) => {
              const strategyName =
                q.metadata.strategy_name ?? q.metadata.strategy_type ?? 'Strategy'
              return (
                <div key={q.id} className="text-sm text-gray-700">
                  <span className="font-medium">{strategyName}:</span> {q.title}
                  <span className="ml-2 text-xs text-gray-400">
                    {formatDate(q.created_at)}
                  </span>
                </div>
              )
            })}
            <p className="pt-1 text-xs text-gray-400">
              Respond by sending a recommendation in this tab or discussing at next meeting.
            </p>
          </div>
        </div>
      )}

      {advisorRows.length === 0 && (
        <div className="rounded-lg border border-dashed border-gray-200 px-4 py-6 text-center">
          <p className="text-sm font-medium text-gray-500">No recommendations sent yet</p>
          <p className="mt-1 text-xs text-gray-400">
            Use &quot;Model this →&quot; in Step 2 to build a recommendation, then send it to the
            client.
          </p>
        </div>
      )}

      {pendingRows.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-gray-400">
            Awaiting Client Response
          </p>
          <div className="space-y-2">
            {pendingRows.map((row) => (
              <RecommendationRow key={row.id} row={row} status="pending" />
            ))}
          </div>
        </div>
      )}

      {acceptedRows.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-gray-400">
            Accepted by Client
          </p>
          <div className="space-y-2">
            {acceptedRows.map((row) => (
              <RecommendationRow key={row.id} row={row} status="accepted" />
            ))}
          </div>
        </div>
      )}

      {rejectedRows.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-gray-400">
            Declined by Client
          </p>
          <div className="space-y-2">
            {rejectedRows.map((row) => (
              <RecommendationRow key={row.id} row={row} status="declined" />
            ))}
          </div>
        </div>
      )}

      <div className="pt-2">
        <AddRecommendationButton onAddRecommendation={onAddRecommendation} />
      </div>
    </div>
  )
}
