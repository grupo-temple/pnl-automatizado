import { CSVUploadForm } from '@/components/admin/CSVUploadForm'
import Link from 'next/link'
import '@/styles/dashboard.css'

export default function UploadPage() {
  return (
    <div className="admin-layout">
      <div className="admin-card">
        <div className="admin-title">Cargar datos desde CSV</div>
        <div className="admin-subtitle">
          Exportá el Google Sheet como CSV y subilo aquí. Los datos existentes del mismo año/empresa/tipo se sobreescriben automáticamente.
        </div>

        <div style={{
          background: 'var(--bg-hover)',
          border: '1px solid rgba(245,158,11,0.3)',
          borderRadius: 6,
          padding: '10px 14px',
          marginBottom: 20,
          fontSize: 12,
          color: 'var(--warning)',
        }}>
          <strong>Formato esperado:</strong> grupo_pl, empresa, tipo, ENE, FEB, MAR, ABR, MAY, JUN, JUL, AGO, SEP, OCT, NOV, DIC
          <br />
          Valores de tipo aceptados: <code>Real</code>, <code>Presupuesto</code>, <code>LE</code>
          <br />
          Empresas aceptadas: <code>TG</code>, <code>CDS</code>, <code>VA</code> (Consolidado se ignora — se calcula).
          {' '}
          <a href="/templates/pl-template.csv" download style={{ color: 'var(--accent)' }}>
            Descargar template
          </a>
        </div>

        <CSVUploadForm />
      </div>

      <div style={{ textAlign: 'center', marginTop: 16 }}>
        <Link href="/admin" style={{ color: 'var(--text-muted)', fontSize: 12 }}>
          ← Volver al panel
        </Link>
      </div>
    </div>
  )
}
