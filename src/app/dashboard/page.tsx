import { getFinancialData, getMonthsWithData, getAvailableYears } from '@/lib/data/financial'
import { fetchTransactions } from '@/lib/data/transactions'
import { createClient } from '@/lib/supabase/server'
import { DashboardClient } from '@/components/dashboard/DashboardClient'
import '@/styles/dashboard.css'

export const revalidate = 300

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()

  const availableYears = await getAvailableYears()
  const defaultYear = availableYears[0] ?? new Date().getFullYear()
  const year = parseInt(params.year ?? String(defaultYear))

  const [{ data: { user } }, data, prevData, transactions] = await Promise.all([
    supabase.auth.getUser(),
    getFinancialData(year),
    getFinancialData(year - 1),
    fetchTransactions(year),
  ])

  const isAdmin = user?.user_metadata?.app_role === 'admin'
  const monthsWithData = getMonthsWithData(data)

  return (
    <DashboardClient
      data={data}
      prevData={prevData}
      year={year}
      availableYears={availableYears}
      monthsWithData={monthsWithData}
      transactions={transactions}
      isAdmin={isAdmin}
    />
  )
}
