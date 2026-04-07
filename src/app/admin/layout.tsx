import { createClient } from '@/lib/supabase/server'
import { signOut } from '@/app/login/actions'
import '@/styles/dashboard.css'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <>
      {/* Barra de admin */}
      <div style={{
        background: 'var(--bg-card)',
        borderBottom: '1px solid var(--border)',
        padding: '0 24px',
        height: 48,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}>
        <span style={{ color: 'var(--accent)', fontWeight: 700, fontSize: 14 }}>
          GRUPO TEMPLE · Admin
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {user && (
            <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{user.email}</span>
          )}
          <form action={signOut}>
            <button
              className="btn-sm"
              type="submit"
              style={{ fontSize: 12 }}
            >
              Cerrar sesión
            </button>
          </form>
        </div>
      </div>
      {children}
    </>
  )
}
