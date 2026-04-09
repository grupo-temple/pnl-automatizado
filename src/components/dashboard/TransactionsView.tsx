'use client'

import { useState, useMemo } from 'react'
import type { RealTransaction } from '@/lib/data/types'
import type { CompanySlug } from '@/lib/data/types'
import { MONTHS } from '@/lib/data/pl-structure'

const CATEGORIAS = [
  'Total Ingresos',
  'Sueldos',
  'Gastos Personal',
  'Gastos Administrativos',
  'Gastos Marketing',
  'Tercerizados',
  'Otros',
]

const TIPO_LABELS: Record<string, string> = {
  Ingreso: 'Ingreso',
  Egreso:  'Egreso',
  Sueldo:  'Sueldo',
}

function fmt(n: number | null) {
  if (n === null) return '—'
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
}

function monthFromFecha(fecha: string): number {
  // fecha es 'YYYY-MM-DD' — extraer mes sin construir un Date (evita timezone)
  return parseInt(fecha.substring(5, 7))
}

function formatFecha(fecha: string): string {
  const [year, month, day] = fecha.split('-')
  return `${day}/${month}/${year}`
}

interface Props {
  transactions:    RealTransaction[]
  year:            number
  initialCompany?: CompanySlug
  initialGrupo?:   string    // valor de categoria (drill-down desde PLTable)
  initialMonths?:  number[]
}

export function TransactionsView({ transactions, year, initialCompany, initialGrupo, initialMonths }: Props) {
  const [filtersOpen, setFiltersOpen] = useState(true)
  const [empresa,   setEmpresa]   = useState<string>(
    initialCompany && initialCompany !== 'consolidado' ? initialCompany.toUpperCase() : 'todas'
  )
  const [categoria, setCategoria] = useState<string>(initialGrupo ?? 'todos')
  const [tipo,      setTipo]      = useState<string>('todos')
  const [mes,       setMes]       = useState<string>(
    initialMonths?.length === 1 ? String(initialMonths[0] + 1) : 'todos'
  )
  const [search,    setSearch]    = useState('')

  const filtered = useMemo(() => {
    return transactions.filter(tx => {
      if (empresa   !== 'todas' && tx.sociedad  !== empresa) return false
      if (categoria !== 'todos' && tx.categoria !== categoria) return false
      if (tipo      !== 'todos' && tx.tipo      !== tipo) return false
      if (mes       !== 'todos' && monthFromFecha(tx.fecha) !== parseInt(mes)) return false
      if (search) {
        const q = search.toLowerCase()
        if (
          !tx.razon_social?.toLowerCase().includes(q) &&
          !tx.cuit?.toLowerCase().includes(q) &&
          !tx.nro_factura?.toLowerCase().includes(q) &&
          !tx.observaciones?.toLowerCase().includes(q) &&
          !tx.categoria.toLowerCase().includes(q) &&
          !tx.sub_categoria?.toLowerCase().includes(q)
        ) return false
      }
      return true
    })
  }, [transactions, empresa, categoria, tipo, mes, search])

  const total = useMemo(() =>
    filtered.reduce((acc, tx) => acc + (tx.neto ?? 0), 0),
    [filtered]
  )

  const hasActiveFilters = empresa !== 'todas' || categoria !== 'todos' || tipo !== 'todos' || mes !== 'todos' || search

  return (
    <div className="table-card" style={{ marginTop: 0 }}>
      {/* FILTROS */}
      <button
        className={`filters-toggle-btn${filtersOpen ? ' open' : ''}`}
        onClick={() => setFiltersOpen(o => !o)}
        style={{ marginBottom: filtersOpen ? 10 : 20 }}
      >
        ⚙ Filtros {filtersOpen ? '▲' : '▼'}
      </button>

      <div className={`filters-panel${filtersOpen ? '' : ' collapsed'}`} style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 20, alignItems: 'center' }}>
        <select className="form-input" style={{ width: 'auto', padding: '6px 10px' }} value={empresa} onChange={e => setEmpresa(e.target.value)}>
          <option value="todas">Todas las empresas</option>
          <option value="TG">TG</option>
          <option value="CDS">CDS</option>
          <option value="VA">VA</option>
        </select>

        <select className="form-input" style={{ width: 'auto', padding: '6px 10px' }} value={categoria} onChange={e => setCategoria(e.target.value)}>
          <option value="todos">Todas las categorías</option>
          {CATEGORIAS.map(g => <option key={g} value={g}>{g}</option>)}
        </select>

        <select className="form-input" style={{ width: 'auto', padding: '6px 10px' }} value={tipo} onChange={e => setTipo(e.target.value)}>
          <option value="todos">Todos los tipos</option>
          <option value="Ingreso">Ingreso</option>
          <option value="Egreso">Egreso</option>
          <option value="Sueldo">Sueldo</option>
        </select>

        <select className="form-input" style={{ width: 'auto', padding: '6px 10px' }} value={mes} onChange={e => setMes(e.target.value)}>
          <option value="todos">Todos los meses</option>
          {MONTHS.map((m, i) => <option key={i} value={String(i + 1)}>{m}</option>)}
        </select>

        <input
          className="form-input"
          style={{ padding: '6px 10px', minWidth: 200 }}
          placeholder="Buscar razón social, CUIT, factura…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />

        {hasActiveFilters && (
          <button
            className="btn-sm"
            onClick={() => { setEmpresa('todas'); setCategoria('todos'); setTipo('todos'); setMes('todos'); setSearch('') }}
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
          Neto total: {fmt(total)}
        </span>
      </div>

      {/* TABLA */}
      <div style={{ overflowX: 'auto' }}>
        <table className="pl-table transactions-table">
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Fecha</th>
              <th style={{ textAlign: 'left' }}>Empresa</th>
              <th style={{ textAlign: 'left' }}>Categoría</th>
              <th style={{ textAlign: 'left' }}>Sub-Categoría</th>
              <th style={{ textAlign: 'left' }}>Tipo</th>
              <th style={{ textAlign: 'left' }}>Razón Social</th>
              <th style={{ textAlign: 'left' }}>Nro. Factura</th>
              <th>Neto</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                  No hay registros con los filtros seleccionados
                </td>
              </tr>
            ) : (
              filtered.map(tx => (
                <tr key={tx.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{formatFecha(tx.fecha)}</td>
                  <td>{tx.sociedad}</td>
                  <td>{tx.categoria}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{tx.sub_categoria ?? '—'}</td>
                  <td>
                    <span style={{
                      fontSize: 11,
                      padding: '2px 7px',
                      borderRadius: 10,
                      background: tx.tipo === 'Ingreso' ? '#d1fae5' : tx.tipo === 'Sueldo' ? '#dbeafe' : '#fef3c7',
                      color:      tx.tipo === 'Ingreso' ? '#065f46' : tx.tipo === 'Sueldo' ? '#1e40af' : '#92400e',
                    }}>
                      {TIPO_LABELS[tx.tipo] ?? tx.tipo}
                    </span>
                  </td>
                  <td style={{ fontSize: 13 }}>{tx.razon_social ?? '—'}</td>
                  <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>{tx.nro_factura ?? '—'}</td>
                  <td style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(tx.neto)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
