import { createAdminClient, createClient } from '@/lib/supabase/server'
import { TransactionEntryForm } from '@/components/admin/TransactionEntryForm'
import { TransactionCSVUpload } from '@/components/admin/TransactionCSVUpload'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import '@/styles/dashboard.css'

export default async function TransaccionesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.user_metadata?.app_role !== 'admin') redirect('/dashboard')

  const adminClient = createAdminClient()
  const { data: catalogItems } = await adminClient
    .from('catalog_items')
    .select('id, tipo, categoria, sub_categoria, active')
    .eq('active', true)
    .order('tipo').order('categoria').order('sub_categoria', { nullsFirst: true })

  return (
    <div className="admin-layout">
      <div className="admin-card">
        <div className="admin-title">Registro de Transacciones Reales</div>
        <div className="admin-subtitle">
          Cargá transacciones con detalle completo de factura. Cada entrada afecta el P&L Real del mes correspondiente.
        </div>

        <div style={{ marginBottom: 32 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>Ingreso manual</div>
          <TransactionEntryForm catalogItems={catalogItems ?? []} />
        </div>

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 24 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>Carga masiva por CSV</div>
          <TransactionCSVUpload />
        </div>
      </div>

      <div style={{ textAlign: 'center', marginTop: 16 }}>
        <Link href="/admin" style={{ color: 'var(--text-muted)', fontSize: 12 }}>
          ← Volver al panel
        </Link>
      </div>
    </div>
  )
}
