import { createClient } from '@/lib/supabase/server'
import type { StateEstateTaxData } from './state-estate-tax-types'

export async function getStateEstateTaxData(
  stateCode: string,
): Promise<StateEstateTaxData | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('state_estate_tax_content')
    .select('*')
    .eq('state_code', stateCode.toUpperCase())
    .single()

  if (error || !data) return null
  return data as StateEstateTaxData
}

export async function getAllStateEstateTaxData(): Promise<StateEstateTaxData[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('state_estate_tax_content')
    .select('*')
    .order('state_name', { ascending: true })

  if (error || !data) return []
  return data as StateEstateTaxData[]
}
