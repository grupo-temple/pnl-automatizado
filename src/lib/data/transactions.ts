'use server'

import { createClient } from '@/lib/supabase/server'
import type { RealTransaction } from './types'

export type { RealTransaction }

export async function fetchTransactions(year: number): Promise<RealTransaction[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('real_transactions')
    .select('*')
    .gte('fecha', `${year}-01-01`)
    .lt('fecha', `${year + 1}-01-01`)
    .order('fecha', { ascending: true })

  if (error) {
    console.error('Error fetching real_transactions:', error.message)
    return []
  }

  return (data as RealTransaction[]) ?? []
}
