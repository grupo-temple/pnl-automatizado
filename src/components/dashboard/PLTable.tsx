'use client'

import { useState } from 'react'
import type { CompanyData, ViewMode, GrupoPL } from '@/lib/data/types'
import { PL_STRUCTURE, MONTHS } from '@/lib/data/pl-structure'
import { sumMonths, fmt, fmtFull, pct, delta } from '@/lib/utils/format'

interface Props {
  companyData:  CompanyData
  activeMonths: number[]
  view:         ViewMode
  tableTitle:   string
}

export function PLTable({ companyData, activeMonths, view, tableTitle }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  function toggleSection(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function expandAll()  { setExpanded(new Set(PL_STRUCTURE.filter(r => r.type === 'section').map(r => r.id))) }
  function collapseAll(){ setExpanded(new Set()) }

  // Determinar los tipos a mostrar según la vista
  const showReal  = view !== 'ppto' && view !== 'le'
  const showPpto  = view === 'ppto' || view === 'comp' || view === 'le_ppto'
  const showLE    = view === 'le'   || view === 'comp_le' || view === 'le_ppto'
  const showComp  = view === 'comp' || view === 'comp_le' || view === 'le_ppto'

  function getSum(tipo: 'real' | 'ppto' | 'le', key: string) {
    const vals = (companyData[tipo] as any)[key] as (number | null)[] | undefined
    return vals ? sumMonths(vals, activeMonths) : null
  }

  // Columnas del header
  const headers: string[] = []
  if (showReal)  headers.push('Real')
  if (showPpto)  headers.push('Ppto')
  if (showLE)    headers.push('LE')
  if (showComp) {
    if (view === 'comp')    headers.push('vs Ppto')
    if (view === 'comp_le') headers.push('vs LE')
    if (view === 'le_ppto') headers.push('LE vs Ppto')
  }
  headers.push('% s/Ing')

  const totalIngresos = getSum('real', 'Total Ingresos')

  const rows: React.ReactNode[] = []

  for (const row of PL_STRUCTURE) {
    if (row.type === 'section') {
      const isOpen = expanded.has(row.id)
      rows.push(
        <tr
          key={row.id}
          className="row-section-header"
          onClick={() => toggleSection(row.id)}
        >
          <td colSpan={headers.length + 1}>
            <div className="cell-name">
              <span className={`toggle-icon${isOpen ? ' open' : ''}`}>▶</span>
              {row.label}
            </div>
          </td>
        </tr>
      )
      // Filas de detalle (sin datos en MVP — solo labels)
      if (isOpen && row.children) {
        for (const child of row.children) {
          rows.push(
            <tr key={`${row.id}-${child}`} className="row-detail">
              <td>
                <div className="cell-name indent">{child}</div>
              </td>
              {headers.map((h, i) => <td key={i}>—</td>)}
            </tr>
          )
        }
      }
    } else if ((row.type === 'subtotal' || row.type === 'result') && row.key) {
      const realVal = getSum('real', row.key)
      const pptoVal = getSum('ppto', row.key)
      const leVal   = getSum('le',   row.key)

      const sign = row.sign ?? 1
      const disp = (v: number | null) => v !== null ? fmt(v * sign) : '—'

      // Columna de comparación
      let compVal: number | null = null
      if (view === 'comp')    compVal = delta(realVal, pptoVal)
      if (view === 'comp_le') compVal = delta(realVal, leVal)
      if (view === 'le_ppto') compVal = delta(leVal,   pptoVal)

      const cls = row.cls ?? (row.type === 'result' ? '' : '')

      rows.push(
        <tr key={row.id} className={cls}>
          <td>
            <div className="cell-name">{row.label}</div>
          </td>
          {showReal && <td>{disp(realVal)}</td>}
          {showPpto && <td>{disp(pptoVal)}</td>}
          {showLE   && <td>{disp(leVal)}</td>}
          {showComp && (
            <td>
              {compVal !== null ? (
                <span className={`cell-vs ${compVal >= 0 ? 'pos' : 'neg'}`}>
                  {compVal >= 0 ? '+' : ''}{compVal.toFixed(1)}%
                </span>
              ) : '—'}
            </td>
          )}
          <td>
            <span className="cell-pct">
              {pct(realVal ?? leVal, totalIngresos)}
            </span>
          </td>
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
      <div style={{ overflowX: 'auto' }}>
        <table className="pl-table">
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Concepto</th>
              {headers.map(h => <th key={h}>{h}</th>)}
            </tr>
          </thead>
          <tbody>{rows}</tbody>
        </table>
      </div>
    </div>
  )
}
