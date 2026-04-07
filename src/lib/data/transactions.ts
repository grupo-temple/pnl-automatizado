'use server'

import { createClient } from '@/lib/supabase/server'

export interface Transaction {
  id:           string
  company_slug: string
  year:         number
  month:        number
  data_type:    string
  grupo_pl:     string
  categoria:    string | null
  descripcion:  string | null
  amount:       number | null
  source:       string
}

export async function fetchTransactions(year: number): Promise<Transaction[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('transactions')
    .select(`
      id,
      year,
      month,
      data_type,
      grupo_pl,
      categoria,
      descripcion,
      amount,
      source,
      companies!inner(slug)
    `)
    .eq('year', year)
    .order('month', { ascending: true })

  if (error) {
    console.error('Error fetching transactions:', error.message)
    return []
  }

  return (data as any[]).map(row => ({
    id:           row.id,
    company_slug: row.companies?.slug ?? '',
    year:         row.year,
    month:        row.month,
    data_type:    row.data_type,
    grupo_pl:     row.grupo_pl,
    categoria:    row.categoria,
    descripcion:  row.descripcion,
    amount:       row.amount,
    source:       row.source,
  }))
}
