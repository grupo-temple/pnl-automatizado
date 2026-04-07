export default function DashboardLoading() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      background: '#080f1e',
      color: '#94a3b8',
      fontFamily: 'Segoe UI, system-ui, sans-serif',
      fontSize: 13,
      gap: 10,
    }}>
      <span style={{
        display: 'inline-block',
        width: 16,
        height: 16,
        borderRadius: '50%',
        border: '2px solid #1e2d45',
        borderTopColor: '#00d4aa',
        animation: 'spin 0.7s linear infinite',
      }} />
      Cargando datos…
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
