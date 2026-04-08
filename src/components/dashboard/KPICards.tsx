'use client'

import type { CompanyData, ViewMode } from '@/lib/data/types'
import { fmt, pct, delta, sumMonths } from '@/lib/utils/format'

interface Props {
  companyData:  CompanyData
  activeMonths: number[]
  view:         ViewMode
}

function getVal(companyData: CompanyData, tipo: 'real' | 'ppto' | 'le', key: string, months: number[]) {
  const vals = (companyData[tipo] as any)[key] as (number | null)[] | undefined
  return vals ? sumMonths(vals, months) : null
}

export function KPICards({ companyData, activeMonths, view }: Props) {
  const ing    = getVal(companyData, 'real', 'Total Ingresos', activeMonths)
  const gas    = getVal(companyData, 'real', 'Total Gastos',   activeMonths)
  const ebitda = getVal(companyData, 'real', 'EBITDA',         activeMonths)
  const neto   = getVal(companyData, 'real', 'RDO. NETO',      activeMonths)

  // Tipo de comparación según la vista
  const isLE = view === 'le' || view === 'comp_le' || view === 'le_ppto'
  const compareType: 'ppto' | 'le' = isLE ? 'le' : 'ppto'
  const compareLabel = isLE ? 'LE' : 'ppto'

  // Si la vista es solo LE, mostrar valores LE en lugar de Real
  const showLE = view === 'le'
  const showPpto = view === 'ppto'

  const displayIng    = showLE ? getVal(companyData, 'le', 'Total Ingresos', activeMonths)
                      : showPpto ? getVal(companyData, 'ppto', 'Total Ingresos', activeMonths)
                      : ing
  const displayEbitda = showLE ? getVal(companyData, 'le', 'EBITDA', activeMonths)
                      : showPpto ? getVal(companyData, 'ppto', 'EBITDA', activeMonths)
                      : ebitda
  const displayNeto   = showLE ? getVal(companyData, 'le', 'RDO. NETO', activeMonths)
                      : showPpto ? getVal(companyData, 'ppto', 'RDO. NETO', activeMonths)
                      : neto
  const displayGas    = showLE ? getVal(companyData, 'le', 'Total Gastos', activeMonths)
                      : showPpto ? getVal(companyData, 'ppto', 'Total Gastos', activeMonths)
                      : gas

  const cmpIng    = getVal(companyData, compareType, 'Total Ingresos', activeMonths)
  const cmpEbitda = getVal(companyData, compareType, 'EBITDA',         activeMonths)
  const cmpNeto   = getVal(companyData, compareType, 'RDO. NETO',      activeMonths)
  const cmpGas    = getVal(companyData, compareType, 'Total Gastos',   activeMonths)

  const showCompare = view === 'comp' || view === 'comp_le' || view === 'le_ppto'

  function progressPct(real: number | null, cmp: number | null): number | null {
    if (real === null || cmp === null || cmp === 0) return null
    return Math.round((real / cmp) * 100)
  }

  const kpis = [
    {
      label:    'Ingresos Totales',
      cls:      'ingresos',
      value:    fmt(displayIng),
      pctLabel: displayIng && displayGas ? pct(displayIng - (displayGas ?? 0), displayIng) + ' margen' : '',
      d:        showCompare ? delta(ing, cmpIng) : null,
      vsLabel:  showCompare && cmpIng ? `vs ${compareLabel} ${fmt(cmpIng)}` : '',
      progress: progressPct(ing, cmpIng),
    },
    {
      label:    'Total Gastos',
      cls:      'gastos',
      value:    fmt(displayGas),
      pctLabel: displayIng ? pct(displayGas, displayIng) + ' s/ingresos' : '',
      d:        showCompare ? delta(gas, cmpGas) : null,
      vsLabel:  showCompare && cmpGas ? `vs ${compareLabel} ${fmt(cmpGas)}` : '',
      progress: progressPct(gas, cmpGas),
    },
    {
      label:    'EBITDA',
      cls:      'ebitda',
      value:    fmt(displayEbitda),
      pctLabel: displayIng ? pct(displayEbitda, displayIng) + ' margen' : '',
      d:        showCompare ? delta(ebitda, cmpEbitda) : null,
      vsLabel:  showCompare && cmpEbitda ? `vs ${compareLabel} ${fmt(cmpEbitda)}` : '',
      progress: progressPct(ebitda, cmpEbitda),
    },
    {
      label:    'RDO. NETO',
      cls:      'neto',
      value:    fmt(displayNeto),
      pctLabel: displayIng ? pct(displayNeto, displayIng) + ' margen neto' : '',
      d:        showCompare ? delta(neto, cmpNeto) : null,
      vsLabel:  showCompare && cmpNeto ? `vs ${compareLabel} ${fmt(cmpNeto)}` : '',
      progress: progressPct(neto, cmpNeto),
    },
  ]

  return (
    <div className="kpi-row">
      {kpis.map(k => (
        <div key={k.label} className={`kpi-card ${k.cls}`}>
          <div className="kpi-label">{k.label}</div>
          <div className={`kpi-value ${k.cls}`}>{k.value}</div>
          <div className="kpi-meta">
            {k.pctLabel && <span className="kpi-pct">{k.pctLabel}</span>}
            {k.d !== null && k.d !== undefined && (
              <span className={`delta ${k.d >= 0 ? 'up' : 'down'}`}>
                {Math.abs(k.d).toFixed(1)}%
              </span>
            )}
            {k.vsLabel && <span className="kpi-vs">{k.vsLabel}</span>}
          </div>
          {k.progress !== null && (
            <div className="kpi-progress-wrap">
              <div className="kpi-progress-track">
                <div
                  className={`kpi-progress-fill ${k.cls}${k.progress > 100 ? ' over' : ''}`}
                  style={{ width: `${Math.min(k.progress, 100)}%` }}
                />
              </div>
              <span className="kpi-progress-label">{k.progress}% del {compareLabel}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
