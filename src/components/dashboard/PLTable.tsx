'use client'

import { useState } from 'react'
import type { CompanyData, GrupoPL } from '@/lib/data/types'
import { PL_STRUCTURE } from '@/lib/data/pl-structure'
import { sumMonths, fmt, pct } from '@/lib/utils/format'

interface Props {
  companyData:  CompanyData
  activeMonths: number[]
  tableTitle:   string
  onDrillDown?: (grupoPL: string) => void
}

export function PLTable({ companyData, activeMonths, tableTitle, onDrillDown }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  function toggleSection(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function expandAll()   { setExpanded(new Set(PL_STRUCTURE.filter(r => r.type === 'section').map(r => r.id))) }
  function collapseAll() { setExpanded(new Set()) }

  function getSum(key: string) {
    const vals = (companyData.real as any)[key] as (number | null)[] | undefined
    return vals ? sumMonths(vals, activeMonths) : null
  }

  function getSubSum(categoria: string, subcat: string) {
    const vals = companyData.sub?.real?.[categoria]?.[subcat]
    return vals ? sumMonths(vals, activeMonths) : null
  }

  const totalIngresos = getSum('Total Ingresos')

  const rows: React.ReactNode[] = []

  for (const row of PL_STRUCTURE) {
    if (row.type === 'section') {
      const isOpen = expanded.has(row.id)
      rows.push(
        <tr key={row.id} className="row-section-header" onClick={() => toggleSection(row.id)}>
          <td colSpan={2}>
            <div className="cell-name">
              <span className={`toggle-icon${isOpen ? ' open' : ''}`}>▶</span>
              {row.label}
            </div>
          </td>
        </tr>
      )
      if (isOpen && row.children) {
        for (const child of row.children) {
          const catKey   = row.key
          const sign     = row.sign ?? 1
          const realVal  = catKey ? getSubSum(catKey, child) : null
          const disp     = realVal !== null ? fmt(realVal * sign) : '—'
          rows.push(
            <tr key={`${row.id}-${child}`} className="row-detail">
              <td><div className="cell-name indent">{child}</div></td>
              <td>{disp}</td>
            </tr>
          )
        }
      }
    } else if ((row.type === 'subtotal' || row.type === 'result') && row.key) {
      const realVal  = getSum(row.key)
      const sign     = row.sign ?? 1
      const disp     = realVal !== null ? fmt(realVal * sign) : '—'

      const canDrill = onDrillDown && row.key && !['Total Gastos', 'EBITDA', 'RDO. NETO'].includes(row.key)
      const cls      = [row.cls ?? '', canDrill ? 'row-drillable' : ''].filter(Boolean).join(' ')

      rows.push(
        <tr
          key={row.id}
          className={cls}
          onClick={canDrill ? () => onDrillDown!(row.key!) : undefined}
          title={canDrill ? 'Ver registros' : undefined}
        >
          <td>
            <div className="cell-name">
              {row.label}
              {canDrill && <span className="drill-icon">↗</span>}
            </div>
          </td>
          <td>{disp}</td>
        </tr>
      )
    }
  }

  return (
    <div className="table-card">
      <div className="table-header-bar">
        <div>
          <div className="chart-title">{tableTitle}</div>
          <div className="chart-subtitle">Valores en ARS · % sobre Ingresos</div>
        </div>
        <div className="table-controls">
          <button className="btn-sm" onClick={expandAll}>Expandir todo</button>
          <button className="btn-sm" onClick={collapseAll}>Colapsar todo</button>
        </div>
      </div>
      <div style={{ overflowX: 'auto' }} className="table-scroll-wrap">
        <table className="pl-table">
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Concepto</th>
              <th>Real</th>
            </tr>
          </thead>
          <tbody>{rows}</tbody>
        </table>
      </div>
    </div>
  )
}
