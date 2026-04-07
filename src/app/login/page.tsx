'use client'

import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { signIn, resetPassword } from './actions'
import '@/styles/dashboard.css'

function LoginForm() {
  const [error, setError]       = useState<string | null>(null)
  const [loading, setLoading]   = useState(false)
  const [showReset, setShowReset] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirectTo') || '/dashboard'

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    formData.set('redirectTo', redirectTo)

    const result = await signIn(formData)
    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
  }

  async function handleReset(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    const result = await resetPassword(formData)

    if (result?.error) {
      setError(result.error)
    } else {
      setResetSent(true)
    }
    setLoading(false)
  }

  if (showReset) {
    return (
      <div className="login-container">
        <div className="login-card">
          <div className="login-logo">GRUPO TEMPLE</div>
          <div className="login-subtitle">Recuperar contraseña</div>

          {resetSent ? (
            <div>
              <div className="alert" style={{ background: '#d1fae5', color: '#065f46', padding: 12, borderRadius: 6, marginBottom: 16 }}>
                Te enviamos un email con el link para restablecer tu contraseña.
              </div>
              <button className="btn-primary" style={{ width: '100%' }} onClick={() => { setShowReset(false); setResetSent(false) }}>
                Volver al login
              </button>
            </div>
          ) : (
            <form onSubmit={handleReset}>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input
                  className="form-input"
                  type="email"
                  name="email"
                  autoComplete="email"
                  required
                  autoFocus
                />
              </div>

              {error && (
                <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>
              )}

              <button className="btn-primary" type="submit" disabled={loading} style={{ width: '100%' }}>
                {loading ? 'Enviando…' : 'Enviar email de recuperación'}
              </button>

              <div style={{ marginTop: 12, textAlign: 'center' }}>
                <button type="button" onClick={() => setShowReset(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13 }}>
                  Volver al login
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-logo">GRUPO TEMPLE</div>
        <div className="login-subtitle">Dashboard P&amp;L · Acceso administrador</div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              className="form-input"
              type="email"
              name="email"
              autoComplete="email"
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label">Contraseña</label>
            <input
              className="form-input"
              type="password"
              name="password"
              autoComplete="current-password"
              required
            />
          </div>

          {error && (
            <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>
          )}

          <button className="btn-primary" type="submit" disabled={loading} style={{ width: '100%' }}>
            {loading ? 'Ingresando…' : 'Ingresar'}
          </button>
        </form>

        <div style={{ marginTop: 12, textAlign: 'center' }}>
          <button type="button" onClick={() => { setShowReset(true); setError(null) }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13 }}>
            Olvidé mi contraseña
          </button>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
