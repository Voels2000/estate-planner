'use client'

import type { ComponentProps } from 'react'
import SLATILITPanel from '@/components/advisor/SLATILITPanel'
import AdvancedStrategyPanel from '@/components/advisor/AdvancedStrategyPanel'

export type InlineSlatIlitPanelProps = ComponentProps<typeof SLATILITPanel>
export type InlineAdvancedPanelProps = ComponentProps<typeof AdvancedStrategyPanel>

export interface InlineStrategyPanelBundle {
  slatIlit: InlineSlatIlitPanelProps
  advanced: InlineAdvancedPanelProps
}

interface InlineStrategyPanelProps {
  panel: 'slat' | 'ilit' | 'advanced'
  chip: string
  panelProps: InlineStrategyPanelBundle
}

export function InlineStrategyPanel({ panel, chip, panelProps }: InlineStrategyPanelProps) {
  return (
    <div className="overflow-hidden rounded-b-lg">
      <div className="flex items-center gap-2 border-b border-[#0F1B3C]/10 bg-[#0F1B3C]/[0.03] px-4 py-2.5">
        <span className="text-xs font-semibold text-[#0F1B3C]">Modeling workspace</span>
        <span className="text-xs text-gray-400">— tune parameters, then mark as recommended</span>
      </div>

      <div className="bg-white">
        {(panel === 'slat' || panel === 'ilit') && (
          <SLATILITPanel
            key={chip}
            {...panelProps.slatIlit}
            initialActivePanel={chip as 'slat' | 'ilit'}
          />
        )}
        {panel === 'advanced' && (
          <AdvancedStrategyPanel
            key={chip}
            {...panelProps.advanced}
            initialActivePanel={chip}
          />
        )}
      </div>
    </div>
  )
}
