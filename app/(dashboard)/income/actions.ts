'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function addIncome(ownerId: string, values: {
  source: string
  name?: string | null
  ss_person: string
  amount: number
  start_year: number
  end_year: number | null
  inflation_adjust: boolean
}) {
  const supabase = await createClient()
  const { error } = await supabase.from('income').insert({
    owner_id: ownerId,
    source: values.source,
    name: values.name ?? null,
    ss_person: values.ss_person,
    amount: values.amount,
    start_year: values.start_year,
    end_year: values.end_year,
    inflation_adjust: values.inflation_adjust,
  })
  if (error) throw new Error(error.message)
  revalidatePath('/income')
}

export async function updateIncome(id: string, ownerId: string, values: {
  source: string
  name?: string | null
  ss_person: string
  amount: number
  start_year: number
  end_year: number | null
  inflation_adjust: boolean
}) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('income')
    .update({
      source: values.source,
      name: values.name ?? null,
      ss_person: values.ss_person,
      amount: values.amount,
      start_year: values.start_year,
      end_year: values.end_year,
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
