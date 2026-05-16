'use client'

import {
  EDUCATIONAL_TOPICS_EMPTY_MESSAGE,
  PLANNING_PREVALENCE_GROUP_LABELS,
  PLANNING_TOPICS_SECTION_INTRO,
  type EducationalTopicCard,
  groupEducationalTopicsByPrevalence,
  prevalenceBorderFor,
  softenEducationalCopy,
} from '@/lib/estate/planningTopicPresentation'

export type { EducationalTopicCard }

export function EducationalTopicsCards({
  topics,
  showIntro = true,
  cardClassName = 'p-3 bg-gray-50 rounded-lg border-l-4',
}: {
  topics: EducationalTopicCard[]
  showIntro?: boolean
  cardClassName?: string
}) {
  if (topics.length === 0) {
    return <p className="text-sm text-neutral-500 text-center py-6">{EDUCATIONAL_TOPICS_EMPTY_MESSAGE}</p>
  }

  const groups = groupEducationalTopicsByPrevalence(topics)

  return (
    <div className="space-y-4">
      {showIntro && <p className="text-sm text-neutral-500">{PLANNING_TOPICS_SECTION_INTRO}</p>}
      {groups.map(({ level, items }) => (
        <div key={level}>
          <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">
            {PLANNING_PREVALENCE_GROUP_LABELS[level]}
          </p>
          <div className="space-y-2">
            {items.map((topic, i) => (
              <div
                key={topic.key ?? `${topic.title}-${i}`}
                className={`${cardClassName} ${prevalenceBorderFor(topic.priority)}`}
              >
                <p className="text-sm font-semibold text-gray-900 mb-1">{topic.title}</p>
                <p className="text-sm text-gray-600">{softenEducationalCopy(topic.detail)}</p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
