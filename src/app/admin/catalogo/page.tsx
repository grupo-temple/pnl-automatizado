import { createAdminClient } from '@/lib/supabase/server'
import { CatalogManager } from '@/components/admin/CatalogManager'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import '@/styles/dashboard.css'

export default async function CatalogoPage() {
  // Verificar admin
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.user_metadata?.app_role !== 'admin') redirect('/dashboard')

  // Cargar catálogo
  const adminClient = createAdminClient()
  const { data: items } = await adminClient
    .from('catalog_items')
    .select('*')
    .order('tipo')
    .order('categoria')
    .order('sub_categoria', { nullsFirst: true })

  return (
    <div className="admin-layout">
      <div className="admin-card">
        <div className="admin-title">Catálogo de Clasificación</div>
        <div className="admin-subtitle">
          Gestión del árbol Tipo → Categoría → Sub-Categoría. Los ítems inactivos no aparecen
          en los formularios de carga pero sus datos históricos se mantienen.
        </div>
        <CatalogManager items={items ?? []} />
      </div>

      <div style={{ textAlign: 'center', marginTop: 16 }}>
        <Link href="/admin" style={{ color: 'var(--text-muted)', fontSize: 12 }}>
          ← Volver al panel
        </Link>
      </div>
    </div>
  )
}
