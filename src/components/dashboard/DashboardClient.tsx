'use client'

import { useState, useMemo } from 'react'
import type { DashboardData, DashboardState, CompanySlug, ViewMode, AccumMode } from '@/lib/data/types'
import type { Transaction } from '@/lib/data/transactions'
import { MONTHS } from '@/lib/data/pl-structure'
import { sumMonths, fmt, fmtFull, pct, delta } from '@/lib/utils/format'
import { KPICards } from './KPICards'
import { EvolutionChart } from './EvolutionChart'
import { PeriodSelector } from './PeriodSelector'
import { VarianceBars } from './VarianceBars'
import { PLTable } from './PLTable'
import { TransactionsView } from './TransactionsView'

interface DrillDown {
  grupoPL:  string
  months:   number[]
  company:  CompanySlug
}

interface Props {
  data:           DashboardData
  year:           number
  monthsWithData: number[]
  transactions:   Transaction[]
  isAdmin:        boolean
}

export function DashboardClient({ data, year, monthsWithData, transactions, isAdmin }: Props) {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'registros'>('dashboard')
  const [drillDown, setDrillDown] = useState<DrillDown | null>(null)

  const [state, setState] = useState<DashboardState>({
    company:       'consolidado',
    view:          'real',
    accum:         'ytd',
    selectedMonth: null,
  })

  const activeMonths = useMemo(() => {
    if (state.accum === 'ytd') return monthsWithData
    if (state.selectedMonth !== null) return [state.selectedMonth]
    return monthsWithData
  }, [state.accum, state.selectedMonth, monthsWithData])

  const companyData = data[state.company]

  function handleDrillDown(grupoPL: string) {
    setDrillDown({ grupoPL, months: activeMonths, company: state.company })
    setActiveTab('registros')
  }

  function handleTabChange(tab: 'dashboard' | 'registros') {
    setActiveTab(tab)
    if (tab === 'dashboard') setDrillDown(null)
  }

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
          {isAdmin && (
            <a href="/admin" className="btn-admin">Admin</a>
          )}
          <span className="year-badge">{year}</span>
          <span className="last-update">
            {monthsWithData.length > 0
              ? `Datos hasta: ${MONTHS[monthsWithData[monthsWithData.length - 1]]} ${year}`
              : 'Sin datos cargados'}
          </span>
        </div>
      </header>

      {/* MAIN NAV TABS */}
      <nav className="company-nav" style={{ borderBottom: '1px solid var(--border)' }}>
        <button
          className={`company-tab${activeTab === 'dashboard' ? ' active' : ''}`}
          onClick={() => handleTabChange('dashboard')}
        >
          Dashboard
        </button>
        <button
          className={`company-tab${activeTab === 'registros' ? ' active' : ''}`}
          onClick={() => handleTabChange('registros')}
        >
          Registros
        </button>
      </nav>

      {activeTab === 'registros' ? (
        <main className="main">
          <div className="table-card" style={{ marginBottom: 0 }}>
            <div className="table-header-bar">
              <div>
                <div className="chart-title">
                  {drillDown
                    ? `Registros — ${drillDown.grupoPL} · ${companyLabel[drillDown.company]} · ${monthRange} ${year}`
                    : `Todos los registros — ${year}`}
                </div>
                <div className="chart-subtitle">
                  {drillDown
                    ? 'Filtrando desde el P&L — podés modificar los filtros abajo'
                    : 'Buscá y filtrá todas las transacciones cargadas'}
                </div>
              </div>
              {drillDown && (
                <button className="btn-sm" onClick={() => setDrillDown(null)}>
                  Ver todos
                </button>
              )}
            </div>
          </div>
          <TransactionsView
            transactions={transactions}
            year={year}
            initialCompany={drillDown?.company}
            initialGrupo={drillDown?.grupoPL}
            initialMonths={drillDown?.months}
          />
        </main>
      ) : (
        <>
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
            <KPICards
              companyData={companyData}
              activeMonths={activeMonths}
              view={state.view}
            />

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

            <PLTable
              companyData={companyData}
              activeMonths={activeMonths}
              view={state.view}
              tableTitle={tableTitle}
              onDrillDown={handleDrillDown}
            />
          </main>
        </>
      )}
    </div>
  )
}
