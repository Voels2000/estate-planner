import type { ExportProjectionRow, TaxSummaryExport } from '@/components/advisor/ExportPanel'
import type { ActionItem, MonteCarloSummary, ScenarioVersion } from '@/lib/export-wiring'

export type AdvisorExportPanelProps = {
  householdId: string
  scenarioId: string
  advisorName: string
  healthScore: number | null
  liquidAssets: number
  activeStrategies: string[]
  actionItems: ActionItem[]
  projectionData: ExportProjectionRow[]
  taxSummary: TaxSummaryExport | null
  monteCarloRun: boolean
  monteCarloResults: MonteCarloSummary | null
  liquidityShortfall: boolean
  scenarioHistory: ScenarioVersion[]
}
