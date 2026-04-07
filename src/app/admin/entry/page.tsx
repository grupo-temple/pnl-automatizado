import { ManualEntryForm } from '@/components/admin/ManualEntryForm'
import Link from 'next/link'
import '@/styles/dashboard.css'

export default function EntryPage() {
  return (
    <div className="admin-layout">
      <div className="admin-card">
        <div className="admin-title">Ingreso manual</div>
        <div className="admin-subtitle">
          Cargá o editá un valor específico sin re-subir el CSV completo.
          Si ya existe un registro para esa combinación, se sobreescribe.
        </div>
        <ManualEntryForm />
      </div>

      <div style={{ textAlign: 'center', marginTop: 16 }}>
        <Link href="/admin" style={{ color: 'var(--text-muted)', fontSize: 12 }}>
          ← Volver al panel
        </Link>
      </div>
    </div>
  )
}
