import { createClient } from '@/lib/supabase/server'

export type UpgradeCopyVariant = 'personalized' | 'generic'
export type AssessmentGateVariant = 'score_visible' | 'full_gate'

export async function getUpgradeCopyVariant(): Promise<UpgradeCopyVariant> {
  try {
    const supabase = await createClient()
    const { data } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', 'ab_upgrade_copy')
      .single()
    const val = JSON.parse(data?.value ?? '"personalized"')
    return val === 'generic' ? 'generic' : 'personalized'
  } catch {
    return 'personalized'
  }
}

export async function getAssessmentGateVariant(): Promise<AssessmentGateVariant> {
  try {
    const supabase = await createClient()
    const { data } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', 'ab_assessment_gate')
      .single()
    const val = JSON.parse(data?.value ?? '"score_visible"')
    return val === 'full_gate' ? 'full_gate' : 'score_visible'
  } catch {
    return 'score_visible'
  }
}
