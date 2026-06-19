import type { ComponentType } from 'react'

export type PreviewFixtureProps = Record<string, unknown>

export type PreviewVariant = {
  id: string
  label: string
  component: ComponentType<PreviewFixtureProps>
  fixture: PreviewFixtureProps
}

export type PreviewScreen = {
  id: string
  label: string
  variants: PreviewVariant[]
}

/** Preserve per-variant fixture typing at registration without `any`. */
export function definePreviewVariant<T extends PreviewFixtureProps>(variant: {
  id: string
  label: string
  component: ComponentType<T>
  fixture: T
}): PreviewVariant {
  return variant as PreviewVariant
}
