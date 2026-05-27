import type { ReactNode } from 'react'

interface StrategyStepProps {
  step: 1 | 2 | 3
  title: string
  subtitle: string
  children: ReactNode
}

export function StrategyStep({ step, title, subtitle, children }: StrategyStepProps) {
  return (
    <section>
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[#0F1B3C] text-xs font-bold text-white">
          {step}
        </div>
        <div>
          <h2 className="text-base font-semibold leading-tight text-[#0F1B3C]">{title}</h2>
          <p className="text-xs text-gray-400">{subtitle}</p>
        </div>
      </div>
      <div className="ml-10">{children}</div>
    </section>
  )
}
