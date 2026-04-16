import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CSVImportPanel } from '@/components/admin/CSVImportPanel'
import Link from 'next/link'
import '@/styles/dashboard.css'

export default async function ImportarPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.user_metadata?.app_role !== 'admin') redirect('/dashboard')

  return (
    <div className="admin-layout">
      <div className="admin-card">
        <div className="admin-title">Importar CSV</div>
        <div className="admin-subtitle">
          Cargá los archivos de ingresos, egresos o sueldos. La importación es idempotente:
          si el mismo período ya existe, se reemplaza.
        </div>
        <CSVImportPanel />
      </div>

      <div style={{ textAlign: 'center', marginTop: 16 }}>
        <Link href="/admin" style={{ color: 'var(--text-muted)', fontSize: 12 }}>
          ← Volver al panel
        </Link>
      </div>
    </div>
  )
}
