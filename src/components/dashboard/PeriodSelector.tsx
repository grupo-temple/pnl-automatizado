'use client'

import type { AccumMode } from '@/lib/data/types'
import { MONTHS } from '@/lib/data/pl-structure'

interface Props {
  monthsWithData: number[]
  selectedMonth:  number | null
  accum:          AccumMode
  onSelectMonth:  (m: number) => void
}

export function PeriodSelector({ monthsWithData, selectedMonth, accum, onSelectMonth }: Props) {
  const withDataSet = new Set(monthsWithData)

  return (
    <div>
      <div className="chart-title">Período</div>
      <div className="chart-subtitle" style={{ marginBottom: 10 }}>
        Seleccioná el mes a detallar
      </div>
      <div className="month-grid">
        {MONTHS.map((m, i) => {
          const hasData = withDataSet.has(i)
          const isActive = accum === 'mes' && selectedMonth === i
          return (
            <button
              key={m}
              className={[
                'month-btn',
                isActive   ? 'active'   : '',
                hasData    ? 'has-data' : '',
              ].filter(Boolean).join(' ')}
              onClick={() => onSelectMonth(i)}
              disabled={!hasData}
              title={hasData ? m : `${m} (sin datos)`}
            >
              {m}
            </button>
          )
        })}
      </div>
    </div>
  )
}
