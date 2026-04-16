'use client'

import { useEffect, useRef } from 'react'
import type { CompanyData } from '@/lib/data/types'
import { MONTHS } from '@/lib/data/pl-structure'
import { fmtFull } from '@/lib/utils/format'

interface Props {
  companyData: CompanyData
}

export function EvolutionChart({ companyData }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chartRef  = useRef<any>(null)

  useEffect(() => {
    let destroyed = false
    import('chart.js/auto').then(({ Chart }) => {
      if (destroyed || !canvasRef.current) return

      if (chartRef.current) {
        chartRef.current.destroy()
        chartRef.current = null
      }

      const mkSeries = (key: string) => {
        const src = companyData.real as any
        return MONTHS.map((_, i) => src?.[key]?.[i] ?? null)
      }

      const datasets: any[] = [
        {
          label: 'Ingresos',
          data: mkSeries('Total Ingresos'),
          backgroundColor: 'rgba(0,212,170,0.15)',
          borderColor: '#00d4aa',
          borderWidth: 2,
          pointRadius: 4,
          type: 'bar',
          order: 2,
        },
        {
          label: 'EBITDA',
          data: mkSeries('EBITDA'),
          borderColor: '#3b82f6',
          borderWidth: 2.5,
          pointRadius: 5,
          type: 'line',
          tension: 0.3,
          fill: false,
          order: 1,
        },
        {
          label: 'RDO. Neto',
          data: mkSeries('RDO. NETO'),
          borderColor: '#a855f7',
          borderWidth: 2,
          pointRadius: 4,
          type: 'line',
          tension: 0.3,
          fill: false,
          order: 1,
        },
      ]

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
  }, [companyData])

  return (
    <div className="chart-card">
      <div className="chart-title">Evolución mensual</div>
      <div className="chart-subtitle">Ingresos · EBITDA · RDO. Neto — ARS</div>
      <div className="chart-container" style={{ height: 260 }}>
        <canvas ref={canvasRef} />
      </div>
      <div className="legend-row">
        <div className="legend-item"><div className="legend-dot" style={{ background: '#00d4aa' }} /> Ingresos</div>
        <div className="legend-item"><div className="legend-dot" style={{ background: '#3b82f6' }} /> EBITDA</div>
        <div className="legend-item"><div className="legend-dot" style={{ background: '#a855f7' }} /> RDO. Neto</div>
      </div>
    </div>
  )
}
