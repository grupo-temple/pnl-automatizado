import { createAdminClient, createClient } from '@/lib/supabase/server'
import { PlanningEntryForm } from '@/components/admin/PlanningEntryForm'
import { PlanningCSVUpload } from '@/components/admin/PlanningCSVUpload'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import '@/styles/dashboard.css'

export default async function PresupuestoLEPage() {
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
        <div className="admin-title">Presupuesto y LE</div>
        <div className="admin-subtitle">
          Cargá entradas de Presupuesto o LE a nivel sub-categoría. Si ya existe una entrada
          para la misma combinación (año, mes, sociedad, tipo), el monto se sobreescribe.
        </div>

        <div style={{ marginBottom: 32 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>Ingreso manual</div>
          <PlanningEntryForm catalogItems={catalogItems ?? []} />
        </div>

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 24 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>Carga masiva por CSV</div>
          <PlanningCSVUpload />
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
