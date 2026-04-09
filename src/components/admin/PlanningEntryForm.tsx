'use client'

import { useState, useTransition } from 'react'
import type { CatalogItem } from '@/lib/data/types'
import { savePlanningEntry } from '@/app/admin/actions'
import { MONTHS } from '@/lib/data/pl-structure'

interface Props {
  catalogItems: CatalogItem[]
}

const CURRENT_YEAR = new Date().getFullYear()
const YEARS = [CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1]

export function PlanningEntryForm({ catalogItems }: Props) {
  const [isPending, startTransition] = useTransition()
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)

  const [tipo,      setTipo]      = useState('')
  const [categoria, setCategoria] = useState('')
  const [subCat,    setSubCat]    = useState('')

  const tipos = [...new Set(catalogItems.map(i => i.tipo))].sort()
  const categorias = [...new Set(
    catalogItems.filter(i => i.tipo === tipo).map(i => i.categoria)
  )].sort()
  const subCategorias = catalogItems
    .filter(i => i.tipo === tipo && i.categoria === categoria && i.sub_categoria !== null)
    .map(i => i.sub_categoria as string)
    .sort()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const res = await savePlanningEntry(fd)
      setMsg({ text: res.message, ok: res.success })
      if (res.success) {
        e.currentTarget?.reset?.()
        setTipo(''); setCategoria(''); setSubCat('')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit}>
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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 14 }}>
        <div>
          <label className="form-label">Tipo de plan *</label>
          <select name="entry_type" required className="form-input">
            <option value="">Seleccionar…</option>
            <option value="Presupuesto">Presupuesto</option>
            <option value="LE">LE (Last Estimate)</option>
          </select>
        </div>

        <div>
          <label className="form-label">Año *</label>
          <select name="year" required className="form-input" defaultValue={CURRENT_YEAR}>
            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        <div>
          <label className="form-label">Mes *</label>
          <select name="month" required className="form-input">
            <option value="">Seleccionar…</option>
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
        </div>

        <div>
          <label className="form-label">Sociedad *</label>
          <select name="sociedad" required className="form-input">
            <option value="">Seleccionar…</option>
            <option value="TG">TG</option>
            <option value="CDS">CDS</option>
            <option value="VA">VA</option>
          </select>
        </div>

        <div>
          <label className="form-label">Tipo *</label>
          <select name="tipo" required className="form-input" value={tipo} onChange={e => { setTipo(e.target.value); setCategoria(''); setSubCat('') }}>
            <option value="">Seleccionar…</option>
            {tipos.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <div>
          <label className="form-label">Categoría *</label>
          <select name="categoria" required className="form-input" value={categoria} onChange={e => { setCategoria(e.target.value); setSubCat('') }} disabled={!tipo}>
            <option value="">Seleccionar…</option>
            {categorias.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div>
          <label className="form-label">Sub-Categoría</label>
          <select name="sub_categoria" className="form-input" value={subCat} onChange={e => setSubCat(e.target.value)} disabled={!categoria}>
            <option value="">Sin sub-categoría</option>
            {subCategorias.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div>
          <label className="form-label">Monto (ARS) *</label>
          <input name="monto" type="number" step="0.01" required className="form-input" placeholder="0.00" />
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <button type="submit" className="form-submit" disabled={isPending} style={{ width: 'auto' }}>
          {isPending ? 'Guardando…' : 'Guardar entrada'}
        </button>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 12 }}>
          Si ya existe una entrada para esta combinación, se sobreescribe el monto.
        </span>
      </div>
    </form>
  )
}
