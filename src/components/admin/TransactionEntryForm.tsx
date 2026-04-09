'use client'

import { useState, useTransition } from 'react'
import type { CatalogItem } from '@/lib/data/types'
import { saveTransaction } from '@/app/admin/actions'

interface Props {
  catalogItems: CatalogItem[]
}

export function TransactionEntryForm({ catalogItems }: Props) {
  const [isPending, startTransition] = useTransition()
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)

  // Selects encadenados
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

  function handleTipoChange(val: string) {
    setTipo(val); setCategoria(''); setSubCat('')
  }
  function handleCatChange(val: string) {
    setCategoria(val); setSubCat('')
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const res = await saveTransaction(fd)
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

      {/* Sección 1: Clasificación P&L (requerida) */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12, color: 'var(--text-primary)', borderBottom: '1px solid var(--border)', paddingBottom: 6 }}>
          Clasificación P&L
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
          <div>
            <label className="form-label">Tipo *</label>
            <select name="tipo" required className="form-input" value={tipo} onChange={e => handleTipoChange(e.target.value)}>
              <option value="">Seleccionar…</option>
              {tipos.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Categoría *</label>
            <select name="categoria" required className="form-input" value={categoria} onChange={e => handleCatChange(e.target.value)} disabled={!tipo}>
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
            <label className="form-label">Sociedad *</label>
            <select name="sociedad" required className="form-input">
              <option value="">Seleccionar…</option>
              <option value="TG">TG</option>
              <option value="CDS">CDS</option>
              <option value="VA">VA</option>
            </select>
          </div>
          <div>
            <label className="form-label">Fecha *</label>
            <input name="fecha" type="date" required className="form-input" />
          </div>
          <div>
            <label className="form-label">Neto (ARS) *</label>
            <input name="neto" type="number" step="0.01" required className="form-input" placeholder="0.00" />
          </div>
        </div>
      </div>

      {/* Sección 2: Datos del proveedor/cliente (opcionales) */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12, color: 'var(--text-primary)', borderBottom: '1px solid var(--border)', paddingBottom: 6 }}>
          Datos del proveedor / cliente <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(opcionales)</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
          <div>
            <label className="form-label">Razón Social</label>
            <input name="razon_social" className="form-input" placeholder="Nombre de la empresa" />
          </div>
          <div>
            <label className="form-label">CUIT</label>
            <input name="cuit" className="form-input" placeholder="XX-XXXXXXXX-X" />
          </div>
          <div>
            <label className="form-label">Provincia</label>
            <input name="provincia" className="form-input" />
          </div>
          <div>
            <label className="form-label">Ciudad</label>
            <input name="ciudad" className="form-input" />
          </div>
          <div>
            <label className="form-label">Condición IVA</label>
            <select name="condicion_iva" className="form-input">
              <option value="">—</option>
              <option>Responsable Inscripto</option>
              <option>Monotributista</option>
              <option>Exento</option>
              <option>Consumidor Final</option>
            </select>
          </div>
          <div>
            <label className="form-label">Nro. Factura</label>
            <input name="nro_factura" className="form-input" placeholder="0001-00001234" />
          </div>
        </div>
      </div>

      {/* Sección 3: Desglose fiscal (opcionales) */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12, color: 'var(--text-primary)', borderBottom: '1px solid var(--border)', paddingBottom: 6 }}>
          Desglose fiscal <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(opcionales)</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
          {[
            { name: 'importe_neto_gravado', label: 'Neto Gravado' },
            { name: 'importe_no_grav',      label: 'No Gravado' },
            { name: 'iva21',                label: 'IVA 21%' },
            { name: 'iva10',                label: 'IVA 10,5%' },
            { name: 'iva27',                label: 'IVA 27%' },
            { name: 'iva5',                 label: 'IVA 5%' },
            { name: 'iva2',                 label: 'IVA 2,5%' },
            { name: 'iibb',                 label: 'IIBB' },
            { name: 'percepcion_iva',       label: 'Percepción IVA' },
            { name: 'otros_impuestos',      label: 'Otros Impuestos' },
            { name: 'total_iva',            label: 'Total IVA' },
            { name: 'total_facturado',      label: 'Total Facturado' },
          ].map(({ name, label }) => (
            <div key={name}>
              <label className="form-label">{label}</label>
              <input name={name} type="number" step="0.01" className="form-input" placeholder="0.00" />
            </div>
          ))}
        </div>
        <div style={{ marginTop: 12 }}>
          <label className="form-label">Observaciones</label>
          <textarea name="observaciones" className="form-input" rows={2} style={{ resize: 'vertical' }} />
        </div>
      </div>

      <button type="submit" className="form-submit" disabled={isPending}>
        {isPending ? 'Guardando…' : 'Guardar transacción'}
      </button>
    </form>
  )
}
