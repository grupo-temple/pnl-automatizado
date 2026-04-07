'use client'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error
  reset: () => void
}) {
  const isDbSleep = error.message?.includes('fetch') || error.message?.includes('ECONNREFUSED')

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      background: '#080f1e',
      color: '#f1f5f9',
      fontFamily: 'Segoe UI, system-ui, sans-serif',
      gap: 16,
      padding: 24,
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 32 }}>⏳</div>
      <div style={{ fontSize: 18, fontWeight: 700 }}>
        {isDbSleep ? 'Iniciando la base de datos…' : 'Error al cargar los datos'}
      </div>
      <div style={{ fontSize: 13, color: '#94a3b8', maxWidth: 420 }}>
        {isDbSleep
          ? 'La base de datos estaba pausada por inactividad. Reintentá en 30 segundos mientras se activa.'
          : error.message}
      </div>
      <button
        onClick={reset}
        style={{
          background: '#00d4aa',
          color: '#080f1e',
          border: 'none',
          borderRadius: 6,
          padding: '10px 20px',
          fontWeight: 700,
          cursor: 'pointer',
          fontSize: 13,
        }}
      >
        Reintentar
      </button>
    </div>
  )
}
