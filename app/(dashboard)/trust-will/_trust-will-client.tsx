'use client'

import { CollapsibleSection } from '@/components/CollapsibleSection'

type Rec = { title: string; description: string; priority: 'high' | 'medium' | 'low' }
type CheckItem = { task: string; completed: boolean }

const priorityColors = {
  high: 'bg-red-50 border-red-200 text-red-700',
  medium: 'bg-amber-50 border-amber-200 text-amber-700',
  low: 'bg-blue-50 border-blue-200 text-blue-700',
}

const priorityLabels = {
  high: 'High Priority',
  medium: 'Medium Priority',
  low: 'Good to Have',
}

export default function TrustWillClient({
  estateValue,
  recommendations,
  checklist,
}: {
  estateValue: number
  recommendations: Rec[]
  checklist: CheckItem[]
}) {
  return (
    <div className="max-w-3xl mx-auto px-6 py-10 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Trust & Will Guidance</h1>
        <p className="mt-2 text-sm text-neutral-500">
          Personalized recommendations based on your estate profile. This is guidance only —
          please consult a qualified estate planning attorney before taking action.
        </p>
      </div>

      <CollapsibleSection
        title="Estimated Estate Value"
        defaultOpen={true}
        storageKey="trust-will-estimated-estate-value"
      >
        <p className="text-2xl font-bold text-neutral-900">
          ${estateValue.toLocaleString()}
        </p>
      </CollapsibleSection>

      <CollapsibleSection
        title="Foundational Documents"
        defaultOpen={false}
        storageKey="trust-will-foundational-documents"
      >
        {recommendations.length === 0 ? (
          <p className="text-sm text-neutral-500">
            No specific recommendations at this time. Ensure your basic will is up to date.
          </p>
        ) : (
          <div className="space-y-3">
            {recommendations.map((rec) => (
              <div
                key={rec.title}
                className={`rounded-xl border px-5 py-4 ${priorityColors[rec.priority]}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <p className="font-semibold text-sm">{rec.title}</p>
                  <span className="text-xs font-medium opacity-70">
                    {priorityLabels[rec.priority]}
                  </span>
                </div>
                <p className="text-sm opacity-80">{rec.description}</p>
              </div>
            ))}
          </div>
        )}
      </CollapsibleSection>

      <CollapsibleSection
        title="Action Checklist"
        defaultOpen={false}
        storageKey="trust-will-action-checklist"
      >
        <div className="rounded-xl border border-neutral-200 bg-white divide-y divide-neutral-100 -m-2">
          {checklist.map((item, i) => (
            <div key={i} className="flex items-start gap-3 px-5 py-3">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-neutral-300 text-neutral-900"
                defaultChecked={item.completed}
              />
              <p className="text-sm text-neutral-700">{item.task}</p>
            </div>
          ))}
        </div>
      </CollapsibleSection>

      <p className="text-xs text-neutral-400 border-t border-neutral-100 pt-6">
        This guidance is generated based on information you have entered into Estate Planner.
        It is not legal advice. Always consult a licensed estate planning attorney in your state
        before making decisions about trusts, wills, or estate documents.
      </p>
    </div>
  )
}
