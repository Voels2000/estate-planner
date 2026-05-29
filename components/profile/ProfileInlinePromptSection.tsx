'use client'

import {
  ProfileIncompleteInlinePrompt,
  type ProfileInlineField,
} from '@/components/profile/ProfileIncompleteInlinePrompt'
import type { ProfileSavePayload } from '@/lib/profile/buildHouseholdPayload'

type Props = {
  title: string
  description: string
  fields: ProfileInlineField[]
  basePayload: ProfileSavePayload
}

export function ProfileInlinePromptSection(props: Props) {
  return <ProfileIncompleteInlinePrompt {...props} />
}
