'use client'

import { useState } from 'react'
import { saveEntry } from '@/app/admin/actions'

const MONTHS = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC']
const GRUPOS = [
  'Total Ingresos',
  'Sueldos',
  'Gastos Personal',
  'Gastos Administrativos',
  'Gastos Marketing',
  'Tercerizados',
  'Otros',
]

export function ManualEntryForm() {
  const [status, setStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setStatus(null)

    const formData = new FormData(e.currentTarget)
    const result = await saveEntry(formData)

    setStatus({ type: result.success ? 'success' : 'error', msg: result.message })
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="form-group">
          <label className="form-label">Empresa</label>
          <select className="form-select" name="empresa" required>
            <option value="">Seleccionar…</option>
            <option value="TG">TG</option>
            <option value="CDS">CDS</option>
            <option value="VA">VA</option>
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Tipo</label>
          <select className="form-select" name="tipo" required>
            <option value="">Seleccionar…</option>
            <option value="Real">Real</option>
            <option value="Presupuesto">Presupuesto</option>
            <option value="LE">LE (Last Estimate)</option>
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Año</label>
          <input
            className="form-input"
            type="number"
            name="year"
            defaultValue={new Date().getFullYear()}
            min={2000}
            max={2099}
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label">Mes</label>
          <select className="form-select" name="month" required>
            <option value="">Seleccionar…</option>
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>{m}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Grupo P&amp;L</label>
        <select className="form-select" name="grupo_pl" required>
          <option value="">Seleccionar…</option>
          {GRUPOS.map(g => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label className="form-label">Monto (ARS)</label>
        <input
          className="form-input"
          type="number"
          name="amount"
          placeholder="Ej: 1500000"
          step="0.01"
        />
        <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
          Dejá vacío para marcar el período como sin dato.
          Para gastos, ingresá el valor positivo (la app maneja el signo).
        </span>
      </div>

      <button className="btn-primary" type="submit" disabled={loading}>
        {loading ? 'Guardando…' : 'Guardar registro'}
      </button>

      {status && (
        <div className={`alert alert-${status.type}`}>
          {status.msg}
        </div>
      )}
    </form>
  )
}
