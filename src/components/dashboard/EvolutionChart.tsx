'use client'

import { useEffect, useRef } from 'react'
import type { CompanyData, ViewMode } from '@/lib/data/types'
import { MONTHS } from '@/lib/data/pl-structure'
import { fmtFull } from '@/lib/utils/format'

interface Props {
  companyData: CompanyData
  view:        ViewMode
}

export function EvolutionChart({ companyData, view }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chartRef  = useRef<any>(null)

  useEffect(() => {
    // Importar Chart.js dinámicamente (solo en browser)
    let destroyed = false
    import('chart.js/auto').then(({ Chart }) => {
      if (destroyed || !canvasRef.current) return

      // Destruir chart anterior si existe
      if (chartRef.current) {
        chartRef.current.destroy()
        chartRef.current = null
      }

      const real = companyData.real
      const ppto = companyData.ppto
      const le   = companyData.le

      const mkSeries = (key: string, tipo: 'real' | 'ppto' | 'le') => {
        const src = companyData[tipo] as any
        return MONTHS.map((_, i) => src?.[key]?.[i] ?? null)
      }

      // Datasets según la vista activa
      const datasets: any[] = []

      if (view === 'real' || view === 'comp' || view === 'comp_le' || view === 'yoy') {
        datasets.push({
          label: 'Ingresos Real',
          data: mkSeries('Total Ingresos', 'real'),
          backgroundColor: 'rgba(0,212,170,0.15)',
          borderColor: '#00d4aa',
          borderWidth: 2,
          pointRadius: 4,
          type: 'bar',
          order: 2,
        })
        datasets.push({
          label: 'EBITDA Real',
          data: mkSeries('EBITDA', 'real'),
          borderColor: '#3b82f6',
          borderWidth: 2.5,
          pointRadius: 5,
          type: 'line',
          tension: 0.3,
          fill: false,
          order: 1,
        })
        datasets.push({
          label: 'RDO. Neto Real',
          data: mkSeries('RDO. NETO', 'real'),
          borderColor: '#a855f7',
          borderWidth: 2,
          pointRadius: 4,
          type: 'line',
          tension: 0.3,
          fill: false,
          order: 1,
        })
      }

      if (view === 'ppto') {
        datasets.push({
          label: 'Ingresos Ppto',
          data: mkSeries('Total Ingresos', 'ppto'),
          backgroundColor: 'rgba(59,130,246,0.15)',
          borderColor: '#3b82f6',
          borderWidth: 2,
          type: 'bar',
          order: 2,
        })
        datasets.push({
          label: 'EBITDA Ppto',
          data: mkSeries('EBITDA', 'ppto'),
          borderColor: '#00d4aa',
          borderWidth: 2,
          type: 'line',
          tension: 0.3,
          fill: false,
          order: 1,
        })
      }

      if (view === 'le' || view === 'comp_le' || view === 'le_ppto') {
        datasets.push({
          label: 'Ingresos LE',
          data: mkSeries('Total Ingresos', 'le'),
          backgroundColor: 'rgba(245,158,11,0.15)',
          borderColor: '#f59e0b',
          borderWidth: 2,
          type: 'bar',
          order: 2,
        })
        datasets.push({
          label: 'EBITDA LE',
          data: mkSeries('EBITDA', 'le'),
          borderColor: '#f59e0b',
          borderWidth: 2,
          borderDash: [5, 3],
          type: 'line',
          tension: 0.3,
          fill: false,
          order: 1,
        })
      }

      if (view === 'comp' || view === 'le_ppto') {
        datasets.push({
          label: view === 'comp' ? 'Ingresos Ppto' : 'Ingresos Ppto',
          data: mkSeries('Total Ingresos', 'ppto'),
          backgroundColor: 'rgba(59,130,246,0.10)',
          borderColor: '#3b82f6',
          borderWidth: 1.5,
          borderDash: [4, 4],
          type: 'line',
          tension: 0.3,
          fill: false,
          order: 1,
        })
      }

      chartRef.current = new Chart(canvasRef.current, {
        type: 'bar',
        data: { labels: [...MONTHS], datasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: '#1a2540',
              borderColor: '#1e2d45',
              borderWidth: 1,
              titleColor: '#f1f5f9',
              bodyColor: '#94a3b8',
              callbacks: {
                label: (ctx: any) => ' ' + ctx.dataset.label + ': ' + fmtFull(ctx.raw),
              },
            },
          },
          scales: {
            x: {
              grid: { color: 'rgba(30,45,69,0.5)' },
              ticks: { color: '#475569', font: { size: 11 } },
            },
            y: {
              grid: { color: 'rgba(30,45,69,0.5)' },
              ticks: {
                color: '#475569',
                font: { size: 11 },
                callback: (v: any) => {
                  if (Math.abs(v) >= 1e6) return '$' + (v / 1e6).toFixed(0) + 'M'
                  if (Math.abs(v) >= 1e3) return '$' + (v / 1e3).toFixed(0) + 'K'
                  return '$' + v
                },
              },
            },
          },
        },
      })
    })

    return () => {
      destroyed = true
      if (chartRef.current) {
        chartRef.current.destroy()
        chartRef.current = null
      }
    }
  }, [companyData, view])

  return (
    <div className="chart-card">
      <div className="chart-title">Evolución mensual</div>
      <div className="chart-subtitle">Ingresos · EBITDA · RDO. Neto — Montos en ARS</div>
      <div className="chart-container" style={{ height: 260 }}>
        <canvas ref={canvasRef} />
      </div>
      <div className="legend-row">
        <div className="legend-item"><div className="legend-dot" style={{ background: '#00d4aa' }} /> Ingresos</div>
        <div className="legend-item"><div className="legend-dot" style={{ background: '#ef4444' }} /> Total Gastos</div>
        <div className="legend-item"><div className="legend-dot" style={{ background: '#3b82f6' }} /> EBITDA</div>
        <div className="legend-item"><div className="legend-dot" style={{ background: '#a855f7' }} /> RDO. Neto</div>
        <div className="legend-item"><div className="legend-dot" style={{ background: '#f59e0b' }} /> LE</div>
      </div>
    </div>
  )
}
