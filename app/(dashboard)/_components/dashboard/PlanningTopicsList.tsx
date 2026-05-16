'use client'

import {
  EDUCATIONAL_TOPICS_EMPTY_MESSAGE,
  PLANNING_PREVALENCE_GROUP_LABELS,
  PLANNING_TOPIC_BORDER,
  PLANNING_TOPIC_BRANCH_LABELS,
  PLANNING_TOPICS_SECTION_INTRO,
  educationalPlanningTopicReason,
  type PlanningPrevalence,
} from '@/lib/estate/planningTopicPresentation'

export type PlanningTopicRow = {
  branch: string
  priority: PlanningPrevalence
  reason: string
}

const GROUP_ORDER: PlanningPrevalence[] = ['high', 'moderate', 'low']

export function PlanningTopicsList({
  topics,
  showIntro = true,
  cardClassName = 'p-3 bg-gray-50 rounded-lg border-l-4',
}: {
  topics: PlanningTopicRow[]
  showIntro?: boolean
  cardClassName?: string
}) {
  if (topics.length === 0) {
    return (
      <p className="text-xs text-neutral-500 py-2">{EDUCATIONAL_TOPICS_EMPTY_MESSAGE}</p>
    )
  }

  return (
    <div className="space-y-4">
      {showIntro && (
        <p className="text-sm text-neutral-500">{PLANNING_TOPICS_SECTION_INTRO}</p>
      )}
      {GROUP_ORDER.map((level) => {
        const group = topics.filter((t) => t.priority === level)
        if (group.length === 0) return null
        return (
          <div key={level}>
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">
              {PLANNING_PREVALENCE_GROUP_LABELS[level]}
            </p>
            <div className="space-y-2">
              {group.map((topic) => (
                <div
                  key={topic.branch}
                  className={`${cardClassName} ${PLANNING_TOPIC_BORDER[topic.priority] ?? 'border-l-slate-200'}`}
                >
                  <p className="text-sm font-semibold text-gray-900">
                    {PLANNING_TOPIC_BRANCH_LABELS[topic.branch] ?? topic.branch}
                  </p>
                  <p className="text-sm text-gray-600 mt-0.5">
                    {educationalPlanningTopicReason(topic.branch, topic.reason)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
