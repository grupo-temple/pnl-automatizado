import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'P&L Dashboard — Grupo Temple',
  description: 'Dashboard de resultados financieros Grupo Temple',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
