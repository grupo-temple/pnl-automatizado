import Link from 'next/link'
import '@/styles/dashboard.css'

export default function AdminPage() {
  return (
    <div className="admin-layout">
      <div className="admin-card">
        <div className="admin-title">Panel de Administración</div>
        <div className="admin-subtitle">
          Grupo Temple · Dashboard P&amp;L — Carga y gestión de datos financieros
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Link href="/admin/upload" style={{ textDecoration: 'none' }}>
            <div style={{
              background: 'var(--bg-hover)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: 20,
              cursor: 'pointer',
              transition: 'border-color .15s',
            }}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>📤</div>
              <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
                Cargar CSV
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Subí el archivo exportado del Google Sheet para cargar o actualizar datos de un año completo.
              </div>
            </div>
          </Link>

          <Link href="/admin/entry" style={{ textDecoration: 'none' }}>
            <div style={{
              background: 'var(--bg-hover)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: 20,
              cursor: 'pointer',
            }}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>✏️</div>
              <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
                Ingreso manual
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Editá un valor puntual por empresa, mes, tipo y categoría sin re-subir todo el CSV.
              </div>
            </div>
          </Link>
        </div>
      </div>

      <div style={{ textAlign: 'center', marginTop: 20 }}>
        <Link href="/dashboard" style={{ color: 'var(--text-muted)', fontSize: 12 }}>
          ← Volver al dashboard
        </Link>
      </div>
    </div>
  )
}
