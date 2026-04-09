'use client'

import { useState, useTransition } from 'react'
import type { CatalogItem } from '@/lib/data/types'
import { saveCatalogItem, deactivateCatalogItem } from '@/app/admin/actions'

interface Props {
  items: CatalogItem[]
}

const TIPOS = ['Ingreso', 'Egreso', 'Sueldo']

export function CatalogManager({ items }: Props) {
  const [isPending, startTransition] = useTransition()
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('active')

  // Form state para nuevo ítem
  const [newTipo,     setNewTipo]     = useState('')
  const [newCat,      setNewCat]      = useState('')
  const [newSubCat,   setNewSubCat]   = useState('')

  function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const res = await saveCatalogItem(fd)
      setMsg({ text: res.message, ok: res.success })
      if (res.success) {
        setShowForm(false)
        setNewTipo(''); setNewCat(''); setNewSubCat('')
      }
    })
  }

  function handleToggle(item: CatalogItem) {
    startTransition(async () => {
      const fd = new FormData()
      fd.append('id', item.id)
      fd.append('active', item.active ? 'false' : 'true')
      const res = await deactivateCatalogItem(fd)
      setMsg({ text: res.message, ok: res.success })
    })
  }

  const filtered = items.filter(item => {
    if (filterActive === 'active')   return item.active
    if (filterActive === 'inactive') return !item.active
    return true
  })

  return (
    <div>
      {msg && (
        <div style={{
          padding: '10px 14px', borderRadius: 6, marginBottom: 16, fontSize: 13,
          background: msg.ok ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
          color: msg.ok ? 'var(--success)' : 'var(--danger)',
          border: `1px solid ${msg.ok ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
        }}>
          {msg.text}
        </div>
      )}

      {/* Controles */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['all', 'active', 'inactive'] as const).map(f => (
            <button
              key={f}
              className={`btn-sm${filterActive === f ? '' : ''}`}
              style={{
                fontWeight: filterActive === f ? 700 : 400,
                background: filterActive === f ? 'var(--accent)' : undefined,
                color: filterActive === f ? '#fff' : undefined,
              }}
              onClick={() => setFilterActive(f)}
            >
              {f === 'all' ? 'Todos' : f === 'active' ? 'Activos' : 'Inactivos'}
            </button>
          ))}
        </div>
        <button
          className="btn-sm"
          style={{ background: 'var(--accent)', color: '#fff' }}
          onClick={() => setShowForm(s => !s)}
        >
          {showForm ? '✕ Cancelar' : '+ Nuevo ítem'}
        </button>
      </div>

      {/* Formulario nuevo ítem */}
      {showForm && (
        <form onSubmit={handleSave} style={{
          background: 'var(--bg-hover)', border: '1px solid var(--border)',
          borderRadius: 8, padding: 16, marginBottom: 20,
          display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 10, alignItems: 'end',
        }}>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Tipo *</label>
            <select name="tipo" required className="form-input" value={newTipo} onChange={e => setNewTipo(e.target.value)}>
              <option value="">Seleccionar…</option>
              {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Categoría *</label>
            <input
              name="categoria"
              required
              className="form-input"
              placeholder="Ej: Gastos Administrativos"
              value={newCat}
              onChange={e => setNewCat(e.target.value)}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Sub-Categoría</label>
            <input
              name="sub_categoria"
              className="form-input"
              placeholder="Opcional"
              value={newSubCat}
              onChange={e => setNewSubCat(e.target.value)}
            />
          </div>
          <button type="submit" className="btn-sm" disabled={isPending}
            style={{ background: 'var(--accent)', color: '#fff', height: 38, whiteSpace: 'nowrap' }}>
            {isPending ? 'Guardando…' : 'Guardar'}
          </button>
        </form>
      )}

      {/* Tabla */}
      <div style={{ overflowX: 'auto' }}>
        <table className="pl-table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Tipo</th>
              <th style={{ textAlign: 'left' }}>Categoría</th>
              <th style={{ textAlign: 'left' }}>Sub-Categoría</th>
              <th style={{ textAlign: 'center' }}>Estado</th>
              <th style={{ textAlign: 'center' }}>Acción</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)' }}>
                  No hay ítems con este filtro
                </td>
              </tr>
            ) : (
              filtered.map(item => (
                <tr key={item.id} style={{ opacity: item.active ? 1 : 0.5 }}>
                  <td>
                    <span style={{
                      fontSize: 11, padding: '2px 7px', borderRadius: 10,
                      background: item.tipo === 'Ingreso' ? '#d1fae5' : item.tipo === 'Sueldo' ? '#dbeafe' : '#fef3c7',
                      color:      item.tipo === 'Ingreso' ? '#065f46' : item.tipo === 'Sueldo' ? '#1e40af' : '#92400e',
                    }}>
                      {item.tipo}
                    </span>
                  </td>
                  <td>{item.categoria}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{item.sub_categoria ?? '—'}</td>
                  <td style={{ textAlign: 'center' }}>
                    <span style={{ fontSize: 11, color: item.active ? 'var(--success)' : 'var(--text-muted)' }}>
                      {item.active ? '● Activo' : '○ Inactivo'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <button
                      className="btn-sm"
                      disabled={isPending}
                      onClick={() => handleToggle(item)}
                      style={{ fontSize: 11 }}
                    >
                      {item.active ? 'Desactivar' : 'Reactivar'}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-muted)' }}>
        {filtered.length} ítem(s) · {items.filter(i => i.active).length} activos en total
      </div>
    </div>
  )
}
