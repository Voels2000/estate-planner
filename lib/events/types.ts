export type EventUrgency = 'critical' | 'high' | 'moderate'
export type EventCategory =
  | 'business'
  | 'family'
  | 'health'
  | 'wealth'
  | 'retirement'

export type EventAssessmentQuestion = {
  id: string
  question: string
  options: { label: string; score: number; hint?: string }[]
}

export type EventAction = {
  priority: 1 | 2 | 3
  title: string
  description: string
  linkedFeature?: string
  professionalType?: 'advisor' | 'attorney' | 'cpa'
  urgencyDays?: number
}

export type EventContent = {
  slug: string
  title: string
  shortTitle: string
  category: EventCategory
  urgency: EventUrgency
  heroLine: string
  subhead: string
  whatChanges: string[]
  actions: EventAction[]
  assessmentQuestions: EventAssessmentQuestion[]
  advisorCTA: boolean
  attorneyCTA: boolean
  seoTitle: string
  seoDescription: string
  relatedSlugs: string[]
}
