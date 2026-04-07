'use client'

import type { CompanyData } from '@/lib/data/types'
import { sumMonths, pct, delta } from '@/lib/utils/format'

const VARIANCE_KEYS = [
  { key: 'Total Ingresos',          label: 'Ingresos'  },
  { key: 'Sueldos',                 label: 'Sueldos'   },
  { key: 'Gastos Personal',         label: 'G. Personal' },
  { key: 'Gastos Administrativos',  label: 'G. Adm.'   },
  { key: 'Gastos Marketing',        label: 'G. Mkt.'   },
  { key: 'EBITDA',                  label: 'EBITDA'    },
] as const

interface Props {
  companyData:  CompanyData
  activeMonths: number[]
  compareType:  'ppto' | 'le'
}

export function VarianceBars({ companyData, activeMonths, compareType }: Props) {
  return (
    <div className="variance-section">
      {VARIANCE_KEYS.map(({ key, label }) => {
        const realVals = (companyData.real as any)[key] as (number | null)[]
        const cmpVals  = (companyData[compareType] as any)[key] as (number | null)[]
        const realVal  = realVals ? sumMonths(realVals, activeMonths) : null
        const cmpVal   = cmpVals  ? sumMonths(cmpVals,  activeMonths) : null
        const d        = delta(realVal, cmpVal)
        const isPos    = d !== null && d >= 0

        // Barra proporcional: máx 100%
        const barPct = d !== null ? Math.min(Math.abs(d), 100) : 0

        return (
          <div key={key} className="variance-row">
            <span className="var-label" title={label}>{label}</span>
            <div className="var-bar-track">
              <div
                className="var-bar-fill"
                style={{
                  width: `${barPct}%`,
                  background: isPos ? 'var(--positive)' : 'var(--negative)',
                }}
              />
            </div>
            <span className={`var-pct ${d === null ? '' : isPos ? 'pos' : 'neg'}`}>
              {d === null ? '—' : (isPos ? '+' : '') + d.toFixed(1) + '%'}
            </span>
          </div>
        )
      })}
    </div>
  )
}
