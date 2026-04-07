import { getFinancialData, getMonthsWithData } from '@/lib/data/financial'
import { fetchTransactions } from '@/lib/data/transactions'
import { createClient } from '@/lib/supabase/server'
import { DashboardClient } from '@/components/dashboard/DashboardClient'
import '@/styles/dashboard.css'

export const revalidate = 300

export default async function DashboardPage() {
  const year = new Date().getFullYear()
  const supabase = await createClient()

  const [{ data: { user } }, data, transactions] = await Promise.all([
    supabase.auth.getUser(),
    getFinancialData(year),
    fetchTransactions(year),
  ])

  const isAdmin = user?.user_metadata?.app_role === 'admin'
  const monthsWithData = getMonthsWithData(data)

  return (
    <DashboardClient
      data={data}
      year={year}
      monthsWithData={monthsWithData}
      transactions={transactions}
      isAdmin={isAdmin}
    />
  )
}
