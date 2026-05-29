'use client'

import { ProfileFieldPrompt } from '@/components/profile/ProfileFieldPrompt'
import {
  needsSsPerson1,
  needsSsPerson2,
  ssFieldsForPerson1,
  ssFieldsForPerson2,
} from '@/lib/profile/profileFieldPromptDefs'
import type { SocialSecurityData } from '@/lib/social-security/loadSocialSecurityData'
import { SSClient } from './_ss-client'

type Props = {
  data: SocialSecurityData | null
  householdId: string
  person1Name: string
  person2Name: string
  householdSnapshot: Parameters<typeof ssFieldsForPerson1>[0]
}

export function SocialSecurityPageClient({
  data,
  householdId,
  person1Name,
  person2Name,
  householdSnapshot,
}: Props) {
  return (
    <>
      {needsSsPerson1(householdSnapshot) && (
        <ProfileFieldPrompt
          promptKey="ss_person1"
          title={`${person1Name}'s Social Security details`}
          description="Add your expected claiming age and estimated benefit to see a personalized Social Security projection."
          fields={ssFieldsForPerson1(householdSnapshot)}
          householdId={householdId}
        />
      )}
      {needsSsPerson2(householdSnapshot) && (
        <ProfileFieldPrompt
          promptKey="ss_person2"
          title={`${person2Name}'s Social Security details`}
          description="Add their claiming age and estimated benefit to include both Social Security incomes in the projection."
          fields={ssFieldsForPerson2(householdSnapshot)}
          householdId={householdId}
        />
      )}
      <SSClient data={data} />
    </>
  )
}
