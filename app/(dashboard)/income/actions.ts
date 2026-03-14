'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { IncomeFormValues } from '@/lib/validations/income'

export async function addIncome(ownerId: string, values: IncomeFormValues) {
  const supabase = await createClient()
  const { error } = await supabase.from('income').insert({
    owner_id: ownerId,
    amount: values.amount,
    source: values.source,
    start_year: values.start_year,
    end_year: values.end_year === '' ? null : values.end_year,
    inflation_adjust: values.inflation_adjust,
  })
  if (error) throw new Error(error.message)
  revalidatePath('/income')
}

export async function updateIncome(
  id: string,
  ownerId: string,
  values: IncomeFormValues
) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('income')
    .update({
      amount: values.amount,
      source: values.source,
      start_year: values.start_year,
      end_year: values.end_year === '' ? null : values.end_year,
      inflation_adjust: values.inflation_adjust,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('owner_id', ownerId)
  if (error) throw new Error(error.message)
  revalidatePath('/income')
}

export async function deleteIncome(id: string, ownerId: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('income')
    .delete()
    .eq('id', id)
    .eq('owner_id', ownerId)
  if (error) throw new Error(error.message)
  revalidatePath('/income')
}
