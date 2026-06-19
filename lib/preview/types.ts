import type { ComponentType } from 'react'

export type PreviewVariant = {
  id: string
  label: string
  component: ComponentType<any>
  fixture: unknown
}

export type PreviewScreen = {
  id: string
  label: string
  variants: PreviewVariant[]
}
