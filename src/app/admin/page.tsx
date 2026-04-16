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

          <Link href="/admin/importar" style={{ textDecoration: 'none' }}>
            <div style={{
              background: 'var(--bg-hover)', border: '1px solid var(--border)',
              borderRadius: 8, padding: 20, cursor: 'pointer', transition: 'border-color .15s',
            }}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>📤</div>
              <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
                Importar CSV
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Cargá los archivos de ingresos, egresos o sueldos de Grupo Temple. Importación idempotente.
              </div>
            </div>
          </Link>

          <Link href="/admin/presupuesto-le" style={{ textDecoration: 'none' }}>
            <div style={{
              background: 'var(--bg-hover)', border: '1px solid var(--border)',
              borderRadius: 8, padding: 20, cursor: 'pointer',
            }}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>📊</div>
              <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
                Presupuesto y LE
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Cargá el presupuesto anual y el Last Estimate a nivel sub-categoría. CSV o entrada fila a fila.
              </div>
            </div>
          </Link>

          <Link href="/admin/catalogo" style={{ textDecoration: 'none' }}>
            <div style={{
              background: 'var(--bg-hover)', border: '1px solid var(--border)',
              borderRadius: 8, padding: 20, cursor: 'pointer',
            }}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>🗂</div>
              <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
                Catálogo de Clasificación
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Gestioná el árbol Tipo → Categoría → Sub-Categoría sin tocar código.
              </div>
            </div>
          </Link>

          <Link href="/admin/sociedades" style={{ textDecoration: 'none' }}>
            <div style={{
              background: 'var(--bg-hover)', border: '1px solid var(--border)',
              borderRadius: 8, padding: 20, cursor: 'pointer',
            }}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>🏢</div>
              <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
                Sociedades
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Gestioná las entidades legales del grupo (TG, CDS, VA). Activar o desactivar visibilidad.
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
