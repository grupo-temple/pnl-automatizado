'use client'

import { useState, useMemo } from 'react'
import type { DashboardData, DashboardState, CompanySlug, ViewMode, AccumMode } from '@/lib/data/types'
import { MONTHS } from '@/lib/data/pl-structure'
import { sumMonths, fmt, fmtFull, pct, delta } from '@/lib/utils/format'
import { KPICards } from './KPICards'
import { EvolutionChart } from './EvolutionChart'
import { PeriodSelector } from './PeriodSelector'
import { VarianceBars } from './VarianceBars'
import { PLTable } from './PLTable'

interface Props {
  data:           DashboardData
  year:           number
  monthsWithData: number[]
}

export function DashboardClient({ data, year, monthsWithData }: Props) {
  const [state, setState] = useState<DashboardState>({
    company:       'consolidado',
    view:          'real',
    accum:         'ytd',
    selectedMonth: null,
  })

  // Meses que se usan para el cálculo según acumulado
  const activeMonths = useMemo(() => {
    if (state.accum === 'ytd') return monthsWithData
    if (state.selectedMonth !== null) return [state.selectedMonth]
    return monthsWithData
  }, [state.accum, state.selectedMonth, monthsWithData])

  // Acceso rápido a los datos de la empresa seleccionada
  const companyData = data[state.company]

  // Helpers para obtener el valor sumado de un key
  function getVal(key: string, tipo: 'real' | 'ppto' | 'le') {
    const vals = (companyData[tipo] as any)[key] as (number | null)[]
    return vals ? sumMonths(vals, activeMonths) : null
  }

  // Título de la tabla
  const monthRange = activeMonths.length > 0
    ? activeMonths.length === 1
      ? MONTHS[activeMonths[0]]
      : `${MONTHS[activeMonths[0]]}–${MONTHS[activeMonths[activeMonths.length - 1]]}`
    : '—'

  const companyLabel: Record<CompanySlug, string> = {
    consolidado: 'Consolidado', tg: 'TG', cds: 'CDS', va: 'VA'
  }
  const accumLabel = state.accum === 'ytd' ? 'YTD' : 'Mes seleccionado'
  const tableTitle = `Estado de Resultados — ${companyLabel[state.company]} · ${accumLabel} ${monthRange} ${year}`

  const viewLabels: Record<ViewMode, string> = {
    real:     'Real',
    ppto:     'Presupuesto',
    le:       'LE',
    comp:     'Real vs Ppto',
    comp_le:  'Real vs LE',
    le_ppto:  'LE vs Ppto',
    yoy:      'YoY 2025',
  }

  return (
    <div>
      {/* HEADER */}
      <header className="header">
        <div className="header-left">
          <div className="logo">GRUPO TEMPLE <span>· Dashboard P&amp;L</span></div>
        </div>
        <div className="header-right">
          <span className="year-badge">{year}</span>
          <span className="last-update">
            {monthsWithData.length > 0
              ? `Datos hasta: ${MONTHS[monthsWithData[monthsWithData.length - 1]]} ${year}`
              : 'Sin datos cargados'}
          </span>
        </div>
      </header>

      {/* COMPANY TABS */}
      <nav className="company-nav">
        {(['consolidado','tg','cds','va'] as CompanySlug[]).map(slug => (
          <button
            key={slug}
            className={`company-tab${state.company === slug ? ' active' : ''}`}
            onClick={() => setState(s => ({ ...s, company: slug }))}
          >
            {companyLabel[slug]}
          </button>
        ))}
      </nav>

      {/* FILTERS BAR */}
      <div className="filters-bar">
        <span className="filter-label">Vista</span>
        <div className="pill-group">
          {(['real','ppto','le','comp','comp_le','le_ppto','yoy'] as ViewMode[]).map(v => (
            <button
              key={v}
              className={`pill${state.view === v ? ' active' : ''}`}
              onClick={() => setState(s => ({ ...s, view: v }))}
            >
              {viewLabels[v]}
            </button>
          ))}
        </div>
        <div className="divider" />
        <span className="filter-label">Acumulado</span>
        <div className="pill-group">
          {(['ytd','mes'] as AccumMode[]).map(a => (
            <button
              key={a}
              className={`pill${state.accum === a ? ' active' : ''}`}
              onClick={() => setState(s => ({
                ...s,
                accum: a,
                selectedMonth: a === 'ytd' ? null : (s.selectedMonth ?? monthsWithData[monthsWithData.length - 1] ?? null),
              }))}
            >
              {a === 'ytd' ? 'YTD' : 'Mes seleccionado'}
            </button>
          ))}
        </div>
      </div>

      {/* MAIN */}
      <main className="main">
        {/* KPI CARDS */}
        <KPICards
          companyData={companyData}
          activeMonths={activeMonths}
          view={state.view}
        />

        {/* CHARTS + PERIODO */}
        <div className="charts-grid">
          <EvolutionChart
            companyData={companyData}
            view={state.view}
          />
          <div className="periodo-card">
            <PeriodSelector
              monthsWithData={monthsWithData}
              selectedMonth={state.selectedMonth}
              accum={state.accum}
              onSelectMonth={(m) => setState(s => ({
                ...s,
                accum: 'mes',
                selectedMonth: m,
              }))}
            />
            <div>
              <div className="chart-title" style={{ marginBottom: 10 }}>
                {state.view.includes('le') ? 'Real vs LE' : 'Real vs Presupuesto'}
              </div>
              <VarianceBars
                companyData={companyData}
                activeMonths={activeMonths}
                compareType={state.view === 'comp_le' || state.view === 'le' ? 'le' : 'ppto'}
              />
            </div>
          </div>
        </div>

        {/* P&L TABLE */}
        <PLTable
          companyData={companyData}
          activeMonths={activeMonths}
          view={state.view}
          tableTitle={tableTitle}
        />
      </main>
    </div>
  )
}
