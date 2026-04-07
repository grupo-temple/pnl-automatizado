import { getFinancialData, getMonthsWithData } from '@/lib/data/financial'
import { DashboardClient } from '@/components/dashboard/DashboardClient'
import '@/styles/dashboard.css'

// Revalidar cada 5 minutos (los datos no cambian en tiempo real)
export const revalidate = 300

export default async function DashboardPage() {
  const year = new Date().getFullYear()
  const data = await getFinancialData(year)
  const monthsWithData = getMonthsWithData(data)

  return (
    <DashboardClient
      data={data}
      year={year}
      monthsWithData={monthsWithData}
    />
  )
}
