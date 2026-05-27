'use client'

interface ModelStrategyButtonProps {
  strategyId: string
  hasRunModules: boolean
  onRunStrategyModules: () => void
}

export function ModelStrategyButton({
  strategyId,
  hasRunModules,
  onRunStrategyModules,
}: ModelStrategyButtonProps) {
  return (
    <button
      type="button"
      onClick={onRunStrategyModules}
      data-strategy-id={strategyId}
      className="whitespace-nowrap rounded border border-[#0F1B3C]/20 px-3 py-1.5 text-xs font-medium text-[#0F1B3C] transition-colors hover:border-[#C9A84C]/40 hover:text-[#C9A84C]"
    >
      {hasRunModules ? 'View model →' : 'Model this →'}
    </button>
  )
}
