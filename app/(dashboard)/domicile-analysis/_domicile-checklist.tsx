'use client'

import type { DomicileChecklistRow } from './types'

const CATEGORY_LABELS: Record<string, string> = {
  legal_docs: 'Legal documents',
  financial: 'Financial',
  physical_presence: 'Physical presence',
  government_records: 'Government records',
  social_ties: 'Social ties',
}

const CATEGORY_ORDER = [
  'government_records',
  'legal_docs',
  'financial',
  'physical_presence',
  'social_ties',
]

interface Props {
  items: DomicileChecklistRow[]
  onToggle: (itemId: string, completed: boolean) => void
}

export default function DomicileChecklist({ items, onToggle }: Props) {
  const completedCount = items.filter((i) => i.completed).length
  const totalCount = items.length
  const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  const grouped = CATEGORY_ORDER.reduce<Record<string, DomicileChecklistRow[]>>(
    (acc, cat) => {
      const catItems = items.filter((i) => i.category === cat)
      if (catItems.length > 0) acc[cat] = catItems
      return acc
    },
    {}
  )

  items.forEach((item) => {
    if (!CATEGORY_ORDER.includes(item.category)) {
      if (!grouped[item.category]) grouped[item.category] = []
      if (!grouped[item.category].find((i) => i.id === item.id)) {
        grouped[item.category].push(item)
      }
    }
  })

  if (items.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-gray-500">
        No checklist items found. Run an analysis first to generate your personalised action
        checklist.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-medium text-gray-700">Domicile establishment progress</p>
          <p className="text-sm text-gray-600">
            {completedCount} of {totalCount} complete
          </p>
        </div>
        <div className="h-2 w-full rounded-full border border-gray-200 bg-white">
          <div
            className="h-2 rounded-full bg-blue-500 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="mt-1 text-xs text-gray-400">{pct}% complete</p>
      </div>

      {items.some((i) => i.priority === 'high' && !i.completed) && (
        <div>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-red-700">
            <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
            High priority — address these first
          </h2>
          <div className="space-y-2">
            {items
              .filter((i) => i.priority === 'high' && !i.completed)
              .map((item) => (
                <ChecklistRow key={item.id} item={item} onToggle={onToggle} />
              ))}
          </div>
        </div>
      )}

      {Object.entries(grouped).map(([category, catItems]) => {
        const rows = catItems.filter((i) => !(i.priority === 'high' && !i.completed))
        if (rows.length === 0) return null
        return (
          <div key={category}>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-gray-700">
              <span className="inline-block h-2 w-2 rounded-full bg-gray-400" />
              {CATEGORY_LABELS[category] ?? category}
              <span className="font-normal text-gray-400">
                ({catItems.filter((i) => i.completed).length}/{catItems.length})
              </span>
            </h2>
            <div className="space-y-2">
              {rows.map((item) => (
                <ChecklistRow key={item.id} item={item} onToggle={onToggle} />
              ))}
            </div>
          </div>
        )
      })}

      {completedCount === totalCount && totalCount > 0 && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-center">
          <p className="text-sm font-medium text-green-800">All items complete</p>
          <p className="mt-1 text-sm text-green-700">
            Your domicile establishment actions are fully documented. Consider re-running your
            analysis to confirm your risk score has improved.
          </p>
        </div>
      )}
    </div>
  )
}

function ChecklistRow({
  item,
  onToggle,
}: {
  item: DomicileChecklistRow
  onToggle: (id: string, completed: boolean) => void
}) {
  return (
    <div
      className={`flex gap-3 rounded-lg border p-3 transition-colors ${
        item.completed
          ? 'border-gray-100 bg-gray-50'
          : item.priority === 'high'
            ? 'border-red-100 bg-white'
            : 'border-gray-200 bg-white'
      }`}
    >
      <input
        type="checkbox"
        checked={item.completed}
        onChange={(e) => onToggle(item.id, e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-gray-300 text-blue-600"
        aria-label={`Done: ${item.label}`}
      />
      <div className="min-w-0 flex-1">
        <p
          className={`text-sm font-medium ${item.completed ? 'text-gray-400 line-through' : 'text-gray-900'}`}
        >
          {item.label}
          {item.priority === 'high' && !item.completed && (
            <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-xs text-red-700">
              high priority
            </span>
          )}
        </p>
        {item.description && (
          <p
            className={`mt-0.5 text-xs ${item.completed ? 'text-gray-400' : 'text-gray-500'}`}
          >
            {item.description}
          </p>
        )}
        {item.completed && item.completed_at && (
          <p className="mt-0.5 text-xs text-gray-400">
            Completed {new Date(item.completed_at).toLocaleDateString()}
          </p>
        )}
      </div>
    </div>
  )
}
