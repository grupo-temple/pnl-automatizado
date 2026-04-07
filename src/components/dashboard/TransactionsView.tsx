'use client'

import { useState, useMemo } from 'react'
import type { Transaction } from '@/lib/data/transactions'
import type { CompanySlug } from '@/lib/data/types'
import { MONTHS } from '@/lib/data/pl-structure'

const GRUPOS = [
  'Total Ingresos',
  'Sueldos',
  'Gastos Personal',
  'Gastos Administrativos',
  'Gastos Marketing',
  'Tercerizados',
  'Otros',
]

const SOURCE_LABELS: Record<string, string> = {
  ingresos: 'Ingresos',
  egresos:  'Egresos',
  sueldos:  'Sueldos',
}

const COMPANY_LABELS: Record<string, string> = {
  tg: 'TG', cds: 'CDS', va: 'VA', consolidado: 'Consolidado',
}

function fmt(n: number | null) {
  if (n === null) return '—'
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
}

interface Props {
  transactions:   Transaction[]
  year:           number
  // Filtros iniciales opcionales (para drill-down desde P&L)
  initialCompany?: CompanySlug
  initialGrupo?:  string
  initialMonths?: number[]
}

export function TransactionsView({ transactions, year, initialCompany, initialGrupo, initialMonths }: Props) {
  const [empresa,  setEmpresa]  = useState<string>(initialCompany && initialCompany !== 'consolidado' ? initialCompany.toUpperCase() : 'todas')
  const [grupo,    setGrupo]    = useState<string>(initialGrupo ?? 'todos')
  const [source,   setSource]   = useState<string>('todos')
  const [mes,      setMes]      = useState<string>(
    initialMonths?.length === 1 ? String(initialMonths[0] + 1) : 'todos'
  )
  const [search,   setSearch]   = useState('')

  const filtered = useMemo(() => {
    return transactions.filter(tx => {
      if (empresa !== 'todas' && tx.company_slug.toUpperCase() !== empresa) return false
      if (grupo   !== 'todos' && tx.grupo_pl !== grupo) return false
      if (source  !== 'todos' && tx.source   !== source) return false
      if (mes     !== 'todos' && tx.month    !== parseInt(mes)) return false
      if (search) {
        const q = search.toLowerCase()
        if (
          !tx.descripcion?.toLowerCase().includes(q) &&
          !tx.categoria?.toLowerCase().includes(q) &&
          !tx.grupo_pl.toLowerCase().includes(q)
        ) return false
      }
      return true
    })
  }, [transactions, empresa, grupo, source, mes, search])

  const total = useMemo(() =>
    filtered.reduce((acc, tx) => acc + (tx.amount ?? 0), 0),
    [filtered]
  )

  return (
    <div className="table-card" style={{ marginTop: 0 }}>
      {/* FILTROS */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 20, alignItems: 'center' }}>
        <select className="form-input" style={{ width: 'auto', padding: '6px 10px' }} value={empresa} onChange={e => setEmpresa(e.target.value)}>
          <option value="todas">Todas las empresas</option>
          <option value="TG">TG</option>
          <option value="CDS">CDS</option>
          <option value="VA">VA</option>
        </select>

        <select className="form-input" style={{ width: 'auto', padding: '6px 10px' }} value={grupo} onChange={e => setGrupo(e.target.value)}>
          <option value="todos">Todos los grupos</option>
          {GRUPOS.map(g => <option key={g} value={g}>{g}</option>)}
        </select>

        <select className="form-input" style={{ width: 'auto', padding: '6px 10px' }} value={source} onChange={e => setSource(e.target.value)}>
          <option value="todos">Todas las fuentes</option>
          <option value="ingresos">Ingresos</option>
          <option value="egresos">Egresos</option>
          <option value="sueldos">Sueldos</option>
        </select>

        <select className="form-input" style={{ width: 'auto', padding: '6px 10px' }} value={mes} onChange={e => setMes(e.target.value)}>
          <option value="todos">Todos los meses</option>
          {MONTHS.map((m, i) => <option key={i} value={String(i + 1)}>{m}</option>)}
        </select>

        <input
          className="form-input"
          style={{ padding: '6px 10px', minWidth: 200 }}
          placeholder="Buscar descripción o categoría…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />

        {(empresa !== 'todas' || grupo !== 'todos' || source !== 'todos' || mes !== 'todos' || search) && (
          <button
            className="btn-sm"
            onClick={() => { setEmpresa('todas'); setGrupo('todos'); setSource('todos'); setMes('todos'); setSearch('') }}
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {/* RESUMEN */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>
          {filtered.length} registros
        </span>
        <span style={{ fontWeight: 600, fontSize: 14 }}>
          Total: {fmt(total)}
        </span>
      </div>

      {/* TABLA */}
      <div style={{ overflowX: 'auto' }}>
        <table className="pl-table">
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Mes</th>
              <th style={{ textAlign: 'left' }}>Empresa</th>
              <th style={{ textAlign: 'left' }}>Grupo P&L</th>
              <th style={{ textAlign: 'left' }}>Categoría</th>
              <th style={{ textAlign: 'left' }}>Descripción</th>
              <th style={{ textAlign: 'left' }}>Fuente</th>
              <th>Monto</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                  No hay registros con los filtros seleccionados
                </td>
              </tr>
            ) : (
              filtered.map(tx => (
                <tr key={tx.id}>
                  <td>{MONTHS[tx.month - 1]}</td>
                  <td>{tx.company_slug.toUpperCase()}</td>
                  <td>{tx.grupo_pl}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{tx.categoria ?? '—'}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{tx.descripcion ?? '—'}</td>
                  <td>
                    <span style={{
                      fontSize: 11,
                      padding: '2px 7px',
                      borderRadius: 10,
                      background: tx.source === 'ingresos' ? '#d1fae5' : tx.source === 'sueldos' ? '#dbeafe' : '#fef3c7',
                      color:      tx.source === 'ingresos' ? '#065f46' : tx.source === 'sueldos' ? '#1e40af' : '#92400e',
                    }}>
                      {SOURCE_LABELS[tx.source] ?? tx.source}
                    </span>
                  </td>
                  <td style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(tx.amount)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
