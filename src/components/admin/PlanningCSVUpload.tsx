'use client'

import { useState, useTransition } from 'react'
import { uploadPlanningCSV } from '@/app/admin/actions'

export function PlanningCSVUpload() {
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<{
    success: boolean
    message: string
    inserted?: number
    errors?: number
    errorRows?: string[]
  } | null>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const res = await uploadPlanningCSV(fd)
      setResult(res)
      if (res.success) (e.currentTarget as HTMLFormElement).reset()
    })
  }

  return (
    <div>
      <div style={{
        background: 'var(--bg-hover)',
        border: '1px solid rgba(245,158,11,0.3)',
        borderRadius: 6,
        padding: '10px 14px',
        marginBottom: 20,
        fontSize: 12,
        color: 'var(--warning)',
      }}>
        <strong>Formato CSV esperado (columnas):</strong><br />
        <code>entry_type, year, month, sociedad, tipo, categoria, sub_categoria, monto</code>
        <br /><br />
        <strong>Notas:</strong><br />
        • <code>entry_type</code>: Presupuesto o LE<br />
        • <code>sociedad</code>: TG, CDS o VA<br />
        • <code>month</code>: número 1–12<br />
        • Si ya existe una entrada para la misma combinación, el monto se <strong>sobreescribe</strong> (upsert)<br />
        • Ideal para cargar el presupuesto anual completo: 12 meses × categorías × empresas
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 16 }}>
          <label className="form-label">Archivo CSV *</label>
          <input
            name="csv"
            type="file"
            accept=".csv,text/csv"
            required
            className="form-input"
            style={{ padding: '6px 10px' }}
          />
        </div>

        <button type="submit" className="form-submit" disabled={isPending}>
          {isPending ? 'Procesando…' : 'Subir CSV'}
        </button>
      </form>

      {result && (
        <div style={{
          marginTop: 16,
          padding: '12px 16px',
          borderRadius: 6,
          background: result.success ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
          border: `1px solid ${result.success ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
          color: result.success ? 'var(--success)' : 'var(--danger)',
          fontSize: 13,
        }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>{result.message}</div>
          {result.errorRows && result.errorRows.length > 0 && (
            <ul style={{ margin: '8px 0 0 16px', padding: 0 }}>
              {result.errorRows.slice(0, 20).map((row, i) => (
                <li key={i} style={{ marginBottom: 2 }}>{row}</li>
              ))}
              {result.errorRows.length > 20 && (
                <li>… y {result.errorRows.length - 20} más</li>
              )}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
