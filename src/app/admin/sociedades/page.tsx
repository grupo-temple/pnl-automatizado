import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { SociedadesManager } from '@/components/admin/SociedadesManager'
import Link from 'next/link'
import '@/styles/dashboard.css'

export default async function SociedadesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.user_metadata?.app_role !== 'admin') redirect('/dashboard')

  const adminClient = createAdminClient()
  const { data: sociedades } = await adminClient
    .from('sociedades')
    .select('*')
    .order('codigo')

  return (
    <div className="admin-layout">
      <div className="admin-card">
        <div className="admin-title">Sociedades</div>
        <div className="admin-subtitle">
          Entidades legales de Grupo Temple. Las sociedades activas aparecen en el selector del dashboard.
        </div>
        <SociedadesManager sociedades={sociedades ?? []} />
      </div>

      <div style={{ textAlign: 'center', marginTop: 16 }}>
        <Link href="/admin" style={{ color: 'var(--text-muted)', fontSize: 12 }}>
          ← Volver al panel
        </Link>
      </div>
    </div>
  )
}
