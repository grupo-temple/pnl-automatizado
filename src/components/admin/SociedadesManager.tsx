'use client'

import { useState, useTransition } from 'react'
import { saveSociedad, toggleSociedadActive } from '@/app/admin/actions'

interface Sociedad {
  id: string
  codigo: string
  nombre: string
  active: boolean
}

interface Props {
  sociedades: Sociedad[]
}

export function SociedadesManager({ sociedades }: Props) {
  const [isPending, startTransition] = useTransition()
  const [msg, setMsg]   = useState<{ text: string; ok: boolean } | null>(null)
  const [showForm, setShowForm] = useState(false)

  function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const res = await saveSociedad(fd)
      setMsg({ text: res.message, ok: res.success })
      if (res.success) setShowForm(false)
    })
  }

  function handleToggle(s: Sociedad) {
    const fd = new FormData()
    fd.append('id', s.id)
    fd.append('active', s.active ? 'false' : 'true')
    startTransition(async () => {
      const res = await toggleSociedadActive(fd)
      setMsg({ text: res.message, ok: res.success })
    })
  }

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

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button
          className="btn-sm"
          style={{ background: 'var(--accent)', color: '#fff' }}
          onClick={() => setShowForm(s => !s)}
        >
          {showForm ? '✕ Cancelar' : '+ Nueva sociedad'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSave} style={{
          background: 'var(--bg-hover)', border: '1px solid var(--border)',
          borderRadius: 8, padding: 16, marginBottom: 20,
          display: 'grid', gridTemplateColumns: '1fr 2fr auto', gap: 10, alignItems: 'end',
        }}>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
              Código *
            </label>
            <input
              name="codigo"
              required
              className="form-input"
              placeholder="Ej: TG"
              maxLength={10}
              style={{ textTransform: 'uppercase' }}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
              Nombre *
            </label>
            <input
              name="nombre"
              required
              className="form-input"
              placeholder="Ej: Temple Group"
            />
          </div>
          <button
            type="submit"
            className="btn-sm"
            disabled={isPending}
            style={{ background: 'var(--accent)', color: '#fff', height: 38, whiteSpace: 'nowrap' }}
          >
            {isPending ? 'Guardando…' : 'Guardar'}
          </button>
        </form>
      )}

      <table className="pl-table" style={{ width: '100%' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left' }}>Código</th>
            <th style={{ textAlign: 'left' }}>Nombre</th>
            <th style={{ textAlign: 'center' }}>Estado</th>
            <th style={{ textAlign: 'center' }}>Acción</th>
          </tr>
        </thead>
        <tbody>
          {sociedades.length === 0 ? (
            <tr>
              <td colSpan={4} style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)' }}>
                No hay sociedades registradas
              </td>
            </tr>
          ) : (
            sociedades.map(s => (
              <tr key={s.id} style={{ opacity: s.active ? 1 : 0.5 }}>
                <td>
                  <span style={{
                    fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
                    background: 'var(--bg-hover)', border: '1px solid var(--border)',
                    fontFamily: 'monospace',
                  }}>
                    {s.codigo}
                  </span>
                </td>
                <td>{s.nombre}</td>
                <td style={{ textAlign: 'center' }}>
                  <span style={{ fontSize: 11, color: s.active ? 'var(--success)' : 'var(--text-muted)' }}>
                    {s.active ? '● Activa' : '○ Inactiva'}
                  </span>
                </td>
                <td style={{ textAlign: 'center' }}>
                  <button
                    className="btn-sm"
                    disabled={isPending}
                    onClick={() => handleToggle(s)}
                    style={{ fontSize: 11 }}
                  >
                    {s.active ? 'Desactivar' : 'Reactivar'}
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-muted)' }}>
        {sociedades.length} sociedad(es) · {sociedades.filter(s => s.active).length} activas
      </div>
    </div>
  )
}
