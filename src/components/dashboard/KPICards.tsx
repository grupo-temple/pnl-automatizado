'use client'

import type { CompanyData } from '@/lib/data/types'
import { fmt, pct, sumMonths } from '@/lib/utils/format'

interface Props {
  companyData:  CompanyData
  activeMonths: number[]
}

function getVal(companyData: CompanyData, key: string, months: number[]) {
  const vals = (companyData.real as any)[key] as (number | null)[] | undefined
  return vals ? sumMonths(vals, months) : null
}

export function KPICards({ companyData, activeMonths }: Props) {
  const ing    = getVal(companyData, 'Total Ingresos', activeMonths)
  const gas    = getVal(companyData, 'Total Gastos',   activeMonths)
  const ebitda = getVal(companyData, 'EBITDA',         activeMonths)
  const neto   = getVal(companyData, 'RDO. NETO',      activeMonths)

  const kpis = [
    {
      label:    'Ingresos Totales',
      cls:      'ingresos',
      value:    fmt(ing),
      pctLabel: ing && gas ? pct(ing - (gas ?? 0), ing) + ' margen' : '',
    },
    {
      label:    'Total Gastos',
      cls:      'gastos',
      value:    fmt(gas),
      pctLabel: ing ? pct(gas, ing) + ' s/ingresos' : '',
    },
    {
      label:    'EBITDA',
      cls:      'ebitda',
      value:    fmt(ebitda),
      pctLabel: ing ? pct(ebitda, ing) + ' margen' : '',
    },
    {
      label:    'RDO. NETO',
      cls:      'neto',
      value:    fmt(neto),
      pctLabel: ing ? pct(neto, ing) + ' margen neto' : '',
    },
  ]

  return (
    <div className="kpi-row">
      {kpis.map(k => (
        <div key={k.label} className={`kpi-card ${k.cls}`}>
          <div className="kpi-label">{k.label}</div>
          <div className={`kpi-value ${k.cls}`}>{k.value}</div>
          {k.pctLabel && (
            <div className="kpi-meta">
              <span className="kpi-pct">{k.pctLabel}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
