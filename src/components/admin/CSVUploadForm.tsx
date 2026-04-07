'use client'

import { useState, useRef } from 'react'
import { uploadCSV } from '@/app/admin/actions'

export function CSVUploadForm() {
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'info'; msg: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setStatus({ type: 'info', msg: 'Procesando archivo…' })

    const formData = new FormData(e.currentTarget)
    const result = await uploadCSV(formData)

    setStatus({ type: result.success ? 'success' : 'error', msg: result.message })
    setLoading(false)
    if (result.success) formRef.current?.reset()
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit}>
      <div className="form-group">
        <label className="form-label">Año de los datos</label>
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
        <label className="form-label">Archivo CSV</label>
        <input
          className="form-input"
          type="file"
          name="csv"
          accept=".csv,text/csv"
          required
          style={{ padding: '6px 12px' }}
        />
        <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
          Máximo 1 MB. Debe estar en UTF-8 (exportar desde Google Sheets o Excel como "CSV UTF-8").
        </span>
      </div>

      <button className="btn-primary" type="submit" disabled={loading}>
        {loading ? 'Procesando…' : 'Subir CSV'}
      </button>

      {status && (
        <div className={`alert alert-${status.type}`}>
          {status.msg}
        </div>
      )}
    </form>
  )
}
