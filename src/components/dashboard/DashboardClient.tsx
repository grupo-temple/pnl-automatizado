'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import type { DashboardData, DashboardState, CompanySlug, AccumMode, RealTransaction } from '@/lib/data/types'
import { MONTHS } from '@/lib/data/pl-structure'
import { KPICards } from './KPICards'
import { EvolutionChart } from './EvolutionChart'
import { PeriodSelector } from './PeriodSelector'
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
  availableYears: number[]
  monthsWithData: number[]
  transactions:   RealTransaction[]
  isAdmin:        boolean
}

export function DashboardClient({ data, year, availableYears, monthsWithData, transactions, isAdmin }: Props) {
  const router = useRouter()
  const [activeView, setActiveView] = useState<'dashboard' | 'registros'>('dashboard')
  const [drillDown, setDrillDown] = useState<DrillDown | null>(null)

  const [state, setState] = useState<DashboardState>({
    company:       'consolidado',
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
    setActiveView('registros')
  }

  const monthRange = activeMonths.length > 0
    ? activeMonths.length === 1
      ? MONTHS[activeMonths[0]]
      : `${MONTHS[activeMonths[0]]}–${MONTHS[activeMonths[activeMonths.length - 1]]}`
    : '—'

  const companyLabel: Record<CompanySlug, string> = {
    consolidado: 'Consolidado', tg: 'TG', cds: 'CDS', va: 'VA'
  }
  const accumLabel = state.accum === 'ytd' ? 'YTD' : 'Mes'
  const tableTitle = `Estado de Resultados — ${companyLabel[state.company]} · ${accumLabel} ${monthRange} ${year}`

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
          {availableYears.length > 1 ? (
            <select
              className="year-select"
              value={year}
              onChange={e => router.push(`/dashboard?year=${e.target.value}`)}
            >
              {availableYears.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          ) : (
            <span className="year-badge">{year}</span>
          )}
          <span className="last-update">
            {monthsWithData.length > 0
              ? `Datos hasta: ${MONTHS[monthsWithData[monthsWithData.length - 1]]} ${year}`
              : 'Sin datos cargados'}
          </span>
        </div>
      </header>

      {/* COMPANY NAV */}
      <nav className="company-nav">
        {(['consolidado','tg','cds','va'] as CompanySlug[]).map(slug => (
          <button
            key={slug}
            className={`company-tab${activeView === 'dashboard' && state.company === slug ? ' active' : ''}`}
            onClick={() => { setActiveView('dashboard'); setState(s => ({ ...s, company: slug })) }}
          >
            {companyLabel[slug]}
          </button>
        ))}
        <button
          className={`company-tab tab-registros${activeView === 'registros' ? ' active' : ''}`}
          onClick={() => setActiveView('registros')}
        >
          Registros
        </button>
      </nav>

      {activeView === 'registros' ? (
        <main className="main">
          <div className="table-card" style={{ marginBottom: 0 }}>
            <div className="table-header-bar">
              <div>
                {drillDown ? (
                  <>
                    <div className="breadcrumb">
                      <span className="breadcrumb-item">Registros</span>
                      <span className="breadcrumb-sep">›</span>
                      <span className="breadcrumb-current">{drillDown.grupoPL}</span>
                      <span className="breadcrumb-sep">·</span>
                      <span className="breadcrumb-current">{companyLabel[drillDown.company]}</span>
                      <span className="breadcrumb-sep">·</span>
                      <span className="breadcrumb-current">{monthRange} {year}</span>
                    </div>
                    <div className="chart-subtitle">Filtrando desde el P&L — podés modificar los filtros abajo</div>
                  </>
                ) : (
                  <>
                    <div className="chart-title">Todos los registros — {year}</div>
                    <div className="chart-subtitle">Buscá y filtrá todas las transacciones cargadas</div>
                  </>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {drillDown && (
                  <button
                    className="btn-sm"
                    onClick={() => {
                      const prev = drillDown
                      setDrillDown(null)
                      setActiveView('dashboard')
                      setState(s => ({ ...s, company: prev.company }))
                    }}
                  >
                    ← Volver al P&L
                  </button>
                )}
                {drillDown && (
                  <button className="btn-sm" onClick={() => setDrillDown(null)}>
                    Ver todos
                  </button>
                )}
              </div>
            </div>
          </div>
          <TransactionsView
            transactions={transactions}
            year={year}
            initialCompany={drillDown?.company ?? state.company}
            initialGrupo={drillDown?.grupoPL}
            initialMonths={drillDown?.months}
          />
        </main>
      ) : (
        <>
          {/* PERIOD FILTER */}
          <div className="filters-bar">
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
            <select
              className="view-select-mobile"
              value={state.accum}
              onChange={e => {
                const a = e.target.value as AccumMode
                setState(s => ({
                  ...s,
                  accum: a,
                  selectedMonth: a === 'ytd' ? null : (s.selectedMonth ?? monthsWithData[monthsWithData.length - 1] ?? null),
                }))
              }}
            >
              <option value="ytd">YTD</option>
              <option value="mes">Mes seleccionado</option>
            </select>
          </div>

          {/* MAIN */}
          <main className="main">
            <KPICards
              companyData={companyData}
              activeMonths={activeMonths}
            />

            <div className="charts-grid">
              <EvolutionChart companyData={companyData} />
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
            </div>

            <PLTable
              companyData={companyData}
              activeMonths={activeMonths}
              tableTitle={tableTitle}
              onDrillDown={handleDrillDown}
            />
          </main>
        </>
      )}
    </div>
  )
}
