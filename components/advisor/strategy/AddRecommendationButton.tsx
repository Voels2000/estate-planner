'use client'

interface AddRecommendationButtonProps {
  onAddRecommendation: () => void
}

export function AddRecommendationButton({ onAddRecommendation }: AddRecommendationButtonProps) {
  return (
    <button
      type="button"
      onClick={onAddRecommendation}
      className="flex items-center gap-2 text-sm font-medium text-[#0F1B3C] transition-colors hover:text-[#C9A84C]"
    >
      <span className="text-lg leading-none">+</span>
      Send a recommendation to client
    </button>
  )
}
