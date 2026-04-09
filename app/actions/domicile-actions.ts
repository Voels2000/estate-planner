'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function seedDomicileChecklist(
  householdId: string,
  toState: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const { data: analysis } = await supabase
    .from('domicile_analysis')
    .select('id')
    .eq('household_id', householdId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!analysis) return { success: false, error: 'No domicile analysis found' }

  const { getChecklistForState } = await import('@/lib/projection/domicileEngine')
  const items = getChecklistForState(toState)

  const rows = items.map(item => ({
    analysis_id: analysis.id,
    user_id:     user.id,
    category:    item.category,
    item_key:    item.item_key,
    label:       item.label,
    description: item.description,
    priority:    item.priority,
    completed:   false,
  }))

  const { error } = await supabase
    .from('domicile_checklist_items')
    .upsert(rows, { onConflict: 'analysis_id,item_key' })

  if (error) return { success: false, error: error.message }

  revalidatePath('/advisor/clients', 'layout')
  return { success: true }
}

export async function toggleChecklistItem(
  itemId: string,
  completed: boolean
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const { error } = await supabase
    .from('domicile_checklist_items')
    .update({
      completed:    !completed,
      completed_at: !completed ? new Date().toISOString() : null,
    })
    .eq('id', itemId)

  if (error) return { success: false, error: error.message }

  revalidatePath('/advisor/clients', 'layout')
  return { success: true }
}
