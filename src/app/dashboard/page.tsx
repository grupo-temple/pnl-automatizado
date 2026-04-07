import { getFinancialData, getMonthsWithData } from '@/lib/data/financial'
import { fetchTransactions } from '@/lib/data/transactions'
import { DashboardClient } from '@/components/dashboard/DashboardClient'
import '@/styles/dashboard.css'

export const revalidate = 300

export default async function DashboardPage() {
  const year = new Date().getFullYear()
  const [data, transactions] = await Promise.all([
    getFinancialData(year),
    fetchTransactions(year),
  ])
  const monthsWithData = getMonthsWithData(data)

  return (
    <DashboardClient
      data={data}
      year={year}
      monthsWithData={monthsWithData}
      transactions={transactions}
    />
  )
}
